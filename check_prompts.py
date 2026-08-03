import os
import re
import json

def analyze_test_items(base_dir):
    # Determine the test item directories
    # We look at L1, L2, L3, L4, and Qwen... directories
    level_dirs = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d)) and not d.startswith('.')]
    
    test_items = []
    
    for l_dir in level_dirs:
        l_path = os.path.join(base_dir, l_dir)
        # the subdirectories of level_dirs are test items
        for t_dir in os.listdir(l_path):
            t_path = os.path.join(l_path, t_dir)
            if os.path.isdir(t_path) and not t_dir.startswith('.'):
                test_items.append({
                    'category': l_dir,
                    'name': t_dir,
                    'path': t_path
                })
                
    missing_prompts = []
    embedded_in_readme = []
    
    for item in test_items:
        prompt_path = os.path.join(item['path'], 'PROJECT_PROMPT.md')
        readme_paths = [
            os.path.join(item['path'], 'README.md'),
            os.path.join(item['path'], 'readme.md'),
            os.path.join(item['path'], 'README.MD')
        ]
        
        has_prompt = os.path.exists(prompt_path)
        
        if not has_prompt:
            missing_prompts.append(item)
            # Check readmes for prompt content
            for rp in readme_paths:
                if os.path.exists(rp):
                    try:
                        with open(rp, 'r', encoding='utf-8') as f:
                            content = f.read()
                            # Check for typical prompt headings
                            if re.search(r'#(.*)(任务背景|需求范围|交付与限制要求)', content, re.IGNORECASE):
                                embedded_in_readme.append({
                                    'item': item,
                                    'readme_file': rp,
                                    'reason': 'Found prompt headers like 任务背景/需求范围/交付与限制要求 in README'
                                })
                                break
                    except Exception as e:
                        pass
                        
    output = {
        'missing_prompts': missing_prompts,
        'embedded_in_readme': embedded_in_readme
    }
    
    with open('prompt_audit.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    analyze_test_items('.')
