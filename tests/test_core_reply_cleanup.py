"""回复正文的可见自重复与自述式重来要被清掉，而不是原样发出去。"""

from __future__ import annotations

import unittest

from astrbot_host.core_reply_cleanup import clean_reply_text


class ReplyCleanupTests(unittest.TestCase):
    def test_repeated_paragraph_is_sent_once(self):
        text = "又来了呀…都说了现在不好看嘛，等我收拾一下再考虑。\n\n又来了呀…都说了现在不好看嘛，等我收拾一下再考虑。"
        cleaned, removed = clean_reply_text(text)
        self.assertEqual(cleaned, "又来了呀…都说了现在不好看嘛，等我收拾一下再考虑。")
        self.assertEqual(removed, 1)

    def test_repeated_sentence_inside_one_paragraph_is_sent_once(self):
        cleaned, removed = clean_reply_text("嗯，我知道了。嗯，我知道了。")
        self.assertEqual(cleaned, "嗯，我知道了。")
        self.assertEqual(removed, 1)

    def test_self_reported_retry_lines_are_dropped(self):
        for line in ("等等，格式错了。重来。", "格式错了，重来", "重来", "等等。重来！"):
            cleaned, removed = clean_reply_text(f"本来想说的话。\n{line}")
            self.assertEqual(cleaned, "本来想说的话。", line)
            self.assertEqual(removed, 1, line)

    def test_normal_reply_is_untouched(self):
        text = "今天有点累。\n\n你呢？要不要一起早点睡？"
        cleaned, removed = clean_reply_text(text)
        self.assertEqual(cleaned, text)
        self.assertEqual(removed, 0)

    def test_empty_and_non_text_are_safe(self):
        self.assertEqual(clean_reply_text(""), ("", 0))
        self.assertEqual(clean_reply_text(None), (None, 0))


if __name__ == "__main__":
    unittest.main()
