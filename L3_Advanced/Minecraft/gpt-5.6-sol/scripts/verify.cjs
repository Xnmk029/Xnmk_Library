const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "artifacts");
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const requestedUrl = process.env.GAME_URL || "http://127.0.0.1:4173/";
const verificationUrl = new URL(requestedUrl);
verificationUrl.searchParams.set("verify", "1");
const url = verificationUrl.toString();
const lockPath = path.join(artifacts, ".verify.lock");
const runTimeoutMs = Math.max(30000, Number(process.env.VERIFY_TIMEOUT_MS) || 90000);
const textureConfig = JSON.parse(
  fs.readFileSync(path.join(root, "assets", "texture-config.json"), "utf8"),
);
const expectedTextureSource = textureConfig.cctqAtlas ? "cctq-image" : "procedural-fallback";

fs.mkdirSync(artifacts, { recursive: true });

let lockOwned = false;
let browser = null;
let browserServer = null;
let desktopContext = null;
let mobileContext = null;
let cleanupPromise = null;
let timeoutHandle = null;
let timeoutError = null;

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function acquireRunLock() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = fs.openSync(lockPath, "wx");
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      fs.closeSync(handle);
      lockOwned = true;
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;

      let ownerPid = 0;
      try {
        ownerPid = Number(JSON.parse(fs.readFileSync(lockPath, "utf8")).pid);
      } catch {
        ownerPid = 0;
      }

      if (isProcessAlive(ownerPid)) {
        throw new Error(`Verification is already running in process ${ownerPid}.`);
      }
      fs.rmSync(lockPath, { force: true });
    }
  }
  throw new Error("Unable to acquire the verification lock.");
}

function releaseRunLock() {
  if (!lockOwned) return;
  try {
    const ownerPid = Number(JSON.parse(fs.readFileSync(lockPath, "utf8")).pid);
    if (ownerPid === process.pid) fs.rmSync(lockPath, { force: true });
  } catch {
    fs.rmSync(lockPath, { force: true });
  }
  lockOwned = false;
}

async function settleWithin(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Cleanup operation exceeded ${milliseconds}ms.`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function releasePointerLocks(context) {
  if (!context) return;
  await Promise.allSettled(
    context.pages().map((page) =>
      settleWithin(
        page.evaluate(() => {
          if (document.pointerLockElement) document.exitPointerLock();
        }),
        1000,
      ),
    ),
  );
}

async function cleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    clearTimeout(timeoutHandle);
    await Promise.allSettled([
      releasePointerLocks(desktopContext),
      releasePointerLocks(mobileContext),
    ]);
    await Promise.allSettled([
      desktopContext ? settleWithin(desktopContext.close(), 5000) : Promise.resolve(),
      mobileContext ? settleWithin(mobileContext.close(), 5000) : Promise.resolve(),
    ]);
    desktopContext = null;
    mobileContext = null;
    if (browser) {
      await settleWithin(browser.close(), 5000).catch(() => {});
      browser = null;
    }
    if (browserServer) {
      await settleWithin(browserServer.close(), 3000).catch(() => {});
      const serverProcess = browserServer.process();
      if (serverProcess && serverProcess.exitCode === null) {
        await settleWithin(browserServer.kill(), 5000).catch(() => {});
      }
      browserServer = null;
    }
    releaseRunLock();
  })();
  return cleanupPromise;
}

function handleSignal(signal) {
  const exitCode = signal === "SIGINT" ? 130 : 143;
  void cleanup().finally(() => process.exit(exitCode));
}

process.once("SIGINT", () => handleSignal("SIGINT"));
process.once("SIGTERM", () => handleSignal("SIGTERM"));
process.once("exit", releaseRunLock);

async function inspectPage(page, name, mobile) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.gameReady === "true", null, { timeout: 45000 });
  await page.locator("#enter-world").click();
  await page.waitForTimeout(1800);

  await page.evaluate(() => document.querySelector("#inventory-button").click());
  await page.locator('[data-tab="settings"]').click();
  await page.locator("#eternal-day-toggle").check();
  await page.locator("#creative-mode-toggle").check();
  await page.waitForTimeout(180);

  await page.screenshot({
    path: path.join(artifacts, `fangjie-options-${name}.png`),
    fullPage: false,
  });

  const optionChecks = await page.evaluate(({ mobile }) => {
    const workbenchItem = [...document.querySelectorAll(".inventory-item")]
      .find((item) => item.textContent.includes("工作台"));
    const workbenchIcon = workbenchItem?.querySelector(".texture-icon");
    const iconStyle = workbenchIcon ? getComputedStyle(workbenchIcon) : null;
    const descendDisplay = getComputedStyle(document.querySelector("#touch-descend")).display;
    return {
      optionCount: document.body.dataset.optionCount,
      eternalDay: document.body.dataset.eternalDay,
      creativeMode: document.body.dataset.creativeMode,
      timeLabel: document.querySelector("#time-label").textContent,
      dayLabel: document.querySelector("#day-label").textContent,
      hotbarCount: document.querySelector(".hotbar-slot .item-count").textContent,
      textureRepeat: iconStyle?.backgroundRepeat,
      textureSize: iconStyle?.backgroundSize,
      descendVisible: mobile ? descendDisplay !== "none" : descendDisplay === "none",
    };
  }, { mobile });

  await page.locator("#close-inventory").click();
  await page.waitForTimeout(240);

  const readPlayerY = async () => {
    const coordinates = await page.locator("#coordinates").textContent();
    return Number(coordinates.split("/")[1].trim());
  };
  const flightStartY = await readPlayerY();
  await page.keyboard.down("Space");
  await page.waitForTimeout(520);
  await page.keyboard.up("Space");
  await page.waitForTimeout(160);
  const flightUpY = await readPlayerY();
  await page.keyboard.down("Shift");
  await page.waitForTimeout(520);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(160);
  const flightDownY = await readPlayerY();
  optionChecks.flightUp = flightUpY > flightStartY;
  optionChecks.flightDown = flightDownY < flightUpY;

  const checks = await page.evaluate(async ({ mobile, optionChecks }) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const points = [];
    const pixel = new Uint8Array(4);
    for (let gy = 1; gy <= 7; gy += 1) {
      for (let gx = 1; gx <= 7; gx += 1) {
        const x = Math.floor((canvas.width * gx) / 8);
        const y = Math.floor((canvas.height * gy) / 8);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        points.push([...pixel]);
      }
    }
    const uniqueColors = new Set(points.map((color) => color.join(","))).size;
    const litPixels = points.filter(([r, g, b, a]) => a > 0 && r + g + b > 20).length;
    const viewport = { width: innerWidth, height: innerHeight };
    const hotbar = document.querySelector("#hotbar").getBoundingClientRect();
    const top = document.querySelector(".hud-top").getBoundingClientRect();
    const mobileControls = getComputedStyle(document.querySelector("#mobile-controls")).display;
    return {
      gameReady: document.body.dataset.gameReady,
      persistence: document.body.dataset.chunkPersistenceTest,
      hotbarSlots: document.body.dataset.hotbarSlots,
      recipeCount: document.body.dataset.recipeCount,
      textureSource: document.body.dataset.textureSource,
      verificationMode: document.body.dataset.verificationMode,
      pointerLockActive: Boolean(document.pointerLockElement),
      canvas: { width: canvas.width, height: canvas.height },
      uniqueColors,
      litPixels,
      viewport,
      overflowX: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
      hotbarInside: hotbar.left >= -1 && hotbar.right <= innerWidth + 1 && hotbar.bottom <= innerHeight + 1,
      topInside: top.top >= -1 && top.right <= innerWidth + 1,
      mobileControlsVisible: mobile ? mobileControls !== "none" : mobileControls === "none",
      options: optionChecks,
    };
  }, { mobile, optionChecks });

  await page.screenshot({
    path: path.join(artifacts, `fangjie-${name}.png`),
    fullPage: false,
  });

  return { checks, consoleErrors, pageErrors };
}

async function runVerification() {
  acquireRunLock();
  timeoutHandle = setTimeout(() => {
    timeoutError = new Error(`Verification exceeded ${runTimeoutMs}ms and was stopped.`);
    void cleanup();
  }, runTimeoutMs);

  try {
    browserServer = await chromium.launchServer({
      executablePath: edge,
      headless: true,
      timeout: 20000,
      args: [
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--disable-background-timer-throttling",
        "--disable-background-networking",
        "--disable-extensions",
        "--no-first-run",
      ],
    });
    browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 10000 });

    desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    desktopContext.setDefaultTimeout(15000);
    desktopContext.setDefaultNavigationTimeout(30000);
    const desktop = await inspectPage(await desktopContext.newPage(), "desktop", false);
    await releasePointerLocks(desktopContext);
    await desktopContext.close();
    desktopContext = null;

    mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    mobileContext.setDefaultTimeout(15000);
    mobileContext.setDefaultNavigationTimeout(30000);
    const mobile = await inspectPage(await mobileContext.newPage(), "mobile", true);
    await releasePointerLocks(mobileContext);
    await mobileContext.close();
    mobileContext = null;

    const report = { desktop, mobile };
    fs.writeFileSync(path.join(artifacts, "verification.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));

    const failures = [];
    for (const [name, result] of Object.entries(report)) {
      const check = result.checks;
      if (check.gameReady !== "true") failures.push(`${name}: gameReady`);
      if (check.persistence !== "pass") failures.push(`${name}: persistence`);
      if (check.hotbarSlots !== "9") failures.push(`${name}: hotbar slots`);
      if (check.recipeCount !== "4") failures.push(`${name}: recipes`);
      if (check.textureSource !== expectedTextureSource) failures.push(`${name}: texture source`);
      if (check.verificationMode !== "true") failures.push(`${name}: verification mode`);
      if (check.pointerLockActive) failures.push(`${name}: pointer lock active`);
      if (check.options.optionCount !== "2") failures.push(`${name}: option count`);
      if (check.options.eternalDay !== "true" || check.options.timeLabel !== "12:00") {
        failures.push(`${name}: eternal day`);
      }
      if (check.options.creativeMode !== "true" || check.options.hotbarCount !== "∞") {
        failures.push(`${name}: creative mode`);
      }
      if (!check.options.flightUp || !check.options.flightDown) failures.push(`${name}: creative flight`);
      if (check.options.textureRepeat !== "no-repeat" || check.options.textureSize !== "100% 100%") {
        failures.push(`${name}: repeated texture icon`);
      }
      if (!check.options.descendVisible) failures.push(`${name}: creative descend control`);
      if (check.uniqueColors < 6 || check.litPixels < 35) failures.push(`${name}: blank WebGL canvas`);
      if (check.overflowX || !check.hotbarInside || !check.topInside) failures.push(`${name}: layout overflow`);
      if (!check.mobileControlsVisible) failures.push(`${name}: mobile controls visibility`);
      if (result.consoleErrors.length) failures.push(`${name}: console errors`);
      if (result.pageErrors.length) failures.push(`${name}: page errors`);
    }

    if (failures.length) {
      console.error(`Verification failed: ${failures.join(", ")}`);
      process.exitCode = 1;
    }
  } catch (error) {
    throw timeoutError || error;
  } finally {
    await cleanup();
  }
}

runVerification().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
