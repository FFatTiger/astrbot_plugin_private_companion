# 陪伴中心设置覆盖审查

审查范围：新页面 `pages/陪伴中心/` 的 34 个页面模块、`shell.js` 路由与通用控件；对照 `docs/ui-audit/*.md`/`*.items.json`、`docs/ui-redesign/sections/*.md`、`CONTRACT.md`/`BACKEND.md`，并核对相关后端路由与字段定义。检查了声明字段、实际渲染、控件类型/单位、作用范围、保存请求和占位/死入口。报告只记录有代码或文档证据的问题；本次审查只写入本报告，未修改或提交其它文件。

## 总结

共核对 34 个新页面模块，覆盖首页、角色、联系人、对话、生活、能力、系统 7 节。确认问题 29 条：A 遗漏 6 条，B 声明未渲染 0 条，C 显示不对 7 条，D 范围/层级 2 条，E 保存问题 10 条，F 整页/动作入口问题 4 条；同一条若同时影响显示和保存按主要根因计一次，问题类型栏保留复合类型。角色页和对话页没有再发现示例中那种“字段已声明但完全不在任何渲染列表”的 B 类差集；`group_air_guard_enabled` 当前已进入 `MORE_REPLY` 并会被渲染。

## 首页

| 类型(A-F) | 字段名 | 页面文件:行号 | 现象 | 证据(后端/旧页面/sections 出处:行号) | 建议改法(一句话) |
|---|---|---|---|---|---|
| C/F | `integration.manifest.extensions[].assembled/desired_state` | `pages/陪伴中心/pages/today.js:24` | 首页按 `item.state`/`item.status` 判断扩展状态；真实 manifest 的状态字段是 `assembled`/`desired_state`，因此已装配扩展可能显示成“装配”而不是“暂停/更新/卸载”，动作状态也会错。 | 新页同仓 `pages/陪伴中心/pages/capability-overview.js:8-15` 已专门用 `assembled`/`desired_state` 归一化；`docs/ui-redesign/sections/首页.md:19-20` 要求按扩展装配态显示。 | 首页复用能力总览的 `stateOf`/归一化逻辑，并按归一化状态生成动作。 |
| F | `roomLayouts[scopeKey]` | `pages/陪伴中心/pages/today.js:45` | “布置房间”按钮只把按钮文字改成“已显示房间布置”，没有弹窗或编辑器；家具按钮虽可直接切换，但该入口本身不提供文档要求的逐件布置界面。 | `docs/ui-redesign/sections/首页.md:8` 要求“布置房间（动作按钮+弹窗：逐件家具收纳开关）”；旧页面出处同文件表格列。 | 把按钮接到实际的家具布置弹窗，或明确移除该虚假动作按钮。 |

## 角色

本节未发现有充分证据、且区别于下列系统/生活问题的新增设置覆盖问题。角色档案、人格整理、世界知识、角色成长策略的字段均有对应渲染分支；`config_api` 缺失时的只读提示与文档范围一致。

## 联系人

| 类型(A-F) | 字段名 | 页面文件:行号 | 现象 | 证据(后端/旧页面/sections 出处:行号) | 建议改法(一句话) |
|---|---|---|---|---|---|
| E | `admin_nickname`, `identity_tier` | `pages/陪伴中心/pages/contact-details.js:103,134-135` | 保存函数先对不存在的 `[data-nickname-state]`/`[data-tier-state]` 写 `textContent`；`accessCard` 没有渲染这两个节点，保存必然进入异常路径，随后异常处理仍对空节点写字，备注和身份级别都不能正常保存。 | 同页 `accessCard` 返回值 `:103` 只有输入卡和权限卡，没有两个状态节点；文档要求备注/身份保存见 `docs/ui-redesign/sections/联系人.md:15-18`。 | 在卡片中渲染对应回执节点，或改为使用统一 save bar 回执并避免对空节点写入。 |
| A/F | 群成员详情入口 | `pages/陪伴中心/pages/group-details.js:22` | “成员与熟人卡”成员 chip 带 `data-member-id`，但全文件没有该属性的 click handler；用户点击成员没有任何跳转或详情动作。 | `docs/ui-redesign/sections/联系人.md:33` 要求成员 chip 是“点开成员详情”的只读入口；同页只绑定了 `data-group-id`、记忆和安全审阅事件。 | 为 `data-member-id` 增加到联系人详情的跳转，并携带 subject/route。 |

## 对话

| 类型(A-F) | 字段名 | 页面文件:行号 | 现象 | 证据(后端/旧页面/sections 出处:行号) | 建议改法(一句话) |
|---|---|---|---|---|---|
| D/E | `GROUP_FIELDS`（群行为/氛围/话题等） | `pages/陪伴中心/api.js:89-102`；`pages/陪伴中心/pages/conversation-participation.js:20,146,174-176` | 群目标的 `role.config_api` 明确为 `None`，`readRole` 却回退请求 `reply_api` 去掉 `/reply` 的 `/config`，该路由不存在；保存同样回退到该路径。于是群页只能拿到 reply/participation 可用字段，群配置字段不能读取或保存。 | `astrbot_host/multi_api.py:163-165` 对 `GroupTarget` 将 `config_api` 设为 `None`；`astrbot_host/group_reply_api.py:34-48` 的群路由只有 reply、`/participation` 等，没有 `/config`；`docs/ui-redesign/CONTRACT.md:14-15` 要求群角色缺 `config_api` 时必须由 `reply_api` 去掉 `/reply` 得到可用配置路由，但当前后端实际不满足该假设。 | 为群设置提供真实的配置/参与路由映射，并让页面按字段所属接口分别读写，不能把不存在的 `/config` 当作可用入口。 |
| C | `private_debounce_max_ms` | `pages/陪伴中心/pages/conversation-participation.js:95-96,112` | 该值用毫秒存储，显示时除以 1000 并标“秒”，但没有为显示控件设置范围/步长；输入空值会写成 0 毫秒，后端该字段有正数范围，用户可直接产生必拒值。 | 同页只做显示/写回换算；后端字段定义在 `companion_v2/conversation/reply_settings.py` 的字段注册与 LIMITS 中，审计对照 `docs/ui-audit/reply.md` 的私聊防抖项。 | 按后端 LIMITS 给秒控件设置 min/max/step，并在提交前阻止空值转 0。 |

## 生活

| 类型(A-F) | 字段名 | 页面文件:行号 | 现象 | 证据(后端/旧页面/sections 出处:行号) | 建议改法(一句话) |
|---|---|---|---|---|---|
| F/E | `mobile_location`, `reaction_image`（主动联系诊断目的） | `pages/陪伴中心/pages/proactive-contact.js:4,35` | 页面为“消息测试”额外生成两个测试目的，但这两个值不在后端 `PURPOSES` 注册表；测试请求会被后端判为未知目的，属于页面提供的无效动作。 | `companion_v2/proactive/configuration.py:24-30` 的 `PURPOSES` 只有 15 个正式目的，不含这两个值；`astrbot_host/setup_api.py:896` 对诊断目的明确执行 `purpose not in PURPOSES` 校验；`docs/ui-redesign/sections/生活.md:86` 要求主动建议入口按真实后端动作补齐。 | 删除这两个无效测试按钮，或先在后端注册对应生产目的后再提供入口。 |
| E | `calendar.revise`, `calendar.exception` | `pages/陪伴中心/pages/state-schedule.js:33,77` | “改整组”和“仅改本次”按钮没有编辑弹窗，直接把原始 `item` 作为 `data` 原样提交；用户无法修改标题、时间、时长或备注，按钮实际只是无变化重提交。 | `docs/ui-redesign/sections/生活.md:45` 要求日程创建/改整组/仅改本次；旧实现出处 `calendar-editor.js` 记录这些动作带编辑数据。 | 点击两类修改按钮先打开编辑表单，再按 action 发送用户修改后的 data。 |
| A | `calendar.accept`, `role.state.write` | `pages/陪伴中心/pages/state-schedule.js:33-77` | 页面有创建、改整组、改本次、取消、提醒和公开短文案，但没有后端已有的接受日程建议、直接写入角色状态入口。 | `docs/ui-redesign/sections/COVERAGE.md:45,64` 已明确这两个 action 后端存在且新 UI 尚无按钮；`docs/ui-redesign/sections/生活.md` 状态与日程动作表。 | 在日程/状态详情中分别增加“接受建议”和“写入状态”入口，并带后端要求的 token/revision。 |
| D/F | `role.growth.propose_enabled` / `growth.command#propose` | `pages/陪伴中心/pages/learning-growth.js:22` | “提出成长建议”按钮无论当前窗口 `propose_enabled` 是否关闭都会显示；关闭时仍可打开表单并提交，用户会得到后端拒绝而不是清楚的不可用状态。 | 同页 `accessFields` 和 `:25` 已有 `propose_enabled` 依赖；`docs/ui-redesign/sections/生活.md:80,86` 规定 propose 是当前窗口权限且原来无入口。 | 仅在 `propose_enabled` 为真时启用按钮，否则显示禁用原因；提交时同时校验权限。 |

## 能力

| 类型(A-F) | 字段名 | 页面文件:行号 | 现象 | 证据(后端/旧页面/sections 出处:行号) | 建议改法(一句话) |
|---|---|---|---|---|---|
| C/D | `reality-access/*` 能力目录 | `pages/陪伴中心/pages/perception.js:13,16,74` | 现实能力 API 读取失败或返回空/未知时，代码使用硬编码 `FALLBACK_REALITY`，并把每项标为 `invokable:true`，页面会伪造定位、手机、米家等可用能力；这与契约要求未知能力保守隐藏/禁用相反。 | `docs/ui-redesign/CONTRACT.md:12-13` 明确能力缺失/null 时保守隐藏或禁用，不得按平台名猜测；同页 `safeGet` 会把读取失败归为空对象。 | 读取不到能力目录时显示“能力不可用/待检查”，不要生成可编辑的 fallback 项。 |
| C/D | `screen` 扩展装配状态 | `pages/陪伴中心/pages/perception.js:59-61` | `screenInstalled` 只要 `screen_access_api` 路径存在就为真；即使扩展未装配，也会显示屏幕设置卡并可保存。 | `docs/ui-redesign/sections/能力.md:27` 要求 screen 扩展已装配才显示；`capability-overview.js:8-15` 已有基于 assembled/desired_state 的正确判定。 | 仅在 manifest 明确 assembled/desired_state=assembled 且 API 可用时显示屏幕卡。 |
| F | `reality.mobile` 扩展设置 | `pages/陪伴中心/pages/platform-extensions.js:39-40` | 已构造的 `mobileCard` 没有插入模板，模板插入的是对象变量 `mobile`；浏览器会显示 `[object Object]`，手机网关、配对令牌等设置不可见。 | `docs/ui-redesign/sections/能力.md:24` 要求手机连接设置；同页 `:39` 变量名已表明应插入 `mobileCard`。 | 模板插入 `mobileCard`，并为其字段保存实现对应 configure 请求。 |
| C/E | `image.output.*`, `image_review`, `quota`, `photo.reference`, `wardrobe` | `pages/陪伴中心/pages/image-materials.js:29,43,58` | `GET /config` 返回的 section 结构是 `{settings, edit_token, ...}`，页面却把整个 section 当作 settings；字段读取不到时显示空值/默认值，保存又把 `{settings, edit_token,...}` 整个包装对象作为 `changes` 发回。 | `tests/test_configuration_api.py:303-305,317-318` 明确 section 的 settings 在 `sections.reaction.settings`，同一结构适用于配置 section；`docs/ui-redesign/sections/能力.md:55-59` 要求这些 section 分别按 settings+token 保存。 | 对每个 section 使用 `settingsOf`/`tokenOf` 拆出 settings，POST 只发送字段 changes。 |
| C/E | `reaction`、`vision_verify_mode` | `pages/陪伴中心/pages/reaction-semantics.js:23-24,40,59` | 与生图页同一结构错误：`reactionSettings` 是 section 包装对象而非 settings；表情检索边界/视觉模式会显示默认空值，保存将包装对象写入 `changes`。 | `tests/test_configuration_api.py:303-305` 直接断言 `sections.reaction.settings`；`docs/ui-redesign/sections/能力.md:39-40` 要求 `/config?sections=reaction` 双写但 changes 应为字段。 | 先解包 `reaction.sections.reaction.settings`，保留 section 的 edit_token 单独提交。 |
| C/E | `reactions_trigger_probability`, `reactions_collection_*_probability` | `pages/陪伴中心/pages/reaction-semantics.js:6,34` | 后端概率默认值是小数（如 `0.2`、`0.1`），控件却直接加 `%` 单位且不乘 100；页面显示 0.2% 而实际是 20%，用户填 20 又会被后端当成 20.0 而非 0.2。 | `companion_v2/storage/semantic.py:14-17,28-30` 的默认值为 `0.1`/`0.2` 且列入 `PROBABILITY_FIELDS`；旧审计 `docs/ui-audit/models.md:149-169` 也按概率字段记录。 | UI 用百分数时读写都做 fraction↔percent 换算，并设置 0–100 范围。 |
| C/E | `learning_interval_seconds` | `pages/陪伴中心/pages/reaction-semantics.js:5` | 后端单位是秒（默认 21600、范围 60–86400），控件直接标“分钟”且不除以 60；显示和保存单位均错。 | `companion_v2/storage/semantic.py:24-27` 明确字段名为 `learning_interval_seconds`、范围是秒；`docs/ui-redesign/sections/能力.md:38` 明确要求界面分钟、后端秒。 | 读取除以 60、保存乘以 60，并设置分钟范围/步长。 |
| F/E | 参考图/衣柜/相册列表 | `pages/陪伴中心/pages/image-materials.js:38-39,54,66-70` | `referenceItems`、`wardrobeItems`、`albumItems` 在初次 render 外只计算一次；上传、登记、排序、撤回后 `refreshMaterials` 更新 state 但这些常量仍是旧数组，页面不会显示刚保存的结果，后续排序/编辑也按旧列表操作。 | 同页 `refreshMaterials` 在 `:60` 更新 `state.inventory/state.album`，但列表常量定义在 `:38`；`docs/ui-redesign/sections/能力.md:55-57` 要求即时上传/登记/排序/撤回后更新列表。 | 在 draw 内从最新 state 重新取列表，或 refresh 后重建列表引用。 |

## 系统

| 类型(A-F) | 字段名 | 页面文件:行号 | 现象 | 证据(后端/旧页面/sections 出处:行号) | 建议改法(一句话) |
|---|---|---|---|---|---|
| C | `host.enabled`, `host.accepting`, `failure_code` 等状态键 | `pages/陪伴中心/pages/accounts-sessions.js:22` | 运行状态卡直接把后端 key 原样显示为 `accepting`、`delivery_authorized`、`failure_code` 等英文/机器字段名，没有中文 label；这是用户可见设置/状态显示不正常。 | `docs/ui-redesign/sections/系统.md:31-32` 要求运行状态面板显示状态位和授权；新页通用 UI 有 `labelOf`，但本页未使用。 | 建立状态键中文标签表，错误码另显示为“失败原因”。 |
| E/D | `multi_host.group_targets` / 单条 `accounts/group-target` | `pages/陪伴中心/pages/accounts-sessions.js:35,49` | 群目标勾选保存仍 POST `accounts` 整表替换，并把当前 `accounts/personas/groups` 全量回传；新 UI 契约要求单条接入使用 `accounts/group-target`，整表提交可能覆盖并发变更且不是单条目标层保存。 | `docs/ui-redesign/sections/系统.md:42` 明确标注新 UI 应改用单条 `accounts/group-target`；后端路由在 `astrbot_host/account_session_api.py:29-40`。 | 勾选/取消每个群分别调用 `accounts/group-target`，保存后重新读取目录。 |
| E | `accounts/window-unlink.linked_target_id` | `pages/陪伴中心/pages/accounts-sessions.js:29,54` | 拆分按钮只编码 primary target，提交时固定 `linked_target_id:""`；已有多个关联窗口时无法指定要拆分哪一个，后端请求不符合接口语义。 | `docs/ui-redesign/sections/系统.md:40` 要求 `{primary_target_id, linked_target_id}`；同页 `linkRows` 已有 `linked_target_ids` 数据却没有逐项按钮。 | 为每个 linked target 渲染单独拆分按钮并提交真实 ID。 |
| A | `legacy.data-apply` 的九类 `import_*` 与 `confirm_*` | `pages/陪伴中心/pages/profile-appearance.js:16,21,28,36` | 旧版迁入只显示原始 JSON 和“一键/开始迁移”按钮，没有表格中的表情、世界书、联系人权限、日记、表达、参考图、衣柜、记忆库、归档选择，也没有逐项确认字段；用户无法按文档要求选择导入范围。 | `docs/ui-redesign/sections/COVERAGE.md:15`、`docs/ui-redesign/sections/系统.md:55` 明确要求九类 `import_*` 和确认项；本页只发送 `confirmed:true`。 | 读取 data-plan 后渲染九类复选框与确认字段，并把选择值随 data-apply/对应 apply 请求提交。 |
| A | `voice_private_*`, `voice_group_*` | `pages/陪伴中心/pages/model-connections.js:76` | 语音卡只显示中文/日语/英语三个默认 provider 和总超时，没有私聊/群聊三语种共 6 个覆盖 provider 字段。 | `docs/ui-redesign/sections/系统.md:64` 要求三语种绑定 + 私聊/群聊×三语种覆盖；旧审计 `docs/ui-audit/models.md` 的 voice 字段表。 | 从 `/voice` 的 channels[] 渲染六个覆盖下拉，并按平台/目标范围控制显示。 |
| A | `laya.api_key`, `local_model_path`, `followup_confidence_threshold`、7 个 decision 开关、logs/test | `pages/陪伴中心/pages/model-connections.js:79` | 决策服务只显示 enabled、mode、endpoint、timeout，后端已有密钥、本地模型路径、置信阈值、分类开关、模拟调用和日志入口均没有设置入口。 | `docs/ui-redesign/sections/系统.md:67` 明列完整 Laya 配置和 `/laya/logs`、`/laya/test`、`/laya/decide`；本页未出现这些字段/动作。 | 按后端 `/laya` schema 渲染完整配置，并补日志/测试/模拟调用动作。 |
| E | 任务 `prompt` | `pages/陪伴中心/pages/model-connections.js:31,65` | 任务附加提示词 textarea 使用 `data-model-field`，但输入监听只查 `[data-task-field]`，保存循环读取 draft 中的旧值；用户修改提示词不会进入 changes。 | 同页 `field()` 的属性和 `input` listener 的选择器不一致；`docs/ui-redesign/sections/系统.md:62` 要求任务卡可编辑 prompt。 | 统一字段属性/监听器，并从 DOM 读取 prompt 进入任务 changes。 |
| E | `tasks[].fields[].explicit` 高级继承项 | `pages/陪伴中心/pages/model-connections.js:38,65` | 高级设置复选框有渲染（`data-task-inherit`），但全文件没有 change/click 读取或保存该属性；“跟随上级”显示可操作，实际保存无效。 | `docs/ui-redesign/sections/系统.md:62` 要求 9 个继承复选框和 reset/save；本页保存循环只处理 provider/fallback/max_output_tokens/timeout/prompt。 | 保存时读取每个 `data-task-inherit`，按后端契约发送 reset/explicit changes。 |
| C/D | `conversation.reply.prompt` | `pages/陪伴中心/pages/model-connections.js:37-38` | `managed` 对整个 `conversation.reply` 任务为真，主模型、备用模型、上限、超时和附加提示词全部 disabled；文档/后端契约只要求 host 管理 provider/fallback/max_output_tokens，prompt 仍可编辑。 | `docs/ui-redesign/sections/系统.md:62` 写明 `conversation.reply` 只允许 prompt；后端模型管理约束在 `companion_v2/model_gateway`/`astrbot_host/model_api.py`。 | 只禁用宿主管理字段，保留 prompt 编辑并正确保存。 |
| E | TTS provider 编辑 | `pages/陪伴中心/pages/model-connections.js:91-92` | TTS 列表有“编辑”按钮，但 handler 只显示“请在语音连接管理中按后端提供的编辑入口修改”，页面没有编辑表单或后端编辑入口，实际不可编辑 API key、模型等连接设置。 | `docs/ui-redesign/sections/系统.md:65` 要求 TTS provider 新建/改/克隆/测试；本页只有 create/clone/test/toggle API 调用。 | 增加 provider 编辑弹窗并调用 `tts/providers/update`，或删除不可用的编辑按钮。 |
| F | `host/preview`, `host/batches` | `pages/陪伴中心/pages/advanced-diagnostics.js:43-44` | 页面提供“读取对话预览/读取批次”按钮，但调用路径是 `host/preview`、`host/batches`；实际注册路径是安装级 `accounts/preview`、`accounts/batches`，按钮会稳定失败。 | `astrbot_host/multi_api.py:237-248` 注册在 `PREFIX`（accounts）下；`docs/ui-redesign/sections/系统.md:73` 记录这两个后端路径的真实前缀和当前补入口要求。 | 使用实际注册的 `accounts/preview`、`accounts/batches`，并按接口要求带 query。 |

## 不确定/需要人判断

| 项 | 原因 | 建议确认 |
|---|---|---|
| `group_participation` 中除 5 个 interjection 字段外的群行为字段最终应归角色层还是窗口层 | 当前后端群 API 暴露的 `/participation` 只返回 5 个 `INTERJECTION_FIELDS`，而 `GROUP_FIELDS` 还包含氛围、复读、话题等字段；代码对群目标又尝试推导不存在的 `/config`。这是后端接口边界与 UI 设计文档之间的不一致，不能仅凭前端决定字段归属。 | 确认后端要补群配置路由，还是将这些字段全部收敛到角色默认/单独 participation section。 |
| 首页“家具按钮直切换”是否足以替代文档要求的“布置房间弹窗” | 当前家具按钮本身可切换 localStorage，但“布置房间”按钮是空动作。 | 确认是否保留直接切换并删除按钮，或实现弹窗。 |
| 生图页面 section wrapper 问题是否已被某个未记录的 transport 解包层修正 | `api.js` 的 envelope 只解包顶层 data，不会把 `sections.<name>.settings` 提升；测试直接展示嵌套结构，因此按当前仓库代码判定为问题。 | 若线上桥接另行改写 section 结构，应把该约定写入 mock/契约并同步页面。 |

