// RTX 显卡硬件检测与特性支持分析器 (RTX & GPU Hardware Feature Detector)

export class RTXDetector {
  static async detect(gl) {
    const report = {
      isWebGPUSupported: false,
      isRTXSeries: false,
      vendor: '未知供应商 (Unknown)',
      renderer: '通用 GPU 渲染器 (Generic Renderer)',
      architecture: '常规 GPU 架构',
      features: [],
      hasFP16: false,
      hasSubgroups: false,
      hasFloatBuffer: false,
      maxAnisotropy: 1,
      tierScore: 0
    };

    // 1. 检测 WebGL Unmasked 供应商与 Renderer 信息
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        report.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || report.vendor;
        report.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || report.renderer;
      }

      // 检查 Float Buffer 支持
      const floatExt = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('WEBGL_color_buffer_float');
      report.hasFloatBuffer = !!floatExt;

      // 检查各向异性过滤支持
      const anisExt = gl.getExtension('EXT_texture_filter_anisotropic');
      if (anisExt) {
        report.maxAnisotropy = gl.getParameter(anisExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      }
    }

    // 2. 检测 WebGPU 光追与 Tensor/FP16 特性
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          report.isWebGPUSupported = true;
          report.features.push('WebGPU 核心引擎 API (WebGPU Core)');

          // 检查 FP16 半精度加速支持
          if (adapter.features.has('shader-f16')) {
            report.hasFP16 = true;
            report.features.push('FP16 半精度加速 (Shader-F16 / Tensor Cores)');
          }

          // 检查硬件 Subgroup 线程组支持
          if (adapter.features.has('subgroups')) {
            report.hasSubgroups = true;
            report.features.push('硬件级 Subgroup 线程调度 (HW Subgroups)');
          }
        }
      } catch (e) {
        console.warn('WebGPU 适配器检测提示:', e);
      }
    }

    // 3. 识别 RTX / High-Performance 显卡型号系列
    const rendererUpper = report.renderer.toUpperCase();
    if (rendererUpper.includes('RTX') || rendererUpper.includes('QUADRO RTX') || rendererUpper.includes('TITAN RTX')) {
      report.isRTXSeries = true;
      report.architecture = 'NVIDIA Turing / Ampere / Ada Lovelace 光线追踪架构';
      report.features.push('RTX 硬件光线追踪 (RT Cores)');
      report.features.push('Tensor Core 深度学习降噪与 DLSS 加速');
    } else if (rendererUpper.includes('RADEON RX') && (rendererUpper.includes('6') || rendererUpper.includes('7'))) {
      report.isRTXSeries = true;
      report.architecture = 'AMD RDNA2 / RDNA3 硬件光追架构';
      report.features.push('Ray Accelerator 光追单元');
    } else if (rendererUpper.includes('APPLE M') && (rendererUpper.includes('PRO') || rendererUpper.includes('MAX') || rendererUpper.includes('ULTRA'))) {
      report.architecture = 'Apple Silicon 统一内存架构 (Metal Raytracing)';
      report.features.push('Apple Metal 硬件光追加速');
    } else if (rendererUpper.includes('GTX')) {
      report.architecture = 'NVIDIA Pascal / Turing GTX 架构 (软件光线追踪)';
    }

    // 4. 计算显卡理论评级得分基准 (Tier Score Base)
    let tierScore = 5000; // 基准分
    if (report.isRTXSeries) tierScore += 5000;
    if (report.hasFP16) tierScore += 2000;
    if (report.hasSubgroups) tierScore += 1500;
    if (report.isWebGPUSupported) tierScore += 1500;
    if (rendererUpper.includes('4090') || rendererUpper.includes('4080')) tierScore += 8000;
    if (rendererUpper.includes('3090') || rendererUpper.includes('3080')) tierScore += 5000;

    report.tierScore = tierScore;

    return report;
  }
}
