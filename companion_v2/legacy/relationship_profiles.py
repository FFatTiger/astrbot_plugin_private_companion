"""Read the old plugin's per-person relationship details without guessing identity.

V1 kept exactly three pieces of operator-facing relationship data on each user
record: ``nickname``, ``persona_relationship.level`` and
``persona_relationship.note``. It never recorded gender, birthday, occupation or
an interaction style, so this module maps only those three fields and leaves the
rest of the V2 profile empty for the operator to fill in later.

The mapping is read-only. Identity fields are reused from the private-contact
converter (same platform, same bot account, same native user id, same supported
platform kind and matching private UMO); when they are missing or inconsistent
the record still appears with an ``issues`` entry so the migration preview can
say "needs confirmation" instead of guessing a subject.
"""

from .private_contacts import GENERIC_NAMES, verified_private_identity


SOURCE_ID = "private.core_profiles.users"
MAPPED_FIELDS = {
    "nickname": "default_nickname",
    "persona_relationship.level": "role_relation",
    "persona_relationship.note": "extra",
}


def _text(value):
    if not isinstance(value, str):
        return ""
    return value.replace("\r\n", "\n").replace("\r", "\n").strip()


def _label(value):
    return " ".join(_text(value).split())


def _mapped_values(user):
    """Return (values, source_fields, warnings) for the three relationship fields."""
    values, source_fields, warnings = {}, [], []
    participant = user.get("identity_subject_id")
    nickname = _label(user.get("nickname"))
    if nickname and (nickname in GENERIC_NAMES or nickname == participant):
        nickname = ""
    parsed = {"nickname": nickname}
    raw_relation = user.get("persona_relationship")
    relation = raw_relation if isinstance(raw_relation, dict) else {}
    if raw_relation not in (None, {}) and not isinstance(raw_relation, dict):
        warnings.append("persona_relationship_invalid")
    parsed["persona_relationship.level"] = _label(relation.get("level"))
    parsed["persona_relationship.note"] = _text(relation.get("note"))
    for source, name in MAPPED_FIELDS.items():
        value = parsed[source]
        if not value:
            continue
        values[name] = value
        source_fields.append(source)
    return values, source_fields, warnings


def _item(user_id, values, source_fields, warnings=()):
    return {
        "source_id": SOURCE_ID,
        "user_id": user_id,
        "platform": None,
        "account_id": None,
        "native_account_id": None,
        "nickname": values.get("default_nickname", ""),
        "role_relation": values.get("role_relation", ""),
        "extra": values.get("extra", ""),
        "source_fields": list(source_fields),
        "warnings": list(warnings),
        "issues": [],
    }


def _merge(previous, current):
    """Alias records are one person: keep the first non-empty value, never invent one."""
    for name in ("nickname", "role_relation", "extra"):
        if not previous[name]:
            previous[name] = current[name]
    previous["source_fields"] = list(dict.fromkeys((*previous["source_fields"], *current["source_fields"])))
    previous["warnings"] = list(dict.fromkeys((*previous["warnings"], *current["warnings"])))
    previous["user_ids"] = sorted({*previous.get("user_ids", [previous["user_id"]]),
                                   current["user_id"]})
    previous["user_id"] = previous["user_ids"][0]


def relationship_profiles(payload):
    """Map V1 ``users`` into V2 relationship-profile candidates and rejected rows."""
    users = payload.get("users", {}) if isinstance(payload, dict) else {}
    if not isinstance(users, dict):
        return (), ({"reason": "users_invalid"},)
    by_identity, unverified, rejected = {}, [], []
    for key, user in users.items():
        if not isinstance(user, dict):
            rejected.append({"source_key": str(key), "reason": "user_invalid"})
            continue
        values, source_fields, warnings = _mapped_values(user)
        if not values:
            rejected.append({"source_key": str(key), "reason": "relationship_fields_empty"})
            continue
        identity = verified_private_identity(user)
        if identity is None:
            item = _item(str(key), values, source_fields, warnings)
            item["issues"] = ["private_identity_unverified"]
            unverified.append(item)
            continue
        platform, account, participant = identity
        item = _item(str(key), values, source_fields, warnings)
        item.update({"platform": platform, "account_id": account,
                     "native_account_id": participant})
        previous = by_identity.get(identity)
        if previous is None:
            by_identity[identity] = item
        else:
            _merge(previous, item)
    items = sorted(by_identity.values(),
                   key=lambda item: (item["platform"], item["account_id"], item["native_account_id"]))
    items.extend(sorted(unverified, key=lambda item: item["user_id"]))
    return tuple(items), tuple(rejected)
