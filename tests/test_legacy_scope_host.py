"""The role-driven scope preview must describe the same windows the importer would take."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from astrbot_host.legacy_api import LegacyMigrationWebAPI
from companion_v2.foundation.outcome import Outcome


class ScopePreviewTests(unittest.TestCase):
    def api(self):
        api = LegacyMigrationWebAPI.__new__(LegacyMigrationWebAPI)
        api.controller = SimpleNamespace(
            role_id="role-a",
            config={"multi_host": {"personas": [{"persona_id": "astrbot", "role_id": "role-a"}]}},
            web_api=SimpleNamespace(target_inventory=lambda: [
                {"scope_kind": "group", "target_id": "group-109", "group_id": "109",
                 "platform_id": "qq", "account_id": "100",
                 "roles": [{"role_id": "role-a", "legacy_group_data_api": "/api/group"}]},
                {"scope_kind": "group", "target_id": "group-915", "group_id": "915",
                 "platform_id": "qq", "account_id": "100", "roles": []},
                {"scope_kind": "group", "target_id": "group-elsewhere", "group_id": "109",
                 "platform_id": "qq", "account_id": "999", "roles": []},
                {"scope_kind": "private", "target_id": "private", "roles": []},
            ]))
        return api

    def session(self):
        scope = SimpleNamespace(installation_id="installation", platform="qq", bot_id="bot",
                                account_id="100", kind="private", native_scope_id="200")
        context = SimpleNamespace(scope=scope, role_binding=SimpleNamespace(
            role=SimpleNamespace(subject_id="role-a")))
        return SimpleNamespace(profile=SimpleNamespace(target=context),
                               application=SimpleNamespace(semantics=object()))

    def test_scope_previews_personas_groups_and_counts_without_writing(self):
        api = self.api()
        document = {"persona_sources": [{"persona_id": "astrbot", "state": "ready"},
                                        {"persona_id": "old", "state": "ready"}],
                    "group_networks": [{"source_group_id": "109", "members": 3, "edges": 2}],
                    "private_contacts": {"importable": 2, "rejected": []}}
        migration = SimpleNamespace(discover=lambda: Outcome.success(True), v1_configuration=None)
        with patch("companion_v2.legacy.data_migration.build_data_plan",
                   return_value=SimpleNamespace(document=lambda: document)):
            result = api._scope(migration, None, self.session())
        self.assertTrue(result.is_success)
        payload = result.unwrap()
        self.assertEqual(payload["counts"]["groups_auto"], 1)
        self.assertEqual(payload["groups"][0]["target_id"], "group-109")
        self.assertEqual(payload["groups"][0]["counts"]["members"], 3)
        self.assertEqual(payload["private"], {"contacts": 2, "rejected": 0})
        personas = {item["source_id"]: item for item in payload["personas"]}
        self.assertTrue(personas["astrbot"]["auto"])
        self.assertFalse(personas["old"]["auto"])
        self.assertEqual([item["kind"] for item in payload["review"]], ["persona"])
        self.assertTrue(payload["token"])

    def test_scope_rejects_unreadable_sources_instead_of_inventing_windows(self):
        api = self.api()
        migration = SimpleNamespace(discover=lambda: Outcome.failed("legacy_source_missing", "gone"),
                                    v1_configuration=None)
        result = api._scope(migration, None, self.session())
        self.assertFalse(result.is_success)
        self.assertEqual(result.failure.code, "legacy_source_missing")


if __name__ == "__main__":
    unittest.main()
