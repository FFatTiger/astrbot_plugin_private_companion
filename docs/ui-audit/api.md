# 陪伴插件 UI 重构 · 后端 API 契约总目录（api 区域审计）

> 审计对象：`/home/claude/Documents/program/astrbot_plugin_private_companion`，分支 `wechat`，HEAD `2e29e3f`（上游 `menglimi/astrbot_plugin_private_companion`）。
> 只读审计：未修改仓库文件、未联网、未调用线上接口。所有结论均带 `file:line`。
> 审计日期：2026-10-28。

---

## 0. 一句话结论

后端**只有一个注册入口**（`main.py:163 → multi_controller.py:1315 → multi_api.py:258`），共 **305 条实际注册路由**，由「安装级 77 + 每个私聊角色 150 + 每个群角色 26」三段拼成。**功能一个不少**：新 UI 要 100% 覆盖这 305 条背后的能力；其中约 37 条是主路径（总是显示），其余按**平台 / 扩展装配 / 旧版数据 / 群目标 / 高级诊断**四类条件显示或收进「高级」，判定字段见 §6。以后接 QQ 时无需改代码，只需平台条件翻真。

三个必须先知道的结构事实：

1. **有两套配置存储，不是一个。** V2 配置注册表（`/config/configure` + 各域 `…/configure`，字段带类型/范围/层级）与**插件配置字典**（`host-options/*`、`accounts/*` 直接读写 `controller.config`，并对应 `_conf_schema.json` 的官方表单）同时存在、互不同步。同一个「语音」「模型 provider」「分段」在两套里都有落点。
2. **路由是「按角色挂载」的，不是全局的。** 同一份代码对每个 `(target_id, role_digest)` 重新注册一遍；页面必须先读 `/page/targets` 拿到每个角色的 `*_api` 路径，再去请求。不知道角色就没有路径。
3. **没有批处理、没有 SSE/WebSocket、只有 GET/POST。** 所有写操作都是 POST + `operation_key`（幂等键），并发控制靠 **10 种不同名字**的 token/revision；错误一律是 HTTP 200 + `{status:"error", message:<机器码>}`（未捕获异常除外）。

---

## 1. 路由族与挂载结构（本区域的「页面/视图清单」）

### 1.1 注册链路

| 环节 | 位置 | 说明 |
|---|---|---|
| 插件加载 | `main.py:148` | `AstrBotMultiController(context, config, data_root)` |
| 注册 | `main.py:163` → `astrbot_host/multi_controller.py:1315-1316` → `multi_api.py:258` | `MultiHostWebAPI.register()`，失败只 warning，页面静默 404 |
| 路径前缀 | 宿主 `register_web_api` 统一挂在 `/api/plug` 下；插件自己的根是 `/astrbot_plugin_private_companion` | `web_api.py:48`、`role_paths.py:6`（`HOST_PREFIX = …/host`） |
| 单宿主旧实现 | `astrbot_host/web_api.py:96` `StagingWebAPI.register()` | **当前部署不会执行**（`main.py` 只调 MultiController），`/staging/*` 11 条是死路由 |
| 性能模式 | `multi_api.py:266-270` | 开启后**只注册 2 条**（`/host/status`、`/host/performance`），管理路由全部消失；页面必须整体降级 |

> 结论：新 UI 不能假设某个管理路由一定存在；启动时先看 `/host/performance`（或 `setup/status` 里的 `host`）再决定渲染什么。

### 1.2 三段挂载

| 段 | 数量（本部署） | 路径形态 | 谁是 owner |
|---|---|---|---|
| 安装级 | 77 | `/astrbot_plugin_private_companion/<域>/…`、`/…/host/status` | `multi_api.py:271-298`（Page/Integration/Acquaintance/Semantic/Setup/Accounts/Perception/Extensions/Backup/HostOptions/Storage/Config(3 分区) + 13 条字面路由） |
| 私聊角色 | 150（每 `target×role` 一份） | `…/host/targets/{target_id}/roles/{digest(role_id)}/<域>/…` | `multi_api.py:310-340` |
| 群角色 | 26（每 `target×role` 一份） | 同上，域固定为 `group-memory` / `reply` / `model` / `legacy-group-data` | `multi_api.py:299-309` |

`{role_digest} = digest(role_id)`（`multi_api.py:147-195` 的 `target_inventory`）；同一角色被两个私聊窗口共享时，路由会**重复注册两份**（`multi_api.py:311-321` 每个 `(target, role)` 都挂一遍，`TargetControllerView` 负责把请求路由回主窗口）。

### 1.3 每个域的归属（谁能读、谁能写）

| 域 | 挂载 | 路由数 | 读/写 | 主要消费页面 |
|---|---|---|---|---|
| `page` | 安装 | 3 | 只读 | 所有页面的入口 |
| `integration` | 安装 | 2 | 读 + 装配写 | 主壳能力目录 |
| `acquaintance` | 安装 | 9 | 读 + 写 | 关系与权限（成员） |
| `semantic` | 安装 | 2 | 读 + 写 | 表情素材库 |
| `setup` | 安装 | 16 | 读 + 写 | 首跑向导 |
| `accounts` | 安装 | 8 | 读 + 写 | 账号与会话 |
| `perception` / `perception-native` | 安装 + 私聊角色 | 2 / 5+1 | 读 + 写 | 感知（屏幕/资讯） |
| `extensions` | 安装 | 3 | 读 + 写 | 扩展面板 |
| `backup` / `storage` | 安装 | 6 / 2 | 读 + 写 | 宿主管理 |
| `host-options` | 安装 | 9 | 读 + 写 | 宿主管理（语音/戳/转发/余额/天气） |
| `config` | 安装（3 分区）+ 私聊角色（22 分区） | 2 / 4 | 读 + 写 | 所有设置分区 |
| `memory` | 私聊角色 | 20 | 读 + 写 | 关系与记忆 |
| `state` | 私聊角色 | 3 | 读 + 写 | 日记与生活 / 主页 |
| `reply` | 私聊角色 / 群角色 | 15 / 16 | 读 + 写 | 回复页 |
| `model` | 私聊角色 / 群角色 | 33 / 2 | 读 + 写 | 模型页 |
| `life` / `relationships` / `growth` / `persona` | 私聊角色 | 2 / 2 / 7 / 8 | 读 + 写 | 日记与生活 / 关系与权限 / 人物设定工坊 |
| `image-materials` | 私聊角色 | 10 | 读 + 写 | 形象/衣橱 |
| `qzone-extension` | 私聊角色 | 10 | 读 + 写 | **QQ 专属 → 条件显示（platform_id=aiocqhttp）** |
| `reality-access` / `screen-access` / `game-access` | 私聊角色 | 16 / 4 / 2 | 读 + 写 | **扩展能力 → 条件显示（扩展装配后出现）** |
| `legacy` / `legacy-group-data` | 私聊角色 / 群角色 | 9 / 2 | 读 + 写 | **V1 迁移 → 条件显示（检测到旧版数据）** |
| `group-memory` | 群角色 | 6 | 读 + 写 | 群记忆 |

### 1.4 全局协议约定（新 UI 必须遵守）

| 约定 | 证据 | 对新 UI 的含义 |
|---|---|---|
| 统一信封 `{status:"ok"\|"error", message, reason?, data}` | `web_api.py:59-70` | 成功读 `data.data`；错误读 `data.message`（机器码）+ `data.reason`（英文） |
| 错误码即接口：218 个不同机器码 | `grep -c` 统计 `Outcome.failed("…")` | 前端必须自带码→中文表；未知码会退化成固定兜底文案（`product-page.js:449-450`、`1125`） |
| 只允许 GET/POST | 全部 `routes()` 元组 | 没有 PUT/PATCH/DELETE，删除也是 POST 命令 |
| 写操作必须带 `operation_key` | `configuration_api.py:162`、`reply_api.py:76`、`state_api.py:147` 等 | 每种写操作都需要一个稳定幂等键，重放返回同一结果 |
| 并发控制有 10 种名字 | `edit_token`(49) / `expected_revision`(22) / `view_token`(14) / `role_edit_token`(2) / `settings_token`(1) / `configuration_token` / `plan_token`(38) / `preview_token`(4) | 新 UI 必须按域分别保存这些 token，不能统一叫「保存」 |
| 请求体硬上限 | setup 4096、config 32768、reply 300000、group-reply 8192（preview 例外）、life 1.2 MB、semantic 7 MB、image 上传 ≈16 MB body | 大对象（表情、图片、人格文本）要走各自的导入路由 |
| 无流式、无批量 | 全仓无 `event-stream`/WS 页面通道；刷新靠各页自建定时器（`maintenance-page.js:3708`、`perception-overview.js:1405`、`state-page.js:524`、`memory-page.js:219`、`workspaces/host/app.js:1975`） | 渲染一个分区 = 一次 GET；首屏需要多请求串/并 |
| 鉴权 = Dashboard 会话 | 所有 handler 读 `request.username`；多数拒绝 `api_key:` 身份（`reply_api.py:53-54`） | 新页面必须跑在插件页 iframe 里，经宿主桥发请求 |
| 未初始化时的行为 | `page_api.py:139-141` 抛 `staging_not_initialized`；`setup_api.py:331-364` 仍可读，且 `data.host` 已含完整 `targets` | 首屏先用 `setup/status`，成功后再 `page/targets` |

### 1.5 启动所需的最小调用序列（已验证）

```
GET /setup/status              → step / binding / model / ready / host.status / host.targets（全量 inventory）
GET /page/targets              → installation_id / backup_api / acquaintance_api / accounts_api / operator_id / targets[].roles[].*_api
（可选）GET /integration/manifest、GET /page/ownership
```

`page/targets` 只给导航（`page_api.py:171-186` 的 10 个字段：`target_id/scope_kind/platform_id/account_id/bot_id/participant_id/group_id/display_name/group_name/account_name`），**不含投递授权**；投递授权、`delivery_mode`、`failure_code` 只在 `host/status`（`multi_controller.py:1297-1312`）里。这是新 UI 必须把两者拼起来的原因。

---

## 2. 完整路由表

> 路径省略宿主前缀 `/api/plug`。`…` = `/astrbot_plugin_private_companion/host/targets/{target_id}/roles/{role_digest}`。
> 「显示条件」列：**总是**＝任何部署都显示；其余是**条件显示**（`QQ`=平台为 aiocqhttp、`E:<扩展>`=该扩展已装配并启用、`V1`=检测到旧版数据、`G`=群目标、`ADV`=收进「高级/诊断」分组但功能保留），判定字段见 §6.2。**本表没有任何一行被删除**。
> 「写」列：`是` = 会持久化或改变运行态；`否（POST 只读）` = 用 POST 只是为了带结构化参数。
> 表格共 **235 行**：安装级 79（含 `multi_api.py` 直接注册的 13 条）、私聊角色 130、群角色 26。
> AST 在 `astrbot_host/*_api.py` 共提取 227 条 `routes()` 元组，其中 222 条进入三条挂载线；另 5 条（`legacy_archive` 1、`legacy_private_memory` 2、`screen_observation` 2）由别的文件以子路由/旧路径形式出现，未单列。
> 动态项（`reality-access` 8 能力、`screen-access` 观测子路由、`config` 分区）在对应表下方注明。





### A. 安装级路由（1 份）

以下路径都拼在 `/api/plug` 之后；`/host/*` 前缀已在路径里体现。

| 方法 | 路径模板 | 处理函数（file:line） | 请求字段 | 写 | 显示条件 |
|---|---|---|---|---|---|
| GET | `/astrbot_plugin_private_companion/page/targets` | page_api.py:26 targets | 无 query/body | 否 | 总是 |
| GET | `/astrbot_plugin_private_companion/page/workspace-entry` | page_api.py:27 workspace_entry | 无 query/body | 否 | 总是 |
| GET | `/astrbot_plugin_private_companion/page/ownership` | page_api.py:29 ownership | 无 query/body | 否 | 总是 |
| GET | `/astrbot_plugin_private_companion/integration/manifest` | integration_api.py:30 manifest | 无 query/body | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/integration/lifecycle` | integration_api.py:35 lifecycle | {extension_id, action, expected_revision, operation_key} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/acquaintance` | acquaintance_api.py:305 directory | — | 否 | 总是 |
| GET | `/astrbot_plugin_private_companion/acquaintance/authorization` | acquaintance_api.py:306 authorization | {operation_key, subject_id, route, sections} / 读：?subject_id | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/acquaintance/authorization` | acquaintance_api.py:308 authorize | {operation_key, subject_id, route, sections} / 读：?subject_id | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/acquaintance/admin-name` | acquaintance_api.py:310 set_admin_name | {operation_key, subject_id, route, tier, expected_revision} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/acquaintance/identity` | acquaintance_api.py:312 set_identity | {operation_key, subject_id, route, sections} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/acquaintance/settings` | acquaintance_api.py:313 member_settings | {subject_id, route, edit_token, changes} | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/acquaintance/settings` | acquaintance_api.py:314 configure_member | {subject_id, route, edit_token, changes} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/acquaintance/open-loops` | acquaintance_api.py:315 open_loops | {subject_id, route, memo_id, expected_revision, action} | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/acquaintance/open-loops` | acquaintance_api.py:316 change_open_loop | {subject_id, route, memo_id, expected_revision, action} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/semantic` | semantic_api.py:27 get | GET: ?target_id&role_id&session_id&global；POST: {action∈configure|import|analyze|edit|delete|search|reindex, …} | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/semantic` | semantic_api.py:28 post | GET: ?target_id&role_id&session_id&global；POST: {action∈configure|import|analyze|edit|delete|search|reindex, …} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/setup/status` | setup_api.py:203 status | 无 | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/upgrade` | setup_api.py:204 prepare_upgrade | {confirmed, plan_token} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/setup/targets` | setup_api.py:205 api_targets | 无 | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/binding/confirm` | setup_api.py:206 confirm_binding | {}（空对象） | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/model` | setup_api.py:207 model | {provider_id} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/setup/model-tasks` | setup_api.py:208 model_tasks | 无 | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/model-tasks/configure` | setup_api.py:209 configure_model_task | {kind, operation_key, edit_token, changes, reset?, section?} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/setup/profile` | setup_api.py:210 profile | 无（内部取 setup 上下文） | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/profile-draft` | setup_api.py:211 profile_draft | {target, persona_id?} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/profile/save` | setup_api.py:212 save_profile | {target, operation_key, edit_token, changes} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/host/start` | setup_api.py:213 reconnect_host | {} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/prepare` | setup_api.py:214 prepare | {} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/complete` | setup_api.py:215 complete | {step, skipped} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/proactive-test` | setup_api.py:216 proactive_test | {enable_proactive} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/proactive-diagnostic` | setup_api.py:217 proactive_diagnostic | {purpose, confirm_delivery:true} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/setup/proactive-test/confirm` | setup_api.py:218 confirm_proactive_test | {attempt_id} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/accounts` | account_session_api.py:30 get | GET 无；POST {enabled?, accounts?, sessions?, personas?, groups?} | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/accounts` | account_session_api.py:31 save | GET 无；POST {enabled?, accounts?, sessions?, personas?, groups?} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/accounts/model-provider` | account_session_api.py:32 save_model_provider | {provider_id} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/accounts/role` | account_session_api.py:34 add_role | {platform_id, account_id, bot_id, persona_ids[], role_id} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/accounts/window-link` | account_session_api.py:36 link_window | {primary_target_id, linked_target_ids[]} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/accounts/window-unlink` | account_session_api.py:38 unlink_window | {primary_target_id, linked_target_id} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/accounts/group-target` | account_session_api.py:40 save_group_target | {platform_id, account_id, bot_id, group_id, enabled} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/accounts/session` | account_session_api.py:42 save_session | {session_key, action, …} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/perception` | perception_api.py:27 get | {provider, section, updates} | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/perception` | perception_api.py:28 post | {provider, section, updates} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/extensions` | native_extension_api.py:17 status | 无 query/body | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/extensions/configure` | native_extension_api.py:18 configure | {extension_id, updates, revision} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/extensions/action` | native_extension_api.py:19 action | {extension_id, action, payload} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/backup` | backup_api.py:30 listing | 无 | 否 | 总是（资料维护） |
| POST | `/astrbot_plugin_private_companion/backup/create` | backup_api.py:31 create | 见 backup_api.py:create | 是 | 总是（资料维护） |
| GET | `/astrbot_plugin_private_companion/backup/inspect` | backup_api.py:32 inspect | ?snapshot_id | 否 | 总是（资料维护） |
| GET | `/astrbot_plugin_private_companion/backup/restore/preview` | backup_api.py:33 preview | ?snapshot_id | 否 | 总是（资料维护） |
| POST | `/astrbot_plugin_private_companion/backup/restore` | backup_api.py:34 restore | {snapshot_id, confirmed_hash} | 是 | 总是（资料维护） |
| GET | `/astrbot_plugin_private_companion/backup/pending` | backup_api.py:35 pending | 无 | 否 | 总是（资料维护） |
| GET | `/astrbot_plugin_private_companion/host-options` | host_options_api.py:60 status | 无 | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/host-options/voice` | host_options_api.py:61 voice | {operation_key, edit_token, changes{enabled,probability,…}} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/host-options/poke` | host_options_api.py:62 poke | {operation_key, edit_token, changes} | 是 | QQ |
| POST | `/astrbot_plugin_private_companion/host-options/forward_intake` | host_options_api.py:63 forward_intake | {operation_key, edit_token, changes} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/host-options/balance` | host_options_api.py:64 balance_status | {operation_key, edit_token, changes{url,api_key,user_id,value_divisor}} | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/host-options/balance` | host_options_api.py:65 balance | {operation_key, edit_token, changes{url,api_key,user_id,value_divisor}} | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/host-options/balance/test` | host_options_api.py:66 balance_test | {url,api_key,user_id,value_divisor} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/host-options/weather` | host_options_api.py:67 weather_status | {operation_key, edit_token, changes} | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/host-options/weather` | host_options_api.py:68 weather | {operation_key, edit_token, changes} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/storage` | storage_api.py:28 status | GET 无；POST {operation_key, edit_token, changes} | 否 | 总是（资料维护） |
| POST | `/astrbot_plugin_private_companion/storage` | storage_api.py:29 update | GET 无；POST {operation_key, edit_token, changes} | 是 | 总是（资料维护） |
| GET | `/astrbot_plugin_private_companion/config` | configuration_api.py:101 status | ?sections=a,b | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/config/configure` | configuration_api.py:102 configure | {section, operation_key, edit_token, changes} | 是 | 总是 |
| GET | `/astrbot_plugin_private_companion/config/behavior` | configuration_api.py:105 behavior_status | 无 | 否 | 总是 |
| POST | `/astrbot_plugin_private_companion/config/behavior/command` | configuration_api.py:106 behavior_command | {group_key, habit_id, enabled, revision} | 是 | 总是 |

### A2. 安装级字面路由（`multi_api.py:262-298` 直接注册，不在任何 `routes()` 里）

| 方法 | 路径模板 | 处理函数（file:line） | 请求字段 | 写 | 显示条件 |
|---|---|---|---|---|---|
| GET | `/astrbot_plugin_private_companion/host/status` | multi_api.py:202 api_status | 无 | 否 | 总是 |
| GET | `/astrbot_plugin_private_companion/host/performance` | multi_api.py:214 api_performance | 无 | 否 | 总是 |
| GET | `/astrbot_plugin_private_companion/host/preview` | multi_api.py:237 api_preview | `?target_id&batch_id`（两者必填） | 否（POST 只读） | ADV（对话预览诊断） |
| GET | `/astrbot_plugin_private_companion/host/batches` | multi_api.py:248 api_batches | `?target_id` | 否 | ADV（对话批次诊断） |
| POST | `/astrbot_plugin_private_companion/host/probe` | multi_api.py:294 `control("probe")` | `{}` | 是（只探测） | ADV |
| POST | `/astrbot_plugin_private_companion/host/initialize` | multi_api.py:294 `control("initialize_profile")` | `{}` | 是 | 总是（与 `/setup/prepare` 同一动作，UI 合并为一个入口） |
| POST | `/astrbot_plugin_private_companion/host/start` | multi_api.py:294 `control("start")` | `{}` | 是 | 总是（与 `/setup/host/start` 合并入口） |
| POST | `/astrbot_plugin_private_companion/host/stop` | multi_api.py:294 `control("stop")` | `{}` | 是 | 总是 |
| POST | `/astrbot_plugin_private_companion/host/authorize-delivery` | multi_api.py:294 | `?target_id` | 是 | 总是（私聊投递授权） |
| POST | `/astrbot_plugin_private_companion/host/revoke-delivery` | multi_api.py:294 | `?target_id` | 是 | 总是（私聊投递撤回） |
| POST | `/astrbot_plugin_private_companion/host/authorize-group-delivery` | multi_api.py:294 | `?target_id` | 是 | 总是（群投递授权） |
| POST | `/astrbot_plugin_private_companion/host/revoke-group-delivery` | multi_api.py:294 | `?target_id` | 是 | 总是（群投递撤回） |
| GET | `/astrbot_plugin_private_companion/perception-native/materials` | multi_api.py:288 | 无 | 否 | 总是（感知素材池） |

> 注：`host/preview`、`host/batches`、`host/{probe,initialize,start,stop}` 与 `setup/*` 是同一组动作的两条入口（`multi_api.py:294` vs `setup_api.py:550-597`）。功能都保留，但新 UI 只暴露一个入口，另一个作为内部等价路径存在——这是第 6.3 节「界面减法」的第 1 条。

### B. 私聊角色路由（每个 target×role 一份）

> 动态展开说明：`reality-access` 实际按 8 个能力展开为 **16** 条（`reality_access_api.py:16-23` 的 `CAPABILITY_PATHS`，表中只列 2 行模板）；`screen-access` 含 2 条观测子路由（`screen_access_api.py:25` → `.../last-observation`、`.../last-original`），共 **4** 条；`config` 实挂 4 条（`GET/POST /config*` + `/behavior` + `/behavior/command`，`multi_api.py:285-286,338-339`）。


`{role_digest}` = `digest(role_id)`；私聊目标与角色是多对多，同一角色被两个私聊窗口共享时会重复注册。

| 方法 | 路径模板 | 处理函数（file:line） | 请求字段 | 写 | 显示条件 |
|---|---|---|---|---|---|
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory` | memory_api.py:27 list | ?limit&after_id&kind | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/command` | memory_api.py:28 command | {atom_id, action, expected_revision, view_token, operation_key, value?} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory/revisions` | memory_api.py:29 revisions | ?atom_id&after_revision&limit | 否 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory/clear/preview` | memory_api.py:30 preview_clear | 无 | 否 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/clear` | memory_api.py:31 clear | {operation_key, token?} | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory/reflections` | memory_api.py:32 reflections | 无 | 否 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/reflections/retry` | memory_api.py:33 retry_reflection | {proposal_id, …} | 是 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/reflections/queue` | memory_api.py:34 queue_reflection | {…} | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory/overview` | memory_api.py:35 overview | 无 | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory/settings` | memory_api.py:36 settings | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/settings/command` | memory_api.py:37 settings_command | {operation_key, expected_edit_token, changes, reset_to_inherit?, layer?} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/detail` | memory_api.py:38 detail | {atom_id} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/query` | memory_api.py:39 query | {query, kind∈facts|sources|experiences|all, session_id?, cursor?} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/source` | memory_api.py:40 read_source | {session_id, handle} | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory/archive/preview` | memory_api.py:41 archive_preview | 无 | 否 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/archive` | memory_api.py:42 archive_commit | {operation_key, token} | 是 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/archive/restore` | memory_api.py:43 archive_restore | {atom_ids[]} | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/memory/export` | memory_api.py:44 memory_export | 无 | 否 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/import/preview` | memory_api.py:45 import_preview | {bundle} | 是 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/memory/import` | memory_api.py:46 import_commit | {operation_key, token, bundle} | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/state` | state_api.py:25 status | ?after_id&limit | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/state/weather` | state_api.py:26 weather | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/state/command` | state_api.py:27 command | {action∈configure|configure_role|configure_window|state.write|cycle.align|maintain|calendar.*, …} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply` | reply_api.py:24 status | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/preview` | reply_api.py:25 preview | {settings, text, image_count?} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/configure` | reply_api.py:26 configure | {operation_key, edit_token, changes, reset_to_inherit?} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/expression` | reply_api.py:27 expression | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/expression/configure` | reply_api.py:28 expression_configure | {operation_key, edit_token, changes} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/style` | reply_api.py:30 style | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/revise` | reply_api.py:31 style_revise | {signal_id, view_token, operation_key, changes} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/samples` | reply_api.py:32 style_samples | ?state&limit&after_id | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/samples/command` | reply_api.py:33 style_sample_command | {handle, action, view_token, operation_key} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/learn` | reply_api.py:34 style_learn | {} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/export` | reply_api.py:35 style_export | {} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/import/preview` | reply_api.py:36 style_import_preview | {package_json} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/import/apply` | reply_api.py:38 style_import_apply | {package_json, preview_token, operation_key} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/command` | reply_api.py:40 style_command | {signal_id, action, view_token, operation_key} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/recalls` | reply_api.py:42 recalls | ?limit | 否 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/catalog` | model_api.py:373 catalog | 无 | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model` | model_api.py:374 status | 无 | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/maintenance` | model_api.py:375 maintenance | — | 否 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/memory` | model_api.py:376 memory_diagnostic | — | 否 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/balance` | model_api.py:377 balance | — | 否 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/test/storage` | model_api.py:378 storage_test | — | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/image-schema` | model_api.py:379 image_schema | — | 否 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/configure` | model_api.py:381 configure | {kind, operation_key, edit_token, changes, reset?, section?, layer?} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/test` | model_api.py:382 test | {provider_id} | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/laya` | model_api.py:383 laya_status | — | 否 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/laya/save` | model_api.py:384 laya_save | — | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/search` | model_api.py:385 search_status | — | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/search/save` | model_api.py:386 search_save | — | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/laya/logs` | model_api.py:387 laya_logs | — | 否 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/laya/test` | model_api.py:388 laya_test | {provider_id} | 是 | ADV |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/laya/decide` | model_api.py:389 laya_decide | — | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/voice` | model_api.py:390 voice | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/voice/save` | model_api.py:391 voice_save | {operation_key, edit_token, changes} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/voice/test` | model_api.py:392 voice_test | {provider_id} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/tts/providers` | model_api.py:393 tts_providers | — | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/tts/providers/create` | model_api.py:394 tts_provider_create | — | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/tts/providers/update` | model_api.py:395 tts_provider_update | — | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/tts/providers/clone` | model_api.py:396 tts_provider_clone | — | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/tts/providers/test` | model_api.py:397 tts_provider_test | {provider_id} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/image` | model_api.py:398 image | 无 | 否 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/image/save` | model_api.py:399 image_save | {operation_key, edit_token, changes} | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/image/test` | model_api.py:400 image_test | {provider_id} | 是 | E:image |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/image/output` | model_api.py:401 image_output | 无 | 否 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/image/output/save` | model_api.py:402 image_output_save | {operation_key, edit_token, changes} | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/image/output/test` | model_api.py:403 image_output_test | {provider_id} | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/image/output/reconnect` | model_api.py:404 image_output_reconnect | — | 是 | E:image |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/image/observability` | model_api.py:405 image_observability | — | 否 | E:image |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model/image/review/providers` | model_api.py:406 image_review_providers | — | 否 | E:image |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/perception-native` | native_perception_api.py:49 status | — | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/perception-native/runtime` | native_perception_api.py:50 runtime_snapshot | — | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/perception-native/materials` | native_perception_api.py:51 material_pool | — | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/perception-native/configure` | native_perception_api.py:52 configure | — | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/perception-native/news-diagnostic` | native_perception_api.py:53 news_diagnostic | — | 是 | ADV |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reality-access{route}` | reality_access_api.py:38 status | — | 否 | E:reality |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reality-access{route}/configure` | reality_access_api.py:39 configure | {…} | 是 | E:reality |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/screen-access` | screen_access_api.py:23 status | 无 | 否 | E:screen |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/screen-access/configure` | screen_access_api.py:24 configure | {…} | 是 | E:screen |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/game-access` | game_access_api.py:20 status | 无 | 否 | E:game |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/game-access/configure` | game_access_api.py:21 configure | {…} | 是 | E:game |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/status` | qzone_api.py:52 status | — | 否 | QQ |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/configure` | qzone_api.py:53 configure | — | 是 | QQ |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/feed` | qzone_api.py:54 feed | — | 否 | QQ |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/like` | qzone_api.py:55 like | — | 是 | QQ |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/comment` | qzone_api.py:56 comment | — | 是 | QQ |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/publish` | qzone_api.py:57 publish | — | 是 | QQ |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/refresh-credentials` | qzone_api.py:58 refresh | — | 是 | QQ |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/scan-comments` | qzone_api.py:59 scan_comments | — | 否 | QQ |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/reply-comment` | qzone_api.py:61 reply_comment | — | 是 | QQ |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/qzone-extension/agenda-suggestions/resolve` | qzone_api.py:63 resolve_suggestion | — | 是 | QQ |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/life` | life_api.py:21 status | ?before&after_activity | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/life/command` | life_api.py:22 command | {action∈configure|add_text|sleep|read|wake|cancel|withdraw|diary|dream|edit|delete|restore|derive, …} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/relationships` | relationships_api.py:25 list | ?limit | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/relationships/command` | relationships_api.py:26 command | {memory_id, action, expected_revision, view_token, operation_key, interpretation?} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/growth` | growth_api.py:48 list | 无 | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/growth/evidence` | growth_api.py:49 evidence | — | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/growth/command` | growth_api.py:50 command | {action∈configure|propose|revise|confirm|resume|pause|complete|withdraw|retire, …} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/growth/progress` | growth_api.py:51 progress | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/growth/progress/command` | growth_api.py:52 progress_command | {review_id, action, expected_revision, view_token, operation_key} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/growth/self-review` | growth_api.py:53 self_review | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/growth/self-review/command` | growth_api.py:54 self_review_command | {item_id, action, view_token, operation_key} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/persona` | persona_api.py:180 status | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/persona/command` | persona_api.py:181 command | {action∈save|restore, persona_id, text?, original_text?, note, expected_current} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/persona/profile-draft` | persona_api.py:183 profile_draft | {persona_id?} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/persona/profile-migration-plan` | persona_api.py:185 profile_migration_plan | {persona_id} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/persona/profile-migration-apply` | persona_api.py:187 profile_migration_apply | {persona_id, operation_key, plan_token} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/persona/standardize` | persona_api.py:189 standardize | {persona_id, answers, strength, source_mode, reference_material, source_text?} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/persona/tryouts` | persona_api.py:191 tryouts | {persona_id, draft_text, variation} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/persona/style-rules` | persona_api.py:193 style_rules | {persona_id, draft_text, selections[], reference_material, speech_preference, constraint_preference} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/legacy` | legacy_api.py:144 discovery | 无 | 否 | V1 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/legacy/plan` | legacy_api.py:145 plan | — | 否 | V1 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/legacy/auto` | legacy_api.py:146 auto_import | — | 是 | V1 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/legacy/apply` | legacy_api.py:148 apply | — | 是 | V1 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/legacy/upgrade-confirm` | legacy_api.py:149 confirm_upgrade | — | 是 | V1 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/legacy/data-plan` | legacy_api.py:151 data_plan | — | 否 | V1 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/legacy/scope` | legacy_api.py:152 scope | — | 否 | V1 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/legacy/batch-apply` | legacy_api.py:153 batch_apply | — | 是 | V1 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/legacy/data-apply` | legacy_api.py:154 data_apply | — | 是 | V1 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/image-materials` | image_material_api.py:33 inventory | ?role only | 否 | E:image |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/album` | image_material_api.py:34 album | ?limit | 否 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/references/upload` | image_material_api.py:35 upload_reference | {data(base64), mime, …}（≤12MiB 图） | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/references` | image_material_api.py:36 register_reference | {…} | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/references/update` | image_material_api.py:37 update_reference | — | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/references/order` | image_material_api.py:38 reorder_references | — | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/references/withdraw` | image_material_api.py:39 withdraw_reference | — | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/wardrobe` | image_material_api.py:40 register_wardrobe | — | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/wardrobe/withdraw` | image_material_api.py:41 withdraw_wardrobe | — | 是 | E:image |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/image-materials/daily-outfit` | image_material_api.py:42 select_daily_outfit | — | 是 | E:image |

### C. 群角色路由（每个群 target×role 一份）

| 方法 | 路径模板 | 处理函数（file:line） | 请求字段 | 写 | 显示条件 |
|---|---|---|---|---|---|
| GET | `…/host/targets/{target_id}/roles/{role_digest}/group-memory` | group_memory_api.py:19 list | ?limit | 否 | G |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/group-memory/detail` | group_memory_api.py:20 detail | {statement_id} | 是 | G |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/group-memory/retract` | group_memory_api.py:21 retract | {statement_id, operation_key} | 是 | G |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/group-memory/operation` | group_memory_api.py:22 operation | ?operation_id | 否 | G |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/group-memory/safety` | group_memory_api.py:23 safety | ?limit | 否 | G |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/group-memory/safety/review` | group_memory_api.py:24 review_safety | {hit_id, action, revision} | 是 | G |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply` | reply_api.py:35 status | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/preview` | reply_api.py:36 preview | {settings, text, image_count?} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/configure` | reply_api.py:37 configure | {operation_key, edit_token, changes, reset_to_inherit?} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/expression` | reply_api.py:38 expression | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/expression/configure` | reply_api.py:39 expression_configure | {operation_key, edit_token, changes} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/participation` | reply_api.py:41 participation | 无 | 否 | G |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/participation/configure` | reply_api.py:43 participation_configure | {operation_key, edit_token, changes, reset_to_inherit?} | 是 | G |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/style` | reply_api.py:45 style | 无 | 否 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/samples` | reply_api.py:46 style_samples | ?state&limit&after_id | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/revise` | reply_api.py:47 style_revise | {signal_id, view_token, operation_key, changes} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/samples/command` | reply_api.py:48 style_sample_command | {handle, action, view_token, operation_key} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/learn` | reply_api.py:49 style_learn | {} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/export` | reply_api.py:50 style_export | {} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/import/preview` | reply_api.py:51 style_import_preview | {package_json} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/import/apply` | reply_api.py:52 style_import_apply | {package_json, preview_token, operation_key} | 是 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/reply/style/command` | reply_api.py:53 style_command | {signal_id, action, view_token, operation_key} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/model` | model_api.py:23 status | 无 | 否 | 总是 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/model/configure` | model_api.py:24 configure | {kind, operation_key, edit_token, changes, reset?, section?, layer?} | 是 | 总是 |
| GET | `…/host/targets/{target_id}/roles/{role_digest}/legacy-group-data/plan` | legacy_group_data_api.py:32 plan | 无 | 否 | V1 |
| POST | `…/host/targets/{target_id}/roles/{role_digest}/legacy-group-data/apply` | legacy_group_data_api.py:33 apply | {operation_key, plan_token, confirmed} | 是 | V1 |


---

## 2 bis. 设置分区：`/config` 是唯一「带 schema 的通用编辑器」

`GET /config?sections=a,b` 与 `POST /config/configure` 覆盖 25 个分区（`configuration_api.py:46-72`）。每个分区返回：

```json
{"settings": {...}, "edit_token": "64hex", "revision": n, "configuration_token": "...",
 "group_id": "conversation.presentation", "scope": "role|window|installation",
 "apply_mode": "immediate|next_task", "layers": [...], "provenance": {field: layer},
 "fields": {field: {kind, default, apply_mode, editable_layers, minimum?, maximum?, maximum_chars?}}}
```

证据：`companion_v2/configuration/management.py:82-235`（`GroupEditor.status/configure`）、`companion_v2/configuration/contract.py:55-74`。
**这是后端唯一自描述的部分**：新 UI 可以完全按 `fields` 的 `kind/minimum/maximum/editable_layers` 渲染控件，不必在前端硬编码范围。

| 分区名（`section`） | 注册表 `group` | 管理类 | 挂载层级 | 字段数* | 新 UI |
|---|---|---|---|---|---|
| `proactive.contact` | `proactive.contact` | ProactiveContactManagement | **安装级** | ≈158 | 保留 3–6 个开关 |
| `reaction` | `expression.reaction` | ReactionRetrievalManagement | **安装级** | 9 | 待定（表情检索） |
| `budget` | `model.budget` | ModelBudgetManagement | **安装级** | 2 | ADV（预算诊断） |
| `quota` | `conversation.media_quota` | ImageQuotaManagement | 角色/窗口 | 4 | E:image |
| `image_review` | `conversation.image_review` | ImageReviewManagement | 角色 | 11 | E:image |
| `image.output` | `conversation.image_output` | ImageOutputManagement | 角色/窗口 | 18（源码计数） | 待定（生图） |
| `busy_gate` | `conversation.busy_gate` | BusyGateManagement | 角色 | 7 | 总是（决策页） |
| `content.authoring` | `content.authoring` | ContentAuthoringManagement | 安装/角色 | 4 | E:content |
| `recall` | `conversation.recall` | RecallManagement | 窗口 | 4 | ADV（撤回记录） |
| `screen` | `screen` | ScreenManagement | 角色 | 3 | E:screen |
| `web_understanding` | `conversation.web` | WebUnderstandingManagement | 角色 | 4 | 总是（理解页） |
| `relay` | `conversation.relay` | RelayManagement | 角色 | 5 | 总是（转发中继） |
| `qzone` | `qzone` | QzoneManagement | 角色/窗口 | 12 | **QQ** |
| `person` | `person` | AcquaintanceManagement | 角色 | 2 | 待定 |
| `private_access` | `private_access` | PrivateAccessManagement | 角色 | 6 | 待定 |
| `role.growth.skills` | `role.growth.skills` | RoleGrowthSkillsManagement | 角色 | 2 | 总是（成长页） |
| `expression.learning` | `expression.learning` | ExpressionLearningManagement | 角色/窗口 | 23 | 总是（表达学习） |
| `knowledge` | `knowledge` | KnowledgeManagement | 角色 | 14 | 待定（知识库） |
| `life` | `role.life` | DiaryAndRestManagement | 角色/窗口 | 23 | 保留 3–5 个 |
| `role_profile` | `role.profile` | RoleProfileManagement | 角色 | 46 | 保留（角色设定） |
| `relationship_profile` | `relationship.profile` | RelationshipProfileManagement | 关系 | 7 | 保留 |
| `library` | `library` | LibraryManagement | 角色 | 12 | 总是（阅读页） |
| `wardrobe` | `wardrobe` | WardrobeManagement | 角色 | 6 | 待定（衣橱） |
| `photo.reference` | `photo.reference` | ReferenceManagement | 角色 | 4 | 待定 |
| `group_participation` | `conversation.group_participation` | GroupParticipationManagement | 窗口（群） | 20 | 保留 3–5 个 |

\* 字段数取自 `docs/V2_CONFIG_SURFACE_20260928.csv`（2026-09-28 生成的快照，已发现与当前源码有漂移，例如 `qzone` 源码 12 键、`expression.learning` 源码 23 键）。**运行时以 `fields` 返回为准。**

> 注意：安装级 `/config` 只允许 3 个分区（`multi_api.py:52-56` 的 `INSTALLATION_CONFIGURATION_SECTIONS`），其余 22 个分区挂在**私聊角色**路径下；群角色**没有** `/config` 路由，群侧设置只能走 `…/roles/{r}/reply/configure` 与 `/participation/configure`。

---

## 2 ter. `…/command` 型路由的 action 枚举（一条路由 = 一套 CRC 命令）

这些路由 body 必须带 `action`，字段集按 action 变化（`set(data) - allowed` 严格校验），是新 UI「一个按钮一个 action」的直接映射：

| 路由 | action 取值 | 证据 |
|---|---|---|
| `…/state/command` | `configure`, `configure_role`, `configure_window`, `state.write`, `cycle.align`, `maintain`, `calendar.create`, `calendar.revise`, `calendar.presence`, `calendar.accept`, `calendar.cancel`, `calendar.exception`, `calendar.remind` | `state_api.py:147-172` |
| `…/life/command` | `configure`, `add_text`, `sleep`, `read`, `wake`, `cancel`, `withdraw`, `diary`, `dream`, `edit`, `delete`, `restore`, `derive` | `life_api.py:71-79` |
| `…/growth/command` | `configure`, `propose`, `revise`, `confirm`, `resume`, `pause`, `complete`, `withdraw`, `retire` | `growth_api.py:131-144` + `companion_v2/role_work/growth/management.py:19-27` |
| `…/relationships/command` | `review`, `adopt`, `retract`, `revise` | `companion_v2/relationships/management.py:18,114` |
| `…/memory/command` | `correct`, `retract`, `forget`, `pin`, `unpin` | `companion_v2/memory/management.py:298` |
| `…/memory/settings/command` | 无 action；`{operation_key, expected_edit_token, changes, reset_to_inherit?, layer?}` | `memory_api.py:350-366` |
| `…/semantic`（POST） | `configure`, `import`, `analyze`, `edit`, `delete`, `search`, `reindex` | `semantic_api.py:253-256` |
| `…/image-materials`（POST） | `register_reference`, `upload_reference`, `update_reference`, `reorder_references`, `withdraw_reference`, `register_wardrobe`, `withdraw_wardrobe`, `daily-outfit` | `image_material_api.py:99-124` |
| `…/persona/command` | `save`, `restore` | `persona_workshop_api.py:329` |
| `…/accounts/session` | 见 `account_session_api.py:save_session`（启停/人格覆盖等原生会话开关） | `account_session_api.py:42` |

---

## 2 quater. 并发令牌与确认机制（保存模型混乱的根源）

| 令牌/机制 | 出现次数 | 语义 | 出处示例 |
|---|---|---|---|
| `edit_token`（64 hex） | 49 | 分区/对象的乐观并发基线；保存时回传 | `configuration_api.py:162`、`reply_api.py:76` |
| `expected_edit_token` | 3 | 同一语义的另一个名字（memory 设置） | `memory_api.py:361` |
| `role_edit_token` | 2 | 角色层与窗口层同时存在时的第二把锁 | `state_api.py:151-153` |
| `settings_token` / `configuration_token` | 1 / 每个分区 1 | 只读快照指纹，用于「按当前解析值算预览」 | `state_api.py:159`、`companion_v2/configuration/management.py:194` |
| `view_token` | 14 | 动作类命令的行级视图指纹（防「看到旧的再点确认」） | `state_api.py:147`、`relationships_api.py:70` |
| `expected_revision`（int） | 22 | 行级乐观并发 | `growth_api.py:139`、`state_api.py:147` |
| `plan_token` / `preview_token` | 38 / 4 | 破坏性操作的「先预览再执行」两段式票据 | `legacy_api.py:514`、`setup_api.py:369` |
| `operation_key` | 全站写路由 | 幂等键（重放返回同一回执） | `configuration_api.py:162`、`reply_api.py:76` |
| `confirmed: true` / `confirmed_hash`（body 内） | 7 | 破坏性动作的二次确认 | `legacy_api.py:514`、`setup_api.py:370`、`backup_api.py:151-160` |
| 无令牌的写 | 少数 | `host-options/*` 用的是 `edit_tokens[group]` + `apply_modes` | `host_options_api.py:153-158` |

同一件事在插件的 5 个地方有 5 种「保存」写法：`{changes, edit_token}`、`{changes, role_edit_token}`、`{changes, expected_edit_token, layer}`、`{action, data, expected_revision, view_token}`、`{confirmed, plan_token}`。新 UI 若统一成一个「保存」按钮，必须自己维护 5 套 token 生命周期。

---

## 3. 操作清单（写路由 → 效果）

> 只列**写操作**（POST/会产生副作用的 GET 除外）。「重」= 会重启/重建运行时或长耗时。

### 3.1 引导与账号（安装级）

| 操作（旧 UI 按钮） | API | 效果 / 副作用 |
|---|---|---|
| 确认核心管理员窗口 | `POST /setup/binding/confirm` `{}` | 把「我会永远陪着你」那条私聊窗口绑成主窗口（`setup_api.py:470-484`） |
| 选择模型 | `POST /setup/model` `{provider_id}` | 写 `config.model.provider_id`（`setup_api.py:487-548`） |
| 逐任务配模型 | `POST /setup/model-tasks/configure` | 写角色的模型任务路由（`setup_api.py:766-779`） |
| 生成/保存角色卡 | `POST /setup/profile-draft`、`POST /setup/profile/save` | 模型生成 / 落盘角色与关系卡 |
| 初始化 profile | `POST /setup/prepare` `{}` | **重**：初始化运行时（`settings_error` 会挡住） |
| 标记步骤完成 | `POST /setup/complete` `{step, skipped}` | 只写进度文件（`setup_api.py:598-653`） |
| 重连宿主 | `POST /setup/host/start` `{}` | **重**：`controller.start()`（`setup_api.py:550-574`） |
| 主动消息试跑 | `POST /setup/proactive-test` `{enable_proactive}`、`/proactive-diagnostic`、`/proactive-test/confirm` | **重**：真发一条消息给管理员；会在**窗口层**把 `proactive.contact.enabled` 临时改成 true 再恢复（`setup_api.py:1174-1215`、恢复 `:1336-1380`），期间任何保存都可能让恢复失败 |
| 保存账号/会话/群映射 | `POST /accounts` | 全量重写 `multi_host`（`account_session_api.py:492-…`），**重建 V2 host** |
| 加角色 | `POST /accounts/role` | 追加 personas + 默认 `*` 私聊目标（`account_session_api.py:132-180`） |
| 合并/拆分私聊窗口 | `POST /accounts/window-link`、`/window-unlink` | 改 `window_links` |
| 启用/停用群目标 | 旧页面走 `POST /accounts` 带 `groups[]`（`pages/宿主管理/app.js:1684-1716`）；单条版本是 `POST /accounts/group-target` `{…,group_id,enabled}`（前端未用，`account_session_api.py:332-…`） | 写 `multi_host.group_targets`，**重建 host** |
| 会话开关 | `POST /accounts/session` | 改原生会话（启用/人格覆盖等） |
| 共享模型提供方 | `POST /accounts/model-provider` `{provider_id}` | 写 `multi_host` 的 provider |
| 装配/暂停扩展 | `POST /integration/lifecycle` `{extension_id, action, expected_revision, operation_key}` | 装配态迁移（`integration_api.py:35-…`） |

### 3.2 设置分区

| 操作 | API | 效果 |
|---|---|---|
| 保存任一配置分区 | `POST /config/configure` `{section, operation_key, edit_token, changes}` | 按层写入注册表；`apply_mode=next_task` 的分区要下一条消息才生效 |
| 审阅群习惯 | `POST /config/behavior/command` `{group_key, habit_id, enabled, revision}` | 只读写入行为学习结果 |
| 回复设置 | `POST …/reply/configure`（私聊=角色层；群=窗口层） | `companion_v2/conversation/reply_management.py:276-…` |
| 群插话/唤醒 | `POST …/reply/participation/configure` | 窗口层，`timing_apply_mode=next_accepted_input` |
| 预览分段 | `POST …/reply/preview` `{settings, text, image_count?}` | 纯本地，无模型（`reply_api.py:75`） |
| 记忆设置 | `POST …/memory/settings/command` | `layer` 只允许 role/window |
| 模型任务 | `POST …/model/configure` | 单任务路由（`model_api.py:373-406` 中共 33 条 model 路由） |
| 宿主语音/转发/余额/天气 | `POST /host-options/{voice,forward_intake,balance,weather}` | 直接写 `controller.config`，部分 `apply_mode=restart_host` |
| 存储位置/清理 | `POST /storage` | 写插件配置（`storage_api.py:28-29`） |
| 备份 | `POST /backup/create`、`/backup/restore` | 快照 / 待重启还原（`backup_api.py:30-35`） |
| 表情素材库 | `POST /semantic` | 导入/分析/检索/改删（≤7MB body） |
| 人格草稿 | `POST …/persona/command`、`/standardize`、`/tryouts`、`/style-rules` | 后三者**调用模型**（长耗时） |
| 成员权限 | `POST /acquaintance/{authorization,identity,admin-name,settings,open-loops}` | 逐人授权（`acquaintance_api.py:658-752`） |

### 3.3 群侧

| 操作 | API | 效果 |
|---|---|---|
| 群回复设置 | `POST …/reply/configure`（窗口层） | 与私聊同一套字段，层不同 |
| 群参与/唤醒 | `POST …/reply/participation/configure` | |
| 群模型 | `POST …/model/configure`（GroupModelWebAPI） | 只覆盖本群 |
| 群记忆治理 | `POST …/group-memory/{retract,safety/review,detail}` | 管理员撤回/复核 |
| V1 群数据 | `POST …/legacy-group-data/apply` | 仅 V1 数据存在且选中群目标时显示 |

---

## 4. 重复与冲突（同一设置的多条写入路径）

### 4.0 两套存储、两种并发保护（这是所有冲突的根）

| 存储 | 落点 | 并发保护 | 写入口 |
|---|---|---|---|
| **宿主编插件配置**（一个 JSON 文档，对应 `_conf_schema.json` 的 15 个分区） | `main.py:194-203` `_save_plugin_config()`：`config.clear()/update(candidate)` + `save_config()` | **没有 token、没有 revision**；全仓只有 `account_session_api.py:179`（`add_role`）与 `legacy_api.py:3650` 传过 `expected_config`（`multi_controller.py:739-740` 比对一次） | `setup/model`、`accounts/*`、`host-options/*`、`storage`、`weather`、`service_balance` |
| **V2 配置注册表**（SQLite 稀疏行，字段带 `FieldDefinition.layers`） | `companion_v2/configuration/service.py:132-200` `ConfigurationService.patch` | `edit_token = fingerprint(resolution + owner revisions + chain 变更序号 + actor + access tier)`（`service.py:106-120`），不匹配即 `configuration_revision_conflict`（`service.py:169`） | 各域 `…/configure` 与 `POST /config/configure` |

两条推论直接决定新 UI 的保存设计：

1. **`edit_token` 的粒度是「group × 目标链」而不是字段**。`ConfigTarget.chain()`（`companion_v2/configuration/models.py:115-126`）是 `INSTALLATION → ROLE → [RELATIONSHIP] → WINDOW`；因此**写角色层会让同 group 的窗口层 token 失效**（窗口链包含角色），反向不会。
2. **跨存储的同名字段没有任何冲突检测**：`model.provider_id`、`voice_reply.*`、`storage.*`、`weather.*` 在插件配置里是「后写覆盖」，在注册表里同名字段另有行。用户在 A 关掉语音开关、在 B 改语音 provider，两边都不会报错，只是各自生效一半。

只列**已在代码里验证**的重叠；每条给出两侧入口与存储位置。

| # | 设置/概念 | 写入口 A | 写入口 B | 存储 | 冲突后果 |
|---|---|---|---|---|---|
| 1 | 初始化/启动宿主 | `POST /setup/prepare`（`setup_api.py:575-597`）、`POST /setup/host/start`（`setup_api.py:550-574`） | `POST /host/initialize`、`POST /host/start`（`multi_api.py:294` → `controller.initialize_profile/start`） | 同一 runtime | 两条入口都能重建 host；同时调用会触发 `host_*_changed`，第二次被拒 |
| 2 | 模型 provider | `POST /setup/model`（`setup_api.py:487-548`） | `POST /accounts/model-provider`（`account_session_api.py:407-489`） | 插件配置 `config.model.provider_id` | **两条路由是同一段代码的副本**：都写 `model.provider_id`、都从 `additional_providers` 里删掉同 id 项、都在同值时清空 `fallback_provider_id`（`setup_api.py:515-528` vs `account_session_api.py:443-453`），都没有 token。`setup/model` 额外要求当前 step=`model`，`accounts/model-provider` 不限 |
| 2b | 「回复用哪个模型」 | —— | —— | AstrBot 会话 provider | **插件内不可写**：`model_api.py:481-485` 对 `kind=conversation.reply` 的 `provider/fallback/max_output_tokens/timeout_seconds/…` 直接返回 `model_configuration_host_managed`（字段表 `astrbot_host/core_reply_configuration.py:5-9`）。新 UI 的「模型」页只能管后台任务，不能管对话模型 |
| 3 | 逐任务模型 | `POST /setup/model-tasks/configure`（`setup_api.py:209`） | `POST …/model/configure`（`model_api.py:381`） | 同一 role 的模型任务路由 | 首个只作用于 setup 角色，第二个按角色挂载；字段名一致 |
| 4 | 群目标 | `POST /accounts` 带 `groups[]`（**前端唯一实际使用**：`pages/宿主管理/app.js:1684-1716`「保存群目标」、`:1768` 保存角色映射时也带 `groups`） | `POST /accounts/group-target`（`account_session_api.py:332-…`，前端从未调用） | `multi_host.group_targets` | 前者**整表替换**（少一条就删一条），且与「保存角色映射」共享 `accounts/personas/groups` 三个列表；后者单条幂等、带「群必须已在原生目录」校验。两条都会重建 V2 host |
| 5 | 账号/角色映射 | `POST /accounts`（全量） | `POST /accounts/{role,window-link,window-unlink,session}`（增量） | `multi_host.*` | 全量路由若不回传 `personas/window_links` 会用当前值兜底，但 `groups` 一旦提供就是替换语义 |
| 6 | 分段/回复表现 | 插件配置 `segmentation`（`_conf_schema.json`，11 字段）→ `HostSettings.common.segmentation`（`settings.py:112`） | `POST …/reply/configure`（`conversation.presentation` 组，90+ 字段） | 插件 config（种子默认） + V2 注册表（角色/窗口） | 同一个「是否分段/最多几条/间隔」在两处都能改；插件表单改的是**新会话的种子**，页面改的是**当前角色**，用户不会知道哪个生效 |
| 7 | 语音 | 插件配置 `voice_reply`（32 字段，`_conf_schema.json`） | `POST /host-options/voice`（4 字段，`host_options_api.py:28`）+ `conversation.presentation` 的 VOICE_FIELDS（`companion_v2/conversation/reply_settings.py:37-38`） | 插件 config + V2 注册表 | 三处同名概念；`host-options` 的 `apply_mode=restart_host` |
| 8 | 戳一戳 | 插件配置 `poke`（7 字段） | `POST /host-options/poke`（`host_options_api.py:29-30`） | 插件 config | 同键两写；且 poke 是 QQ 专属，微信下无事件源 |
| 9 | 天气源 | 插件配置 `weather`（8 字段） | `POST /host-options/weather`（`host_options_api.py:67-68`） | 插件 config | 同键两写 |
| 10 | 服务余额 | 插件配置 `service_balance`（4 字段） | `POST /host-options/balance`（`host_options_api.py:65-66`） | 插件 config | 同键两写；`balance/test` 是只读探测 |
| 11 | 存储位置 | 插件配置 `storage`（4 字段） | `POST /storage`（`storage_api.py:28-29`） | 插件 config | 同键两写；迁移路径需要重启 |
| 12 | 角色状态设置 | `POST …/state/command` 的 `configure`（可带 `role_edit_token`）、`configure_role`、`configure_window` | `POST /config/configure` 的 `life` 分区（`role.life` 组） | V2 注册表（`role.state` / `role.life` 两个组） | 同一页面的「状态/作息」被拆进两个 group，两个 token |
| 13 | 人格文本 | `POST …/persona/command`（草稿/版本，`persona_workshop_api.py:181`） | `POST /setup/profile/save`（角色卡字段）、AstrBot 原生人格（`/api/v1/personas`，宿主管） | 人格工坊 DB / 角色档案 / 宿主 personas | 三层文本：宿主人格、角色档案（role.profile 组）、工坊草稿；工坊草稿不进 AstrBot 人格，必须另存 |
| 14 | 记忆设置 | `POST …/memory/settings/command`（`layer=role\|window`） | `POST /config/configure` 无 `memory` 分区；但 `conversation.presentation` 内含记忆相关键 | V2 注册表（`memory` 组 vs `conversation.presentation` 组） | 概念重叠（上下文条目/字符数在两处都有） |
| 15 | 群唤醒词 | `POST …/reply/configure` 的 `group_wakeup_*`（角色或窗口层） | `POST …/reply/participation/configure` | V2 注册表（同组不同字段集） | 两个 token、两次保存；`group_participation` 分区还有 20 个重叠字段 |
| 16 | 主动联系开关 | `POST /config/configure` 的 `proactive.contact`（安装级） | `POST /setup/proactive-test`（`setup_api.py:1174-1215` 在**窗口层**把 `enabled` 改成 `true` 再恢复） | 注册表（安装/窗口两层） | 试跑是「临时改配置 + 事后恢复」：期间任何一页保存同窗口的 contact 设置会让恢复用的 `edit_token` 过期（`:1336-1380`），开关可能停在打开；中断后回执为 `unknown`（`:331-345`） |
| 17 | 扩展开关 | `POST /integration/lifecycle`（装配态） | `POST /extensions/configure`（配置态） | 装配记录 + `extensions/<id>/config.json` | 装配 ≠ 启用：装配后还要 `enabled` 才跑；`/extensions` 里 `runtime.state` 才是真相 |
| 18 | TTS Provider 定义 | `POST …/model/tts/providers/{create,update,clone}`（挂在每个角色路径下） | AstrBot 自带的 Provider 管理页 | **宿主全局 `provider_manager` 配置**，与角色无关 | 插件页面里改的是全局 Provider，另一个角色会一起受影响 |
| 19 | 回复模型 / 附加提示 | `POST …/model/configure`（`kind` + `changes`） | `POST …/reply/configure` 的 `style_prompt` / `humanized_expression_prompt` | 注册表 `conversation.presentation` | `model/configure` 传 `section` 时写的也是 `style_prompt`（`companion_v2/model_gateway/management.py:824-845`）→ 与回复页写同一字段 |

> 统计：18 条重复 + 1 条（2b）反向陷阱。按性质分：**同存储同层、有 token 拦**的 8 条（3/12/13/14/15/19 类）；**跨存储静默覆盖**的 7 条（2/6/7/8/9/10/11）；**整表替换无锁**的 4 条（1/4/5/18）。

---

## 5. 交互问题（API 层能证明的那些）

| # | 问题 | 具体位置 | 影响 |
|---|---|---|---|
| 1 | **导航与状态分属两个响应** | `page_api.py:171-186`（只给 10 个字段 + api 路径）vs `multi_controller.py:1297-1312`（才有 `accepting/failure_code/delivery_mode/授权`） | 首屏必须两个请求并自己 join；旧页面在 `product-page.js:575,592` 就是 `Promise.allSettled` 勉强拼 |
| 2 | **三种启动态** | `page/targets` 未初始化抛 `staging_not_initialized`（`page_api.py:139-141`）；`setup/status` 仍可用（`setup_api.py:331`）；已停止抛 `staging_host_terminated` | 新 UI 必须有「未设置 / 运行中 / 已停止」三态，否则首屏报错 |
| 3 | **群没有名字** | `GroupTarget` 只有 `group_id`（`group_settings.py:10-16`）；群名靠原生会话观测（`session_topology.py:358-360,562`）；OneBot 才补名（`display_names.py:42`） | 微信部署里群列表常显示 `10000000002@chatroom`；用户无法在页面给群改名 |
| 4 | **新群加不进来** | `account_session_api.py:366-377` 要求群先在原生会话目录里出现，否则 `account_group_target_unavailable` | 必须先让群里有核心回复，才会出现在可选项里（已知部署问题，我们打过补丁，上游没有） |
| 5 | **保存即重建** | `POST /accounts`、`/accounts/group-target` 走 `apply_bindings`（会重建 V2 host）；`host-options/voice` `apply_mode=restart_host` | 保存后几秒内其它请求可能失败，在途回复可能丢 |
| 6 | **错误码没有中文** | 后端只回机器码 + 英文 reason（`web_api.py:59-70`）；中文表散在 6+ 个页面的 `errors` 对象（`product-page.js:30`、`reply-page.js:466`、`config-editor.js:1668`、`state-page.js:7`） | 新 UI 要么复制这份码表，要么显示英文 |
| 7 | **5 套保存令牌** | 见 §2 quater | 每个域的「保存/冲突/重试」都要单独实现 |
| 8 | **同类操作返回结构不一致** | `POST /config/configure` 只回回执，要求重新 GET（`configuration_api.py:190-196`）；`POST …/reply/configure` 直接回 `status`（`reply_api.py:88-95`） | 前端刷新逻辑无法统一 |
| 9 | **列表全是游标分页** | `memory`、`state`、`group-memory`、`life` 用 `?limit&after_id`/`before` + `next_cursor` | 「全部」视图要自己翻页 |
| 10 | **字段是 JSON 字符串** | `group_wakeup_direct_words="[]"`、`important_dates="[]"`、`dedup_policies="a,b,c"`（`companion_v2/conversation/reply_settings.py:68-70`、`proactive/configuration.py:231,257`） | 前端要 parse/stringify，类型校验在保存时才炸 |
| 11 | **性能模式静默删路由** | `multi_api.py:266-270` 只注册 2 条，页面无任何 API 提示（只有 `/host/performance`） | 开了性能模式后新 UI 每个管理请求 404，错误信息还是「不可读取」 |
| 12 | **两套配置存储** | V2 注册表 vs 插件 config（§4 第 6-11 行） | 同一个开关两处可改，且 `apply_mode` 不同（立即 / 下次任务 / 重启 host） |
| 13 | **218 个错误码** | `grep -rhoE '(Outcome.failed|TaskError)\("…"'` 统计 | 无法穷举翻译；新 UI 只能覆盖高频码 |
| 14 | **响应体可能被包两层** | 前端不得已在 `reply-page.js:660-663` 探测 `{status,data:{status,data}}` | 旧桥接行为，新 UI 若复用它必须同样处理 |
| 15 | **`?sections=` 缺省返回全部分区** | `configuration_api.py:210-216` | 一个 GET 可能返回 158 字段的大对象；首屏不该无参调用 |
| 16 | **对话模型改不了** | `model_api.py:481-485`；字段表 `astrbot_host/core_reply_configuration.py:5-9` | 新 UI 若做「选一个模型」的框，它在对话上不会生效；只能管后台任务（日记/主动/学习），对话模型只能去 AstrBot 自己的 Provider/会话设置 |

---

## 6. 按条件显示清单（能力驱动，功能一个不少）

### 6.0 三条规则

1. **功能集合不变。** §2 的 235 行路由、它们背后的 7 个内置扩展（`content` / `image` / `reality` / `companion.screen.native` / `together` / `game` / `live`，见 `integration_catalog.py:20-59`）以及 QQ 专属能力，全部保留。新 UI 只决定**什么时候显示**、**放在哪一层**。
2. **三档可见性**：`总是` / `条件显示`（条件不满足时整块收起，不删路由、不删代码）/ `ADV`（默认收进「高级/诊断」，功能照旧可用）。
3. **条件一律用后端已有字段判定**；后端没有字段的能力单列在 §6.3「需新增探测」，不靠猜。

### 6.1 条件码总表

| 条件码 | 含义 | 判定来源（接口 → 字段） | 覆盖路由（§2 表行数） |
|---|---|---|---|
| `总是` | 任何部署都显示 | — | 151 |
| `ADV` | 默认收进「高级/诊断」分组 | 前端分组，无后端字段（功能不删） | 28 |
| `E:image` | 生图/相册扩展已装配并启用 | `GET /integration/manifest` → `extensions[extension_id="image"].enabled == true && runtime_ready == true`；辅证 `GET …/model/image` → `actions[].registered`、`module.state`（`model_api.py:992-1012`） | 20 |
| `QQ` | 平台是 QQ 个人号（OneBot / aiocqhttp） | `GET /page/targets` → `targets[].platform_id == "aiocqhttp"`（QQ 官方机器人是 `qq_official` / `qq_official_webhook`，见 `group_admission.py:13`、`binding.py:135-136`） | 11 |
| `V1` | 检测到旧版陪伴插件的数据 | `GET /setup/status` → `upgrade.present` / `upgrade.can_prepare`（`upgrade_setup.py:24-28`）；角色级 `GET …/legacy` → `install.phase != "new_user"`（`legacy_api.py:2064-2095`） | 12 |
| `G` | 当前目标是群 | `GET /page/targets` → `targets[].scope_kind == "group"` | 8 |
| `E:reality` | 现实设备扩展已装配并启用 | manifest `reality`；辅证 `GET /perception` → `providers.reality.available`（`perception_api.py:70-85`） | 2（模板；实际 16） |
| `E:screen` | 屏幕陪伴扩展已装配并启用 | manifest `companion.screen.native`；辅证 `providers.screen.available` | 2（模板；实际 4） |
| `E:game` | 共同游玩扩展已装配并启用 | manifest `game` | 2 |
| `E:content` / `E:together` / `E:live` | 创作 / 共处 / 直播扩展 | manifest 对应 `extension_id`（当前这三项没有独立的路由族，入口在 `/extensions` 面板与扩展自带页面里） | 0 条独占路由 |
| `多私聊窗口` | 有 ≥2 个私聊窗口或已存在合并关系 | `GET /accounts` → `sessions[]` 条数、`window_links[]`（`account_session_api.py:104-118`） | 2 |
| `TTS` | 存在可用的 TTS provider | `GET …/reply` → `tts` 非空（`reply_api.py:98`） | 0（语音开关本身总是显示，provider 列表为空时只显示「未配置」） |
| `DOC` | 文档解析器已安装 | `GET …/reply` → `documents`（`reply_api.py:101`） | 0（状态位，用于在理解页决定是否显示「可读文件」） |
| `WEB` | 网页理解配置可读 | `GET …/reply` → `web`（`reply_api.py:103-107`） | 0（同上） |

> 另有 3 个纯状态位，用来决定**文案/禁用态**而不是显隐：`GET /host/performance.enabled`（性能模式，`performance_mode.py:41-56`）、`GET /semantic.model_binding`（语义模型是否就绪，`semantic_api.py:223`）、`GET /config?sections=knowledge.knowledge_sources_available`（知识源是否可用，`configuration_api.py:240-252`）。

### 6.2 覆盖度核算（§2 的 235 行）

| 档位 | 行数 | 说明 |
|---|---|---|
| 总是 | 150 | 任何部署都可见 |
| 高级/诊断（ADV） | 28 | 默认收起，功能保留：`model/{maintenance,memory,balance,test,test/storage,laya*,image/observability,image/review/providers}`、`memory/{reflections*,archive*,import*,export,clear*}`、`reply/recalls`、`host/{preview,batches,probe}`、`setup/proactive-*`、`perception-native/news-diagnostic` |
| 扩展条件（E:image / reality / screen / game） | 26 | 扩展未装配 → 整块收起（路由仍在，进「能力」页可装配） |
| 平台条件（QQ） | 11 | `qzone-extension/*` 10 + `host-options/poke` 1 |
| 旧版数据（V1） | 12 | `legacy/*` 9 + `legacy-group-data/*` 2 + `setup/upgrade` 1 |
| 群目标（G） | 8 | `reply/participation*` 2 + `group-memory/*` 6 |
| **合计** | **235** | 与 §2 表行数一致；**没有任何一行被删除** |

> 这里的「行」是路径模板行。真实注册 305 条（多目标/多角色重复挂载 + `reality-access` 16、`screen-access` 4、`config` 4 的动态展开），条件判定对同一模板的所有实例同时生效。

### 6.3 需要新增的能力探测（现有字段不够用）

| 探测项 | 现有字段为什么不够 | 建议新增 |
|---|---|---|
| 平台能力矩阵（戳一戳 / QQ 表情 / OneBot 显示名查询 / @ 语法） | 只能靠 `platform_id` 字面量推断；`wechat_helper` 下调这些接口不报错但永远没有事件（`pokes.py:1`、`display_names.py:42` 都是 OneBot 专用） | `GET /host/capabilities` → `{platform, features:{poke, qq_reaction, display_name, mention}}` |
| 扩展自带页面地址（live/together/game/mihome 的 aiohttp 端口） | `/extensions` 只给 `runtime.state`（`native_extension_api.py:22-42`），不给 base URL；端口在各自配置里（6321/6331/18081/6322） | `/extensions` 的每个 `extensions.<id>` 增加 `web_url`（或 `/integration/manifest` 的 `extensions[]` 增加 `web_url`） |
| 群显示名 | `page/targets` 的 `display_name/group_name` 依赖原生会话观测（`session_topology.py:358-360`），微信下常为空；`GroupTarget` 没有名字字段（`group_settings.py:10-16`） | `GroupTarget.display_name`（可选，保存群目标时带上） |
| 性能模式是否生效 | 只有 `GET /host/performance` 一条独立请求 | 把 `enabled` 合进 `GET /page/targets` 或新的 `/page/overview` |

### 6.4 允许的界面减法（只合并入口/拍平层级，不删功能）

| # | 现状（重复或过深） | 新 UI 收成 | 相关路由（全部保留） |
|---|---|---|---|
| 1 | `setup/{prepare,host/start}` 与 `host/{initialize,start,stop}` 两组入口都能起停宿主 | 一个「启动/停止」按钮 + 一个「准备」步骤 | `setup_api.py:550-597`、`multi_api.py:294` |
| 2 | 群目标：`POST /accounts`（整表）+ `/accounts/group-target`（单条） | 群列表一个开关（内部用单条接口） | `account_session_api.py:332-…`、`:492-…` |
| 3 | 唤醒词：`reply/configure` 的 `group_wakeup_*` + `reply/participation/configure` 20 字段 + `/config{group_participation}` | 一个「群聊唤醒」卡片（两个 token 内部串起来） | `group_reply_api.py:37,43`、`configuration_api.py:105-106` |
| 4 | 模型：33 条 model 路由平铺在「模型与连接」 | 任务矩阵 + 连接测试一屏；图像/语音/Laya/搜索各归其能力页 | `model_api.py:373-406` |
| 5 | 语音三处：官方表单 `voice_reply`(32)、`host-options/voice`(4)、`reply` 的 VOICE_FIELDS | 一处「语音」页，标清「宿主默认 / 角色覆盖」 | `host_options_api.py:61`、`reply_api.py:26` |
| 6 | 主动联系：`/config{proactive.contact}` 158 字段 + `setup/proactive-*` | 「主动」页 6 个开关 + 一个「发一条测试」 | `configuration_api.py:102`、`setup_api.py:216-218` |
| 7 | 感知四处：`/perception`、`…/perception-native`、`…/screen-access`、`…/reality-access` | 一个「感知」页按 provider 分区 | `perception_api.py:27-28`、`native_perception_api.py:49-53`、`screen_access_api.py:21-25`、`reality_access_api.py:16-23` |
| 8 | 账号：`/accounts` + `/{role,session,window-link,window-unlink,group-target}` + `/setup/targets` | 一个「账号与会话」页 | `account_session_api.py:30-42`、`setup_api.py:205` |
| 9 | 人格三层：`persona/*` 8 条 + `setup/profile*` + AstrBot 原生 persona | 一个文本编辑器 + 版本列表 | `persona_workshop_api.py:180-193`、`setup_api.py:210-212` |
| 10 | 迁移：`setup/upgrade` + `legacy/*` 9 + `legacy-group-data/*` 2 | 「迁移」一页（V1 不存在时整页不出现） | `setup_api.py:204`、`legacy_api.py:144-154`、`legacy_group_data_api.py:32-33` |
| 11 | 诊断散在 5 处：`host/{preview,batches,probe}`、`model/maintenance|memory|balance`、`memory/reflections*`、`reply/recalls`、`extensions/action` | 一个「高级/诊断」抽屉，按域分组 | 见 §6.2 ADV 行 |
| 12 | 备份/存储/资料分开两页 | 「资料与维护」一页（存储 + 备份 + 待重启还原） | `backup_api.py:30-35`、`storage_api.py:28-29` |

---

## 7. 给新 UI 的建议

### 7.1 结构：三屏日常 + 「能力」条件页 + 「高级」抽屉（完整覆盖 235 行路由）

| 层 | 内容 | 主要接口 | 覆盖 |
|---|---|---|---|
| **状态**（首屏） | 运行中/已停止/未完成设置；每个会话一行（私聊 / 群名 / 开关）；启动、停止、重连、群目标开关 | `GET /setup/status`、`GET /page/targets`、`GET /host/status`、`POST /setup/{prepare,host/start}`、`POST /host/stop`、`POST /accounts/group-target` | 总是 |
| **角色** | 人格文本与版本、回复行为（分段/图片位置/清理）、记忆策略入口、角色档案 | `GET …/persona`、`POST …/persona/command`、`GET …/reply`、`POST …/reply/configure`、`GET …/memory/settings`、`POST /config/configure`（`role_profile`） | 总是 |
| **会话**（私聊/群同一套） | 唤醒词与续接、群参与、语音、群内模型覆盖、群记忆、成员权限入口 | `POST …/reply/configure`、`…/participation/configure`、`GET/POST …/model`（群）、`GET …/group-memory`、`GET/POST /acquaintance/*` | 总是 / G |
| **能力**（条件出现） | 生图与相册、衣橱、表情素材库、现实设备、屏幕陪伴、游戏、直播/共处/创作、QQ 空间 | `…/image-materials/*`、`…/model/image*`、`/semantic`、`…/reality-access/*`、`…/screen-access/*`、`…/game-access/*`、`/extensions/*`、`…/qzone-extension/*` | E:* / QQ |
| **高级**（抽屉，默认收起） | 诊断（对话预览、批次、探测、模型体检）、表达学习、记忆整理与导入导出、备份与存储、旧版迁移、感知素材与资讯诊断 | `host/{preview,batches,probe}`、`…/model/{maintenance,memory,balance,test*}`、`…/memory/{reflections,archive,export,import}*`、`/backup/*`、`/storage`、`…/legacy/*`、`…/legacy-group-data/*`、`…/perception-native/*` | ADV / V1 |

> 三层日常 + 两层收起，235 行路由全部有归属（逐条见 §8）。「能力」层是整个新 UI 的关键：**同一份代码在微信下只显示 2 个能力块，接 QQ 后自动多出 QQ 空间与戳一戳，装配 live/game 后自动多出对应块**，不需要改前端。

### 7.2 实现约定（避免重复踩坑）

1. **一个概念一个编辑位置（不是删接口）**：模型只走 `…/model/configure`（provider 用 `accounts/model-provider`）；群目标只走 `accounts/group-target`；分区只走 `config/configure`。§4 里其余入口后端全部保留、旧页面照旧可用，只是新 UI 不再提供第二个编辑点。
2. **保存 = `{changes, edit_token}`**：读一次拿 token，只发改动的键，成功后把返回/重读的 token 换掉。冲突（`*_conflict`/`*_changed`）时提示「已更新，重新加载」并重读，不做自动重试。
3. **`operation_key` 用 `域:目标:字段:值哈希`**，保证同一次点击重放不重复写。
4. **首屏串行**：`setup/status` → 成功才 `page/targets`；失败就渲染「未设置」向导，不再发其它请求（省掉 8 个必然失败的请求）。
5. **不轮询**：只在用户操作后刷新；唯一例外是「保存后重建 host」的 2-3 秒，用 `GET /host/status` 两次短轮询即可，别做常驻定时器。
6. **错误只用 12 个码**：`staging_not_initialized`、`staging_host_terminated`、`dashboard_identity_required`、`*_conflict`、`*_changed`、`*_invalid`、`*_required`、`host_provider_changed`、`account_group_target_unavailable`、`native_service_not_running`、`bridge_timeout`、其他 → 「操作没有完成，请重试」。其余 200 多个码在 UI 里不应单独出现。

### 7.3 建议后端补的 3 个小口子（不改旧页面，纯新增）

| 建议 | 理由 | 改动量 |
|---|---|---|
| `GET /page/overview`：`{host, targets, setup:{step,ready}, flags:{performance}}` | 把首屏 2-3 个请求合成 1 个，且自带 `performance` 标记（现在性能模式只能单独查 `/host/performance`） | 新 handler + 复用现有函数，≈60 行 |
| `GroupTarget.display_name`（可选字段，保存群目标时带上原生群名） | 微信下群名经常拿不到，UI 只能显示 `xxx@chatroom` | `group_settings.py` 加字段 + `save_group_target` 接受 + `page/targets` 输出 |
| `GET /host/capabilities`：`{platform: "wechat_helper", qq_features: false, native_extensions: [...]}` | 新 UI 需要按平台隐藏 qzone/poke；现在只能靠用户配置猜 | 读一次 platform metadata，≈30 行 |

> 这三条都不是重构，只是给新 UI 少发请求、少猜平台；旧页面完全可以不引用。

---

## 8. 功能完整性清单（新 UI 验收用）

> 口径：**用户能感知的功能点**，按域归并；「依赖接口」列出该功能用到的路由（模板见 §2）；「显示条件」引用 §6.1 的条件码。
> §2 的 235 行路由在本表全部有归属；本表也就是新 UI 的验收清单——每一行都要在新 UI 里能找到入口。

### 8.1 首次连接与向导

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 设置进度总览（步骤/绑定/模型/就绪） | 陪伴小屋 › 开始使用 | `GET /setup/status` | 总是 |
| 核心管理员窗口绑定 | 开始使用 › 绑定 | `POST /setup/binding/confirm` | 总是 |
| 旧版升级准备 | 开始使用 › 升级卡 | `POST /setup/upgrade` | V1 |
| 初始化/准备角色 | 开始使用 › 准备并启动 | `POST /setup/prepare`、`POST /host/initialize` | 总是 |
| 记录向导步骤完成 | 开始使用 | `POST /setup/complete` | 总是 |
| 重连宿主 | 开始使用 / 状态面板 | `POST /setup/host/start`、`POST /host/start`、`POST /host/stop` | 总是 |
| 初始模型选择 | 开始使用 › 模型 | `POST /setup/model` | 总是 |
| 逐任务模型（向导） | 开始使用 › 模型 | `GET /setup/model-tasks`、`POST /setup/model-tasks/configure` | 总是 |
| 角色卡/关系卡生成与保存 | 开始使用 › 档案 | `GET /setup/profile`、`POST /setup/profile-draft`、`POST /setup/profile/save` | 总是 |
| 账号/人格/会话目录 | 开始使用、宿主管理 | `GET /setup/targets` | 总是 |
| 主动消息试跑 | 开始使用、主动与联系 | `POST /setup/proactive-test`、`POST /setup/proactive-test/confirm` | ADV |
| 主动诊断（用途+确认） | 主动与联系 | `POST /setup/proactive-diagnostic` | ADV |

### 8.2 账号与会话

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 账号/角色/群/模型一览 | 账号与会话 | `GET /accounts` | 总是 |
| 保存角色映射（含账号/人格） | 账号与会话 | `POST /accounts` | 总是 |
| 新建角色 | 账号与会话 | `POST /accounts/role` | 总是 |
| 合并/拆分私聊窗口 | 账号与会话 | `POST /accounts/window-link`、`/window-unlink` | 多私聊窗口 |
| 启用/停用群目标 | 账号与会话 › 群聊目标 | `POST /accounts/group-target`（旧页面走 `POST /accounts`） | 总是 |
| 原生会话开关（启停/人格覆盖） | 账号与会话 › 会话管理 | `POST /accounts/session` | 总是 |
| 共享启动模型 | 账号与会话 | `POST /accounts/model-provider` | 总是 |
| 宿主探测/投递授权 | 状态面板 | `POST /host/probe`、`/host/authorize-delivery`、`/host/revoke-delivery`、`/host/authorize-group-delivery`、`/host/revoke-group-delivery` | 总是（探测=ADV） |
| 产品清单与扩展装配状态 | 能力目录 | `GET /integration/manifest` | 总是 |
| 装配/暂停/卸载扩展 | 能力目录 | `POST /integration/lifecycle` | 总是 |

### 8.3 回复与表达

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 回复设置（分段/间隔/图片位置/清理） | 表达 › 分段回复 | `GET …/reply`、`POST …/reply/configure` | 总是 |
| 分段预览 | 表达 › 分段回复 | `POST …/reply/preview` | 总是 |
| 语音回复开关与概率 | 表达 › 语音朗读、宿主管理 | `POST /host-options/voice`、`…/reply/configure` | 总是（provider 空时只读） |
| TTS provider 管理 | 模型与连接 › 语音 | `GET …/model/tts/providers`、`POST …/tts/providers/{create,update,clone}` | 总是 |
| 语音绑定与测试 | 模型与连接 › 语音 | `GET …/model/voice`、`POST …/voice/save`、`POST …/voice/test`、`POST …/tts/providers/test` | 总是 |
| 表情检索与配图 | 表达 › 表情配图 | `GET /semantic`、`POST /semantic`（search/edit） | 总是（`model_binding` 为空时只读） |
| 表情素材导入/分析/改删 | 学习与反思 › 语义目录 | `POST /semantic`（import/analyze/delete） | 总是 |
| QQ 表情格式 | 表达 › 表情配图 | `POST …/reply/configure`（`reactions_image_format=qq_emoji`） | QQ |
| 群聊表达（群内分段/语气） | 表达 › 群聊表达 | `POST …/reply/configure` | G |
| 唤醒词/直接称呼/兴趣词 | 决策 › 群聊参与 | `POST …/reply/configure`、`POST …/reply/participation/configure` | G |
| 群插话与参与 | 决策 › 群聊参与 | `GET/POST …/reply/participation[/configure]`、`GET/POST /config`（`group_participation`） | G |
| 沉默/忙碌闸门 | 决策 › 沉默策略 | `GET/POST /config`（`busy_gate`、`life`） | 总是 |
| 表达学习（规则/样本/导入导出） | 学习与反思 › 表达学习 | `GET/POST …/reply/{style,expression}*` | 总是 |
| 撤回记录 | 感知 › 撤回记录 | `GET …/reply/recalls` | ADV |

### 8.4 模型与连接

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 任务模型矩阵 | 模型与连接 | `GET …/model`、`POST …/model/configure` | 总是 |
| 群内模型覆盖 | 会话 › 群 | `GET/POST …/model[/configure]`（GroupModelWebAPI） | G |
| 文本 provider 目录与测试 | 模型与连接 | `GET …/model/catalog`、`POST …/model/test` | 总是（测试=ADV） |
| 图片动作开关 | 产出 › 画面 | `GET …/model/image`、`POST …/model/image/save`、`POST …/model/image/test` | E:image |
| 生图后端配置/测试/重连 | 产出 › 画面 | `GET/POST …/model/image/output[/save|/test|/reconnect]` | E:image |
| 图片调用观测 | 产出 › 画面 | `GET …/model/image/observability`、`GET …/model/image/review/providers` | ADV |
| 图像字段分组 | 产出 › 画面 | `GET …/model/image-schema` | E:image |
| 决策模型（Laya） | 模型与连接 › 决策 | `GET/POST …/model/laya[/save|/test|/decide|/logs]` | ADV |
| 搜索 provider 绑定 | 模型与连接 › 搜索 | `GET/POST …/model/search[/save]` | 总是 |
| 运行诊断（内存/余额/SQLite） | 治理与维护 | `GET …/model/maintenance`、`/model/memory`、`/model/balance`、`POST …/model/test/storage` | ADV |

### 8.5 记忆与关系

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 记忆事实流/详情 | 事实与经历 | `GET …/memory`、`POST …/memory/detail`、`POST …/memory/query` | 总是 |
| 记忆纠正/置顶/遗忘 | 事实与经历 | `POST …/memory/command` | 总是 |
| 记忆设置（角色/窗口两层） | 事实与经历 › 记忆策略 | `GET …/memory/settings`、`POST …/memory/settings/command` | 总是 |
| 记忆总览/证据源 | 事实与经历 | `GET …/memory/overview`、`POST …/memory/source` | 总是 |
| 反思批次与修复 | 事实与经历 › 整理与修复 | `GET …/memory/reflections`、`POST …/reflections/{retry,queue}` | ADV |
| 归档/恢复/清空/导入导出 | 事实与经历 › 整理与修复 | `GET …/memory/{archive/preview,clear/preview,export}`、`POST …/memory/{archive,archive/restore,clear,import,import/preview}` | ADV |
| 记忆修订历史 | 事实与经历 | `GET …/memory/revisions` | ADV |
| 群公共记忆（列表/详情/撤回/安全复核） | 关系与记忆 › 群 | `GET …/group-memory`、`POST …/group-memory/{detail,retract,safety/review}`、`GET …/group-memory/{operation,safety}` | G |
| 关系记忆（列表/审阅/撤回/修订） | 关系与记忆 | `GET …/relationships`、`POST …/relationships/command` | 总是 |
| 角色成长（提议/修订/状态流转/自评/进展） | 学习与反思 | `GET/POST …/growth[/command|/progress|/self-review]*` | 总是 |

### 8.6 状态、日程与日记

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 角色状态与日历 | 首页状态板、日记与生活 | `GET …/state`、`POST …/state/command` | 总是 |
| 状态天气 | 首页状态板 | `GET …/state/weather` | 总是 |
| 日记/睡眠/阅读 | 日记与生活 | `GET …/life`、`POST …/life/command` | 总是 |
| 日历/作息的细项设置 | 感知 › 时间与环境 | `GET/POST /config`（`life`、`conversation.perception`） | 总是 |

### 8.7 人格与成员

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 人格草稿/版本/恢复 | 自我 › 人格问卷 | `GET …/persona`、`POST …/persona/command` | 总是 |
| 人格标准化/情景试答/风格规则 | 人物设定工坊 | `POST …/persona/{standardize,tryouts,style-rules}` | 总是 |
| 角色档案迁移（预览/应用） | 自我 › 角色档案 | `POST …/persona/profile-draft|profile-migration-plan|profile-migration-apply` | 总是 |
| 成员目录 | 关系网 | `GET /acquaintance` | 总是 |
| 逐人授权 | 关系与权限 | `GET/POST /acquaintance/authorization` | 总是 |
| 成员私聊设置 | 关系与权限 | `GET/POST /acquaintance/settings` | 总是 |
| 管理分层与管理员昵称 | 关系与权限 | `POST /acquaintance/identity`、`/admin-name` | 总是 |
| 未了对话（open loops） | 关系网 › 人物 | `GET/POST /acquaintance/open-loops` | 总是 |

### 8.8 主动与感知

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 主动联系偏好（节奏/免打扰/问候/打卡） | 主动与联系 | `GET/POST /config`（`proactive.contact`） | 总是 |
| 主动试跑与诊断 | 主动与联系 | `POST /setup/proactive-test`、`/proactive-diagnostic`、`/proactive-test/confirm` | ADV |
| 感知 provider 设置 | 感知 | `GET/POST /perception` | 总是 |
| 原生感知（素材池/运行时/资讯诊断） | 感知 | `GET/POST …/perception-native*`、`GET /perception-native/materials` | 总是（诊断=ADV） |
| 屏幕授权与最近观测 | 感知 › 设备与授权 | `GET/POST …/screen-access[/configure]`、`GET …/screen-access/last-{observation,original}` | E:screen |
| 现实设备授权（8 项能力） | 感知 › 设备与授权 | `GET/POST …/reality-access/<capability>[/configure]` | E:reality |
| 游戏授权 | 行动 › 游戏 | `GET/POST …/game-access[/configure]` | E:game |
| 扩展设置面板（4 个扩展） | 家具 › 能力 | `GET /extensions`、`POST /extensions/{configure,action}` | 总是（内容随各扩展状态） |

### 8.9 内容、素材与 QQ 空间

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 图片素材库/相册 | 产出 › 相册 | `GET …/image-materials`、`GET …/image-materials/album` | E:image |
| 参考图上传/排序/撤回 | 产出 › 相册 | `POST …/image-materials/references/*` | E:image |
| 衣橱与今日穿搭 | 产出 › 衣橱 | `POST …/image-materials/{wardrobe,wardrobe/withdraw,daily-outfit}`、`GET/POST /config`（`wardrobe`、`photo.reference`） | E:image |
| QQ 空间（状态/信息流/点赞/评论/发布/回复/日程建议） | 行动 › 平台（`qzone-extension`） | `GET/POST …/qzone-extension/*` | QQ |
| 戳一戳回复 | 行动 › 平台、宿主管理 | `GET/POST /host-options/poke`、`GET /host-options` | QQ |
| 创作与作品（内容扩展） | 家具 › 创作 | `POST /integration/lifecycle`、`GET /integration/manifest`（无独立路由族） | E:content |

### 8.10 资料、诊断与迁移

| 功能 | 当前入口 | 依赖接口 | 显示条件 |
|---|---|---|---|
| 存储位置与清理 | 资料与维护 › 存储 | `GET/POST /storage` | 总是 |
| 备份（列表/创建/校验/预览/还原/待重启） | 资料与维护 › 备份 | `GET /backup`、`POST /backup/create`、`GET /backup/{inspect,restore/preview,pending}`、`POST /backup/restore` | 总是 |
| 服务余额源 | 治理与维护、感知 | `GET/POST /host-options/balance`、`POST /host-options/balance/test` | 总是 |
| 天气源 | 感知 › 时间与环境 | `GET/POST /host-options/weather` | 总是 |
| 合并转发解析上限 | 理解 › 合并转发 | `POST /host-options/forward_intake` | 总是 |
| 对话预览/批次 | 治理与维护 | `GET /host/preview`、`GET /host/batches` | ADV |
| 群行为审阅 | 决策（群） | `GET /config/behavior`、`POST /config/behavior/command` | G |
| 旧版探测/计划/导入/升级确认 | 资料与维护 › 旧版迁入 | `GET …/legacy`、`/legacy/{plan,data-plan,scope}`、`POST …/legacy/{auto,apply,upgrade-confirm,batch-apply,data-apply}`、`POST /setup/upgrade` | V1 |
| 旧版群数据导入 | 资料与维护 › 旧版迁入（群） | `GET …/legacy-group-data/plan`、`POST …/legacy-group-data/apply` | V1 + G |
| 记忆由哪个插件提供 | 事实与经历 | `GET /page/ownership` | 总是 |
| 工作区资源令牌刷新 | 主壳内部 | `GET /page/workspace-entry` | 总是 |

---

## 附录 A：死代码与未注册路由（排查用）

| 内容 | 位置 | 状态 |
|---|---|---|
| `/staging/*` 11 条（status/probe/initialize/authorize-delivery/…） | `web_api.py:96-130` | 不注册（`main.py` 只用 MultiController） |
| live 扩展 page API 14 条 | `native_extensions/live/page_api.py:178` | 不注册（调用点被改成 `pass`：`live/settings_methods.py:7-8`） |
| 米家 page API 14 条 | `native_extensions/reality/mihome_web_api.py:642` | 不注册（`reality/settings_methods.py:157-158` → `pass`） |
| reality 移动网关 32 条 `register_web_api` | `native_extensions/reality/mobile_gateway.py:1856-1887` | 不注册（实际走自带 aiohttp `:6322`） |
| V1 私聊记忆迁移 2 条 | `legacy_private_memory_api.py:18-19` | 只在旧单宿主路径被引用，当前不挂载 |
| V1 归档 1 条 | `legacy_archive_api.py:14` | 同上 |

## 附录 B：本报告的核对方式

- 路由表用 AST 静态提取全部 `routes()` 元组（227 条），再按 `multi_api.py:258-340` 的挂载规则展开为安装级/角色级，节点数 305。
- 请求字段逐个对照 handler 的 `_body({...})` / `set(data) != {...}` / `request.query` 白名单（例如 `configuration_api.py:160-164`、`reply_api.py:71-77`、`state_api.py:145-176`）。
- 动态路由（`reality-access` 8 能力、`screen` 观测子路由、`config` 分区）按源码循环单独展开并标注。
- 机器可读清单：`docs/ui-audit/api.items.json`（235 条，一条 = 一行路由模板，与 §2 行数一致）。每条带 `domain` / `layer` / `platform` / `condition`（对应 §6.1 条件码）/ `write`（是否写操作）/ `frontend`（前端是否引用）/ `handler` / `fields` / `note`。同路径多方法用 `api` 字段里的方法串表达；扩展自带路由（live/米家/手机网关）与 `  /staging/*` 作为单独条目列出，`condition` 标记其显隐条件。
- 「前端调用 vs 后端存在」的差集见附录 C（对齐结果）。

---

## 附录 C：前端 ↔ 后端交叉核对

### C.1 规模

| 指标 | 数值 |
|---|---|
| 页面目录 | 6（主壳 `pages/陪伴小屋` + 5 个既独立又作工作区的页） |
| 主壳侧栏分区 | 18（`pages/陪伴小屋/shell.js:113-136`） |
| 前端调用点 | ≈200 处（147 行表格，其中 23 行为行号范围合并） |
| 去重端点后缀 | ≈142（按「域 + 后缀」约 170） |
| 后端未被前端调用的路由 | ≤12 |
| 前端调用了但后端不可用的端点 | 10（5 条 100% 失败、4 条被壳内白名单拒绝、1 条路径写法问题） |

### C.2 前端调用了、发布运行时不存在（100% 失败）

生产入口只实例化 `AstrBotMultiController`（`main.py:148`），`/staging/*` 与「单目标基础域」（`/reply`、`/memory`、`/life`、`/persona` 的基础路径）都不注册。

| 调用点 | 表达式 | 说明 |
|---|---|---|
| `pages/陪伴小屋/screen-access.js:153` | `product.request("POST","staging/upgrade-screen",…)` | 屏幕上「升级屏幕陪伴」永远失败 |
| `pages/日记与生活/app.js:237`（= `workspaces/life/app.js:237`） | `bridge.apiGet("staging/status")` | 双重失败：后端未注册 + 壳内 life 白名单只放 `life`/`life/command` |
| `pages/日记与生活/app.js:234` | `bridge.apiPost("staging/"+name)`，name∈`probe/initialize/start/stop` | 同上 |
| `pages/关系与记忆/app.js:84` | `bridge.apiGet("staging/status")` | 同上（relationships 白名单） |
| `pages/陪伴小屋/perception-overview.js:1031` | `bridge.apiGet("reply/recalls")` | multi 只挂 `{role.reply_api}/recalls` → 404 |

> 这 5 条说明「旧页面的失败有一部分不是用户操作错误，而是调用了不存在的路由」。新 UI 不接这些已经失效的调用；**但它们背后的功能只要存在真实路由，就按 §6 的条件照常显示**（不要把「旧页面调错了」当成「该功能可以不做」）。

### C.3 后端存在、但被主壳工作区桥白名单拒绝

`pages/陪伴小屋/product-page.js:1092-1118` 是工作区 iframe 的**硬白名单**：每个工作区只能调自己那 1-2 条路由。

| 调用点 | 表达式 | 后端真实路由 | 拦截规则 |
|---|---|---|---|
| `pages/人物设定工坊/app.js:578` | `post("persona/tryouts")` | `{role.persona_api}/tryouts`（`persona_workshop_api.py:190`） | 只允许 `persona`、`persona/command`、`persona/standardize` |
| `pages/人物设定工坊/app.js:598` | `post("persona/style-rules")` | `…/persona/style-rules`（`:192`） | 同上 |
| `pages/宿主管理/app.js:846` | `api("POST","accounts/window-link")` | `/accounts/window-link`（`account_session_api.py:36`） | host 白名单只放 `accounts`、`accounts/model-provider` |
| `pages/宿主管理/app.js:860` | `api("POST","accounts/window-unlink")` | `/accounts/window-unlink`（`:38`） | 同上 |

> **对新 UI 的直接结论**：不要沿用「iframe + 每个工作区一个白名单」的结构。新 UI 若做成**单页**（直接经插件页桥请求），这 4 条限制不存在；若沿用 iframe，每加一个页签就要改一次白名单。

### C.4 路径写法问题

- `pages/陪伴小屋/maintenance-page.js:2135` `api("POST","/setup/proactive-diagnostic", …)` 带前导斜杠，同文件其余调用都不带（`modelPath()`，`:536-543`），会拼出 `…/astrbot_plugin_private_companion//setup/…`；同一动作在 `contact-page.js:2274` 写作 `"setup/proactive-diagnostic"`。
- `pages/陪伴小屋/app.js:2355` `QZONE_ROUTE='qzone-extension'` 是基础域回落；multi 下只有 `{role.qzone_extension_api}`。新 UI 用后者（QQ 平台条件下）。

### C.5 后端有、前端从未调用（功能保留；新 UI 必须补入口）

| 域 | 未被调用的路由 |
|---|---|
| `accounts` | `POST /accounts/group-target`、`POST /accounts/session` |
| `host` | `preview`、`batches`、`stop`、`initialize`、`probe`、`authorize-delivery`、`revoke-delivery`、`authorize-group-delivery`、`revoke-group-delivery` |
| `setup` | `GET /setup/model-tasks`、`POST /setup/model-tasks/configure` |
| `acquaintance` | `GET/POST /open-loops` |
| `model` | `GET …/catalog` |
| `memory` | `POST …/reflections/retry` |
| `backup` | `GET /backup/inspect` |
| `qzone-extension` | `scan-comments`、`reply-comment` |

> 反向差集这么小，说明旧前端的覆盖率很高。**新 UI 的验收标准不是「功能更少」，而是同样的功能集合下入口更少、层级更浅**：这 12 条要补入口（多数归入「高级」层），§8 已逐条列出。

### C.6 旧前端的四种保存模型（新 UI 只该取第一种）

| 模型 | 代表页面 | 证据 | 问题 |
|---|---|---|---|
| 读一次 → 草稿 → 显式保存 → `edit_token` 冲突 | 回复、模型、配置工作台 | `pages/陪伴小屋/reply-page.js:1265`（`endpoint: PREFIX + route`）、`config-editor.js:1740-1760` | 每个域的 token 生命周期各写一遍 |
| 即时命令（逐条提交，无整页保存） | 表达审阅（规则/样本逐条决策）、语义素材（逐图改删） | `expression-signals-page.js:265,323`（`/style/revise`、`/style/command`）；`semantic-page.js` 的 `action` 直发 | 与「草稿 + 保存」页混用，用户不知道哪些改动已经生效 |
| 条件轮询 | 记忆 8s（仅整合/事实视图可见时）、状态 3s/15s（编辑中暂停）、日记 3s、宿主 15s、向导 750ms×205 | `memory-page.js:219-227`、`state-page.js:524-527`、`日记与生活/app.js:191`、`宿主管理/app.js:1975`、`setup-guide.js:3316` | 每个页面各写一套定时器；`setup-guide` 的 750ms×205 是本仓库最重的轮询 |
| 两段式（先预览再确认） | 备份还原、迁移、主动诊断 | `backup_api.py:151-160`、`legacy_api.py:514` | 票据过期/中断后回执状态为 `unknown` |

