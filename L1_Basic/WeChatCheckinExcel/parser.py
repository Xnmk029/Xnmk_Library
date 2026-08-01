import re
from typing import Optional, Dict

def parse_appointment_msg(text: str) -> Optional[Dict[str, str]]:
    """
    解析微信打卡预约格式消息。

    期望输入格式范例：
    账号：my_account_01
    密码：my_password_123
    时间：2026-07-24 14:00
    有无绑定：有
    是否是diploma：是

    返回字典结构或 None (当不匹配特定格式时)
    """
    if not text or not isinstance(text, str):
        return None

    # 定义各个字段提取正则表达式（兼容中英文冒号与多余空格）
    account_pattern = r"(?:账号|帳號)\s*[:：]\s*(.+)"
    password_pattern = r"(?:密码|密碼)\s*[:：]\s*(.+)"
    time_pattern = r"(?:时间|時間)\s*[:：]\s*(.+)"
    bound_pattern = r"有无绑定\s*[:：]\s*(.+)"
    diploma_pattern = r"是否是diploma\s*[:：]\s*(.+)"

    account_match = re.search(account_pattern, text, re.IGNORECASE)
    password_match = re.search(password_pattern, text, re.IGNORECASE)
    time_match = re.search(time_pattern, text, re.IGNORECASE)
    bound_match = re.search(bound_pattern, text, re.IGNORECASE)
    diploma_match = re.search(diploma_pattern, text, re.IGNORECASE)

    # 核心必须包含 账号、密码、时间 三个关键项
    if not (account_match and password_match and time_match):
        return None

    parsed_data = {
        "account": account_match.group(1).strip(),
        "password": password_match.group(1).strip(),
        "time": time_match.group(1).strip(),
        "is_bound": bound_match.group(1).strip() if bound_match else "",
        "is_diploma": diploma_match.group(1).strip() if diploma_match else "",
    }

    return parsed_data
