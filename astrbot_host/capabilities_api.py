"""Read-only capability snapshot for one target and role.

Every field is copied from a state the host already computed. A missing
source stays null; this route does not infer a platform feature from its name.
"""

from astrbot.api.web import request
from companion_v2.execution.models import TaskError
from companion_v2.foundation.outcome import Outcome

from .management_identity import dashboard_operator


PREFIX = "/astrbot_plugin_private_companion/host"


class HostCapabilitiesWebAPI:
    def __init__(self, controller):
        self.controller = controller

    def routes(self):
        return [(PREFIX + "/capabilities", self.capabilities, ["GET"],
                 "Read existing platform and extension capabilities for one target")]

    async def capabilities(self):
        from .web_api import outcome_response
        try:
            self._require_admin()
            query = request.query
            if set(query.keys()) != {"target_id", "role_id"} or any(
                    len(query.getlist(key)) != 1 for key in query.keys()):
                raise TaskError("host_request_invalid", "select exactly one configured target and role")
            target_id, role_id = query["target_id"], query["role_id"]
            controller = self.controller
            async with controller._control_lock:
                if controller._terminated:
                    raise TaskError("staging_host_terminated", "plugin is stopped")
                settings = controller.settings
                runtime = controller.runtime
                if settings is None or runtime is None:
                    raise TaskError("staging_not_initialized", "load the explicit V2 profile first")
                target = self._target(settings, target_id, role_id)
                operator = dashboard_operator(runtime, request.username, at=controller.now())
                platform_name = self._platform_name(controller, target)
                sender = self._sender_flags(controller, platform_name)
                extensions = self._extensions(controller)
                return outcome_response(Outcome.success({
                    "target_id": target_id,
                    "role_id": role_id,
                    "platform_id": target.platform_id,
                    "platform_name": platform_name,
                    "message_components": {
                        "face": sender.get("face"),
                        "poke": sender.get("poke"),
                        "quote": sender.get("quote"),
                        "mention": sender.get("mention"),
                    },
                    "presence": self._presence(controller, target, role_id, operator),
                    "screen": self._extension_grant(extensions, "screen"),
                    "reality": self._extension_grant(extensions, "reality"),
                    "search_consumers": self._search(controller),
                    "voice": self._voice(controller),
                    "semantic": self._semantic(controller),
                    "model": self._model(controller, target, role_id, operator),
                }))
        except TaskError as error:
            return outcome_response(Outcome.failed(error.code, str(error)))

    @staticmethod
    def _require_admin():
        username = request.username
        if type(username) is not str or not username.strip() or username.startswith("api_key:"):
            raise TaskError("dashboard_identity_required", "sign in to the AstrBot Dashboard")

    @staticmethod
    def _target(settings, target_id, role_id):
        finder = getattr(settings, "target", None)
        try:
            target = finder(target_id) if callable(finder) else None
        except Exception:
            target = None
        if target is None:
            raise TaskError("host_target_unknown", "select a configured target")
        roles = {item.role_id for item in getattr(settings, "personas", ()) if item.bot_id == target.bot_id}
        if role_id not in roles:
            raise TaskError("host_role_unknown", "select a role mapped to this target")
        return target

    @staticmethod
    def _platform_name(controller, target):
        accounts = getattr(getattr(controller, "session_topology", None), "accounts", None)
        if not callable(accounts):
            return None
        try:
            rows = accounts()
        except Exception:
            return None
        if not rows:
            return None
        row = next((item for item in rows if item.get("platform_id") == target.platform_id
                    and item.get("account_id") == target.account_id), None)
        name = row.get("platform_name") if isinstance(row, dict) else None
        return name or None

    @staticmethod
    def _sender_flags(controller, platform_name):
        """Copy the sender the live route already selects.

        OneBot uses the poke-capable sender. Every other known platform uses
        the session sender, which records that poke is unsupported and still
        carries Face, quote and mention in its component plan. An unknown
        platform name stays null instead of being treated as either sender.
        """
        if not platform_name:
            return {}
        if platform_name == "aiocqhttp":
            return {"face": True, "poke": True, "quote": True, "mention": True}
        from companion_v2.adapters.astrbot.native import supported_platform_name
        if not supported_platform_name(platform_name):
            return {}
        return {"face": True, "poke": False, "quote": True, "mention": True}

    @staticmethod
    def _extensions(controller):
        registry = getattr(controller, "integration", None)
        snapshot = getattr(registry, "snapshot", None)
        if not callable(snapshot):
            return None
        try:
            session = controller.session or controller.last_session
            document = snapshot(host_status=controller.status(),
                                application=session.application if session else None,
                                terminated=controller._terminated,
                                native_extensions=getattr(controller, "native_extensions", None))
        except Exception:
            return None
        return document.get("extensions") if isinstance(document, dict) else None

    @staticmethod
    def _extension_grant(extensions, capability_id):
        if not isinstance(extensions, list):
            return None
        rows = [item for item in extensions if isinstance(item, dict)
                and item.get("capability_id") == capability_id]
        if not rows:
            return None
        return [{"extension_id": item.get("extension_id"),
                 "assembled": item.get("assembled"),
                 "desired_state": item.get("desired_state"),
                 "integration_state": item.get("integration_state")} for item in rows]

    @staticmethod
    def _presence(controller, target, role_id, operator):
        session = controller.session or controller.last_session
        authority = getattr(controller, "authority", None)
        context_for = getattr(authority, "context", None)
        if session is None or not callable(context_for):
            return None
        try:
            from companion_v2.role_work.state.management import StateManagement
            context = context_for(target.target_id, role_id)
        except TaskError:
            return None
        except Exception:
            return None
        try:
            status = StateManagement(session.application, context).status(operator)
            diagnostics = status.unwrap().get("presentation_diagnostics") if status.is_success else None
        except Exception:
            return None
        if not isinstance(diagnostics, dict):
            return None
        return {"typing": diagnostics.get("typing"),
                "custom_status": diagnostics.get("custom_status"),
                "online_status": diagnostics.get("online_status"),
                "port": diagnostics.get("port")}

    @staticmethod
    def _voice(controller):
        settings = controller.settings
        common = getattr(settings, "common", settings)
        enabled = getattr(common, "voice_reply_enabled", None)
        if type(enabled) is not bool:
            return None
        policy = getattr(common, "voice_reply_policy", None)
        provider = getattr(policy, "provider_id", None) if policy is not None else None
        return {"configured": bool(enabled or provider),
                "enabled": enabled,
                "provider_id": provider or None}

    @staticmethod
    def _semantic(controller):
        session = controller.session or controller.last_session
        store = getattr(getattr(getattr(session, "application", None), "semantics", None), "store", None)
        snapshot = getattr(store, "configuration_snapshot", None)
        if not callable(snapshot):
            return None
        try:
            document = snapshot()
        except Exception:
            return None
        explicit = document.get("explicit") if isinstance(document, dict) else None
        values = document.get("values") if isinstance(document, dict) else None
        if not isinstance(explicit, frozenset) or not isinstance(values, dict):
            return None
        return {"configured": bool(explicit),
                "enabled": values.get("enabled") if "enabled" in explicit else None,
                "explicit_fields": sorted(explicit)}

    @staticmethod
    def _model(controller, target, role_id, operator):
        session = controller.session or controller.last_session
        authority = getattr(controller, "authority", None)
        context_for = getattr(authority, "context", None)
        if session is None or not callable(context_for):
            return None
        try:
            context = context_for(target.target_id, role_id)
        except TaskError:
            return None
        except Exception:
            return None
        try:
            from companion_v2.model_gateway.management import ModelManagement
            status = ModelManagement(session.application, context).status(operator)
            tasks = status.unwrap().get("tasks") if status.is_success else None
        except Exception:
            return None
        if not isinstance(tasks, list):
            return None
        configured = []
        for task in tasks:
            fields = task.get("fields") if isinstance(task, dict) else None
            if not isinstance(fields, dict):
                continue
            explicit = sorted(name for name, field in fields.items()
                              if isinstance(field, dict) and field.get("explicit") is True)
            if explicit:
                configured.append({"kind": task.get("kind"), "fields": explicit})
        return {"configured": bool(configured), "tasks": configured}

    @staticmethod
    def _search(controller):
        from companion_v2.proactive.search_settings import SearchSettingsStore
        root = getattr(getattr(controller, "runtime", None), "data_root", None)
        if root is None:
            return None
        try:
            provider_id = SearchSettingsStore(root).selected_provider_id()
        except Exception:
            return None
        session = controller.session or controller.last_session
        values = None
        try:
            values = session.application.semantics.store.settings()
        except Exception:
            values = None
        slang = values.get("slang_web_search_enabled") if isinstance(values, dict) else None
        return {"provider_configured": bool(provider_id) and provider_id != "invalid-search-provider-selection",
                "provider_id": provider_id or None,
                "slang_web_search_enabled": slang if type(slang) is bool else None}
