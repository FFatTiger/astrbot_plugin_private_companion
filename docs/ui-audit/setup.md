# setup 区域审计（开始使用 / 初始化引导 / 旧版迁移）

范围：`pages/陪伴小屋/setup-guide.js`（4720 行）、`setup-guide.css`（2398 行，纯样式）、`role-profile-draft.js`（668 行）、`astrbot_host/setup_api.py`（1377 行）、`astrbot_host/upgrade_setup.py`（107 行）、`astrbot_host/setup_state.py`（进度存储）。
行号均基于 wechat 分支（上游 2e29e3f）当前工作区文件。

---

## 1. 页面/视图清单

setup-guide.js 是一个**双模式组件**：普通模式（首次引导）和迁移模式（`mount()` vs `mountMigration()`，setup-guide.js:4545/4653）。

| # | 视图 | 入口路径 | 用途 | 主要组件/函数 |
|---|------|---------|------|--------------|
| 1 | 开始使用（8 步向导） | 侧栏「管理 → 开始使用」（app.js:1233 `page('setup')`，挂载 app.js:4276 → `#setupGuideHost`） | 首次初始化：绑定→模型→档案→关系→主动→日程→群聊→主动测试 | `render()`(3179)、`renderRail`(614 分组进度树)、`stageBanner`(121) |
| 2 | 绑定步（binding） | 向导第 1 步 | 在管理员私聊发「我会永远陪着你」绑定核心窗口 | `renderBinding`(2864) |
| 3 | 模型步（model） | 向导第 2 步 | 选初始 Provider + 配任务模型路由 | `renderModel`(2938) |
| 4 | 世界知识步（knowledge） | 向导第 3 步 | 从 AstrBot 人格生成角色档案草稿并勾选保存 | `renderSection`(2900) |
| 5 | 关系教学步（relationships） | 向导第 4 步 | 从人格生成熟人卡（relationship_profile）草稿 | `renderSection`(2900) |
| 6 | 主动功能步（proactive） | 向导第 5 步 | 内嵌 proactive.contact 配置组（master/rhythm/quiet/greeting） | `renderSettingsStep`(105)+`STEP_EDITORS`(76) |
| 7 | 日程与观察步（life） | 向导第 6 步 | 内嵌 life 配置组（routine/sleep） | 同上 |
| 8 | 群聊配置步（group） | 向导第 7 步 | 内嵌 group_participation 配置组（atmosphere/denoise/interjection） | 同上 |
| 9 | 主动消息测试步（proactive_test） | 向导第 8 步 | 真实投递一次主动消息给管理员私聊并确认回执 | `renderProactiveTest`(2967)、`watchProactive`(3311 轮询) |
| 10 | 开始使用完成页 | ready 后自动替换向导 | 一页式 6 区配置清单（编号列表） | `renderStartGuide`(3110) |
| 11 | 快速配置面板 | 完成页「快速配置」按钮 / 向导 prepared 后（`data-setup-action="advanced-open"`） | 6 个 tab 内嵌其他页面的编辑器 | `renderAdvanced`(405)、`ADVANCED_BLOCKS`(129) |
| 12 | 升级卡 | 完成页/向导顶部自动出现 | 识别旧版配置 → 一键接续 | `upgradeCard`(3009)、`promptUpgradeAtStartup`(292，产品页启动即弹全局确认框 app.js:448) |
| 13 | 旧版迁移四步向导 | 「管理 → 资料与维护 → 旧版资料迁入」（`#legacyMigrationWorkspace`，app.js:952/4301） | 旧版(V1)配置+资料迁入 V2：设置角色→核对→迁移→完成 | `mountMigration`、`legacyPanel`(2547)、`MIGRATION_STEPS`(11) |
| 14 | 逐项迁移页（manual） | 迁移向导第 2 步「需要逐项处理？」（`data-setup-legacy-wizard="manual"`） | 完整逐项能力：人格/群/记忆映射 + 资料勾选 + 手动导入 | `legacyManualOpen` 分支（legacyPanel 内 2796 附近） |
| 15 | 迁移内嵌设置页 | 配置对照审计项「去设置」按钮（`data-setup-legacy-settings`） | 在迁移流程内挂 ModelsPage/ConfigEditors 改目标设置 | `legacySettingsMarkup`(2512)/`mountLegacySettings`(2530 附近) |
| 16 | 角色档案草稿弹窗（全局 dialog） | 「生活 → 角色自述」画布的「从当前人格整理角色档案」按钮（app.js:3620） | 与向导第 3/4 步同一能力的角色级版本 | role-profile-draft.js 全文件，挂在 document 级 |

## 2. 设置项清单

后端 setup API（PREFIX `/api/plug/astrbot_plugin_private_companion/setup`，setup_api.py:31，共 16 条路由，setup_api.py:213-230）：

| 设置键（后端字段） | 界面标签 | 所在页面/分区 | 读写 API | 层级 | 默认值 | 平台 | 备注 |
|---|---|---|---|---|---|---|---|
| `binding`（platform_id+account_id+participant_id+persona_id） | 核心管理员窗口 | 向导 binding 步 | GET `/setup/status`（binding 字段）；POST `/setup/binding/confirm` | 安装 | 无 | all | 绑定指令「我会永远陪着你」（可带人格名），候选存 binding_store |
| `model.provider_id` | 初始主 Provider / 陪伴通用模型 | 向导 model 步 + 快速配置 runtime 块 | POST `/setup/model` {provider_id}；GET `/setup/status`（model.providers） | 安装（宿主插件配置，非 V2 注册表） | 空 | all | setup_api.py:491-536 写 `config["model"]["provider_id"]` 并清 additional_providers/fallback 中同名项——跨存储写入 |
| 模型任务路由 `{kind}.provider/fallback` | 任务模型路由（对话回复/主动联系/…17 种） | 向导 model 步 + 快速配置 runtime 块 | **前端实际走** GET `{role.model_api}` + POST `{model_api}/configure`（setup-guide.js:475-481,3285）；后端另提供 GET `/setup/model-tasks`、POST `/setup/model-tasks/configure`（setup_api.py:218-220）**前端从未调用（死路由）** | 角色 | 跟随通用模型 | all | 快速配置块只列 4 个 kind（proactive.compose/calendar.plan/role.state.maintain/role.self_review，setup-guide.js:427）；向导步列全部 |
| `role_profile.*`（45 字段：name/species/birthday/…，PROFILE_LABELS setup-guide.js:742-773） | 角色设定/角色档案草稿 | 向导 knowledge 步；快速配置 relationships 块；角色档案草稿弹窗 | 向导：GET `/setup/profile`、POST `/setup/profile-draft`、POST `/setup/profile/save`；弹窗：POST `{persona_api}/profile-draft` + POST `{config_api}/configure`；快速配置：ConfigEditors 走 `{config_api}` | 角色 | 空 | all | 三处入口、三套 API 写同一数据；总限 30000 字 |
| `relationship_profile.*`（default_nickname/user_gender/…13 字段） | 熟人卡/相处资料 | 同上三处 | 同上（target=relationship_profile） | 角色×窗口（私聊关系） | 空 | all | 总限 3000 字 |
| `proactive.contact` 组（enabled/rhythm/quiet/greeting 分区） | 主动联系 | 向导 proactive 步；快速配置 action 块 | ConfigEditors → `{config_api}`（role 层 configure） | 角色/窗口 | 见主动联系页审计 | all | 与「主动联系」页面完全重复 |
| `life` 组（routine/sleep） | 日程与作息 | 向导 life 步；快速配置 life 块 | 同上 ConfigEditors | 角色 | 见日程页审计 | all | 与「日程」页面重复 |
| `group_participation` 组（atmosphere/denoise/interjection） | 群聊参与 | 向导 group 步；快速配置 group 块 | 同上 ConfigEditors | 群角色 | 见决策页审计 | all | 与「群聊决策」页面重复 |
| setup 进度 `completed[]/skipped[]/ready/proactive_test` | 步骤完成状态 | 向导各步「已完成这部分/暂时跳过」 | POST `/setup/complete` {step, skipped}；GET `/setup/status` | 安装 | 空/[] | all | SETUP_STEPS 仅 6 步（setup_state.py:12），binding/proactive_test 独立判定 |
| 主动测试回执 `proactive_test.attempt_id/state` | 主动消息测试 | 向导第 8 步 | POST `/setup/proactive-test` {enable_proactive:true}；POST `/setup/proactive-test/confirm` {attempt_id} | 安装 | null | all | 测试会临时把 contact `enabled` 置 true，结束自动恢复（setup_api.py:1250-1269,1355-1377） |
| 宿主重连 | 重新连接 | 完成页（accepting=false 时） | POST `/setup/host/start` | 安装 | — | all | |
| 升级接续 `upgrade.plan_token` | 确认并接续旧版配置 | 升级卡 + 启动弹窗 | GET `/setup/status`（upgrade 块，来自 upgrade_setup.py:22 plan()）；POST `/setup/upgrade` {confirmed, plan_token} | 安装 | — | all | prepare 成功后自动写绑定（upgrade_setup.py:77-91）并跳迁移页 |
| 迁移配置范围 `configuration_scope` | 迁移配置范围（plugin/proactive/reality/all） | 迁移第 3 步「更多迁移选项」+ 逐项迁移 | GET `{legacy_api}/plan?configuration_scope=`、POST `{legacy_api}/apply` | 安装 | plugin | all | legacyConfigScopeMarkup(1984) |
| 旧版数据目录 `v1_root` | 旧版数据目录（可选） | 迁移页状态条「手动指定来源」 | 所有 legacy GET/POST 的 query 参数 | 安装 | 留空自动查找 | all | |
| 资料导入开关 `import_reactions/import_worldbook/import_private_contacts/import_journals/import_expressions/import_reference_images/import_wardrobe_items/import_memory_database/import_archive/import_group_network` | 表情素材/世界书条目/私聊用户与权限/日记与梦境/已学表达/参考图库/衣柜/独立记忆库/原始资料归档/群成员互动图 | 逐项迁移「导入与保留范围」+ 群资料映射 + 记忆身份映射 | POST `{legacy_api}/data-apply`（请求体字段，setup-guide.js:3480-3510） | 安装 | reactions/contacts/memory/archive=true，其余 false | all | 还有逐人格目的地版本（destination.include_*，3583-3600） |
| 写入前确认 `confirm_member_ids/confirm_persona_mapping/confirm_expression_mapping/confirm_reference_persona_mapping/confirm_memory_mapping/confirm_group_mapping` | 「确认成员账号映射一致」等 6 个确认复选框 | 逐项迁移「写入前确认」fieldset | 同 data-apply 请求体 | 安装 | false | all | |
| 迁移方式 `legacyConfigSkipped` | 沿用旧版配置 / 保留当前配置（radio） | 迁移第 3 步 | 决定是否执行 legacy-plan/apply | 安装 | inherit | all | |
| 新建角色 `role_id + persona_ids[]` | 伴侣角色名 + AstrBot 人格（多选） | 迁移第 1 步「新建角色」 | POST `accounts/role`（宿主账号 API，setup-guide.js:905） | 安装 | — | all | |
| `proactive_opt_in` | 「我同意…发送一次主动联系测试」 | 向导第 8 步 | 纯前端门槛变量 | 无 | false | all | 不落库 |
| `profileOverwrite/profileSelected/profileSupplement` | 覆盖已有字段/字段勾选/补充已确认的角色事实 | 向导第 3/4 步 | 前端草稿状态 | 无 | — | all | supplement 随 profile-draft 请求提交 |

## 3. 操作清单

**普通模式**（act()，setup-guide.js:3711）：

| 按钮/动作 | API | 效果 |
|---|---|---|
| 我已发送，检查绑定（refresh） | GET `/setup/status` | 刷新绑定候选 |
| 确认此窗口 | POST `/setup/binding/confirm` | 确认核心管理员窗口 |
| 初始化并载入（save-model） | POST `/setup/model` | 写宿主插件配置 + initialize_profile |
| 保存路由 save-task:{kind} | POST `{model_api}/configure` | 保存单个任务路由 |
| 从人格生成…/重新生成（generate-profile） | POST `/setup/profile-draft`（bridge，120s 超时） | 生成档案/熟人卡草稿 |
| 保存所选…（save-profile） | POST `/setup/profile/save` | 勾选字段写入（带 edit_token） |
| 已完成这部分 / 暂时跳过 | POST `/setup/complete` | 记录 completed/skipped；非 model 步会自动补 initialize_profile |
| 运行主动联系测试 / 重新运行 | POST `/setup/proactive-test` | 真实投递一次（临时开 enabled） |
| 已收到测试消息 | POST `/setup/proactive-test/confirm` | 确认回执 → ready |
| 重新连接 | POST `/setup/host/start` | 重启 V2 宿主 |
| 确认并接续旧版配置 / 接续配置并继续 | POST `/setup/upgrade` | 应用旧绑定 → 跳 `manage/data/migration`（continueUpgrade:334） |
| 去迁移页/继续迁移/查看迁移记录（open-migration） | — | `window.navigate("manage","data","migration")` |
| 进入陪伴小屋 | — | `data-go="life"` |
| 死分支：`action==="prepare"` | POST `/setup/prepare` | **无任何 UI 按钮触发**（setup-guide.js:3730） |

**迁移模式**（runLegacy()，setup-guide.js:3336；全部走 `{legacy_api}` 角色路由 + migrationRequest 300s 超时/世代守卫）：

| 动作 | API | 说明 |
|---|---|---|
| legacy-scan | GET `{legacy_api}` | 只读检查旧版来源 |
| legacy-plan | GET `{legacy_api}/plan` | 试算配置差异（plan_token） |
| legacy-apply | POST `{legacy_api}/apply` | 写入配置（支持 selected_fields 逐项） |
| legacy-auto | POST `{legacy_api}/auto` | 立即继承旧版配置（升级卡） |
| legacy-upgrade-confirm | POST `{legacy_api}/upgrade-confirm` | 记录重载后核对 |
| 读取迁移范围 scope | GET `{legacy_api}/scope` | personas/groups/review |
| 一键迁移 batch | POST `{legacy_api}/batch-apply` | 自动项写入、需确认项回执 |
| legacy-data-plan / data-apply | GET/POST `{legacy_api}/data-plan` / `/data-apply` | 资料清单试算 + 导入 |
| legacy-data-batch-plan / batch-apply | 同上（逐人格目的地循环） | 多角色映射导入 |
| legacy-group-data-plan / group-data-apply | GET `{legacy_group_data_api}/plan`、POST `/apply` | 群资料映射导入 |
| legacy-private-memory-plan / apply | GET/POST `{legacy_api}/private-memory-plan` / `/private-memory-apply` | 本体私聊记忆 |
| legacy-archived-work | GET `{legacy_api}/archived-work` | 查看归档 |
| save-role | POST `accounts/role` | 新建接收角色 |

## 4. 重复与冲突

### 同一设置多处可编辑（跨页面，详见 items.json 逐条）
1. **`model.provider_id`**：向导 model 步、快速配置 runtime 块（仅 step=model 时可改，否则只读展示）、「模型与连接」页（CompanionModelsPage，也被 mountLegacySettings:2530 嵌进迁移流程）→ 4 处。
2. **模型任务路由**：向导 model 步（全部任务）、快速配置 runtime 块（4 个任务）、模型与连接页 → 3 处。
3. **`role_profile`/`relationship_profile`**：向导第 3/4 步（走 `/setup/profile*` 三条 API）、快速配置 relationships 块（ConfigEditors journal 视图）、角色档案草稿弹窗（走 `{persona_api}/profile-draft`+`{config_api}/configure`）、角色资料页面（其他区域）→ **同一数据 3 套写入口、两套后端 API**。
4. **`proactive.contact`**：向导 proactive 步、快速配置 action 块、主动联系页（contact-page，另调 `setup/proactive-diagnostic`）→ 3 处。
5. **`life`**：向导 life 步、快速配置 life 块（还嵌 CompanionStatePage planning 视图）、日程页 → 3 处。
6. **`group_participation`**：向导 group 步、快速配置 group 块（还嵌 CompanionReplyPage decision 视图）、群聊决策页 → 3 处。
7. **回复分段**：快速配置 understanding 块挂 `CompanionReplyPage`（expression-text/segment 视图，setup-guide.js:494）→ 与回复页同组件重复入口。
8. **世界知识**：快速配置 relationships 块的 knowledge 编辑器（import/inject）→ 与知识页重复。
9. **旧版迁移**：迁移页（mountMigration）内嵌 legacySettingsMarkup 再挂 ModelsPage/ConfigEditors —— 迁移流程里出现第 3 层设置编辑入口。
10. **升级入口**：启动全局弹窗（promptUpgradeAtStartup，app.js:448）+ 开始使用页升级卡 + 迁移页 legacyInstallNotice —— 3 处讲同一件事。
11. **`/setup/status` 的 host 状态**：向导 connectionDiagnostic/accepting 展示，与宿主状态页重复。

### 同一概念不同叫法
- 「核心管理员窗口」=「绑定私聊」=「本体绑定」=「管理员私聊」；指令文案「我会永远陪着你」同时是页头 kicker。
- 「伴侣角色」「当前角色」「接收角色」「伴侣小屋角色」混用（legacyRoleCardMarkup vs 账号与会话页）。
- 「世界知识」（向导第 3 步标题）vs「世界书条目」（迁移资料）vs「世界与相册素材」（legacySources）指不同数据但命名接近。
- 「当前版本」=V2、「旧版」=V1（legacyDisplayText 做了 V1/V2→旧版/当前版本 的文案替换，168 行）。
- 「快速配置」（advancedOpen）实际是 6 大配置区的全量复刻，名不副实。

## 5. 交互问题

1. **文件内三套状态机叠加**：8 步向导 + ready 后的开始使用清单 + 快速配置面板 + （同文件）4 步迁移向导 + 逐项迁移页 + 迁移内嵌设置页。setup-guide.js 4720 行中约 3300 行是迁移，普通用户首屏永远用不到。
2. **STEP_META 每步 3 段解释文案**（tag/body/checks，setup-guide.js:31-63）+ stageBanner 渲染（121）+ 步骤内 note + setup-recorded 状态文案 + notice —— 一屏内多层说明文字，违反「不在界面上写解释性提示」原则。proactive_test 的 tag 写「第 5 步」但实际是第 8 步（66 行，文案与 ORDER 脱节的 bug 级不一致）。
3. **保存模型混乱**：向导内 5 种保存路径并存——ConfigEditors（自带保存）、save-profile（edit_token+勾选+覆盖开关）、save-model（直接生效）、save-task（edit_token）、迁移 legacy-apply（plan_token）。还有 page guard 的 saveBeforeLeave/discardChanges（4640-4670）。
4. **迁移向导确认负担极重**：6 个 confirm_* 复选框、逐人格目的地每处最多 10 个勾选 + 3 个确认、radio 选迁移方式、plan_token/scope token 双 token 校验，「试算→确认→导入」要重复走多轮。
5. **大量行内状态提示**：legacyOneClickConfigError/legacyRoleSaveMessage/legacyPersonaBatchError/legacyBatchResult/notice/migrationProgress 至少 8 个并行消息通道，同一时刻可能叠 3 条。
6. **watchProactive 750ms×205 轮询**（3311）无退避；status 是组装大文档（binding+model+host+upgrade+proactive_test），每次都全量拉。
7. **死路由/死分支**：`/setup/model-tasks`、`/setup/model-tasks/configure` 后端存在前端不用；`act("prepare")` 无 UI 入口；`/setup/targets` 仅迁移模式用（loadLegacyAccountCatalog:785）。
8. **快速配置面板 = 全站功能第 2 入口**：ADVANCED_BLOCKS 六块把回复、资料、日程、主动、群聊、模型全部再挂一遍（含挂其他页面组件），与「开始使用」完成页的 6 项列表功能重叠（renderStartGuide 的列表点「展开设置」就是打开同一个 advancedOpen）——同一屏两套导航去同一地方。
9. **术语暴露**：plan_token/edit_token/legacy_api/provider_id/Persona/Provider 混排进中文文案；「人格」「角色」「伴侣角色」三层概念对单角色用户无意义。

## 6. 按条件显示清单（能力驱动，不删功能）

| 功能 | 显示条件（现成判据） | 位置 |
|---|---|---|
| 8 步向导 | `GET /setup/status` 的 `step` 字段（binding→…→proactive_test→complete） | render():3179 |
| 升级卡/启动弹窗 | `status.upgrade.present && !upgrade.configured`（setup_api.py:245-258） | upgradeCard:3009、promptUpgradeAtStartup:292 |
| 迁移页 | 已挂载菜单项，应改为 `upgrade.present \|\| legacyFinding.install.v1_present` 时才出现 | app.js:4301 |
| 初始 Provider 选择器 | `status.step === "model" && !status.ready`（renderQuickModels:428 的 canSetInitialProvider） | renderModel |
| 任务路由 | `status.prepared`（model 已初始化）后 | renderModel/renderQuickModels |
| 第 3/4 步档案草稿 | `status.prepared && GET /setup/profile` 有 role_profile/relationship_profile | loadStepData:3190 |
| 内嵌配置组（proactive/life/group 步） | `state.prepared`，未 prepared 显示「完成模型配置后…」 | renderSettingsStep:105 |
| 快速配置入口 | `state.ready \|\| state.prepared` | onClick advanced-open |
| 重连按钮 | `!status.host.accepting && ready` | renderProactiveTest:2967 |
| 迁移「更多迁移选项」范围 reality/all | 仅旧版 reality.configuration 可读（legacyConfigurationSources:196-200 的 findings） | legacyConfigScopeMarkup:1984 |
| 逐人格多目的地映射 | `data-plan.persona_sources.length > 1`（单人格时整块可收） | renderLegacyPersonaBatch:1629 |
| 群资料映射 | `data-plan.group_networks/worldbook.groups` 非空 | renderLegacyGroupMapping:1750 |
| 记忆身份映射 | `memory_database.record_count > 0` | legacyPanel 记忆 tab |
| OneBot/QQ 相关（bindingFacts 默认「QQ · OneBot」） | 平台来自 binding.platform_id，`product().platformLabel()` 已按平台渲染 | bindingFacts:2851 |
| QQ 官方机器人/wechat_helper 专属能力 | setup 区本身平台无关；由 `/setup/targets` accounts[].platform_id 决定账号列表展示 | api_targets:305 |

## 7. 功能完整性清单（新 UI 验收）

| 功能 | 当前入口 | 依赖接口 |
|---|---|---|
| 核心管理员窗口绑定 | 向导第 1 步 | POST /setup/binding/confirm、GET /setup/status |
| 绑定候选核对（平台/Bot/私聊对象/人格） | 第 1 步 bindingFacts | GET /setup/status.binding |
| 初始文本模型选择 | 第 2 步 | POST /setup/model |
| 任务模型路由配置（17 种任务） | 第 2 步 + 快速配置 | GET/POST `{model_api}`(+`/configure`) |
| 角色档案草稿生成/勾选保存 | 第 3 步 | POST /setup/profile-draft、POST /setup/profile/save、GET /setup/profile |
| 熟人卡草稿生成/保存 | 第 4 步 | 同上（target=relationship_profile） |
| 主动联系常用设置 | 第 5 步 + 快速配置 | `{config_api}`（proactive.contact） |
| 日程与作息设置 | 第 6 步 + 快速配置 | `{config_api}`（life） |
| 群聊参与设置 | 第 7 步 + 快速配置 | `{config_api}`（group_participation） |
| 步骤完成/跳过（进度持久化） | 各步 | POST /setup/complete、GET /setup/status |
| 主动消息真实测试 + 回执确认 | 第 8 步 | POST /setup/proactive-test、/proactive-test/confirm、GET /setup/status 轮询 |
| 主动诊断（指定用途/来源/图片） | **不在 setup 页**：维护页 maintenance-page.js:2135、联系人页 contact-page.js:2274 | POST /setup/proactive-diagnostic |
| 宿主重连 | 完成页 | POST /setup/host/start |
| 完成后一页式配置清单 | 完成页 renderStartGuide | 复用各区 config_api |
| 快速配置 6 区（回复分段/资料/日程/主动/群聊/模型） | 完成页 | CompanionReplyPage/StatePage/ConfigEditors/ModelsPage |
| 旧版升级检测 + 一键接续 | 启动弹窗 + 升级卡 | GET /setup/status（upgrade）、POST /setup/upgrade |
| 迁移：选/建接收角色 | 迁移第 1 步 | GET /setup/targets、GET accounts、POST accounts/role |
| 迁移：只读核对（配置差异/兼容审计/范围） | 第 2 步 | GET `{legacy_api}`、`/plan`、`/scope` |
| 迁移：配置写入（一键/逐项/范围选择） | 第 3 步 + 逐项页 | POST `/apply`、`/auto`、`/batch-apply` |
| 迁移：资料导入（表情/日记/表达/世界书/联系人/参考图/衣柜/记忆库/归档） | 逐项页 | GET/POST `/data-plan`、`/data-apply` |
| 迁移：多人格→多角色批量映射 | 逐项页 personas tab | `/data-plan`+`/data-apply`（逐目的地） |
| 迁移：群资料映射导入 | 逐项页 groups tab | `{legacy_group_data_api}/plan`、`/apply` |
| 迁移：本体私聊记忆 | 逐项页 memory tab | `/private-memory-plan`、`/private-memory-apply` |
| 迁移：历史归档查看 | 逐项页 | GET `/archived-work` |
| 迁移：重载后核对确认 | 升级卡/安装提示 | POST `/upgrade-confirm` |
| 迁移内嵌改设置后返回重试算 | 迁移设置页 | ConfigEditors/ModelsPage + `/plan` |

## 8. 给新 UI 的建议

setup 在新 UI 里应该收缩为**两条流**，不再是一个 4720 行的万能页面：

1. **首次设置流（向导，3 步）**：① 绑定窗口（扫码/发指令+一键确认）② 选模型（通用 Provider 一个选择框；任务路由全部折叠进「高级」，默认跟随通用）③ 完成（主动测试合并为完成页上的一个可选按钮，不再单占一步）。第 3-7 步（档案/关系/主动/日程/群聊）全部删掉——它们与主界面的对应设置页 100% 重复，向导里只是把那些编辑器再嵌一遍；首次用户完成绑定+模型即可用，其余按需在主界面调。`completed/skipped` 进度保留在后端，新 UI 用 `status.step` 只呈现「未绑定/未配模型/完成」三态。
2. **迁移流（独立页面，保持 4 步骨架）**：保留后端全部 legacy 能力（账号/配置/资料/记忆/归档），但 UI 上：确认复选框从 6+10 个收敛为每页一个「我已核对以上映射」；逐项迁移从平铺改为「按发现的问题逐个引导」；文案里 V1/V2/Persona/plan_token 等词不再出现。
3. **删除「快速配置」面板**：它是全站 6 个设置区的第二入口，新 UI 的信息架构里每类设置只有一个家；「开始使用」完成页只留一张静态卡片列表，链接跳转对应设置页。
4. **角色档案草稿统一为全局弹窗**（role-profile-draft.js 已存在且更完善：字段分组/字数预算/断点恢复），向导里的内联草稿版（generateProfileDraft/saveProfileDraft + /setup/profile* 三条 API）不再重复实现；`/setup/profile-draft`、`/setup/profile/save`、`/setup/model-tasks*`、`/setup/prepare` 可在旧 UI 退役后一并清理。
5. 启动升级弹窗保留（唯一的主动拦截点），但升级卡、安装提示、迁移页提示三处文案合并为一个状态源 `status.upgrade`。
