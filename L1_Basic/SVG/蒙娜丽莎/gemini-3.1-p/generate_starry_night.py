import urllib.request
import math
import random
from PIL import Image
import numpy as np

def generate_starry_night_svg():
    width, height = 1600, 1200
    num_strokes = 140000
    
    url = "https://en.wikipedia.org/wiki/Special:FilePath/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg?width=1200"
    print("Downloading reference image...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            with open("starry_night_ref.jpg", "wb") as f:
                f.write(response.read())
    except Exception as e:
        print("Error downloading image:", e)
        return
            
    print("Processing image...")
    img = Image.open("starry_night_ref.jpg").convert("RGB")
    
    img_w, img_h = img.size
    target_ratio = width / height
    current_ratio = img_w / img_h
    
    if current_ratio > target_ratio:
        new_w = int(target_ratio * img_h)
        left = (img_w - new_w) // 2
        img = img.crop((left, 0, left + new_w, img_h))
    else:
        new_h = int(img_w / target_ratio)
        top = (img_h - new_h) // 2
        img = img.crop((0, top, img_w, top + new_h))
        
    img = img.resize((width, height), Image.Resampling.LANCZOS)
    img_data = np.array(img)
    
    gray = np.dot(img_data[...,:3], [0.2989, 0.5870, 0.1140])
    dy, dx = np.gradient(gray)
    
    svg_out = []
    svg_out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">')
    # Impasto Filter for 3D paint effect
    svg_out.append('''<defs>
        <filter id="impasto" x="-10%" y="-10%" width="120%" height="120%">
            <!-- A subtle drop shadow to make the paint look thick and raised -->
            <feDropShadow dx="1.5" dy="2" stdDeviation="1" flood-color="#000" flood-opacity="0.6"/>
        </filter>
    </defs>''')
    
    # Dark ultramarine base
    svg_out.append(f'<rect width="{width}" height="{height}" fill="#050a1a" />')
    
    print("Generating strokes...")
    
    grid_size = 7
    strokes = []
    
    for y in range(0, height, grid_size):
        for x in range(0, width, grid_size):
            # Random jitter within the grid cell
            px = x + random.uniform(-grid_size, grid_size)
            py = y + random.uniform(-grid_size, grid_size)
            
            px_int = max(0, min(width - 1, int(px)))
            py_int = max(0, min(height - 1, int(py)))
            
            r, g, b = img_data[py_int, px_int]
            r, g, b = int(r), int(g), int(b)
            
            # Color jittering
            jitter = random.randint(-20, 20)
            r = max(0, min(255, r + jitter + random.randint(-10, 10)))
            g = max(0, min(255, g + jitter + random.randint(-10, 10)))
            b = max(0, min(255, b + jitter + random.randint(-10, 10)))
            
            luminance = 0.2126*r + 0.7152*g + 0.0722*b
            opacity = random.uniform(0.9, 1.0)
            
            gx = dx[py_int, px_int]
            gy = dy[py_int, px_int]
            magnitude = math.sqrt(gx**2 + gy**2)
            
            if magnitude > 1:
                angle = math.atan2(gy, gx) + math.pi / 2
                angle += random.uniform(-0.1, 0.1)
                length = random.uniform(15, 30)
            else:
                angle = random.uniform(0, math.pi)
                length = random.uniform(10, 20)
                
            w = random.uniform(4.0, 8.0)
            
            dx_stroke = math.cos(angle) * length / 2
            dy_stroke = math.sin(angle) * length / 2
            
            x1, y1 = px - dx_stroke, py - dy_stroke
            x2, y2 = px + dx_stroke, py + dy_stroke
            
            bend = random.uniform(-0.1, 0.1) * length
            cx = px + math.cos(angle + math.pi/2) * bend
            cy = py + math.sin(angle + math.pi/2) * bend
            
            # Base thick stroke with impasto shadow
            path_str = f'<path d="M {x1:.1f},{y1:.1f} Q {cx:.1f},{cy:.1f} {x2:.1f},{y2:.1f}" stroke="rgba({r},{g},{b},{opacity:.2f})" stroke-width="{w:.1f}" stroke-linecap="round" fill="none" filter="url(#impasto)" />'
            
            # Add a lighter bristle highlight to simulate paint ridges
            hr = max(0, min(255, r + 40))
            hg = max(0, min(255, g + 40))
            hb = max(0, min(255, b + 40))
            # Offset highlight slightly
            ox = math.cos(angle + math.pi/2) * (w / 3)
            oy = math.sin(angle + math.pi/2) * (w / 3)
            
            highlight_str = f'<path d="M {x1+ox:.1f},{y1+oy:.1f} Q {cx+ox:.1f},{cy+oy:.1f} {x2+ox:.1f},{y2+oy:.1f}" stroke="rgba({hr},{hg},{hb},0.6)" stroke-width="{w*0.3:.1f}" stroke-linecap="round" fill="none" />'
            
            sort_key = luminance + random.uniform(-20, 20)
            strokes.append((sort_key, path_str + "\n" + highlight_str))
            
    print(f"Generated {len(strokes)} strokes...")
            
    print("Sorting and assembling SVG...")
    strokes.sort(key=lambda item: item[0])
    
    for _, path in strokes:
        svg_out.append(path)
        
    svg_out.append('</svg>')
    
    print("Writing SVG file...")
    with open("starry_night.svg", "w", encoding="utf-8") as f:
        f.write("\n".join(svg_out))
        
    print("Done! SVG written to starry_night.svg")

if __name__ == "__main__":
    generate_starry_night_svg()
