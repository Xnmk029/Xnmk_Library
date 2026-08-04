import urllib.request
import math
import random
from PIL import Image
import numpy as np

def generate_mona_lisa_svg():
    width, height = 1200, 1600
    num_strokes = 120000
    
    # Download reference image
    url = "https://upload.wikimedia.org/wikipedia/commons/6/6a/Mona_Lisa.jpg"
    print("Downloading reference image...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            with open("mona_lisa_ref.jpg", "wb") as f:
                f.write(response.read())
    except Exception as e:
        print("Error downloading image:", e)
        return
            
    print("Processing image...")
    img = Image.open("mona_lisa_ref.jpg").convert("RGB")
    
    # Crop to aspect ratio 1200:1600 = 3:4
    img_w, img_h = img.size
    target_ratio = width / height
    current_ratio = img_w / img_h
    
    if current_ratio > target_ratio:
        # Image is wider
        new_w = int(target_ratio * img_h)
        left = (img_w - new_w) // 2
        img = img.crop((left, 0, left + new_w, img_h))
    else:
        # Image is taller
        new_h = int(img_w / target_ratio)
        top = (img_h - new_h) // 2
        img = img.crop((0, top, img_w, top + new_h))
        
    img = img.resize((width, height), Image.Resampling.LANCZOS)
    img_data = np.array(img)
    
    # Calculate gradients for edge directions
    # Convert to grayscale for gradient calculation
    gray = np.dot(img_data[...,:3], [0.2989, 0.5870, 0.1140])
    dy, dx = np.gradient(gray)
    
    # SVG header
    svg_out = []
    svg_out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">')
    # Dark underpainting matching classical technique
    svg_out.append(f'<rect width="{width}" height="{height}" fill="#2a2015" />')
    
    print("Generating strokes...")
    strokes = []
    
    # Pre-calculate probabilities for sampling (more density on face and edges)
    # Mona Lisa face is roughly in the center-top area.
    
    for i in range(num_strokes):
        # Biased sampling: slightly more points in center/upper center
        x = int(random.triangular(0, width, width / 2))
        y = int(random.triangular(0, height, height * 0.4))
        
        # Ensure within bounds
        x = max(0, min(width - 1, x))
        y = max(0, min(height - 1, y))
        
        r, g, b = img_data[y, x]
        r, g, b = int(r), int(g), int(b)
        
        # Color jittering: warm ochre/gold bias
        r = max(0, min(255, r + random.randint(-15, 20)))
        g = max(0, min(255, g + random.randint(-15, 15)))
        b = max(0, min(255, b + random.randint(-20, 10)))
        
        luminance = 0.2126*r + 0.7152*g + 0.0722*b
        
        # Glazing opacity: dark strokes are slightly more opaque, light highlights are softer
        opacity = 0.2 + (luminance / 255.0) * 0.6
        
        gx = dx[y, x]
        gy = dy[y, x]
        magnitude = math.sqrt(gx**2 + gy**2)
        
        if magnitude > 5:
            # Orientation perpendicular to gradient (along contour)
            angle = math.atan2(gy, gx) + math.pi / 2
            length = max(3, 20 - magnitude/10) # Stronger edges = shorter strokes
        else:
            # Random angle for flat areas
            angle = random.uniform(0, math.pi)
            length = random.uniform(15, 35)
            
        stroke_width = random.uniform(1.0, 3.5)
        
        dx_stroke = math.cos(angle) * length / 2
        dy_stroke = math.sin(angle) * length / 2
        
        x1, y1 = x - dx_stroke, y - dy_stroke
        x2, y2 = x + dx_stroke, y + dy_stroke
        
        # Subtle curvature for tapered brush feel
        bend = random.uniform(-0.4, 0.4) * length
        cx = x + math.cos(angle + math.pi/2) * bend
        cy = y + math.sin(angle + math.pi/2) * bend
        
        path_str = f'<path d="M {x1:.1f},{y1:.1f} Q {cx:.1f},{cy:.1f} {x2:.1f},{y2:.1f}" stroke="rgba({r},{g},{b},{opacity:.2f})" stroke-width="{stroke_width:.1f}" stroke-linecap="round" fill="none" />'
        
        # Sort key: draw darker base first, then lighter highlights on top
        # Add random jitter to sorting so layers blend organically
        sort_key = luminance + random.uniform(-40, 40)
        strokes.append((sort_key, path_str))
        
        if (i+1) % 20000 == 0:
            print(f"Generated {i+1} strokes...")
            
    print("Sorting and assembling SVG...")
    strokes.sort(key=lambda item: item[0])
    
    for _, path in strokes:
        svg_out.append(path)
        
    svg_out.append('</svg>')
    
    print("Writing SVG file...")
    with open("mona_lisa.svg", "w", encoding="utf-8") as f:
        f.write("\n".join(svg_out))
        
    print("Done! SVG written to mona_lisa.svg")

if __name__ == "__main__":
    generate_mona_lisa_svg()
