# UI 审计 · memory（记忆 / 学习 / 状态 / 维护）

> **本报告的立场（2026-10 方向更正后）**
> 这一轮是**兼容 + 页面重构，不是砍功能**。以后也可能接入 QQ，因此本区所有功能点——包括 QQ 专属、直播、一起看/通话、游戏、屏幕观察、现实触摸、旧版迁移——**一个都不删**，新 UI 必须 100% 覆盖。
> 新 UI 只允许做三件界面层面的事：①合并重复入口与重复编辑位置；②拍平过深层级；③**按当前实际接入的平台与已启用能力条件显示/收起**，并精简解释性文案、把诊断调试收进「高级/诊断」。
> 因此本报告的第 6 节是「按条件显示清单」（判断条件取自哪个接口哪个字段），第 7 节是「功能完整性清单」（逐条功能 → 入口 → 接口，作为新 UI 的验收表）。

审计对象：`wechat` 分支（上游 `2e29e3f`）。只读审计，未修改任何既有文件。行号以当前 checkout 为准。

## 0. 范围与代码体量

| 文件 | 行数 | 作用 | 挂载点 |
|---|---|---|---|
| `pages/陪伴小屋/memory-page.js` | 1626 | 事实与经历（档案库 + 整理 + 检索 + 归档 + 迁移 + 清理） | `#memoryWorkspace`（`app.js:889-892`） |
| `pages/陪伴小屋/memory-settings-section.js` | 153 | 记忆策略 30 个字段（借 `workbench-page.js`） | `#memorySettingsHost`（`app.js:895-898`） |
| `pages/陪伴小屋/memory-page.css` | 654 | 上述两页样式 | — |
| `pages/陪伴小屋/learning-page.js` | 1021 | 学习与成长 →「成长链路」 | `#learningWorkspace`，`layout:'chain'`（`app.js:861-867`） |
| `pages/陪伴小屋/learning-page.css` | 564 | 同上 | — |
| `pages/陪伴小屋/state-page.js` | 779 | 状态看板 + 功能详情面板 + 首页展示设置弹窗 | `#roleStateWorkspace` / `#perceptionRoleWeatherWorkspace`（`app.js:903-907`） |
| `pages/陪伴小屋/state-maintenance.js` | 737 | 状态各分组的表单定义、校验、文案（85 字段注册表） | 由 `state-page.js` 与 `state-editor.js` 调用 |
| `pages/陪伴小屋/state-editor.js` | 490 | 状态编辑的草稿/保存/冲突/恢复生命周期 | 同上（不在本区文件名清单内，但状态页离不开它） |
| `pages/陪伴小屋/calendar-editor.js` | 228 | 日程条目编辑（状态页内嵌） | 同上 |
| `pages/陪伴小屋/state-page.css` + `state-config.css` | 586 + 217 | 样式 | — |
| `pages/陪伴小屋/maintenance-page.js` | 3720 | 治理与维护（Token / 排障 / 缓存 / 回复效率 / 最近调用 / 任务提示词） | `#maintenanceWorkspace`（`app.js:899-902`） |
| `pages/陪伴小屋/maintenance-page.css` | 2861 | 样式（单文件比任何一页的 JS 都长） | — |
| `astrbot_host/memory_api.py` | 503 | 19 条记忆路由 | `PREFIX=/astrbot_plugin_private_companion/memory` |
| `astrbot_host/life_api.py` | 92 | 日记/作息（状态页跳转目标） | `/life` |
| `astrbot_host/state_api.py` | 182 | 3 条状态路由 | `/state` |
| `astrbot_host/model_api.py` | 1647 | `/maintenance`、`/memory`、`/prompts`、测试类路由 | `/model` |
| `astrbot_host/group_memory_api.py` | 135 | 群公共记忆（6 条路由，独立于私聊记忆） | 按群/角色生成 |
| `astrbot_host/token_sources.py` | — | 11 个 Token 来源的可用性判定 | `/model/maintenance` |
| `companion_v2/memory/configuration.py` | 124 | 记忆 30 字段注册表与默认值 | — |
| `companion_v2/role_work/state/configuration.py` | 169 | 状态字段默认值与分层规则 | — |

合计：前端 JS 7883 行（本区指定文件）+ 支撑文件 ~1000 行 + CSS 5230 行 ≈ 14000 行；其中 `maintenance-page.js` + `maintenance-page.css` 单独就是 6581 行。

**配套机器可读清单**：`docs/ui-audit/memory.items.json`（271 条，237 个不同 key；其中 29 个 key 在本区出现 2–4 处）。每条 = 一個「能看见或能改某个设置/数据」的位置，供跨区域去重合并使用；§7 的功能编号（M/G/L/S/W）与清单里的 key 一一对应。

四条页面共享同一套桥接约定，但**各自抄了一份**：`whenBridgeReady()`（`memory-page.js:1587`、`learning-page.js:939`）、`bounded()` 15s 超时、`api()` 信封解包，以及三份错误码字典（`memory-page.js:31`、`learning-page.js:81`、`state-page.js:7`）。这是本区最显眼的结构性重复，见 §4.9。

---

## 1. 页面 / 视图清单

### 1.1 事实与经历（`#manage/memory/records`）

入口：左侧栏「塑造角色 → 事实与经历」（`app.js:53`）；URL `#manage/memory`（别名 `#memories` 在 `app.js:222` 被改写成 `manage/memory`）。
页头是 **「事实与经历 | 记忆策略」两个路由页签**（`app.js:4061-4070`），页内再分 6 个区域（rails，`memory-page.js:321-328`）。

| 区域（rail） | 用途 | 主要组件（行号） |
|---|---|---|
| 整理与修复 `reflections` | 后台整理批次的六阶段状态、失败修复、继续整理 | 待处理/全部批次切换 `623`、批次列表、六阶段轨道 `detailMarkup 578`、待处理原因、处理确认、`继续整理/修复` 按钮 |
| 事实治理 `facts` | 事实流的筛选/搜索 + 详情（更正、置顶、撤回、遗忘、版本历史、原始来源） | 记忆概况块 `393`、语料比例带 `371`、筛选条 `443`、事实卡列表 `454`、master-detail `560` / `513` |
| 来源与经历 `query` | 按关键词检索事实/原始来源/共同经历 | 查询表单、索引状态、结果列表、`继续读取下一页` `667` |
| 冷归档 `archive` | 按「闲置天数」把长期不用的持久事实移出工作集，可移回 | 闲置天数输入（30–3650）、归档预览、批量归档、归档项勾选移回 `706` |
| 迁移 `migrate` | 导出/导入记忆包 JSON | 导出（含归档勾选、复制、下载）`754`；导入（粘贴 JSON → 校验 → 确认）`779` |
| 范围清理 `clear` | 逻辑遗忘当前私聊关系的全部有效事实 | 预览 → 确认按钮 `809` |

页头固定两个下拉：**会话对象**与**角色**（`headMarkup 344-368`）。事实区每 8 秒轮询一次（`222-227`，仅在 `facts`/`reflections` 且未搜索时）。

### 1.2 记忆策略（`#manage/memory/settings`）

| 区块 | 字段数 | 组件 |
|---|---|---|
| 记忆与注入 | 11 | `workbench-page.js` 通用配置工作台（层轨、继承、`恢复继承`、显式保存、`edit_token`/`operation_key`） |
| 定时整理 | 6 | 同上 |
| 经历整理 | 8 | 同上 |
| 习惯与推荐 | 5 | 同上 |

字段与分组定义在 `memory-settings-section.js:50-72`，写入 `/memory/settings/command`（`memory_api.py:37`）。

### 1.3 学习与成长（`#manage/learning`）→ 成长链路 `chain`

该页签下有 8 个子页签（`app.js:4179`）：总览、角色策略、审阅中心、成长链路、表达学习、行为模仿、语义目录、每日复盘。
本区负责的是**成长链路**（`learning-page.js`，`layout:'chain'` 唯一生产用法）。

| 视图 | 用途 | 主要组件（行号） |
|---|---|---|
| 授权开关条（常驻） | 每个记录来源两条开关：读取成长记录 / 提出成长建议 | `gateView 522`，`当前已生效/当前未生效` 徽标 |
| 记录列表（左栏） | 全部成长记录，倒序 | `chainWorkView 684`，每行：标题、来源、类型、版本、依据数、时间、阶段胶囊 |
| 依据与凭证（左下） | 选中记录的原始依据文本 | `rowEvidenceMarkup 708`，`/growth/evidence` |
| 记录详情（右栏） | 全部字段 + 由后端下发的可用动作 | `detailView 639`，阶段胶囊、提出/确认/变更人、创建/更新时间、动作按钮组 |
| 修订（右下） | 改标题/描述/进展生成新版本 | `reviseForm 716` |

另有四个视图（`VIEWS 503`：培育轨道 / 待审阅 / 来源与凭证，以及卡片、确认条）只在该组件 `layout!=="chain"` 时才会渲染 —— 生产环境永不进入，见 §4.7。**功能上它们仍然属于本模块（测试与 preview 模板在用），所以按「保留功能、合并入口」处理，不视为可删。**

### 1.4 状态（`#life/state`，另有 4 个复用挂载点）

| 视图 | 入口 | 用途 | 主要组件（行号） |
|---|---|---|---|
| 状态看板 | 侧栏「小屋 → 状态」（`app.js:775-784`） | 8 个图块 + 4 张环境卡 | `dashboardMarkup 304`、`extraButtons 331`；页头右侧 `立即更新`、`刷新状态` |
| 功能详情面板 | 点图块 | 当前值 + 生效范围 + 编辑表单 | `featurePanelMarkup 345`；14 个 feature（`featureInfo 235`） |
| 状态设置弹窗 | 页头齿轮 `#state-settings-button`（`app.js:782`） | 后台维护开关/间隔 + 模拟开关 + 首页展示 + 特殊展示策略 | `homeSettingsMarkup 411` + `state-maintenance.js form('home')` |
| 睡眠子页 | 点「睡眠」图块 | 作息概览 + 跳「日记与生活」 | `345-356`、`sleepMarkup 164` |
| 日程子页 | 点「日程配置」卡 | 运行情况 + 规划参数 + 年度日历 + 规划记录 | `planning` 分支 `364-371`、`planningSummary`（`state-maintenance.js:607`） |
| QQ 状态子页 | 点「QQ 状态」卡 | 正在输入/在线状态/自定义短状态 + 平台回执 | `presentationMarkup 182`、`384-388` |
| 每日巡视 | 「治理与维护 → 每日巡视」（`app.js:3686`，`maintenancePane==='patrol'`） | 巡视时刻、保留天数 | `featurePanelMarkup('patrol')` → `state-maintenance.js form('patrol')` |
| 天气/日期/联系 | 生活挂历家具、感知页、主动联系页 | 同一组件按 `section` 复用 | `app.js:710`、`1971`、`3653`；`state-page.js mount()` 的 `options.section` |

刷新节奏：15 秒轮询（有待确认维护任务时 3 秒，`schedule 524`）。

### 1.5 治理与维护（`#manage/maintenance`）

页头 6 个二级导航（`maintenance-page.js:3055`）+ 1 个附件页：

| 视图 | 用途 | 主要组件（行号） |
|---|---|---|
| Token 统计 `overview` | 11 个来源 × 4 个周期 × 预算/软限额/服务余额/Provider/Task 排行/组合图/最近预览 | `localTokenDashboardMarkup 2592`、`budgetMarkup 405`、`chart 927`、`sourceComparisonMarkup 499`、`balanceMarkup 2562` |
| 排障 `diagnostics` | 12 个分类 × 4 个严重度的信号、模型任务路由、按需检测、事件时间线、运行快照、说明 FAQ | `diagnosticsMarkup 1844`、`proactiveTestMarkup 1945`、`memoryDiagnosticMarkup 1756`、`integrationsMarkup 1624`、`timelineMarkup 1457`、`diagnosticFaqMarkup 1669` |
| 缓存诊断 `cache` | 命中率、缓存量、zipper 图、按 Provider 明细 | `cacheMarkup 2321` |
| 回复效率 `efficiency` | 近 7 日核心与投递耗时 | `replyEfficiencyMarkup 2637` |
| 最近调用 `recent` | 原始调用流水 + 搜索 + 4 种筛选 + 时长聚焦 | `recentMarkup 1219` |
| 任务提示词 `prompts` | 6 组 ~25 个模型任务的提示词编辑与预览 | `promptWorkspaceMarkup 814`、`promptEditorMarkup 771` |
| 每日巡视 `patrol` | 复用状态页（见 1.4） | `app.js:3686` |

一次加载打 4 个接口：`/model/maintenance`、`/model/voice`、`/model/image`、`/model`（`refresh 3093`，4 个 GET 在 `3104-3105`），另有按需 `/model/balance`。

---

## 2. 设置项清单

> 列「显示条件」= 新 UI 里这一项应当**始终显示 / 某个开关打开后显示 / 某个能力可用时显示 / 收进高级**，判断依据在 §6。
> 没有任何一项被建议删除；「高级」只是折叠，不是移除。

### 2.1 `memory.*`（30 项，`companion_v2/memory/configuration.py` + `MemoryPolicy`）

读写：`GET /memory/settings`、`POST /memory/settings/command`（字段扁平、`expected_edit_token`、`reset_to_inherit`）。
分层：全部 `core_only`，角色层为默认值，窗口（私聊对象）可覆盖。

| 设置键 | 界面标签 | 位置 | 默认 | 显示条件 |
|---|---|---|---|---|
| `enabled` | 启用记忆 | 记忆与注入 | true | 始终（不给开关，见 §6.6） |
| `automatic_context` | 自动注入相关记忆 | 记忆与注入 | true | 始终 |
| `context_items` | 自动上下文条数 | 记忆与注入 | 4 | 高级（0–16） |
| `context_chars` | 自动上下文字符数 | 记忆与注入 | 6000 | 高级（256–24000） |
| `query_items` | 查询结果条数 | 记忆与注入 | 20 | 高级（1–50） |
| `query_chars` | 查询结果字符数 | 记忆与注入 | 20000 | 高级（256–48000） |
| `source_chars` | 单个来源读取字符数 | 记忆与注入 | 8000 | 高级（256–24000） |
| `turn_chars` | 单轮记忆字符预算 | 记忆与注入 | 64000 | 高级（1024–200000） |
| `turn_calls` | 单轮记忆查询次数 | 记忆与注入 | 24 | 高级（1–32） |
| `core_items` | 核心记忆条数 | 记忆与注入 | 4 | 高级（0–16） |
| `core_chars` | 核心记忆字符数 | 记忆与注入 | 6000 | 高级（256–24000） |
| `inclusion_chars` | 整理材料字符上限 | 定时整理 | 24000 | 高级（512–96000） |
| `reflection_enabled` | 定时整理 | 定时整理 | true | 始终 |
| `reflection_timezone` | 整理时区 | 定时整理 | Asia/Shanghai | `reflection_enabled` 为真 |
| `reflection_time` | 每日整理时间 | 定时整理 | 23:50 | `reflection_enabled` 为真 |
| `reflection_response_format` | 模型返回格式 | 定时整理 | text | 高级（text/json_object/json_schema） |
| `reflection_auto_repair` | 允许修复未完成整理项 | 定时整理 | true | 高级 |
| `group_episode_memory_enabled` | 群聊经历记忆 | 经历整理 | true | 始终（群里存在目标时更有意义） |
| `group_episode_refresh_minutes` | 群聊经历刷新间隔 | 经历整理 | 180 | `group_episode_memory_enabled` 为真 |
| `group_episode_min_messages` | 群聊经历最少消息数 | 经历整理 | 12 | 同上 |
| `max_group_episodes` | 群聊经历上限 | 经历整理 | 10 | 同上 |
| `dialogue_episode_memory_enabled` | 私聊对话经历 | 经历整理 | true | 始终 |
| `dialogue_episode_refresh_messages` | 对话经历刷新消息数 | 经历整理 | 8 | `dialogue_episode_memory_enabled` 为真 |
| `dialogue_episode_refresh_minutes` | 对话经历刷新间隔 | 经历整理 | 90 | 同上 |
| `max_dialogue_episodes` | 对话经历上限 | 经历整理 | 12 | 同上 |
| `habit_learning_enabled` | 用户习惯学习 | 习惯与推荐 | true | 始终 |
| `habit_min_count` | 习惯最少观察次数 | 习惯与推荐 | 3 | `habit_learning_enabled` 为真 |
| `habit_max_items` | 习惯条目上限 | 习惯与推荐 | 24 | 同上 |
| `habit_refresh_minutes` | 习惯刷新间隔 | 习惯与推荐 | 360 | 同上 |
| `food_menu_recommendation_enabled` | 推荐菜谱 | 习惯与推荐 | true | `habit_learning_enabled` 为真 |

### 2.2 `role.state.*`（约 85 项）

读写：`GET /state`（含 `settings`）、`POST /state/command`，`action∈{configure, configure_role, configure_window}`。
分层：`settings_scope.py:9-11` 定义 `WINDOW_FIELDS`（QQ 展示四项，只能写窗口层）与 `ROLE_ONLY_FIELDS`（`enabled`、`calendar_enabled`、全部 `planning_*`，只能写角色层），其余为「角色默认 + 窗口覆盖」。

**A. 后台维护与首页展示（`home` 组，23 项）**

| 设置键 | 界面标签 | 默认 | 层级 | 显示条件 |
|---|---|---|---|---|
| `enabled` | 启用后台状态维护 | **false** | 角色 | 始终（首屏，不可折叠） |
| `maintenance_minutes` | 更新间隔（分钟） | 30 | 角色 | `enabled` 为真 |
| `energy_enabled` | 能量 · 状态模拟 | true | 角色+窗口 | 始终 |
| `health_enabled` | 健康 · 状态模拟 | true | 角色+窗口 | 始终（同时在 `maintenance`/`health` 组重复出现） |
| `hunger_enabled` | 饥饿 · 状态模拟 | true | 角色+窗口 | 始终（同上重复） |
| `sleep_enabled` | 睡眠状态 · 状态模拟 | true | 角色+窗口 | 始终 |
| `cycle_enabled` | 生理期 · 状态模拟 | false | 角色+窗口 | 始终；关闭时生理期子页只剩开关 |
| `mood_enabled` | 心情 · 状态模拟 | false | 角色+窗口 | 始终 |
| `busy_enabled` | 忙碌 · 状态模拟 | true | 角色+窗口 | 始终（忙碌读数来自日程） |
| `location_enabled` | 位置 · 状态模拟 | true | 角色+窗口 | 始终（只读展示） |
| `home_show_{energy,health,hunger,sleep,cycle,mood,busy,location}` | 首页展示（8 项） | 全 true | 角色+窗口 | 对应 `{x}_enabled` 为真 |
| `home_only_special_{health,hunger,sleep,cycle,busy}` | 特殊状态展示条件（5 项） | false | 角色+窗口 | `home_show_{x}` 为真 |

**B. 表达与引导（5 项）**

| 设置键 | 界面标签 | 默认 | 显示条件 |
|---|---|---|---|
| `humanized_state_intensity` | 状态表达强度（滑块） | 50 | 始终 |
| `energy_expression_prompt` | 精力模拟引导 | "" | 高级（`energy_enabled` 为真） |
| `health_expression_prompt` | 健康感受引导 | "" | 高级（`health_enabled` 为真） |
| `hunger_expression_prompt` | 饥饿感受引导 | "" | 高级（`hunger_enabled` 为真） |

**C. 日程与规划（9 项 + `calendar_enabled`）**

| 设置键 | 界面标签 | 默认 | 层级 | 显示条件 |
|---|---|---|---|---|
| `calendar_enabled` | 启用角色日程 | true | **仅角色** | 始终 |
| `schedule_simulation_mode` | 日程模式 | orchestrated | 角色 | `calendar_enabled` 为真 |
| `planning_enabled` | 启用自动规划 | false | 角色 | `calendar_enabled` 且模式为「日程编排」 |
| `planning_timezone` | 规划时区 | Asia/Shanghai | 角色 | 始终（时间与日期子页 + 日程子页同字段） |
| `planning_horizon_days` | 长期规划范围（天） | 90 | 角色 | `planning_enabled` 为真 |
| `planning_refine_minutes` | 提前细化时间 | 15 | 角色 | `planning_enabled` 为真 |
| `planning_max_items` | 每次最多安排 | 12 | 角色 | `planning_enabled` 为真 |
| `planning_annual_calendars` | 年度日历与调休 | "" | 角色 | 高级（`calendar_enabled` 为真） |
| `planning_prompt` | 规划偏好 | "" | 角色 | 高级（`planning_enabled` 为真） |

**D. 天气（3 项）**

| 设置键 | 界面标签 | 默认 | 显示条件 |
|---|---|---|---|
| `planning_weather_enabled` | 启用角色天气感知 | false | 始终 |
| `planning_weather_location` | 角色天气地点 | "" | `planning_weather_enabled` 为真 |
| `planning_weather_max_age_minutes` | 天气信息最长沿用 | 120 | `planning_weather_enabled` 为真（5–120） |

**E. 生理期（`cycle` 组，34 项）** —— 全部只在 `cycle_enabled` 为真时展开；`cycle_enabled` 关闭时只留一个开关。

`cycle_mode(basic|six_phase)`、`cycle_timezone`、`cycle_initialization(natural|unknown|first_day)`、`cycle_variation_enabled` 始终显示；`cycle_{6阶段}_days`（默认 5/7/2/2/9/3）在「周期方案」页签；`cycle_discomfort_enabled` → `cycle_discomfort_chance(55)` + `cycle_discomfort_types(6 选多)`；`cycle_{6阶段}_{energy,mood,prompt}`（18 项）+ `cycle_expression_prompt` + `cycle_link_intensity` 在「阶段表达」页签（建议整体收进高级）。

**F. 心情（4 项）**：`mood_enabled(false)` 始终；`mood_update_probability(0.6)`、`mood_update_max_delta(2)`、`mood_decay_half_life_minutes(90)` 仅在 `mood_enabled` 为真时显示（高级）。

**G. 每日巡视（3 项）**：`daily_state_patrol_enabled(true)` 始终；`daily_state_patrol_time(04:00)`、`daily_state_patrol_retention_days(30)` 仅在开关为真时显示。

**H. QQ 平台展示（4 项，窗口层）**

| 设置键 | 界面标签 | 默认 | 显示条件 |
|---|---|---|---|
| `typing_enabled` | 启用正在输入提示 | false | 平台具备 presence 端口（§6.1） |
| `typing_refresh_seconds` | 输入提示刷新间隔（秒） | 4 | `typing_enabled` 为真 |
| `presence_enabled` | 启用 QQ 自定义短状态 | false | 平台具备 presence 端口 |
| `online_status_enabled` | 启用 QQ 在线状态 | false | 平台具备 presence 端口 |

权限映射见 `configuration.py:PERMISSIONS`：`platform.typing` / `platform.presence`；可用性由 `presentation_diagnostics.*.reason` 判定（`presence_diagnostics.py:9-13`）。

### 2.3 学习与成长

| 设置键 | 界面标签 | 位置 | 读写 API | 层级 | 默认 | 显示条件 |
|---|---|---|---|---|---|---|
| `role.growth.skills.enabled` | 启用成长记录 | 学习 → 角色策略 | `/config/configure` | 安装/角色 | true | `role.config_api` 存在 |
| `role.growth.skills.custom_skills` | 自定义技能域 | 学习 → 角色策略 | 同上 | 安装/角色 | `[]` | `enabled` 为真 |
| `role.growth.skills.schedule_influence_strength` | 日程参考强度 | 学习 → 角色策略 | 同上 | 安装/角色 | 0 | `enabled` 为真 |
| `role.growth.read_enabled` | 读取成长记录 | 成长链路顶部 | `/growth/command`(configure) | 窗口 | **false** | `role.growth_api` 存在 |
| `role.growth.propose_enabled` | 提出成长建议 | 同上 | 同上 | 窗口 | **false** | 同上（读关闭时被后端强制跟随，`access_management.py:28-29`） |

### 2.4 治理与维护（不是设置，但可写）

| 项目 | 位置 | 读写 API | 显示条件 |
|---|---|---|---|
| 每个模型任务的提示词 | 任务提示词 | `POST /model/configure` | `GET /model` 返回的 `tasks[]` 非空；按任务分组折叠 |
| 后台任务预算 | 不在本页，在「模型与连接」 | `config` | 排障页预算卡只在已配置预算时显示 |
| 服务余额来源 | 不在本页 | `/host-options/balance` | `GET /model/balance` 的 `configured` 为真 |

维护页本身**没有一个开关**：全部开关都在别处，它是纯观测面。

---

## 3. 操作清单

### 3.1 记忆（`/memory/*`）

| 动作 | 位置 | API | 效果 |
|---|---|---|---|
| 切换会话对象/角色 | 页头两个下拉 | `GET` `{memory_api}` 等 | 重读整页（`changeScope`） |
| 切换 6 个区域 | 左轨 | — | 按区域补读（`switchArea 1404`） |
| 筛选生命周期 / 搜索 | 事实区 | — | 纯本地过滤（预读 4 页×50 条，`30`） |
| 查看事实详情 | 点事实卡 | `POST /memory/detail` | 详情 + 来源句柄，并顺手取版本历史 |
| 查看版本历史 | 详情内 | `GET /memory/revisions` | 时间轴 |
| 查看原始来源 | 详情/检索结果 | `POST /memory/source` | 4k 字符窗口，可继续往后翻 |
| 置顶/取消置顶 | 详情 | `POST /memory/command`(pin/unpin) | 生成新版本 |
| 撤回 | 详情 | `POST /memory/command`(retract) | 先弹确认，生成新版本 |
| 遗忘 | 详情 | `POST /memory/command`(forget) | 先弹确认，隐藏并留审计记录 |
| 更正 | 详情表单 | `POST /memory/command`(correct) | 生成新版本 |
| 检索 | 来源与经历 | `POST /memory/query` → `POST /memory/source` | 4 种资料类型 + 游标续读 |
| 归档预览 / 归档 / 移回 | 冷归档 | `/memory/archive/preview`、`/archive`、`/archive/restore` | token 校验，可逆 |
| 导出记忆包 | 迁移 | `GET /memory/export?include_archived=` | 生成 JSON，可复制或下载 |
| 校验/导入记忆包 | 迁移 | `/memory/import/preview`、`/import` | 先校验再确认 |
| 范围清理 | 范围清理 | `/clear/preview` → `/clear` | 逻辑遗忘全部有效事实 |
| 修复/继续整理批次 | 整理与修复 | `POST /memory/reflections/retry`、`/queue` | 前者同步跑、后者登记后台 |
| 核对未确认提交 | 页内常驻提示条 | 无（重放原请求） | 恢复 `pending`/`pendingMutation` |
| 刷新状态 | 整理详情 | `GET /memory/reflections?batch_id=` | — |
| 记忆策略保存 | 记忆策略 | `POST /memory/settings/command` | 显式保存 + 令牌 |

注：`memory-page.js:1443-1450` 里处理了 `#memory-refresh` / `#memory-directory-refresh` 两个按钮，但**页面上并不存在这两个元素**（无手动刷新入口，只能等 8 秒轮询或切区域）。

### 3.2 学习

| 动作 | 位置 | API | 效果 |
|---|---|---|---|
| 重新读取 | 页头 | `GET {growth_api}` + `/progress` | 双读 |
| 阶段/类型筛选 | 轨道（生产不可达） | `GET` 带 `state`/`kind` | — |
| 记录动作（确认/继续/暂停/已完成/归档/撤回） | 详情按钮组（后端 `actions` 下发） | `POST {growth_api}/command` | 状态迁移 |
| 修订 | 右下表单 | 同上 `action:revise` | 生成新版本 |
| 读下一页 | 列表底部 | `GET` `after_id` | 20/页 |
| 权限开关 | 顶部 | `POST {growth_api}/command`(configure) | 写 `role.growth.read/propose` |
| 查看依据 | 左下 | `GET {growth_api}/evidence` | 原文片段 |
| 提出成长建议 | 无 UI 入口 | `POST {growth_api}/command`(propose) | 需要外部签发的 ScopeRef/VersionRef（`learning-page.js:427`） |

### 3.3 状态

| 动作 | 位置 | API | 效果 |
|---|---|---|---|
| 立即更新 | 页头 | `POST /state/command`(maintain) | 排队一次后台维护，随后 3 秒轮询核对 |
| 刷新状态 | 页头 | `GET /state` | — |
| 打开功能详情 | 点图块/环境卡 | — | 展开面板并可进编辑 |
| 保存配置 | 各子页表单 | `POST /state/command`(configure / configure_role / configure_window) | 显式保存、`edit_token`/`role_edit_token` |
| 周期校准 | 生理期 → 校准 | `POST /state/command`(cycle.align) | 重建周期定位 |
| 展示设置 | QQ 状态子页 | `POST /state/command`(configure_window) | 只在具备 presence 端口时有意义 |
| 日程创建/改整组/改本次/取消/提醒 | 日程子页 | `calendar.create`、`revise`、`exception`、`cancel`、`remind` | 条目级 revision |
| 日程公开短文案 | 日程卡「编辑文案」 | `calendar.presence` | QQ 专属字段（≤8 字） |
| 跳「日记与生活」改作息 | 睡眠子页链接 | — | 就寝时刻/时长在另一页 |
| 跳「开口闸门」改睡眠/忙碌回复 | 睡眠/忙碌子页链接 | — | 回复策略在「主动联系」页 |
| 全局搜索定位到字段 | 全局搜索 | — | `openEditor(kind, field)` 切图块并聚焦 |

### 3.4 维护

| 动作 | 位置 | API | 效果 |
|---|---|---|---|
| 刷新 | 页头 | 4 个 GET | 整块重读 |
| 切 6 个视图 | 二级导航 | — | 纯前端 |
| 换 Token 来源 / 周期 / 日 | Token 统计 | — | 本地重算（来源可用性见 §6.2） |
| 导出 CSV | Token 统计 | — | 前端生成文件 |
| 服务余额 | Token 统计 | `GET /model/balance` | 可能出网 |
| Provider / TTS / 图像工具测试 | 排障 → 按需检测 | `POST /model/test`、`/voice/test`、`/image/test` | **真实调用，可能计费** |
| SQLite 完整性检查 | 排障 → 按需检测 | `POST /model/test/storage` | 只读 |
| 主动联系真实投递测试 | 排障 → 按需检测 | `POST /setup/proactive-diagnostic` | **向管理员真发一条消息**（15 个目的可选） |
| 进程内存采样 | 排障 → 按需检测 | `GET /model/memory` × 19 | 3 分钟前端定时器 |
| 清除本次诊断结果 | 排障 | — | 本地状态 |
| 提示词编辑/预览/保存 | 任务提示词 | `POST /model/configure` | 令牌 + 冲突提示 |

---

## 4. 重复与冲突

### 4.1 同一份数据出现在四处（成长记录）

| 位置 | 文件 | 形态 |
|---|---|---|
| 学习 → 总览「待裁决/培育中」两条泳道 | `learning-overview.js:111-151` | 卡片 + 最多 2 个动作 + 确认条 |
| 学习 → 审阅中心「进展核实」 | `learning-review-page.js:44-60` | 明细 + 批量勾选 |
| 学习 → 成长链路 | `learning-page.js:684` | 左右两栏工作台 |
| 学习 → 角色策略「成长与技能」 | `app.js:4191` | 三个配置字段 |

同一个 `growth_id` 在四处出现，动作按钮分别由 `data-lh-action`、`data-review`、`data-act` 三套 DOM 契约驱动，逻辑各写一遍（`learning-overview.js:157-173`、`learning-review-page.js:157-180`、`learning-page.js:391`）。

### 4.2 「读取/提出」权限在两处叫不同名字

- 成长链路顶部：`读取成长记录` / `提出成长建议`（`gateView`）。
- 角色策略：`启用成长记录`（`role.growth.skills.enabled`，另一套字段）。
- 关系与权限页还有第三处（`role.growth` 的授权面板）。同一件事三个名字、三个层级。

### 4.3 记忆统计在同一屏出现两次

`overviewMarkup 393`（「已保存事实 / 全部事实」等 4 个数字 + 记忆插件联动 + 整理批次分布）与 `vitalsMarkup 371`（四条生命周期占比带 + 图例数字）**同时**渲染在事实治理页首屏，读数来自同一份 `data.corpus` 与 `/memory/overview`。

### 4.4 「记忆」被拆成两个页面、两个 API 前缀

| 内容 | 在哪里 | API |
|---|---|---|
| 私聊事实/经历/整理/归档/清理 | 事实与经历 | `/memory/*` |
| 群公共记忆（陈述、安全线索、撤回） | 群工作区（`product-page.js:1049`） | `{group_memory_api}/*`（6 条，`group_memory_api.py:24`） |
| 记忆策略 30 字段 | 事实与经历 → 记忆策略 | `/memory/settings` |

事实与经历页对群目标直接显示「群聊记忆独立管理，请选择有记忆权限的私聊对象」（`memory-page.js:862-863`）—— 群记忆在另一个页面，两个入口指向同一个概念。新 UI 需要把「私聊记忆」与「群公共记忆」放在同一个「记忆」下，按当前对象类型切换视图（条件见 §6.3），两个入口合一。

### 4.5 每日巡视有两个入口，字段属于第三个页面

- 入口一：状态页「每日巡视」图块（`featureInfo.patrol`）。
- 入口二：治理与维护 → 每日巡视（`app.js:3686`，整个页面替换成状态页的 `section='patrol'`）。
- 字段定义：`state-maintenance.js:groups.patrol`，编辑器是状态页的。
三级归属，两个入口，一个实现。

### 4.6 天气配置三处

1. 状态 → 天气子页：开关、地点、信息时效、指向感知页的链接。
2. 感知页 `#perceptionRoleWeatherWorkspace`：同一个状态页组件 `section='weather'`（`app.js:1971`）。
3. 天气源页（`weather-source-page.js`）：和风/Open-Meteo 凭据。状态页文案里说「此处不保存 API 凭据」，但同屏仍显示「数据源」一行。
同一句话在两处出现：「信息沿用 X 分钟；超时会按授权重新读取」（`state-page.js:373`、`state-maintenance.js:actionSummary weather`）。

### 4.7 学习页的四个视图不可达（功能重复而非功能多余）

`mount()` 只在 `layout==='chain'` 下被调用（`app.js:865`），而 `render()`（`learning-page.js:792-797`）在 `chain` 分支里根本不渲染 `railMarkup/body`。因此 `VIEWS 503`、`railMarkup 551`、`trackView 572`、`filterBar 590`、`lane/card/reviewsView/sourcesView/confirmMarkup`、`REVIEW_ACTIONS` 全部不可达 —— 约 200 行只是测试与 preview 模板在用（`tests/test_learning_page.cjs`、`tools/learning_preview.tpl.html`）。而这套视图的功能（待审阅、来源筛读）在「审阅中心」里又实现了一遍。**结论是入口合并，不是删功能。**

### 4.8 会话对象/角色选择器三套

| 位置 | 形态 |
|---|---|
| 小屋外壳 | 「{角色名}的小屋」下拉，仅 >1 角色时出现（`product-page.js:706-715`） |
| 事实与经历页头 | 会话对象 + 角色两个下拉（`memory-page.js:344`） |
| 学习 → 成长链路 | 页签上方的「筛选记录」对象/角色下拉（`app.js:4099-4118`） |
| 状态页 | 无选择器，跟随外壳 `product.selection()` |

我们当前只有一个机器人、一个角色：页头那个「角色」下拉渲染出来只有一个选项，是纯噪音。合并后应保留「会话对象」选择（群/私聊切换是真实需求），角色选择跟随外壳。

### 4.9 桥接与错误字典三份拷贝

`api()`/`bounded()`/`whenBridgeReady()`/`CODE` 正则/`denied` 集合在 `memory-page.js`、`learning-page.js`、`state-page.js` 各写一份；错误码字典分别是 ~60 / ~45 / ~40 条，其中 `dashboard_identity_required`、`staging_not_initialized`、`binding_revoked`、`bridge_timeout`、`invalid_response` 等十余条在三份里字面重复。

### 4.10 「整理」这个词指向四个不同的东西

| 文案 | 实际含义 |
|---|---|
| 事实与经历 → 整理与修复 | 记忆提取批次（`reflection`） |
| 定时整理 | 同一个 `reflection_enabled` |
| 学习 → 每日复盘 | `role.self_review`（角色自我复盘，不是记忆） |
| 日记 → 书写整理 | `role.journal.derive`（在日记页） |

### 4.11 睡眠相关设置分三处

`state.sleep_enabled`（是否模拟困意，状态页）、`life` 的作息（就寝时刻/时长/浮动，日记与生活页）、`reply` 的开口闸门（睡眠中是否回复，主动联系页）。三处都叫「睡眠」，各有各的开关。

### 4.12 跳页重复（交给全局去重，明细见 `.items.json`）

同一个 key 在本区出现 2–4 处，共 29 个。新 UI 合并时按此表处理，**每个对象只能留一个主入口**，其余降为只读或跳转：

| 对象（key） | 处数 | 全部位置 | 差异 |
|---|---|---|---|
| `growth_records` | 4 | 学习>成长链路 / 学习>总览泳道 / 成长花架家具（`product-page.js:1180`）/ 轨道视图（不可达） | 3 种呈现，3 套动作按钮 |
| `growth.command` | 3 + 2 | 同上（含修订弹窗） | 同一后端动作写三遍逻辑 |
| `role.growth.read_enabled` / `propose_enabled` | 2 各 | 成长链路顶部 / 关系与权限（`app.js:4073`） | 同一开关两处可改 |
| `role.state.planning_*`（9 项） | 2 | 状态>日程配置 / 小屋>生活挂历家具 | 同一组件同一子页 |
| `role.state.planning_timezone` | 3 | 同上 + 状态>时间与日期 | 一个字段三个入口 |
| `role.state.daily_state_patrol_*` | 2 | 状态>每日巡视 / 治理与维护>每日巡视 | 同一组件 |
| `role.state.planning_weather_*` | 2 | 状态>天气 / 感知>角色天气 | 同一组件 |
| `role.state.state.values` | 3 | 状态看板 / 首页状态条（`home-sidebar.js:183`）/ 生活观察>状态变化（`app.js:1648`） | 三种读法 |
| `role.state.occurrences` | 2 | 首页今日安排 / 状态日程子页 | 同一份日历 |
| `health_enabled` / `hunger_enabled` | 2 各 | 状态设置弹窗 / 健康·饥饿子页 | 同一开关两处 |
| `cycle_enabled` / `mood_enabled` | 2 各 | 状态设置弹窗 / 生理期·心情子页 | 同上 |
| `prompt`（任务提示词） | 2 | 治理与维护>任务提示词 / 模型与连接>任务配置 | 两套编辑器写同一字段 |
| `model.modelStatus.tasks` | 2 | 排障>任务路由审计（只读）/ 模型与连接（可写） | 同一 tasks[] |
| `model.maintenance.recent` | 2 | Token 统计的最近预览 / 最近调用视图 | 同一数据两屏 |
| `budget` | 2 | 治理与维护（只读卡）/ 模型与连接（可写） | 读写分开 |
| `memory.*`（30 字段） | 2 | 记忆策略 / 全局搜索命中 | 搜索是第二入口 |
| `role.state.*`（85 条命中） | 2 | 各子页 / 全局搜索命中 | 同上 |
| `memory_atoms`（页面入口） | 2 | 侧栏「事实与经历」/ 首页概览行「记忆工作区」（`product-page.js:775`） | 入口重复 |

两个真实缺口（不是重复，而是接口有能力、界面无入口）：`role.state.calendar.accept`（首页把 proposed 期次标成「待确认」，但没有接受按钮）、`role.state.write`（带来源的手动状态写入）、`growth.command#propose`（成长建议没有提出入口）。

---

## 5. 交互问题

> 这一节的问题全部按「界面层可减」处理：合并、拍平、精简、折叠。功能不动。

| # | 问题 | 位置 | 说明 |
|---|---|---|---|
| 5.1 | **没有手动刷新** | `memory-page.js:1443` | 处理了 `#memory-refresh`，但从未渲染该按钮；事实区只能等 8 秒轮询。整理详情倒是有「刷新状态」。 |
| 5.2 | **保存模型五种并存** | 见下 | ①记忆策略 = 显式保存 + 令牌 + 恢复继承；②事实治理 = 点即提交（`mutateFact`）；③成长记录 = 点即提交 + 二次确认条；④状态 = 草稿 + 显式保存 + rebase 冲突恢复 + 已提交未确认的恢复；⑤维护页提示词 = 又一个显式保存。 |
| 5.3 | 状态维护默认关闭，用户看到的是「空 + 一句状态维护已关闭」 | `state-page.js` 页头 `maintainLabel` + `configuration.py:DEFAULTS["enabled"]=False` | 点「立即更新」才发现要去设置里开。`cycle_enabled/mood_enabled/planning_enabled` 也都是 false。 |
| 5.4 | 「立即更新」的结果要等 3 秒轮询 ×N | `requestMaintenance 589`、`schedule 524` | 期间按钮文案在「正在请求…/更新中…」之间跳；失败原因埋在 `maintenanceFeedback 274` 的一长串映射里，最长的一条有 30 余字再加机器码。 |
| 5.5 | 层级过深：状态功能 = 看板 → 图块 → 详情面板 → 表单 → 保存 | `featurePanelMarkup 345` | 点两次才可编辑，编辑后再滚动回看板；窄屏上详情是覆盖层。 |
| 5.6 | 层级过深：治理与维护 6 个视图 × 每个视图 3–5 个区块 | `render 3055` | Token 页一屏内同时有：11 个来源页签、4 周期、预算双限额、余额、Provider/Task 双排行、组合图、缓存带、最近预览。 |
| 5.7 | 状态详情面板里有 5 处「去别的页面改」 | `state-page.js:349,356,366,373,377` | 睡眠→日记页；睡眠/忙碌回复→主动联系页；天气→感知页；日期→感知页。改一个状态要跨 4 个页面。 |
| 5.8 | 状态详情里有 3 段「为什么不能直接编辑」的解释卡 | `state-page.js:361`（忙碌）、`363`（位置）、`377`（日期） | 纯解释性文案。 |
| 5.9 | 术语难懂 | 全站 | `HDSI`/连续日程、`阶段表达`、`表达引导`、`氛围词`、`周期校准`、`依据与凭证`、`收口`、`回执`、`软限额/硬预算`、`zipper`、`Token 来源`、`防抖`、`证据句柄`。 |
| 5.10 | 状态提示过多 | `state-page.js:304-330` + `274-303` | 每个图块都带一个运行态短语（「维护已关闭/已关闭/未启用/尚未记录」），页脚再一条维护状态，页头再一条 notice。同类信息 4 层。 |
| 5.11 | 事实详情里「置信度」圆环 + 「核心记忆」徽标 + 「保留方式」+「归属」+「对象」+「版本」 | `factDetailMarkup 513`、`ringMarkup 484` | 六个技术字段先于正文出现；`retentionLabels`（session/short/durable/protected）属于实现术语。**改默认折叠（不删，仍可展开查看）。** |
| 5.12 | 整理批次把六阶段内部状态机当作主视觉 | `stageTrackMarkup 493`、`stateLabels` 9 态 | 「调用结果待核对」「已收到，待解析」是后端状态词直接上屏。 |
| 5.13 | 错误提示双写法 | 各页 `failure()` | 有明确码时给一句人话，无码时给「当前状态未能确认，请刷新核对」——这句在四页里共 9 次，等于没说。 |
| 5.14 | 记忆归属提示是一整段 3 句话的免责说明 | `ownerNotice 250-269` | 默认（V2 自己提供）那段 ~90 字，常驻页头下方。 |
| 5.15 | 成长链路的权限开关常驻在记录页顶部 | `gateView 522` | 一个「看记录」的页面，首屏第一块是权限设置；两个开关默认都关，用户先看到两条「当前未生效」。 |
| 5.16 | 成长链路把「依据与凭证」「记录归属」做成必读信息 | `rowEvidenceMarkup 708`、卡片 meta | 每条记录都带「N 条依据」，左栏常驻一个证据栏。 |
| 5.17 | 排障页的「按需检测」权重相同 | `proactiveTestMarkup 1945`、`memoryDiagnosticMarkup 1756`、`integrationsMarkup 1624` | 一个页面里同时有：真发消息、真实模型调用（可能计费）、3 分钟内存采样、SQLite 检查，都叫「检测」，视觉权重一样。 |
| 5.18 | 维护页一次读 4 个接口，失败只留一句 routeError | `refresh 3093`（4 个 GET 在 `3104-3105`）、`routeError 164` | 主统计失败会整块清空（注释里是刻意的），但用户看到的是「维护面板暂时离线」。 |
| 5.19 | 状态页 `load()` 强校验 `sleep_schedule`，缺字段即整页失败 | `state-page.js:567` | 一个可选区块缺失导致 `invalid_response` 全页报错。 |
| 5.20 | 生理期 34 项配置被塞进一个子页的 2 层页签 | `state-maintenance.js:565-601` | 方案页签 6 个字段 + 不适模拟 + 6 个时长；表达页签 6 个阶段 × 3 字段 + 整体偏好。 |
| 5.21 | 年度日历：结构化表单 + 「高级·原始数据」双入口 | `annualCalendarFields 468`、`state-maintenance.js:200-467` | 两套编辑同一字段；校验错误文案 8 种，含「同一天只能属于一个节假日」这类业务规则。 |
| 5.22 | 记忆策略的 30 个字段一次性平铺在 4 张卡里 | `memory-settings-section.js:50-72` | 11 个「字符数/条数」滑到用户面前。 |
| 5.23 | 加载慢 | `memory-page.js:944` 预读 4×50 条 | 事实区首屏要串行打 4 次列表 + 1 次 overview + 1 次 ownership；冷启动明显。 |
| 5.24 | 日程表单暴露夏令时细节 | `calendar-editor.js:194-195` | 「夏令时缺口 / 夏令时重复时间」是引擎参数，不是用户决策。 |

---

## 6. 按条件显示清单（能力驱动，不是删除）

判断条件全部来自已读到的接口，不写死平台名。四类来源：

- **A 平台**：`GET /page/targets` → `target.platform_id` / `target.platform_name`（`page_api.py:143,162`、`multi_api.py:147`）。已知取值见 `product-page.js:676`：`qq` / `default` / `aiocqhttp` / `onebot` / `qq_official` / `qq_official_webhook`；微信适配器的取值由适配器自身声明，**不要在页面里硬编码判断**，用「是否具备某端口」代替。
- **B 扩展能力**：`GET /integration/manifest` → `extensions[]` / `providers[]`，字段 `capability_id`、`desired_state`（`installed`/`paused`/`discarded`）、`assembled`、`integration_state`、`reason`（`app.js:1688` 的 `capabilityStatus` 已在消费）。内置能力 id：`content`、`image`、`together`、`game`、`live`、`companion.screen.native`、`reality`（`astrbot_host/native_extensions/builtins.py:26-27`）。
- **C 作用域**：`GET /page/targets` → `target.scope_kind`；群目标没有 `memory_api`/`state_api`/`growth_api`/`life_api`/`config_api`/`qzone_extension_api`/`image_material_api`/`persona_api`，只有 `group_memory_api`（`multi_api.py:155-187`）。
- **D 运行/能力开关**：`GET /state` 的 `settings`、`effective`、`presentation`、`presentation_diagnostics`；`GET /model/maintenance` 的 `external_token_sources[key].installed/available`；`GET /memory/overview` 的 `linkage.state`。

### 6.1 平台与端口条件（QQ 专属功能：保留，按可用性显示）

| 功能 / 设置 | 判断条件（字段） | 条件不满足时新 UI 的表现 |
|---|---|---|
| QQ 正在输入（`typing_enabled`、`typing_refresh_seconds`） | `GET /state` → `presentation_diagnostics.typing.reason !== "presence_port_missing"`（`presence_diagnostics.py:9-13`）；叠加 `settings.typing_enabled` | 整块「QQ 展示」收进「高级 · 平台能力」，并显示一行「当前平台未提供展示端口」；字段仍可读可写 |
| QQ 自定义短状态 / 在线状态（`presence_enabled`、`online_status_enabled`） | 同上 `presentation_diagnostics.custom_status` / `.online_status` | 同上 |
| QQ 平台回执列表 | `GET /state` → `presentation.state === "preview"` 表示无端口（`management.py:95`） | 回执列表只显示「当前平台未提供展示能力」一行；有端口时才渲染回执 |
| 日程「QQ 公开短文案」+ `calendar.presence` | 同 §6.1 第一行（同一 presence 端口）；自身能力位缺失，见 §6.7 | 表单里该字段隐藏；已保存值不丢，只读展示 |
| 「在线模式」四档（在线/离开/忙碌/隐身） | `presentation_diagnostics.online_status.desired.mode` 存在 | 无端口时不渲染 |
| 群公共记忆（陈述/安全线索/撤回） | `target.scope_kind === "group"` 且 `role.group_memory_api != null` | 选私聊对象时整块隐藏（现在是一个「另一种记忆」页面，见 §4.4） |
| 私聊事实/整理/归档/清理/策略 | `target.scope_kind === "private"` 且 `role.memory_api != null` | 选群目标时隐藏（现状即如此，`memory-page.js:862`） |
| 状态、日程、成长记录 | `role.state_api != null` / `role.growth_api != null`（群目标为 null） | 选群目标时隐藏，不留空壳 |

> 接入 QQ 后，上面这些条件会自动变成「显示」，无需改前端：判断依据是端口可用性，不是平台名。

### 6.2 扩展能力条件（直播 / 一起看 / 游戏 / 屏幕 / 现实 / 生图 / 内容）

| 功能 | 判断条件 | 条件不满足时 |
|---|---|---|
| Token 来源页签：`memory` / `together` / `reality` / `live` / `game` | `GET /model/maintenance` → `external_token_sources[key].installed`（`token_sources.py:200-215`）；`available` 区分「装了但统计桥不可用」 | 现在 11 个页签全显示，其中 5 个永久停在「未安装 / 未就绪」（`maintenance-page.js:229-238`）。改为只显示 `installed=true` 的来源；`available=false` 时显示该来源的一行原因（`reason`） |
| `main` / `astrbot_core` / `legacy_conversation` 三个宿主来源 | `external_token_sources.main.available` / `localSourceNames` | `available=false` 时合并进「其他来源」一行 |
| 排障分类：`voice` | `GET /model/voice` 返回非空 `providers[]` | 分类芯片不渲染（`diagnosticCategories 141` 现在是静态 12 类） |
| 排障分类：`image_generation` | `GET /model/image` → `actions[]` 中存在 `registered && current` | 同上 |
| 排障分类：`cache` | `stats.cache_observations > 0` | 同上，且「缓存诊断」视图整体显示空态 |
| 排障分类：`storage` | `runtime.storage` 存在 | 同上 |
| 排障分类：`proactive` | `runtime` 中有主动任务记录 | 同上 |
| 按需检测：Provider / TTS / 图像工具测试 | 对应 provider 列表非空 | 按钮不渲染 |
| 按需检测：主动联系真实投递 | `GET /setup/status` 中管理员窗口已绑定（由 `app.js` 提供）；当前判断为可用即显示 | 未绑定时不显示 |
| 能力入口（不在本区页面，但由同一份 manifest 驱动） | `capabilityStatus(id)`（`app.js:1688`）：`desired_state==='installed'` 且 `assembled` | 「家具与能力」里显示为「未装配」，本区不出现对应入口 |

> 我们当前没启用 live/together/game/screen/reality，因此这些来源、分类、检测按钮在新 UI 里会因为 `installed=false` / 数据为空而自动收起；一旦启用（或接入 QQ 官方机器人）自动出现。

### 6.3 作用域条件（安装 / 角色 / 窗口 / 群 / 成员）

| 层级 | 判断条件 | 受影响的设置 |
|---|---|---|
| 安装 | 目录里的 `installation_id` | 记忆包导出/导入、备份 |
| 角色 | `ConfigLayer.ROLE`（`state_api.py` 的 `configure_role`） | `role.state.enabled`、`calendar_enabled`、全部 `planning_*`、`role.growth.skills.*` |
| 角色默认 + 窗口覆盖 | 其余 `role.state.*` | 健康/饥饿/周期/心情/巡视/首页展示 |
| 窗口（私聊对象） | `ConfigLayer.WINDOW`，`settings_scope.py:9-10` 限定 | `typing_*`、`presence_enabled`、`online_status_enabled`、`role.growth.read/propose` |
| 群 | `scope_kind === "group"`，`group_memory_api` | 群公共记忆、群经历记忆阈值（`memory.group_episode_*`） |
| 成员 | 群成员安全线索（`group_memory_api` 的 `/safety`） | 只在群目标下出现，属于群记忆的二级视图 |

### 6.4 开关从属条件（能力关闭 → 详细设置收起，开关本身始终在）

这条对应产品原则「能力关闭时其详细设置收起」。开关本体不可随自身关闭而消失，否则再也打不开。
**现状**：这些从属关系目前**基本都没实现** —— 开发组一打开就渲染整组字段（例外：首页特殊展示策略控件会按 `home_show_{x}` 置 `disabled`，`state-maintenance.js:523`）。新 UI 需要按本表实现收起，判断字段就是 `GET /state` 的 `settings.*` / `GET /memory/settings` 的 `values.*`。

| 主开关 | 收起的内容 | 依据 |
|---|---|---|
| `role.state.enabled` | `maintenance_minutes` | `state-maintenance.js:99-100` |
| `cycle_enabled` | 生理期全部 33 项（方案页签 + 阶段表达） | `groups.cycle` |
| `mood_enabled` | 概率/幅度/半衰期 3 项 | `groups.mood` |
| `daily_state_patrol_enabled` | 巡视时刻、保留天数 | `groups.patrol` |
| `calendar_enabled` | 日程模式、年度日历 | `groups.planning` |
| `planning_enabled` | 范围/细化/上限/偏好 | `groups.planning` |
| `schedule_simulation_mode === "orchestrated"` | 自动规划参数（现为始终渲染，`state-maintenance.js:544`） | 字段依赖：「连续日程」下自动编排暂停，这些参数无意义 |
| `planning_weather_enabled` | 地点、信息时效 | `groups.weather` |
| `typing_enabled` | 刷新间隔 | `groups.settings` |
| `home_show_{x}` | `home_only_special_{x}` 展示策略 | `state-maintenance.js:523`（控件已按 `home_show_{x}` 置 disabled） |
| `group_episode_memory_enabled` | 3 个群经历阈值 | `memory-settings-section.js:65-68` |
| `dialogue_episode_memory_enabled` | 3 个私聊经历阈值 | 同上 |
| `habit_learning_enabled` | 观察次数/上限/刷新间隔/推荐菜谱 | 同上 |
| `role.growth.skills.enabled` | 自定义技能域、日程参考强度 | `role_work/growth/configuration.py:SKILL_FIELDS` |
| `reflection_enabled` | 时区、返回格式、自动修复、材料上限 | `memory-settings-section.js:60-62` |

### 6.5 数据可用条件（没有数据 → 空态或说明一行，不渲染控件）

| 功能 | 条件 | 否则 |
|---|---|---|
| 记忆概况 + 外部联动 | `GET /memory/overview` 成功（`linkage.state`/`owner`） | 事实列表照常显示；联动块显示一行 `linkage.reason` |
| 整理批次 | `GET /memory/reflections` 返回 `items` 非空 | 「没有待处理的整理批次」空态 |
| 版本历史 | `/memory/revisions` `items` 非空 | 不渲染该小节 |
| 原始来源 | `/memory/detail` 的 `sources` 非空 | 「来源不可读取」（现状） |
| 冷归档 / 清理 | `archive/preview` 的 `counts.eligible` / `clear/preview` 的 `counts.active` > 0 | 预览 + 一句「当前条件下无可归档事实」（现状已如此） |
| 成长记录 / 依据 | `GET {growth_api}` 与 `/evidence` 非空 | 空态（现状） |
| 状态临时状态（conditions） | `status.state.values.conditions` 非空 | 整块不渲染（现状） |
| 状态回执 / 诊断 | `presentation.results` 非空 | 「尚无 QQ 展示确认」/ 无端口一行 |
| 规划运行记录 | `status.planning.last_result` 存在 | 折叠块不渲染 |
| 服务余额 | `GET /model/balance` → `configured && available` | 「未配置余额来源」，不显示数字 |
| 回复效率 | `data.reply_efficiency` 存在 | 该视图空态（现状渲染空图） |

### 6.6 不设开关（离不开的东西）

对应产品原则「离不开的东西不给开关」。这几项在新 UI 里固定为开，不出现在界面上（后端字段保留，仍可通过旧页/接口改）：

| 字段 | 为什么不给开关 | 建议 |
|---|---|---|
| `memory.enabled` | 关掉 = 完全不记事，而用户看不见后果直到发现角色忘事 | 固定 true，收进高级只读 |
| `memory.automatic_context` | 关掉 = 记忆存了但不进对话，同样是「以为在记其实没用」 | 固定 true |
| `role.state.enabled` | 默认就是 false（新安装状态永远空）；但它同时决定后台模型调用成本 | **保留开关但默认开**；关闭状态在首屏可一键打开 |

> 其余开关全部保留。如果以后发现某项也属于「关了就静默失效」，照此表补入。

### 6.7 需新增的能力探测（现有字段不够用）

本区大部分条件都能用现有字段判定（见 §6.1/6.2）。下面三条判不了，需后端补字段——**补齐之前按保守值显示（宁可多显示，不少功能）**：

| 探测项 | 现有字段为什么不够 | 建议新增 |
|---|---|---|
| 平台能力矩阵（异步：QQ/微信各自支持 poke、表情、在线状态、输入中） | 只能靠 `presentation_diagnostics.reason == "presence_port_missing"` 间接推断 presence；没有一次性「本平台支持什么」的声明（`presence_diagnostics.py:9-13`、`multi_session.py:313-329` 只证明 OneBot 有端口） | `GET /host/capabilities` → `{platform, features:{presence, typing, poke, qq_reaction}}`（与 api 区 §6.3 建议同一口） |
| 日程公开短文案是否可用 | `calendar.presence` 没有自己的能力位，只能借 presence 端口判定（`calendar-editor.js:187`） | `GET /state` 的 `effective` 里增加 `calendar_presence` 一项，或复用 `presentation_diagnostics.custom_status` |
| 群显示名（群目标页签名） | `page/targets` 的 `display_name/group_name` 依赖原生会话观测，微信下常为空；`GroupTarget` 没有名字字段 | `GroupTarget.display_name`（保存群目标时带上） |

---

## 7. 功能完整性清单（新 UI 验收用）

> 口径：**这里每一条都必须在新 UI 里找得到入口**。找不到 = 不通过。表里写「合并到」的，指多个旧入口收成一个新视图，功能不减。

### 7.1 记忆（私聊）

| # | 功能 | 当前入口 | 依赖接口 |
|---|---|---|---|
| M1 | 事实列表（分页预读、按生命周期筛选、关键词搜索、滚动续读） | 事实与经历 → 事实治理 | `GET {memory_api}?limit=&after_id=` |
| M2 | 事实详情（正文、对象、版本、归属、保留方式、置信度、核心记忆标记） | 点事实卡 | `POST {memory_api}/detail` |
| M3 | 事实更正 | 详情表单 | `POST /command`(correct) |
| M4 | 置顶 / 取消置顶 | 详情按钮 | `POST /command`(pin/unpin) |
| M5 | 撤回 | 详情按钮 + 确认 | `POST /command`(retract) |
| M6 | 遗忘 | 详情按钮 + 确认 | `POST /command`(forget) |
| M7 | 版本历史 | 详情内 | `GET /revisions` |
| M8 | 原始来源逐段阅读 | 详情 / 检索结果 | `POST /source` |
| M9 | 记忆概况（事实/经历/来源/批次 + 批次状态分布） | 事实治理首屏 | `GET /overview` |
| M10 | 外部记忆插件联动摘要 | 事实治理首屏 | `GET /overview` → `linkage` + `GET /page/ownership` |
| M11 | 生命周期分布（语料比例带） | 事实治理首屏 | 本地派生自事实列表 |
| M12 | 整理批次列表（待处理 / 全部，分页） | 整理与修复 | `GET /reflections?history=&limit=&after_id=` |
| M13 | 整理批次详情（六阶段、摘要、剩余/暂缓/不可用来源、回执、待处理原因、修复来源） | 点批次 | `GET /reflections?batch_id=` |
| M14 | 修复未完成项（同步执行） | 批次详情 | `POST /reflections/retry` |
| M15 | 后台继续整理（登记 + 轮询） | 批次详情 | `POST /reflections/queue` |
| M16 | 未确认提交的恢复与核对 | 页内常驻提示条 | 重放原 `operation_key` |
| M17 | 检索（事实/原始来源/共同经历/混合 + 游标续读） | 来源与经历 | `POST /query` |
| M18 | 冷归档预览 / 执行 / 移回 | 冷归档 | `/archive/preview`、`/archive`、`/archive/restore` |
| M19 | 导出记忆包（含归档勾选、复制、下载） | 迁移 | `GET /export` |
| M20 | 导入记忆包（校验 → 确认 / 放弃） | 迁移 | `/import/preview`、`/import` |
| M21 | 范围清理（预览 → 确认） | 范围清理 | `/clear/preview`、`/clear` |
| M22 | 记忆策略 30 字段（4 组，含继承与恢复继承） | 记忆策略页签 | `GET /settings`、`POST /settings/command` |
| M23 | 记忆归属说明 | 事实与经历页头 | `GET /page/ownership` |

**合并建议**：M9/M10/M11 合成一条「概况行」；M17 并入事实页的搜索框（保留「资料类型」下拉）；M18/M19/M20/M21 收进「维护」抽屉（仍可全部操作）。

### 7.2 记忆（群）与学习

| # | 功能 | 当前入口 | 依赖接口 |
|---|---|---|---|
| G1 | 群公共记忆列表 | 群工作区 | `GET {group_memory_api}` |
| G2 | 群陈述详情 + 原文 | 同上 | `POST /group-memory/detail` |
| G3 | 群陈述撤回（管理员） | 同上 | `POST /group-memory/retract` |
| G4 | 操作回执 | 同上 | `GET /group-memory/operation` |
| G5 | 群成员安全线索 + 复核 | 同上 | `GET /group-memory/safety`、`POST /safety/review` |
| L1 | 成长记录列表（分页） | 学习 → 成长链路 | `GET {growth_api}` |
| L2 | 记录详情（标题/描述/进展/提出与确认人/时间/来源数） | 右栏 | 同列表响应 |
| L3 | 后端下发动作（确认/继续/暂停/已完成/归档/撤回） | 详情按钮组 | `POST /growth/command` |
| L4 | 修订（标题/描述/进展） | 右下表单 | `POST /growth/command`(revise) |
| L5 | 依据原文 | 左下栏 | `GET /growth/evidence` |
| L6 | 读取/提出权限开关 | 页面顶部 | `POST /growth/command`(configure) |
| L7 | 待审阅进展裁决（采纳/不采纳） | 轨道视图（不可达）/ 审阅中心 | `GET /growth/progress`、`POST /progress/command` |
| L8 | 按阶段/类型筛选 | 轨道视图（不可达） | `GET` 带 `state`/`kind` |
| L9 | 来源不可读的识别与提示 | 卡片/详情 | 响应中的 `unavailable_reason` |
| L10 | 成长策略（启用、自定义技能域、日程参考强度） | 学习 → 角色策略 | `/config/configure` |
| L11 | 提出成长建议（后端能力已存在，**目前无 UI 入口**） | 无 | `POST /growth/command`(propose)，需外部签发的 ScopeRef/VersionRef |

**合并建议**：L1–L9 与「审阅中心」「学习总览」的成长部分合成一个视图（L7/L8 保留为筛选与收件箱），成长策略留在设置。

### 7.3 状态

| # | 功能 | 当前入口 | 依赖接口 |
|---|---|---|---|
| S1 | 状态看板 8 图块（能量/健康/饥饿/睡眠/生理期/心情/忙碌/位置） | 状态页 | `GET /state` |
| S2 | 临时状态列表（conditions） | 状态页底部 | `GET /state` |
| S3 | 环境卡（QQ 状态/日程配置/天气/时间与日期） | 状态页 | `GET /state` |
| S4 | 立即更新（后台维护）+ 待确认恢复 | 页头 | `POST /state/command`(maintain) |
| S5 | 状态设置弹窗（维护开关/间隔、8 个模拟开关、8 个首页展示、5 个特殊展示策略） | 页头齿轮 | `POST /state/command`(configure) |
| S6 | 能量：表达强度 + 精力引导 | 能量子页 | `configure`(intensity) |
| S7 | 健康 / 饥饿：模拟开关 + 表达引导 | 对应子页 | `configure`(health/hunger) |
| S8 | 心情：开关 + 概率/幅度/半衰期 | 心情子页 | `configure`(mood) |
| S9 | 生理期：方案（6 字段 + 阶段时长 + 不适模拟） | 生理期子页 | `configure`(cycle) |
| S10 | 生理期：阶段表达（6 阶段 × 精力/氛围词/引导 + 整体偏好） | 生理期子页第 2 页签 | `configure`(cycle) |
| S11 | 生理期校准（cycle.align，4 种方式） | 生理期子页 | `POST /state/command`(cycle.align) |
| S12 | 日程：模式选择、自动规划开关、范围参数、年度日历（结构化 + 原始 JSON）、规划偏好 | 日程子页 | `configure`(planning) |
| S13 | 规划运行记录 | 日程子页折叠 | `GET /state` → `planning` |
| S14 | 日程条目：创建 / 改整组 / 仅改本次 / 取消 / 安排提醒 / 公开短文案 | 日程子页 | `calendar.create/revise/exception/cancel/remind/presence` |
| S15 | 睡眠：作息概览 + 下次入睡/执行详情 | 睡眠子页 | `GET /state` → `sleep_schedule`、`body_sleep` |
| S16 | 天气：开关、地点（含坐标/预警区域折叠）、信息时效 | 天气子页 | `configure`(weather) |
| S17 | 天气实况读取 | 天气子页 / 感知页 | `GET /state/weather?refresh=` |
| S18 | 时间与日期（时区、当地时间） | 时间子页 | `configure`(datetime) |
| S19 | 每日巡视（开关、时刻、保留天数） | 状态页图块 / 治理与维护 | `configure`(patrol) |
| S20 | QQ 展示：三通道开关、刷新间隔、诊断状态 | QQ 状态子页 | `configure_window` |
| S21 | QQ 展示回执（平台受理/拒绝/未发送/未知） | QQ 状态子页 | `GET /state` → `presentation` |
| S22 | 联系安排（`section='contact'`） | 主动联系页 | 同状态页组件 |
| S23 | 全局搜索定位到字段（`openEditor`） | 全局搜索 | — |
| S24 | 深链接 `#life/state/<feature>` | 侧栏/刷新 | — |
| S25 | 忙碌 / 位置的只读详情（含「为什么不能直接编辑」说明） | 忙碌/位置子页 | 同 `GET /state` |
| S26 | 跨页跳转：睡眠→日记与生活、睡眠/忙碌回复→开口闸门、天气→感知、日期→感知、日程→生活挂历 | 各子页链接 | — |

**合并建议**：S6–S12 的「编辑表单」全部收进同一个详情面板的表单区（现在每种 kind 一套壳）；S9/S10 的两层页签拍平为「方案 / 阶段」两个分段控件；S13/S14 的折叠块合并成「日程与运行」。

### 7.4 治理与维护

| # | 功能 | 当前入口 | 依赖接口 |
|---|---|---|---|
| W1 | Token 统计（11 来源 × 4 周期 + 自定义日） | 维护 → Token | `GET /model/maintenance` |
| W2 | 预算（硬限额 + 后台软限额 + 触发状态） | Token 页 | 同上 `budget` |
| W3 | 服务余额 | Token 页 | `GET /model/balance` |
| W4 | Provider / 任务排行、组合图、缓存带、最近预览、明细表、历史 | Token 页 | 同上 |
| W5 | 导出 CSV | Token 页 | 前端生成 |
| W6 | 排障信号（12 分类 × 4 严重度 + 分类计数/证据） | 排障 | `GET /model/maintenance` |
| W7 | 运行快照（7 项） | 排障 | 同上 `runtime` |
| W8 | 模型任务路由审计 | 排障折叠 | `GET /model` |
| W9 | 事件时间线 | 排障 | 同上 |
| W10 | 操作回执（operations） | 排障 | 同上 |
| W11 | 主动联系真实投递测试（15 个目的） | 排障 → 按需检测 | `POST /setup/proactive-diagnostic` |
| W12 | 进程内存采样（19 样本 / 3 分钟） | 排障 → 按需检测 | `GET /model/memory` |
| W13 | 集成检测（Provider / TTS / 图像工具 / SQLite） | 排障 → 按需检测 | `/model/test`、`/voice/test`、`/image/test`、`/test/storage` |
| W14 | 诊断说明与常见问题 | 排障折叠 | 前端静态 |
| W15 | 清除本次诊断结果 | 排障 | 本地状态 |
| W16 | 缓存诊断（命中率、缓存量、zipper、按 Provider、低命中样本、时间范围） | 缓存诊断 | `GET /model/maintenance` |
| W17 | 回复效率（近 7 日核心与投递耗时） | 回复效率 | 同上 `reply_efficiency` |
| W18 | 最近调用（搜索、失败/未确认/低命中筛选、时长聚焦、查看更多） | 最近调用 | 同上 `recent` |
| W19 | 任务提示词（6 组 ~25 任务：编辑、预览、校验、冲突提示、恢复原保存） | 任务提示词 | `GET /model`、`POST /model/configure` |
| W20 | 每日巡视入口 | 维护二级页 | 复用 S19 |

**合并建议**：W1–W5 一屏；W6–W15 拆成「诊断（只读）」与「测试（有副作用）」两块，后者加确认；W16/W17/W18 收进「高级诊断」折叠；W19 保留但按任务分组折叠；W20 保留入口（跳转到状态页，不再复制整页）。

### 7.5 明确不做的事

| 不做 | 原因 |
|---|---|
| 删除任何设置字段或后端路由 | 本轮是兼容 + 重构；以后接 QQ 要用 |
| 把「高级」里的项目从路由里摘掉 | 折叠只是前端呈现，读写接口必须仍然可达 |
| 用平台名硬编码判断 | 微信/QQ 官方/OneBot 的取值由适配器声明，改用能力/端口/字段判断 |

---

## 8. 给新 UI 的建议

### 8.1 一句话结论

这四域的共同问题是**「把后端的目录结构画到了屏幕上」**：6 个记忆区域、85 个状态字段、6 个维护视图、8 个学习页签，每一个都对应后端的某个模块，而不是对应「用户想做什么」。新 UI 按**用户动作**分屏，其余能力收进条目旁的「高级」，由 §6 的条件决定是否出现。

### 8.2 记忆：两屏（六个区域收成两个）

**第一屏 · 记忆**（默认）
```
她记住了什么                          [搜索框] [资料类型]
────────────────────────────────────────────
[全部 24]  [有效 18]  [已忘 6]
────────────────────────────────────────────
· 你讨厌香菜                          核心   ·
· 周三晚上要去练琴                          ·
· 妈妈说家里猫叫团子                        ·
────────────────────────────────────────────
24 条事实 · 18 条有效 · 最近整理今天 23:50      ← 概况行（原 M9/M10/M11 合一）
[维护 ▾]                                      ← 归档 / 迁移 / 清理 / 整理批次
```
「维护」抽屉里：整理批次列表（原 M12–M16）、冷归档（M18）、迁移（M19/M20）、范围清理（M21）。这些仍然全部可操作，只是不再与主线并列。

**第二屏 · 设置**：`每天整理` + `时间` / `群聊经历` / `私聊经历` / `习惯学习` 四个开关 + `高级`（其余 22 个阈值）。开关关闭时其详细项收起（§6.4）。

群目标时同一屏切换为「群公共记忆」（G1–G5），私聊目标时是事实流 —— 一个「记忆」概念，一个入口（§4.4）。

### 8.3 学习：一屏

```
学习与成长
────────────────────────────────────────────
培育中 (3)          等你确认 (1)              ← 后者就是原「待审阅」
· 会弹《小星星》  ·   · 学会做番茄炒蛋
· 每天读 10 页     ·        [确认] [不看]
· 记住你的口味
────────────────────────────────────────────
已达成 (5)  已归档 (2)                        ← 折叠
```
每条卡片：名字 + 一句进展 + 一个主按钮；点开才有提出人/时间/依据/修订。权限开关移到设置（保留 L6 功能）。原轨道/待审阅/来源三个不可达视图与「审阅中心」「总览」的成长部分合并到这一屏，L7/L8 成为「等你确认」与筛选。

### 8.4 状态：一屏 + 一个弹窗

```
小鲸鱼此刻
────────────────────────────────────────────
能量 62    健康 良好   饥饿 有点饿   心情 平静
────────────────────────────────────────────
今天 09:00–12:00  在看书
下次自动更新 22:40                [现在更新]
────────────────────────────────────────────
[状态设置]  [日程]  [QQ 展示]  [高级]
```
- 四个常用读数 + 今日安排 + 更新按钮 = 首屏。
- 点任一项展开只读卡片（当前值 + 一个控件）；编辑仍在卡片内。
- `[日程]` `[QQ 展示]` 是两个独立入口（第 3、4 项在 §6.1 条件不满足时显示为「当前平台不支持」并保留入口）；`[高级]` 里放生理期（34 项）、规划参数、年度日历、巡视、夏令时。
- 85 字段里的 ~70 个进「高级」，一个不少。

### 8.5 维护：一屏 + 一个诊断抽屉

```
运行状况
────────────────────────────────────────────
今天  128 次调用 · US$0.42 · 预算余 38%
最近异常  2 条                            [查看]
────────────────────────────────────────────
[模型用量] [提示词] [诊断 ▾]
```
「诊断」抽屉里：排障信号（W6–W10）、缓存（W16）、效率（W17）、最近调用（W18）、按需检测（W11–W13，**真发消息与计费调用单独一段并二次确认**）。
Token 统计的 11 个来源按 `installed` 条件渲染（§6.2）；未安装的不出现，装了但无统计的只显示一行原因。
W20 每日巡视保留为跳转入口，不再复制整页。

### 8.6 五个跨页面的结构建议

1. **一个选择器**：会话对象/角色只在外壳出现一次（群/私聊切换保留），页内不再重复（现在 3 套）。
2. **一套保存模型**：统一成「点即生效 + 底部一行撤销」（事实与成长动作已是这个模型），配置类（记忆策略、状态、提示词）保留显式保存；现在五种并存。
3. **一个桥接层**：`bounded/api/whenBridgeReady/错误码` 抽成共享模块，三份拷贝合一（§4.9）。
4. **一套条件判断**：把 §6 的四类条件抽成一个 `capability()` 模块（平台端口 / 扩展 manifest / 作用域 / 开关），页面只声明「我需要什么」，不要各自判断。
5. **「高级」是可逆的**：折叠状态存本地，展开后 100% 等于旧页面的能力；验收时用 §7 逐条对照。

---

## 附：条件字段速查

| 判断什么 | 取哪个接口的哪个字段 |
|---|---|
| 平台 | `GET /page/targets` → `target.platform_id` / `target.platform_name` |
| 是否群/私聊 | `GET /page/targets` → `target.scope_kind` |
| 私有域是否可用 | 同响应 → `role.memory_api` / `state_api` / `growth_api` / `life_api` / `config_api` 是否为 null |
| 群记忆是否可用 | 同响应 → `role.group_memory_api` 是否为 null |
| 扩展是否启用 | `GET /integration/manifest` → `extensions[].desired_state` / `assembled` / `integration_state` |
| QQ 展示端口 | `GET /state` → `presentation_diagnostics.{typing,custom_status,online_status}.reason` / `state` |
| 是否有真实回执 | `GET /state` → `presentation.state !== "preview"` |
| 状态各项是否开启 | `GET /state` → `settings.*`、`effective.*.allowed` |
| Token 来源是否可用 | `GET /model/maintenance` → `external_token_sources[key].installed` / `available` / `reason` |
| 外部记忆是否接管 | `GET /page/ownership` → `owner` / `reason`；`GET /memory/overview` → `linkage.state` |
| 任务/提示词是否存在 | `GET /model` → `tasks[]` |
| 余额是否配置 | `GET /model/balance` → `configured` / `available` |

## 附：新 UI 仍需接的后端接口（功能全覆盖）

| 用途 | 接口 |
|---|---|
| 目标与角色目录 | `GET /page/targets` |
| 记忆归属 | `GET /page/ownership` |
| 事实：列表/详情/更正/置顶/撤回/遗忘/来源/版本 | `GET/POST {memory_api}`、`/detail`、`/command`、`/source`、`/revisions` |
| 记忆概况 | `GET /memory/overview` |
| 整理批次与修复 | `GET /memory/reflections`、`POST /reflections/retry`、`/reflections/queue` |
| 检索 | `POST /memory/query` |
| 归档 | `/memory/archive/preview`、`/archive`、`/archive/restore` |
| 迁移 | `/memory/export`、`/import/preview`、`/import` |
| 范围清理 | `/memory/clear/preview`、`/clear` |
| 记忆策略 | `GET /memory/settings`、`POST /memory/settings/command` |
| 群公共记忆 | `GET {group_memory_api}`、`/detail`、`/retract`、`/operation`、`/safety`、`/safety/review` |
| 成长 | `GET {growth_api}`、`/progress`、`/evidence`、`POST /growth/command`、`/progress/command` |
| 成长策略 | `/config/configure`（`role.growth.skills`） |
| 状态 | `GET /state`、`GET /state/weather`、`POST /state/command`（configure/configure_role/configure_window/maintain/cycle.align/calendar.*） |
| 扩展清单（条件判断） | `GET /integration/manifest` |
| 用量与余额 | `GET /model/maintenance`、`GET /model/balance` |
| 诊断与测试 | `GET /model`、`GET /model/memory`、`POST /model/test`、`/voice/test`、`/image/test`、`/test/storage`、`/setup/proactive-diagnostic` |
| 提示词 | `GET /model`、`POST /model/configure` |
| 逐字段搜索定位 | 复用上述 settings/state/model 响应的字段名（`memory-settings-section.searchEntries`、`state-maintenance.searchEntries`） |
