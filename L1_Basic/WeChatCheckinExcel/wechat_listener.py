import time
from typing import Callable
from parser import parse_appointment_msg
from excel_handler import append_appointment_record
from config import LISTEN_TARGETS, AUTO_REPLY_ENABLED, AUTO_REPLY_TEXT

class WeChatAppListener:
    def __init__(self, listen_targets=None):
        self.listen_targets = listen_targets or LISTEN_TARGETS
        self.wx = None

    def initialize_wx(self):
        """
        初始化微信客户端连接
        """
        try:
            from wxauto import WeChat
            print("[微信] 正在连接 PC 微信客户端...")
            self.wx = WeChat()
            print("[微信] 微信客户端连接成功！")

            if self.listen_targets:
                for target in self.listen_targets:
                    print(f"[微信] 添加监听目标: {target}")
                    self.wx.AddListenChat(who=target)
            return True
        except Exception as e:
            print(f"[错误] 微信初始化失败！请确保 Windows PC 客户端已被打开并已登录。错误详情: {e}")
            return False

    def process_single_message(self, sender: str, content: str, reply_func: Callable[[str], None] = None):
        """
        判断并处理单条消息
        """
        if not content:
            return

        parsed = parse_appointment_msg(content)
        if parsed:
            print(f"\n[匹配成功] 收到符合打卡预约格式的消息！发送人: {sender}")
            # 导入 Excel
            append_appointment_record(sender=sender, parsed_data=parsed)

            # 自动回复
            if AUTO_REPLY_ENABLED and reply_func:
                try:
                    reply_func(AUTO_REPLY_TEXT)
                    print(f"[微信] 已向 {sender} 自动发送确认回复。")
                except Exception as re_err:
                    print(f"[警告] 自动回复失败: {re_err}")

    def start_listening_loop(self, check_interval: float = 1.5):
        """
        主循环：实时监听新消息
        """
        if not self.wx:
            if not self.initialize_wx():
                return

        print(f"\n[系统已启动] 正在监听微信消息... (每 {check_interval} 秒检测一次)")
        print("按 Ctrl+C 可停止运行。")

        processed_msg_ids = set()

        while True:
            try:
                # 方式 1: 如果配置了特定的监听目标
                if self.listen_targets:
                    msgs = self.wx.GetListenMessage()
                    for chat, chat_msgs in msgs.items():
                        for msg in chat_msgs:
                            msg_id = getattr(msg, 'id', hash((chat, getattr(msg, 'content', ''))))
                            if msg_id in processed_msg_ids:
                                continue
                            processed_msg_ids.add(msg_id)

                            msg_type = getattr(msg, 'type', '')
                            sender = getattr(msg, 'sender', chat)
                            content = getattr(msg, 'content', '')

                            if msg_type in ['friend', 'group', 'sys']:
                                def reply_fn(text):
                                    self.wx.SendMsg(text, who=chat)
                                self.process_single_message(sender, content, reply_func=reply_fn)

                # 方式 2: 未配置特定目标，读取当前微信的全部新消息
                else:
                    msgs = self.wx.GetAllNewMessage()
                    for chat_name, msg_list in msgs.items():
                        for msg in msg_list:
                            # wxauto 消息对象属性
                            sender = getattr(msg, 'sender', chat_name)
                            content = getattr(msg, 'content', str(msg))

                            def reply_fn(text, target=chat_name):
                                self.wx.SendMsg(text, who=target)

                            self.process_single_message(sender, content, reply_func=reply_fn)

            except KeyboardInterrupt:
                print("\n[系统停止] 收到用户终止指令，监听已退出。")
                break
            except Exception as e:
                print(f"[错误] 监听循环异常: {e}")

            time.sleep(check_interval)
