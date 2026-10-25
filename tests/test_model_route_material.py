from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from astrbot_host.model_route_material import build_summary, scope_umo


class Meta(dict):
    """Provider meta 用属性读取，普通 dict 不够。"""

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError as error:
            raise AttributeError(name) from error


class Provider:
    def __init__(self, meta):
        self._meta = Meta(meta)

    def meta(self):
        return self._meta


class Host:
    def __init__(self, chat=None, tts=None):
        self._chat, self._tts = chat, tts

    def get_using_provider(self, umo=None):
        return self._chat

    def get_using_tts_provider(self, umo=None):
        return self._tts


def context():
    return SimpleNamespace(actor="actor", observed_at=NOW)


SNAPSHOT = {
    "tasks": [
        {"kind": "conversation.reply", "fields": {"provider": {"value": "p-chat"}}},
        {"kind": "vision.review", "fields": {"provider": {"value": "p-vision"}}},
        {"kind": "image.generate", "fields": {"provider": {"value": "p-image"}}},
    ],
    "providers": [
        {"id": "p-chat", "model": "gemini-3.8-flash"},
        {"id": "p-vision", "model": "deepseek-v4-flash"},
        {"id": "p-image", "model": "gpt-image-2"},
    ],
}

NOW = datetime(2026, 10, 25, 10, 0, tzinfo=timezone.utc)


class ModelRouteMaterialTests(unittest.TestCase):
    def test_the_same_snapshot_as_the_dashboard_card_drives_every_category(self):
        # 扩展页那张卡读的就是这份快照；回复链路直接复用，避免"页面看得到、聊天看不到"。
        host = Host(tts=Provider({"id": "fishaudio", "model": "s2.1-pro-free"}))
        with patch("astrbot_host.model_route_material.route_snapshot", return_value=SNAPSHOT):
            summary = build_summary(None, host, None, context(), NOW)
        self.assertEqual(summary["对话"], {"provider": "p-chat", "model": "gemini-3.8-flash"})
        self.assertEqual(summary["视觉理解"], {"provider": "p-vision", "model": "deepseek-v4-flash"})
        self.assertEqual(summary["生图"], {"provider": "p-image", "model": "gpt-image-2"})
        self.assertEqual(summary["语音合成"], {"provider": "fishaudio", "model": "s2.1-pro-free"})

    def test_without_a_snapshot_it_falls_back_to_host_providers(self):
        host = Host(chat=Provider({"id": "星渊哈基米", "model": "gemini-3.8-flash"}))
        with patch("astrbot_host.model_route_material.route_snapshot", return_value=None):
            summary = build_summary(None, host, None, context(), NOW)
        self.assertEqual(summary["对话"], {"provider": "星渊哈基米", "model": "gemini-3.8-flash"})
        self.assertEqual(summary["生图"]["state"], "unavailable")
        self.assertEqual(summary["视觉理解"]["state"], "unavailable")

    def test_missing_everything_is_still_an_explicit_state(self):
        with patch("astrbot_host.model_route_material.route_snapshot", return_value=None):
            summary = build_summary(None, None, None, context(), NOW)
        for title in ("对话", "语音合成", "视觉理解", "生图"):
            self.assertEqual(summary[title]["state"], "unavailable", title)

    def test_scope_umo_matches_host_convention(self):
        scope = SimpleNamespace(installation_id="inst", kind=SimpleNamespace(value="private"),
                                platform="aiocqhttp", native_scope_id="995051631")
        self.assertEqual(scope_umo(SimpleNamespace(scope=scope)), "aiocqhttp:FriendMessage:995051631")
        scope.kind = SimpleNamespace(value="group")
        scope.native_scope_id = "1097283005"
        self.assertEqual(scope_umo(SimpleNamespace(scope=scope)), "aiocqhttp:GroupMessage:1097283005")
        self.assertEqual(scope_umo(SimpleNamespace()), "")


if __name__ == "__main__":
    unittest.main()
