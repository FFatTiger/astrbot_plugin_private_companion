# 工作区（workspaces）合并审计报告

范围：`pages/陪伴小屋/workspaces/{identity,relationships,host,persona,life}/` 五个工作区 + 工作区外壳（product-page.js / embedded-bridge.js / shell 导航）。分支 `wechat`，HEAD `2e29e3f`。**只读**：本文件与 `workspaces.items.json` 是唯一写入。
口径：**兼容 + 页面重构，不砍功能**。第 6 节为「按条件显示」，第 7 节为功能完整性验收清单。

本报告由分片合并而成；分片保持不动，含完整大表：
`docs/ui-audit/_parts-workspaces/{_shell,identity,relationships,host,persona,life}.md / *.items.json`。
其中 **identity 的 .md 分片此前缺失，本报告 §1.1–§7.1 为新补全文**；life 的 items 分片缺失，已按 life.md 补进 `workspaces.items.json`（37 条）。后端对应关系核对见 §0。

## 0. 后端文件 ↔ 工作区对应关系（本次核对）

| 后端文件 | 路由数 | 服务的工作区 | 前端调用位置 |
|---|---|---|---|
| `astrbot_host/acquaintance_api.py`（783 行） | 9 条：`GET /acquaintance`（目录，含 persons/groups/group_networks/group_access）；`GET/POST /acquaintance/authorization`；`POST /acquaintance/admin-name`；`POST /acquaintance/identity`；`GET/POST /acquaintance/settings`；`GET/POST /acquaintance/open-loops`（acquaintance_api.py:44-49,304-314） | identity 工作区全部 + host 工作区群成员关系网（app.js:1166）+ 父页关系网页头弹窗（person/private_access 默认值走 config/configure，非本文件） | identity/app.js、identity/member-editor.js、host/app.js、product-page.js 白名单只放行 `acquaintance`、`acquaintance/authorization`、`acquaintance/admin-name`、`acquaintance/identity`、`acquaintance/settings`、`acquaintance/open-loops`（product-page.js:1097,1104） |
| `astrbot_host/account_session_api.py`（606 行） | accounts（GET/POST 整体）、accounts/role、accounts/group-target（无调用方）、accounts/session（无调用方）、accounts/window-link、accounts/window-unlink、accounts/model-provider | host 工作区全部；accounts/role 另被 setup-guide.js:906 使用 | host/app.js；父页白名单只放行 `host/status`、`host/start`、`accounts`、`accounts/model-provider`、`acquaintance`(GET) → window-link/unlink 在 iframe 内发不出去（product-page.js:1093-1099） |
| `astrbot_host/multi_api.py`（355 行） | page/targets、host/status、host/start、host/stop、host/probe、host/initialize、host/performance、host/authorize-*、revoke-*、staging/* 等 | 所有工作区的挂载前提（`role().<kind>_api` 就来自 page/targets 的投影，multi_api.py:150-190：群对象 persona/life/relationships/memory_api=null，group_memory_api 仅群有） | product-page.js:808-818（工作区可用性门槛） |
| `astrbot_host/persona_workshop_api.py`（1099 行） | 8 条：GET persona、persona/command(save/restore)、persona/standardize、persona/tryouts、persona/style-rules、persona/profile-draft、persona/profile-migration-plan、persona/profile-migration-apply | persona 工作区用前 5 条；后 3 条归父页「自我 > 角色档案」（role-profile-draft.js / role-profile-migration.js） | 桥白名单只放行 persona(GET)/persona/command/persona/standardize → **tryouts、style-rules 被拒，第 3/4 步必失败**（product-page.js:1112-1115） |
| `astrbot_host/life_api.py`（92 行） | 2 条：GET life、POST life/command（14 个 action 白名单，life_api.py:74-80） | life 工作区全部 | life/app.js（一个 GET 吃全部数据）；父页放行 life/life/command |

关键不变量（详见 api.md）：写操作一律 `operation_key` 幂等；令牌共 10 种名字；错误一律 HTTP200+`{status:"error"}`。

## 1. 页面 / 视图清单

### 1.1 identity（关系网 / 用户 / 群聊）——新补

一个 iframe（index.html 184 行 + app.js 1549 行 + member-editor.js 1459 行），三个页内 tab（index.html:42-49），由父页三个菜单项分别带 `data-workspace-tab` 进入（app.js:4005-4016）。数据全部来自一个 `GET /acquaintance`。

| 视图 / 分区 | 怎么进来 | 用途一句话 | 主要组件 | 代码位置 |
|---|---|---|---|---|
| 页头 | 常驻 | 标题 + intro + 连接状态 + 重读 | `#page-title`、`#sync-state`、`#refresh` | index.html:14-25 |
| 范围条 | 常驻 | 目录范围/管理者/4 个计数 | 6 格 `scope-strip` | index.html:28-36 |
| 通知条 | 操作后 | 结果/错误一句话 | `#notice` | index.html:38 |
| 页内 tab + 搜索 | 常驻 | 关系网/用户/群聊切换；搜名称账号群号 | `.view-tabs`、`#directory-search` | index.html:41-57；app.js:1363-1380 |
| 关系网·关系分层 | tab=network（默认） | 按 两边都有/仅私聊/仅群聊/暂无往来 四档铺人卡 | 4 个 `network-tier` + 人卡（消息数条形） | index.html:63-86；app.js:780-857 |
| 关系网·群聊入口 | 同上 | 群卡片（状态徽标） | `#network-groups` | index.html:88-97；app.js:842-857 |
| 关系网·识别线索 | 同上 | 纯静态解释文案 | `network-basis` 3 格 | index.html:99-105 |
| 关系网·互动雷达 | 同上，默认折叠 `<details>` | SVG 光点图：私聊内圈/群聊外圈，分簇展开 | `#relationship-graph`、graph-filter | index.html:107-123；app.js:588-857（radarCloseness :588-598，>48 人截断 :613-630） |
| 用户·筛选 | tab=people | 私聊用户/群聊用户/其他会话 + 隐藏无往来用户 | 3 chip + `#hide-idle-users` | index.html:133-142；app.js:225-289 |
| 用户·目录与详情 | 同上 | 左网格右详情 | `#people-grid` + `#person-detail`（member-editor.js 挂载 :1236） | index.html:143-152；app.js:496-557 |
| 群聊·概览与筛选 | tab=groups | 全部/已接入/待处理/历史往来 5 格统计 | `group-overview-strip` + 4 filter | index.html:158-170；app.js:869-889 |
| 群聊·群详情 | 点群卡 | 群档案聚合页 | `#group-detail`（renderGroupDetail） | app.js:944-1140 |
| 群详情·V2 群聊接入 | 常驻首屏 | 接入状态 + 引导按钮 | 状态徽标 + 「账号与会话」「本群回应设置」「群公共档案」按钮 | app.js:975-1021（navigate :1003-1018） |
| 群详情·群聊近况/活跃群友 | 有观察数据时 | 发言摘录 + top6 活跃成员 | `group-activity-list`、`group-active-list` | app.js:1023-1057 |
| 群详情·成员互动 | network 有边时 | 群内接话 SVG 网络 | `memberNetworkMarkup` | app.js:1059-1086、1163-1214 |
| 群详情·成员与熟人卡 | 常驻 | 成员 chip（熟人卡/群观察统计），可点开成员 | `group-members` | app.js:1087-1119 |
| 群详情·待确认成员线索 | unmatched_clues 非空 | 歧义线索列表 | `unresolved-clue` | app.js:1121-1137 |
| 成员详情（5 pane） | 点任意人卡/成员 chip | 逐人配置中心 | member-editor.js：`access/relationship/reply/contact/history` | member-editor.js:1231-1278 |
| ↳ 身份与权限 (access，默认 pane) | 默认 | 目录备注、身份级别、能力开关 | `directoryRemark` :595-612、`identityBlock` :663-753、`permissionRow` :591-657、`advancedAuthorityRow` :617-656 | member-editor.js:660-773 |
| ↳ 人工关系资料 (relationship) | tab | 称呼/关系定位等 7 字段；core 身份只读 | `relationshipPane`（core 分支 :576-583） | member-editor.js:565-594 |
| ↳ 回复微调 (reply) | tab | ~120 个 reply 字段逐人覆盖 | `replyPane` + `replyLabels`（:14-30 完整中文表） | member-editor.js:1069-1119 |
| ↳ 联系偏好 (contact) | tab | 主动联系逐人覆盖 + 计划诊断块 | `contactPane`（诊断 :923） | member-editor.js:775-860 |
| ↳ 往来记录 (history) | tab | 统计 + 开放话题管理 | `historyPane` :957-998 + open-loops | member-editor.js:957-998 |
| 熟人卡弹窗 | 成员详情内 | 学习开关等 | `openCard` | member-editor.js:1279 附近 |

门禁（重要）：`canConfigure = route.private_target && route.settings_available`（member-editor.js:1251-1252）；不满足时除 history 外所有 pane 只显示一句「此成员尚未建立…可管理的 V2 私聊窗口…只读」（:1257）。

### 1.2 其余四个工作区（浓缩；全表见分片）

| 工作区 | 视图数 | 一句话结构 | 分片 |
|---|---|---|---|
| host（账号与会话） | 17 视图 | 状态面板 + 共享启动模型 + 角色映射编辑器 + 三列拓扑（抽屉内窗口合并/群成员关系网）+ 群聊目标；无弹窗无向导 | host.md §1 |
| persona（人格问卷） | 11 视图 | 5 步单向流水线：问卷→审核→试答→风格→对照存版；版本记录折叠在第 5 步 | persona.md §1 |
| relationships（关系与情感） | 私聊 6 视图 / 群 7 视图 | **一个工作区两套 UI**：私聊=关系理解四态列表；群=共享陈述+安全审阅（group-memory.js 整页替换，index.html 骨架成死 DOM） | relationships.md §1 |
| life（日记与生活） | 15 视图 | 范围条+作息读数+4 tab（日记/阅读/睡眠/回执）+ 折叠设置 + 9 用途共用弹窗 | life.md §1 |
| 外壳 | — | 18 左栏项 + 21 浮层项 + 24 页签四张互不同步的导航表；iframe 桥白名单/超时/高度约束 | _shell.md §A-B |

## 2. 设置项清单

### 2.1 identity（新补全表）

数据层级：**安装级相识目录**（acquaintance 域，按 subject 主键）+ **成员级覆盖**（/acquaintance/settings，需私聊窗口）+ **授权条目**（/acquaintance/authorization，按 subject）。默认值指后端默认。

| 字段 | 界面标签 | 所在页面/分区 | 读写 API | 层级 | 默认 | 备注 |
|---|---|---|---|---|---|---|
| `admin_nickname` | 目录备注 / 目录显示名称 | 成员详情 > 身份与权限（pane 末尾） | POST `/acquaintance/admin-name`（subject_id+route{platform,bot_id,account_id,role_id}+native_account_id+admin_nickname+expected_revision+operation_key，acquaintance_api.py:617-620） | 安装（按人） | 空 | ≤64 字；**后端不要求私聊窗口，但 UI 放在 accessPane 被 canConfigure 挡住**（已知问题①） |
| `identity_tier` | 身份级别（普通/重要/核心用户） | 成员详情 > 身份与权限 | POST `/acquaintance/identity`（tier+expected_revision，acquaintance_api.py:653-668） | 成员 | standard | 按 subject 主键；同样被 accessPane 挡；core=核心管理员 |
| `capability[conversation.reply / proactive.contact / role.state.intervene / calendar.intervene / role.rest.wake]` | 允许私聊对话/主动联系/影响角色状态/调整日程/休息时干预 | 同上（可写开关） | GET/POST `/acquaintance/authorization` | 成员 | 由 tier 决定默认准入 | emphasized 逐人能力；`managed_by=configuration` 的只能跳去对应页（member-editor.js:633-642） |
| `capability[text / message.delivery / configuration.read / screen.* / extension.tool.invoke]` | 其他能力授权（只读 + 去对应页面） | 同上（展开查看全部） | GET `/acquaintance/authorization` | 成员 | — | 只读投影 |
| `sections.profile.{default_nickname,role_relation,user_gender,user_birthday,user_occupation,interaction,extra}` | 对用户的称呼/关系定位/性别/生日或纪念日/职业/相处方式/其他补充 | 成员详情 > 人工关系资料 | GET/POST `/acquaintance/settings` | 成员 | 跟随角色默认（provenance 标记） | core 身份时整块只读（member-editor.js:576-583）；跨区域：与「自我>相处资料」(self-relationship.js)、角色级 `person` section 同名字段三处 |
| `sections.reply.*`（~120 键，replyLabels 全表 member-editor.js:14-30） | 启用消息分段/流式/清理/替换/引用/语音×16/图片视频文件理解… | 成员详情 > 回复微调 | 同上 | 成员（窗口覆盖） | 跟随角色 | 跨区域：表达页、角色 reply 配置维护同一批字段 |
| `sections.contact.{enabled,automatic_enabled,quiet_enabled,max_contacts_24h,interval_seconds,idle_seconds,unanswered_*,quiet_start/end/timezone}` | 联系偏好（主动计划/联系节奏与时段） | 成员详情 > 联系偏好 | 同上 | 成员 | 跟随全局 | 跨区域：主动联系页是全局默认，此处逐人覆盖 |
| `sections.contact.schedule_diagnostic` | （联系计划诊断块） | 同上 | GET（只读投影） | 成员 | — | 诊断信息混在设置页 |
| `sections.person_learning.*` | 熟人卡学习开关 | 熟人卡弹窗 | 同上 | 成员 | — | 跨区域：互动记忆展示 |
| `open_loops[]` | 开放话题（结束/重新打开/删除） | 成员详情 > 往来记录 | GET/POST `/acquaintance/open-loops`（complete/reopen/delete+expected_revision） | 成员 | — | 唯一对群成员也可用的管理动作（historyPane 不受 canConfigure 限制 :1253） |
| `persons[] / groups[] / group_networks / group_access` | 关系分层/用户目录/群聊目录/群详情 | 三个 tab 全部视图 | GET `/acquaintance` | 安装 | — | 只读；前端 mergeDirectoryPeople 合并多路由（app.js:107-152） |
| `directory-search / people.filter / hide-idle-users / group.status-filter / graph-scope` | 搜索/筛选/隐藏无往来用户/群状态/雷达范围 | 各 tab 工具条 | 无（纯前端） | 浏览器 | — | 不落盘 |
| 父页弹窗 `person / private_access / relay / knowledge.members` | 用户默认资料/私聊用户权限/跨窗口递话/群成员线索 | 关系网页头按钮 + `#manage/identity-access` | POST `config/configure {section}` | 角色/窗口 | — | 见 _shell.items.json；relay 无可达入口（已知问题②） |

### 2.2 其余工作区（浓缩；全表见分片）

| 工作区 | 设置项数 | 关键字段（层级） | 分片 |
|---|---|---|---|
| host | 12 | `multi_host.{enabled,accounts,personas,targets,group_targets,window_links}`（安装/账号/角色/窗口/群）；`model.provider_id`（安装）；置顶/筛选（本地） | host.md §2 |
| persona | 18 | 问卷 10 项+强度+来源+参考材料（本地）；8 分区+风格 2 项（→command.save）；`note` 必填；版本列表（插件草稿账本） | persona.md §2 |
| relationships | 私聊 2 + 群 2 | `interpretation`（唯一可编辑文本）；`state` 动作；群 `review_state`；其余全只读投影 | relationships.md §2 |
| life | 13 显式（服务端 25） | `enabled`（授权闸门）；`diary_*`；`sleep_*`×6（角色共享）；`reading_enabled`/`derive_enabled`；未暴露 5 写作偏好+8 休息闸门 | life.md §2 |

## 3. 操作清单（合并）

| 工作区 | 操作数 | 保存模型摘要 | 分片 |
|---|---|---|---|
| identity | 目录重读；admin-name / identity / authorization / settings / open-loops 五类写 | settings 用 edit_token+operation_key+reset_to_inherit；authorization 用 expected_revision；admin-name 用 expected_revision+operation_key；member settings 60s 超时（member-editor.js:3） | §2.1 + identity.items.json |
| host | 43 条 | **所有 bindings 写=停机重启**（apply_bindings，2s grace）；POST accounts 整体替换、无 revision；「保存角色映射」与「保存群目标」两个独立整体应用按钮 | host.md §3（43 条全表） |
| persona | 47 条 | 只写插件草稿账本（save/restore 均 INSERT）；`expected_current` 乐观锁；standardize/tryouts/style-rules 为 90s 模型调用（桥 18s 即断） | persona.md §3/§10 |
| relationships | 私聊 4 动作 + 群 3 动作 | 即时提交（review/adopt 一键无确认；revise/retract 弹窗）；view_token+expected_revision+operation_key；群安全审阅幂等缺失（每次新 UUID，group-memory.js:135） | relationships.md §3 |
| life | 14 action + 2 分页 + 刷新 | 四令牌体系（view_token/edit_token/expected_revision/operation_key）互相独立；「保存设置」13 项全量覆盖 | life.md §3 |

## 4. 重复与冲突（跨工作区汇总）

同一数据/设置在本区域内的全部编辑/展示位置（全局去重输入，逐条位置见 workspaces.items.json）：

| # | 数据/设置 | 位置数 | 全部位置 | 冲突性质 |
|---|---|---|---|---|
| 1 | `role.life` 配置组（13+13 字段） | 4 | life 工作区 configure（全量）｜小屋「日记与生活」面板配置器 app.js:791-793（差异集）｜决策页「沉默策略·忙碌与休息」app.js:2136｜主动联系「开口闸门」app.js:4055 | 四处改同一 section；全量 vs 差异集两种提交语义并存 |
| 2 | 称呼/关系定位（`default_nickname/role_relation`） | 4 | identity 成员详情（成员级）｜自我>相处资料 self-relationship.js:48-54（核心用户）｜identity 关系雷达节点副标题（只读 app.js:570-575）｜角色级 `person.default_nickname`（关系网页头弹窗） | 「默认值 vs 逐人覆盖 vs 核心用户专页」三层三种叫法 |
| 3 | `private_access` 私聊默认权限 | 3 | 关系网页头「私聊用户权限」弹窗 app.js:4240-4243｜`#manage/identity-access` 独立页 app.js:4017-4021｜旧 identity 页残留 app.js:3641（已不渲染） | 同一 section 三种壳，其中一处死入口 |
| 4 | `relay` 跨窗口递话 | 1（不可达） | markup/mount 只在 renderIdentityPageOriginal（app.js:3641/3792），该页已不被任何 renderer 使用 | **能力存在、界面零入口**（已知问题②） |
| 5 | 账号/人格/角色映射 | 3 | host 工作区 POST accounts｜setup-guide「开始使用」POST accounts/role（app.js:906）｜models 页文案指回 | 两套编辑器写同一 `multi_host.personas`，一个带 expected_config 一个不带 |
| 6 | `model.provider_id` | 3 | host 共享启动模型｜setup/model（setup_api.py:487-517）｜模型与连接页文案 | 同一字段三入口 |
| 7 | 宿主启停 | 3 | host「准备并启动」POST host/start｜setup/host/start｜embedded-bridge.js:70 强制隐藏 start/stop 与 host 页竞争 | 想停无处停 |
| 8 | 群目录/群成员 | 3 | host 群聊目标 + 群节点抽屉关系网｜identity 群聊 tab 群详情｜（群档案按钮错位跳转） | 同一批群两套展示 + 一次疑似错位跳转 |
| 9 | 人格文本链路 | 4 | persona 工作区（只写插件草稿）｜自我>角色档案（role_profile，写 V2 配置）｜role-profile-draft/migration（persona_api 的另外 3 条路由）｜AstrBot 原生人格（唯一真身，全插件只读） | 「整理人格」vs「整理角色档案」两条链路用户难分；落地断在剪贴板 |
| 10 | 关系数据 | 3 套 | relationships 工作区（关系理解记录）｜identity 熟人卡（关系定位标签）｜自我>相处资料（核心用户关系资料） | 三套数据模型共用「关系」一词；relationships.md §4 逐条列真身 |
| 11 | 状态口径 | 2+ | host 状态面板 19 类状态位｜治理与维护页诊断｜各工作区各自 failure_code 文案表（identity 40+ 条、host 69 条、persona 27 条、life 15 条、relationships 10 条） | 错误码翻译表分散 5 处，覆盖不全一律兜底机器码 |
| 12 | 生成副本 | 6 目录 | pages/{宿主管理,人物设定工坊,关系与记忆,日记与生活,关系与权限,陪伴小屋}= tools/sync_framework_page.py 生成 | 改源必须重新 sync，否则两份 UI 静默漂移 |

## 5. 交互问题（合并 Top 问题，全部有分片全表）

**P0（功能性断裂，新 UI 必须修）**

| # | 问题 | 位置 |
|---|---|---|
| ① | **没有私聊窗口的群成员改不了称呼/身份/授权**：后端 admin-name/identity 契约只要求 route 四元组（acquaintance_api.py:617-620,660-664），但 UI 把目录备注/身份级别/能力开关全放在 accessPane，而 accessPane 被 `canConfigure`（需要 private_target）整体禁用（member-editor.js:1251-1257、772） | identity |
| ② | **relay 无可达入口**：配置器能力完整（mount app.js:3792），markup 只存在于已废弃的 renderIdentityPageOriginal（app.js:3634/3641/4003） | 外壳 |
| ③ | **persona 第 3/4 步必失败**：桥白名单拒 `persona/tryouts`、`persona/style-rules`（product-page.js:1112-1115），三按钮永远报「数据不完整」 | persona |
| ④ | **host 窗口合并发不出去**：白名单不含 `accounts/window-link|unlink`（product-page.js:1093-1099） | host |
| ⑤ | **群档案按钮错位跳转**：identity 群详情「群公共档案」navigate group-memory，父级把 group-memory 映射到 `manage/governance/relationship`（self-relationship 核心用户编辑器，product-page.js:1062-1063、app.js:3623-3624），无群分支 | identity/外壳（需运行验证） |
| ⑥ | **新增群在群目标列表看不到**：宿主组装后 discovered 只返回已配置路由（session_topology.py:417-419,551-554），未启用的群没有行可勾 | host |

**P1（保存模型混乱）**

| # | 问题 | 位置 |
|---|---|---|
| ⑦ | 令牌 10 种名字、语义各异：host 完全无 revision（并发静默覆盖）；life 四令牌互相独立且「保存设置」使全部条目 view_token 失效；persona 叫 `expected_current`；relationships 冲突后无就地恢复（连点连错）；群安全审阅无幂等键复用 | 各分片 §3 |
| ⑧ | host 两个「保存」按钮都是整体应用且= 停机重启；保存后一致性比对把内部竞态暴露成用户错误（app.js:1706-1712） | host |
| ⑨ | life「操作成功但界面不重绘」（load(true) preserveNotice 路径 app.js:189-191）；diary/dream 同步等模型 90s 而桥 15/18s 即断，超时后服务端可能仍在写 | life |

**P2（噪音与术语）**

19 类状态位（host）、40+ 处解释文案（persona index.html）、范围条四格（relationships/life/identity 三处同款）、`persona_source`/`executor_state`/`rule_id`/`severity`/`unavailable_reason` 原码上屏、错误码兜底文案、双人向归属（reviewed_by×4）、步骤导语与免责声明（「不会覆盖人格」出现 8+ 次）。详见各分片 §5。

## 6. 按条件显示清单（合并；功能全保留，只收起）

判断字段全部来自现有接口，无需新后端：

| 条件来源 | 控制什么 | 引用 |
|---|---|---|
| `role().<kind>_api === null`（GET page/targets，multi_api.py:150-190） | life/persona/relationships(私聊)/memory 工作区仅私聊挂载；群对象改挂 group_memory_api | _shell.md F、persona.md §7#1、life.md §6 |
| `catalog.acquaintance_api` 非空 | identity 三目录 + host 群成员关系网 | product-page.js:817 |
| `scope_kind === "group"` | relationships 切群档案 UI；identity 群详情群档案分支 | relationships.md §7#8 |
| `GET accounts` 的 `.discovered.accounts[].length`、`.personas[]` distinct role_id、`.groups[]`、`.window_links[]` | host 多账号卡片/角色命名/拓扑连线/分页/筛选/窗口合并整块/群目标面板 | host.md §6（24 条全表） |
| `GET life` 的 `config.enabled / diary_enabled / sleep_enabled / sleep_schedule.enabled / physiology.has_sleep_history / receipts[] / next_*` | life 各设置组逐级收起、生理区隐藏、执行记录 tab 空时隐藏 | life.md §6（26 条全表） |
| `GET persona` 的 `persona.resolved / count / current / personas[].length` | persona 空态/版本区/人格下拉禁用 | persona.md §7（19 条全表） |
| `GET /acquaintance` 的 `private_target/settings_available/configured/discovered` | identity：canConfigure 门禁（新 UI 应把 admin-name/identity 移出门禁）、群接入引导按钮、状态徽标 | §2.1、app.js:993-1021 |
| `GET /acquaintance/authorization` 的 `managed_by / identity_override / revocable` | 能力开关 disabled 态与「去对应页面」跳转 | member-editor.js:591-657 |
| 平台注册表（**当前缺失**）：前端 platformLabel 只认 QQ 系（product-page.js:676），后端 SUPPORTED_PLATFORM_NAMES 同（native.py:38） | 平台相关能力按真实平台显示；新 UI 需读（打补丁后的）注册表而非再抄一份 | _shell.md F |

界面收敛（只动界面）：三层导航表合一；identity 三个菜单项→一个「人」列表（三视图保留）；relationships/群档案/相处资料三块各自明确入口；19 类状态位→4 类；诊断收「高级」；host 编辑器+拓扑合一。

## 7. 功能完整性清单（验收用）

### 7.1 identity（新补，42 条）

| # | 功能点 | 当前入口 | 依赖接口 |
|---|---|---|---|
| 1 | 读相识目录（人+群+互动网络+接入状态） | 页面加载/重新读取 | GET /acquaintance |
| 2 | 关系分层四档视图 | tab=关系网 | 同上（persons[]） |
| 3 | 互动雷达（分簇/范围过滤/选中联动） | 关系网 > 互动雷达 | 同上（前端计算 closeness） |
| 4 | 用户目录三档筛选+隐藏无往来+搜索 | tab=用户 | 同上（纯前端过滤） |
| 5 | 群目录四档筛选+五格概览 | tab=群聊 | 同上（groups[]） |
| 6 | 群详情：接入状态+引导按钮（账号与会话） | 群详情 > V2 群聊接入 | GET /acquaintance（group_access）+ navigate |
| 7 | 群详情：本群回应设置跳转 | 同上（configured 群） | navigate group-reply |
| 8 | 群详情：群公共档案跳转 | 同上 | navigate group-memory（⑤错位，需运行验证） |
| 9 | 群详情：群聊近况/活跃群友 | 同上 | GET /acquaintance（group_networks） |
| 10 | 群详情：成员互动 SVG+边列表 | 同上 | 同上（edges） |
| 11 | 群详情：成员与熟人卡（点开成员详情） | 同上 | 同上（members+clues） |
| 12 | 群详情：待确认成员线索 | 同上 | 同上（unmatched_clues） |
| 13 | 成员详情五 pane 导航（键盘左右/Home/End） | 点人卡/成员 chip | 无（本地） |
| 14 | 目录备注（admin_nickname） | 身份与权限 pane 末尾 | POST /acquaintance/admin-name |
| 15 | 身份级别三档（identity_tier） | 身份与权限 | POST /acquaintance/identity |
| 16 | 5 个可写能力开关 | 身份与权限 > 窗口权限 | POST /acquaintance/authorization |
| 17 | 其他能力授权只读+跳转（8+ 项） | 身份与权限 > 展开查看全部 | GET /acquaintance/authorization |
| 18 | 人工关系资料 7 字段（core 只读） | 人工关系资料 | GET/POST /acquaintance/settings{profile} |
| 19 | 回复微调 ~120 字段逐人覆盖+恢复跟随角色 | 回复微调 | 同上{reply}（reset_to_inherit） |
| 20 | 联系偏好逐人覆盖+继承重置 | 联系偏好 | 同上{contact} |
| 21 | 联系计划诊断块（只读） | 联系偏好底部 | 同上（schedule_diagnostic） |
| 22 | 往来记录统计（私聊/各群） | 往来记录 | GET /acquaintance |
| 23 | 开放话题读/结束/重开/删除 | 往来记录 | GET/POST /acquaintance/open-loops |
| 24 | 熟人卡弹窗（学习开关） | 成员详情 | POST settings{person_learning} |
| 25 | 多路由成员合并展示（display_routes 选择） | 成员详情头部 | GET /acquaintance（member-editor.js:1254-1256） |
| 26 | 群成员（无私聊窗口）只读模式 + history 可用 | 成员详情 | 同上（canConfigure=false 分支） |
| 27 | 配置错误分节重试 | 各 pane | 无（retry UI） |
| 28-42 | 与后端契约配套：member settings 60s 超时、edit_token+operation_key+reset_to_inherit 提交、authorization expected_revision、admin-name operation_key、open-loops expected_revision、搜索/筛选/雷达纯前端状态、tab 状态持久（states Map）、群接入失败文案表（app.js:6-41 约 40 码）、通知条、lucide 图标重绘、mergeDirectoryPeople 合并、群名 display_name 回退链、群角色标签多人格合并（groupRoleLabel app.js:183-189） | — | identity.items.json 逐条 |

### 7.2 其余工作区（条目数 + 分片指针）

| 工作区 | 验收条目 | 全表 |
|---|---|---|
| host | 43 条（含 9 条「能力存在、UI 无入口」：stop/probe/initialize/authorize×4/session/单条 group-target/performance） | host.md §8 |
| persona | 47 条（8 条路由逐条对应；含跨区域 3 条 profile-migration） | persona.md §10 |
| relationships | 私聊 27 + 群 23（合并清单见分片 §1-§3；必须保留：actions[] 服务端驱动、三令牌、revise/retract、群 detail 续读参数） | relationships.md §3/§6 |
| life | 32 条（14 action 全部可达；四令牌语义不变；只挂私聊） | life.md §7 |
| 外壳 | 24 个导航功能条目全部可达（含 relay 需新入口） | _shell.md G |

## 8. 给新 UI 的建议（合并版）

1. **一个对象一个「人/群」页**：identity 三 tab + host 拓扑抽屉 + relationships 群档案合并为统一「对象」视图——人（目录行→详情：称呼/身份/权限/偏好/往来）、群（行→详情：接入/成员/陈述/回应设置）。数据各有真身，不要合并存储，只合并入口。
2. **能力驱动显示**：以 `page/targets` 的 `*_api` 字段为唯一开关源（multi_api.py:150-190 现成机制），入口级收起而非空态页。
3. **统一保存语义**：一键一确认一回执；host 的整体应用保留但明确「保存并重启」；token/幂等逻辑全部收进数据层，界面不再出现「刷新后重试」类文案。
4. **诊断集中**：failure_code、目录阶段、persona_source、executor_state、operation_id、rule_id 全进一处「诊断」；错误文案表 5 份合一。
5. **两个必须补的入口**：relay（跨窗口递话）与 host stop；persona tryouts/style-rules 白名单（或去 iframe 化后自然消失）；群成员 admin-name/identity 移出 canConfigure 门禁。
6. 各工作区形态草图见分片 §7/§8（host：状态条+窗口列表+更多；persona：2 屏+高级流程；relationships：待处理条+历史；life：今天/记录/设置三屏）。

## 9. 本次合并的验证与限制

- 只读：除 `docs/ui-audit/workspaces.md`、`docs/ui-audit/workspaces.items.json` 外未改任何文件；分片原样保留。
- 已核对：acquaintance_api.py 9 条路由与契约（:44-49,304-314,598-660,669-712）、life_api.py 2 条路由与 14 action 白名单（:20-22,74-80）、life configFields 13 项（app.js:14-15）、identity index.html/app.js/member-editor.js 关键行号（tab 42-49、canConfigure 1251-1257、pane 表 1231-1233、群详情 944-1140、navigate 1003-1018）均与分片引用一致。
- 标「待运行验证」：群档案错位跳转（⑤）、persona localStorage/clipboard 在沙箱 iframe 的实际表现、白名单拦截的实际报错形态（分片已用 Node 复算布尔判据确认 REJECT）。
