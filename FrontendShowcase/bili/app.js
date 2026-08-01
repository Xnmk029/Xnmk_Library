// ============================================
// Bilibili M3 Redesign - Application Logic
// ============================================

// Sample video data
const videoData = [
  {
    id: 1,
    title: '【4K】原神须弥全地图100%探索度完整攻略',
    cover: 'https://picsum.photos/seed/bili1/640/360',
    uploader: '游戏攻略组',
    views: '128.5万',
    danmaku: '3.2万',
    duration: '45:12',
    date: '2天前'
  },
  {
    id: 2,
    title: '用树莓派DIY了一个掌上游戏机，成本只要200块',
    cover: 'https://picsum.photos/seed/bili2/640/360',
    uploader: '科技猎手',
    views: '86.3万',
    danmaku: '1.8万',
    duration: '12:34',
    date: '3天前'
  },
  {
    id: 3,
    title: '【钢琴】超燃！用钢琴演奏《进击的巨人》OP合集',
    cover: 'https://picsum.photos/seed/bili3/640/360',
    uploader: 'Animenz',
    views: '256.7万',
    danmaku: '5.6万',
    duration: '1:23:45',
    date: '1周前'
  },
  {
    id: 4,
    title: '挑战用100元吃遍成都街头美食，结果吃到扶墙',
    cover: 'https://picsum.photos/seed/bili4/640/360',
    uploader: '盗月社食遇记',
    views: '312.1万',
    danmaku: '8.9万',
    duration: '18:22',
    date: '5天前'
  },
  {
    id: 5,
    title: '【科普】为什么中国高铁能跑这么快？硬核解析',
    cover: 'https://picsum.photos/seed/bili5/640/360',
    uploader: '科技猎手',
    views: '198.4万',
    danmaku: '4.2万',
    duration: '22:08',
    date: '1天前'
  },
  {
    id: 6,
    title: '花了3个月自学编程，从零到拿到大厂offer全过程',
    cover: 'https://picsum.photos/seed/bili6/640/360',
    uploader: '技术胖',
    views: '167.8万',
    danmaku: '6.1万',
    duration: '35:16',
    date: '4天前'
  },
  {
    id: 7,
    title: '【4K60帧】赛博朋克2077 超真实画质 夜之城漫步',
    cover: 'https://picsum.photos/seed/bili7/640/360',
    uploader: '游戏视觉师',
    views: '95.2万',
    danmaku: '2.1万',
    duration: '28:53',
    date: '6天前'
  },
  {
    id: 8,
    title: '在日本乡下花1000日元能吃到什么？结果超预期',
    cover: 'https://picsum.photos/seed/bili8/640/360',
    uploader: '山下智博',
    views: '223.6万',
    danmaku: '7.3万',
    duration: '15:41',
    date: '2天前'
  },
  {
    id: 9,
    title: '【原创曲】用中国传统乐器演奏《孤勇者》，太燃了',
    cover: 'https://picsum.photos/seed/bili9/640/360',
    uploader: '柳青瑶本尊',
    views: '445.9万',
    danmaku: '12.8万',
    duration: '4:32',
    date: '3周前'
  },
  {
    id: 10,
    title: '深度解析《三体》动画为什么翻车了？问题出在哪',
    cover: 'https://picsum.photos/seed/bili10/640/360',
    uploader: '马督工',
    views: '567.3万',
    danmaku: '15.2万',
    duration: '16:44',
    date: '1周前'
  },
  {
    id: 11,
    title: '【宅舞】元气满满！跳一支《极乐净土》给打工人',
    cover: 'https://picsum.photos/seed/bili11/640/360',
    uploader: '咬人猫',
    views: '189.7万',
    danmaku: '4.5万',
    duration: '3:58',
    date: '5天前'
  },
  {
    id: 12,
    title: '用废旧显卡炼出了真金？电子垃圾回收的暴利真相',
    cover: 'https://picsum.photos/seed/bili12/640/360',
    uploader: '影视飓风',
    views: '378.2万',
    danmaku: '9.7万',
    duration: '19:27',
    date: '3天前'
  }
];

// DOM Elements
const videoGrid = document.getElementById('videoGrid');
const navDrawer = document.getElementById('navDrawer');
const navScrim = document.getElementById('navScrim');
const fabTop = document.getElementById('fabTop');
const topAppBar = document.querySelector('.m3-top-app-bar');
const menuBtn = document.querySelector('.top-app-bar__leading .m3-icon-button');

// ============================================
// Render Video Cards
// ============================================
function createVideoCard(video, index) {
  const card = document.createElement('article');
  card.className = 'm3-card';
  card.style.animationDelay = `${index * 50}ms`;
  card.innerHTML = `
    <div class="card-media">
      <img src="${video.cover}" alt="${video.title}" loading="lazy">
      <button class="card-menu-btn" aria-label="更多操作">
        <span class="material-symbols-outlined">more_vert</span>
      </button>
      <span class="card-duration">${video.duration}</span>
      <div class="card-media__overlay">
        <span class="stat-item">
          <span class="material-symbols-outlined">play_arrow</span>
          ${video.views}
        </span>
        <span class="stat-item">
          <span class="material-symbols-outlined">chat_bubble</span>
          ${video.danmaku}
        </span>
      </div>
    </div>
    <div class="card-content">
      <div class="card-uploader-avatar">
        <span class="material-symbols-outlined">person</span>
      </div>
      <div class="card-info">
        <h3 class="card-title">${video.title}</h3>
        <p class="card-uploader-name">${video.uploader}</p>
        <p class="card-meta">
          <span>${video.date}</span>
        </p>
      </div>
    </div>
  `;
  return card;
}

function renderVideos(videos) {
  videoGrid.innerHTML = '';
  videos.forEach((video, index) => {
    videoGrid.appendChild(createVideoCard(video, index));
  });
}

// Initial render
renderVideos(videoData);

// ============================================
// Filter Chips Interaction
// ============================================
const chips = document.querySelectorAll('.m3-chip--filter');

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    // Remove selected from all
    chips.forEach(c => c.classList.remove('selected'));
    // Add selected to clicked
    chip.classList.add('selected');

    // Simulate category filtering with animation
    const cards = document.querySelectorAll('.m3-card');
    cards.forEach((card, i) => {
      card.style.animation = 'none';
      card.offsetHeight; // Trigger reflow
      card.style.animation = `card-enter 0.4s cubic-bezier(0.2, 0, 0, 1) ${i * 50}ms both`;
    });
  });
});

// ============================================
// Navigation Drawer
// ============================================
function openNavDrawer() {
  navDrawer.classList.add('open');
  navScrim.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeNavDrawer() {
  navDrawer.classList.remove('open');
  navScrim.classList.remove('visible');
  document.body.style.overflow = '';
}

menuBtn.addEventListener('click', openNavDrawer);
navScrim.addEventListener('click', closeNavDrawer);

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNavDrawer();
});

// ============================================
// Scroll Effects
// ============================================
let lastScrollY = 0;

window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;

  // Top App Bar elevation
  if (currentScrollY > 0) {
    topAppBar.classList.add('scrolled');
  } else {
    topAppBar.classList.remove('scrolled');
  }

  // FAB visibility
  if (currentScrollY > 400) {
    fabTop.classList.add('visible');
  } else {
    fabTop.classList.remove('visible');
  }

  lastScrollY = currentScrollY;
}, { passive: true });

// FAB - Scroll to top
fabTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============================================
// M3 Ripple Effect
// ============================================
function createRipple(event) {
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  element.appendChild(ripple);

  ripple.addEventListener('animationend', () => {
    ripple.remove();
  });
}

// Apply ripple to interactive elements
document.querySelectorAll('.m3-icon-button, .m3-chip, .m3-nav-item, .m3-fab').forEach(el => {
  el.addEventListener('click', createRipple);
});

// ============================================
// Navigation Bar (Mobile) Interaction
// ============================================
const navBarItems = document.querySelectorAll('.m3-nav-bar__item');

navBarItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navBarItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});

// ============================================
// Search Bar Interaction
// ============================================
const searchInput = document.querySelector('.search-input');
const searchBar = document.querySelector('.m3-search-bar');

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchInput.value.trim()) {
    // Simulate search
    const query = searchInput.value.trim();
    console.log(`搜索: ${query}`);
    searchInput.blur();
  }
});

// ============================================
// Intersection Observer for lazy animations
// ============================================
const observerOptions = {
  root: null,
  rootMargin: '0px 0px -50px 0px',
  threshold: 0.1
};

const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe cards after render
function observeCards() {
  document.querySelectorAll('.m3-card').forEach(card => {
    cardObserver.observe(card);
  });
}

observeCards();

// ============================================
// Dark Mode Support (M3 Dynamic Color)
// ============================================
const darkThemeTokens = {
  '--md-sys-color-primary': '#FFB0D0',
  '--md-sys-color-on-primary': '#660043',
  '--md-sys-color-primary-container': '#8F0060',
  '--md-sys-color-on-primary-container': '#FFD8E8',
  '--md-sys-color-secondary': '#E2BFCF',
  '--md-sys-color-on-secondary': '#422937',
  '--md-sys-color-secondary-container': '#5A3F4E',
  '--md-sys-color-on-secondary-container': '#FFD8E8',
  '--md-sys-color-tertiary': '#EFBD94',
  '--md-sys-color-on-tertiary': '#48290C',
  '--md-sys-color-tertiary-container': '#623F20',
  '--md-sys-color-on-tertiary-container': '#FFDCC2',
  '--md-sys-color-error': '#FFB4AB',
  '--md-sys-color-on-error': '#690005',
  '--md-sys-color-error-container': '#93000A',
  '--md-sys-color-on-error-container': '#FFDAD6',
  '--md-sys-color-surface': '#191114',
  '--md-sys-color-on-surface': '#E9DFE1',
  '--md-sys-color-surface-variant': '#504349',
  '--md-sys-color-on-surface-variant': '#D5C2CA',
  '--md-sys-color-surface-container-lowest': '#140C0F',
  '--md-sys-color-surface-container-low': '#22191C',
  '--md-sys-color-surface-container': '#261D20',
  '--md-sys-color-surface-container-high': '#31282B',
  '--md-sys-color-surface-container-highest': '#3C3336',
  '--md-sys-color-outline': '#9D8D94',
  '--md-sys-color-outline-variant': '#504349',
  '--md-sys-color-inverse-surface': '#E9DFE1',
  '--md-sys-color-inverse-on-surface': '#362F31',
  '--md-sys-color-inverse-primary': '#B4267A',
  '--md-sys-color-background': '#191114',
  '--md-sys-color-on-background': '#E9DFE1',
};

function setDarkTheme() {
  const root = document.documentElement;
  Object.entries(darkThemeTokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function setLightTheme() {
  const root = document.documentElement;
  Object.entries(darkThemeTokens).forEach(([key]) => {
    root.style.removeProperty(key);
  });
}

// Respect system preference
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  setDarkTheme();
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (e.matches) {
    setDarkTheme();
  } else {
    setLightTheme();
  }
});
