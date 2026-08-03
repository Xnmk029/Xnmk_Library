import os
import re

files_to_edit = [
    r"F:\benchmark\L1_Basic\Archive\PROJECT_PROMPT.md",
    r"F:\benchmark\L1_Basic\BilibiliUserscript\PROJECT_PROMPT.md",
    r"F:\benchmark\L1_Basic\PyFlowingLight\PROJECT_PROMPT.md",
    r"F:\benchmark\L1_Basic\SVG\PROJECT_PROMPT.md",
    r"F:\benchmark\L1_Basic\WeChatCheckinExcel\PROJECT_PROMPT.md",
    r"F:\benchmark\L2_Intermediate\2048\PROJECT_PROMPT.md",
    r"F:\benchmark\L2_Intermediate\GoBoard\PROJECT_PROMPT.md",
    r"F:\benchmark\L2_Intermediate\PenroseStairs\PROJECT_PROMPT.md",
    r"F:\benchmark\L3_Advanced\USP\PROJECT_PROMPT.md",
    r"F:\benchmark\L4_Expert\EngineSIM\PROJECT_PROMPT.md",
    r"F:\benchmark\L4_Expert\SketchUpMCP\PROJECT_PROMPT.md",
    r"F:\benchmark\Qwen3.8MAX正式版\2048\PROJECT_PROMPT.md",
    r"F:\benchmark\Qwen3.8MAX正式版\USP\PROJECT_PROMPT.md"
]

for file_path in files_to_edit:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
        
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace rules
    # 1. 目标是考核模型... -> 本项目的核心难点/目标是...
    content = re.sub(r'目标是考核模型', r'本项目的核心目标是', content)
    
    # 2. 考核点
    content = re.sub(r'，甚至是考核点', '', content)
    
    # 3. 维度替换
    content = re.sub(r'维度 A：前端动效与流畅度（权重\s*50%）', r'核心要求：前端动效与流畅度', content)
    content = re.sub(r'维度 B：Roguelike 流程理解（权重\s*50%）', r'核心要求：Roguelike 流程理解', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("All files processed.")
