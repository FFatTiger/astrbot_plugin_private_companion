"""回答「你现在用的什么模型」时的只读材料：四类，只给名称。

数据分两处：对话与语音合成是宿主 AstrBot 当前选中的 Provider，视觉理解是 V2
自己的任务路由；生图走原生图像后端，回复链路读不到具体模型名——这一项照实
标注，不拿别的字段凑。
"""

from __future__ import annotations

from typing import Any

KEYWORDS = ("模型", "视觉", "生图", "画图", "语音", "tts", "provider")
INSTRUCTION = (
    "这是当前角色窗口实际生效的模型摘要，只列名称，不含密钥、额度或费用。"
    "被问到「你在用什么模型」时按它回答，不要回答看不到；某一项标成 unavailable 时，"
    "照实说明那一项读不到、并指到「模型与连接」页，不要拿别的项顶替，也不要猜模型名。")

VISION_KIND = "conversation.context_image_caption"


def _label(meta) -> str:
    for name in ("id", "type", "provider"):
        value = getattr(meta, name, None)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _model_of(meta) -> str:
    for name in ("model", "model_name"):
        value = getattr(meta, name, None)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _entry(provider_id: str, model: str = "") -> dict[str, Any]:
    return {"provider": provider_id, "model": model} if model else {"provider": provider_id}


def _host_provider(host_context, kind: str, umo):
    """读宿主当前选中的对话 / TTS Provider；构造和方法缺失都当作没有。"""
    if host_context is None:
        return None, None
    getter = getattr(host_context, kind, None)
    if not callable(getter):
        return None, None
    provider = getter(umo=umo)
    meta = provider.meta() if provider is not None and callable(getattr(provider, "meta", None)) else None
    return provider, meta


def route_snapshot(application, context):
    """复用「感知 → 模型能力」那张卡读的同一份快照（tasks + providers）。

    扩展页读得到是因为它走的是 ``ModelManagement.status``；回复链路没必要另开一套
    读法，直接拿同一份快照，卡片上显示什么、这里就注入什么。
    """
    try:
        from companion_v2.model_gateway.management import ModelManagement
        value = ModelManagement(application, context).status(context.actor, layer="window")
        payload = value.unwrap() if hasattr(value, "unwrap") else value
        if isinstance(payload, dict) and isinstance(payload.get("tasks"), list):
            return payload
    except Exception:
        return None
    return None


def _route_from_snapshot(snapshot, *kinds):
    if not isinstance(snapshot, dict):
        return None
    tasks = {item.get("kind"): item for item in snapshot.get("tasks") or [] if isinstance(item, dict)}
    providers = {item.get("id"): item for item in snapshot.get("providers") or [] if isinstance(item, dict)}
    for kind in kinds:
        task = tasks.get(kind)
        fields = task.get("fields") if isinstance(task, dict) else None
        provider = fields.get("provider") if isinstance(fields, dict) else None
        provider_id = provider.get("value") if isinstance(provider, dict) else None
        if isinstance(provider_id, str) and provider_id.strip():
            model = providers.get(provider_id, {}).get("model")
            return _entry(provider_id.strip(), model if isinstance(model, str) else "")
    return None


def build_summary(application, host_context, umo, context, at):
    """汇总四类模型；有快照优先用快照，没有才退回宿主 Provider。"""
    summary: dict[str, Any] = {}
    snapshot = route_snapshot(application, context)
    for title, kinds, getter, reason in (
            ("对话", ("conversation.reply",), "get_using_provider", "宿主没有返回当前对话 Provider"),
            ("视觉理解", ("vision.review", "screen.interpretation"), None, "任务路由未配置"),
            ("生图", ("image.generate",), None, "生图任务路由未配置"),
            ("语音合成", (), "get_using_tts_provider", "没有启用或没有选中 TTS Provider")):
        entry = _route_from_snapshot(snapshot, *kinds) if kinds else None
        if entry is not None:
            summary[title] = entry
            continue
        try:
            _provider, meta = _host_provider(host_context, getter, umo) if getter else (None, None)
            summary[title] = (_entry(_label(meta), _model_of(meta)) if meta is not None
                              else {"state": "unavailable", "reason": reason})
        except Exception as error:
            summary[title] = {"state": "unavailable", "reason": type(error).__name__}
    return summary


def scope_umo(context) -> str:
    """V2 的窗口还原成宿主 UMO（``平台:消息类型:会话``），读不到就返回空串。"""
    scope = getattr(context, "scope", None)
    if scope is None:
        return ""
    kind = "GroupMessage" if getattr(scope, "kind", None) is not None and scope.kind.value == "group" else "FriendMessage"
    platform = getattr(scope, "platform", "") or ""
    native = getattr(scope, "native_scope_id", "") or ""
    return f"{platform}:{kind}:{native}" if platform and native else ""


def model_route_keyword_material(application, host_context):
    from companion_v2.conversation.keyword_materials import KeywordMaterialSpec
    from companion_v2.expression.configuration import source_subject_allowed_for_context
    from companion_v2.foundation.refs import ScopeKind

    async def prepare(context, text, at):
        return {"state": "ok",
                "models": build_summary(application, host_context, scope_umo(context) or None, context, at)}

    def available(context):
        if context.scope.kind is not ScopeKind.PRIVATE:
            return False
        try:
            return bool(source_subject_allowed_for_context(application.runtime, context))
        except Exception:
            return False

    return KeywordMaterialSpec(owner="model.route", title="当前模型", instruction=INSTRUCTION,
        keywords=KEYWORDS, prepare=prepare, available=available, ttl_seconds=600)
