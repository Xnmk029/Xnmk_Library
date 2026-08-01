import os

# Excel 导出配置文件路径
EXCEL_FILE_PATH = os.path.join(os.path.dirname(__file__), "打卡预约数据.xlsx")

# Excel 表头列定义
EXCEL_COLUMNS = [
    "接收时间",
    "消息来源(微信名)",
    "账号",
    "密码",
    "时间",
    "有无绑定",
    "是否是diploma"
]

# 监听聊天目标列表（微信好友名、群聊名或备注）
# 若为空列表 []，则在主流程中处理任何收到的消息
LISTEN_TARGETS = []

# 成功导入后是否给发送者自动回复确认消息
AUTO_REPLY_ENABLED = True
AUTO_REPLY_TEXT = "【系统提示】打卡预约消息已成功导入表格！"
