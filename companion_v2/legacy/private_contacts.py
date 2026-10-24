"""Read the old plugin's private users, independently of the host session list."""

import hashlib
import json

from .private_memory import moment
from .private_authorization import private_authorization, merge_authorization


SOURCE_ID = "private.core_profiles.users"
GENERIC_NAMES = frozenset(("用户", "主人", "主要用户", "默认用户", "临时会话"))


def private_contacts(payload, *, v1_configuration=None):
    users = payload.get("users", {})
    if not isinstance(users, dict):
        return (), ({"reason": "users_invalid"},)
    found, rejected = {}, []
    for key, user in users.items():
        if not isinstance(user, dict):
            rejected.append({"source_key": str(key), "reason": "user_invalid"})
            continue
        capabilities = user.get("unified_profile_capabilities") or {}
        umo = next((str(user.get(field) or "") for field in
            ("umo", "bound_delivery_umo", "preferred_delivery_umo", "last_inbound_umo")
            if user.get(field)), "")
        group_only = (user.get("profile_origin") == "group_observation" or user.get("observation_only")
            or isinstance(capabilities, dict) and capabilities.get("grant_source") == "legacy_effective_migration"
            and not umo and not user.get("last_seen"))
        if group_only:
            rejected.append({"source_key": str(key), "reason": "group_observation"})
            continue
        count = user.get("private_inbound_count", 0)
        count = count if type(count) is int and count >= 0 else 0
        maintained = user.get("manual_enabled") is True
        if not maintained and not count:
            rejected.append({"source_key": str(key), "reason": "no_private_history"})
            continue
        participant = user.get("identity_subject_id")
        platform, account = user.get("identity_adapter_instance_id"), user.get("identity_bot_id")
        if (not all(type(value) is str and value.strip() for value in (participant, platform, account))
                or user.get("identity_platform_kind") not in ("onebot", "aiocqhttp")
                or umo and umo not in (f"{platform}:FriendMessage:{participant}",
                                      f"{platform}:PrivateMessage:{participant}")):
            rejected.append({"source_key": str(key), "reason": "private_identity_unverified"})
            continue
        nickname = " ".join(str(user.get("nickname") or "").split())[:64]
        if nickname in GENERIC_NAMES or nickname == participant:
            nickname = ""
        # last_seen also contains group activity in old stores. Only a dedicated
        # private timestamp can be displayed as the last private interaction.
        last_seen = moment(user.get("last_private_inbound_at"))
        item = {"source_id": SOURCE_ID, "platform": platform, "account_id": account,
            "native_account_id": participant, "nickname": nickname, "maintained": maintained,
            "message_count": count, "last_seen": last_seen or None,
            "authorization": private_authorization(key, user, v1_configuration)}
        identity = platform, account, participant
        previous = found.get(identity)
        if previous is not None:
            # Alias records are one user. Preserve the stronger factual counter,
            # while conflicting names never become trusted identity or grants.
            item["message_count"] = max(count, previous["message_count"])
            item["maintained"] |= previous["maintained"]
            item["nickname"] = previous["nickname"] or nickname
            item["authorization"] = merge_authorization(previous["authorization"], item["authorization"])
        found[identity] = item
    items = []
    for identity in sorted(found):
        item = found[identity]
        item["fingerprint"] = hashlib.sha256(json.dumps(item, ensure_ascii=False,
            sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        items.append(item)
    return tuple(items), tuple(rejected)
