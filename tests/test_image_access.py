"""生图能力要同时有「装配 + 角色启用 + 私聊授权」才发工具；这里补齐后两项。"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
import unittest

from astrbot_host import image_access
from companion_v2.foundation.outcome import Outcome


class FakeRepository:
    def __init__(self, *, installed=True, role_enabled=False, authorized=False):
        self.installed = installed
        self.role_enabled = role_enabled
        self.authorized = authorized
        self.calls = []

    def installation(self, *, extension_id):
        return Outcome.success({"extension_id": extension_id}) if self.installed \
            else Outcome.failed("capability_not_installed", "missing")

    def require_role_enabled(self, *, extension_id, role, bot_id=None):
        return Outcome.success(object()) if self.role_enabled \
            else Outcome.failed("capability_role_disabled", "off")

    def set_role_enabled(self, **kwargs):
        self.calls.append(("role", kwargs))
        self.role_enabled = True
        return Outcome.success(object())

    def authorize(self, *, extension_id, capability_id, subject, scope):
        return Outcome.success(object()) if self.authorized \
            else Outcome.failed("capability_consent_missing", "missing")

    def set_authorization(self, **kwargs):
        self.calls.append(("authorization", kwargs))
        return Outcome.success(object())


def session():
    scope = SimpleNamespace(bot_id="bot-1", platform="default", native_scope_id="995051631")
    context = SimpleNamespace(role_binding=SimpleNamespace(role="role-1"), scope=scope,
                              actor=SimpleNamespace(subject="human-1"))
    return SimpleNamespace(profile=SimpleNamespace(target=context))


class ImageAccessTests(unittest.TestCase):
    def setUp(self):
        self.original = image_access.CapabilityRepository

    def tearDown(self):
        image_access.CapabilityRepository = self.original

    def test_enables_the_role_and_grants_every_image_capability_once(self):
        repository = FakeRepository()
        image_access.CapabilityRepository = lambda runtime: repository
        controller = SimpleNamespace(runtime=object(), now=lambda: datetime.now(timezone.utc))

        image_access.ensure_image_access(controller, session())

        kinds = [kind for kind, _ in repository.calls]
        self.assertEqual(kinds, ["role", "authorization", "authorization", "authorization"])
        capabilities = [kwargs["capability_id"] for kind, kwargs in repository.calls if kind == "authorization"]
        self.assertEqual(capabilities, list(image_access.IMAGE_CAPABILITIES))
        role_call = repository.calls[0][1]
        self.assertTrue(role_call["enabled"])
        self.assertEqual(role_call["bot_id"], "bot-1")

    def test_nothing_is_written_when_already_enabled_and_authorized(self):
        repository = FakeRepository(role_enabled=True, authorized=True)
        image_access.CapabilityRepository = lambda runtime: repository
        controller = SimpleNamespace(runtime=object(), now=lambda: datetime.now(timezone.utc))
        image_access.ensure_image_access(controller, session())
        self.assertEqual(repository.calls, [])

    def test_missing_installation_is_left_to_the_assembly_step(self):
        repository = FakeRepository(installed=False)
        image_access.CapabilityRepository = lambda runtime: repository
        controller = SimpleNamespace(runtime=object(), now=lambda: datetime.now(timezone.utc))
        image_access.ensure_image_access(controller, session())
        self.assertEqual(repository.calls, [])

    def test_no_session_context_is_a_no_op(self):
        repository = FakeRepository()
        image_access.CapabilityRepository = lambda runtime: repository
        controller = SimpleNamespace(runtime=object(), now=lambda: datetime.now(timezone.utc))
        image_access.ensure_image_access(controller, SimpleNamespace(profile=None))
        self.assertEqual(repository.calls, [])


if __name__ == "__main__":
    unittest.main()
