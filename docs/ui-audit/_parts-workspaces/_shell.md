# 工作区外壳与入口（父级审计，供合并用）

审计范围：pages/陪伴小屋/{app.js,shell.js,product-page.js,embedded-bridge.js,self-relationship.js}。
分节证据文件：identity.md / relationships.md / host.md / persona.md / life.md。

## A. 导航与入口事实

### A1. 三层导航，各自有独立的条目清单

| 层 | 定义位置 | 条目数 | 谁在用 |
|---|---|---|---|
| 左侧主导航（可见） | shell.js:116-141 `RAIL_GROUPS` | 18（专题配置 7 + 能力配置 7 + 设置 4） | 常驻左栏 |
| 「全部功能」浮层 | app.js:52-56 `navGroups`（21 项）+ app.js:206-217 | 21 | 浮层；不在左栏的项落进「其他入口」分组 |
| 页内二级页签 | app.js:1738-1743 `manageTabs` | 24 | `renderManage()` 的 tab 表 |
| 路由渲染表 | app.js:742-756（`renderSectionPanel`）与 app.js:4251-4259（`renderManage`） | 24 | **同一张表存在两份副本**，两份都含 `identity-access` / `identity-feelings` |

结论：同一个页面最多有三条不同路径可达（左栏 / 浮层 / 二级页签 / 深链接），四张表互不同步。

### A2. 五个工作区的真实入口

| 工作区 | 入口 | 代码位置 | 入口数 |
|---|---|---|---|
| identity（关系网/用户/群聊） | 左栏「关系网」= `#manage/identity`（tab=network） | shell.js:118、app.js:4005-4009 | 1 |
| identity tab=people | 浮层「人物与群聊 → 用户」= `#manage/identity-people` | app.js:206-217、4011-4013 | 1（不在左栏） |
| identity tab=groups | 浮层「人物与群聊 → 群聊」= `#manage/identity-groups` | app.js:206-217、4014-4016 | 1（不在左栏） |
| host | 左栏「账号与会话」= `#manage/host` | shell.js:138、app.js:3866、4222 | 1 |
| persona | 左栏「自我」→ 页内「人格问卷」= `#manage/governance/questionnaire` | app.js:3583-3587（tabs 表）、3865 | 1（藏在二级页签） |
| life | 小屋面板「日记与生活」= `#life/diary` | app.js:789-793、4399-4404 | 1（+ 4 个家具抽屉入口会跳到同一处，见 D3） |
| relationships | **只有**「关系网」页头按钮「关系与情感」= `#manage/identity-feelings` | app.js:4239、4022-4025 | 1（一个页头按钮） |

补充事实：

- `identity-feelings`（relationships 工作区）不在 `RAIL_GROUPS`，也不在 `navGroups`，只能从关系网页头的一个 small 按钮或深链接进入（app.js:4238-4249）。
- `product.workspaceAddress('relationships')` 返回 `#manage/governance/relationship`（product-page.js:822-825），而该地址实际挂的是 `#relationshipProfileConfigWorkspace`（app.js:3623-3624 → self-relationship.js 核心用户关系资料编辑器），**不是** relationships 工作区。两个不同的东西共用一个地址。
- 群聊详情里的「群档案」按钮走 `navigate{tab:"group-memory"}`（identity/app.js:1015），父级处理后跳到 `manage/governance/relationship`（product-page.js:1062-1063）。该面板没有群分支（app.js:3623-3624 直接渲染 self-relationship），静态代码上是一次错位跳转，需运行验证。
- 三个独立菜单项（关系网 / 用户 / 群聊）挂的是**同一个 iframe**，只是 `data-workspace-tab` 不同（app.js:4005-4016）。

### A3. 工作区可用性门槛（不同工作区不一致）

| 条件 | 位置 | 影响 |
|---|---|---|
| `host` 只要 bridge 就绪 | product-page.js:808 | 其余工作区都要求 `catalog` 读取完成 |
| `identity` 额外要求 `catalog.acquaintance_api` | product-page.js:817 | 未初始化时整块替换为引导块 |
| 其余（life/relationships/persona）要求 `role()[name+"_api"]` 非空 | product-page.js:818 | 当前对象是群时 `persona_api`/`life_api`/`relationships_api` 均为 null（multi_api.py:180-186），工作区直接不可用 |
| 群对象时 relationships 改走 `group_memory_api` | product-page.js:962-967 | 同一个 iframe 变成完全另一套 UI（group-memory.js） |

未通过时的界面表现（product-page.js:810-820）：「角色与会话目录暂未读到，这个功能页暂时无法加载」+「重新读取」+「账号与会话」两个按钮。

## B. iframe 桥的硬约束（新 UI 必须知道）

| 约束 | 位置 | 说明 |
|---|---|---|
| 请求白名单按 kind 硬编码 | product-page.js:1092-1116 | identity 只允许 `acquaintance*` 的 5+4 条；relationships(群) 只允许 `group-memory` 的 3+3 条；host 只允许 `host/status`、`host/start`、`accounts`、`accounts/model-provider`、`acquaintance`(GET)；其余只允许 `<kind>` 与 `<kind>/command`（persona 额外允许 `persona/standardize`）。新增接口调用必须同步改这张表，否则 iframe 侧收到 `invalid_response`。 |
| 默认超时 18s，上限 300s | embedded-bridge.js:6、55-57 | 超时文案「未收到执行结果，请核对后重试本次操作。」(embedded-bridge.js:60) |
| 工作区打开 20s 未响应即报错 | product-page.js:945-948 | 文案「工作区打开时间较长，页面暂时没有响应，可以重试。」 |
| 高度由子页 ResizeObserver 上报，父级夹在 620~2400px | embedded-bridge.js:72-75、product-page.js:1032 | 超过 2400px 的页面在 iframe 内二次滚动 |
| 当前对象变化时非 host/identity 工作区整体重建 | product-page.js:987-990 | 未保存内容随 iframe 一起丢失 |
| 所有工作区强制隐藏 `#start-host` / `#stop-host` | embedded-bridge.js:70 | host 工作区想自己控制显隐（host/app.js:1817+）会与桥打架，需运行确认 |
| 子页在 iframe 内无法自行导航顶层 | product-page.js:1036-1075 | 只能发 `navigate` 消息，且目标被限制为白名单（host/setup/models/perception/selfProfile/group-reply/group-memory） |

## C. 跨区域重复（同一事实的多处入口）

| 事实 | 位置 1 | 位置 2 | 位置 3 | 位置 4 | 备注 |
|---|---|---|---|---|---|
| 生活例程 / 睡眠 / 写作（`life` 配置组） | 小屋「日记与生活」面板内嵌配置器 app.js:791-793 | 决策页「沉默策略·忙碌与休息」app.js:2136（`busy_gate`+`life`） | 主动联系「开口闸门」app.js:4055（`busy_gate`+`life`） | life 工作区 `configure`（life/app.js） | 四个地方都能改同一组字段 |
| 私聊成员默认资料（`person`） | 关系网页头「用户默认资料」按钮 app.js:4240-4243 → `identitySettingsSpecs.person` app.js:4027 → `openIdentitySettings` app.js:4034-4039 | 旧 identity 页 `<details>关系网设置` app.js:3635 | 用户页内在工作区成员详情 | — | 同一 section 三种壳 |
| 私聊默认权限（`private_access`） | 「私聊用户权限」按钮 app.js:4240-4243 → spec app.js:4028 | `#manage/identity-access` 独立页 app.js:4017-4021 | 旧 identity 页「访问规则」app.js:3641 | identity 工作区逐人授权（acquaintance/authorization） | 全局默认 + 逐人覆盖 + relay 同页 |
| 群成员线索（`knowledge.members`） | 「群聊」页头按钮 app.js:4244 → spec app.js:4029 | 旧 identity 页 app.js:3635 | — | — | 群成员资料的实际来源 |
| 角色人格文本 | 自我→角色档案 配置器 app.js:3617、3812-3815 | persona 工作区（人格问卷，只写插件草稿） | role-profile-draft.js / role-profile-migration.js | AstrBot 原生人格 | 四处名字都像「人格」 |
| 账号 / 角色 / 人格映射 | host 工作区 accounts/role、accounts/session | 首次连接页 setup-guide.js:906、912 | 模型与连接 models-page.js | — | setup 与 host 都在建角色 |
| 「关系」/「相处资料」 | 自我→相处资料（self-relationship.js，核心用户） | relationships 工作区（关系记录/群档案） | identity 工作区成员详情 | 关系与情感页头按钮 | 三套数据模型共用「关系」这个词 |

## D. 全局交互问题（不属于单个工作区）

| 问题 | 证据 | 影响 |
|---|---|---|
| 同一页面对应多个菜单项 | 关系网/用户/群聊 → 同一 iframe（app.js:4005-4016） | 用户以为换页了，其实只是换 tab；返回/前进语义混乱 |
| 名称漂移 | 「关系网」(shell.js:118) / 「人物与群聊关系」(app.js:3634) / 「关系管理」(product-page.js:807) / 「关系与记忆」(relationships/index.html:5 标题) / 「人物与关系」(product-page.js:807) | 同一功能 5 个名字 |
| 「自我」这个入口集合了角色档案、相处资料、人格问卷、世界知识四件互不相关的事 | app.js:3583-3587 | 找人格问卷要先点「自我」 |
| 工作区标题与父级标题重复 | identity 工作区自带 `<h1>关系网</h1>`+intro（identity/index.html:14-18），父级又渲染 `panelHead`（app.js:742-756） | 两层标题叠在一起 |
| iframe 内空 `<header>` | relationships/index.html:10-12 | 该工作区没有任何可见标题，只有一个「刷新记录」按钮 |
| 上下文元信息占满首屏 | relationships/index.html:13-18（当前角色/关系对象/当前会话/操作人） | 违反「不写状态说明」原则 |
| 未保存内容随对象切换消失 | product-page.js:987-990 | 无提示 |
| 深链接与真实挂载不一致 | product-page.js:822-825 与 app.js:3623-3624 | 分享的链接打开后是另一个页面 |
| 有功能但没入口：`relay`（跨窗口递话） | markup 只在 app.js:3641（renderIdentityPageOriginal），而该页已不被任何 renderer 使用（app.js:3634 定义、4003 注释）；mount 守候在 app.js:3792 | 配置器能力存在，当前 UI 无法到达 |
| 旧页面残留仍在维护 | app.js:3634-3648 renderIdentityPageOriginal、4017-4025 新页、4240-4244 弹窗三条路并存 | 改一处不会同步另两处 |

## E. 对新 UI 的直接影响（只收敛界面，功能一个不少）

1. 五个工作区不应再是「父级页签 + iframe 两层顶栏」，每个工作区只保留一套标题与一套保存语义（纯界面收敛）。
2. identity 的三个 tab 应合并成一个「人」的列表（一个入口），群与人用同一列表的两种行，不靠菜单区分；三个菜单项收敛成一个，**三个目录视图本身全部保留**。
3. relationships 目前只能从关系网页头按钮进入，且地址指向另一个编辑器——新 UI 里「关系记录」「群档案」「核心用户相处资料」三块数据都要保留，但必须各自有明确入口，不再共用一个地址。
4. 新 UI 若继续用 iframe 方案，`product-page.js:1092-1116` 的白名单必须同步扩展（否则能力存在但点不到）；若改成同页渲染，这段白名单可整体不用，但需自行重做身份校验（它是唯一一处把 iframe 能调的接口收窄的地方）。是否保留 iframe 属于实现选择，不影响功能完整性。

## F. 按条件显示（外壳层）

原则：**所有条目都保留，只是默认收起，条件成立时出现**。外壳层目前几乎没有条件渲染，这是新 UI 需要补的机制。

| 功能/条目 | 应在什么条件下出现 | 判断依据（接口/字段/file:line） |
|---|---|---|
| 五个工作区整体 | 宿主桥就绪；且当前角色有对应的 `<kind>_api` 前缀 | `bridgeReady`、`catalog`、`role()[kind+"_api"] !== null`（product-page.js:808-818） |
| identity 三个目录 | 安装级相识目录可读 | `catalog.acquaintance_api` 非空（product-page.js:817） |
| relationships 群档案分支 | 当前对象是群 | `context.scope_kind === "group"`（product-page.js:962-967）、`role.group_memory_api` 非空（multi_api.py:157-158） |
| life / persona / relationships(私聊) | 当前对象是私聊窗口 | `role.life_api` / `role.persona_api` / `role.relationships_api` 为 null 即群对象（multi_api.py:180-186） |
| host 的各步骤 | 依赖当前账号/角色/窗口的实际状态 | `GET accounts` 返回的 `accounts` / `personas` / `sessions` / `groups` / `window_links` 数组长度（account_session_api.py:113-121） |
| 平台相关能力 | 按当前接入平台出现 | **当前缺一个前端平台注册表**：`platformLabel` 只认 qq/aiocqhttp/onebot/qq_official/qq_official_webhook，其余落到「当前平台」（product-page.js:676）；后端白名单 `SUPPORTED_PLATFORM_NAMES` 只有 aiocqhttp/qq_official/qq_official_webhook（companion_v2/adapters/astrbot/native.py:38），本 checkout 未含 wechat_helper，我们靠仓库外补丁。新 UI 的平台条件必须读这个（打补丁后的）注册表，而不是自己再抄一份。 |
| 诊断/调试信息 | 默认收进「高级/诊断」 | 目前分散在各页（例：run 诊断 `#manage/maintenance`、各工作区自带失败码文案）；新 UI 统一收起 |

补充事实：左栏 18 项与浮层 21 项都**无条件渲染**（shell.js:116-141、app.js:52-56），没有任何平台/能力过滤；真正的条件判断只存在于工作区挂载处（product-page.js:808-818）。

## G. 功能完整性清单（外壳层验收用）

导航层的 24 个功能条目（左栏 18 + 浮层补齐 6），新 UI 必须全部可达：

| 功能点 | 当前入口 | 渲染/依赖 | 平台或能力前提 |
|---|---|---|---|
| 小屋首页 | `#life/home` | app.js `renderHomePanel()`，依赖 setup/status + role 状态 | 无 |
| 日记与生活 | `#life/diary` | life 工作区 + `lifeConfigWorkspace`（app.js:791-793） | 私聊对象 |
| 自我 → 角色档案 | `#manage/governance/profile` | `role_profile` 配置器（app.js:3617）+ role-profile-draft/migration | 无 |
| 自我 → 相处资料 | `#manage/governance/relationship` | self-relationship.js（核心用户关系资料 + 联系） | 私聊对象 |
| 自我 → 人格问卷 | `#manage/governance/questionnaire` | persona 工作区（app.js:3865） | 私聊对象（`persona_api`） |
| 自我 → 世界知识 | `#manage/governance/knowledge` | `knowledge` 配置器（app.js:3629） | 无 |
| 关系网 | `#manage/identity` | identity 工作区 tab=network | `acquaintance_api` |
| 用户 | `#manage/identity-people` | identity 工作区 tab=people + `person` 弹窗 | 同上 |
| 群聊 | `#manage/identity-groups` | identity 工作区 tab=groups + `knowledge.members` 弹窗 | 同上 |
| 访问规则 | `#manage/identity-access` | `private_access` + `relay` 配置器（app.js:4017-4021） | 无 |
| 关系与情感 | `#manage/identity-feelings` | relationships 工作区（app.js:4022-4025） | 私聊对象 |
| 跨窗口递话（`relay`） | **当前无可达入口**（app.js:3641 skill 残留） | `relay` 配置器（mount app.js:3792） | 无 | 需在新 UI 里重新给出入口 |
| 事实与经历 | `#manage/memory` | memory-page.js（memory_api） | 私聊对象 |
| 学习与成长 | `#manage/learning` | learning-page.js（growth/learning API） | 私聊对象 |
| 感知 | `#manage/perception` | perception-page.js（perception/perception-native/screen-access/reality-access/game-access 等） | 各能力各自开关 |
| 理解 | `#manage/understanding` | understanding-page.js（semantic/web_understanding） | 无 |
| 决策 | `#manage/decision` | decision-page.js（reply/group_participation/busy_gate） | 群对象时多一块插话设置 |
| 行动 | `#manage/action` | action-page.js（reality/together/game/live/qzone 各扩展 API） | 对应扩展启用 |
| 主动联系 | `#manage/contact` | contact-page.js（proactive.contact + reply gate） | 无 |
| 表达 | `#manage/expression` | expression-page.js（expression/reaction/voice/segmentation） | 平台支持对应消息类型 |
| 产出 | `#manage/output` | output-page.js（content/image/wardrobe/image-materials） | 对应能力/模型 |
| 开始使用 | `#manage/setup` | setup-guide.js（setup/*、accounts/role、GET accounts） | 无 |
| 账号与会话 | `#manage/host` | host 工作区 | 桥就绪即可 |
| 模型与连接 | `#manage/models` | models-page.js（model_api/budget） | 无 |
| 治理与维护 | `#manage/maintenance` | maintenance-page.js（staging/*、诊断） | 无 |
| 资料与备份 | `#manage/data[/storage|/backup|/migration]` | storage-page.js、backup-page.js、旧版迁入 | 无 |
| 外观与设置 | `#manage/appearance` | appearance-page.js（本地偏好 + theme.js） | 无 |
| 手机连接 | `#manage/mobile` | app.js:3667-3679 `renderMobileConnection`（host-options/gateway） | 手机终端扩展 |

工作区层的验收条目见各分区报告的「功能完整性清单」：identity / relationships / host / persona / life / acquaintance-api。

