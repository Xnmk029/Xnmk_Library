// ============ AIM FORGE 配置  ============
// 各游戏的手感基准配置（FOV 与灵敏度换算基准）
// cs 采用 CS:GO/CS2 垂直灵敏度基准；val 采用 Valorant 基准（更低灵敏度）等。
window.AF_CONFIG = {
    games: {
        cs:     { name: 'CS2',              fov: 103, inSens: 1.0, base: 0.90, color: '#e8a33d' },
        val:    { name: 'Valorant',         fov: 103, inSens: 0.4, base: 0.70, color: '#ff4655' },
        ow:     { name: 'Overwatch',        fov: 103, inSens: 5.0, base: 1.05, color: '#f99e1a' },
        apex:   { name: 'Apex Legends',     fov: 103, inSens: 1.4, base: 1.00, color: '#cd4242' },
        fort:   { name: 'Fortnite',         fov: 80,  inSens: 0.1, base: 1.10, color: '#8b6cdf' },
        custom: { name: 'Custom',           fov: 103, inSens: 1.0, base: 1.00, color: '#7aa2f7' },
    },

    // 五种训练模式的默认参数
    modes: {
        grid:   { label: '网格',   targetSize: 48, ttk: 1500, maxKills: 80, spawnType: 'grid'   },
        flick:  { label: '急停',   targetSize: 44, ttk: 1000, maxKills: 80, spawnType: 'flick'  },
        track:  { label: '追踪',   targetSize: 56, ttk: 6000, maxKills: 60, spawnType: 'track'  },
        sw:     { label: '小微动', targetSize: 22, ttk: 2000, maxKills: 50, spawnType: 'sw'     },
        zen:    { label: '静观',   targetSize: 52, ttk: 2000, maxKills: 60, spawnType: 'zen'    },
    },

    defaults: {
        // 鼠标基准灵敏度（虚拟，介于 ~每像素旋转角）
        sens: 1.0,
        // 视觉反馈
        hitFx: true,
        dynamicCrosshair: true,
        // 小球带物理碰撞模型（命中后小球产生微小反弹，模拟真实命中）
        ballModel: true,
        colorTargets: false,
    },

    // 面板元素默认值（DOM 初始化时会读取）
    ranges: {
        sens:        { min: 0.05, max: 5,   step: 0.01, value: 1.0 },
        inSens:      { min: 0.05, max: 10,  step: 0.01, value: 1.0 },
        fov:         { min: 70,   max: 140, step: 1,    value: 103 },
        targetSize:  { min: 15,   max: 120, step: 1,    value: 48 },
        ttk:         { min: 100,  max: 5000,step: 50,   value: 1200 },
        maxKills:    { min: 10,   max: 200, step: 10,   value: 80 },
    },
};

// 生成范围元素的基础信息，供 app.js 读取
window.AF_RANGE = {};
function __buildRanges() {
    const R = window.AF_CONFIG.ranges;
    for (const k in R) {
        window.AF_RANGE[k] = { ...R[k] };
    }
}
__buildRanges();