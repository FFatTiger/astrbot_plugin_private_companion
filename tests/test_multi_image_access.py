"""The real multi-role admission exposes native Image tools without manual grants."""

import json
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch

from astrbot_host.core_reply import prepare_core_reply_event
from astrbot_host.core_reply_tools import close_core_reply_tools, inject_core_reply_tools, native_tool_name
from astrbot_host.native_extensions.image_native.adapter import NativeImageProvider
from astrbot_host.native_extensions.image_native.owner import NativeImageOwner
from astrbot_host.native_extensions.image_native.types import BackendResult
from companion_v2.capabilities import CapabilityAuthorizationState, CapabilityRepository
from companion_v2.execution.models import TaskContext
from companion_v2.product import PRODUCT_VERSION
from tests.multi_host_support import MultiFixture, multi_config
from tests.native_image_support import ImageBackend
from tests.native_internal_support import internal_lease


class MultiImageAccessTests(MultiFixture, unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        super().setUp()
        self.backend = ImageBackend(BackendResult)
        self.owner = NativeImageOwner(self.root / "native-image", self.backend)
        self.addAsyncCleanup(self.owner.close)
        provider = NativeImageProvider(self.owner, package_version=PRODUCT_VERSION, artifact_hash="image-fixture")
        self.factory = patch("astrbot_host.multi_controller.create_bundled_extensions",
                             return_value=((internal_lease(provider),), ()))
        self.factory.start()
        self.addCleanup(self.factory.stop)

    async def image_host(self):
        app = await self.start_host()
        await self.controller.native_extensions._start_task
        self.addAsyncCleanup(close_core_reply_tools, app)
        return app

    async def prepare(self, target="first", identifier="image-event"):
        event = self.event(target, identifier, "帮我画张图片")
        session = self.controller.session
        plan = (await session.prepare_core_reply_context(event, self.controller.settings.target(target))).unwrap()
        prepared = {"context": plan.context, "event_id": plan.captured.event_id, "native_input": plan.captured}

        async def authorize(state):
            return session.application.tasks.check_context_access(
                state["context"], action="conversation.reply", observed_at=self.clock.now())

        prepare_core_reply_event(event, prepared, authorize=authorize)
        request = NS(func_tool=None, system_prompt="原人格")
        inject_core_reply_tools(event, request, application=session.application)
        return plan.context, event, request

    def assert_images(self, request):
        for action in ("image.generate", "image.edit", "image.mask_edit"):
            self.assertIsNotNone(request.func_tool.get_tool(native_tool_name(action)), action)

    async def test_first_admitted_context_exposes_and_executes_native_image_tool(self):
        app = await self.image_host()
        self.assertFalse(hasattr(self.controller.session, "profile"))
        context, event, request = await self.prepare()
        self.assert_images(request)
        self.assertEqual(context.actor.policy_revision, self.controller.authority.identities.revision)
        from astrbot.core.agent.message import Message, ToolCall
        call = ToolCall(id="image-call", function=ToolCall.FunctionBody(
            name=native_tool_name("image.generate"), arguments=json.dumps({"prompt": "红色"})))
        wrapper = NS(context=NS(event=event), messages=[Message(role="assistant", tool_calls=[call])])
        result = await request.func_tool.get_tool(native_tool_name("image.generate")).call(wrapper, prompt="红色")
        self.assertEqual(json.loads(result.content[0].text)["state"], "succeeded")
        self.assertEqual(len(self.backend.calls), 1)
        actual = TaskContext.restore(self.backend.calls[0][0].envelope["context"])
        self.assertEqual(actual, context)
        self.assertEqual(app.runtime.read_one("SELECT COUNT(*) n FROM capability_authorizations", ())["n"], 3)

    async def test_role_and_bot_switch_receive_their_own_default_records(self):
        app = await self.image_host()
        first, _, request = await self.prepare()
        self.assert_images(request)
        self.window_personas["qq-main:FriendMessage:200"] = "second"
        second, _, request = await self.prepare(identifier="second-role")
        self.assert_images(request)
        self.assertNotEqual(first.role_binding.role, second.role_binding.role)
        other, _, request = await self.prepare("second", "second-bot")
        self.assert_images(request)
        self.assertNotEqual(first.scope.bot_id, other.scope.bot_id)
        self.assertEqual(app.runtime.read_one("SELECT COUNT(*) n FROM capability_role_selections", ())["n"], 3)
        self.assertEqual(app.runtime.read_one("SELECT COUNT(*) n FROM capability_authorizations", ())["n"], 9)

    async def test_explicit_disable_and_revocation_remain_missing_from_model_catalog(self):
        app = await self.image_host()
        context, _, _ = await self.prepare()
        repository = CapabilityRepository(app.runtime)
        repository.set_authorization(extension_id="image", capability_id="image.generate",
            subject=context.actor.subject, scope=context.scope, state=CapabilityAuthorizationState.REVOKED,
            expected_revision=1, observed_at=self.clock.now()).unwrap()
        _, _, request = await self.prepare(identifier="after-revoke")
        self.assertIsNone(request.func_tool.get_tool(native_tool_name("image.generate")))
        self.assertIsNotNone(request.func_tool.get_tool(native_tool_name("image.edit")))
        repository.set_role_enabled(extension_id="image", role=context.role_binding.role,
            bot_id=context.scope.bot_id, enabled=False, expected_revision=1, observed_at=self.clock.now()).unwrap()
        _, _, request = await self.prepare(identifier="after-disable")
        for action in ("image.generate", "image.edit", "image.mask_edit"):
            self.assertIsNone(request.func_tool.get_tool(native_tool_name(action)))
        self.assertFalse(self.backend.calls)

    async def test_wildcard_user_is_provisioned_only_after_real_admission(self):
        config = multi_config()
        config["multi_host"]["targets"][0]["participant_id"] = "*"
        self.controller = self.make_controller(config)
        app = await self.image_host()
        self.assertIsNone(app.runtime.read_one(
            "SELECT 1 FROM capability_authorizations WHERE account_id = ?", ("100",)))
        from tests.native_adapter_support import FakeEvent
        event = FakeEvent(NS(platform=self.native.platforms["qq-main"]), event_id="new-user",
                          sender="201", login="100", text="帮我画图")
        event.created_at = self.clock.now().timestamp()
        self.window_personas[event.unified_msg_origin] = "original"
        target = self.controller.target_for_event(event)
        plan = (await self.controller.session.prepare_core_reply_context(event, target)).unwrap()
        catalog = app.tools.external.catalog_for(plan.context)
        self.assertEqual({tool.action for tool in catalog if tool.action.startswith("image.")},
                         {"image.generate", "image.edit", "image.mask_edit"})
        self.assertEqual(plan.context.scope.native_scope_id, "201")

    async def test_revoked_invocation_grant_is_not_replaced_by_next_admission(self):
        app = await self.image_host()
        context, _, request = await self.prepare()
        self.assert_images(request)
        identities = self.controller.session.authority.identities
        grant = next(grant for grant in identities.grants_for_subject(context.actor.subject)
                     if grant.scope == context.scope and grant.capability == "extension.tool.invoke")
        identities.revoke_grant(grant.grant_id, revoked_at=self.clock.now(),
                                expected_revision=identities.revision)
        _, _, request = await self.prepare(identifier="after-tool-revoke")
        for action in ("image.generate", "image.edit", "image.mask_edit"):
            self.assertIsNone(request.func_tool.get_tool(native_tool_name(action)))
        self.assertFalse(self.backend.calls)
