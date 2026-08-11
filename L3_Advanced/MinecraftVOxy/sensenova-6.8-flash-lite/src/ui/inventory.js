// VOXY CRAFT — 创造模式物品栏（分类 + 搜索 + 点击取用）
import { ITEMS } from '../data/registry.js';
import { itemIcon } from './icons.js';

const CATS = [['all', '全部'], ['block', '方块'], ['tool', '工具'], ['food', '食物'], ['material', '材料']];

export class Inventory {
  constructor(game) {
    this.game = game;
    this.cat = 'all';
    this.query = '';
    this.el = document.getElementById('inventory');
    this.grid = document.getElementById('inv-grid');
    this.tabs = document.getElementById('inv-tabs');
    this.search = document.getElementById('inv-search');
    this._buildTabs();
    this.search.addEventListener('input', () => { this.query = this.search.value; this.render(); });
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
  }

  _buildTabs() {
    for (const [k, label] of CATS) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.cat = k;
      b.onclick = () => { this.cat = k; this._syncTabs(); this.render(); };
      this.tabs.appendChild(b);
    }
    this._syncTabs();
  }
  _syncTabs() { for (const b of this.tabs.children) b.classList.toggle('on', b.dataset.cat === this.cat); }

  open() { this.el.classList.add('open'); this.render(); }
  close() { this.el.classList.remove('open'); }
  toggle() { this.isOpen ? this.close() : this.open(); }
  get isOpen() { return this.el.classList.contains('open'); }

  render() {
    this.grid.innerHTML = '';
    const q = this.query.trim().toLowerCase();
    const frag = document.createDocumentFragment();
    let n = 0;
    for (const it of ITEMS) {
      if (!it) continue;
      if (this.cat !== 'all' && it.category !== this.cat) continue;
      if (q && !it.name.toLowerCase().includes(q)) continue;
      const cell = document.createElement('div'); cell.className = 'cell';
      const img = document.createElement('img'); img.src = itemIcon(it); img.alt = it.name; img.loading = 'lazy';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.name;
      cell.appendChild(img); cell.appendChild(nm);
      cell.onclick = () => this.game.selectItem(it);
      frag.appendChild(cell);
      n++;
    }
    this.grid.appendChild(frag);
    this.count = n;
  }
}
