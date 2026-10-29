# 新 UI 后端只读聚合

对应 `docs/ui-redesign/IA.md` 第 5 节第 1–4 项。第 5 项（工作区 iframe 白名单）不做。

鉴权、错误体与现有 Dashboard API 相同：未登录返回 `dashboard_identity_required`；成功是 `{status:"ok", data:{...}}`；失败是 HTTP 200 加 `{status:"error", data:{code, reason}}`。读不到的能力字段是 `null`，不按平台名猜测。保存群目标的请求体没有变。

## 1. GET `/astrbot_plugin_private_companion/host/capabilities`

查询参数必须且只能是 `target_id`、`role_id`。目标或角色不存在时分别返回 `host_target_unknown`、`host_role_unknown`。

`message_components` 只复用现有发送器分流：`aiocqhttp` 走能戳一戳的 OneBot 发送器；`qq_official` / `qq_official_webhook` 走会话发送器，该发送器会丢掉 poke、仍携带 face / quote / mention。平台名缺失或不在这份分流里时，四项都是 `null`。`wechat_helper` 当前不在分流里，所以是 `null`，不是 `false`。

`presence` 复用角色状态里的 `presentation_diagnostics`。群目标没有事件就建不出上下文，返回 `null`。`screen` / `reality` 复用集成清单里同 `capability_id` 的装配行；清单没有该能力时是 `null`，未装配是 `assembled:false`。`voice` 读宿主 `voice_reply_enabled` 与策略里的 `provider_id`。`semantic.configured` 表示语义设置里有显式字段。`model.configured` 表示某个任务字段的 `explicit` 为真。`search_consumers` 只含已保存的搜索 provider 和语义设置里的 `slang_web_search_enabled`。

```json
{
  "status": "ok",
  "data": {
    "target_id": "first",
    "role_id": "role-a",
    "platform_id": "qq-main",
    "platform_name": "aiocqhttp",
    "message_components": {"face": true, "poke": true, "quote": true, "mention": true},
    "presence": null,
    "screen": [{"extension_id": "companion.screen.native", "assembled": false, "desired_state": null, "integration_state": "unassembled"}],
    "reality": null,
    "search_consumers": {"provider_configured": false, "provider_id": null, "slang_web_search_enabled": false},
    "voice": {"configured": false, "enabled": false, "provider_id": null},
    "semantic": {"configured": false, "enabled": null, "explicit_fields": []},
    "model": {"configured": false, "tasks": []}
  }
}
```

## 2. GET `/astrbot_plugin_private_companion/page/overview`

无查询参数。先走 `page/targets` 的同一套登录与目录校验，失败原样返回。成功时把现有 setup 文档、host 状态、性能标记和私聊角色状态合成一份。`today` 只含带 `state_api` 的私聊角色；状态读不到时该行的 `state` 与 `occurrences` 为 `null`。群角色不在这里，因为群状态上下文必须有真实发言人。

```json
{
  "status": "ok",
  "data": {
    "installation_id": "shared-test",
    "operator_id": "dashboard:admin",
    "operator_name": "admin",
    "setup": {"step": "binding", "ready": false, "prepared": true},
    "host": {"state": "running", "accepting": true, "failure_code": null, "enabled": true},
    "performance": {"enabled": false, "mode": "standard"},
    "targets": [],
    "today": [{"target_id": "first", "role_id": "role-a", "state": {"state": "current", "revision": 1}, "occurrences": []}]
  }
}
```

`targets` 与 `GET /page/targets` 的 `targets` 相同。

## 3. GET `/astrbot_plugin_private_companion/page/targets` 的群名

群目标的 `display_name` / `group_name` 先用 OneBot 显示名查询的结果；没有时用原生会话目录或会话观测里的群名；仍没有时回退 `group_id`。私聊字段不变。

```json
{"target_id": "named", "scope_kind": "group", "group_id": "300", "display_name": "读书群", "group_name": "读书群"}
```

没有观测名时：`{"group_id": "301", "display_name": "301", "group_name": "301"}`。

## 4. GET `/astrbot_plugin_private_companion/accounts` 的未受管群

`data.discovered.groups` 新增。原生目录里的群都会出现，包括还没保存成目标的群。`managed` 表示已经在 `multi_host.group_targets` 里；`available_for_target` 表示它是原生群、可以交给现有保存接口。`POST /accounts` 与 `POST /accounts/group-target` 的请求字段没有增加，仍不接受 `display_name`。

```json
{"group_id": "300", "platform_id": "qq-main", "account_id": "100", "bot_id": "bot-a", "managed": false, "available_for_target": true}
```

## 改动文件

- `astrbot_host/capabilities_api.py`：新增 capabilities。
- `astrbot_host/group_directory.py`：从原生目录和观测记录取群名。
- `astrbot_host/multi_api.py`：注册 capabilities。
- `astrbot_host/page_api.py`：群名回填与 overview。
- `astrbot_host/session_topology.py`：`managed_only` 可显式关闭；默认仍是只列受管窗口。
- `astrbot_host/setup_api.py`：账号发现改为包含未受管原生群。
- `astrbot_host/account_session_api.py`：发现结果附加 `groups`。
- `tests/test_page_targets_api.py`、`tests/test_session_topology.py`：四个口子的最小断言。

## 测试

按要求没有跑全量 pytest。相关文件用改动前的 stash 对照过。

改前：`tests/test_page_targets_api.py::SinglePageTests::test_sdk_discovers_same_voxel_shell_and_injects_scoped_bridge` 失败，原因是工作区里另有 `pages/陪伴控制台/`，页面发现多出一个「陪伴控制台」。与这四个接口无关。

改后同一条仍然失败，失败内容相同。其余相关结果：

- `tests/test_page_targets_api.py`、`tests/test_session_topology.py`、`tests/test_account_target_sync.py`（排除上面那条）：61 passed。
- `tests/test_platform_display_names.py`、`tests/test_multi_target_install_apis.py`、`tests/test_group_reply_host_api.py`、`tests/test_group_memory_host_api.py`：60 passed。
