# 账号与会话工作区（host）只读审计

范围：`pages/陪伴小屋/workspaces/host/{index.html,app.js,style.css}`（app.js 1979 行）、`astrbot_host/account_session_api.py`（606 行），旁证 `astrbot_host/{multi_api.py,multi_controller.py,multi_settings.py,group_settings.py,group_delivery.py,session_topology.py,setup_api.py}`、`pages/陪伴小屋/{product-page.js,embedded-bridge.js}`。
分支 wechat / HEAD 2e29e3f。**只读**：本文档是唯一写入。
口径：本次是**兼容 + 页面重构**，不是砍功能。第 6 节写「按条件显示」，第 8 节是功能完整性验收清单。

---

## 1. 视图清单

### 1.0 这个工作区到底管几件事（问答 1）

一个页面、一个 iframe、无弹窗无向导，但并列承担 **7 件事**，其中 3 件是「没有 UI 的隐性职责」。

| # | 管的事 | 具体内容 | 进入门槛 | 证据 |
|---|---|---|---|---|
| 1 | 宿主运行状态 | 连接态 / 运行态 / 是否接收消息 | 仅需 admin 身份（`dashboard_identity_required`），不需要 initialize、不需要任何配置 | multi_api.py:218-231、account_session_api.py:41-47 |
| 2 | 宿主启停 | 「准备并启动」（无停止按钮） | 需 `status.enabled && !status.settings_error` + 有可用 provider + 当前未 accepting | app.js:1345-1347、app.js:1814-1823、app.js:1825-1847 |
| 3 | 共享启动模型 | 选 provider 并固定 | 需读到 providers（`text_provider_catalog`）；无 provider 时按钮禁用 | account_session_api.py:82-104、app.js:1269-1310 |
| 4 | Bot 账号 / 角色 / 人格映射 | 单账号多角色、多账号分别配角色、人格勾选、角色命名 | 需 `GET accounts` 成功（内含 SetupWebAPI 会话目录发现） | account_session_api.py:106-137、app.js:1364-1535 |
| 5 | 会话窗口目录与角色归属展示 | 三列拓扑（账号 / 角色人格 / 会话窗口）+ 连线 | 需 `discovered.targets` 非空；**宿主组装后只返回已配置路由**（见 5.3） | app.js:288-397、app.js:735-770、session_topology.py:417-419 |
| 6 | 群目标开关 | 勾选哪些群接入 V2 | 需 `discovered.targets` 里有 `scope_kind=="group"` 或已配置 `groups` 非空 | index.html:101-108、app.js:1566-1682 |
| 7 | 窗口合并 / 群成员关系网 / 置顶 | 私聊窗口合并（role/primary）、群内成员与熟人卡、置顶偏好 | 合并：仅私聊 session 且有多于 1 个私聊窗口；关系网：群 session + `catalog.acquaintance_api` 非空；置顶：localStorage | app.js:793-831、app.js:937-1014、product-page.js:1097、embedded-bridge.js:8 |

「必须先 initialize」的真相：**用户可见层面不存在这一步**。`POST host/start` 在 `host_not_initialized` 时自己 initialize（multi_controller.py:904-911）；前端也没有 initialize 按钮（app.js:1825-1847）。`/host/initialize`、`/host/probe`、`/host/stop` 三条路由（multi_api.py:292-295）在本页**无调用方**。
真正隐性的门槛是：**任何一次保存映射都会走 apply_bindings，它内部 close → initialize(reviewed) → save → initialize_profile → start**（multi_controller.py:732-828），即保存 = 一次完整重启。

### 1.1 视图 / 分区清单

| 视图 / 标签 / 分区 | 怎么进来 | 用途一句话 | 主要组件 | 代码位置 |
|---|---|---|---|---|
| 连接徽标 | 常驻页头 | 桥是否就绪 | `#connection`（连接中/插件连接正常/未连接） | index.html:14、app.js:1794、app.js:1897 |
| 状态面板 | 常驻 | 三格状态 + 安全说明 | `#status-heading`、`#profile`、`#runtime-state`、`#accepting`、`#safety-note` | index.html:18-26、app.js:1792-1812 |
| 「准备并启动」 | 状态面板右上；`isEnabled() && !accepting` 时显示 | 启动宿主 | `#start-host` | index.html:19、app.js:1814-1823 |
| 「刷新状态」 | 状态面板右上 | 手动重读 status+accounts | `#refresh` | index.html:19、app.js:1910-1917 |
| 共享启动模型 | 常驻第二个面板 | 把 provider 固定进 `config.model.provider_id` | `#shared-model-provider`、`#save-shared-model`、`#shared-model-note` | index.html:28-38、app.js:1269-1343 |
| 角色映射编辑器 | 拓扑面板内第一个分区 | 按 Bot 账号建角色、勾人格 | `#edit-accounts`、`.account-binding-card`、`.role-binding-card`、`#hide-unlinked-personas`、`#save-bindings` | index.html:53-61、app.js:1364-1535、app.js:1722-1747 |
| 三列拓扑 | 拓扑面板主体，`hasTopology` 时显示 | 账号→角色/人格→窗口的连线视图 | `#topology-canvas`、`#topology-accounts`、`#topology-roles`、`#topology-sessions`、`#topology-links`(SVG) | index.html:67-100、app.js:288-397、app.js:646-726 |
| 会话筛选 | 拓扑第 3 列头 | 全部/私聊/群聊，带计数 | `[data-session-filter]` | index.html:88-92、app.js:604-609 |
| 会话分页 | 第 3 列底部，>5 条时显示 | 每页 5 个窗口 | `#topology-session-prev/next/page` | index.html:94-98、app.js:149、app.js:592-630 |
| 拓扑详情抽屉 | 点任意拓扑节点 | 节点元信息 + 关联节点跳转 + 置顶 | `#session-manager`、`#session-manager-related`、`#topology-pin-session` | index.html:110-114、app.js:869-935 |
| 用户窗口合并 | 抽屉内，选中私聊窗口时显示 | 把另一私聊窗口并到当前窗口 | `#window-link-mode`、`#window-link-aliases`、`#window-link-save`、`#window-link-unlink` | index.html:115-124、app.js:793-867 |
| 群成员与关系网 | 抽屉内，选中群窗口时显示 | 群内成员、接话边、熟人卡、未匹配线索 | `#session-group-network-content` + 内联 SVG | index.html:125-129、app.js:937-1164 |
| 群聊目标 | 有群行或已配置群时显示 | 勾选哪些群接入 V2 | `#group-target-list`、`#save-group-targets` | index.html:101-109、app.js:1634-1720 |
| 空态 | 无账号/角色/窗口时 | 「还没有账号与会话链路」 | `#topology-empty` | index.html:63-66、app.js:752-760 |
| 全局通知条 | 常驻顶部，有文案才显示 | 所有操作回执与失败 | `#notice` | index.html:16、app.js:1250-1255 |

无弹窗、无 dialog、无向导步骤；「分步」只体现在 JSDoc 注释里（app.js:1231「三步完成配对」属手机页）。

---

## 2. 设置项 / 数据项

### 2.1 四层数据模型的关系（问答 2）

```
accounts  (platform_id, account_id=Bot 登录号, bot_id=逻辑 Bot)
   │  1..n
personas  (bot_id, persona_id=AstrBot 人格, role_id=V2 角色/记忆归属)
   │  1..n                                    ← window_links 只作用于 targets
targets   私聊窗口 (target_id, platform_id, account_id, bot_id, participant_id)   participant_id 可为具体用户或 "*"
group_targets 群目标 (target_id, platform_id, account_id, bot_id, group_id)
```

| 概念 | 定义 / 约束 | 与其它三者的关系 | 证据 |
|---|---|---|---|
| `accounts` | 三元组；不允许重复 `(platform_id, account_id)` | 是 `personas.bot_id`、`targets`/`group_targets` 归属的唯一合法来源；`personas` 的 bot 集合必须是 accounts 子集 | multi_settings.py:246-273、multi_settings.py:303 |
| `personas` | `role_id` 是自由文本，≤128；同一 `(bot_id,persona_id)` 唯一 | 决定「人格 → 角色」；同一 `role_id` 跨 bot 会被规范化为同一角色（shared role merge） | multi_settings.py:50-80、multi_settings.py:234-243、multi_settings.py:313-320 |
| `targets`（私聊） | `participant_id=="*"` 是通配：任何私聊该 Bot 的用户都命中模板；具体值则精确匹配 | 一个私聊窗口 = 一个 target；`window_links` 只能引用 target | multi_settings.py:354-366、multi_settings.py:83-108 |
| `group_targets`（群） | 5 个字段必填，`target_id` 需匹配 `PROFILE_PATTERN` | 与 private 并列进 `all_targets`；群没有 `participant_id`，也没有独立人格文本 | group_settings.py:10-58、multi_settings.py:128-129、multi_api.py:180-186 |
| `window_links` | `primary_target_id` + `alias_target_ids[]` + `mode∈{role,primary}`；一个窗口只能被合并一次 | 只影响私聊；`role` 只共享角色，`primary` 让主窗口接管回复与主动联系 | multi_settings.py:83-108、app.js:796-830 |

`target_id` 怎么生成（前端不参与，全部后端算）：

| 场景 | 生成式 | 证据 |
|---|---|---|
| 保存时改写已有/新增窗口 | `kind + "-" + digest((platform_id, account_id, peer))[:20]`，`kind∈{private,group}`，已存在的沿用旧 id | account_session_api.py:560 |
| 新增角色时补的私聊模板 | `"private-" + digest((platform_id, account_id, "*"))[:20]` | account_session_api.py:172 |
| 启用新群 | `"group-" + digest((platform_id, account_id, group_id))[:20]` | account_session_api.py:378 |

推论（对重构重要）：`role_id` 会进 `digest(role)` 拼出该角色全部域路由（memory/reply/model/…），改名等于换一套地址（multi_api.py:150-190）。所以角色名在 UI 上是文本输入（app.js:1364-1395），语义却是**稳定主键**。

`group_delivery_authorization` 是什么：`target_inventory()` 给每个群目标附带的字典（`authorized/capability/revision/expires_at`），由 `GroupDeliveryAuthority.status(target)` 算（multi_api.py:148-151、group_delivery.py:60-66）。正式版已取消逐群授权闸门——`access()` 注释明写「群聊投递不再需要逐群授权，只要求它是个配置里的群目标」，`status()` 恒返回 `authorized: True`（group_delivery.py:50-66）；`authorize/revoke` 只写一条不参与放行的意愿记录（group_delivery.py:44-70）。

**authorization 何时需要点击：不需要。** `/host/authorize-delivery`、`/host/revoke-delivery`、`/host/authorize-group-delivery`、`/host/revoke-group-delivery` 四条路由（multi_api.py:292-297、multi_controller.py:1183-1212）在整个 `pages/` 目录里**零调用方**（grep 无命中）；`authorize_delivery` 的 15 分钟 TTL（settings.py:27）也没有 UI 消费。私聊授权同理。

### 2.2 设置项 / 数据项清单

| 字段 | 界面标签 | 位置 | 读 API | 写 API | 层级 | 默认值（来源） | 我方是否需要 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `multi_host.enabled` | 无控件 | — | GET host/status `.enabled` | POST accounts `{enabled:true}`（写死 true） | 安装 | `false`（_conf_schema.json:127-131、multi_settings.py:223） | 待定 | UI 只会写 true，从不显示开关 |
| `multi_host.accounts[]` | 「Bot 账号」卡片标题 | index.html:59 | GET accounts `.discovered.accounts` | POST accounts `accounts[]` | 账号 | 空（由发现自动带出） | 要 | 无增删控件，完全来自发现 |
| `multi_host.targets[].target_id` | 不可见 | — | GET accounts `.sessions[].target_id` | POST accounts（`sessions` 缺省 → 后端保留旧值） | 窗口 | 后端生成见 2.1 | 要 | 前端从不发送 `sessions` |
| `targets[].participant_id` | 「私聊 / 群聊」过滤只读 | app.js:604 | GET accounts `.sessions[].participant_id` | 同上 | 窗口 | `"*"`（account_session_api.py:172、:566-570） | 要 | 现状永远是 `"*"`：任何私聊都会成为受管窗口 |
| `multi_host.group_targets[]` | 「群聊目标」勾选 | index.html:101-108 | GET accounts `.groups` | POST accounts `groups[]`（后端另有 POST accounts/group-target，**无调用方**） | 群 | `[]`（group_settings.py:39-58） | 要 | 见 5.3 |
| `multi_host.personas[]` | 「角色名」输入 + 人格复选框 | index.html:55-60 | GET accounts `.personas`/`.discovered.personas` | POST accounts `personas[]` | 角色 | 空；**至少要 1 条**否则 `host_mappings_required`（multi_settings.py:275） | 要（可自动生成 role_id） | `role_id` 是主键不是标签 |
| `multi_host.window_links[]` | 「合并方式」「要合并的窗口」 | index.html:115-124 | GET accounts `.window_links` | POST accounts/window-link、accounts/window-unlink | 窗口 | `()`（multi_settings.py:122） | 待定 | 单私聊窗口时无意义；且被父级白名单挡（5.4） |
| `model.provider_id` | 「插件启动模型」下拉 | index.html:33-34 | GET accounts `.model.provider_id` | POST accounts/model-provider | 安装 | 空 → `provider_source:"auto"` 跟随 AstrBot 当前模型（account_session_api.py:82-104） | 待定 | 与 setup/model、models 页同一字段（见 4.2） |
| `capabilities` | 无 | — | — | — | 角色 | 默认注入必需集（multi_settings.py:307-311） | 不用 | 完全隐式 |
| `group_delivery_mode` | 无 | — | GET host/status `.group_delivery_mode` | — | 安装 | 硬编码 `"onebot_group"`（multi_settings.py:330） | 不用 | OneBot 语义 |
| `installation_id` | 无 | — | GET host/status `.installation_id` | — | 安装 | `"main"`（_conf_schema.json:132-138） | 不用 | `invisible:true`，配置页不显示 |
| 原生会话 `llm_enabled` / `session_enabled` / `persona_id` | 只在窗口卡片 detail 里当文案 | app.js:531-533 | GET accounts `.discovered.targets[]` | **无 UI**（后端 POST accounts/session 有路由但零调用方） | 窗口 | AstrBot 侧重（`services.get(...,True)`，session_topology.py:601-603） | 待定 | 是「能读不能改」的落差 |
| 置顶窗口 | 「置顶窗口 / 取消置顶」 | index.html:114 | — | localStorage | 浏览器本地 | 空集合（app.js:150、app.js:157-175） | 待定 | 与配置无关的纯偏好 |

### 2.3 「一个 bot 一个角色」时哪些字段是真冗余（问答 2）

| 字段 | 单 bot 单角色时的状态 | 判断依据 |
|---|---|---|
| `accounts[].bot_id` | 完全冗余：无绑定时会由 `derive_bot_id(account_id)` 推导 | session_topology.py:135 |
| `accounts[]` 整张表 | 冗余到 1 行；前端也不给增删，纯由发现带出 | app.js:1478-1503 |
| `personas[].role_id` 的**用户输入** | 冗余：单角色时可固定派生（`persona_id` 或常量），不必让用户命名 | app.js:1364-1395 是唯一输入口；约束 multi_settings.py:296-303 |
| `targets[].target_id` | 冗余：对管理界面无意义，仅内部定位 | _conf_schema.json:146-150 注释「只能用于管理定位」 |
| `targets[].participant_id` | 真正必要（决定哪些私聊进入 V2），但现状恒为 `"*"`，等于「不设防」 | account_session_api.py:562-570 |
| `window_links[]` | 完全冗余（只有 1 个私聊窗口时无对象可合并） | multi_settings.py:88-99 |
| `group_targets[]` | **必要**，是唯一决定「哪些群接入」的数据 | multi_settings.py:128-129、multi_controller.py:948-960 |
| `enabled` | 必要但不必给控件（保存即 true） | app.js:1695、app.js:1765 |
| `model.provider_id` | 必要（启动上游），但 `auto` 跟随已覆盖大多数情况 | account_session_api.py:82-104 |

---

## 3. 操作清单

### 3.1 保存模型（问答 3）

| 问题 | 结论 | 证据 |
|---|---|---|
| `POST accounts` 是整体应用还是逐项？ | **审阅后整体应用**：请求体 `{enabled, accounts, personas, groups(, sessions)}` 整段替换 `multi_host` 四个列表 | account_session_api.py:526-558（`section.update(...)` 在 552-556） |
| 有没有 revision / expected_revision？ | **没有**。只有 `add_role` 传 `expected_config=deepcopy(config)` 做比对（冲突抛 `legacy_plan_stale`）；`save()`、`save_group_target()`、`link_window()`、`unlink_window()` 都**不带** expected_config → 并发编辑静默后写覆盖 | account_session_api.py:196、:208；multi_controller.py:735-737、:745、:768；对照 account_session_api.py:281、:350、:396、:548 |
| 前端发的是什么？ | 两个按钮都是「整体应用」：保存角色映射发 `{enabled:true, accounts:mappedAccounts(), personas:activeRoleAssignments(), groups:bindingConfig.groups}`；保存群目标发同样的四段但 `groups` 取勾选值 | app.js:1762-1767、app.js:1690-1697 |
| 哪些操作会重建 V2 host？ | **所有 bindings 写操作**：POST accounts、accounts/role、accounts/group-target、accounts/window-link、accounts/window-unlink 全部落到 `controller.apply_bindings` | account_session_api.py:208、:281、:333、:358、:396、:548 |
| 重建具体做什么（中断风险） | `_accepting=False` → `session.close(grace_seconds=2)` → 新 manifest `initialize(reviewed=True)` + `save_plugin_config` → `runtime.close()` 后重开 → **注销并重注册全部 web 路由** → `initialize_profile()` → `start()` | multi_controller.py:748-828（close 757-760；save 782-786；路由重挂 800-804；重启 812-826） |
| 唯一不重启的写 | `POST accounts/session`：只写 `sp` 的 `scope=umo` 会话设置，返回 `requires_reload:false`。**全仓无调用方** | account_session_api.py:330-401（写入 369-390）；grep `accounts/session` 在 `pages/` 无命中 |
| 前端轮询 | 15s 一次 `GET accounts`，条件：非 busy、无未保存草稿、无选中节点、页面可见 | app.js:1975-1978 |

结论：**线上风险集中在「保存」按钮**——每次保存都是一次 2 秒 grace 的停机重启，期间入站消息不被受理，且保存失败时旧会话已关（`apply_bindings` 只在 `legacy_plan_stale` 且原本 accepting 时尝试恢复，multi_controller.py:711-730）。新 UI 若保留「保存角色映射 / 保存群目标」两个整体应用按钮，必须保持同样的失败回执语义。

### 3.2 操作清单

| 按钮 / 动作 | API | 效果（含是否重建宿主） | 保存模型 | 代码位置 |
|---|---|---|---|---|
| 打开页面 / 刷新状态 | GET `host/status` → GET `accounts` | 只读；accounts 内部再跑一次会话目录发现 | 无 | app.js:1849-1863、app.js:1749-1755 |
| 准备并启动 | POST `host/start`（超时 120s） | 未初始化则自动 initialize，然后 start；不动配置 | 无（幂等，已 running 时直接返回） | app.js:1825-1847、multi_controller.py:895-935 |
| 固定共享模型 | POST `accounts/model-provider` | 写 `config.model.provider_id`，随后尝试 `initialize_profile()`；host 在跑时返回 `restart_required:true` 延后生效。**不重挂路由，但会尝试 initialize** | 单字段，非整体 | app.js:1312-1343、account_session_api.py:460-524 |
| 保存角色映射 | POST `accounts`（整体） | apply_bindings：停机 → 重建 → 重新 initialize → 重启；返回 `started/requires_initialize/startup_error` | 整体应用，无 revision | app.js:1762-1789、account_session_api.py:526-606 |
| 添加角色（卡片内） | 无 API，纯 DOM | 只在本地加一张空角色卡，仍需「保存角色映射」 | 草稿 | app.js:1441-1445 |
| 移除角色 | 无 API，纯 DOM | 移除卡片并标记 dirty | 草稿 | app.js:1372-1379 |
| 隐藏未关联窗口的人格 | 无 API | 纯前端过滤 | 无 | app.js:1505-1520、index.html:56 |
| 保存群目标 | POST `accounts`（整体，`groups` 取勾选） | 同「保存角色映射」：停机重建重启 | 整体应用 | app.js:1684-1720、account_session_api.py:526-606 |
| 群目标单条开关（后端有，前端无用） | POST `accounts/group-target` | 单群增删 → apply_bindings（仍会重建宿主） | 单条 | account_session_api.py:403-458（零调用方） |
| 合并窗口 | POST `accounts/window-link`（超时 60s） | 改 `window_links`（`role` 模式还会改写别名窗口的 `role_id`）→ apply_bindings 重建 | 单条链接 | app.js:839-853、account_session_api.py:219-282 |
| 解除合并 | POST `accounts/window-unlink` | 按 `primary_target_id` 删链接 → apply_bindings 重建 | 单条 | app.js:855-867、account_session_api.py:284-306 |
| 置顶 / 取消置顶 | 无 API | 写 localStorage，重排当前列表 | 浏览器偏好 | app.js:1875-1889 |
| 选节点 / 悬停高亮 / Esc 关闭 | 无 API | 纯前端选择态 | 无 | app.js:455-486、app.js:1959-1963 |
| 会话筛选 / 翻页 | 无 API | 纯前端 | 无 | app.js:606-630、app.js:1920-1938 |
| 群成员关系网（自动） | GET `acquaintance` | 只读；失败落「成员目录暂不可读取」+ 重试 | 无 | app.js:1166-1177、app.js:937-1014 |
| 后台常驻能力（无 UI） | POST `accounts/role`（只被 setup-guide 用）、POST `accounts/session`、POST `host/probe`、`host/initialize`、`host/stop`、`host/authorize-*`、`host/revoke-*`、GET `host/performance` | 路由存在、页面不调用 | 各自单条 | multi_api.py:289-297、account_session_api.py:31-40、setup-guide.js:906 |

---

## 4. 重复与冲突（含跨区域，问答 8）

### 4.1 工作区内部

| 重复/冲突 | 表现 | 证据 |
|---|---|---|
| 同一个「账号 ↔ 人格 ↔ 窗口」讲了两遍 | 上半部是编辑器（可勾选），下半部是三列拓扑（只读连线），同一份数据两套 DOM | index.html:53-61 vs 67-100；app.js:1536-1564 与 app.js:735-770 同时渲染 |
| 会话窗口出现两处状态文案 | 拓扑卡片 detail、详情抽屉 state、编辑器 checkbox 三处各自拼「人格→角色·来源·映射·运行」 | app.js:525-533、app.js:928-934、app.js:1386-1400 |
| 「运行中」说两次 | `#runtime-state` 与 `#accepting` 语义重叠（后者只是 running 的布尔 | app.js:1798-1799、multi_controller.py:1308 |
| 群目标两条写路径 | 前端走整体 `POST accounts`；后端的单条 `POST accounts/group-target` 无人用，两者校验口径一致但错误码不同（`account_group_target_*` vs `account_config_invalid`） | app.js:1695 vs account_session_api.py:403-458、:545-553 |
| 角色创建两条写路径 | 整体 `POST accounts`（本页）vs 单条 `POST accounts/role`（setup-guide 用），后者带 `expected_config` 前者不带 | account_session_api.py:145-217、setup-guide.js:906-912 |

### 4.2 跨区域（只记位置）

| 内容 | host 工作区 | 另一处 | 说明 |
|---|---|---|---|
| 角色 / 人格映射 | POST `accounts`（app.js:1762） | 「开始使用」setup-guide.js:906 POST `accounts/role`；GET `accounts` setup-guide.js:912 | 两套编辑器写同一份 `multi_host.personas` |
| 启动模型 provider | 「共享启动模型」POST `accounts/model-provider`（app.js:1322） | setup-guide.js:3732 POST `setup/model`（setup_api.py:487-517 写同一 `config.model.provider_id`）；models-page.js:40 文案又指回「账号页固定」 | 同一字段三个入口，其中 setup 还要求 `status.step=="model"`（setup_api.py:499-501） |
| 宿主启停 | 「准备并启动」POST `host/start`（app.js:1831） | setup-guide.js:3753 POST `setup/host/start`（重连）；embedded-bridge.js:70 强制隐藏 `#start-host/#stop-host` | 三个地方能起宿主 |
| 群目录 / 群成员 | 「群聊目标」+ 抽屉「群成员与关系网」（app.js:1634、app.js:937） | 「关系网 → 群聊」`#manage/identity-groups`（app.js:1740、app.js:3882）走 identity 工作区 | 同一批群，两个工作区各有一套展示 |
| 运行状态 / 诊断 | 状态面板（app.js:1792） | 「治理与维护」maintenance-page.js（3720 行，含 staging/运行回执文案，其 166 行还指着「先在账号与会话中初始化」） | 状态口径两份 |
| 会话/账号设置的旧面板 | 本工作区 | **pages/宿主管理/** 是 tools/sync_framework_page.py 生成的同名副本（按任务书不重复审计，`tools/check_host_management_page.cjs:11` 以它为被测目录） | 同一 UI 两份静态副本 |
| 备份/存储 | — | `#manage/data`（app.js:4288-4310、backup-page.js:63 文案指向「账号与会话」） | 仅文案交叉引用 |

---

## 5. 交互问题

### 5.1 状态位清单（问答 4）

界面共有 **19 类**状态位（含每节点内嵌文案），其中 7 类属实现细节，重构应合并或收进「诊断」。

| # | 位置 | 文案 | 出现条件 | 处置建议 |
|---|---|---|---|---|
| 1 | `#connection` | 连接中 / 插件连接正常 / 未连接 | 初始 / boot 成功 / boot 失败 | 保留（可弱化为点） |
| 2 | `#status-heading` | 等待读取状态 / 配置已加载 / 插件未启用或配置无效 / 无法读取插件状态 | 初始 / `isEnabled()` / 反 / boot 失败 | 合并进 #4 |
| 3 | `#profile` | 恒为「陪伴运行范围」 | 永远 | **删**（常量噪音，app.js:1797） |
| 4 | `#runtime-state` | 运行中 / 正在准备 / 已停止 / 等待角色映射 / 角色已映射，等待准备 / 状态待核对 | `stateLabel(status.state)`；`unloaded` 实际不产生 | 保留为唯一主状态 |
| 5 | `#accepting` | 正在运行 / 未运行 | `Boolean(status.accepting)` | 与 #4 合并 |
| 6 | `#safety-note` | 三句：自动处理其会话 / 准备并启动后开始 / 保存后自动准备 | 三种运行态 | **删或收进帮助**（解释性说明） |
| 7 | `#notice` | `failureOperations[op] + failureMessage(code)` 等 | `last_failure.code` 或 `settings_error` 非空 | 保留但去掉 `上次…失败` 前缀 |
| 8 | `#shared-model-note` | 6 种：正在读取 / 没有 Provider / 尚未选择 / 已回退 fallback / 自动跟随 / 已保存不可用 / 当前启动模型 | `providers.length`、`provider_source∈{auto,fallback}`（account_session_api.py:96-104） | 合并成 1 行「当前模型 X」+ 异常时才提示 |
| 9 | `#topology-mode` | 恒「账号与会话链路」 | 永远 | **删**（app.js:748 写死） |
| 10 | `#topology-counts` | `N 个账号 · N 个角色 · N 个窗口` | 有拓扑 | 可保留 |
| 11 | `#topology-note` | 「暂无 AstrBot 人格或会话窗口」/「X · N 个关联节点」 | 空态 / 选中态 | 后者可删 |
| 12 | `#directory-state` | `N 个 AstrBot 会话`（+「部分读取：会话目录、会话编号…」）；`title` 里塞原始 code | 每次读目录 | 细节收进诊断（lookupStages app.js:93-100 是内部阶段名） |
| 13 | `#binding-check` | `N 个角色 · N 个人格（尚未保存）`/「请将人格归入唯一角色」 | 草稿校验 | 保留（作为保存按钮的旁注） |
| 14 | `#group-target-count/-note/-state` | `N / N 个已选`、通配提示、`N 个群目标已启用`、`先保存角色映射…` | 群面板显示时 | 保留 state，删通配提示（我方无通配） |
| 15 | `#window-link-state` | 主窗口已合并 N 个 / 已合并到「X」/ 选择要合并的窗口 / 没有其他可合并窗口 | 选中私聊窗口 | 单窗口时整块不显示 |
| 16 | `#session-manager-meta` / `-state` | 平台·账号·窗口；`人格 X → 角色 Y · 来源：… · 映射…` | 选中节点 | **来源**（`persona_source`）是实现细节 |
| 17 | `#session-group-network-state/-counts` | 正在读取 / 暂不可读取 / `N 人 · N 条互动边` / 「目录中还没有…」 | 选中群 | 可保留 |
| 18 | 拓扑节点内嵌三行 | `N 个角色`/`N 个窗口`；`QQ · OneBot · Bot xxx`；`人格 X → 角色 Y · 来源：V2 窗口覆盖/AstrBot 当前选择/仅按角色映射/未确定 · 随角色运行/等待归入角色/角色映射未保存/详情未读到 · 回复已开启/回复已关闭/会话已停用/尚未建立 AstrBot 会话` | 每个节点 | 属实现细节最多的一处（app.js:497-537、app.js:216-231） |
| 19 | `#topology-empty` | 「还没有账号与会话链路」 | 无任何节点 | 保留 |

不该展示给用户的实现细节：`#profile` 常量、`#topology-mode` 常量、`persona_source` 四种来源名、`llm_enabled/session_enabled` 的「回复已关闭/会话已停用」（属会话设置域，本页不可改）、`#directory-state` 的阶段名、`failureOperations` 的「上次…失败」、`host_*` 原始码后缀（labelFor 的 `__suffix` 机制，app.js:108-120）。

### 5.2 错误码 → 中文文案（问答 5）

映射表位置：`labels` **app.js:9-77**（约 69 条）、`intentReasons` app.js:79-92、`lookupStages` app.js:93-100、`failureOperations` app.js:101-106、解析 `labelFor` app.js:108-120、兜底 `failureMessage` app.js:122-129。
兜底文案：`操作未完成（错误码：xxx），请查看 AstrBot 日志中的 CompanionV2 详情。`（app.js:127-128）

| 错误码 | 中文文案 | 映射行 | 后端产生处 |
|---|---|---|---|
| `dashboard_identity_required` | 请从已登录的 AstrBot 管理页面打开本页。 | app.js:10 | account_session_api.py:44、multi_api.py:220 |
| `host_disabled` | 当前角色尚未启用，请刷新状态。 | app.js:12 | multi_settings.py:334-336 |
| `host_account_unavailable` | 至少一个配置账号当前未连接。 | app.js:40 | 探针路径 |
| `host_persona_unavailable` | 至少一个配置人格当前无法解析。 | app.js:41 | account_session_api.py:186、:577 |
| `host_persona_invalid` | 人格提示词或对话示例格式无法读取… | app.js:42 | session_topology.py:567-569 |
| `host_binding_changed` / `host_configuration_changed` / `host_identity_conflict` / `host_identity_changed` / `host_persona_binding_changed` | 各自「请核对/重新读取角色映射」 | app.js:43-49 | multi_settings.py:129-306 |
| `host_mappings_invalid` / `_conflict` / `_required` | 格式无效 / 重复绑定 / 请先绑定至少一个 Bot 账号与人格 | app.js:50-52 | multi_settings.py:241-306 |
| `host_not_initialized` | 角色数据尚未准备完成，请重新保存角色映射。 | app.js:44 | multi_controller.py:1188 等 |
| `host_provider_required` | AstrBot 暂无可用的文本模型… | app.js:56 | multi_settings.py:337-338 |
| `host_provider_unavailable` | 所选共享启动模型当前不可用，请重新选择。 | app.js:70 | account_session_api.py:494-497 |
| `host_terminated` / `host_must_stop` | 插件正在停止… / 当前任务仍在收尾，请稍后保存映射。 | app.js:59、app.js:68 | multi_controller.py:664-666 |
| `host_group_delivery_invalid` | 群聊发送设置无效，请检查插件的群聊设置。 | app.js:54 | multi_settings.py:252-254 |
| `host_capabilities_invalid` | 角色能力设置无效，请检查插件的能力配置。 | app.js:55 | multi_settings.py:307-311 |
| `staging_host_terminated` | 插件正在停止或已停止… | app.js:23 | 旧 staging 路径（本页可能命中） |
| `setup_targets_unavailable` | 会话目录暂时不可读取。 | app.js:69 | account_session_api.py:133-136 |
| `account_config_invalid` | 绑定配置不完整或会话来源已变化，请重新核对。 | app.js:61 | account_session_api.py 多处 |
| `account_config_persistence_unavailable` | 当前环境无法安全保存插件设置。 | app.js:59 | account_session_api.py:497-503 |
| `account_config_save_failed` | 保存失败，请检查插件数据目录是否可写后重试。 | app.js:62 | account_session_api.py:215、:400、:457 |
| `account_config_running` | 角色映射正在应用，请稍候再读取状态。 | app.js:60 | — |
| `account_model_provider_failed` | 共享启动模型保存失败… | app.js:63 | account_session_api.py:522 |
| `account_session_unavailable` | 这个会话已切换或不在当前目录中，请刷新。 | app.js:64 | account_session_api.py:350-352 |
| `account_session_persona_pinned` / `_unmapped` | AstrBot 已固定此会话人格… / 这个人格尚未绑定到当前 Bot… | app.js:65-66 | account_session_api.py:355-361 |
| `account_core_window_required` | 已确认的核心管理员窗口需要保留。 | app.js:67 | 旧 staging 路径 |
| `bridge_unavailable` / `host_module_unavailable` / `host_control_failed` / `host_native_lookup_timeout` / `host_target_not_ready` | 各自一句 | app.js:73-75、app.js:71-74 | 各自 |

**缺失映射（落到通用兜底句，用户只看到机器码）**：

| 错误码 | 后端位置 | 前端是否有文案 |
|---|---|---|
| `account_group_target_route_unresolved` | account_session_api.py:359-361 | 无 |
| `account_group_target_account_required` | account_session_api.py:371-373 | 无 |
| `account_group_target_unavailable` | account_session_api.py:376-377 | 无 |
| `account_group_target_apply_failed` | account_session_api.py:454-458 | 无 |
| `account_role_persona_in_use` / `account_role_name_in_use` | account_session_api.py:190-193 | 无（仅 setup-guide 侧有） |
| `host_request_invalid` | multi_api.py:233-236 | 无 |
| `host_storage_changed` | multi_controller.py:751-753 | 无 |
| `legacy_plan_stale` | multi_controller.py:735、:745、:768 | 无 |
| `bridge_timeout` | embedded-bridge.js:60 | 无（publicError 走 failureMessage，app.js:1866-1873） |
| `invalid_response` | product-page.js:1103 等 | 无 |

另有大量 `staging_*`、`authorization_*`、`scope_not_granted` 文案（app.js:14-38）在本页**永远不会命中**（对应流程已不在本 UI 内），属死文案。

### 5.3 「群目标列表只显示已受管群、新群看不到」在当前代码里的表现（问答 6）

只读确认代码路径，不下「已修/未修」结论：

1. 前端取数：`groupTargetRows()` 只从 `bindingConfig.discovered.targets` 里挑 `native===true && (scope_kind==="group" || group_id)` 的行（app.js:1566-1594）。
2. `discovered` 来自 `GET accounts` → `_discovered()` → `SetupWebAPI.api_targets()`（account_session_api.py:129-137、setup_api.py:379-411）。
3. `api_targets()` 把 `controller.settings` 传进 `inventory_report(settings=...)`（setup_api.py:407-411），一旦宿主已组装（`initialize`/`load_existing` 之后必然如此），会触发两处收窄：
   - `accounts` 被过滤到「已配置路由」（session_topology.py:417-419）；
   - `_session_windows(..., managed_only=True)` 丢掉没有匹配配置绑定的候选（session_topology.py:440、:551-554，实际 `if not candidates: return result`）。
4. 因此**新增群（尚未进 `group_targets`）不会出现在 `discovered.targets` 里** → 群目标面板无该行（app.js:1634-1682）→ 无法勾选启用。
5. 后端校验口径相同：整体保存时新增群必须能在 `discovered["targets"]` 里找到，否则抛 `account_config_invalid`「select a group from the native session directory」（account_session_api.py:545-553）；单条接口抛 `account_group_target_unavailable`（account_session_api.py:369-377）。
6. 规避性的缓存只补名字不补行：`_observed()` 把最近见过的会话写盘（session_topology.py:176、:392-433），UI 只把它当 `group_name` 来源（app.js:1577-1584）。
7. 已启用的群不会消失：`renderGroupTargets()` 用 `bindingConfig.groups` 兜底渲染「当前已启用，暂未发现」（app.js:1671-1676、app.js:1699-1706）。**缺的只是「新增」方向。**

### 5.4 其它交互问题（逐条定位）

| # | 问题 | 位置 |
|---|---|---|
| 1 | `#status-grid` 是 4 列 grid，但只有 3 个格子，右侧留空一格 | style.css:142 vs index.html:21-23 |
| 2 | 「保存角色映射」与「保存群目标」都必须整体 POST，且都触发停机重启；群目标面板还要求先保存角色映射（`bindingsDirty` 时输入框全禁用） | app.js:1630、app.js:1616-1632、app.js:1685-1688 |
| 3 | 在角色名输入框里每敲一个字符都会 `markBindingsDirty` → `renderTopology()` 全量重建三列 DOM 与 SVG 连线 | app.js:1756-1760、app.js:1949-1953（document 级 input 监听）、app.js:735-770 |
| 4 | 窗口合并按钮实际发不出去：iframe 白名单只放行 `host/status`、`host/start`、`accounts`、`accounts/model-provider`、`acquaintance`，`accounts/window-link`/`window-unlink` 会得到 `invalid_response` | product-page.js:1093-1099 vs app.js:846、app.js:860 |
| 5 | 「停止」能力完全缺失：`embedded-bridge.js:70` 强制隐藏 `#start-host/#stop-host`，`app.js:1814-1823` 之后再按状态改回，两者竞争；本页也没有 stop 按钮 | embedded-bridge.js:70、app.js:1814-1823 |
| 6 | 群目标勾选行在 `routeReady!=="true"` 时禁用（账号未解析），但没有任何解释，只表现为点不动 | app.js:1628-1631、app.js:1704 |
| 7 | 保存后立即再 `GET accounts` 做一致性比对，不一致就报「保存后与所选清单不一致」——把内部竞态暴露成用户错误 | app.js:1706-1712 |
| 8 | 拓扑连线依赖 `getBoundingClientRect`，iframe 高度未定时静默不画；`ResizeObserver` 只观察 4 个容器 | app.js:646-726、app.js:1967-1972 |
| 9 | `personaChoiceLabel` 只在某些分支用，账号卡标题与人格卡标签用了三套不同拼接（`accountChoiceLabel` / `personaLabel` / `roleDisplayName`） | app.js:202-215、app.js:232-236、app.js:1447-1477 |
| 10 | 15s 轮询会在用户刚打开的详情抽屉上方整块重渲染（仅当 `topologySelection` 为空时才跳过；有选中时跳过，但草稿标记只覆盖账号卡） | app.js:1975-1978、app.js:1536-1546 |
| 11 | `#hide-unlinked-personas` 默认勾选，默认视图会藏掉大多数人格，易被误读为「人格没读到」 | index.html:56、app.js:1505-1520 |
| 12 | 错误回执里混入原始码（`failureMessage` 的 `（错误码：xxx）`、`#directory-state.title` 的 code 列表） | app.js:122-129、app.js:1559-1561 |

### 5.5 QQ 专属 / 待定（问答 7）

| 项 | 现状 | 我方（wechat_helper 单 bot） | 证据 |
|---|---|---|---|
| `platformLabel` 把所有已知平台映射成「QQ · OneBot」，未知值显示「当前平台」 | `qq/aiocqhttp/onebot/default → QQ · OneBot`，`qq_official*` 单独两条 | 需要按真实平台显示（微信） | app.js:189 |
| `group_delivery_mode` 硬编码 `"onebot_group"` | 群投递按 OneBot 语义（`authorize_envelope` 校验 `mode!="onebot_group"` 即报错） | 待定：wechat 适配器下是否同语义未验证 | multi_settings.py:330、group_delivery.py:94-101 |
| `group_session_matches` 兼容 legacy `sender_group` 形如 `12345_67890` 的会话 id | OneBot 遗留 | 不用（但保留即兼容） | group_settings.py:21-37 |
| `numericId()` 只显示纯数字 id | QQ 官方 openid 被隐藏，只在无名字时兜底显示 | 微信 wxid 非纯数字 → 常走「无后缀」分支 | app.js:190、app.js:191-201 |
| 多账号色条 / 「N 个角色」徽标 | 7 色循环，为多账号可读性存在 | 单账号时永远只有 1 色 | app.js:151-153、app.js:540-543 |
| `unified_msg_origin` 含 `_` 判为「分成员会话」 | OneBot 群分成员写法 | 待定 | app.js:512 |
| live/VTS、together/通话、game、screen、reality、legacy V1 | 本工作区**不涉及任何字段**（均在各自工作区的能力开关里） | 不用 | grep 本目录无命中 |
| 「已合并 N」badge、`window_links` 整块 | 为多平台/多窗口合并 | 待定（单私聊窗口时无对象） | index.html:115-124、app.js:506 |

---

## 6. 按条件显示清单（兼容 + 重构，不删功能）

原则：**能力全部保留**；下列步骤/面板只在条件成立时显示，条件不成立时**默认收起**（可折叠区/「更多」里仍可达），不删除代码路径。条件全部取自现有接口字段，不需要新增后端。

| # | 功能 / 步骤 | 只在什么条件下有意义 | 判断条件来自哪个接口的哪个字段 | 证据 |
|---|---|---|---|---|
| 1 | 多账号卡片（`.account-binding-card` 多个） | 多 bot / 多平台账号 | GET `accounts` → `.discovered.accounts[]` 或 `.accounts[]` 的 `distinct bot_id` 个数 > 1 | app.js:1478-1503、account_session_api.py:114-116 |
| 2 | 「添加角色」按钮（一账号多角色） | 同一 bot 下要挂多个角色 | `.personas[]` 中该 `bot_id` 的 `distinct role_id` > 1，或 UI 草稿里已有 >1 张角色卡 | app.js:1441-1445、app.js:1455-1460 |
| 3 | 角色名文本输入（`[data-role-id]`） | 多角色时需要人可读的区分名 | `.personas[]` 的 `distinct role_id` > 1；否则可派生固定值只读 | app.js:1364-1395、multi_settings.py:296-303 |
| 4 | 「隐藏未关联窗口的人格」筛选 | 人格总数明显多于映射数 | `.discovered.personas[]` 长度 > `.personas[]` 长度 | index.html:56、app.js:1505-1520 |
| 5 | 三列拓扑的第 02 列（角色 / 人格） | 存在 >=1 个角色 | `.personas[].length > 0` 或 `.discovered.personas[].length > 0` | app.js:735-770、app.js:566-591 |
| 6 | 拓扑连线（SVG） | 账号数 >1 或角色数 >1（单链时一条线没有信息量） | `.discovered.accounts.length > 1 || roles.length > 1` | app.js:646-726 |
| 7 | 账号色条 / 多账号图例 | 多账号 | `.discovered.accounts[]` 的长度 > 1 | app.js:151-153、app.js:519-520 |
| 8 | 会话筛选「全部/私聊/群聊」 | 两类窗口同时存在 | `.discovered.targets[]` 中 `scope_kind=="private"` 与 `=="group"` 都非空 | index.html:88-92、app.js:604-609 |
| 9 | 会话分页 | 窗口数 > 5 | 过滤后 `sessions.length > TOPOLOGY_SESSION_PAGE_SIZE(5)` | app.js:149、app.js:620-628 |
| 10 | 「置顶窗口」 | 窗口数 > 1 | 同上（`sessions.length > 1`） | index.html:114、app.js:1875-1889 |
| 11 | 「用户窗口合并」整块 | 存在 >=2 个私聊窗口 | `.discovered.targets[]` 中 `scope_kind=="private" && native===true` 的条数 > 1；且 `.window_links[]` 任一活跃 | app.js:793-798、app.js:805-810 |
| 12 | 合并方式「主窗口接管」(mode=primary) | 同一用户在多平台/多 bot 下各有一个窗口 | 两个私聊 target 的 `participant_id` 相同但 `platform_id`/`bot_id` 不同 | app.js:119、multi_settings.py:83-99 |
| 13 | 群聊目标面板 | 存在群会话或已配置群 | `.discovered.targets[]` 中 `scope_kind=="group"` 非空，或 `.groups[]` 非空 | index.html:101、app.js:1641 |
| 14 | 群目标「通配提示」句子 | 配置里含 `group_id=="*"` | `.groups[].group_id == "*"` | account_session_api.py:207-210、app.js:1643-1645 |
| 15 | 群成员与关系网 | 当前节点是群，且目录能力可用 | 节点 `scope_kind=="group"` + `catalog.acquaintance_api` 非 null（`GET acquaintance` 可用） | app.js:937-950、product-page.js:1097、acquaintance_api.py |
| 16 | 「共享启动模型」的「固定」按钮 | AstrBot 里有多个文本 provider 才值得固定 | GET `accounts` → `.model.providers[]` 长度 > 1；`provider_source=="auto"`（单 provider 自动跟随） | app.js:1287-1288、account_session_api.py:96-104 |
| 17 | 「准备并启动」按钮 | 需要手动触发（配置已存但未跑） | `status.enabled && !status.settings_error && status.accepting===false` 且 `.model.provider_id` 非空 | app.js:1345-1347、app.js:1814-1823 |
| 18 | 「刷新状态」 | 与其他状态位合并后可只在错误时出现 | `status.last_failure` 或轮询失败 | app.js:1910-1917 |
| 19 | 状态面板「是否接收消息」 | 与「运行状态」并存时才需要 | `status.state=="running"` vs `status.accepting` 出现不一致 | multi_controller.py:1307-1308 |
| 20 | 失败码 / 诊断区 | 有故障 | `status.failure_code`、`status.failure_detail`、`status.last_failure.code`、`status.settings_error` 任一非空 | multi_controller.py:1309-1312、app.js:1804-1809 |
| 21 | 目录「部分读取」明细 | 目录读取有 issue | `discovered.directory.issues[]` 非空 | app.js:1550-1562、session_topology.py:441-443 |
| 22 | 平台名显示 | 平台不是 QQ 时必须真实 | `.discovered.targets[].platform_id` / `platform_name`（微信 `wechat_helper` 等） | app.js:189、session_topology.py:135-140 |
| 23 | 群目标「单条开关」接口 | 只在需要「增量改一个群、不动其它」时 | 无需判断，属后端能力；UI 可保留为高级入口 | account_session_api.py:403-458 |
| 24 | 会话级 `llm_enabled/session_enabled/persona` 编辑 | 需要逐窗口关回复/换人格时 | `.discovered.targets[].llm_enabled/session_enabled/persona_id` 与 AstrBot 侧不一致 | session_topology.py:601-603、account_session_api.py:330-401 |

配套的**界面收敛（只动界面，不动功能）**：① 编辑器与拓扑合并为一处（编辑器为主、连线为可选视图）；② 19 类状态位压到 4 类（主状态 / 群目标状态 / 模型状态 / 诊断），其余进「高级·诊断」；③ 删掉常量噪音（`#profile`、`#topology-mode`）与解释性句子（`#safety-note`、`#shared-model-note` 的多数分支）；④ `persona_source`、`llm_enabled`、目录阶段名、原始错误码收进诊断；⑤ 「宿主启停」「授权」按「离不开的东西不给开关」如实呈现：启停必须有（现在却只有 start、且被外壳隐藏），授权已无闸门（group_delivery.py:50-66）所以**不给开关**。

---

## 7. 给新 UI 的一段形态建议

一屏一件事，三层信息：
**第一层（默认可见）**——一张「状态条」：左侧一个点 + 一句主状态（未运行 / 运行中 / 需处理），右侧一个主按钮（未运行→「启动」，运行中→极淡的「重启」或直接不显示）。模型与 provider 折叠成「模型：X」一行文字，只有出问题时才变色并可展开。
**第二层（主体）**——竖向列表，不是三列拓扑：每行 = 一个会话窗口（私聊/群各一行），行内只放「名字 · 类型 · 归属角色」，角色用同一枚小标签（单角色时全局只有一个标签，可省）。群目标就是同一张列表的「群」分区，勾选即启用，不要再单独一个面板 + 单独一个保存按钮。
**第三层（右上「更多」）**——账号与角色映射（默认收起：单 bot 单角色时这里只有一行只读「微信 · 账号 X → 小鲸鱼」）、窗口合并（默认收起）、诊断（原始码、目录阶段、persona 来源、原生会话开关）。
保存模型建议**保持后端现状**（整体 POST 会停机重启），因此新 UI 必须做到：**每次改动都是显式一次确认、一次保存、一个结果回执**；不要把勾选做成即时生效，也不要在保存按钮旁再放第二个「也保存」按钮。冲突由实现内定（单个 bot 只有一套映射，不存在并发编辑器），所以界面不需要 revision 概念。
文字层面：不要写解释句；一个窗口行最多一句「未归入角色」这类**可行动的**提示，其余一律不写。失败时只给一句人话 + 「诊断」入口，不显示 `account_*`/`host_*` 码。

---

## 8. 功能完整性清单（新 UI 验收用）

覆盖第 1/2/3 节全部内容；每条都要在新 UI 里有落点（可见、或收在「更多/诊断」里）。「平台或能力前提」写「无」表示任何情况下都存在。

| # | 功能点 / 向导步骤 | 当前入口（页面/按钮/API） | 依赖接口（方法+路径） | 平台或能力前提 | 代码位置 |
|---|---|---|---|---|---|
| 1 | 读取宿主状态 | 页面加载、刷新 | GET `host/status` | 无（仅需 admin） | app.js:1849-1863、multi_api.py:218-231 |
| 2 | 显示连接态 | 页头徽标 | 同 1（同一次请求） | 无 | app.js:1794、app.js:1897 |
| 3 | 显示运行态 | 状态面板「运行状态」 | 同 1，字段 `state` | 无 | app.js:1256-1261、multi_controller.py:1307 |
| 4 | 显示是否接收消息 | 状态面板「是否接收消息」 | 同 1，字段 `accepting` | 无 | app.js:1799 |
| 5 | 显示启用/配置有效性 | 状态面板标题 | 同 1，字段 `enabled`/`settings_error` | 无 | app.js:1796、app.js:1345-1347 |
| 6 | 显示上次失败 | 通知条 | 同 1，字段 `last_failure.code/operation`、`settings_error` | 无 | app.js:1804-1809、multi_controller.py:1311-1312 |
| 7 | 显示失败明细（诊断） | 通知条 / 诊断 | 同 1，字段 `failure_code`/`failure_detail` | 无 | multi_controller.py:1309-1310 |
| 8 | 启动宿主 | 「准备并启动」 | POST `host/start` | 需有可用文本 provider | app.js:1825-1847、multi_controller.py:895-935 |
| 9 | 停止宿主（能力存在、UI 未暴露） | 无按钮（外壳强制隐藏） | POST `host/stop` | 无 | multi_api.py:292-295、embedded-bridge.js:70 |
| 10 | 探针（能力存在） | 无按钮 | POST `host/probe` | 无 | multi_controller.py:668-679 |
| 11 | 显式初始化（能力存在、自动进行） | 无按钮 | POST `host/initialize` | 需 `enabled` + provider | multi_controller.py:681-697 |
| 12 | 读取共享启动模型 | 「共享启动模型」面板 | GET `accounts` → `.model` | 无 | index.html:28-38、account_session_api.py:106-116 |
| 13 | 固定共享启动模型 | 「固定/保存启动模型」 | POST `accounts/model-provider` | 需 provider 存在且类型匹配 | app.js:1312-1343、account_session_api.py:460-524 |
| 14 | 读取账号列表 | 编辑器账号卡 | GET `accounts` → `.discovered.accounts` | 无（未连接时为空） | app.js:1478-1503、session_topology.py:101-141 |
| 15 | 读取人格目录 | 人格复选框 | GET `accounts` → `.discovered.personas[]` | AstrBot 已加载人格 | setup_api.py:394-403 |
| 16 | 读取会话窗口目录 | 拓扑第 3 列 | GET `accounts` → `.discovered.targets[]` | AstrBot 有会话记录 | setup_api.py:411、session_topology.py:413-488 |
| 17 | 目录部分读取提示 | `#directory-state` | 同 16，`discovered.directory.issues[]` | 无 | app.js:1550-1562 |
| 18 | 新建角色（账号下） | 「添加角色」+ 角色名 | 前端草稿 → POST `accounts` | 需 >=1 人格可选 | app.js:1441-1445、app.js:1364-1395 |
| 19 | 角色名单写（单项接口，setup 在用） | 无本页入口 | POST `accounts/role` | 需 bot 已连接 | account_session_api.py:145-217 |
| 20 | 人格 → 角色勾选 | 人格复选框 | 前端草稿 → POST `accounts` | 需 >=1 人格 | app.js:1400-1440、app.js:1722-1747 |
| 21 | 隐藏未关联人格 | 复选框 | 无（纯前端） | 需人格数 > 映射数 | app.js:1505-1520 |
| 22 | 保存角色映射（整体应用，含重启） | 「保存角色映射」 | POST `accounts` | 需 `discovered.accounts` 非空 | app.js:1762-1789、account_session_api.py:526-606 |
| 23 | 读取群目标 | 「群聊目标」面板 | GET `accounts` → `.groups[]` | 无 | app.js:1634-1682 |
| 24 | 勾选启用/停用群 | 群行复选框 + 「保存群目标」 | POST `accounts`（`groups`）；后端另有 POST `accounts/group-target` | 需群在目录中 | app.js:1684-1720、account_session_api.py:403-458 |
| 25 | 群通配（`group_id=="*"`）兼容 | 提示句 | POST `accounts`（`groups[].group_id`） | 旧配置才有 | account_session_api.py:207-210 |
| 26 | 读取窗口合并关系 | 「用户窗口合并」面板 | GET `accounts` → `.window_links[]` | 需 >=2 私聊窗口 | app.js:789-831 |
| 27 | 合并窗口（role / primary） | 「合并到当前窗口」 | POST `accounts/window-link` | 需主/别名窗口都已映射到角色 | app.js:839-853、account_session_api.py:219-282 |
| 28 | 解除合并 | 「解除合并」 | POST `accounts/window-unlink` | 需已有链接 | app.js:855-867、account_session_api.py:284-306 |
| 29 | 会话窗口置顶 | 「置顶窗口」 | 无（localStorage） | 需 >=2 窗口 | app.js:1875-1889 |
| 30 | 窗口类型筛选 | 全部/私聊/群聊 | 无 | 两类窗口并存才有意义 | app.js:604-609 |
| 31 | 窗口分页 | 上一页/下一页 | 无 | >5 个窗口 | app.js:592-630 |
| 32 | 节点详情（账号/角色/人格/窗口） | 抽屉 | 无（用已读数据） | 无 | app.js:869-935 |
| 33 | 群成员与关系网 | 抽屉内 | GET `acquaintance`（`group_networks`） | 群节点 + `catalog.acquaintance_api` | app.js:937-1164、product-page.js:1097 |
| 34 | 原生会话设置读取（llm/session/persona） | 窗口卡片文案 | GET `accounts` → `.discovered.targets[]` | 无 | app.js:531-533、session_topology.py:601-603 |
| 35 | 原生会话设置写入（能力存在，UI 未接） | 无 | POST `accounts/session` | 需 `session_key` 仍存在 | account_session_api.py:330-401 |
| 36 | 私聊投递授权（能力存在，已无闸门） | 无按钮 | POST `host/authorize-delivery` / `revoke-delivery` | 需已 initialize | multi_api.py:292-295、multi_controller.py:1183-1192 |
| 37 | 群投递授权（能力存在，已无闸门） | 无按钮 | POST `host/authorize-group-delivery` / `revoke-group-delivery` | 需已 initialize | multi_api.py:294-297、group_delivery.py:44-70 |
| 38 | 群投递授权状态读取 | 无展示 | GET `host/status` → `targets[].group_delivery_authorization` | 群目标 + 已运行 | multi_api.py:148-151 |
| 39 | 性能模式（lite） | 无 | GET `host/performance` | 无 | multi_api.py:233-241 |
| 40 | 通知与失败回执 | 顶部通知条 | 上述所有写操作的返回体 | 无 | app.js:1250-1255、app.js:1866-1873 |
| 41 | 空态引导 | 空态块 | 无 | 无任何节点 | index.html:63-66、app.js:752-760 |
| 42 | 15s 后台刷新 | 无（自动） | GET `accounts` | 非 busy、无草稿、无选中 | app.js:1975-1978 |
| 43 | 映射更新通知父页 | 保存成功后自动 | postMessage `host-mappings-updated` | 需在 iframe 内 | app.js:1771、product-page.js:1034-1038 |

条目数：**43**。
