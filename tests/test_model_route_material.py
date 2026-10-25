from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from astrbot_host.model_route_material import build_summary, image_route_snapshot, route_snapshot, scope_umo
from companion_v2.foundation.outcome import Outcome
from companion_v2.foundation.refs import ScopeKind, ScopeRef, SubjectKind, SubjectRef


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

    def test_route_snapshot_reads_window_configuration_without_management_status(self):
        snapshot = route_snapshot(RouteApplication(), route_context())
        self.assertEqual(snapshot["tasks"][0]["fields"]["provider"]["value"], "chat")
        self.assertEqual(snapshot["providers"][0]["model"], "chat-model")

    def test_visual_route_uses_registered_screen_task_and_native_image_model(self):
        summary = build_summary(RouteApplication(), RouteHost(), None, route_context(), NOW,
                                native_tool_port=NativePort())
        self.assertEqual(summary["视觉理解"]["model"], "chat-model")
        self.assertEqual(summary["生图"]["model"], "gpt-image-1")

    def test_image_route_is_unavailable_without_an_enabled_endpoint(self):
        self.assertEqual(image_route_snapshot(None)["state"], "unavailable")

    def test_local_image_route_does_not_invent_a_model_name(self):
        summary = image_route_snapshot(LocalNativePort())
        self.assertEqual(summary, {"provider": "sd_webui"})


def route_context():
    scope = ScopeRef("install", "qq", ScopeKind.PRIVATE, "friend",
                     bot_id="bot", account_id="account", conversation_id="conversation",
                     session_id="session")
    role = SubjectRef("install", SubjectKind.BOT, "role")
    return SimpleNamespace(scope=scope,
                           role_binding=SimpleNamespace(role=role), actor=object())


class RouteProvider:
    def __init__(self, identifier, model):
        self.binding = SimpleNamespace(provider=identifier)
        self.model = model
        self.capabilities = ("text", "image")


class RouteProfile:
    def __init__(self, kind, provider="chat"):
        self.kind = kind
        self.group = "model." + kind
        self.default_provider = provider


class RouteRouter:
    def __init__(self):
        self.profiles = {
            "conversation.reply": RouteProfile("conversation.reply"),
            "screen.interpretation": RouteProfile("screen.interpretation"),
        }
        self.providers = {"chat": RouteProvider("chat", "chat-model")}

    def provider_default(self, context, profile, snapshot=None):
        return None

    def apply_provider_default(self, profile, snapshot, provider_id):
        return snapshot


class RouteConfiguration:
    def read(self, actor, *, target, group_id, observed_at):
        return Outcome.success(SimpleNamespace(fields={
            group_id + ".provider": SimpleNamespace(value="chat"),
        }))


class RouteApplication:
    def __init__(self):
        self.router = RouteRouter()
        self.configuration = RouteConfiguration()
        self.now = lambda: NOW


class RouteHost:
    def get_using_provider(self, umo=None):
        return SimpleNamespace(meta=lambda: SimpleNamespace(id="chat", model="chat-model"))

    def get_using_tts_provider(self, umo=None):
        return SimpleNamespace(meta=lambda: SimpleNamespace(id="tts", model="voice-model"))


class ImageAPI:
    def output_configuration(self):
        return {"settings": {
            "enabled": True,
            "operation_routes": {"generate": ["online:primary"]},
            "endpoints": [{"id": "primary", "enabled": True, "base_url": "https://image.example",
                           "platform": "openai", "model": "gpt-image-1"}],
        }}


class NativePort:
    def image_extension_api(self):
        return ImageAPI()


class LocalImageAPI:
    def output_configuration(self):
        return {"settings": {
            "enabled": True,
            "operation_routes": {"generate": ["sd_webui"]},
            "sd_webui": {"base_url": "http://127.0.0.1:7860"},
        }}


class LocalNativePort:
    def image_extension_api(self):
        return LocalImageAPI()


if __name__ == "__main__":
    unittest.main()
