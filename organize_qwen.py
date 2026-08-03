import os
import shutil

qwen_dir = r'F:\benchmark\Qwen3.8MAX正式版'
base_dir = r'F:\benchmark'

# Map test item names to their true location
test_item_locations = {}
for root, dirs, files in os.walk(base_dir):
    # Exclude Qwen3.8MAX正式版 itself and other backup dirs if needed
    if 'Qwen3.8MAX' in root or 'node_modules' in root or '.git' in root:
        continue
    if 'PROJECT_PROMPT.md' in files:
        item_name = os.path.basename(root)
        test_item_locations[item_name] = root

for item in os.listdir(qwen_dir):
    if item in test_item_locations:
        src = os.path.join(qwen_dir, item)
        dst_base = test_item_locations[item]
        
        target_name = "Qwen3.8MAX"
        dst = os.path.join(dst_base, target_name)
        
        if os.path.exists(dst):
            target_name = "Qwen3.8MAX0804"
            dst = os.path.join(dst_base, target_name)
            
        print(f"Moving {src} to {dst}")
        shutil.move(src, dst)
    else:
        print(f"Skipped {item}, no matching project found.")

# Try to remove the empty qwen_dir
if os.path.exists(qwen_dir):
    try:
        os.rmdir(qwen_dir)
        print("Removed empty root folder.")
    except Exception as e:
        print(f"Could not remove root folder: {e}")
