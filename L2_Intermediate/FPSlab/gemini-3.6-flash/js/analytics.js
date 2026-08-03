/* ==========================================================================
   FPSLab Pro - Analytics, Rank Classifier & Leaderboard System
   ========================================================================== */

const RANK_TIERS = [
  { minScore: 135000, name: 'Radiant 耀光', color: '#ff0055', icon: '💎' },
  { minScore: 120000, name: 'Grandmaster 宗师', color: '#ff00ff', icon: '👑' },
  { minScore: 105000, name: 'Master 大师', color: '#9d4edd', icon: '🏆' },
  { minScore: 92000,  name: 'Diamond 钻石', color: '#00f3ff', icon: '🔷' },
  { minScore: 80000,  name: 'Platinum 铂金', color: '#00ff87', icon: '❇️' },
  { minScore: 65000,  name: 'Gold 黄金', color: '#ffb703', icon: '🥇' },
  { minScore: 50000,  name: 'Silver 白银', color: '#cbd5e1', icon: '🥈' },
  { minScore: 30000,  name: 'Bronze 青铜', color: '#b45309', icon: '🥉' },
  { minScore: 0,      name: 'Iron 铁牌', color: '#64748b', icon: '🛡️' }
];

class AnalyticsManager {
  constructor() {
    this.historyKey = 'fpslab_game_history';
    this.chartInstance = null;
  }

  getHistory() {
    const data = localStorage.getItem(this.historyKey);
    return data ? JSON.parse(data) : [];
  }

  saveSession(sessionData) {
    const history = this.getHistory();
    const entry = {
      id: Date.now(),
      timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode: sessionData.mode,
      score: sessionData.score,
      accuracy: sessionData.accuracy,
      shots: sessionData.shots,
      hits: sessionData.hits,
      misses: sessionData.misses,
      kps: sessionData.kps,
      avgTtk: sessionData.avgTtk,
      maxCombo: sessionData.maxCombo,
      gameSens: sessionData.gameSens,
      gameName: sessionData.gameName
    };
    history.unshift(entry);
    // Keep max 50 recent records
    if (history.length > 50) history.pop();
    localStorage.setItem(this.historyKey, JSON.stringify(history));
    return entry;
  }

  clearHistory() {
    localStorage.removeItem(this.historyKey);
  }

  calculateRank(score) {
    for (const tier of RANK_TIERS) {
      if (score >= tier.minScore) {
        return tier;
      }
    }
    return RANK_TIERS[RANK_TIERS.length - 1];
  }

  /**
   * Render Chart.js score history graph into canvas
   */
  renderChart(canvasId, modeFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    let history = this.getHistory();
    if (modeFilter !== 'all') {
      history = history.filter(item => item.mode === modeFilter);
    }
    // Take latest 15 records in chronological order
    const chartData = history.slice(0, 15).reverse();

    const labels = chartData.map((d, i) => `#${i + 1} ${d.mode}`);
    const scores = chartData.map(d => d.score);
    const accuracies = chartData.map(d => d.accuracy);

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Score (得分)',
            data: scores.length > 0 ? scores : [0],
            borderColor: '#00f3ff',
            backgroundColor: 'rgba(0, 243, 255, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Accuracy % (命中率)',
            data: accuracies.length > 0 ? accuracies : [0],
            borderColor: '#ff007f',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8b9bb4', font: { family: 'Rajdhani' } } }
        },
        scales: {
          x: { ticks: { color: '#8b9bb4' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            type: 'linear',
            position: 'left',
            ticks: { color: '#00f3ff' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            ticks: { color: '#ff007f' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  /**
   * Render target hit scatter map on canvas
   */
  renderScatterMap(canvasId, hitPoints = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw target ring background
    const cx = w / 2;
    const cy = h / 2;

    [80, 60, 40, 20].forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 243, 255, ${0.1 + idx * 0.1})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw center crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(cx - 90, cy); ctx.lineTo(cx + 90, cy);
    ctx.moveTo(cx, cy - 90); ctx.lineTo(cx, cy + 90);
    ctx.stroke();

    // Draw hit points
    hitPoints.forEach(pt => {
      // Map normalized [-1, 1] offset to canvas coordinates
      const px = cx + pt.x * 70;
      const py = cy + pt.y * 70;

      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = pt.hit ? '#00f3ff' : '#ff3366';
      ctx.fill();
    });
  }
}

window.AnalyticsManager = AnalyticsManager;
