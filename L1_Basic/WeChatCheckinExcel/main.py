import sys
import os
from excel_handler import ensure_excel_exists
from config import EXCEL_FILE_PATH
from wechat_listener import WeChatAppListener

def main():
    print("=" * 60)
    print("      微信【打卡预约】特定格式消息自动导入 Excel 工具      ")
    print("=" * 60)

    # 1. 确保 Excel 文件存在并初始化表头
    print(f"\n[1/2] 正在初始化 Excel 配置文件: {os.path.basename(EXCEL_FILE_PATH)}")
    ensure_excel_exists()

    # 2. 启动微信监听
    print("\n[2/2] 准备启动微信消息监听...")
    listener = WeChatAppListener()
    listener.start_listening_loop()

if __name__ == "__main__":
    main()
