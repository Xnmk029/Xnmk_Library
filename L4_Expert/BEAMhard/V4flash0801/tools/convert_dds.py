#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert_dds.py - Convert BeamNG .dds textures to .png (BC1/BC2/BC3/BC4/BC5/BC7 + uncompressed)
Usage: python tools/convert_dds.py <mod_vehicles_dir> <dst_root>
"""
import os, sys, json

def suffix_key(name):
    low = name.lower()
    for k in ('normal', 'color', 'glow', 'data', 'dmg'):
        if '.' + k in low or '_' + k in low:
            return k
    return None

MAX_DIM = {'color': 2048, 'normal': 2048, 'data': 1024, 'glow': 1024, 'dmg': 1024}
DEFAULT_DIM = 2048

def main():
    src = sys.argv[1]
    dst = sys.argv[2]
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    stats = {'converted': 0, 'failed': 0, 'bytes_in': 0, 'bytes_out': 0}
    failed = []
    for base, _dirs, files in os.walk(src):
        for fn in files:
            if not fn.lower().endswith('.dds'):
                continue
            src_path = os.path.join(base, fn)
            rel = os.path.relpath(src_path, src)
            dst_path = os.path.join(dst, rel[:-4] + '.png')
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            try:
                im = Image.open(src_path)
                im.load()
                stats['bytes_in'] += os.path.getsize(src_path)
                key = suffix_key(fn)
                maxdim = MAX_DIM.get(key, DEFAULT_DIM)
                w, h = im.size
                if max(w, h) > maxdim:
                    ratio = maxdim / float(max(w, h))
                    im = im.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), Image.LANCZOS)
                im.save(dst_path, 'PNG', optimize=True)
                stats['converted'] += 1
                stats['bytes_out'] += os.path.getsize(dst_path)
            except Exception as e:
                stats['failed'] += 1
                failed.append((rel, str(e)))
    print(json.dumps(stats))
    for m in failed[:20]:
        print('FAILED:', m[0], m[1])
    return 0

if __name__ == '__main__':
    sys.exit(main())
