/**
 * dds.js — DirectDraw Surface loader for modern BeamNG textures.
 *
 * The CCF asset set is entirely BC-compressed with DX10 extension headers:
 *   BC4 (ATI1/BC4U, DXGI 80)     — single channel (AO / masks)
 *   BC5 (BC5U, DXGI 83)          — two channel (normal maps)
 *   BC6H (DXGI 95)               — HDR RGB
 *   BC7 (DXGI 98 / 99 sRGB)      — RGBA color/data
 * plus legacy DXT1/3/5 support for third-party mods.
 *
 * Three's stock DDSLoader predates several of these, so this is a clean-room
 * parser that emits THREE.CompressedTexture with the proper internal format,
 * gated on the WebGL2 extensions:
 *   EXT_texture_compression_bptc (BC6H/BC7)
 *   EXT_texture_compression_rgtc (BC4/BC5)
 *   WEBGL_compressed_texture_s3tc(_srgb) (DXT1/3/5)
 * Unsupported formats resolve to null and the material system falls back to
 * flat tints, so the app never hard-fails on a texture.
 */
import * as THREE from 'three';

const DDS_MAGIC = 0x20534444;
const FOURCC = (s) => s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24);
const FOURCC_DXT1 = FOURCC('DXT1');
const FOURCC_DXT3 = FOURCC('DXT3');
const FOURCC_DXT5 = FOURCC('DXT5');
const FOURCC_DX10 = FOURCC('DX10');
const FOURCC_ATI1 = FOURCC('ATI1');
const FOURCC_ATI2 = FOURCC('ATI2');
const FOURCC_BC4U = FOURCC('BC4U');
const FOURCC_BC5U = FOURCC('BC5U');

// DXGI formats we understand
const DXGI = {
  BC1_UNORM: 71, BC1_UNORM_SRGB: 72,
  BC2_UNORM: 74, BC2_UNORM_SRGB: 75,
  BC3_UNORM: 77, BC3_UNORM_SRGB: 78,
  BC4_UNORM: 80, BC4_SNORM: 81,
  BC5_UNORM: 83, BC5_SNORM: 84,
  BC6H_UF16: 95, BC6H_SF16: 96,
  BC7_UNORM: 98, BC7_UNORM_SRGB: 99,
};

export class DDSTextureLoader {
  constructor(renderer) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    this.ext = {
      bptc: gl.getExtension('EXT_texture_compression_bptc'),
      rgtc: gl.getExtension('EXT_texture_compression_rgtc'),
      s3tc: gl.getExtension('WEBGL_compressed_texture_s3tc'),
      s3tcSrgb: gl.getExtension('WEBGL_compressed_texture_s3tc_srgb'),
    };
    this.support = {
      bc7: !!this.ext.bptc, bc6h: !!this.ext.bptc,
      bc4: !!this.ext.rgtc, bc5: !!this.ext.rgtc,
      dxt: !!this.ext.s3tc,
    };
    this.stats = { loaded: 0, rejected: 0, bytes: 0 };
  }

  supportSummary() {
    return Object.entries(this.support).map(([k, v]) => `${k}:${v ? 'y' : 'N'}`).join(' ');
  }

  /**
   * @param {ArrayBuffer} buffer  raw .dds bytes
   * @param {boolean} srgb        treat as color data (only honoured where format allows)
   * @returns {THREE.CompressedTexture|null}
   */
  parse(buffer, srgb = false, name = '') {
    const dv = new DataView(buffer);
    if (dv.getUint32(0, true) !== DDS_MAGIC) return null;
    const height = dv.getUint32(12, true);
    const width = dv.getUint32(16, true);
    const mipCount = Math.max(1, dv.getUint32(28, true));
    const pfFlags = dv.getUint32(80, true);
    const fourCC = dv.getUint32(84, true);

    let dataOffset = 128;
    let blockBytes = 16;
    let format = null;
    let colorSpace = THREE.NoColorSpace;

    const pick = (fmt, bb, cs) => { format = fmt; blockBytes = bb; colorSpace = cs || THREE.NoColorSpace; };

    if (pfFlags & 0x4) { // DDPF_FOURCC
      switch (fourCC) {
        case FOURCC_DXT1:
          if (this.support.dxt) pick(srgb && this.ext.s3tcSrgb ? THREE.RGB_S3TC_DXT1_Format : THREE.RGB_S3TC_DXT1_Format, 8, srgb ? THREE.SRGBColorSpace : 0);
          break;
        case FOURCC_DXT3:
          if (this.support.dxt) pick(THREE.RGBA_S3TC_DXT3_Format, 16, srgb ? THREE.SRGBColorSpace : 0);
          break;
        case FOURCC_DXT5:
          if (this.support.dxt) pick(THREE.RGBA_S3TC_DXT5_Format, 16, srgb ? THREE.SRGBColorSpace : 0);
          break;
        case FOURCC_ATI1:
        case FOURCC_BC4U:
          if (this.support.bc4) pick(THREE.RED_RGTC1_Format, 8);
          break;
        case FOURCC_ATI2:
        case FOURCC_BC5U:
          if (this.support.bc5) pick(THREE.RED_GREEN_RGTC2_Format, 16);
          break;
        case FOURCC_DX10: {
          dataOffset = 148;
          const dxgi = dv.getUint32(128, true);
          switch (dxgi) {
            case DXGI.BC1_UNORM: case DXGI.BC1_UNORM_SRGB:
              if (this.support.dxt) pick(THREE.RGB_S3TC_DXT1_Format, 8, dxgi === DXGI.BC1_UNORM_SRGB || srgb ? THREE.SRGBColorSpace : 0);
              break;
            case DXGI.BC2_UNORM: case DXGI.BC2_UNORM_SRGB:
              if (this.support.dxt) pick(THREE.RGBA_S3TC_DXT3_Format, 16, srgb ? THREE.SRGBColorSpace : 0);
              break;
            case DXGI.BC3_UNORM: case DXGI.BC3_UNORM_SRGB:
              if (this.support.dxt) pick(THREE.RGBA_S3TC_DXT5_Format, 16, srgb ? THREE.SRGBColorSpace : 0);
              break;
            case DXGI.BC4_UNORM: case DXGI.BC4_SNORM:
              if (this.support.bc4) pick(THREE.RED_RGTC1_Format, 8);
              break;
            case DXGI.BC5_UNORM: case DXGI.BC5_SNORM:
              if (this.support.bc5) pick(THREE.RED_GREEN_RGTC2_Format, 16);
              break;
            case DXGI.BC6H_UF16:
              if (this.support.bc6h) pick(THREE.RGB_BPTC_UNSIGNED_Format, 16);
              break;
            case DXGI.BC6H_SF16:
              if (this.support.bc6h) pick(THREE.RGB_BPTC_SIGNED_Format, 16);
              break;
            case DXGI.BC7_UNORM:
              if (this.support.bc7) pick(THREE.RGBA_BPTC_Format, 16, srgb ? THREE.SRGBColorSpace : 0);
              break;
            case DXGI.BC7_UNORM_SRGB:
              if (this.support.bc7) pick(THREE.RGBA_BPTC_Format, 16, THREE.SRGBColorSpace);
              break;
          }
          break;
        }
      }
    }

    if (format === null) { this.stats.rejected++; return null; }

    const mipmaps = [];
    let w = width, h = height, off = dataOffset;
    for (let m = 0; m < mipCount; m++) {
      const bw = Math.max(1, (w + 3) >> 2), bh = Math.max(1, (h + 3) >> 2);
      const len = bw * bh * blockBytes;
      if (off + len > buffer.byteLength) break;
      mipmaps.push({ data: new Uint8Array(buffer, off, len), width: w, height: h });
      off += len;
      w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
    }
    if (!mipmaps.length) { this.stats.rejected++; return null; }

    const tex = new THREE.CompressedTexture(mipmaps, width, height, format, THREE.UnsignedByteType);
    tex.name = name;
    tex.colorSpace = colorSpace || THREE.NoColorSpace;
    tex.minFilter = mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    // BeamNG DDS files are stored top-down; DAE UVs expect flipped-Y like PNG.
    // CompressedTexture cannot flipY at upload, so the material UV transform
    // compensates (see materials.js).
    tex.flipY = false;
    tex.needsUpdate = true;
    this.stats.loaded++;
    this.stats.bytes += buffer.byteLength;
    return tex;
  }
}

export default DDSTextureLoader;
