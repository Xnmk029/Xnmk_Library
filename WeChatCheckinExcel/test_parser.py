import unittest
from parser import parse_appointment_msg

class TestAppointmentParser(unittest.TestCase):
    def test_standard_format(self):
        msg = """
账号：user_test_01
密码：pass_123456
时间：2026-07-24 15:30
有无绑定：有
是否是diploma：是
"""
        result = parse_appointment_msg(msg)
        self.assertIsNotNone(result)
        self.assertEqual(result["account"], "user_test_01")
        self.assertEqual(result["password"], "pass_123456")
        self.assertEqual(result["time"], "2026-07-24 15:30")
        self.assertEqual(result["is_bound"], "有")
        self.assertEqual(result["is_diploma"], "是")

    def test_english_colon_and_spaces(self):
        msg = """
账号:   user_test_02  
密码:   secret_pass  
时间:   明天下午3点  
有无绑定: 无 
是否是diploma: 否
"""
        result = parse_appointment_msg(msg)
        self.assertIsNotNone(result)
        self.assertEqual(result["account"], "user_test_02")
        self.assertEqual(result["password"], "secret_pass")
        self.assertEqual(result["time"], "明天下午3点")
        self.assertEqual(result["is_bound"], "无")
        self.assertEqual(result["is_diploma"], "否")

    def test_invalid_format_should_return_none(self):
        msg = "你好，我想预约一下明天的项目，麻烦帮我安排。"
        self.assertIsNone(parse_appointment_msg(msg))

        missing_password = """
账号：user_test_03
时间：2026-07-24
有无绑定：有
"""
        self.assertIsNone(parse_appointment_msg(missing_password))

if __name__ == "__main__":
    unittest.main()
