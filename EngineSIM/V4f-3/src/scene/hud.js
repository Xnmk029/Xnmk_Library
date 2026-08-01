// ============================================================================
// hud.js — DOM HUD：转速条 / 车速 / 挡位 / 油门 / 断油提示 / 相机模式
// ============================================================================
export class HUD {
  constructor(container = document.getElementById('hud')) {
    this.el = container
    this.el.innerHTML = `
      <div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;color:#8fa3c0">转速 RPM</div>
          <div id="hud-rpm-bar" style="width:220px;height:10px;background:#222a3a;border:1px solid #3a4a66;border-radius:3px;overflow:hidden">
            <div id="hud-rpm-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#2fbf5f,#ffd23f 70%,#ff5a3c 92%)"></div>
          </div>
          <div id="hud-rpm" style="font-size:13px;color:#cfe0f5">0</div>
        </div>
        <div>
          <div style="font-size:11px;color:#8fa3c0">车速</div>
          <div id="hud-speed" style="font-size:26px;font-weight:700">0</div>
          <div style="font-size:10px;color:#8fa3c0">km/h</div>
        </div>
        <div>
          <div style="font-size:11px;color:#8fa3c0">挡位</div>
          <div id="hud-gear" style="font-size:26px;font-weight:700">N</div>
        </div>
        <div>
          <div style="font-size:11px;color:#8fa3c0">油门</div>
          <div id="hud-thr-bar" style="width:90px;height:8px;background:#222a3a;border:1px solid #3a4a66;border-radius:3px;overflow:hidden">
            <div id="hud-thr-fill" style="height:100%;width:0%;background:#3d8bff"></div>
          </div>
        </div>
        <div id="hud-status" style="font-size:12px;color:#ffd23f;min-width:160px"></div>
      </div>`
    this.rpmFill = this.el.querySelector('#hud-rpm-fill')
    this.rpm = this.el.querySelector('#hud-rpm')
    this.speed = this.el.querySelector('#hud-speed')
    this.gear = this.el.querySelector('#hud-gear')
    this.thrFill = this.el.querySelector('#hud-thr-fill')
    this.status = this.el.querySelector('#hud-status')
  }

  update(snap, extra = {}) {
    const redline = 6400
    const pct = Math.min(1, snap.rpm / redline)
    this.rpmFill.style.width = (pct * 100).toFixed(1) + '%'
    this.rpm.textContent = Math.round(snap.rpm)
    this.speed.textContent = Math.round(Math.abs(snap.speed) * 3.6)
    const gears = 'N123456'
    this.gear.textContent = gears[snap.gear + 1] ?? '-'
    this.thrFill.style.width = (snap.throttle * 100).toFixed(0) + '%'

    const flags = []
    if (snap.fuelCut) flags.push('⛔ 断油')
    if (extra.mu && extra.mu < 0.8) flags.push('🟩 草地')
    if (extra.camera) flags.push(`📷 ${extra.camera}`)
    if (extra.assist && Math.abs(extra.assist) > 0.05) flags.push('🔄 辅助')
    this.status.textContent = flags.join('  ')
  }
}
