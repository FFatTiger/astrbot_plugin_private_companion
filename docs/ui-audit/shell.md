# shell · 导航与框架审计

范围：`pages/陪伴小屋/` 的外壳（`app.js`、`shell.js`、`product-page.js`、`workbench-page.js`、`native-extension-panel.js`、`index.html`、`entrance.js`、`shell.css`），以及 `pages/` 下五个顶层目录与 `workspaces/` 的生成关系。页面内部字段由各区域审计覆盖；这里只记「从哪进来、挂到哪、同一份东西出现几次、什么条件下才该露出来」。

口径：新 UI 必须 100% 覆盖现有功能。本节「按条件显示」只决定默认收起，不删除入口。

行号以当前 `wechat` 分支工作树为准（`app.js` 5181 行）。

---

## 0. 信息架构（用户实际能走到的树）

AstrBot Dashboard 只发现一个页面：`pages/陪伴小屋/index.html`。五个顶层目录（人物设定工坊、关系与权限、关系与记忆、宿主管理、日记与生活）没有自己的 `index.html`，不会作为独立 Dashboard 页出现。它们的 `workspace.html` 被 `tools/sync_framework_page.py` 打进 `workspace-bundles/*.js`，由外壳 iframe 挂载。

```
陪伴小屋  pages/陪伴小屋/index.html
│
├─ 启动闸门
│   ├─ 性能模式开 → 只显示轻量状态页（不加载小屋、工作区、3D）
│   └─ 关或读不到 → 启动幕「正在打开小屋…」→ 完整外壳
│
├─ 常驻外壳（任何路由都在）
│   ├─ 左栏 #shellNav          shell.js RAIL_GROUPS，18 项，3 组
│   ├─ 左栏底：搜索 / 全部功能
│   ├─ 顶栏：当前对象 + 角色（product.renderScope）
│   ├─ 面包屑 #breadcrumb      「小屋 / 插件配置 › 当前页名」
│   └─ 体素小屋 #stageScene    只在首页全尺寸；进配置页缩成窄条，不销毁
│
├─ 首页  #life                 左栏品牌「陪伴小屋」
│   ├─ 场景：天气 6 档、时段 自动/清晨/日间/暮色/夜晚、镜头重置、布置、巡游
│   ├─ 家具条：书桌/挂历/书架/床/电台/花架/衣柜（可飞镜头）
│   ├─ 右栏 #shellSide：此刻的状态、今日安排
│   └─ 下方面板 #shellPanel（点家具或生活视图才换，小屋不动）
│       ├─ 点家具 → 该家具说明 + 跳转
│       ├─ 家具与能力 directory   14 件家具，筛选 全部/基础/拓展/待检查
│       ├─ 生活观察 observation   日记与梦境 / 生活轨迹 / 状态变化 / 交互影响
│       ├─ 状态 state             → CompanionStatePage（13 个功能块）
│       └─ 日记 diary             → iframe「日记与生活」
│
└─ 配置页  #manage/<tab>[/<subtab>]     左栏 18 项；manageTabs 另有 4 项不在左栏
    ├─ 专题配置
    │   ├─ 关系网 identity            iframe 关系与权限 tab=network
    │   ├─ 主动与联系 contact         CompanionContactPage + 隐藏的开口闸门
    │   ├─ 事实与经历 memory          记录 | 记忆策略
    │   ├─ 学习与反思 learning        8 段：总览/策略/审阅/成长/表达/行为/语义/复盘
    │   ├─ 模型与连接 models          任务模型 + 后台任务预算
    │   ├─ 治理与维护 maintenance     运行诊断 | 每日巡视
    │   └─ 手机连接 mobile            现实触及扩展的 mobile 分组
    ├─ 能力配置
    │   ├─ 感知 perception            总览 + 4 配置页（时空/模型/现实触及/外部）
    │   ├─ 理解 understanding         6 tab：总览/图片/视频/文件/网页/合并转发
    │   ├─ 决策 decision              CompanionDecisionPage 内再挂 reply view=decision
    │   ├─ 行动 action                QQ 空间 + 共处/游玩/现实设备 三张状态卡
    │   ├─ 产出 output                预览 图像|文字；配置 生图/素材/创作/能力
    │   ├─ 表达 expression            5 模块：文字/语音/表情/平台动作/群聊表达
    │   └─ 自我 governance            角色档案/相处资料/人格问卷/世界知识
    └─ 设置
        ├─ 开始使用 setup             CompanionSetup
        ├─ 外观与设置 appearance      仅本机
        ├─ 账号与会话 host            iframe 宿主管理
        └─ 资料与维护 data            存储 | 备份 | 旧版资料迁入
```

不在左栏、但地址和「全部功能」浮层仍能进：

| 地址 | 标签 | 谁渲染 |
|---|---|---|
| `#manage/identity-people` | 用户 | iframe 关系与权限 tab=people |
| `#manage/identity-groups` | 群聊 | iframe 关系与权限 tab=groups |
| `#manage/identity-access` | 访问规则 | 本页 `private_access` 编辑器（浮层「其他入口」没有这项，只有深链） |
| `#manage/identity-feelings` | 关系与情感 | iframe 关系与记忆；关系网页头按钮也能进 |

旧地址会改写，不丢：`#manage/reply`→表达，`preferences`→主动联系，`semantic`→感知，`persona`→自我/人格问卷，`knowledge`→自我/世界知识，`growth`→学习/成长链路，`#people`→关系网，`#memories`→事实与经历，`#library`/`#activities`/`#manage/capabilities`→家具目录。见 `app.js:217-231`。

---

## 1. 页面 / 视图清单

### 1.1 外壳本身

| 视图 | 入口 | 用途 | 主要组件 |
|---|---|---|---|
| 轻量性能页 | 宿主插件配置 `performance` 为开，`performance-gate.js:93-119` | 不加载 3D 与工作区，只提示去官方配置关掉 | 单张状态卡 |
| 启动幕 | 完整页加载到 `data-room-ready` 之前，`index.html:378-396` | 填补体素包下载的空白 | `.room-boot` |
| 左栏 | 常驻，`shell.js:113-144` | 18 个配置/生活入口 | `RAIL_GROUPS` |
| 全部功能 | 左栏底 `data-open-navigation`，`index.html:416` | 小屏把同一份导航铺开，并补上左栏没有的「用户 / 群聊」 | `#navigationDialog`，`app.js:196-216` |
| 搜索 | 左栏底 / Ctrl+K，`index.html:443` | 搜页面名和配置字段，跳到挂载点 | `#searchDialog`，`searchIndex` `app.js:4453` |
| 小屋标题上的角色下拉 | `#stageRole`，`product-page.js:706` | 仅当角色多于 1 个才出现；按 `role_id` 切换，不按对象切换 | `#product-role` |
| 确认框 | 离开有未保存草稿时，`app.js:281-297` | 三按钮：取消 / 确认 / 保存并切换 | `#confirmationDialog` |
| 详情弹窗 | 家具、能力、身份设置、原生扩展 | 一个 dialog 承载多类内容 | `#detailDialog` |
| Toast | `app.js:90` | 2.9 秒状态条 | `#toast` |

### 1.2 首页与生活视图

| 视图 | 入口 | 用途 | 主要组件 |
|---|---|---|---|
| 小屋场景 | `#life` | 体素房间、天气与时段只影响场景，不写后端 | `assets/voxel-room.js`、`home-environment.js` |
| 家具条 | 场景下方 `#stageFurniture`，`app.js:636` | 7 个机位；衣柜进布置，其余飞镜头 | `STAGE_STATIONS` `shell.js:28` |
| 右栏 | `#shellSide` | 此刻状态、今日安排 | `product.stateCard/scheduleCard` |
| 家具说明 | 点一件有 `detail` 的家具 | 一段说明 + 去向按钮 | `renderFurniturePanel` `app.js:703` |
| 家具与能力 | 生活视图 directory，或旧地址 `#library` | 14 件家具的状态与打开 | `directory` `app.js:1471-1485` |
| 生活观察 | 生活视图 observation | 四类只读摘要 | `homeObservationCard` `app.js:1621` |
| 状态 | `#life/state[/<feature>]` | 角色状态 13 块 | `CompanionStatePage` |
| 日记 | `#life/diary/<archive\|reading\|sleep\|receipts>` | 日记域四个子页 | iframe `workspace('life')` |

状态功能块（`navigationDestination` 白名单，`app.js:238`）：energy、health、hunger、sleep、cycle、busy、location、mood、planning、weather、datetime、patrol、presentation。

### 1.3 左栏 18 页（`shell.js:113-144`）

| 左栏名 | 路由 | 页内结构 | 挂载 |
|---|---|---|---|
| 关系网 | `#manage/identity` | 关系与权限的 network 面板 | `product.workspace('identity','network')` `app.js:4010` |
| 主动与联系 | `#manage/contact` | 整页钟面；开口闸门默认 `hidden` | `CompanionContactPage`；`#replyGateConfigWorkspace` `app.js:4053-4055` |
| 事实与经历 | `#manage/memory[/records\|settings]` | 两个顶 tab | `CompanionMemoryPage` / `CompanionMemorySettingsSection` |
| 学习与反思 | `#manage/learning/<8 段>` | 01–08 编号 tab | 见 1.4 |
| 模型与连接 | `#manage/models` | 任务模型 + 预算一段 | `#modelWorkspace` + `budget` |
| 治理与维护 | `#manage/maintenance[/patrol]` | 诊断主视图；巡视是二级 | `CompanionMaintenancePage`；巡视用 `CompanionStatePage` section=patrol |
| 手机连接 | `#manage/mobile` | 三步说明 + 现实触及 mobile 组 | `NativeExtensionPanel` extensionId=reality, onlyGroup=mobile `app.js:980-982` |
| 感知 | `#manage/perception[/<段>]` | 总览，再进 4 个配置页 | `app.js:1948-2143` |
| 理解 | `#manage/understanding` | 6 tab | `CompanionUnderstandingPage` + reply view=perception |
| 决策 | `#manage/decision` | 决策页自己的 tab，内部再挂 reply | `CompanionDecisionPage` + `renderDecisionOriginal` |
| 行动 | `#manage/action` | QQ 空间主区 + 三张能力卡 | `renderActionOriginal` `app.js:3245` |
| 产出 | `#manage/output` | 预览 2 tab，配置 4 tab | `CompanionOutputPage` 等 |
| 表达 | `#manage/expression[/<段>]` | 5 模块 | `CompanionReplyPage` view=expression，DOM 在三个 host 间搬动 |
| 自我 | `#manage/governance/<profile\|relationship\|questionnaire\|knowledge>` | 4 tab | 角色档案编辑器 / 相处资料 / 人格问卷 iframe / 世界知识 |
| 开始使用 | `#manage/setup` | 引导步骤；升级中标题改成「升级到 7.0.0」 | `CompanionSetup` `app.js:4274-4280` |
| 外观与设置 | `#manage/appearance` | 主题、密度、圆角、字号、动效、大字 | `CompanionAppearancePage` |
| 账号与会话 | `#manage` 或 `#manage/host` | 宿主拓扑 | iframe `workspace('host')` |
| 资料与维护 | `#manage/data/<storage\|backup\|migration>` | 3 段 | Storage / Backup / `CompanionSetup.mountMigration` |

左栏文案和 `manageTabs` 文案不一致（同一页）：主动与联系/主动联系，学习与反思/学习与成长，开始使用/首次连接（`navGroups`），资料与维护/资料与备份。`shell.js:136-140` 的注释承认浮层曾经用过另一套名字；左栏与 `manageTabs` 仍未收齐。

### 1.4 页内二级（新 UI 必须还能到）

学习 `#manage/learning/`（`app.js:4179`）：overview 总览、strategy 角色策略、review 审阅中心、chain 成长链路、expression 表达学习、behavior 行为模仿、semantic 语义目录、reflection 每日复盘。旧 `skills` 改写到 `chain`（`app.js:224`）。

表达模块（`app.js:3506-3512`）与地址栏段名不是一对一：

| 模块 | 允许的地址段 | 实际落点 |
|---|---|---|
| 文字风格与分段 | text / segment / style / cleanup；timing 被吸进 text | `#expressionReplyHost` |
| 语音朗读 | voice | `#expressionVoiceReplyHost` + `#voiceReplyPolicyWorkspace` |
| 表情配图 | （无独立段名，模块 id expression-reaction） | `reaction` 编辑器 + `#semanticExpressionWorkspace` |
| 平台动作 | platform / components / checks | `#expressionPlatformReplyHost` + `#pokePolicyWorkspace` |
| 群聊表达 | group | `group_participation` 的 denoise 段 |

感知配置段（`app.js:1952-1990`，地址 `#manage/perception/<段>`）：environment、models、screen（界面叫「现实触及」）、news（界面叫「外部与记录」）。代码还接受 balance / recall / injection 作为地址段（`app.js:247`），但导航按钮不单独给出，只在页内锚点。

产出配置 tab：visual 生图与审核、materials 参考素材、creation 创作与作品、capabilities 生图能力与提示词。预览另有 image / story。

自我：profile 角色档案（8 章：身份/外貌/性格/口吻/动机/边界/世界/表达学习范围，`app.js:3551-3559`）、relationship 相处资料、questionnaire 人格问卷、knowledge 世界知识。

资料：storage、backup、migration。

维护：空段 = 运行诊断；patrol = 每日巡视。diagnostics / cache / efficiency / recent / prompts 只是地址栏允许值（`app.js:244`），壳层不单独渲染，交给 `maintenance-page.js`。

### 1.5 弹窗与抽屉（壳层创建的）

| 弹窗 | 打开方式 | 里面是什么 |
|---|---|---|
| 用户默认资料 | 用户页标题「用户默认资料」`data-identity-settings=person` | `person` 组，`#identityPersonSettingsWorkspace` |
| 私聊用户权限 | 用户页标题「私聊用户权限」 | `private_access`，`#identityPrivateAccessSettingsWorkspace` |
| 群成员线索 | 群聊页标题「群成员线索」 | `knowledge` 的 members 段 |
| 关系网设置（旧页） | `renderIdentityPageOriginal` 的 details，当前路由不再调用它 | `person` + `knowledge.members` |
| 能力详情 | 家具「打开」或行动页「拓展详情」 | `providerDetail`，内置能力再挂 `NativeExtensionPanel` |
| 游戏授权 | 详情弹窗里有 `[data-game-access-host]` | `CompanionGameAccess` |
| 人格整理 / 迁入 | 自我页按钮 | `CompanionRoleProfileDraft` / `CompanionRoleProfileMigration` 自己的 markup |
| 布置房间 | 场景「布置」或衣柜 | `room-editor.js`，只写 localStorage |
| 成长记录确认 | 家具「成长花架」打开的 growth 对话框 | `product-page.js` `#growth-confirm`，在工作区 markup 内 |

没有独立抽屉组件。配置页的「下方面板」是整页替换，不是抽屉。

### 1.6 五个 iframe 工作区（源目录，不是 Dashboard 页）

| 源目录 | bundle | 壳层挂载点 | 工作区内部 |
|---|---|---|---|
| `pages/宿主管理` | host | `#manage/host` | 运行状态、共享启动模型、账号→角色/人格→窗口、群目标、会话详情 |
| `pages/日记与生活` | life | `#life/diary/<tab>` | 作息、睡眠生理；tab：日记与梦境 / 阅读书架 / 睡眠记录 / 执行记录；编辑 dialog |
| `pages/关系与权限` | identity | 关系网 / 用户 / 群聊 各挂自己的 tab | 工作区内部仍有三个 tab，但外壳一次只给一个 tab |
| `pages/关系与记忆` | relationships | `#manage/identity-feelings` | 关系记录列表 + 详情 + 「更正理解」dialog |
| `pages/人物设定工坊` | persona | 自我 → 人格问卷 | 五步：来源、基础稿、情景试答、风格规则、对照保存 |

拷贝关系见第 4 节。iframe 请求不是直连 API：`product-page.js:1069-1118` 有硬白名单，工作区只能打自己那 1–2 条路径。

---

## 2. 设置项清单（壳层自己持有的）

页面内部的配置字段不在这里重复。下表只列外壳直接读写的状态。后端字段以请求体为准；纯本地项 key 用存储键。

| 设置键 | 界面标签 | 所在页面 | 读写 | 层级 | 默认 | 平台 | 备注 |
|---|---|---|---|---|---|---|---|
| `companion-v2-theme` | 主题 | 外观与设置；旧 `appearancePanel` 仍在 `app.js:1705` | localStorage；`product.setAppearance` | 本机 | courtyard | all | 合法值 courtyard/dawn/dusk/night/walnut/contrast。旧名 mist/grove/coral/light/dark 在 `index.html:52` 映射。`index.html` 内联引导与 `theme.js` 必须一致 |
| `companion-v2-density` | 显示密度 | 外观 | localStorage | 本机 | standard | all | compact/standard/roomy |
| `companion-v2-radius` | 圆角 | 外观 | localStorage | 本机 | standard | all | sharp/standard/round |
| `companion-v2-type-scale` | 字号 | 外观 | localStorage | 本机 | m | all | s/m/l/xl |
| `companion-v2-motion` | 动效 | 外观 | localStorage | 本机 | full | all | full/low/off。与系统 `prefers-reduced-motion` 取更严 |
| `companion-v2-follow-light` | 跟随小屋光照 | 外观 `data-follow-light` | localStorage（`product.setFollowLight`） | 本机 | false | all | 场景进夜晚时改主题 |
| `largeText`（存在 `companion-framework-ui-preview-v2-config-20260924`） | 放大辅助文字 | 外观页开关；`app.js:172` 的 `CompanionDisplayPreferences` | localStorage 整包 state | 本机 | false | all | 加在 `body.large-text`，不走外观令牌 |
| `reduceMotion`（同一包） | （无当前入口；`app.js:4952` 仍接受 `data-display=reduceMotion`） | 旧外观面板文案只展示系统状态 | 同上 | 本机 | false | all | 与 `motion` 维度重复。当前外观页不再渲染这个开关 |
| `scene` / `sceneMode` | 场景时段 | 首页小屋环境 | 同上 | 本机 | day / auto | all | 只改体素光照，不写角色天气 |
| `weather` | 晴天/多云/细雨/大雨/落雪/薄雾 | 首页 `data-weather` | 同上 | 本机 | clear | all | 与感知页「天气数据源」无关。同包里还有 role/notes/diary/activityPaused，`app.js:32-37`，场景用，不是设置 |
| `roomLayouts` | 布置 | 场景「布置」 | 同上，键 `product.scopeKey()` 或 `local-room-layout` | 安装+对象+角色（仅本地） | {} | all | 目录未读到时退到 `local-room-layout`，避免串空键 |
| `labels` | （无界面） | `initial.labels` | 同上 | 本机 | true | all | 写入了本地包，壳层没有控件 |
| 宿主 performance | 性能模式 | 不在小屋内。开启后小屋变成轻量页 | `GET host/performance`（`performance-gate.js:10`） | 安装（AstrBot 插件配置） | 关 | all | 关闭入口在 AstrBot 插件配置页顶部，不在本插件 UI |
| 角色选择 | 小屋标题「切换人格或角色」 | 仅多角色时出现在场景标题上，不是独立顶栏 | `GET page/targets` 后 `choose()` | 会话 | 目录第一项 | all | 下拉只按 `role_id` 列出（`product-page.js:711`）。同一角色的私聊与群不在这里切。选择不落库 |
| 内置扩展装配 | 家具行「已装配/已暂停/未装配」；弹窗里启用/暂停/更新/卸载 | 家具目录、行动页、能力弹窗 | `GET integration/manifest`；`POST integration/lifecycle` | 安装 | — | extension:content/image/together/game/screen/reality/live | 动作 assemble/update/pause/resume/uninstall，`app.js:4338` 一带 |
| 扩展设置 | 弹窗内表单，标题用扩展名 | 现实触及 / 一起房间 / 游戏棋桌 / 直播与表演；手机连接只取 reality.mobile | `GET/POST /extensions`、`/extensions/configure`、`/extensions/action` | 扩展自己的 revision | schema 下发 | extension:* | `native_extension_api.py:15-17` 只注册 reality/together/game/live |

工作台（几乎所有「保存」按钮）的公共行为，壳层约定在 `workbench-page.js:9-11, 892-931`：

- 层：installation / role / relationship / window。每字段画来源点，文案「继承自…」「本次保存写入这一层」。
- 保存是显式按钮，不是自动保存。有草稿离开页面会弹确认。
- 令牌名不统一：配置组收发都叫 `edit_token`；记忆读 `edit_token`、发 `expected_edit_token`（`workbench-page.js:980-982`）。
- `reset_to_inherit` 只有声明了 `resetKey` 的分区才发。通用 `config/configure` 没有这个键。

---

## 3. 操作清单（壳层自己发出的）

| 动作 | API | 效果 |
|---|---|---|
| 打开页面 | `GET page/targets` + `GET integration/manifest`（`product-page.js:575,592`） | 填顶栏、角色 `*_api`、能力目录 |
| 切换对象/角色 | 无写接口；`choose(targetId, roleId)` | 之后所有工作区换端点 |
| 性能检测 | `GET host/performance` | 开则替换成轻量页；失败则放行完整页 |
| 刷新工作区资源 | `GET page/workspace-entry` | 换 iframe 的 asset token |
| 装配/暂停/恢复/更新/卸载内置扩展 | `POST integration/lifecycle` `{capability_id, action, expected_revision, operation_key}` | 家具状态与弹窗按钮跟着变；数据保留 |
| 读扩展设置 | `GET extensions` | reality/together/game/live 的 schema+revision+runtime |
| 保存扩展设置 | `POST extensions/configure` `{extension_id, updates, revision, operation_key}` | 按扩展 revision 冲突则要求重读 |
| 扩展动作（配对令牌、直播/现实管理） | `POST extensions/action` | reality 的 `mobile_pairing_token` 等 |
| 成长花架：刷新/翻页/确认/修订/暂停/继续/完成/撤回/归档 | `GET <growth_api>`；`POST <growth_api>/command` | 只在家具详情里，不在学习页 |
| 保存外观 | 无 | localStorage + `documentElement.dataset` |
| 保存布置 / 天气 / 时段 / 大字 | 无 | 同一个 localStorage 包 |
| 全局搜索命中 | 无 | `navigate()` 到 `configSearchLocation` 的挂载点（`app.js:4456-4499`） |
| iframe 内的保存 | 由白名单翻译成该角色的 `*_api` | host 只允许 status/start/accounts/accounts/model-provider/acquaintance；identity 只允许 acquaintance 五条；relationships 只允许 group-memory；persona/life 只允许自己的 GET 与 `/command`（persona 另加 standardize） |

壳层不直接调用 reply/configure、config/configure。那些由挂到面板里的页面模块发。

---

## 4. 重复与冲突

### 4.1 两套导航，三套名字

| 来源 | 项数 | 用途 | 问题 |
|---|---|---|---|
| `shell.js` `RAIL_GROUPS` | 18 | 左栏和「全部功能」的主体 | 当前可见导航 |
| `app.js` `navGroups` | 21 | 浮层末尾「其他入口」= 左栏没有的差集 | 仍含「小屋、日记与生活、用户、群聊、首次连接」；名字与左栏不同 |
| `app.js` `manageTabs` | 22 | 路由白名单、面包屑、页标题 | 比左栏多 identity-people/groups/access/feelings；「主动联系 / 学习与成长 / 资料与备份」与左栏用词不同 |
| `searchIndex` | 约 26 条硬编码 | 搜索里的「页面」类 | 「人格问卷」指向 `manage/persona`，该 tab 不在 manageTabs，会被 `navigationDestination` 改成 host（`app.js:241`）。实际入口是自我 → questionnaire |

`app.js:193-195` 写明浮层改读左栏，避免两套名字。差集逻辑仍把 `navGroups` 里左栏没有的项塞进「其他入口」，所以「首次连接」和「开始使用」会同时出现。

### 4.2 同一份编辑器被挂到多处（壳层负责挂载）

| 数据 | 可见位置 | 挂载 |
|---|---|---|
| `CompanionReplyPage` 一个实例 | 表达页；决策页（view=decision）；理解页（view=perception） | `app.js:909-918`。三处互斥，切页会 unmount 再 mount，不是三份数据 |
| 同一 `#replyWorkspace` 节点 | 表达页的文字 / 语音 / 平台动作三个 host | `syncExpressionReplyWorkspace` `app.js:3475` 用 `append` 搬家 |
| `proactive.contact` | 主动联系页全量 `#contactPreferencesWorkspace`；感知页 5 个切片：dates、balance、weather、online query、contact screen | `app.js:3772-3846`。两页都能写同一组字段 |
| `busy_gate` + `life` 的 rest/backlog | 主动联系「开口闸门」`#replyGateConfigWorkspace`；决策「沉默策略」`#decisionGateWorkspace` | `app.js:3847-3854`。`#busyGateWorkspace` 在全仓库没有容器，`app.js:3768` 是死挂载 |
| `life` 的 routine/sleep/writing 与 `library` | 日记页 iframe 下方 | `app.js:797` `renderViewPanel('diary')` 在日记工作区下面再挂 `#lifeConfigWorkspace` 与 `#libraryConfigWorkspace`。作息和书架在 iframe 里已有一处 |
| `role.state` 的天气 | 生活 → 状态；感知页 `#perceptionRoleWeatherWorkspace` | `app.js:890-894`：有天气容器就以它为准，section 被改成 weather |
| `screen` 组 | 感知「屏幕与感知」`#screenConfigWorkspace` | 与上面 contact 的 screen 切片不是同一组：一个是解读设置，一个是「能不能当主动联系素材」 |
| `knowledge` | 自我「世界知识」`#knowledgeConfigWorkspace`；群聊弹窗 members 段；旧关系页 `#memberClueWorkspace` | 搜索按 section===members 决定去群聊（`app.js:4486-4488`） |
| `person` | 用户页弹窗；旧 `renderIdentityPageOriginal` 的 `#personConfigWorkspace` | 旧函数已不被路由调用（`app.js:3996-4010`） |
| `private_access` | 用户页弹窗；`#manage/identity-access` 的 `#privateAccessWorkspace` | 两处都活着。注释说正式入口是弹窗，深链页保留（`app.js:3784` 附近） |
| `group_participation` | 决策页整组 `#groupParticipationConfigWorkspace`；决策页群窗口插话段；表达页 denoise；学习页 behavior | 同一组四个 section 切片，四个页面 |
| `role.growth.skills` | 学习 → 角色策略 `#growthConfigWorkspace` | 旧 `renderLearningPageOriginal` 也引用同 id，但当前路由不调用它 |
| `budget` | 模型页 `#budgetConfigWorkspace` | 感知「模型能力」会再挂一个 `#modelWorkspace`（`app.js:1986`），与模型页同一个 id。两个页面不会同时存在，但感知页把整页模型编辑器嵌了进来 |
| 模型任务表 | `#manage/models` 与感知配置「模型能力与路由」 | 同上，同一 `CompanionModelsPage` |
| 手机连接 | `#manage/mobile` | 字段就是 reality 扩展的 `mobile` 组。感知「现实触及」打开完整 reality 面板时，mobile 组也在里面（`onlyGroup` 只在手机页使用） |
| 语音概率 | 表达「语音朗读」里的 `#voiceReplyPolicyWorkspace` | `CompanionHostOptionsPage` 同时还可挂 poke、forward。理解页另有 `#forwardIntakeWorkspace` |
| 记忆记录 | `#manage/memory` 与旧路由 `#memories` | `renderMemories` 直接调用 `renderMemoryPage`（`app.js:4234`） |
| 关系目录 | 左栏只进「关系网」；页头按钮进用户/群聊/关系与情感；iframe 内部自己还有三 tab | 用户会在外壳和 iframe 里各看到一次「用户 / 群聊」 |

### 4.3 同一概念多个叫法

| 概念 | 出现过的名字 |
|---|---|
| 主动联系页 | 主动与联系（左栏）、主动联系（manageTabs、navGroups）、联系节奏（主动联系页分区） |
| 学习页 | 学习与反思（左栏）、学习与成长（页标题 `app.js:4214`、navGroups） |
| 开始使用 | 开始使用（左栏）、首次连接（navGroups）、升级到 7.0.0（引导检测到升级时） |
| 资料页 | 资料与维护（左栏）、资料与备份（manageTabs） |
| 感知第 3 配置页 | 按钮「现实触及」，地址段 `screen`，页签 id `perception-tab-reality` |
| 感知第 4 配置页 | 按钮「外部与记录」，地址段 `news` |
| 决策页里的回复设置 | 决策页叫回应判断/参与节奏/沉默与安全；表达页叫群聊表达。同一 `CompanionReplyPage` |
| 天气 | 首页六档是场景皮肤；感知页才是数据源与角色天气 |

### 4.4 工作区是生成物，不是第二份页面

`tools/sync_framework_page.py:20-21`：host←宿主管理，life←日记与生活，relationships←关系与记忆，identity←关系与权限，persona←人物设定工坊。

本工作树 sha256 对照（只读，未跑 sync）：

| 对 | app.js / style.css / 附加脚本 | index.html |
|---|---|---|
| 宿主管理 ↔ workspaces/host | app.js 换行规范化后相同（字节 107413 vs 107410）；style 相同 | 仅 bridge 脚本路径不同 |
| 日记与生活 ↔ workspaces/life | 相同 | 仅 bridge 路径 |
| 关系与记忆 ↔ workspaces/relationships | app.js、style、group-memory.js 相同 | 仅 bridge 路径 |
| 关系与权限 ↔ workspaces/identity | app.js、style、member-editor.js 相同 | bridge 路径 + lucide 相对路径 |
| 人物设定工坊 ↔ workspaces/persona | 相同 | 仅 bridge 路径 |

源 `workspace.html` 引 `/api/plugin/page/bridge-sdk.js`；生成的 `workspaces/*/index.html` 改为 `../../embedded-bridge.js`。运行时小屋不加载这些 index.html，加载的是 `workspace-bundles/<name>.js`（把 css、桥、js 内联进一个 srcdoc）。`pages/陪伴小屋/README.md:5` 写明不要手改 `workspaces/` 与 `workspace-bundles/`。

因此：改五个源目录会在下次 sync 前与 bundle 分叉；改 `workspaces/` 会被 sync 覆盖。新 UI 不要把这五份再复制一遍。

`verify_v2_release.py:274-275` 要求发布包里唯一带 `index.html` 的 Dashboard 页是「陪伴小屋」。`metadata.yaml` 没有 pages 字段；AstrBot 靠目录发现。`main.py` 不注册页面，只在 `main.py:163` 注册 web API。

---

## 5. 交互问题（只记外壳造成的）

1. 层级名实不符。左栏是平的 18 项，点进去仍是「页 → 模块 tab → 分区 → 折叠面板 → 字段层轨」。感知最深：配置页 4 个、现实触及再 4 个竖 tab、每个里面 `<details open>`（`app.js:1966` 起全部默认展开）。
2. 地址栏记不全。`app.js:265-280` 明确写「其余页内状态不进 URL」。表达的 reaction 模块、决策页内部 tab、产出 tab、理解 tab 刷新后回到默认段。
3. 三张跳转表。`settingsJump`（`app.js:2164`）、`searchIndex`、`configSearchLocations`（`app.js:4456`）各自维护去向。搜索「人格问卷」会掉进账号与会话，因为 `persona` 不是 manageTabs 的一项。
4. 保存模型外露。工作台每个分区自己的「保存 / 使用已保存配置 / 恢复继承 / N 项修改待核对 / 核对最新配置」，再加上层轨图例（`workbench-page.js:892-931`）。离开页面还有第三套确认框。用户能看见 token、revision、继承层这些实现词。
5. 状态句到处都是。连接「正在读取角色与会话」、每个挂载点「正在读取…」、家具行「状态待检查 / 配置未知」、理解页「子面板 06」「窗口配置 · 角色许可」（`app.js:3930,3942`）、性能页三段说明。这些是壳层写死的，不是配置 schema 的 help。
6. 死挂载与死渲染还在。`#busyGateWorkspace` 无容器；`renderIdentityPageOriginal`、`renderContactPageOriginal`、`renderLearningPageOriginal`、`clearedConsole` 不再被路由调用，但和现行函数同文件，读代码会以为有第二套页面。`appearancePanel()`（`app.js:1705`）仍能被 `renderAppearanceSurfaces` 填进弹窗，和新外观页并存。
7. 首页 3D 成本绑在所有配置页上。进配置只是 `dataset.away` 把小屋缩成窄条（`shell.js:104-107`），WebGL 不销毁。性能模式是唯一的整页旁路，而且一旦开启，连设置入口都没了。
8. iframe 套导航。关系与权限自己有「关系网 / 用户 / 群聊」三 tab（`workspace.html:41-50`），外壳又按 tab 拆成三个路由。用户在用户页里还能再点回关系网，点的是 iframe 内部，不是左栏。
9. 群目标与群名不在壳层解决，但壳层顶栏直接显示 `targetLabel`。微信群经常是 `xxx@chatroom`（显示名只在 aiocqhttp 查）。这是顶栏每页都看见的问题。
10. 「全部功能」的「其他入口」会列出左栏已经改名的旧项，和现左栏并列，像两套产品。

---

## 6. 按条件显示清单

不删除。新 UI 默认只展开当前用得上的，其余收进「能力」里，打开扩展或换到对应平台后再出现。判断字段都已在壳层读过。

| 功能 | 现在的入口 | 显示条件 | 条件来源 |
|---|---|---|---|
| QQ 空间整块（安装、凭据、刷动态、点赞、回复、发说说、主题、日程建议、qzone 设置） | 行动页主区，`#actionQzoneBody` | `page/targets` 里当前 target 的 `platform_id` 为 `aiocqhttp`（或 qq 官方，若后端把 qzone 标成可用）。微信目标下整块收起。私聊才可写：错误码 `qzone_private_required` | 目标 `platform_id` / `scope_kind`；`qzoneStatus().installed/active/role_enabled` 只决定块内状态，不该决定微信用户看不看这块 |
| 戳一戳 `#pokePolicyWorkspace` | 表达 → 平台动作 | 当前目标 `platform_id===aiocqhttp` | `GET page/targets` 的 platform 字段 |
| QQ 自定义短状态 | 表达 → 平台动作的跳转 `expressionLifeJump` | 同上，且是 QQ 官方/OneBot 能发短状态的平台 | 目标 platform_id |
| OneBot 显示名查询、好友备注 | 顶栏与目录标签 | `platform_id===aiocqhttp` 时用显示名；微信用会话名，没有就保留原始 id，不要为了 QQ 接口在微信顶栏转圈 | `page/targets`；显示名 API 不在壳层 |
| 一起看/通话房间 together | 家具「共处电话」；行动页卡片；扩展弹窗 | `integration/manifest` 的 extensions 里 together 存在且 `assembled!==false` 且 `desired_state!==discarded`。未装配收进能力目录 | `GET integration/manifest` |
| 游戏棋桌 game | 家具「游戏棋桌」；行动页「游玩与棋局」 | 同上，capability_id=game | manifest |
| 屏幕观察 screen | 家具「屏幕台」；感知「授权与隐私」「屏幕与感知」 | manifest 里 screen（或 `companion.screen.native`）已装配；未装配不展示授权表和最近识屏 | manifest；`data-screen-access` 只在该面板内 |
| 现实触及 reality（摄像头、音响、米家、手机网关） | 家具「现实设备台」；感知现实触及 4 个竖 tab；左栏「手机连接」 | manifest 里 reality 已装配。未装配时手机连接收起，不留三步说明 | manifest；`GET extensions` 的 reality |
| 直播 live | 家具「直播与表演」（无场景机位） | manifest 里 live 已装配才出现家具行和弹窗 | manifest |
| 内容 content / 图像 image | 家具「创作书架」「画面工作室」；产出页 | 这两项是内置能力，产出页本身保留；家具行按 `integration_state` 标状态，不必在未装配时占首页 | manifest |
| 旧版迁入 | 资料 → 旧版资料迁入 | `setup` 状态报有可迁数据时出现；没有旧库时这一段不占导航 | setup/migration 状态（页面模块读取，壳层只留挂载点 `#legacyMigrationWorkspace`） |
| 本群插话 | 决策页 `#groupInterjectionConfigWorkspace` | 仅 `target.scope_kind==='group'` 且 `reply_api` 以 `/reply` 结尾（`app.js:2136-2140`）。私聊目标整段不渲染。当前已是条件渲染，新 UI 照做 | `page/targets` 的 scope_kind |
| 群聊表达去噪、群成员线索 | 表达「群聊表达」；群聊页按钮 | 当前目标是群，或目录里至少有一个群目标 | scope_kind |
| 感知五个 proactive 切片 | 感知配置页内 | 主动联系能力开着才展开；关掉只留总开关所在页 | `proactive.contact` 的总开关（配置读取后），不是平台 |
| 性能模式轻量页 | 整页替换 | 仅宿主 performance 开 | `GET host/performance` |
| 首页体素场景 | 所有完整页都加载 | 新 UI 可把 3D 只留在首页路由；这是展示条件，不是功能开关 | 路由即可，不必新接口 |

`page/targets` 当前不含「这个目标支持哪些平台能力」的显式列表。平台条件只能先用 `platform_id` + `scope_kind`。扩展条件用 `integration/manifest` 的 `assembled` / `desired_state` / `integration_state`，不要用 `config-snapshot.js`：`app.js:1502-1506` 写明那份是发行示例，`base` 恒空，拿它判断会永远是「未启用」。

---

## 7. 功能完整性清单（壳层验收）

新 UI 替换外壳后，下面每一行仍要有一条可达路径。内部字段由对应区域清单验收。

| 功能 | 当前入口 | 依赖接口 |
|---|---|---|
| 打开插件唯一页面 | Dashboard → 陪伴小屋 | AstrBot 页面发现；无 metadata pages |
| 性能模式旁路与「重新检测」 | 整页，或完整页 | `GET host/performance` |
| 主题在首屏前应用，避免闪默认色 | `index.html` 内联脚本 | localStorage |
| 左栏 18 项与全部功能（含用户、群聊） | 左栏、浮层 | 无 |
| 旧地址改写（reply、preferences、semantic、persona、people、memories、library…） | 地址栏 | 无 |
| 顶栏切换对象与角色 | 常驻 | `GET page/targets` |
| 全局搜索跳到字段所在挂载点 | Ctrl/⌘K | 搜索表 + 各页编辑器 |
| 未保存草稿拦截（含天气源页的异步确认） | 任意导航 | 各编辑器 `dirty()` |
| 首页体素、7 机位、镜头重置、巡游、布置并按 scope 保存 | `#life` | 无（本地） |
| 场景天气 6 档、时段自动/四段、跟随光照 | 首页环境条 | 无（本地） |
| 右栏状态与今日安排 | 首页右栏 | `page/targets` 给出的 state/life API |
| 家具目录 14 件、筛选、搜索、定位/打开 | 生活 → 家具与能力 | `GET integration/manifest` |
| 内置扩展装配、暂停、恢复、更新、卸载 | 家具或能力弹窗 | `POST integration/lifecycle` |
| 生活观察四类 | 首页观察 | life / state API |
| 状态页 13 个功能块深链 | `#life/state/<feature>` | state API（状态区清单） |
| 日记四段深链 | `#life/diary/<tab>` | iframe life：`GET/POST <life_api>` |
| 关系网 / 用户 / 群聊 | 左栏 + 页头按钮 + 浮层 | iframe identity：acquaintance 五条 |
| 用户默认资料、私聊默认权限弹窗 | 用户页标题 | `config_api` 的 person、private_access |
| 群成员线索弹窗 | 群聊页标题 | `config_api` knowledge.members |
| 访问规则深链页 | `#manage/identity-access` | private_access |
| 关系与情感 | 关系网页头按钮、深链 | iframe relationships；群目标走 group_memory_api |
| 跨窗口递话 | 旧关系页挂载点；搜索表指向用户页 | relay 组。现行用户页弹窗规格里没有 relay，只有 private_access（`identitySettingsSpecs` `app.js:4026-4030`）。新 UI 必须把 relay 补进同一处，否则这组字段只在死代码 `renderIdentityPageOriginal` 里 |
| 主动联系全量与开口闸门 | `#manage/contact` | proactive.contact；busy_gate；life 的 rest/backlog |
| 事实与经历 / 记忆策略 | `#manage/memory` | memory 页；`#memories` 旧地址同页 |
| 学习 8 段，含按对象/角色筛选 | `#manage/learning/<tab>` | growth_api、reply_api、group_memory_api、semantic |
| 模型任务与后台预算 | `#manage/models`；感知页内嵌同一块 | model API；budget 组 |
| 运行诊断与每日巡视 | `#manage/maintenance`、`/patrol` | maintenance 页；state patrol |
| 手机连接（网关、配对令牌、绑定用户、位置/屏幕/身体） | `#manage/mobile` | `GET/POST extensions` reality，action `mobile_pairing_token` |
| 感知总览 + 4 配置页 + 现实触及 4 竖 tab | `#manage/perception` | perception、weather、screen、extensions |
| 理解 6 tab | `#manage/understanding` | reply view=perception；web_understanding；forward intake |
| 决策（含群才出现的插话） | `#manage/decision` | reply view=decision；group_participation；participation 子路径 |
| QQ 空间全部写操作与设置 | `#manage/action` | qzone API（行动区清单）；仅 QQ 目标默认展开 |
| 共处 / 游戏 / 现实设备的状态与「去设置」 | 行动页三张卡 | manifest；对应扩展或感知/联系页 |
| 产出预览、生图、额度审核、素材衣柜、创作、场景预设、观测 | `#manage/output` | image.output、quota、image_review、photo.reference、wardrobe、content.authoring |
| 表达 5 模块及段深链 | `#manage/expression/<段>` | reply；reaction；semantic；host options（voice/poke/forward） |
| 自我 4 tab、8 个档案章、头像、从人格整理、迁入已有设定 | `#manage/governance/<pane>` | role_profile；relationship；persona iframe；knowledge |
| 人格问卷五步与版本保存 | 自我 → 人格问卷 | `<persona_api>` GET/POST command、POST standardize |
| 开始使用 / 升级引导 | `#manage/setup` | setup API |
| 外观六项 + 大字 | `#manage/appearance` | 仅本地 |
| 账号、共享启动模型、拓扑、群目标、会话详情 | `#manage/host` | iframe host：`host/status`、`host/start`、`accounts`、`accounts/model-provider`、acquaintance |
| 存储、备份、旧版迁入 | `#manage/data/<段>` | storage、backup、setup migration |
| 成长花架上的目标/技能动作 | 家具「成长花架」 | `<growth_api>/command` |
| 扩展设置弹窗（together/game/live/reality） | 家具打开 | `extensions`、`extensions/configure`、`extensions/action` |

已知壳层缺口（验收时要补，不是可删）：`relay` 的现行入口只在未被调用的 `renderIdentityPageOriginal`；`#busyGateWorkspace` 无 DOM；搜索「人格问卷」掉进 host。

---

## 8. 给新 UI 的结构建议

外壳收成三层，不再保留「左栏一套、浮层一套、manageTabs 一套」。

1. 首页只留小屋、今天的状态、今天的安排。天气和时段若只影响场景，放进场景自身的菜单，不做成一条常驻设置。3D 不跟到配置页。
2. 人。一个「角色」页吃掉现在的自我、人格问卷、相处资料、世界知识。一个「联系人与群」页吃掉关系网、用户、群聊、关系与情感；iframe 内部那三个 tab 去掉，避免和外壳重复。平台是微信时，QQ 空间不出现在这一层。
3. 对话。一个「怎么回复」页按顺序放：何时开口（现在的决策 + 开口闸门）、怎么说（表达）、看懂什么（理解 + 感知里的消息/图片部分）。同一组字段只留一个编辑位置，其他页改为跳过来。
4. 生活。日记、状态、主动联系、学习合在「生活」里用二级，而不是左栏五项。
5. 能力。content / image / together / game / screen / reality / live / qzone 不进默认左栏。`integration/manifest` 已装配的才出现；未装配的收在「能力」里一行状态。手机连接是 reality 已装配后的子页，不单独占左栏。
6. 系统。账号与会话、模型、备份与存储、开始使用、外观、诊断。诊断和层轨、token、revision 放进该页的「高级」，日常保存只保留一个保存结果。
7. 路由继续用现在的 hash，旧地址保持 `navigationDestination` 的改写。新页可以换布局，不能换掉这些 hash，否则已有深链和 iframe 的 `navigate` 消息（`product-page.js:1069-1081`）会断。
8. 五个源工作区继续由 sync 生成 bundle。新 UI 若仍用 iframe，只包一层，不再在外壳和 iframe 里各做一次 tab。

新左栏建议固定为：今天、角色、联系人与群、对话、生活、能力、系统。现有 22 个 manageTab 全部能从这七项的二级到达。
