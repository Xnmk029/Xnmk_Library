import json
import os

def load_test_cases():
    test_cases_path = os.path.join(os.path.dirname(__file__), '..', 'test_cases', 'eval_cases.json')
    if os.path.exists(test_cases_path):
        with open(test_cases_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def main():
    cases = load_test_cases()
    print(f"Loaded {len(cases)} test case(s).")
    for case in cases:
        print(f"- [{case.get('id')}] {case.get('name')}: {case.get('input')}")

if __name__ == "__main__":
    main()
