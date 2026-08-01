// ============================================================================
// simulation.js — 主循环集成：输入 → 手感辅助 → 物理(120Hz) → 音频 → 视觉 → HUD
// 音频 DSP 与车辆动力学均与渲染层解耦（仅通过状态快照交互）
// ============================================================================
import * as THREE from 'three'
import { Vehicle, visualPose, VEHICLE_PARAMS } from '../physics/vehicle.js'
import { SteeringAssist } from '../physics/steering-assist.js'
import { composeInput, SteerSmoother, EdgeTrigger } from '../input/input-state.js'
import { KeyboardInput } from '../input/keyboard.js'
import { GamepadInput } from '../input/gamepad.js'
import { EngineSound } from '../audio/engine-sound.js'
import { createSky } from '../scene/sky.js'
import { buildTrackCurve, buildTrackMesh, buildSurroundings, buildTrees, classifySurface } from '../scene/track.js'
import { loadCarModel } from '../scene/car-model.js'
import { HUD } from '../scene/hud.js'
import { EnhancedChaseCamera } from '../camera/enhanced-chase.js'
import { clamp } from '../audio/engine-math.js'

const PHYS_DT = 1 / 120
const START = { x: -2, z: -6 } // 起点（发车格附近）

export class Simulation {
  /**
   * @param {AudioContext} audioCtx 由用户手势创建
   * @param {{onError?:(msg:string)=>void}} opts
   */
  constructor(audioCtx, opts = {}) {
    this.onError = opts.onError ?? (() => {})
    this.audioCtx = audioCtx

    // ---- 渲染器 ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    document.getElementById('app').appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000)
    this._resize = () => {
      const w = window.innerWidth, h = window.innerHeight
      this.renderer.setSize(w, h)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', this._resize)
    this._resize()

    // ---- 场景 ----
    createSky(this.scene)
    this.trackCurve = buildTrackCurve()
    this.scene.add(buildTrackMesh(this.trackCurve))
    this.scene.add(buildSurroundings())
    this.scene.add(buildTrees(this.trackCurve))

    // ---- 物理 ----
    this.vehicle = new Vehicle()
    this.vehicle.reset(START.x, START.z, 0)
    this.assist = new SteeringAssist()

    // ---- 输入 ----
    this.keyboard = new KeyboardInput()
    this.gamepad = new GamepadInput()
    this.smoother = new SteerSmoother(9)
    this.edges = new EdgeTrigger()

    // ---- 音频 ----
    this.sound = new EngineSound(audioCtx, { reverbMix: 0.32, masterGain: 0.85 })
    this.sound.build()

    // ---- 视觉 ----
    this.hud = new HUD()
    this.cam = new EnhancedChaseCamera(this.camera)

    // ---- 状态 ----
    this.accumulator = 0
    this.lastTime = performance.now()
    this.running = false
    this.wheelAngle = [0, 0, 0, 0]
    this.car = null
    this.carReady = false
    // 自动化验证：?autodrive=1 自动驾驶（冒烟测试用）
    this.autoDrive = new URLSearchParams(location.search).get('autodrive') === '1'
  }

  /** 异步加载车辆模型（失败 → onError） */
  async loadCar() {
    try {
      const car = await loadCarModel()
      this.scene.add(car.root)
      this.car = car
      this.carReady = true
    } catch (e) {
      this.onError(`车辆模型加载失败：${e?.message ?? e}`)
      throw e
    }
  }

  reset() {
    this.vehicle.reset(START.x, START.z, 0)
    if (this.car) this.car.root.position.set(START.x, 0, START.z)
    this.cam.snapTo(this.vehicle.snapshot(), 0)
    this.smoother = new SteerSmoother(9)
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this._loop()
  }

  _loop = () => {
    if (!this.running) return
    requestAnimationFrame(this._loop)
    const now = performance.now()
    let dt = (now - this.lastTime) / 1000
    this.lastTime = now
    dt = Math.min(dt, 0.05) // 防后台标签页大跳变

    // ---- 输入合成 ----
    const kb = this.keyboard.poll()
    const pad = this.gamepad.poll()
    const inp = composeInput(kb, pad, dt, { smoother: this.smoother })
    if (this.autoDrive) {
      // 自动驾驶：恒定油门 + 缓慢正弦转向（跑通全链路）
      inp.throttle = 0.55
      inp.steer = Math.sin(now / 3200) * 0.4
      inp.brake = 0
    }
    if (this.edges.poll('reset', inp.reset)) this.reset()
    if (this.edges.poll('camera', inp.camera)) this.cam.cycle()

    // ---- 固定步长物理 ----
    this.accumulator += dt
    let snap = this.vehicle.snapshot()
    while (this.accumulator >= PHYS_DT) {
      // 路面摩擦（赛道内柏油 μ=1.0，草地 μ=0.55）
      const surface = classifySurface(this.trackCurve, this.vehicle.posX, this.vehicle.posZ)
      // 手感辅助 → 实际转向角
      const assistIn = this.assist.update(inp.steer, {
        vLat: this.vehicle.vLat, vLon: this.vehicle.vLon,
        yawRate: this.vehicle.yawRate, mass: VEHICLE_PARAMS.mass,
        downforce: this.vehicle.fzWheels.reduce((a, b) => a + b, 0),
        mu: surface.mu, wheelbase: VEHICLE_PARAMS.wheelbase,
        steeringLock: VEHICLE_PARAMS.maxSteerLock,
        alphaRear: this.vehicle.slipAngles[2],
        slipRatioFront: Math.abs(this.vehicle.slipAngles[0]),
        grounded: true, dt: PHYS_DT
      })
      snap = this.vehicle.step(PHYS_DT, {
        throttle: inp.throttle,
        brake: inp.brake,
        reverse: inp.reverse ? 1 : 0,
        steerAngle: assistIn * VEHICLE_PARAMS.maxSteerLock,
        mu: surface.mu
      })
      this.accumulator -= PHYS_DT
      this.surface = surface
      this.assistOut = assistIn
    }

    // ---- 音频驱动（来自物理快照） ----
    const fuelCut = snap.throttle < 0.05 && snap.rpm > 6200
    this.sound.update({
      rpm: snap.rpm,
      throttle: snap.throttle,
      load: clamp(0.35 + Math.abs(snap.accelLon) / 9, 0, 1),
      fuelCut
    })

    // ---- 车辆视觉 ----
    if (this.carReady && this.car) {
      const { root, body, wheels } = this.car
      root.position.set(snap.pos.x, 0, snap.pos.z)
      root.rotation.y = snap.yaw
      const pose = visualPose(snap)
      body.rotation.set(pose.rollRight, 0, pose.pitchNoseUp)
      // 车轮：转向（前轴）+ 旋转
      wheels.forEach((w, i) => {
        w.steer.rotation.y = i < 2 ? snap.steerAngle : 0
        const spin = i < 2 ? this.vehicle.wheelSpinFront : this.vehicle.wheelSpinRear
        this.wheelAngle[i] += spin * dt
        w.mesh.rotation.y = this.wheelAngle[i]
      })
    }

    // ---- 相机 + HUD ----
    this.cam.update(snap, dt)
    this.hud.update(snap, {
      mu: this.surface?.mu,
      camera: this.cam.name,
      assist: this.assistOut
    })
    if (this.autoDrive) {
      // TEMP-DEBUG: 自动化验证时写入关键状态供无头浏览器读取
      document.title = `dbg v=${snap.speed.toFixed(2)} vLon=${this.vehicle.vLon.toFixed(2)} acc=${this.accumulator.toFixed(4)} asst=${(this.assistOut ?? 0).toFixed(2)} thr=${inp.throttle}`
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.running = false
    window.removeEventListener('resize', this._resize)
    this.keyboard.dispose()
    this.sound.dispose()
    this.renderer.dispose()
  }
}
