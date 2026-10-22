# 资料来源与置信边界

本文件记录建模时使用的公开资料类型和“哪些内容没有被当作确定事实”。应用不包含或重新分发下列网页中的图片。

## A. 车型与基础结构

1. **U.S. Army ODIN — VT4 (MBT-3000) Chinese Main Battle Tank**  
   https://odin.t2com.army.mil/WEG/Asset/54ecb36b485994e33784d87bd153415b  
   用途：三人制、驾驶员前置、总体构型和出口型基础信息交叉核对。

2. **GlobalSecurity — VT-4 Main Battle Tank**  
   https://www.globalsecurity.org/military/world/china/vt-4.htm  
   用途：125 mm 级主炮、约 52 t、六对大直径负重轮及 1300 hp 版本表述的交叉核对。

3. **Army Technology — VT4 / MBT-3000 Main Battle Tank**  
   https://www.army-technology.com/projects/vt4-mbt-3000-main-battle-tank/  
   用途：出口定位、总体系统组成和公开规格交叉核对。

> 注意：不同公开来源对发动机额定功率给出 1200 hp 或 1300 hp。程序化动力包仅表达“水冷、涡轮增压、V 型柴油机与综合传动”的功能关系，不复刻未公开的生产图纸。

## B. VT-4A1

4. **Global Times — China unveils upgraded VT4A1 with active defense system and drone interoperability at Airshow China 2022**  
   https://www.globaltimes.cn/page/202211/1278826.shtml  
   用途：确认公开报道中的主动防护升级和无人机协同方向。

5. **Army Recognition — Airshow China 2022 VT4A1**  
   https://www.armyrecognition.com/archives/archives-land-defense/land-defense-2022/at-airshow-china-2022-unveiling-of-new-vt4a1-main-battle-tank-with-more-protection-and-firepower  
   用途：展会照片中的顶部组件、雷达面板、发射组件和无人机筒外观参考。

6. **Army Recognition — VT4A1 aerial-drone reconnaissance article**  
   https://www.armyrecognition.com/archives/archives-land-defense/land-defense-2024/chinas-new-vt4a1-main-battle-tank-strengthens-reconnaissance-capabilities-with-aerial-drone  
   用途：无人机协同用途的二次交叉核对。

> A1 雷达阵列尺寸、拦截弹数量、装甲厚度、内部电缆和无人机发射机构没有按工程参数复刻；这些部分在应用中标为“局部机理推定”或“概念化”。

## C. 巴基斯坦版本 / Haider

7. **Quwa — Pakistan Armor Database: HIT Haider Main Battle Tank**  
   https://quwa.org/pakistan-defence-industry/hit/heavy-industries-taxila-hit-haider-main-battle-tank/  
   用途：Haider 与巴基斯坦 VT-4 体系的关系、三人制、125 mm 主炮、公开尺寸/动力参数及服役照片特征。

> “VT-4P”是应用内用于区分照片近似构型的界面名。ERA 具体型号、FY-4/FY-2 混合比例、模块倾角、间隙、裙板紧固点和尾部格栅尺寸缺少完整公开工程图，因此只做可视差异重构，不作为精确装备识别结论。

## D. WebGPU 运行参考

8. **Chrome for Developers — WebGPU troubleshooting tips and fixes**  
   https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips  
   用途：浏览器版本、安全上下文、硬件加速、Linux Vulkan 和适配器排障。

9. **Chrome for Developers — Supercharge Web AI model testing: WebGPU, WebGL, and Headless Chrome**  
   https://developer.chrome.com/blog/supercharge-web-ai-testing  
   用途：自动化测试环境中的 Vulkan / Headless WebGPU 启动方法。

## E. 没有使用的资产

- 未下载或嵌入任何第三方照片、HDRI、CAD、维修手册页、三维模型或纹理。
- 未使用在线 Three.js、Babylon.js、React、Vue、字体服务或分析脚本。
- 沙地、车辙、微表面、阴影、环境渐变和粒子均由包内代码实时生成。
