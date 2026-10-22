Godot 双维度探索与轻战斗游戏 Demo · 从零开发题包 v1.0
2026-10-17

本包仅含完整测试要求、官方数据库依赖、验收清单和空白评分表。
所有游戏工程、草地 Shader、场景、UI、背包、任务、存档与原创玩法从空白 Godot 工程开始制作。

文件
public/PROMPT.md：完整正式题面，包含双维度通关、游戏系统、UI、数据库与完整草地渲染附录。
public/SQLITE_DEPENDENCY.zip：官方 godot-sqlite v4.6 插件、Windows x86_64 DLL、README 和许可证；每个文件均与固定官方来源逐字节核对。
organizer/ACCEPTANCE_CHECKLIST.txt：19 项游戏/系统验收及 8 组渲染检查。
organizer/SCORECARD_TEMPLATE.json：完整空白评分表，评分、状态和证据均待填写。
organizer/INPUT_LOCK.json：输入版本、哈希和官方依赖文件白名单。
MANIFEST.json：题包文件 SHA-256 和字节数。

使用
1. 准备 Godot 4.5.1 stable（Windows x86_64）。引擎不包含在本包内。
2. 新建独立候选工作目录，仅放入 public 中的 PROMPT.md 和 SQLITE_DEPENDENCY.zip。
3. 通过环境变量 GODOT4_EXE 提供本机引擎可执行文件路径，再按题面从空白工程作答。
4. 在自行创建的工程中解压 SQLite 依赖，使 addons/godot-sqlite 位于工程根目录。
5. organizer 内容供组织者验收使用。题面已包含公开功能要求与评分权重。

要求保持完整：原生2D/3D均可通关并共享状态，真实SQLite存档和背包，完整玩家UI，探索/解谜/轻战斗，自主机制，以及草地交互、像素优化、三风格、云影/风阵/翻滚、水面和调试/取证。
UI具体样式、维度转场、题材与小机制仍由作答者设计。

所有评分初始为空。目录隔离与哈希校验不证明操作系统访问隔离，隔离证据状态保持 unverified。
