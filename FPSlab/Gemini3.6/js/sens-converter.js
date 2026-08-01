/* ==========================================================================
   FPSLab Pro - Multi-Game Sensitivity & FOV Converter Engine
   ========================================================================== */

const GAME_PRESETS = {
  valorant: {
    name: 'Valorant (无畏契约)',
    yaw: 0.07,
    defaultFov: 103,
    fovType: 'HFOV_16_9',
    defaultSens: 0.4
  },
  cs2: {
    name: 'CS2 / CS:GO (反恐精英2)',
    yaw: 0.022,
    defaultFov: 106.26, // 90 in 4:3 is ~106.26 in 16:9
    fovType: 'HFOV_4_3',
    defaultSens: 1.27
  },
  overwatch: {
    name: 'Overwatch 2 (守望先锋2)',
    yaw: 0.0066,
    defaultFov: 103,
    fovType: 'HFOV_16_9',
    defaultSens: 4.25
  },
  apex: {
    name: 'Apex Legends (Apex 英雄)',
    yaw: 0.022,
    defaultFov: 110,
    fovType: 'HFOV_4_3',
    defaultSens: 1.27
  },
  r6: {
    name: 'Rainbow Six Siege (彩虹六号)',
    yaw: 0.00573,
    defaultFov: 84,
    fovType: 'VFOV',
    defaultSens: 8.0
  },
  cod: {
    name: 'Call of Duty / Warzone (使命召唤)',
    yaw: 0.0066,
    defaultFov: 105,
    fovType: 'HFOV_16_9',
    defaultSens: 4.25
  },
  pubg: {
    name: 'PUBG (绝地求生)',
    yaw: 0.00222,
    defaultFov: 90,
    fovType: 'HFOV_16_9',
    defaultSens: 45
  },
  fortnite: {
    name: 'Fortnite (堡垒之夜)',
    yaw: 0.0055,
    defaultFov: 80,
    fovType: 'HFOV_16_9',
    defaultSens: 8.0
  }
};

class SensConverter {
  constructor() {
    this.sourceGame = 'valorant';
    this.targetGame = 'cs2';
    this.dpi = 800;
    this.sens = 0.4;
  }

  /**
   * Calculate cm per 360 degree turn
   * Formula: (360 / (DPI * Sens * Yaw)) * 2.54
   */
  calculateCm360(gameKey, sens, dpi) {
    const game = GAME_PRESETS[gameKey] || GAME_PRESETS.valorant;
    if (!dpi || !sens || dpi <= 0 || sens <= 0) return 0;
    const degPerCount = sens * game.yaw;
    const countsPer360 = 360 / degPerCount;
    const inches360 = countsPer360 / dpi;
    const cm360 = inches360 * 2.54;
    return parseFloat(cm360.toFixed(2));
  }

  /**
   * Convert sensitivity from source game to target game
   */
  convertSens(srcGameKey, tgtGameKey, srcSens) {
    const srcGame = GAME_PRESETS[srcGameKey] || GAME_PRESETS.valorant;
    const tgtGame = GAME_PRESETS[tgtGameKey] || GAME_PRESETS.cs2;
    if (!srcSens || srcSens <= 0) return 0;

    // Angle moved per mouse count in degrees = srcSens * srcYaw
    const anglePerCount = srcSens * srcGame.yaw;
    // Equivalent target sens = anglePerCount / tgtYaw
    const tgtSens = anglePerCount / tgtGame.yaw;
    return parseFloat(tgtSens.toFixed(4));
  }

  /**
   * Calculate 3D Camera Rotation Radians per pixel mouse movement for Three.js
   * Three.js uses radians. 1 degree = Math.PI / 180 radians.
   */
  getRadiansPerPixel(srcGameKey, srcSens) {
    const srcGame = GAME_PRESETS[srcGameKey] || GAME_PRESETS.valorant;
    const degreesPerPixel = srcSens * srcGame.yaw;
    return (degreesPerPixel * Math.PI) / 180;
  }

  /**
   * Calculate Horizontal FOV for 16:9 canvas from game FOV settings
   */
  calculateHorizontalFov(gameKey, inputFov) {
    const game = GAME_PRESETS[gameKey] || GAME_PRESETS.valorant;
    const fov = inputFov || game.defaultFov;
    
    if (game.fovType === 'HFOV_16_9') {
      return fov;
    } else if (game.fovType === 'HFOV_4_3') {
      // Convert 4:3 Horizontal FOV to 16:9 Horizontal FOV
      const rad43 = (fov * Math.PI) / 180;
      const vFovRad = 2 * Math.atan(Math.tan(rad43 / 2) * (3 / 4));
      const hFov169Rad = 2 * Math.atan(Math.tan(vFovRad / 2) * (16 / 9));
      return parseFloat(((hFov169Rad * 180) / Math.PI).toFixed(1));
    } else if (game.fovType === 'VFOV') {
      // Convert Vertical FOV to 16:9 Horizontal FOV
      const vRad = (fov * Math.PI) / 180;
      const hRad = 2 * Math.atan(Math.tan(vRad / 2) * (16 / 9));
      return parseFloat(((hRad * 180) / Math.PI).toFixed(1));
    }
    return fov;
  }
}

window.SensConverter = SensConverter;
window.GAME_PRESETS = GAME_PRESETS;
