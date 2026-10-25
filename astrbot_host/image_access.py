"""让已装配的生图能力真正拿得到工具。

生图模块有安装记录还不够：工具准入还要求「角色启用」（capability_role_selections）
与「当前私聊授权」（capability_authorizations）。旧版只有"装插件"一步，V2 这两步
没有任何界面会写，导致已配置接口的生图模块永远不发工具。这里在会话建立后按当前
会话的角色与私聊范围补齐这两项（幂等）。
"""

from __future__ import annotations

import logging

from companion_v2.capabilities.models import CapabilityAuthorizationState
from companion_v2.capabilities.repositories import CapabilityRepository


logger = logging.getLogger(__name__)

IMAGE_EXTENSION = "image"
IMAGE_CAPABILITIES = ("image.generate", "image.edit", "image.mask_edit")


def ensure_image_access(controller, session) -> None:
    """为当前会话的角色与私聊范围启用并授权生图能力；任何失败只记日志。"""
    runtime = getattr(controller, "runtime", None)
    context = getattr(getattr(session, "profile", None), "target", None)
    if runtime is None or context is None:
        return
    repository = CapabilityRepository(runtime)
    installed = repository.installation(extension_id=IMAGE_EXTENSION)
    if not installed.is_success:
        return
    role = context.role_binding.role
    scope = context.scope
    subject = context.actor.subject
    observed_at = controller.now()
    if not repository.require_role_enabled(
            extension_id=IMAGE_EXTENSION, role=role, bot_id=scope.bot_id).is_success:
        result = repository.set_role_enabled(
            extension_id=IMAGE_EXTENSION, role=role, bot_id=scope.bot_id, enabled=True,
            expected_revision=0, observed_at=observed_at)
        if not result.is_success:
            logger.warning("[CompanionV2] 生图能力角色启用失败 code=%s", result.failure.code)
    for capability in IMAGE_CAPABILITIES:
        if repository.authorize(extension_id=IMAGE_EXTENSION, capability_id=capability,
                                subject=subject, scope=scope).is_success:
            continue
        result = repository.set_authorization(
            extension_id=IMAGE_EXTENSION, capability_id=capability, subject=subject, scope=scope,
            state=CapabilityAuthorizationState.ACTIVE, expected_revision=0, observed_at=observed_at)
        if not result.is_success:
            logger.warning("[CompanionV2] 生图能力授权失败 capability=%s code=%s",
                           capability, result.failure.code)
