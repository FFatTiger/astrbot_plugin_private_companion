"""Natural-language image requests in AstrBot's existing core tool loop."""

from collections.abc import Mapping
import json
import logging
from zoneinfo import ZoneInfo

from companion_v2.conversation.media.generated import IMAGE_ACTIONS
from companion_v2.conversation.media.output_settings import effective_settings, is_rule_image_request, prompt_instruction
from companion_v2.references.prompts import IMAGE_REFERENCE_INSTRUCTION

from .native_extensions.request_context import set_system_instruction


logger = logging.getLogger(__name__)
_PURPOSES = {
    "image.generate": "按画面描述生成新图，包括无参考图的角色自拍、头像、穿搭照与普通场景",
    "image.edit": "依据本轮附图、已保存产物或角色参考素材改图，也可用人设参考图拍新的自拍",
    "image.mask_edit": "使用明确底图和蒙版做局部编辑",
}
_DELIVERY = (
    "生成工具返回的图片由 AstrBot 缓存供查看，生成成功与已经发给对方是两个步骤。"
    "图片符合请求时，把工具结果实际提供的缓存原路径交给 send_message_to_user，"
    "使用 messages=[{\"type\":\"image\",\"path\":\"工具返回的原路径\"}] 投递当前会话，session 留空。"
    "需要随图说话可在同一 messages 中加入 plain.text；投递成功后自然收住，避免重复发送同一张图或重复随图正文。"
    "根据工具结果说明实际进展：没有成功结果时不声称已生成或送达，unknown 时保留原操作，不换编号重做。"
    "图片错误码 host_image_limit 表示宿主本地图片处理预算超限（字节数、尺寸或张数），"
    "reference_image_limit 表示已保存参考素材超出原生图像输入上限；两者都不是服务商日额度错误。"
    "没有明确的服务商额度回执时，不要声称今天的生图额度已用完。"
    "短文字可以表达角色语气，但发起图片请求后的核心动作仍是完成图片生成与投递。"
)


def core_image_tool_contract(action, description, parameters, *, reference_limit=None):
    """Annotate only the request-local schema; leave the provider catalog intact."""
    if action not in _PURPOSES:
        return description, parameters
    description = _PURPOSES[action] + "；返回图片原件与操作回执，生成成功本身不代表已发送。"
    if action == "image.edit" and type(reference_limit) is int and reference_limit > 0:
        description += (f"当前生图路线最多接收 {reference_limit} 张参考图；达到上限时优先保留 identity，"
                        "把服装、姿态或场景要求写入 prompt，不要为同时满足多个用途盲目提交更多图片。")
    properties = parameters.get("properties", {})
    prompt = properties.get("prompt")
    if isinstance(prompt, dict):
        prompt["description"] = (
            "本次画面或修改要求，按图片调用偏好的格式书写；角色出镜时展开当前外观、穿搭与场景，自拍写明 selfie。"
        )
    if action == "image.edit" and type(reference_limit) is int and reference_limit > 0:
        for name in ("reference_ids", "reference_indices", "reference_roles"):
            reference = properties.get(name)
            if isinstance(reference, dict):
                reference["description"] = (str(reference.get("description") or "").rstrip("。")
                                             + f"；当前路线最多选择 {reference_limit} 张，优先 identity")
    return description, parameters


def core_image_tools(session, offered):
    """Keep role-disabled image tools out of this request's private ToolSet."""
    present = [item.spec.action for item in offered if item.spec.action in IMAGE_ACTIONS]
    if not present:
        filtered = []
        diagnostics = getattr(getattr(session.application, "tools", None), "catalog_for_with_diagnostics", None)
        if callable(diagnostics):
            try:
                _available, filtered = diagnostics(session.context)
                filtered = [item for item in filtered if item.get("action") in IMAGE_ACTIONS]
            except Exception:
                filtered = []
        logger.info("[CompanionV2][image] stage=catalog offered=%s image_actions=0 filtered=%s",
                    len(offered), filtered[:4])
        return offered, None
    try:
        values = effective_settings(session.application.runtime, session.context)
    except Exception as error:
        logger.warning("[CompanionV2] 核心生图偏好暂不可用 error_type=%s", type(error).__name__)
        return tuple(item for item in offered if item.spec.action not in IMAGE_ACTIONS), None
    if not values["allow_user_requests"] or values["trigger_mode"] == "off":
        logger.info("[CompanionV2][image] stage=policy allow=%s mode=%s actions=%s kept=0",
                    values["allow_user_requests"], values["trigger_mode"], present)
        return tuple(item for item in offered if item.spec.action not in IMAGE_ACTIONS), None
    if values["trigger_mode"] == "rules":
        state = getattr(session, "state", None)
        command = state.get("functional_command") if isinstance(state, Mapping) else None
        command_intent = getattr(command, "intent", None)
        if command_intent not in {"image_generate", "image_edit"}:
            prepared = getattr(session, "prepared", None)
            original = prepared.get("native_input") if isinstance(prepared, Mapping) else None
            text = getattr(original, "text", "")
            matched = is_rule_image_request(text, has_images=bool(getattr(original, "images", ())))
            if not matched:
                logger.info("[CompanionV2][image] stage=rules matched=0 text_chars=%s actions=%s kept=0",
                            len(text or ""), present)
                return tuple(item for item in offered if item.spec.action not in IMAGE_ACTIONS), None
    logger.info("[CompanionV2][image] stage=keep mode=%s actions=%s", values["trigger_mode"], present)
    return offered, values


def _reference_date(session):
    prepared = session.prepared
    original = prepared.get("native_input") if isinstance(prepared, Mapping) else None
    at = getattr(original, "at", None) or session.application.tasks.now()
    timezone_name = getattr(session.application.messages, "timezone_name", "Asia/Shanghai")
    snapshot = prepared.get("perception_context") if isinstance(prepared, Mapping) else None
    if isinstance(snapshot, str):
        try:
            snapshot = json.loads(snapshot)
        except ValueError:
            snapshot = None
    clock = snapshot.get("current_local_time") if isinstance(snapshot, Mapping) else None
    if isinstance(clock, Mapping):
        timezone_name = clock.get("timezone") or timezone_name
    return at.astimezone(ZoneInfo(timezone_name)).date().isoformat()


def inject_core_image_prompt(session, request, offered, values):
    """Keep configuration in system and role reference data in the turn suffix."""
    session.state.pop("_image_reference_material", None)
    actions = tuple(item.spec.action for item in offered if item.spec.action in IMAGE_ACTIONS)
    if not actions or values is None:
        set_system_instruction(request, "image_output")
        return
    from .core_reply_tools import native_tool_name

    reference_limit = None
    if "image.edit" in actions:
        try:
            from .model_route_material import image_edit_reference_limit
            reference_limit = image_edit_reference_limit(
                getattr(session.application, "native_tool_port", None))
        except Exception:
            reference_limit = None

    descriptions = "\n".join(native_tool_name(action) + "：" + _PURPOSES[action] for action in actions)
    rule_hint = (
        "本轮用户文本已命中图片请求规则。若这句话确实是在要新图、自拍或改图，"
        "直接调用对应图片工具，不要只回一段描述或反复确认。"
        if values["trigger_mode"] == "rules" else ""
    )
    instruction = "\n".join(part for part in (
        prompt_instruction(values), rule_hint,
        "本轮图片工具：\n" + descriptions, _DELIVERY) if part)
    if reference_limit is not None:
        instruction += (f"\n当前生图改图路线最多接收 {reference_limit} 张参考图。"
                        "需要保持角色身份时优先选择 identity；如果上限不足，不要自动同时提交身份图和穿搭图，"
                        "将其余服装、姿态或场景要求写进 prompt。")
    if "image.edit" in actions:
        instruction += (
            "\n本轮参考素材位于 companion_v2_context.image_reference_material。"
            "角色自拍有可用身份锚点时，可通过改图工具的 reference_ids 与 reference_roles=[\"identity\"] 保持人物一致；"
            "仅采用已存素材时用 reference_indices=[]，避免带入本轮无关附图。"
            "没有可用身份图时，依照已知角色外观使用生成工具；只有改图工具可用且没有任何参考图时，"
            "简短说明需要图片参考，不猜素材 ID。\n" + IMAGE_REFERENCE_INSTRUCTION
        )
        owner = getattr(session.application.messages, "reference_materials", None)
        if owner is not None:
            try:
                material = owner.prompt_material(session.context, local_date=_reference_date(session))
                if isinstance(material, dict) and (material.get("references") or material.get("wardrobe")):
                    session.state["_image_reference_material"] = material
            except Exception as error:
                logger.warning("[CompanionV2] 核心生图参考资料暂不可用 error_type=%s", type(error).__name__)
    set_system_instruction(request, "image_output", instruction)
