import unittest

from companion_v2.legacy.migration_scope import (
    AUTO_SAME_ID, REVIEW_ACCOUNT_DIFFERS, REVIEW_AMBIGUOUS, REVIEW_GROUP_MISSING,
    REVIEW_PERSONA_OTHER_ROLE, REVIEW_PERSONA_UNASSIGNED, REVIEW_PLATFORM_DIFFERS,
    REVIEW_ROLE_MISSING, map_groups, map_personas, needs_review,
)


def target(group_id, platform="qq-main", account="100", target_id=None, has_role=True):
    return {"target_id": target_id or "group-" + group_id, "group_id": group_id,
            "platform_id": platform, "account_id": account, "has_role": has_role}


class GroupScopeTests(unittest.TestCase):
    def test_same_platform_account_and_group_is_automatic(self):
        mapped = map_groups(["1097283005"], [target("1097283005")],
                            platform_id="qq-main", account_id="100")
        self.assertEqual(len(mapped), 1)
        self.assertTrue(mapped[0].auto)
        self.assertEqual(mapped[0].reason, AUTO_SAME_ID)
        self.assertEqual(mapped[0].target_id, "group-1097283005")

    def test_missing_target_group_is_left_for_review_not_guessed(self):
        mapped = map_groups(["555"], [target("1097283005")], platform_id="qq-main", account_id="100")
        self.assertFalse(mapped[0].auto)
        self.assertEqual(mapped[0].reason, REVIEW_GROUP_MISSING)
        self.assertIsNone(mapped[0].target_id)

    def test_platform_or_account_difference_is_reviewed(self):
        platform = map_groups(["1"], [target("1", platform="qq-other")],
                              platform_id="qq-main", account_id="100")[0]
        self.assertEqual(platform.reason, REVIEW_PLATFORM_DIFFERS)
        account = map_groups(["1"], [target("1", account="200")],
                             platform_id="qq-main", account_id="100")[0]
        self.assertEqual(account.reason, REVIEW_ACCOUNT_DIFFERS)

    def test_duplicate_group_numbers_need_an_exact_platform_account_match(self):
        targets = [target("1", account="100", target_id="a"), target("1", account="200", target_id="b")]
        exact = map_groups(["1"], targets, platform_id="qq-main", account_id="100")[0]
        self.assertTrue(exact.auto)
        self.assertEqual(exact.target_id, "a")
        ambiguous = map_groups(["1"], targets, platform_id="qq-main", account_id="999")[0]
        self.assertFalse(ambiguous.auto)
        self.assertEqual(ambiguous.reason, REVIEW_AMBIGUOUS)

    def test_target_without_a_role_cannot_receive_data(self):
        mapped = map_groups(["1"], [target("1", has_role=False)],
                            platform_id="qq-main", account_id="100")[0]
        self.assertFalse(mapped.auto)
        self.assertEqual(mapped.reason, REVIEW_ROLE_MISSING)

    def test_order_is_preserved_and_malformed_input_is_ignored(self):
        mapped = map_groups(["b", None, "", "a"], [target("a"), target("b")],
                            platform_id="qq-main", account_id="100")
        self.assertEqual([item.source_id for item in mapped], ["b", "a"])

    def test_review_list_keeps_only_unmapped_windows(self):
        mapped = map_groups(["a", "missing"], [target("a")], platform_id="qq-main", account_id="100")
        self.assertEqual([item.source_id for item in needs_review(mapped)], ["missing"])


class PersonaScopeTests(unittest.TestCase):
    def test_persona_already_owned_by_the_role_is_automatic(self):
        mapped = map_personas([{"persona_id": "astrbot"}], {"astrbot": "role-a"}, role_id="role-a")
        self.assertTrue(mapped[0].auto)
        self.assertEqual(mapped[0].target_id, "role-a")

    def test_unassigned_or_foreign_personas_are_never_dragged_in(self):
        unassigned = map_personas([{"persona_id": "x"}], {}, role_id="role-a")[0]
        self.assertFalse(unassigned.auto)
        self.assertEqual(unassigned.reason, REVIEW_PERSONA_UNASSIGNED)
        other = map_personas([{"persona_id": "x"}], {"x": "role-b"}, role_id="role-a")[0]
        self.assertFalse(other.auto)
        self.assertEqual(other.reason, REVIEW_PERSONA_OTHER_ROLE)

    def test_documents_are_json_safe(self):
        mapped = map_personas([{"persona_id": "x"}], {}, role_id="role-a")[0]
        self.assertEqual(mapped.document(), {"source_id": "x", "target_id": None,
                                             "auto": False, "reason": REVIEW_PERSONA_UNASSIGNED})


if __name__ == "__main__":
    unittest.main()
