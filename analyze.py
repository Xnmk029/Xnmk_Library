import os
import re
import json

def analyze_prompts(root_dir):
    md_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        for f in filenames:
            if f.endswith('PROJECT_PROMPT.md'):
                md_files.append(os.path.join(dirpath, f))
    
    results = []
    for path in md_files:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            headers = re.findall(r'^#+ (.*)', content, re.MULTILINE)
            # Find exact occurrences of strings related to assessment
            assessment_matches = re.findall(r'(.{0,20}(?:考核方向|考核|权重|目标是考核模型).{0,20})', content)
            
            results.append({
                'path': path,
                'headers': headers,
                'assessment_matches': assessment_matches
            })
        except Exception as e:
            pass
            
    with open('analysis_output.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    analyze_prompts('.')
