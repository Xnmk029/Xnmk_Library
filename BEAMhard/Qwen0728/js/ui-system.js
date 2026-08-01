/**
 * FR-Legends Style HUD UI System - Phase 4 Task 4.2
 * Dynamic RPM tachometer, angled speedometer, pedal indicators, minimap
 */
export class UISystem {
    constructor() {
        this.elements = {};
        this.rpmCanvas = null;
        this.rpmCtx = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.diagLog = null;
        this.diagEntries = [];
        this.visible = false;
    }

    init() {
        this.elements = {
            speed: document.getElementById('speed-value'),
            gear: document.getElementById('gear-value'),
            throttle: document.getElementById('throttle-bar'),
            brake: document.getElementById('brake-bar'),
            handbrake: document.getElementById('handbrake-bar'),
            susFL: document.getElementById('sus-fl'),
            susFR: document.getElementById('sus-fr'),
            susRL: document.getElementById('sus-rl'),
            susRR: document.getElementById('sus-rr'),
            modeLabel: document.getElementById('mode-label'),
            hud: document.getElementById('hud'),
            loading: document.getElementById('loading-screen'),
            loadingFill: document.getElementById('loading-fill'),
            loadingStatus: document.getElementById('loading-status')
        };

        this.rpmCanvas = document.getElementById('rpm-canvas');
        this.rpmCtx = this.rpmCanvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.diagLog = document.getElementById('diag-log');

        // Diagnostic console toggle
        document.getElementById('diag-close').addEventListener('click', () => {
            document.getElementById('diag-console').classList.add('hidden');
        });
        window.addEventListener('keydown', (e) => {
            if (e.code === 'F3') {
                e.preventDefault();
                document.getElementById('diag-console').classList.toggle('hidden');
            }
        });
    }

    setLoadingProgress(percent, status) {
        if (this.elements.loadingFill) this.elements.loadingFill.style.width = percent + '%';
        if (this.elements.loadingStatus) this.elements.loadingStatus.textContent = status;
    }

    hideLoading() {
        if (this.elements.loading) this.elements.loading.classList.add('hidden');
    }

    showHUD() {
        if (this.elements.hud) this.elements.hud.classList.remove('hidden');
        this.visible = true;
    }

    /**
     * Update all HUD elements each frame
     */
    update(vehicle, controls) {
        if (!this.visible) return;

        // Speed
        if (this.elements.speed) {
            this.elements.speed.textContent = Math.round(vehicle.speed);
        }

        // Gear
        if (this.elements.gear) {
            const g = vehicle.gear;
            this.elements.gear.textContent = g === 0 ? 'N' : g === -1 ? 'R' : String(g);
        }

        // Pedals
        if (this.elements.throttle) this.elements.throttle.style.width = (controls.input.throttle * 100) + '%';
        if (this.elements.brake) this.elements.brake.style.width = (controls.input.brake * 100) + '%';
        if (this.elements.handbrake) this.elements.handbrake.style.width = (controls.input.handbrake * 100) + '%';

        // Suspension telemetry
        const sus = vehicle.suspensionTravel;
        if (this.elements.susFL) this.elements.susFL.textContent = sus.FL.toFixed(1);
        if (this.elements.susFR) this.elements.susFR.textContent = sus.FR.toFixed(1);
        if (this.elements.susRL) this.elements.susRL.textContent = sus.RL.toFixed(1);
        if (this.elements.susRR) this.elements.susRR.textContent = sus.RR.toFixed(1);

        // RPM Tachometer
        this._drawRPMGauge(vehicle.rpm, vehicle.maxRPM);

        // Minimap
        this._drawMinimap(vehicle.getPosition(), vehicle.getHeading());
    }

    /**
     * Draw anime-style RPM tachometer on canvas
     */
    _drawRPMGauge(rpm, maxRPM) {
        const ctx = this.rpmCtx;
        const w = this.rpmCanvas.width;
        const h = this.rpmCanvas.height;
        const cx = w / 2, cy = h / 2;
        const radius = Math.min(w, h) / 2 - 15;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // RPM arc (270 degrees sweep)
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        const sweepAngle = endAngle - startAngle;

        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(60, 60, 80, 0.8)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Redline zone
        const redlineStart = startAngle + sweepAngle * (6500 / maxRPM);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, redlineStart, endAngle);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 8;
        ctx.stroke();

        // Active RPM arc
        const rpmFraction = Math.min(rpm / maxRPM, 1);
        const rpmAngle = startAngle + sweepAngle * rpmFraction;
        const gradient = ctx.createLinearGradient(0, h, w, 0);
        gradient.addColorStop(0, '#00cc44');
        gradient.addColorStop(0.6, '#ffcc00');
        gradient.addColorStop(1, '#ff2200');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, rpmAngle);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 8;
        ctx.stroke();

        // Tick marks
        for (let i = 0; i <= 8; i++) {
            const tickAngle = startAngle + sweepAngle * (i / 8);
            const innerR = radius - 15;
            const outerR = radius - 5;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(tickAngle) * innerR, cy + Math.sin(tickAngle) * innerR);
            ctx.lineTo(cx + Math.cos(tickAngle) * outerR, cy + Math.sin(tickAngle) * outerR);
            ctx.strokeStyle = i >= 7 ? '#ff4444' : '#888';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Numbers
            ctx.fillStyle = i >= 7 ? '#ff4444' : '#aaa';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(String(i), cx + Math.cos(tickAngle) * (innerR - 12), cy + Math.sin(tickAngle) * (innerR - 12) + 4);
        }

        // Needle
        const needleAngle = startAngle + sweepAngle * rpmFraction;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(needleAngle) * (radius - 20), cy + Math.sin(needleAngle) * (radius - 20));
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Center cap
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444';
        ctx.fill();

        // Digital RPM text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(rpm), cx, cy + 35);
        ctx.fillStyle = '#888';
        ctx.font = '9px Arial';
        ctx.fillText('RPM x1000', cx, cy + 48);
    }

    /**
     * Draw minimap with vehicle position and track outline
     */
    _drawMinimap(pos, heading) {
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;
        const scale = 1.2;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(50, 60, 80, 0.4)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 20) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
        }

        // Track outline (simplified)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.15, h * 0.15, w * 0.7, h * 0.7);

        // Zone markers
        ctx.fillStyle = 'rgba(255, 200, 0, 0.5)';
        ctx.fillRect(w * 0.2, h * 0.2, 15, 15);
        ctx.fillStyle = 'rgba(0, 200, 100, 0.5)';
        ctx.fillRect(w * 0.5, h * 0.6, 15, 15);
        ctx.fillStyle = 'rgba(0, 100, 255, 0.5)';
        ctx.fillRect(w * 0.7, h * 0.2, 15, 15);

        // Vehicle dot
        const vx = w / 2 + pos.x * scale;
        const vy = h / 2 + pos.z * scale;
        ctx.save();
        ctx.translate(vx, vy);
        ctx.rotate(-heading);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fillStyle = '#ff4444';
        ctx.fill();
        ctx.restore();

        // Border
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, h);
    }

    setMode(mode) {
        if (this.elements.modeLabel) this.elements.modeLabel.textContent = mode;
    }

    /**
     * Diagnostic logging
     */
    log(message, level = 'info') {
        const time = new Date().toLocaleTimeString();
        const entry = `[${time}] [${level.toUpperCase()}] ${message}`;
        this.diagEntries.push(entry);
        if (this.diagEntries.length > 200) this.diagEntries.shift();

        if (this.diagLog) {
            const div = document.createElement('div');
            div.className = `log-${level}`;
            div.textContent = entry;
            this.diagLog.appendChild(div);
            this.diagLog.parentElement.scrollTop = this.diagLog.parentElement.scrollHeight;
        }
        console.log(`[${level}] ${message}`);
    }
}
