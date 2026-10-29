"""Native group labels for navigation. Names stay display-only."""

from companion_v2.adapters.astrbot.native import account_number, route_id

from .display_names import _identifier, _label, _name


def _group_route(umo):
    """Return platform and group id from a native session origin.

    This is the group half of session_topology.session_route. It stays local
    so the directory helper can be imported while that module is loading.
    """
    if not isinstance(umo, str):
        return None
    parts = umo.split(":")
    if len(parts) != 3 or parts[1] != "GroupMessage" or not parts[0]:
        return None
    platform, session = parts[0], parts[2]
    ids = session.split("_")
    if len(ids) in (1, 2):
        try:
            for value in ids:
                account_number(value)
            return platform, ids[-1]
        except ValueError:
            pass
    try:
        return platform, route_id(session)
    except ValueError:
        return None


def group_label(row):
    """Return a human group label, never a bare native id."""
    return _label(row.get("group_name")) or _label(row.get("display_name"))


async def native_group_names(controller):
    """Read group labels already present in the native session directory.

    The directory is the same one account discovery reads. A missing or
    unreadable directory yields no names; callers keep the group id.
    """
    topology = getattr(controller, "session_topology", None)
    if topology is None:
        return {}
    rows = []
    inventory = getattr(topology, "inventory", None)
    if callable(inventory):
        try:
            listed = await inventory(scope_kind="group", managed_only=False)
        except Exception:
            listed = []
        if isinstance(listed, list):
            rows.extend(listed)
    # A group seen on a native event keeps its name in the observation file
    # even when that session has no conversation window yet.
    reader = getattr(topology, "_observed", None)
    if callable(reader):
        try:
            observed = reader()
        except Exception:
            observed = {}
        for row in observed.values() if isinstance(observed, dict) else ():
            if not isinstance(row, dict):
                continue
            route = _group_route(row.get("unified_msg_origin"))
            if route is None:
                continue
            rows.append({"platform_id": route[0], "account_id": row.get("account_id"), "group_id": route[1],
                         "group_name": row.get("group_name"), "display_name": row.get("display_name")})
    names = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = group_label(row)
        if not label:
            continue
        names[(row.get("platform_id"), row.get("group_id"))] = label
        account = row.get("account_id")
        if account:
            names[(row.get("platform_id"), account, row.get("group_id"))] = label
    return names


async def apply_native_group_names(controller, targets):
    """Fill group display names from the native directory, then the group id.

    OneBot names already applied by the platform lookup are kept. A WeChat
    room id is not a name, so it is only the fallback when no native label
    exists.
    """
    names = await native_group_names(controller)
    filled = []
    for target in targets:
        row = dict(target)
        if row.get("scope_kind") != "group" and not row.get("group_id"):
            filled.append(row)
            continue
        current = group_label(row)
        native = (names.get((row.get("platform_id"), row.get("account_id"), row.get("group_id")))
                  or names.get((row.get("platform_id"), row.get("group_id")))
                  or "")
        label = current or native or _name(row.get("group_id"))
        if label and _identifier(label):
            label = native or _name(row.get("group_id"))
        row["display_name"] = label
        row["group_name"] = label or _name(row.get("group_name"))
        filled.append(row)
    return filled
