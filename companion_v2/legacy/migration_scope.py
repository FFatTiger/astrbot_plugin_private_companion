"""Decide which V1 windows and personas a role can absorb without guessing.

The old model is "personas ↔ windows"; the new one is "roles (many personas) ↔
windows". A window's identity does not change across that model, so a window
whose platform, account and native id survive untouched can be grouped under
the role automatically. Anything else is returned as ``needs_review`` with the
reason, never guessed: writing a window into the wrong person's role is the one
failure this migration must not make.

These helpers are pure: no reads, no writes, no clock. The batch endpoints and
the review page both use them so the preview and the import cannot disagree.
"""

from __future__ import annotations

from dataclasses import dataclass


# Reasons are stable codes; the page maps them to operator-facing text.
AUTO_SAME_ID = "same_platform_account_and_id"
REVIEW_GROUP_MISSING = "target_group_missing"
REVIEW_PLATFORM_DIFFERS = "target_platform_differs"
REVIEW_ACCOUNT_DIFFERS = "target_account_differs"
REVIEW_ROLE_MISSING = "target_group_role_missing"
REVIEW_AMBIGUOUS = "multiple_target_candidates"
REVIEW_PERSONA_UNASSIGNED = "persona_not_assigned_to_role"
REVIEW_PERSONA_OTHER_ROLE = "persona_assigned_to_other_role"


@dataclass(frozen=True)
class WindowMapping:
    source_id: str
    target_id: str | None
    auto: bool
    reason: str

    def document(self) -> dict:
        return {"source_id": self.source_id, "target_id": self.target_id,
                "auto": self.auto, "reason": self.reason}


def _platform(value):
    return str(value or "").strip()


def map_groups(source_groups, target_groups, *, platform_id, account_id):
    """Map V1 group ids onto V2 group targets without inventing a destination.

    ``source_groups`` are the ids the V1 persona actually has data for.
    ``target_groups`` are group targets of the current bot/account, each a
    mapping with ``group_id``, ``platform_id``, ``account_id`` and an optional
    ``has_role`` flag (a target without a role cannot receive data).
    """
    platform, account = _platform(platform_id), _platform(account_id)
    candidates = {}
    for target in target_groups or ():
        if not isinstance(target, dict):
            continue
        group_id = _platform(target.get("group_id"))
        if not group_id:
            continue
        candidates.setdefault(group_id, []).append(target)
    result = []
    for item in source_groups or ():
        source_id = _platform(item.get("source_group_id") if isinstance(item, dict) else item)
        if not source_id:
            continue
        matches = candidates.get(source_id, ())
        if not matches:
            result.append(WindowMapping(source_id, None, False, REVIEW_GROUP_MISSING))
            continue
        if len(matches) > 1:
            # Two windows can share a group number on different accounts; only
            # an exact platform+account match disambiguates them.
            matches = tuple(target for target in matches
                            if _platform(target.get("platform_id")) == platform
                            and _platform(target.get("account_id")) == account)
            if len(matches) != 1:
                result.append(WindowMapping(source_id, None, False, REVIEW_AMBIGUOUS))
                continue
        target = matches[0]
        if platform and _platform(target.get("platform_id")) != platform:
            result.append(WindowMapping(source_id, None, False, REVIEW_PLATFORM_DIFFERS))
            continue
        if account and _platform(target.get("account_id")) != account:
            result.append(WindowMapping(source_id, None, False, REVIEW_ACCOUNT_DIFFERS))
            continue
        if target.get("has_role") is False:
            result.append(WindowMapping(source_id, None, False, REVIEW_ROLE_MISSING))
            continue
        result.append(WindowMapping(source_id, _platform(target.get("target_id")) or source_id,
                                    True, AUTO_SAME_ID))
    return tuple(result)


def map_personas(source_personas, persona_roles, *, role_id):
    """Assign V1 personas to the role that already claims them, or ask.

    ``persona_roles`` is the installation's confirmed persona → role mapping.
    A source persona is automatic only when that mapping points at this role;
    an unmapped or differently-owned persona is never dragged in.
    """
    owner = _platform(role_id)
    result = []
    for item in source_personas or ():
        persona_id = _platform(item.get("persona_id") if isinstance(item, dict) else item)
        if not persona_id:
            continue
        assigned = _platform((persona_roles or {}).get(persona_id))
        if not assigned:
            result.append(WindowMapping(persona_id, None, False, REVIEW_PERSONA_UNASSIGNED))
        elif owner and assigned != owner:
            result.append(WindowMapping(persona_id, None, False, REVIEW_PERSONA_OTHER_ROLE))
        else:
            result.append(WindowMapping(persona_id, owner or assigned, True, AUTO_SAME_ID))
    return tuple(result)


def needs_review(mappings):
    return tuple(item for item in mappings if not item.auto)
