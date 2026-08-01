/* ==========================================================================
   FPSLab Pro - Crosshair Customization Studio
   ========================================================================== */

const DEFAULT_CROSSHAIR = {
  style: 'cross', // cross, dot, circle, cross_dot, t_shape
  color: '#00f3ff',
  size: 10,
  thickness: 2,
  gap: 4,
  opacity: 1.0,
  outline: true,
  outlineColor: '#000000',
  outlineThickness: 1,
  dotSize: 3,
  centerDot: false
};

class CrosshairBuilder {
  constructor() {
    this.config = { ...DEFAULT_CROSSHAIR };
    this.loadFromStorage();
  }

  loadFromStorage() {
    const saved = localStorage.getItem('fpslab_crosshair_config');
    if (saved) {
      try {
        this.config = { ...DEFAULT_CROSSHAIR, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('Failed to parse saved crosshair settings', e);
      }
    }
  }

  saveToStorage() {
    localStorage.setItem('fpslab_crosshair_config', JSON.stringify(this.config));
  }

  updateConfig(key, value) {
    this.config[key] = value;
    this.saveToStorage();
    this.renderHUD();
  }

  /**
   * Render crosshair onto a 2D canvas context (e.g. for preview box or HUD)
   */
  renderToCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const cfg = this.config;

    ctx.save();
    ctx.globalAlpha = cfg.opacity;

    // Helper function to draw rectangles with optional outline
    const drawRect = (x, y, w, h) => {
      if (cfg.outline) {
        ctx.fillStyle = cfg.outlineColor;
        const ot = cfg.outlineThickness;
        ctx.fillRect(x - ot, y - ot, w + ot * 2, h + ot * 2);
      }
      ctx.fillStyle = cfg.color;
      ctx.fillRect(x, y, w, h);
    };

    const drawCircle = (x, y, radius) => {
      if (cfg.outline) {
        ctx.beginPath();
        ctx.arc(x, y, radius + cfg.outlineThickness, 0, Math.PI * 2);
        ctx.fillStyle = cfg.outlineColor;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color;
      ctx.fill();
    };

    // Center Dot
    if (cfg.centerDot || cfg.style === 'dot' || cfg.style === 'cross_dot') {
      drawCircle(cx, cy, cfg.dotSize / 2);
    }

    if (cfg.style === 'circle') {
      // Circle outline
      if (cfg.outline) {
        ctx.beginPath();
        ctx.arc(cx, cy, cfg.size + cfg.outlineThickness, 0, Math.PI * 2);
        ctx.strokeStyle = cfg.outlineColor;
        ctx.lineWidth = cfg.thickness + cfg.outlineThickness * 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, cfg.size, 0, Math.PI * 2);
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = cfg.thickness;
      ctx.stroke();
    } else if (cfg.style !== 'dot') {
      // Crosshair lines
      const halfThick = cfg.thickness / 2;
      const gap = parseInt(cfg.gap, 10);
      const size = parseInt(cfg.size, 10);

      // Top line
      drawRect(cx - halfThick, cy - gap - size, cfg.thickness, size);
      // Bottom line (Skip if T-shape)
      if (cfg.style !== 't_shape') {
        drawRect(cx - halfThick, cy + gap, cfg.thickness, size);
      }
      // Left line
      drawRect(cx - gap - size, cy - halfThick, size, cfg.thickness);
      // Right line
      drawRect(cx + gap, cy - halfThick, size, cfg.thickness);
    }

    ctx.restore();
  }

  /**
   * Update HTML crosshair overlay element in 3D HUD
   */
  renderHUD() {
    const hudContainer = document.getElementById('crosshair-hud');
    if (!hudContainer) return;

    let canvas = hudContainer.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      hudContainer.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    this.renderToCanvas(ctx, 120, 120);
  }
}

window.CrosshairBuilder = CrosshairBuilder;
