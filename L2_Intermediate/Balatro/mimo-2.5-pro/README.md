# Balatro Web - 小丑牌网页版

一个致敬 Balatro 的网页版学习项目，使用纯 HTML/CSS/JS 实现。

## 运行方式

直接在浏览器中打开 `index.html` 文件即可运行。

或者使用本地服务器：

```bash
cd balatro
python3 -m http.server 8080
# 然后打开 http://localhost:8080
```

## 游戏操作

- **鼠标点击** 或 **数字键 1-8**：选择/取消选择手牌
- **Play Hand** 或 **空格/回车**：打出选中的牌
- **Discard** 或 **D键**：弃掉选中的牌
- **Sort** 或 **S键**：排序手牌

## 核心机制

- 🃏 标准 52 张扑克牌
- 🎰 10 种扑克牌型（高牌 → 皇家同花顺）
- 🎪 27 种小丑牌效果
- 💀 10 种 Boss 盲注
- 🛒 回合间商店系统
- ✨ 丰富的动画和粒子特效
- 🔊 Web Audio API 音效

## 8 个 Ante

每个 Ante 包含 3 个盲注（小盲/大盲/Boss盲），全部 8 个 Ante 通关即胜利。
