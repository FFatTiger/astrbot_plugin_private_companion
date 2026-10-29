# 关系与记忆工作区 · 只读 UI 审计

范围：`pages/陪伴小屋/workspaces/relationships/`（index.html、app.js 258 行、group-memory.js 162 行、style.css 104 行），分支 `wechat`，HEAD `2e29e3f`。
这是**一个工作区两条完全不同的界面**：私聊走 `role.relationships_api`，群目标走 `role.group_memory_api`，由 `app.js:248` 在 `context.display.scope_kind==="group"` 时整页替换 `main` 挂载 `group-memory.js`（index.html 的骨架与 `#editor` 弹窗在群模式下变成死 DOM）。

## 1. 视图清单

| 视图 / 分区 / 弹窗 | 怎么进来 | 用途一句话 | 主要组件 | 代码位置 |
|---|---|---|---|---|
| 私聊 · 页头（只有「刷新记录」，无标题） | 打开工作区 | 手动重读 | 一个次按钮 | index.html:14-17 |
| 私聊 · 管理范围条 | 常驻 | 显示 角色/关系对象/当前会话/操作人 | 4 格 `strong` | index.html:18-23，app.js:181-184 |
| 私聊 · 关系记录列表 | 常驻左栏 | 待审阅/已审阅/已采用/已撤回的「关系理解」 | 状态筛选 select、游标分页、卡片列表 | index.html:27-35，app.js:93-127 |
| 私聊 · 详情面板 | 点列表卡片 | 看正文、版本、来源数、四个归属人、动作按钮 | h2+badge、meta、memory-text、evidence、attribution、actions | app.js:128-167 |
| 私聊 · 「更正理解 / 撤回记录」弹窗 | 点 revise / retract | 编辑正文或确认撤回 | `<dialog id=editor>` + textarea | index.html:43-54，app.js:193-204 |
| 私聊 · 不可用卡片 | 列表为空且有错误码 | 提示身份/初始化问题 | availability-card | app.js:87-110 |
| 群 · 页头（群名 + 一段说明 + 刷新） | 群目标自动 | 群公共记忆总览 | eyebrow/h1/intro | group-memory.js:58 |
| 群 · 管理范围条 | 常驻 | 角色/管理范围/数据范围/操作人 | 4 格（后两格是死文案） | group-memory.js:59 |
| 群 · Tab「共享陈述」 | 默认 | 群成员陈述档案（生效/已撤回） | gm-tabs + 状态 select + 列表 + 分页 | group-memory.js:61-62,140-150 |
| 群 · Tab「安全审阅」 | 点第二个 tab | 群成员安全命中与管理员判定 | 同一列表容器、按 review_state 过滤 | group-memory.js:144-149 |
| 群 · 陈述详情 | 点列表项 | 原文 + 「原始群消息」证据 | POST detail 拉 evidence，附带撤回按钮 | group-memory.js:91-99,110-113 |
| 群 · 安全命中详情 | 点列表项 | 展示命中证据 + 已审阅/忽略按钮 | `JSON.stringify(evidence)` 直接铺屏 | group-memory.js:100-107 |
| 群 · 撤回确认弹窗 | 点「管理员撤回」 | 二次确认 | 运行时 `createElement("dialog")` | group-memory.js:11-52 |
| 群 · 操作回执 | 撤回成功后 | 显示 operation_id + state | 一行 evidence 文本 | group-memory.js:87,108,130 |

**不存在**：关系阶段、亲密度数值、共同经历时间线、群黑话（slang）、群成员线索（clue，在 identity 工作区）、任何图表。本工作区只有「关系理解条目」和「群公共陈述 / 安全命中」两套列表。

## 2. 设置项 / 数据项

私聊前缀：`/api/plug/astrbot_plugin_private_companion/targets/<tid>/roles/<digest>/relationships`（`astrbot_host/multi_api.py:183-184`）。
群前缀：`.../roles/<digest>/group-memory`（`astrbot_host/multi_api.py:155-157`）。前端只写相对名，由父页 `product-page.js:1104-1117` 映射并做白名单。

| 字段 | 界面标签 | 位置 | 读 API | 写 API | 层级 | 默认值（来源） | 我方是否需要 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `kind` | 关系背景 / 情绪片段 | app.js:31,116 | GET relationships | 无（模型提案时定） | 角色×人 | 无默认，由工具参数决定（`companion_v2/relationships/tools.py:33-40`） | 需要（可只显示一种图标） | 内部枚举 `context`/`emotion_episode`（models.py:21-23） |
| `state` | 待审阅/已审阅/已采用/已撤回 | index.html:30-31，app.js:5,116 | 同上（`?state=`） | POST command action=review/adopt/retract | 角色×人 | `proposed`（models.py:62） | 需要 | 四态机，见 §3 |
| `interpretation` | 正文（列表 2 行截断） | app.js:117,145 | 同上 | 仅 revise（≤16384） | 角色×人 | 无 | 需要 | 唯一可编辑文本 |
| `observed_at` | `2026年·月·日` / 观察于 | app.js:118,143 | 同上 | 无 | 角色×人 | 服务端时间 | 可弱化 | — |
| `revision` | 第 N 版 | app.js:143 | 同上 | 随 revise/状态变更 +1 | 角色×人 | 1（models.py:61） | 待定 | 纯技术字段 |
| `source_count` | N 个来源 / N 个原来源当前有效 | app.js:118,146 | 同上 | 无 | 角色×人 | len(sources) | 可砍或合并 | 不能展开看原话（见 §5） |
| `unavailable_reason` | 来源状态：不可用 | app.js:146 | 同上 | 无 | 角色×人 | null | 可砍 | 原始码不铺屏（优于群分支） |
| `attribution.{reviewed_by,adopted_by,revised_by,retracted_by}` | 审阅/采用/更正/撤回：某人 | app.js:147-158 | 同上 | 无（随动作写入） | 角色×人 | 空 | 建议只留「已采用」 | 名字映射靠 `display()` |
| `actions[]` | 按钮组 | app.js:159-165 | 同上（服务端投影） | — | 角色×人 | 由状态+可用性算（management.py:66-76） | **必须保留** | 新 UI 不要自己推状态机 |
| `view_token` | 不可见 | app.js:210 | 同上 | 随动作回传 | 角色×人 | 每次读生成（management.py:41-43） | **必须保留** | 并发令牌 |
| 筛选 `state` | 筛选状态 | index.html:29-31 | query `state`（relationships_api.py:59-66） | — | 视图 | 空=全部 | 可砍为「待处理」 | 四态筛选对本场景过重 |
| 群 `statement` | 列表标题/详情标题 | group-memory.js:77,89 | GET group-memory | 无 | 群×会话 | 由记忆视图生成 | 需要 | 已撤回时变成 `unavailable_reason` 原码 |
| 群 `state` | badge（active/retracted 原样） | group-memory.js:79 | 同上（`?state=`） | retract | 群×会话 | `active`（management.py:91） | 需要 | 英文码直接上屏 |
| 群 `revision` | 「第 N 版」 | group-memory.js:78 | 同上 | retract 时 +1（management.py:270-271） | 群×会话 | — | 可砍 | — |
| 群 `speaker_id` | 成员 <id> | group-memory.js:78,94 | 同上 / detail | 无 | 成员 | — | 建议换显示名 | 现为平台原生 ID |
| 群 evidence（detail） | 原文段落 | group-memory.js:93 | POST group-memory/detail | 无 | 成员（原话） | `chars=2048` 上限（management.py:104-119） | 需要 | 前端从不传 start/chars，长原文被截断且无「更多」 |
| 群 `view_token` / `expected_revision` | 不可见 | group-memory.js:128 | 同上 | 回传 | 群×会话 | — | **必须保留** | — |
| 群 safety `rule_id` / `severity` / `direction` | 标题 / 摘要 / badge | group-memory.js:77-79,89-90 | GET group-memory/safety | 无 | 成员 | 命中时写入 | 待定 | 内部规则码直出 |
| 群 safety `review_state` | 待审阅/已审阅/已忽略 | group-memory.js:10,90 | 同上（`?review_state=`） | POST safety/review | 成员 | `pending` | 待定 | 只记录判断，不改权限 |
| 群 safety `evidence` | 整段 JSON | group-memory.js:101 | 同上 | 无 | 成员 | — | 建议重做 | `JSON.stringify(...,null,2)` 直接铺 |

结论：**真正的「设置项」只有两处**——私聊的 `interpretation`（revise）与群/私聊的状态动作；其余全是只读投影。删除只有「撤回」（逻辑撤回，不物理删除：`companion_v2/memory/group/management.py:270-276`，列表另显式声明 `physical_erasure: not_supported` 于 101）。原话与来源**没有任何编辑或删除 API**。

**字段速查（供 §6/§8 与实现对齐）**

- 私聊条目：`{memory_id, revision, kind, state, interpretation|null, emotion_subject, observed_at, updated_at, source_count, unavailable_reason, attribution{4}, actions[], view_token}` — `companion_v2/relationships/management.py:79-86`。
- 群陈述：`{memory_id, revision, state, statement|unavailable_reason, updated_at, view_token, ...visible}` — `companion_v2/memory/group/management.py:66-79`；列表另返回 `next_cursor / operator_id / target / supported_visibility / physical_erasure`（101-102），前端全未使用。
- 群 detail：`{item, evidence{text,start,end,total_chars,has_more,speaker_id,said_at,attribution,view}}` — `companion_v2/memory/group/management.py:104-119`。
- 群安全命中：`{hit_id, member_id, message_id, rule_id, direction, severity, evidence, occurred_at, review_state, review, permissions_changed}` — `companion_v2/memory/group/management.py:154-164`。

## 3. 操作清单

| 按钮 / 动作 | API | 效果 | 保存模型 | 代码位置 |
|---|---|---|---|---|
| 刷新记录 / 刷新 | GET relationships 或 group-memory | 重读第 N 页 | 即时 | app.js:228，group-memory.js:156 |
| 筛选状态 | GET（带 `state`） | 回到第 1 页 | 选中即生效 | app.js:229，group-memory.js:151-155 |
| 上一页 / 下一页 | GET（`after_id`） | 游标翻页 | 即时 | app.js:230-231，group-memory.js:157-158 |
| 选中卡片 | 无（群会 POST detail） | 右侧详情 | 即时 | app.js:119-124，group-memory.js:80,110 |
| 审阅通过 | POST command `action=review` | proposed→reviewed | **一键、无确认、无草稿** | app.js:163,205-227 |
| 采用到对话 | POST command `action=adopt` | reviewed→adopted | 一键、无确认 | 同上 |
| 更正理解 | POST command `action=revise` + `interpretation` | 回到 proposed，revision+1 | **弹窗 + 「保存更正」** | app.js:163,193-204,232 |
| 撤回记录 | POST command `action=retract` | →retracted，后续对话不再引用 | 弹窗复用 + 「确认撤回」 | 同上 |
| 群 撤回 | POST group-memory/retract → GET group-memory/operation | 陈述撤回 + 读回执 | 原生 confirm 弹窗 + 回执查询 | group-memory.js:126-133 |
| 群 安全审阅/忽略 | POST group-memory/safety/review | 写 review_json | 一键、`note` 固定空串 | group-memory.js:134-139 |

并发与幂等：所有写操作带 `expected_revision` + `view_token`（stale → `relationship_view_stale`，app.js:14；群 `group_memory_view_stale`）；私聊与群撤回用 `operation_key` 且**同指纹重试复用同一 key**（app.js:212-215、group-memory.js:129）；**群安全审阅每次都 `crypto.randomUUID()`（135），超时重试会重复提交**。每次写成功后都整页重载（app.js:221、group-memory.js:130/136），不回填局部状态。

## 4. 重复与冲突

| 概念 | 出现位置 | 读/写什么 | 真身 | 备注 |
|---|---|---|---|---|
| 「关系理解」正文 | 本工作区 app.js:145 | relationship_memories.interpretation | `companion_v2/relationships/models.py:57` | 角色侧只提案，人审后生效（`companion_v2/relationships/tools.py:1,17`） |
| 「关系定位 / 对用户的称呼」 | 跨区域：identity 熟人卡 `pages/陪伴小屋/workspaces/identity/member-editor.js:573-580` | person/relationship_profile.role_relation | 角色配置（persona 域） | 与本工作区**同叫「关系」，但是两个东西**：一个是自由文本标签，一个是带来源的主观理解 |
| 「亲密度 / 靠近度」 | 跨区域：identity 关系雷达 `workspaces/identity/app.js:582-602,752` | 由 msg_count/active_days/last_seen 客户端算分 | 无持久字段 | 只在图上有；注释明说「不把身份等级或权限当作亲密度」 |
| 「互动记忆 / 持续积累」 | 跨区域：member-editor.js:522-542 | acquaintance 目录的 total/updated_at + 熟人卡学习开关 | 熟人卡（另存一份） | 与本工作区记忆列表同名不同源，容易混 |
| 权限 / 身份等级 | 跨区域：member-editor.js:131-139,660-680；访问规则 tab `pages/陪伴小屋/app.js:3641` | identity_tier + authorization items（`acquaintance/authorization` GET/POST） | `companion_v2/identity_policy` | 本工作区也用同一策略做 `relationship.memory.<action>` 的 `core_only` 检查（management.py:35-36） |
| 主动联系权限 | 跨区域：member-editor.js:674 + 主动联系页 `app.js:3652-3657` | proactive.contact 能力 + contact 段配置 | 角色状态 `contact` 段 | 与本工作区无交集 |
| 群投递授权 | 跨区域：`astrbot_host/multi_api.py:147-150` | group_delivery_authorization | authority 域 | 群公共记忆不读它 |
| 工作区摘要里的「关系」计数 | 跨区域：`product-page.js:526-529` 用 `limit=3` 读 relationships | 仅摘要 | 同一 API | 会与本页重复拉取一次 |

结论：**「关系阶段 / 亲密度」在本工作区根本不存在**，不要在新 UI 里造；**权限的真身只有一处**（identity_policy），本工作区只消费它，不写它。唯一真实重复是「关系」这个中文词在 identity（关系定位标签）与本页（关系理解记录）之间撞名。

## 5. 交互问题（定位到行）

| # | 问题 | 位置 |
|---|---|---|
| 1 | 私聊页**没有任何标题/说明**（页头只剩刷新按钮），进入后只有四个格子和列表 | index.html:14-17 |
| 2 | 每次 load 都先打 `staging/status`，但父页映射对私聊只放行 `relationships`(/command)，该请求必然被拒、被 `catch` 成 null → 纯浪费 + 可用性卡片分支永远不生效 | app.js:83-86,172,102-107；`product-page.js:1113-1115` |
| 3 | 可用性卡片把 `hostStatus.enabled/configured` 的内部状态讲给用户（「配置开关未启用」「正在自动准备」） | app.js:102-107 |
| 4 | 列表把整段 `interpretation` 全量塞进 DOM，只靠 CSS 两行截断；20 条正文同时渲染 | app.js:117，style.css:19 |
| 5 | 详情「第 N 版」「N 个原来源当前有效」「内容仍是角色的主观理解」属实现细节与解释文案 | app.js:143,146 |
| 6 | 归属人列出 4 种动作（审阅/采用/更正/撤回），一人单机场景信息量过大 | app.js:147-158 |
| 7 | 已采用后再点「审阅通过」类状态迁移缺失时无解释，列表按状态过滤后条目**静默消失**，只剩一闪而过的 notice | app.js:220-221 |
| 8 | revise 弹窗说明「更正后会重新进入待审阅状态，原版本会保留」是后端规则的口播 | app.js:197 |
| 9 | 错误码表 10 条（staging/dashboard/binding/stale/conflict/not_found/source_revoked…）全是给人看的运维术语 | app.js:10-19 |
| 10 | 群分支把内部码直接铺屏：标题用 `item.unavailable_reason`（如 `group_memory_inactive`）、badge 用英文 `active/retracted`、摘要用 `severity` | group-memory.js:77-79,93 |
| 11 | 安全命中详情把 evidence 以 `JSON.stringify(...,null,2)` 整段倾倒 | group-memory.js:101 |
| 12 | 群页 intro 一段话解释「撤回会影响后续引用，不修改成员身份或权限」；范围条「数据范围=群内共享档案」「操作人=已登录管理员」是死文案 | group-memory.js:58-59 |
| 13 | 两处注释性文案：「详情只显示与该陈述绑定的原始群消息」「安全审阅只记录管理员判断…」 | group-memory.js:94,106 |
| 14 | 原文只显示前 2048 字符，前端从不传 `start/chars`，也从不看 `has_more` → 长消息被静默截断 | group-memory.js:110-113；`companion_v2/memory/group/management.py:104-119` |
| 15 | 群撤回后立刻 `load()` 会清空 `selected`，当前条目从列表消失；若该页最后一条则得到空页 | group-memory.js:122,130 |
| 16 | 安全审阅幂等缺失：每次新 UUID，超时重试重复写 | group-memory.js:135 |
| 17 | 切 tab 时用 `$("gm-filter").previousElementSibling.hidden` 隐藏 label，DOM 结构耦合 | group-memory.js:143,149 |
| 18 | 群模式不监听 `companion-mappings-change`（私聊分支有）：宿主映射刷新但 scope key 未变时，群页不会自刷新（key 变化时父页会重建 srcdoc，见 `product-page.js:984-988`，所以只影响轻量刷新） | app.js:235-239 vs group-memory.js 全文 |
| 19 | 群模式 `#editor`、`#notice`、`#state` 等 index.html 节点成为死 DOM，仍在事件表里 | index.html:25,43-54；app.js:228-234 |
| 20 | 每次选中都 `renderList()` 重建全部卡片（两条分支都是） | app.js:121，group-memory.js:80 |
| 21 | 分页只有「第 N 页」，没有总数，也没有「本页 N 条」之外的进度感 | app.js:95-96，group-memory.js:69-70 |
| 22 | CSS 里 `#text-help`、`.guidance`、`footer` 已无对应节点 | style.css:15,23,24 |
| 23 | 私聊 `scope` 用 `display().target_label`，而 API 另返回 `scope_label/role_id/subject_id` 无人使用 | app.js:181-184；`management.py:105-107` |

性能（第 6 项结论，附代码证据）：

- 私聊一次加载 = 1 次无效 `staging/status` + 1 次 list；`limit` 硬编码 20（app.js:173），API 允许 1..50（management.py:90），游标按 `memory_id` 翻页（management.py:102-109），**无总数查询**。
- 私聊存在明显 N+1：每条记录 `_project` → `_unavailable` → `validate_material`，对「每条 × 每个来源 scope」执行 `personas.resolve` + `access.scope_access`，再对每个 source 执行 `validate_reference_for_audience`（management.py:66-86；service.py:125-147,93-112）。20 条 × 多来源即数十次授权/解析。列表 SQL 还带 `json_extract(record_json,'$.scope.*')` 过滤（ledger.py:174-191），无对应索引列。
- 群一次加载 = 1 次 SQL（`LIMIT 21`，走 `(owner_key, kind, state, view_id)` 索引，management.py:96-101），但**每行** `_item` → `_read_row` → `_input_for_owner` + `_read_source` + 双重 digest 校验（management.py:66-79；`companion_v2/memory/group/service.py:55-71`），仍是 20×N+1。
- 每次写操作成功后又整页重载一次（含上面全部成本）；群撤回还额外 GET 一次回执。
- 没有全量渲染问题（固定 20/页 + 游标），也没有虚拟化；DOM 重建发生在每次选中。

## 6. 可砍清单 / 必须保留清单

**可砍（对本场景无用或只增噪音）**

| 项 | 理由 | 位置 |
|---|---|---|
| 管理范围条 4 格 | 工作区已绑定单一目标/角色，父页也显示 | index.html:18-23；group-memory.js:59 |
| `staging/status` 预读与可用性卡片分支 | 请求必被父页拒绝，属死代码 | app.js:83-110,172 |
| 10 条错误码文案 | 只保留「重新登录 / 刷新」两句 | app.js:10-19 |
| 「第 N 版」「N 个来源」「内容仍是角色的主观理解」 | 技术/解释细节 | app.js:143,146 |
| 四种归属人 | 单管理员场景只留「已采用」或完全去掉 | app.js:147-158 |
| 四态筛选下拉 | 换「待处理 / 全部」两档或直接分组 | index.html:29-31 |
| 群 intro 段 + 「数据范围/操作人」死格 | 解释性文案 | group-memory.js:58-59 |
| 群安全审阅整块 | 只在群聊里生成安全命中，我方从未使用；若保留，至少重做 evidence 展示 | group-memory.js:61,100-107,134-139 |
| 安全命中的 `rule_id/severity/direction` 原码 | 内部规则词 | group-memory.js:77-79 |
| 「操作回执 operation_id」 | 管理员不需要看操作号 | group-memory.js:87,108 |
| 群分页/私聊分页的「第 N 页」控件 | 单管理员+单对象，数据量小，可改为「加载更多」或直接一次 50 条 | index.html:33-34；group-memory.js:62 |
| 未使用的 CSS（`.guidance`、`#text-help`、`footer`） | 死样式 | style.css:15,23,24 |

**必须保留**

| 项 | 理由 | 位置 |
|---|---|---|
| `actions[]` 服务端驱动按钮 | 状态机与可用性判定在服务端，前端复制必飘 | management.py:66-76；app.js:159-165 |
| `expected_revision` + `view_token` + `operation_key` | 并发/幂等契约，缺一即 409 或重复写 | app.js:210-215；group-memory.js:128-129 |
| 私聊 revise / retract 两动作 | 唯一的人审闭环 | app.js:163,193-204 |
| 群 retract + 二次确认 | 撤回不可逆（逻辑删除） | group-memory.js:126-133 |
| 群 detail 的 `start/chars/has_more` | 长原文必须能续读（现在反而没接） | management.py:104-119 |
| 来源失效时隐藏正文（`interpretation=null`） | 隐私/授权撤销后的硬约束 | management.py:79-84；app.js:117,145 |
| `scope_kind` 分支 | 群/私聊是两个 API，不可合并 | app.js:248 |

## 7. 给新 UI 的形态建议

一句话：**新页面只做「角色最近怎么理解你」和「本群记住了什么」，把审核动作收成一行。**

1. **两条路由，两种形态，共用一个壳**。私聊：卡列表（正文两行 + 时间 + 一个状态点）→ 点开在右侧或抽屉里只读展示；底部一行「采用 / 改一改 / 撤回」。群：同一壳，列表项是「谁说了什么」的一句话陈述，点开显示那句原话（可续读），底部一行「撤回」。
2. **默认只出现「待处理」**。`proposed` 用一条细横条提示「N 条理解等你确认」，其余状态收进「更多」。已采用/已撤回不做状态筛选器，做一个「查看历史」二级视图。
3. **不显示**：版本号、来源条数、归属人四格、operation_id、内部规则码、badge 英文枚举、可用性诊断。所有 `state` 都翻成 3 个字以内的中文标签或纯色彩点。
4. **一次拿 50 条、不分页**（API 上限 50），滚到底再续；列表点击**不要整表重渲染**，只改选中态与详情。
5. **保存模型统一为「点了就生效」**：采用/撤回/审阅即时提交，撤回用一次确认；只有「修改正文」用输入框 + 保存（现在就是这样，保持）。提交后**局部更新那一条**，不要整页重载，也不要再顺带打 `staging/status`。
6. **错误只说一句话 + 一个动作**（「记录已变化，已重新读取」自动重读即可），绝不展示错误码。
7. **砍掉群安全审阅**；若产品上必须保留，用与陈述列表一致的卡片式展示（人 + 时间 + 原话），不要铺 JSON。
8. **能力关闭时整块收起**：`relationships_api`/`group_memory_api` 为 null 时（`multi_api.py:155-186`）父页不应渲染入口，而不是渲染一个空态。
9. 需要二次确认的只有撤回；需要表单的只有改正文。其余一律无弹窗。

## 附：数据结构速查（供新 UI 直接对齐）

- 私聊条目：`{memory_id, revision, kind, state, interpretation|null, emotion_subject, observed_at, updated_at, source_count, unavailable_reason, attribution{4}, actions[], view_token}` — `companion_v2/relationships/management.py:79-86`。
- 群陈述：`{memory_id, revision, state, statement|unavailable_reason, updated_at, view_token, ...visible}` — `companion_v2/memory/group/management.py:66-79`；列表另返回 `next_cursor / operator_id / target / supported_visibility / physical_erasure`（101-102），前端全未使用。
- 群 detail：`{item, evidence{text,start,end,total_chars,has_more,speaker_id,said_at,attribution,view}}` — `management.py:104-119`。
- 群安全命中：`{hit_id, member_id, message_id, rule_id, direction, severity, evidence, occurred_at, review_state, review, permissions_changed}` — `management.py:154-164`。
