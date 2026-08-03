/* ==========================================================================
   FPSLab Pro - Three.js 3D Aim Training Engine & Pointer Lock Controls
   ========================================================================== */

class AimEngine {
  constructor(containerId, audioSynth, sensConverter) {
    this.container = document.getElementById(containerId);
    this.audio = audioSynth;
    this.sensConverter = sensConverter;

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouseVec = new THREE.Vector2(0, 0); // Center of screen for FPS raycast

    // Game Objects & Arrays
    this.targets = [];
    this.particles = [];
    this.gunMesh = null;
    this.muzzleFlash = null;

    // Game States
    this.isLocked = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.mode = 'gridshot';
    this.timer = 60;
    this.maxTimer = 60;
    this.timerInterval = null;

    // Camera Rotation Angles
    this.pitch = 0;
    this.yaw = 0;

    // Session Statistics
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastShotTime = 0;
    this.targetSpawnTimes = new Map();
    this.ttkList = [];
    this.hitScatterPoints = [];
    this.trackingTimeOnTarget = 0;
    this.totalTrackingTime = 0;

    // Mode Specific Settings
    this.targetSize = 1.0;
    this.targetColor = 0x00f3ff;

    this.initThree();
    this.initControls();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090e);
    this.scene.fog = new THREE.FogExp2(0x07090e, 0.015);

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(103, aspect, 0.1, 1000);
    this.camera.position.set(0, 1.6, 0); // Eye height

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // Cyber Neon Accent Lights
    const cyanLight = new THREE.PointLight(0x00f3ff, 2, 40);
    cyanLight.position.set(-10, 5, -15);
    this.scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0x9d4edd, 2, 40);
    purpleLight.position.set(10, 5, -15);
    this.scene.add(purpleLight);

    // 5. Environment (Futuristic Cyber Arena)
    this.buildArena();

    // 6. Gun Model
    this.buildGun();

    // 7. Window Resize Event
    window.addEventListener('resize', () => this.onWindowResize());
  }

  buildArena() {
    // Floor Grid
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0d111a,
      roughness: 0.2,
      metalness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid Lines on Floor
    const gridHelper = new THREE.GridHelper(80, 40, 0x00f3ff, 0x1e293b);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // Back Target Wall
    const wallGeo = new THREE.PlaneGeometry(60, 30);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x121826,
      roughness: 0.5,
      metalness: 0.5
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 15, -25);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Neon Frame around Back Wall
    const frameGeo = new THREE.BoxGeometry(60.5, 0.4, 0.4);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });

    const topFrame = new THREE.Mesh(frameGeo, frameMat);
    topFrame.position.set(0, 30, -24.9);
    this.scene.add(topFrame);

    const botFrame = new THREE.Mesh(frameGeo, frameMat);
    botFrame.position.set(0, 0.2, -24.9);
    this.scene.add(botFrame);
  }

  buildGun() {
    const gunGroup = new THREE.Group();

    // Main Gun Body
    const bodyGeo = new THREE.BoxGeometry(0.12, 0.15, 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    gunGroup.add(body);

    // Energy Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.3);
    gunGroup.add(barrel);

    // Cyan Glowing Core Strip
    const coreGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.06, -0.05);
    gunGroup.add(core);

    // Muzzle Flash Effect Mesh
    const flashGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0 });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.position.set(0, 0.03, -0.55);
    gunGroup.add(this.muzzleFlash);

    gunGroup.position.set(0.3, -0.25, -0.6);
    this.camera.add(gunGroup);
    this.scene.add(this.camera);
    this.gunMesh = gunGroup;
  }

  initControls() {
    const dom = this.renderer.domElement;

    dom.addEventListener('click', () => {
      if (this.isPlaying && !this.isLocked && !this.isPaused) {
        dom.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = (document.pointerLockElement === dom);
      if (!this.isLocked && this.isPlaying && !this.isPaused) {
        this.pauseGame();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked || !this.isPlaying || this.isPaused) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      // Calculate radians per pixel from current sens settings
      const gameKey = window.sensConverterInstance ? window.sensConverterInstance.sourceGame : 'valorant';
      const sens = window.sensConverterInstance ? window.sensConverterInstance.sens : 0.4;
      const radPerPixel = this.sensConverter.getRadiansPerPixel(gameKey, sens);

      this.yaw -= movementX * radPerPixel;
      this.pitch -= movementY * radPerPixel;

      // Clamp pitch to prevent camera flips
      const maxPitch = (89 * Math.PI) / 180;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

      this.camera.rotation.set(0, 0, 0);
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.order = 'YXZ';
    });

    // Weapon Trigger Click Event
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.isLocked && this.isPlaying && !this.isPaused) {
        this.shoot();
      }
    });
  }

  updateCameraFOV(fov) {
    if (this.camera) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  onWindowResize() {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ==========================================================================
     Game Setup & Modes Logic
     ========================================================================== */

  startGame(mode = 'gridshot', duration = 60) {
    this.mode = mode;
    this.maxTimer = duration;
    this.timer = duration;
    this.isPlaying = true;
    this.isPaused = false;
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.ttkList = [];
    this.hitScatterPoints = [];
    this.trackingTimeOnTarget = 0;
    this.totalTrackingTime = 0;

    // Reset camera angles
    this.pitch = 0;
    this.yaw = 0;
    this.camera.rotation.set(0, 0, 0);

    // Clear existing targets & particles
    this.clearTargets();

    // Lock Pointer
    this.renderer.domElement.requestPointerLock();

    // Spawn Initial Targets according to mode
    this.spawnInitialTargets();

    // Start Timer
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isPlaying && !this.isPaused) {
        this.timer--;
        this.updateHUD();
        if (this.timer <= 0) {
          this.endGame();
        }
      }
    }, 1000);

    this.updateHUD();
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('pause-overlay').style.display = 'none';
  }

  pauseGame() {
    this.isPaused = true;
    document.getElementById('pause-overlay').style.display = 'flex';
  }

  resumeGame() {
    this.isPaused = false;
    document.getElementById('pause-overlay').style.display = 'none';
    this.renderer.domElement.requestPointerLock();
  }

  endGame() {
    this.isPlaying = false;
    this.isPaused = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    document.exitPointerLock();

    this.audio.playFinishFanfare();

    // Calculate final metrics
    const acc = this.shots > 0 ? parseFloat(((this.hits / this.shots) * 100).toFixed(1)) : 0;
    const avgTtk = this.ttkList.length > 0
      ? Math.round(this.ttkList.reduce((a, b) => a + b, 0) / this.ttkList.length)
      : 0;
    const kps = parseFloat((this.hits / (this.maxTimer - this.timer || 1)).toFixed(2));

    const gameKey = window.sensConverterInstance ? window.sensConverterInstance.sourceGame : 'valorant';
    const sens = window.sensConverterInstance ? window.sensConverterInstance.sens : 0.4;
    const gameName = GAME_PRESETS[gameKey] ? GAME_PRESETS[gameKey].name : 'Valorant';

    const sessionResult = {
      mode: this.mode.toUpperCase(),
      score: this.score,
      accuracy: acc,
      shots: this.shots,
      hits: this.hits,
      misses: this.misses,
      kps: kps,
      avgTtk: avgTtk,
      maxCombo: this.maxCombo,
      gameSens: sens,
      gameName: gameName,
      hitScatter: this.hitScatterPoints
    };

    // Callback to App for summary modal
    if (window.onGameEndCallback) {
      window.onGameEndCallback(sessionResult);
    }
  }

  clearTargets() {
    this.targets.forEach(t => this.scene.remove(t.mesh));
    this.targets = [];
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles = [];
  }

  spawnInitialTargets() {
    if (this.mode === 'gridshot') {
      // 3 targets active in grid region
      for (let i = 0; i < 3; i++) {
        this.spawnTargetSphere();
      }
    } else if (this.mode === 'tracking') {
      // 1 moving target
      this.spawnTargetSphere(0, 1.6, -15, 1.2, true);
    } else if (this.mode === 'reflex') {
      // 1 timed target
      this.spawnTargetSphere();
    } else if (this.mode === 'spidershot') {
      // Center target
      this.spawnTargetSphere(0, 1.6, -15, 1.0);
    } else if (this.mode === 'bounce') {
      // 4 bouncing targets
      for (let i = 0; i < 4; i++) {
        const t = this.spawnTargetSphere();
        t.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.05
        );
      }
    } else {
      // Custom Sandbox
      for (let i = 0; i < 4; i++) {
        this.spawnTargetSphere();
      }
    }
  }

  spawnTargetSphere(overrideX, overrideY, overrideZ, radius = 0.8, isTracking = false) {
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.7
    });

    const mesh = new THREE.Mesh(geo, mat);

    // Calculate Spawn Location
    const x = overrideX !== undefined ? overrideX : (Math.random() - 0.5) * 16;
    const y = overrideY !== undefined ? overrideY : 1.6 + (Math.random() - 0.5) * 8;
    const z = overrideZ !== undefined ? overrideZ : -15 + (Math.random() - 0.5) * 4;

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const targetObj = {
      id: Math.random().toString(36).substring(7),
      mesh: mesh,
      radius: radius,
      spawnTime: performance.now(),
      isTracking: isTracking,
      hp: 100,
      velocity: new THREE.Vector3(0, 0, 0),
      seed: Math.random() * 100
    };

    this.targets.push(targetObj);
    this.targetSpawnTimes.set(targetObj.id, performance.now());
    return targetObj;
  }

  /* ==========================================================================
     Shooting & Raycast Mechanics
     ========================================================================== */

  shoot() {
    this.shots++;
    this.audio.playGunshot();

    // Trigger Gun Recoil & Muzzle Flash
    this.animateGunRecoil();

    // Perform Raycast from Center of Screen (0, 0)
    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const targetMeshes = this.targets.map(t => t.mesh);
    const intersects = this.raycaster.intersectObjects(targetMeshes);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hitTarget = this.targets.find(t => t.mesh === hitMesh);

      if (hitTarget) {
        this.onHitTarget(hitTarget, intersects[0].point);
      }
    } else {
      this.onMissShot();
    }

    this.updateHUD();
  }

  onHitTarget(target, hitPoint) {
    this.hits++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // TTK Calculation
    const spawnT = this.targetSpawnTimes.get(target.id);
    if (spawnT) {
      const ttk = performance.now() - spawnT;
      this.ttkList.push(ttk);
    }

    // Hit Scatter point normalization [-1, 1] relative to sphere center
    const localHit = hitPoint.clone().sub(target.mesh.position);
    this.hitScatterPoints.push({
      x: localHit.x / target.radius,
      y: localHit.y / target.radius,
      hit: true
    });

    // Score calculation
    const basePts = 1000;
    const comboBonus = Math.min(this.combo * 50, 500);
    this.score += basePts + comboBonus;

    // Sound
    this.audio.playHitSound(this.combo);

    // Combo Visual Popup
    if (this.combo >= 3) {
      this.showComboPopup(`${this.combo}x COMBO!`);
    }

    // Shatter Particle Effect
    this.createShatterParticles(target.mesh.position, target.radius);

    // Remove Hit Target from Scene
    this.scene.remove(target.mesh);
    this.targets = this.targets.filter(t => t !== target);

    // Respawn based on mode
    if (this.mode === 'gridshot') {
      this.spawnTargetSphere();
    } else if (this.mode === 'spidershot') {
      if (Math.abs(target.mesh.position.x) < 0.1) {
        // Was at center, spawn outer
        this.spawnTargetSphere((Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 5), 1.6 + (Math.random() - 0.5) * 4, -15);
      } else {
        // Was outer, spawn center
        this.spawnTargetSphere(0, 1.6, -15);
      }
    } else if (this.mode === 'reflex' || this.mode === 'bounce') {
      this.spawnTargetSphere();
    }
  }

  onMissShot() {
    this.misses++;
    this.combo = 0;
    this.audio.playMissSound();
    this.hitScatterPoints.push({ x: (Math.random() - 0.5) * 1.5, y: (Math.random() - 0.5) * 1.5, hit: false });
  }

  createShatterParticles(position, radius) {
    const pGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });

    for (let i = 0; i < 14; i++) {
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      );

      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        velocity: vel,
        life: 1.0 // Fade out over time
      });
    }
  }

  animateGunRecoil() {
    if (!this.gunMesh) return;
    this.gunMesh.position.z = -0.5; // Kick back
    this.gunMesh.rotation.x = 0.1;
    if (this.muzzleFlash) this.muzzleFlash.material.opacity = 1;

    setTimeout(() => {
      if (this.gunMesh) {
        this.gunMesh.position.z = -0.6;
        this.gunMesh.rotation.x = 0;
      }
      if (this.muzzleFlash) this.muzzleFlash.material.opacity = 0;
    }, 50);
  }

  showComboPopup(text) {
    const el = document.getElementById('combo-popup');
    if (el) {
      el.textContent = text;
      el.classList.add('pop');
      clearTimeout(this.comboTimeout);
      this.comboTimeout = setTimeout(() => el.classList.remove('pop'), 400);
    }
  }

  updateHUD() {
    const scoreEl = document.getElementById('hud-score');
    const accEl = document.getElementById('hud-acc');
    const timerEl = document.getElementById('hud-timer');
    const kpsEl = document.getElementById('hud-kps');

    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
    if (accEl) {
      const acc = this.shots > 0 ? ((this.hits / this.shots) * 100).toFixed(1) : '100.0';
      accEl.textContent = `${acc}%`;
    }
    if (timerEl) timerEl.textContent = `${this.timer}s`;
    if (kpsEl) {
      const elapsed = this.maxTimer - this.timer || 1;
      kpsEl.textContent = (this.hits / elapsed).toFixed(1);
    }
  }

  /* ==========================================================================
     Animation Loop & Physics Updating
     ========================================================================== */

  animate() {
    requestAnimationFrame(this.animate);

    const delta = 0.016; // ~60 FPS step

    if (this.isPlaying && !this.isPaused) {
      // 1. Update Target Movement by Mode
      this.targets.forEach(t => {
        if (this.mode === 'tracking') {
          // Lissajous curve 3D motion
          const time = performance.now() * 0.0015 + t.seed;
          t.mesh.position.x = Math.sin(time * 1.2) * 8;
          t.mesh.position.y = 1.6 + Math.cos(time * 0.8) * 3;
          t.mesh.position.z = -15 + Math.sin(time * 0.5) * 3;

          // Continuous Raycast tracking for damage
          this.raycaster.setFromCamera(this.mouseVec, this.camera);
          const intersects = this.raycaster.intersectObject(t.mesh);
          this.totalTrackingTime += delta;
          if (intersects.length > 0) {
            this.trackingTimeOnTarget += delta;
            this.score += Math.round(delta * 2000);
            t.mesh.material.emissive.setHex(0x00ff87); // Turn green when tracking hit
          } else {
            t.mesh.material.emissive.setHex(0x00f3ff);
          }
        } else if (this.mode === 'bounce') {
          // Gravity and Wall Bouncing
          t.mesh.position.add(t.velocity);
          t.velocity.y -= 0.003; // Gravity

          // Floor bounce
          if (t.mesh.position.y <= 0.8) {
            t.mesh.position.y = 0.8;
            t.velocity.y = Math.abs(t.velocity.y) * 0.95;
          }
          // Wall bounce
          if (Math.abs(t.mesh.position.x) >= 12) {
            t.velocity.x *= -1;
          }
        }
      });

      // 2. Update Shatter Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.mesh.position.add(p.velocity);
        p.life -= 0.04;
        p.mesh.scale.multiplyScalar(0.92);

        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
        }
      }
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

window.AimEngine = AimEngine;
