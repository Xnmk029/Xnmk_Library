'use strict';

// 极简测试框架（零依赖）：test(name, fn)，支持 async fn。
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  let passed = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
    } catch (err) {
      failures.push({ name: t.name, err });
    }
  }
  return { total: tests.length, passed, failures };
}

function approx(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg || 'approx'}: expected ${expected} ±${tol}, got ${actual}`);
  }
}

module.exports = { test, run, tests, approx };
