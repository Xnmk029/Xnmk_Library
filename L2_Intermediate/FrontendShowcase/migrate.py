import os
import shutil

src_base = r"G:\产品\新benchmark\前端"
dst_base = r"F:\benchmark\L2_Intermediate\FrontendShowcase"

def copy_tree_exclude(src, dst):
    if not os.path.exists(dst):
        os.makedirs(dst)
        
    for item in os.listdir(src):
        if item in ['node_modules', 'dist', '.git', '.vite', '.vite-temp']:
            continue
            
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        
        if os.path.isdir(s):
            copy_tree_exclude(s, d)
        else:
            shutil.copy2(s, d)

# List all projects in backup
projects = [f for f in os.listdir(src_base) if os.path.isdir(os.path.join(src_base, f))]

for proj in projects:
    src_proj = os.path.join(src_base, proj)
    dst_proj = os.path.join(dst_base, proj)
    
    print(f"Migrating {proj} ...")
    copy_tree_exclude(src_proj, dst_proj)
    
print("Migration completed.")
