# 工作区审计：日记与生活（life）

范围：`pages/陪伴小屋/workspaces/life/`（index.html 104 行 / app.js 255 行 / style.css 95 行）、`astrbot_host/life_api.py`（92 行）、`companion_v2/role_work/life/`（management.py 428 行、runtime.py 375 行、configuration.py 113 行、coordinator.py 159 行、physiology.py 123 行）。
分支 `wechat`，HEAD `2e29e3f`。方法：只读静态阅读（git 索引干净），未运行页面、未调接口；标注「静态结论」的条目需要在运行时再确认。
`pages/日记与生活/` 是 `tools/sync_framework_page.py`（WORKSPACES，:15）生成的副本，不在此重复审计。

挂载形态：`product-page.js` 用 iframe srcdoc 填 `workspace-bundles/life.js`（product-page.js:938-950、index.html:307、page-build.json:140,153-155），上下文经 postMessage 送 `display.{role_name,subject_name,scope_kind}`（product-page.js:972-978）。`api = role.life_api = /api/plug/.../targets/<id>/roles/<digest>/life`（multi_api.py:182-183）。iframe 内 `bridge.apiGet("life"/"life/command")` 由父页白名单翻译成真实路径（product-page.js:1109-1113 → multi_api.py:339）。

## 1. 视图清单

| 视图 / 分区 / 弹窗 | 怎么进来 | 用途一句话 | 主要组件 | 代码位置 |
|---|---|---|---|---|
| 顶部操作条 | 常驻 | 启动/停止本机 V2、刷新 | `#start-host` `#stop-host` `#refresh` | index.html:13-16；事件 app.js:230,243-244 |
| 范围条 | 常驻 | 角色 / 私聊对象 / 运行状态 / 生活日程 | `#role #participant #host-state #routine-state` | index.html:17-20；渲染 app.js:175-178 |
| 下次日程提示 | 常驻 | 「下次日记 / 下次入睡」一行 | `#next-routines` | index.html:21；app.js:179 |
| 角色共享作息 | 常驻 | 自动睡眠范围、执行窗口、下次入睡/唤醒、当前唤醒 | `#sleep-scope/#sleep-executor/#sleep-next/#sleep-active-wake` | index.html:22-27；app.js:151-166 |
| 睡眠生理指标 | 常驻 | 睡眠压力、欠睡、负荷、推荐时长 | `#sleep-pressure/#sleep-debt/#sleep-workload/#sleep-recommended` | index.html:28-33；app.js:167-172 |
| 通知条 | 操作后 | 成功/失败一句话 | `#notice` | index.html:34；app.js:37 |
| 日程与偏好（折叠） | 点 summary | 13 项生活配置 + 保存 | `<details id="settings">` + `#config-form` | index.html:35-55；app.js:218-219 |
| 日记与梦境（tab，默认） | `data-tab=archive` 或深链接 `#life/diary` | 左目录右详情：日记/梦境全文、余韵、索引、碎片 | `#journal-list`、`#journal-detail`、`#write-diary`、`#newer/#older` | index.html:62-68；app.js:83-108；product-page.js:823 |
| 阅读书架（tab） | `data-tab=reading` | 阅读片段卡片：状态、读后感、开始/取消/撤回 | `#reading-list`、`#add-text` | index.html:69-73；app.js:110-127 |
| 睡眠记录（tab） | `data-tab=sleep` | 睡眠卡片：状态、计划醒来、醒来/梦境/取消 | `#sleep-list`、`#start-sleep` | index.html:74-78；app.js:110-127 |
| 活动分页 | 仅上两个 tab | 下一批 / 回到首批 | `#activity-pages` | index.html:79；app.js:216,250-251 |
| 执行记录（tab） | `data-tab=receipts` | 书写执行回执列表 + 重试失败日记 | `#receipt-list`、`#retry-form` | index.html:80-89；app.js:132-150,228 |
| 编辑弹窗（9 种用途共用） | 各操作按钮 | 正文编辑/恢复、添加原文、睡眠时长、梦境重试 | `<dialog id="editor">` | index.html:91-102；app.js:200-213,220-227 |

数据来源：以上全部来自**一个** `GET life`（app.js:188 → life_api.py:36-49 → management.py:127-186），无第二个读接口。tab 切换不请求接口，只切 `hidden`（app.js:214-217）。

## 2. 设置项 / 数据项

配置字段集合：前端 `configFields` 13 项（app.js:14-15），服务端 `DEFAULTS` 25 项（configuration.py:23-33）；本页**只暴露 13 项**，未暴露 5 项写作偏好 + 8 项休息闸门（见 §4）。层级：`target_for(context)` 用 `ConfigLayer.WINDOW` + 当前私聊 scope（configuration.py:47-48），字段定义同时允许 WINDOW/ROLE 覆盖（configuration.py:39-43），其中 6 个 `sleep_*` 属于角色共享（`is_shared`，configuration.py:96-97，读取时 `sleep_timezone` 缺省回落到 `timezone`，configuration.py:107-116）。

| 字段 | 界面标签 | 位置 | 读（GET life） | 写（POST life/command） | 层级 | 默认值（来源） | 我方需要 | 备注 |
|---|---|---|---|---|---|---|---|---|
| `enabled` | 启用生活日程总开关 | index.html:38 | `config.enabled`（management.py:180） | `configure.changes.enabled` | 窗口 | `False`（configuration.py:24） | 需要 | 同时是 life 授权闸门，见 §3/§4 |
| `diary_enabled` | 每天写日记 | index.html:40 | 同上 | 同上 | 窗口 | `True`（:24） | 需要 | 只登记日程，写不写由模型定（config-editor.js:919） |
| `diary_time` | 日记时间 | index.html:41 | 同上 | 同上 | 窗口 | `23:50`（:24） | 需要 | HH:MM 强校验（configuration.py:55-58） |
| `timezone` | 日记时区 | index.html:39 | 同上 | 同上 | 窗口 | `Asia/Shanghai`（:24） | 需要（可默认隐藏） | IANA 名校验（configuration.py:53） |
| `sleep_enabled` | 按角色作息自动入睡 | index.html:42 | 同上 | 同上 | 角色共享 | `False`（:24） | 需要 | 与角色状态页的「睡眠状态模拟」是两件事 |
| `sleep_time` | 入睡时间 | index.html:43 | 同上 | 同上 | 角色共享 | `00:30`（:25） | 需要 | 实际时刻按浮动算法逐日漂移（scheduling.py） |
| `sleep_timezone` | 入睡时区 | index.html:44 | 同上 | 同上 | 角色共享 | `Asia/Shanghai`（:25） | 可隐藏 | 缺省跟随 `timezone` |
| `sleep_variation_minutes` | 自然浮动上限（分钟） | index.html:45 | 同上 | 同上 | 角色共享 | `20`（:26） | 可进高级 | 0..120（configuration.py:59-60） |
| `sleep_window_minutes` | 入睡观察窗口（分钟） | index.html:47 | 同上 | 同上 | 角色共享 | `120`（:26） | 可进高级 | 0..360（configuration.py:61-62） |
| `sleep_minutes` | 睡眠时长（分钟） | index.html:48；弹窗 `#minutes` 默认值 app.js:211 | 同上 | 同上 | 角色共享 | `480`（:26） | 需要 | 弹窗里也会预填 |
| `reading_enabled` | 自动阅读书架中的待读片段 | index.html:49 | 同上 | 同上 | 窗口 | `False`（:27） | 需要 | 决定轮询是否 3s 一次（app.js:191） |
| `derive_enabled` | 正文保存后提取摘要与梦境碎片 | index.html:50 | 同上 | 同上 | 窗口 | `True`（:28） | 可隐藏 | 关掉＝只存正文（config-editor.js:932） |
| 未暴露：`diary_style_prompt` 等 5 项 | — | 只在 config-editor.js:899-902,963-965 | 不返回本页 | 本页不能写 | 窗口 | 空/auto | 可选 | 新 UI 可继续不暴露 |
| 未暴露：`rest_reply_*`/`rest_backlog_*` 8 项 | — | config-editor.js:966-974（开口闸门） | 不返回本页 | 本页不能写 | 窗口 | rest_gate.py:72-81 | 暂不需要 | 跨区域，见 §4 |
| `role/role_id` | 角色 | index.html:18 | `role_id`（management.py:178）+ `display.role_name`（product-page.js:975） | — | — | — | 需要（只读） | 名字优先级 app.js:19-24 |
| `participant` | 私聊对象 | index.html:18 | `participant`（management.py:178） | — | — | — | 可省 | 私聊窗口里恒等于当前对象 |
| `host_state` | 运行状态 | index.html:19 | `host_state`（management.py:178） | — | 全局 | — | 可省 | 文案表 app.js:5 |
| `failure_code` | 未单独展示（复用通知条） | app.js:183 | `failure_code`（management.py:180） | — | 窗口 | — | 可省 | 例程出错时的横幅 |
| `next_diary_at` / `next_sleep_at` | 下次日记/入睡 | index.html:21 | management.py:181-182 | — | 窗口 | — | 需要 | 由 daily schedule 与 sleep_schedule 各算一份 |
| `sleep_schedule.*` | 4 个作息读数 | index.html:22-27 | management.py:182 → coordinator.py:96-129 | — | 角色共享 | — | 需要（可拍平） | 含 `executor_state`/`executor_is_current`：实现细节泄露 |
| `sleep_schedule.physiology` | 4 个生理读数 | index.html:28-33 | physiology.py:62-63 | — | 角色 | — | 需要（可收进详情） | `sleep_pressure` 在无历史时为 null |
| `journals[]` | 目录条目 + 详情 | app.js:83-108 | management.py:112-125,144 | — | — | — | 需要 | 每项含 `revision/view_token` |
| `activities[]` | 阅读/睡眠卡片 | app.js:110-127 | management.py:69-97 | — | — | — | 需要 | 每批最多 30 条（management.py:145-152） |
| `receipts[]` | 执行记录 | app.js:132-150 | management.py:153-176 | — | 窗口 | — | 需要 | 混合内存结果与持久化回执 |
| `running[]` | 不展示 | app.js:191 | management.py:185 | — | — | — | 内部 | 只用于是否轮询 |
| `edit_token` | 不展示 | app.js:219 | management.py:180 | `configure.edit_token` | — | — | 内部 | 见 §3 |
| `view_token`（每项 + 全局） | 不展示 | app.js:57 | management.py:97,111,180 | 所有非 configure 的 action | — | — | 内部 | 见 §3 |

前端 index.html:39-50 把服务端默认值又抄了一份（23:50/00:30/20/120/480），首次 GET 会覆盖，漂移不可见——新 UI 应只从接口取值。

## 3. 操作清单

所有写操作走同一路由 `POST life/command`（life_api.py:28-29,50-84），字段白名单严格（life_api.py:66-76），重复键拒绝、body ≤1.2MB（life_api.py:56-65）；返回 Outcome 信封（web_api.py:65-76：`status/message/reason/data`）。

| 按钮/动作 | action | 参数（前端实际发） | 效果 | 保存模型 | 代码位置 |
|---|---|---|---|---|---|
| 保存设置 | `configure` | `changes`=13 项全量 + `edit_token` + `operation_key` | 同步；写配置并可能增删授权 | `edit_token`（无 view_token/expected_revision，management.py:325-326 提前返回） | app.js:219；management.py:223-243 |
| 添加原文 | `add_text` | `title`、`text`（≤262144） | 同步；按 6000 字切片造阅读活动 | `operation_key` 幂等（management.py:359-362） | app.js:222,245；management.py:296-317 |
| 开始睡眠 | `sleep` | `minutes` 1..1440 | 同步建活动，计时由 host 推进 | operation_key | app.js:224,246；runtime.py:131-155 |
| 开始阅读/重新阅读 | `read` | `activity_id`、`expected_revision` | 立即返回 + 后台模型任务（读后感稍后出现） | view_token + expected_revision + operation_key | app.js:126；management.py:369-372；runtime.py:166-196 |
| 现在醒来 | `wake` | `activity_id`、`expected_revision` | 同步结束睡眠；随后 advance() 另行触发梦境 | view_token + expected_revision | app.js:124；runtime.py:157-164 |
| 取消（活动） | `cancel` | `activity_id`、`expected_revision` | 同步置 cancelled；睡眠取消会补记时长 | view_token + expected_revision | app.js:125；management.py:376-402 |
| 撤回原文 | `withdraw` | `activity_id`、`expected_revision` | 同步撤源 + 取消兄弟片段 | view_token + expected_revision | app.js:126；management.py:379-397 |
| 写今天的日记 | `diary` | 无（+ `operation_key`） | **同步等待模型**（选题+写作两阶段），数十秒至数分钟 | view_token（全局 "life"/0）+ operation_key 作 request_id | app.js:247；management.py:340-341；triggers.py:73-80 |
| 重试这天的日记 | `diary` | `local_date`、`retry_of` | 同上，按失败回执重放 | 同上 | app.js:228；triggers.py:79 |
| 记录/重试梦境 | `dream` | `activity_id`、`expected_revision`、可选 `retry_of` | **同步等待模型**；要求该睡眠 completed 且 revision 未变 | view_token + expected_revision | app.js:225；management.py:342-346；triggers.py:82-95 |
| 更正正文 | `edit` | `kind`、`local_date`、`body`、`afterglow` | 同步存稿（origin=manual） | view_token + expected_revision | app.js:223；management.py:404-418 |
| 删除 | `delete` | `kind`、`local_date` | 同步删除（不覆盖自动书写） | view_token + expected_revision | app.js:108；management.py:406-407 |
| 填写正文并恢复 | `restore` | `kind`、`local_date`、`body`、`afterglow` | 同步恢复（日记正文必填） | view_token + expected_revision | app.js:105,210；management.py:409-418 |
| 提取索引 | `derive` | `kind`、`local_date`（直接发，无弹窗） | **同步等待模型**；已存在时返回 `already_derived` | view_token + expected_revision | app.js:104,352；management.py:347-353 |
| 较新/较早记录 | — | GET `before` | 同步分页（50 个日期为一页） | — | app.js:188,248-249；management.py:132-145 |
| 下一批/回到首批 | — | GET `after_activity` | 同步分页（30 条一批，两 tab 共享游标） | — | app.js:250-251；management.py:145-152 |
| 刷新记录 | — | GET 无参 | 重新取全部数据 | 刷新 edit_token/view_token | app.js:230 |
| 启动/停止当前配置 | — | `POST staging/probe|initialize|start|stop` | **iframe 内已隐藏**（embedded-bridge.js:78-80），且父页白名单不含 staging（product-page.js:1111-1113）→ 死代码 | — | index.html:14-15；app.js:231-244 |

### 3.1 保存模型（四个令牌的作用期）

| 令牌 | 谁生成 | 生命周期 | 失配症状 |
|---|---|---|---|
| `view_token` | `token()`＝digest(operator 身份+binding+context.key+**policy_revision**+identifier+revision)（management.py:45-47），`status()` 为每项与全局各发一个（:97,:111,:180） | 只在「上一次 GET」内有效；**记录 revision、授权策略、身份 binding 任一变化即失效**（management.py:335-336） | `life_view_stale` → 「记录或权限已经变化，请刷新后重新确认。」（app.js:8） |
| `edit_token` | 配置服务快照指纹（configuration/service.py:106-119），经 `status` 透出 | 每次保存消耗一次；只有 GET 能换新 | `configuration_revision_conflict`（service.py:168）→ 「设置已变化，请刷新后重新保存。」（app.js:10） |
| `expected_revision` | 记录自身的 revision（activity / journal head） | 每次成功写后 +1 | `life_revision_conflict`/`journal_revision_conflict`（management.py:379,405,350）→ **未翻译**，落到兜底文案（app.js:27） |
| `operation_key` | 前端 `crypto.randomUUID()`，按 body 签名缓存在 `pending`（app.js:63-64） | 同一 body 重试复用同一 key → 服务端 `operation_id()` 派生稳定 op_id，`reserve` 命中即回放（management.py:337,358-362） | 幂等，不会重复写；成功后才 `pending.delete`（app.js:69），失败会一直复用 |

用户体验（静态结论）：三个令牌互相独立，且 `view_token` 把**授权策略版本**也算进去，所以「保存设置」会让所有已打开条目的令牌失效；日程自动写（23:50 日记、自动梦境）也会让目录项的 revision 变化。冲突文案要求「刷新」，但弹窗内**没有刷新入口**，用户可做的只有关掉弹窗点「刷新记录」再重开（app.js:74-77）。写操作的等待期是全局阻塞：`controls(true)` 禁用页面上所有 button/select（app.js:40），最长 15s（见 §5-2）。

## 4. 重复与冲突（含跨区域）

| # | 同一件事的第二入口 | 位置 | 结论 |
|---|---|---|---|
| 1 | `role.life` 全部 25 字段的通用配置编辑器（含总开关），挂在旧面板同一页 | app.js:789-793（`#lifeConfigWorkspace` + `#libraryConfigWorkspace`）、app.js:3818-3822、config-editor.js:883-976 | 与 index.html:35-55 写同一 group；旧编辑器还多 5 写作偏好 + 8 休息闸门 |
| 2 | 总开关也能从上面这个编辑器写，且走同一授权副作用 | legacy_api.py:2733-2737 → management.py:258-294 | 两个写入口、两条 grant 路径（`_grants` 与 `sync_configuration_grant`） |
| 3 | 睡眠作息读数（时间/时长/浮动/时区/下次入睡/执行窗口/节律）在角色状态页再讲一遍 | state-page.js:167-177,308,321,352-359（只读 + 「就寝时刻与时长在日记与生活编辑」+ 跳转按钮 :359,638） | 跨区域；状态页是只读摘要，编辑仍回到本页 |
| 4 | 休息时段是否回复 / 醒后补看 8 个字段 | app.js:3847-3850、4055（开口闸门 `#replyGateConfigWorkspace`）、config-editor.js:966-974 | 跨区域；同属 `role.life` group，但归主动联系页编辑 |
| 5 | 书架书目与阅读偏好（`library` group）与本页「阅读书架」 | app.js:3822、4065（`#libraryConfigWorkspace`） | 跨区域；「书架书目」vs「阅读片段活动」两个同名概念 |
| 6 | 日记/睡眠的家具抽屉入口指向同一工作区 | app.js:4399-4404、4681-4685（能力跳转表） | 同一页面的第二个入口 |
| 7 | `pages/日记与生活/` 生成副本 | tools/sync_framework_page.py:15 | 构建产物，改动源必须重新 sync |

冲突来源（写路径）：① 本页 `configure` 每次提交**13 项全量**（app.js:219），旧编辑器提交**差异集**（configuration/management.py:204-227）——同一字段在两处并存时后者更细，前者是覆盖式；② `dirty` 标记使刷新后不覆盖 DOM（app.js:181），于是「刷新→再保存」会用旧值覆盖别人刚改的值（edit_token 此时是新的，校验放行）；③ 自动例程与人工写同一 `role_journals` 行 → CAS 冲突；④ granted 策略变更 → 所有 view_token 失效。

## 5. 交互问题

1. **轮询与操作后不重绘**（静态结论，需运行时确认）：`render()` 只在 `!preserveNotice` 时调用（app.js:189），而轮询（:191）、`send` 成功后（:73）、`visibilitychange`（:252）、映射变化（:253）全部走 `load(true)` → 状态更新了但界面不刷新；用户看到「操作已完成。」而列表/详情还是旧的，或出现「这里还没有日记或梦境。」（app.js:85）的假空态。
2. **15s 超时对上分钟级的模型任务**：父页默认 `DEFAULT_API_TIMEOUT_MS = 15000`（product-page.js:425-431，iframe 侧 18s，embedded-bridge.js:5），而 diary/dream/derive 是同步 await 的模型调用（management.py:338-354）。超时后前端只显示兜底文案（app.js:27），服务端可能仍在写。
3. **失败＝界面上没有东西**：日记/梦境失败时回执是 `state=failed`（triggers.py:134-150），`_journal()` 对 ABSENT 直接返回 `None`（management.py:102-104），`status` 仍把它 append 进 `journals`（management.py:144）→ 目录里既没有失败条目、也没有占位，只有「执行记录」tab 有痕迹（app.js:132-150）；同时 `state.journals` 里可能混入 `null`，`renderArchive` 直接读 `j.kind`（app.js:86-88）会抛错（静态结论）。
4. **冲突后无就地恢复**：错误文案要求刷新（app.js:8,10），弹窗内只有 `#dialog-error`（index.html:99），重新提交仍是旧 revision → 连点必连错。
5. **空态与失败态同形**：`这里还没有日记或梦境。`（app.js:85）、`本批暂无阅读片段。`（:114）、`暂无书写执行记录。`（:135）都不区分「从未发生」「正在生成」「生成失败」。
6. **全局阻塞**：`controls(true)` 禁掉所有 button/select（app.js:40），只放过关闭弹窗（:41），期间连「刷新记录」都点不了。
7. **分页游标在两个 tab 之间共享**：`#activity-pages` 在面板外（index.html:79），`activityCursor` 只有一个（app.js:12,250-251），睡眠记录少的时候要靠「下一批」翻过大量阅读片段。
8. **睡眠按钮不看当前状态**：开始睡眠只判 `enabled && host_state==="running"`（app.js:47），正在睡时仍可点，后端报 `life_already_sleeping`（runtime.py:141-142）→ 该码不在文案表（app.js:6-10）→ 兜底文案。
9. **未启用时只有灰按钮，没有原因**：`write-diary`/`start-sleep` 被禁用（app.js:47），但页面不说明「因为总开关关着」还是「因为宿主没运行」——而同一信息已在上方 `#routine-state`/`#host-state` 重复展示（app.js:177-178）。
10. **死控件**：`#start-host`/`#stop-host` 在 iframe 内被隐藏（embedded-bridge.js:78-80）；即便显示也会被父页白名单拒绝（product-page.js:1111-1113）。
11. **实现细节外露**：`唯一执行窗口`、`同一角色的其他私聊窗口`、`暂无有效授权窗口`（index.html:24、app.js:160-163）、`睡眠压力 / 欠睡 / 近 24 小时负荷`（index.html:28-33）、`0 / 100` 在无历史时也显示（app.js:170，对比 :168-169 会显示「暂无记录」）。
12. **术语不可猜**：`私人书写`（index.html:63）、`书写索引`（app.js:102）、`醒后余韵`（index.html:96）、`提取索引`（app.js:104）、`撤回原文`（app.js:126）、`执行记录` / `书写记录 N`（app.js:138）、`仅可重试已确定失败的日记`（index.html:86）、`结果未知/状态待核对`（app.js:5,117）。
13. **文案表覆盖不足**：`errors` 只有 15 个码（app.js:6-10），而后端会产生 `life_scope_invalid`、`life_target_changed`、`journal_revision_conflict`、`life_revision_conflict`、`life_sleep_invalid`、`life_reading_invalid`、`life_already_sleeping`、`journal_trigger_in_future`、`reading_source_changed`、`staging_host_terminated`、`life_command_invalid` 等（management.py:35-47,345,379,405；triggers.py:78,88）→ 一律兜底（app.js:27,139）。
14. **时区参数缺省**：`edit/delete/restore/derive` 不发 `timezone`（app.js:57-62），后端默认 `Asia/Shanghai`（management.py:333）；当前只影响 JournalContext 展示字段，但换了非上海作息的角色会是隐性错位。

## 6. 按条件显示清单（功能全部保留，只收起界面）

原则：**不删 action，不删字段**；只决定「什么时候把这块显示出来 / 什么时候把详细设置收起」。判定条件一律取自 `GET life` 的返回值或 `role().life_api`，不需要新接口。

| 功能 / action | 只在什么条件下有意义 | 判定条件来自哪个字段 | 关掉时界面怎么变 | 位置 |
|---|---|---|---|---|
| 整个工作区 | 当前对象是私聊目标 | `role().life_api` 为字符串（群目标为 `null`） | 群对象下父页显示「当前角色尚未提供这个工作区」，不挂 iframe | multi_api.py:182-183；product-page.js:824-825,717 |
| 全部 POST 命令 | 已登录 Dashboard 且该私聊完成绑定 | 失败码 `dashboard_identity_required`/`staging_not_initialized`/`life_scope_invalid`/`life_target_changed` | 只显示一句「请先完成角色映射」类顶栏，不显示任何按钮 | life_api.py:37-40；management.py:35-47 |
| 日记 / 睡眠 / 阅读 / 梦境的**自动执行** | `config.enabled` | `config.enabled`（management.py:180） | 保留历史浏览与手动操作；收起「日程与偏好」里的时间/时区/浮动等细节，只留一个总开关 | app.js:47；runtime.py:107-125 |
| 日记日程设置（`diary_enabled/diary_time/timezone`） | `config.enabled && config.diary_enabled` | 同上两个字段 | 收起时间与时区，仅留「每天写日记」勾选 | index.html:39-41；runtime.py:113-117 |
| 自动入睡设置（`sleep_enabled/sleep_time/sleep_timezone/variation/window/minutes`） | `config.enabled`（且 `sleep_enabled` 控制自动执行、`sleep_minutes` 仍可作手动默认值） | `config.enabled`、`config.sleep_enabled`、`sleep_schedule.enabled/executor_state` | 收起 5 个细节，仅留「按角色作息自动入睡」+ 时长 | index.html:42-48；app.js:159-165；coordinator.py:112-123 |
| 作息读数区（4 项） | `sleep_schedule` 非空且 `sleep_schedule.enabled` | `sleep_schedule.enabled`、`executor_state` | 未启用时只显示一句「未安排」，不显示执行窗口/授权 | app.js:152-166；coordinator.py:112-123 |
| 生理指标区（4 项） | `sleep_schedule.physiology.has_sleep_history` | `physiology.has_sleep_history`、`sleep_pressure` | 无历史时整块收起（现在显示「暂无记录 / 0 / 100」） | app.js:167-172；physiology.py:62-63 |
| 下次日记 / 下次入睡提示 | 对应日程开启 | `next_diary_at`、`next_sleep_at` 是否为 null | 为空则不显示该段 | app.js:179；management.py:181-182 |
| 阅读自动消费（`config.reading_enabled`） | 书架里存在 `planned` 片段 | `activities[].kind=="reading" && state=="planned"` | 关闭时「阅读书架」tab 仍保留（手动 read 仍可用），只收起开关 | index.html:49；runtime.py:345-357 |
| `derive` 自动提取 | `config.derive_enabled` | `config.derive_enabled` | 关闭时收起「提取索引」按钮（手动 derive 语义消失） | index.html:50；app.js:104；runtime.py:213-221 |
| 「写今天的日记」按钮 | `host_state==="running" && config.enabled`，且当天没有 `written` 记录 | `host_state`、`config.enabled`、`journals[].kind/local_date/state` | 已有当天日记时改为「查看今天」，不隐藏 | app.js:47；management.py:102-111 |
| 「开始睡眠」按钮 | `host_state==="running" && config.enabled` 且没有 active 睡眠 | `host_state`、`config.enabled`、`activities[].kind=="sleep" && state=="active"` | 睡眠中改显示「现在醒来」 | app.js:47；runtime.py:141-144 |
| 「现在醒来」 | 存在 `state=="active"` 的睡眠活动 | `activities[].state` | 无则不出按钮 | app.js:124 |
| 「记录 / 重试梦境」 | 存在 `state=="completed"` 的睡眠活动 | `activities[].kind=="sleep" && state=="completed"` | 无则不出按钮（梦境也会被 advance 自动触发，属重复入口） | app.js:125；runtime.py:339-343 |
| 「取消」 | 活动处于 `planned/active/paused` | `activities[].state` | 终态不显示 | app.js:127 |
| 「撤回原文」 | reading 活动且 `unavailable_reason` 为空 | `activities[].kind=="reading"`、`unavailable_reason` | 源已失效时不显示 | app.js:128；management.py:383-391 |
| 「开始阅读 / 重新阅读」 | reading 且 `state∈{planned,paused}`、源可用、`task.state!="unknown"` | `state`、`unavailable_reason`、`task.state` | 结果未定时收起（避免重复调模型） | app.js:126；runtime.py:171-176 |
| 读后感正文 | `activities[].reflection` 非空且无 `unavailable_reason` | 同字段 | 无读后感不显示段落 | app.js:119-120；management.py:95 |
| 「更正正文 / 删除 / 恢复」 | 存在该 kind+local_date 的 journal 且 `state!="deleted"` / `=="deleted"` | `journals[].state`、`unavailable_reason` | 已删除只显示「填写正文并恢复」；来源失效只显示删除 | app.js:103-106；management.py:99-125 |
| 来源失效提示 | `journals[].unavailable_reason` 非空 | 同字段 | 正文与摘要隐藏，只留一句 | app.js:98,119；management.py:115-124 |
| 「执行记录」tab | `receipts` 非空 | `receipts[]` | 无回执时不显示该 tab（现在永远显示且常为空） | index.html:60,80-89；management.py:153-176 |
| 「重试已确定失败的书写」表单 | 存在 `state=="failed"` 且有 `operation_id` 的回执 | `receipts[].state/operation_id` | 无失败可重试时整块隐藏（现在 `hidden` 已实现，但空 tab 仍在） | app.js:145-149 |
| 活动分页 | 当前批存在 `next_activity` | `next_activity` | 为空则不出分页 | app.js:43-44,79 |
| 日记分页 | `next_date` 非空 | `next_date` | 同上 | app.js:42；management.py:183-184 |
| 总开关 `enabled` 及其授权 | 始终可见（它是 life 的唯一授权闸门） | `config.enabled` | 不可收起；关掉时其余细节按上表逐项收起 | index.html:38；management.py:240-241,245-256 |
| 启动/停止宿主 | 不在本工作区有意义 | — | 新 UI 直接不渲染（旧实现已在 iframe 内隐藏） | index.html:14-15；embedded-bridge.js:78-80 |
| `participant`/`host_state` 读数 | 可由父页上下文替代 | `display.subject_name`、`host_state` | 可合并成一行副标题 | index.html:18-19；product-page.js:975 |

## 7. 功能完整性清单（新 UI 验收清单）

「前提」列写平台/能力依赖；无敌对条件写「无」。第 1~6 项是读侧，7~26 是写侧，27~32 是外壳与派生物。共 **32 条**。

| # | 功能点 | 当前入口 | 依赖接口 | 前提 | 代码位置 |
|---|---|---|---|---|---|
| 1 | 读工作区全量状态 | 页面加载 / 刷新记录 | `GET life`（无参） | 私聊目标有 `life_api` | app.js:188,230；life_api.py:36-49 |
| 2 | 日记目录分页（50 日期/页） | 较早/较新记录 | `GET life?before=` | 同上 | app.js:248-249；management.py:132-144 |
| 3 | 阅读/睡眠活动分页（30 条/批） | 下一批 / 回到首批 | `GET life?after_activity=` | 同上 | app.js:250-251；management.py:145-152 |
| 4 | 角色名/对象名/运行状态展示 | 范围条 | `GET life` + 父页 `display` | 无 | index.html:17-20；app.js:175-178 |
| 5 | 下次日记与下次入睡提示 | 范围条下 | `GET life.next_diary_at/next_sleep_at` | 对应日程开启才有值 | app.js:179 |
| 6 | 睡眠计划与生理读数 | 两个读数区 | `GET life.sleep_schedule` | `sleep_schedule` 非空 | index.html:22-33；coordinator.py:96-129 |
| 7 | 保存 13 项生活配置 | 日程与偏好 → 保存设置 | `POST life/command{configure}` | 私聊 + `role.life.manage` 权限 | index.html:35-55；app.js:219；management.py:223-243 |
| 8 | 总开关与授权联动 | 同上（`enabled` 勾选） | 同上 | 无 | management.py:240-241,245-256 |
| 9 | 日记日程设置 | 同上 | 同上 | `enabled` 开启后才有意义 | index.html:40-41 |
| 10 | 睡眠作息设置 | 同上 | 同上 | 同上 | index.html:42-48 |
| 11 | 阅读自动消费开关 | 同上 | 同上 | 同上 | index.html:49 |
| 12 | 摘要/梦境碎片提取开关 | 同上 | 同上 | 同上 | index.html:50 |
| 13 | 添加阅读原文（自动切片） | 阅读书架 → 添加原文 | `POST{add_text}` | 私聊；≤262144 字 | index.html:71；app.js:245；management.py:296-317 |
| 14 | 手动开始睡眠 | 睡眠记录 → 开始睡眠 | `POST{sleep}` | `enabled` + host running | index.html:76；app.js:246；runtime.py:131-155 |
| 15 | 手动醒来 | 睡眠卡片 → 现在醒来 | `POST{wake}` | 同上；睡眠已开始 | app.js:124；runtime.py:157-164 |
| 16 | 开始/重试阅读 | 阅读卡片 → 开始阅读 | `POST{read}` | `enabled` + host running + 源可用 | app.js:126；runtime.py:166-196 |
| 17 | 取消活动 | 阅读/睡眠卡片 → 取消 | `POST{cancel}` | 活动非终态 | app.js:127；management.py:376-402 |
| 18 | 撤回原文 | 阅读卡片 → 撤回原文 | `POST{withdraw}` | reading 活动有源 | app.js:128；management.py:379-397 |
| 19 | 手写当天日记 | 日记与梦境 → 写今天的日记 | `POST{diary}` | `enabled` + host running；模型可用 | index.html:64；app.js:247；triggers.py:73-80 |
| 20 | 重试失败日记 | 执行记录 → 重试表单 | `POST{diary, local_date, retry_of}` | 有 `failed` 回执 + `operation_id` | index.html:83-88；app.js:228 |
| 21 | 记录梦境 | 睡眠卡片 → 记录/重试梦境 | `POST{dream}` | 该睡眠 `completed` 且 revision 未变 | app.js:125,225；management.py:342-346 |
| 22 | 重试梦境 | 同上弹窗内 `#dream-retry` | `POST{dream, retry_of}` | 有失败回执 | app.js:225；index.html:98 |
| 23 | 更正日记/梦境正文 | 详情 → 更正正文 | `POST{edit}` | 记录 `active` | app.js:104,223；management.py:404-418 |
| 24 | 删除记录 | 详情 → 删除 | `POST{delete}` | 记录存在 | app.js:108；management.py:406-407 |
| 25 | 手动恢复记录 | 详情 → 填写正文并恢复 | `POST{restore}` | 记录 `deleted`；日记正文必填 | app.js:105,210；management.py:409-418 |
| 26 | 手动提取索引 | 详情 → 提取索引 | `POST{derive}` | 记录 `active`；模型可用 | app.js:104；management.py:347-353 |
| 27 | 浏览日记/梦境全文 | 日记与梦境 tab | `GET life.journals` | 无 | index.html:62-68；app.js:83-108 |
| 28 | 浏览阅读片段与读后感 | 阅读书架 tab | `GET life.activities[kind=reading]` | 无 | index.html:69-73；app.js:110-127 |
| 29 | 浏览睡眠记录与状态 | 睡眠记录 tab | `GET life.activities[kind=sleep]` | 无 | index.html:74-78；app.js:110-127 |
| 30 | 查看书写执行回执与失败码 | 执行记录 tab | `GET life.receipts` | 无 | index.html:80-89；app.js:132-150；management.py:153-176 |
| 31 | 刷新全部数据（含换新令牌） | 顶部刷新记录 | `GET life` | 无 | app.js:230 |
| 32 | 可见性/映射变化时自动重取 | 切回标签页、宿主映射更新事件 | `GET life` + 父页事件 | 无 | app.js:252-253；embedded-bridge.js:34-37 |

验收要点（与上表配套）：① 14 个 action 全部可达且参数不变（§3）；② 四个令牌语义不变（§3.1）；③ 只在私聊目标挂载、群目标不挂（multi_api.py:182-183）；④ 响应仍按 Outcome 信封解析（web_api.py:65-76）；⑤ 请求字段仍受白名单约束（life_api.py:66-76）。新增页面还需同步 `tools/sync_framework_page.py:15` 与 `page-build.json` 清单（tools/sync_framework_page.py:49-92），并考虑 `tools/check_life_page.cjs` 这套截图回归的替代。

## 8. 新 UI 的形态建议（小鲸鱼这一人格）

人格带日程/作息、有日记/睡眠/阅读三件事，最少 3 屏即可覆盖 32 条功能，层级拍平为「一屏一主题」：

1. **今天（默认屏）**：顶部一行副标题（角色 · 运行中）；主体是「最近一篇日记」的日期+标题+两行摘要（点开进详情）；其下一行「下次入睡 23:40」「上次醒来 08:12」；右上角唯一的浮动主操作「写日记」。数据只用 `GET life` 的 `journals[0]`、`next_sleep_at`、`sleep_schedule.active_wake_at/physiology`。启用状态不显示为文字状态块，而由按钮是否可用表达（关掉时仅保留一个「开启生活」入口）。
2. **记录（列表+详情）**：两个分段「日记」「睡眠」；睡眠卡片里嵌套它产生的梦境（同一天 kind=dream 的 journal）；读后感附在对应的睡眠/阅读条目下。分页只在「日记」分段生效，活动合并成一个时间流，不再需要两个共享游标的分页器。编辑/删除/恢复/提取索引全部收进详情页的「⋯」菜单（保留 4 个 action，不删）。
3. **生活设置（二级页，默认收起）**：只有三行开关（每天写日记 / 按角色作息入睡 / 自动阅读），打开后才展开对应的时间与时长；时区、浮动、观察窗口收进「高级」。总开关 `enabled` 单独一行且不可隐藏（它是授权闸门）。旧面板 `#lifeConfigWorkspace` 与开口闸门处的重复字段不再出现在本页（§4-1/2/4），改为从这里链接过去或反过来。

不建议搬进新 UI 的东西：`唯一执行窗口`/`executor_state`、`睡眠压力/欠睡/负荷`、`执行记录`的原始失败码、`participant`、`start/stop host`；它们可以留在「运行诊断」或直接不渲染。生成类动作（diary/dream/derive）在界面上应表现为「一条正在生成的时间线占位」，而不是 15 秒的全局禁用——接口层不需要改，只要前端把等待态本地化（§5-1/2/3 的修法都在界面侧）。
