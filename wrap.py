import os

def wrap_prompts(base_dir):
    for root, dirs, files in os.walk(base_dir):
        if 'PROJECT_PROMPT.md' in files:
            path = os.path.join(root, 'PROJECT_PROMPT.md')
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if already wrapped
            if not content.strip().startswith('```markdown'):
                new_content = '```markdown\n' + content + '\n```\n'
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Wrapped {path}")

wrap_prompts(r'F:\benchmark')
