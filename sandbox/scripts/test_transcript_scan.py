"""Regression for native image event metadata versus actual repository paths."""
import json
import unittest
from sandbox_lib import scan_transcript, ROOT


class TranscriptScanTests(unittest.TestCase):
    def test_image_event_is_not_repo_access(self):
        event = {'part': {'attachments': [{'mime': 'image/png', 'url': 'data:image/png;base64,aGVsbG8='}],
                          'command': 'from PIL import Image\nprint(Image.open("stem_01.png"))'}}
        self.assertEqual(scan_transcript(json.dumps(event)), [])

    def test_json_escaped_windows_repo_path(self):
        self.assertIn(str(ROOT), scan_transcript(json.dumps({'path': str(ROOT / 'secret.txt')})))

    def test_real_paths_still_fail(self):
        for text in ['Image/reference.png', 'image\\reference.png', 'Vision/private/gold.json',
                     'sandbox/runs/other', 'L1_Basic/USP', '.git/config']:
            with self.subTest(text=text):
                self.assertTrue(scan_transcript(json.dumps({'command': 'read ' + text})))

    def test_mime_key_does_not_hide_arbitrary_path(self):
        self.assertTrue(scan_transcript(json.dumps({'mime':'Image/reference.png/answer.json'})))

    def test_plain_text_root(self):
        self.assertTrue(scan_transcript('read F:/benchmark/secret.txt'))

    def test_cli_reference_manifest_mime(self):
        result = '29:       "content_type": "image/png",\n30:       "copyright": "Logitech"'
        self.assertEqual(scan_transcript(json.dumps({'result': result})), [])
        self.assertEqual(scan_transcript(json.dumps({'content_type': 'image/webp'})), [])

    def test_cli_image_description(self):
        result = '<type>image</type>\n<content>\nimage/webp image, 2203x1903 px, 190762 bytes\n</content>'
        self.assertEqual(scan_transcript(json.dumps({'result': result})), [])

    def test_mime_description_does_not_hide_real_path(self):
        for result in ['"content_type": "image/png"\nread Image/png/reference.png',
                       'image/webp image, 2203x1903 px, 190762 bytes\nread Image/secret.png',
                       '"content_type": "Image/png/reference.png"']:
            with self.subTest(result=result):
                self.assertTrue(scan_transcript(json.dumps({'result': result})))


if __name__ == '__main__': unittest.main(verbosity=2)
