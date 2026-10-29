# 模型与能力（models）只读审计

基线：`wechat` 分支 @ `2e29e3f`。范围：`pages/陪伴小屋/models-page.js`(2240) / `models-page.css`(611) / `image-materials-page.js`(766) / `semantic-page.js`(433)，后端 `astrbot_host/model_api.py`(1647)、`semantic_api.py`(350)、`image_material_api.py`(215)、`native_extensions/image_settings.py`(42)，以及它们实际读写的配置存储。
方法：只读静态阅读，未启动服务、未调用线上接口。
机器可读的去重清单见同目录 `models.items.json`。

## 路径约定

| 记号 | 含义 |
|---|---|
| `P` | `/api/plug/astrbot_plugin_private_companion` |
| `R` | `P + /targets/<target_id>/roles/<digest>/model`（`multi_api.py:165`）。私聊目标 = `ModelWebAPI`（33 条路由，`model_api.py:371-408`），群目标 = `GroupModelWebAPI`（**只有 2 条**：`GET R`、`POST R/configure`，`group_model_api.py:23-25`） |
| `SEM` | `P + /semantic`（**单一路由，靠 body.action 分发**，`semantic_api.py:26-28`） |
| `IM` | `P + /targets/<target_id>/roles/<digest>/image-materials`（`image_material_api.py:31-43`，仅私聊目标注册） |
| `CFG` | 角色/安装配置接口（`configuration_api` / `reply/configure`），由 `config-editor.js` 使用 |

一句话结论：这一区域把「一个机器人、一个角色、一个聊天模型」的场景，做成了 5 个主标签 × 3 个子标签 × 3 种替换策略 + 6 种保存语义 + ≈80 个设置级可写键（生图端点另有 15 个子字段/个）。**首屏（默认 `sub=cfg`、`cm=precise`）会同时渲染所有已注册模型任务（≈22 个，视是否加载图像/视频模型为 21–23）的完整表单，约 380 个可交互控件。**

---

## 1. 页面/视图清单

### 1.1 入口（同一页面被 7 处挂载/跳转）

| # | 用户路径 | 代码位置 | 说明 |
|---|---|---|---|
| 1 | 管理 → 连接与运行 → 模型与连接 | `app.js:55`、`app.js:3662`（`renderModelsPage`）、`app.js:965` | 主入口，`#modelWorkspace` + 底部「后台任务预算」 |
| 2 | 感知 → 配置 → 模型能力 | `app.js:1986-1998`（第二个 `#modelWorkspace`）、`app.js:1907-1908`、`app.js:4940` | **同一组件第二次挂载**，套在感知配置的子面板里 |
| 3 | 产出 → 模型路线 / Content 授权 | `app.js:3366`、`app.js:3369` | 跳 1 |
| 4 | 理解（识图 / 视频转述）快捷入口 | `app.js:3955`、`app.js:3964` | 跳 1，语义上想改的是具体任务模型 |
| 5 | 决策页「模型与连接」 | `decision-page.js:130` | 跳 1 |
| 6 | 任意 token 用量卡 | `app.js:4462`、`app.js:4700`（`tokenTaskSettings`） | 按 kind 跳到 `models` 根节点 |
| 7 | 首页家具「参考素材与衣柜」 | `app.js:705` | 跳产出页 materials（不是本页，但同属本区域） |

### 1.2 视图结构（`models-page.js`）

| 视图 | 渲染函数:行 | 用途 | 主要组件 |
|---|---|---|---|
| 顶栏 | `topbar` 274 | 当前对象/运行状态/刷新 | 状态 pill、刷新 |
| 主标签 | `tabBar` 1600 | 功能模型 / 语音模型 / 生图模型 / 搜索服务 / Laya 决策 | 5 tab + 计数徽标 |
| 功能模型 · 态势图 | `situationMap` 1621 | 全任务路由总览 + 批量连通性测试 | 5 KPI、2 组筛选、provider 图例、分组勾选清单、批量测试 dock（1651-1694） |
| 功能模型 · 模型配置 / 快速配置 | `quickConfig` 1696 | 按任务分组统一指派模型 | 7 张分组卡（统一指派下拉 + 应用到本组） |
| 功能模型 · 模型配置 / 精确配置 | `cfgPane` 1923 → `toolbar` 286 + `taskCards` 403 → `fnCard` 353 | 逐任务编辑全部字段 | 搜索 + 作用域切换 + provider 筛选 + 视图切换 + 2 组筛选（5 个筛选维度）；每任务卡：5 个输入 + 9 个「跟随上级」复选框 + 3 行只读信息 + 测试/放弃/保存 |
| 功能模型 · 精确配置 / 按提供方 | `providerView` 405 | 反向视图：provider → 任务 | panel 列表，点任务回精确配置 |
| 功能模型 · 替换策略 | `replacementPolicy` 1901 | 关键词换模 / 高价时段 / 拒答替代 | 段落切换、任务选择器、作用范围三态、24 格时段带、规则卡、JSON 源码框 |
| provider 抽屉 | `drawer` 2042 | 某 provider 承担哪些任务 | 只读 + 「在精确配置中调整」 |
| 语音模型 | `voicePane` 880 | 语种绑定 / 渠道覆盖 / 试听 / TTS 连接管理 | 4 KPI、3 语种 tab、6 个渠道下拉、1 个超时、试听音频、`ttsEditor` 772-812（新建/克隆/测试/动态字段） |
| 生图模型 | `imagePane` 1449 | 动作开关 + 模型队列 + 连接参数 | 4 KPI、3 个动作开关 + 检查注册、生成/改图两视图、每端点 ≈18 字段、ComfyUI/SD 工作流 JSON、网络代理、兼容参数、schema 表单（1510） |
| 搜索服务 | `searchPane` 1023 | DeepSeek Search provider 绑定 | 1 个下拉 + 保存 |
| Laya 决策 | `layaPane` 1093 | 语义决策模型接入 | 4 KPI、6 输入 + 7 决策分类开关、3 段安装命令、模拟调用、最近 50 条日志（含请求/响应 JSON） |
| 语义目录（学习） | `semantic-page.js:103 renderLearning` | 全局语义策略 + 全局条目 | 6 个开关、3 个 provider、5 个数字、3 个跳转链接、条目列表 |
| 表情配图（表达） | `semantic-page.js:164 render`（view=expression） | 表情开关 + 素材库 + 自动收录概览 | 6 个开关、4 个数字、3 个下拉、检索、导入、条目列表、编辑抽屉（92） |
| 参考素材与衣柜 | `image-materials-page.js:350 render` | 参考图库 / 产出相册登记 / 衣柜 / 每日穿搭 | 3 个状态徽标、上传表单、图库网格（排序/使用方式/撤回）、相册网格、衣柜表单与列表 |

### 1.3 弹窗/抽屉

| 名称 | 位置 | 触发 |
|---|---|---|
| provider 抽屉 | `models-page.js:2042` | 态势图点 provider pill |
| 素材编辑抽屉 | `semantic-page.js:92` | 点条目「编辑」 |
| 删除确认 | `semantic-page.js:352-358` | 删除表情素材 |
| Laya 结果块 / 日志详情 `<details>` | `models-page.js:1066,1077` | 调用后 / 展开日志 |

---

## 2. 设置项清单

### 2.1 任务路由（21–23 个已注册模型任务共用同一组字段）

写入：`POST R/configure`（`model_api.py:597`）；读取：`GET R?layer=role|window`（`model_api.py:526`）。字段定义 `companion_v2/model_gateway/management.py:23-24`，默认值来自各 task profile `companion_v2/model_gateway/models.py:100-121`。

| 设置键 | 界面标签 | 所在页面/分区 | 读写 API | 作用层级 | 默认值 | 适用性 / 显示条件 | 备注 |
|---|---|---|---|---|---|---|---|
| `provider` | 主模型提供方 / 统一指派模型提供方 | 模型与连接 > 功能模型 > 精确配置卡片 / 快速配置 / 批量指派 | GET R；POST R/configure | 角色 + 窗口 | 该任务 profile 的 `default_provider`（跟随 AstrBot 当前会话模型，`astrbot_host/multi_session.py:421-422`） | 通用 | 只列能力匹配的 provider（`available` 121） |
| `fallback` | 备用模型提供方 / 拒答替代模型 | 精确配置卡片、替换策略 > 拒答替代 | 同上 | 角色 + 窗口 | `""`（为空时等于主模型，`routing.py:28`） | 通用 | **同一字段两处可改**（`models-page.js:370` 与 `1886-1890`）；必须 ≠ provider |
| `prompt` | 对话附加提示 / 任务附加提示词 | 精确配置卡片 | 同上 | 角色 + 窗口 | 各任务内置 `default_prompt` | 通用 | 上限 8000 字；`conversation.reply` 只能改这一项 |
| `max_output_tokens` | 单次输出上限 | 精确配置卡片 | 同上 | 角色 + 窗口 | `1024`（`models.py:107`），且被 provider 上限夹紧（`fitLimit` 127） | 通用 | 改 provider 时会被静默改小并提示 |
| `timeout_seconds` | 请求超时 | 精确配置卡片 | 同上 | 角色 + 窗口 | `60`（`models.py:120`） | 通用 | 1–600 |
| `replacement_rules` | （无独立标签，藏在「替换策略」） | 替换策略 > 关键词换模 / 高价时段 / JSON 源码 | 同上 | 角色 + 窗口 | `"[]"` | 通用 | 一条 JSON 串，三个编辑器写同一字段（1837 / 1849 / 1845） |
| `replacement_scope` | 作用范围（仅插件调用/仅普通对话模型/全部生效） | 替换策略顶部 | 同上 | 角色 + 窗口 | `all` | 通用 | 三态，用户难以判断影响面 |
| `fallback_on_refusal` | 拒答替代开关 | 替换策略 > 拒答替代 | 同上 | 角色 + 窗口 | `false` | 通用 | |
| `refusal_terms` | 拒答匹配词 | 替换策略 > 拒答替代 | 同上 | 角色 + 窗口 | 内置词表（`refusal.py:20`） | 通用 | ≤64 条 |

任务清单（`companion_v2/host/application.py:321-329` 注册，UI 分组见 `models-page.js:12-31`）。新 UI 一律按 `GET R` 返回的 `tasks[].kind` 是否存在来决定是否渲染（视条件项，工具不下线）：

| 分组（UI） | kind | 显示条件 / 依据 |
|---|---|---|
| 对话 | `conversation.reply` | 始终（只允许改附加提示） |
| 对话 | `conversation.context_image_caption` / `conversation.image_narration` | 仅当 `status.tasks` 含该 kind |
| 对话 | `conversation.video_narration` | 仅当 `status.tasks` 含该 kind（需视频能力 provider） |
| 感知 | `screen.interpretation` / `screen.peek` | 仅当存在屏幕授权（`perception-native` / screen access 状态；缺字段需新增探测） |
| 感知 | `image_review` | 始终注册；真实模型 profile（`review_service.py:33`） |
| 感知 | `conversation.image_review` | **不是模型任务**（`review_service.py:30` 是 action kind）；UI 仍把它当任务卡声明（`models-page.js:20`），永不渲染 |
| 主动与记忆 | `proactive.compose` / `proactive.judge` / `memory.reflect` | 始终 |
| 生活与成长 | `calendar.plan` / `role.state.maintain` / `role.reading.consume` / `role.growth.progress` | 始终 |
| 私人书写 | `role.journal.diary` / `.dream` / `.derive` / `.select` | 始终 |
| 学习 | `role.expression.learn` / `.review` / `.contact_review` / `role.self_review` | 始终 |
| 内容工作 | `content.authoring.draft` | 仅当 `status.tasks` 含该 kind（`content.authoring.draft`） |
| **未归组** | `conversation.poke_reply` | 仅 OneBot 平台（`platform_id ∈ {aiocqhttp, onebot, qq, default}`）且 `tasks` 含该 kind；UI 无分组 → 现落在「其他任务 / 其他模型任务」（`taskName` 102） |

### 2.2 语音（与「表达 > 语音朗读」共用同一批字段）

| 设置键 | 界面标签 | 所在页面/分区 | 读写 API | 作用层级 | 默认值 | 适用性 / 显示条件 | 备注 |
|---|---|---|---|---|---|---|---|
| `voice_zh/_ja/_en_provider_id` | 「中文/日语/英语 语音服务」 | 模型与连接 > 语音模型 > 语种绑定（`models-page.js:902`） | `GET R/voice`、`POST R/voice/save`（`model_api.py:799,807`） | 角色（`ConfigLayer.ROLE`，`model_api.py:822`） | `""`（跟随 AstrBot，`voice_reply.py:147-149`） | 通用 | 同一字段在表达页也叫「中文/日语/英语 TTS 扩展」 |
| `voice_private_<lang>_provider_id`、`voice_group_<lang>_provider_id`（6 个） | 「私聊/群聊 · 语种 覆盖」 | 语音模型 > 渠道覆盖（`906`） | 同上 | 角色 | `""` | 通用 | 表达页同名（`reply-page.js:365-367`） |
| `voice_timeout_seconds` | 合成超时（秒） | 语音模型 > 合成超时与保存（`921`） | 同上 | 角色 | `30`（`voice_reply.py:141`），限 1–120 | 通用 | 两处可改 |
| `voice_enabled` | 「语音回复」KPI（只读） | 语音模型顶部（`894`） | 无（只读投影 `model_api.py:783`） | 角色 | `false`（`tests/test_reply_web_api.py:46` 断言） | 通用 | 开关本体在表达页；关掉后所有绑定失效（`reply_settings.py:263-268`） |
| AstrBot `providers_config` 的 TTS 条目 | 「语音服务配置」 | 语音模型 > 连接管理（`ttsEditor` 772） | `GET R/tts/providers`、`POST .../create`、`.../update`、`.../clone`、`.../test`（`model_api.py:1315-1487`） | 安装（写回 AstrBot 宿主配置） | 13 种模板（`model_api.py:71-78`），新建默认 `enable=false` | 通用 | 等于在插件里做了一遍 AstrBot 的 Provider 管理 |

### 2.3 生图

| 设置键 | 界面标签 | 所在页面/分区 | 读写 API | 作用层级 | 默认值 | 适用性 / 显示条件 | 备注 |
|---|---|---|---|---|---|---|---|
| `image.generate` / `image.edit` / `image.mask_edit` | 三项能力开关 | 生图模型 > 能力（`imageActionRow` 1433） | `GET R/image`、`POST R/image/save`（`model_api.py:1041,1049`） | 安装（`data_root/model_image_routes.json`） | 全 `true`（`image_settings.py:14`） | 通用 | 另有「检查注册」按钮（走 `POST R/image/test`） |
| `image.output.enabled` | 「启用 V2 生图后端」 | 生图模型 > 模型与优先级 | `GET R/image/output`、`POST R/image/output/save`（`model_api.py:1528,1597`） | 安装 | `false` | 通用 | **与上面 3 个开关是两个不同总闸** |
| `image.output.backend` | （UI 不暴露） | — | 同上 | 安装 | `sd_webui`（`output_configuration.py:115`）；合法值 `auto` / `online_api` / `sd_webui` / `comfyui` | 通用 | 用户看不到却决定默认路由 |
| `image.output.endpoints[]`（`platform/model/base_url/api_key/timeout_seconds/width/height/size_label/quality/max_reference_images/enabled/name/custom_headers/clear_*`） | 每个模型一张卡 | 生图模型 > 模型与优先级（`imageRouteCard` 1364） | 同上 | 安装 | 端点无默认（新增时 `openai/1024x1024/180s/disabled`，`models-page.js:1589`）；`quality=standard`、`max_reference_images=1`（`1183-1184`） | 通用 | 单端点 ≈18 字段；`api_key` 留空=保留 |
| `image.output.operation_routes.generate / .edit` | 优先级顺序（上/下移） | 同上 | 同上 | 安装 | 按 backend 推导（`output_configuration.py:24-38`） | 通用 | 生成与改图各自一份队列 |
| `image.output.sd_webui.parameters`、`.comfyui.workflows` | 高级 JSON / 工作流 JSON | 同上 `<details>`（1389、1398、1510） | 同上 | 安装 | `{}` | 通用 | 按需展开（ComfyUI/SD 后端已配置时才显示） |
| `image.output.network.download_proxy / use_environment_proxy` | 图片下载代理 | 工作流与网络选项（1425） | 同上 | 安装 | 空 / 继承环境 | 通用 | |
| `image.output.legacy_backend / legacy_options` | 兼容参数 | 同上 | 同上 | 安装 | `""` / `{}` | 仅存在 legacy 数据时（`legacy_backend` / `legacy_options` 非空） | 默认折叠，仅 legacy 数据存在时展开 |
| `image.output` 组的 `trigger_mode/allow_user_requests/group_enabled/request_permission/proactive_probability/prompt_format/style/.../scene_presets_json` | 「生图偏好」 | **产出 → 生图触发与提示词**（`app.js:3354`、`config-editor.js:368-404`） | `CFG`（`configuration_api`） | 角色 | 见 `config-editor.js:368-404` 组定义 | 群聊相关（`group_enabled`） | 与上面的模型配置是**两个页面、两套保存**，但概念都是「生图」 |
| `photo.reference.enabled / group_enabled / daily_outfit_enabled / daily_outfit_rotation_days` | 参考图 / 每日穿搭 | 产出 → 参考图与衣柜配置（`app.js:3361,3825`）＋ 图片素材页顶部状态（只读） | `CFG` | 角色 | 全 `false`；轮换 14 天（`references/configuration.py:23-34`） | 通用 | |
| `wardrobe.enabled / prompt_enabled / tendency / image_prompt / prompt_max_items / image_max_count` | 衣柜 | 同上 | `CFG` | 角色 | `false` / `false` / 空 / 12 / 3（`references/wardrobe.py:26-46`） | 通用 | |
| 参考图资产（`asset_id/label/roles/usage/state/revision`） | 图库卡片 | 产出 → 参考素材与衣柜 | `GET IM`、`POST IM/references*`（`image_material_api.py:31-43`） | 角色 | 上线 24 张 / 单图 12 MiB（上传）· 20 MiB（相册）/ 角色 256 MiB | 通用 | |
| 衣柜条目（`item_id/name/description/tags/asset_id`） | 衣柜列表 | 同上 | `POST IM/wardrobe`、`/wardrobe/withdraw` | 角色 | — | 通用 | |
| 每日穿搭（`item_id`） | 「设为今日」 | 同上 | `POST IM/daily-outfit` | 角色 | — | 通用 | 需 参考图 + 衣柜 + daily 三开关同时开（`image-materials-page.js:139-141`） |

### 2.4 语义 / 表情

存储：`<data_root>/semantic-catalog.sqlite3` 的 `settings` 表（`companion_v2/storage/semantic.py:11-23,45-50`），**安装级全局一份**；界面却挂在某个目标/角色的「表达」页下。写入：`POST SEM {action:"configure", changes, revision}`（`semantic_api.py:261-264`）。

| 设置键 | 界面标签（表达页） | 界面标签（学习页） | 层级 | 默认值 | 适用性 / 显示条件 | 备注 |
|---|---|---|---|---|---|---|
| `enabled` | 启用语义目录 | 启用语义目录 | 全局 | `true` | 通用 | |
| `memory_enabled` | —（表达页不显示） | 语义记忆检索 | 全局 | `true` | 通用 | |
| `embedding_provider` | — | 向量模型（嵌入） | 全局 | `""` | 通用 | 空=纯词法回退 |
| `rerank_provider` | — | 候选重排 | 全局 | `""` | 收进高级 | 空即关 |
| `analysis_provider` | — | 视觉与词义分析 | 全局 | `""` | 通用 | 也用于 `vision_review` |
| `timeout_seconds` | 模型超时 / 秒 | 同 | 全局 | `8`（1–30） | 通用 | 带文字的表情约 1/3 超时（我们实测） |
| `batch_size` | — | 索引批次 | 全局 | `24` | 收进高级 | 纯实现细节 |
| `reactions_enabled` | 启用表情包表达 | — | 全局 | `true` | 通用 | |
| `reactions_private_enabled` | 私聊使用表情包 | — | 全局 | `true` | 通用 | |
| `reactions_group_enabled` | 群聊使用表情包 | — | 全局 | `false` | 群目标（`scope_kind==='group'`）时显示 | |
| `reactions_collection_private_enabled` / `_group_enabled` | 从私聊/群聊自动收录 | — | 全局 | `false` | 通用 | |
| `reactions_collection_private_probability` / `_group_probability` | 私聊/群聊收录概率 / % | — | 全局 | `0.1` | 收进高级 | 界面 0–100 %，后端 0–1 |
| `reactions_collection_mode` | 收录审核通过后 | — | 全局 | `automatic` | 通用 | 自动/待确认 |
| `reactions_proactive_enabled` | **无入口** | — | 全局 | `false` | — | 存在但 UI 不可达 |
| `reactions_trigger_probability` | 自动发送概率 / % | — | 全局 | `0.2` | 通用 | |
| `reactions_cooldown_seconds` | 发送间隔 / 秒 | — | 全局 | `180` | 通用 | |
| `reactions_delivery_mode` | 发送位置 | — | 全局 | `separate_after` | 通用 | 三态 |
| `reactions_image_format` | 发送格式（普通图片 / **QQ 表情**） | — | 全局 | `image` | 按 `platform_id` 过滤：OneBot 家族才列出 `qq_emoji`（`onebot.py:206`） | 微信侧 Face 会被适配器拒绝（`SendRejected(unsupported_component)`） |
| `slang_enabled` / `slang_learning` | — | 群聊黑话目录 / 自动学习 | 全局 | `true` / `true` | 仅群目标（`scope_kind==='group'`） | |
| `slang_web_search_enabled` / `_candidates` / `_results` | — | 黑话联网参考 / 检索词数 / 每条参考数 | 全局 | `false` / `4` / `2` | 视消费者开关（见 §6） | 依赖下一节的搜索绑定 |
| `learning_interval_seconds` | — | 群词义整理间隔 / 分钟 | 全局 | `21600`（6h） | 同上 | 界面分钟、后端秒 |
| `vision_review` | 识图复核 | 识图复核 | 全局 | `true` | 通用 | **与 `vision_verify_mode` 双开关** |

表情检索边界（**另一套存储**：配置注册表 `companion_v2/expression/reaction_configuration.py:45-84`，安装级，界面在「表达 → 表情配图 → 表情检索」`config-editor.js:406-430`）：

| 设置键 | 界面标签 | 默认值 | 默认位置 |
|---|---|---|---|
| `low_latency_enabled` | 低延迟模式 | `true` | 主界面（合并成「性能」） |
| `candidate_limit` | 每轮候选素材数 | `6`（1–24） | 始终 |
| `embedding_candidate_limit` | 向量检索候选上限 | `1200` | 高级 |
| `embedding_weight` | 向量权重 | `1.0` | 高级 |
| `embedding_score_threshold` | 向量相似度门槛 | `0.42` | 高级 |
| `embedding_backfill_enabled` / `_batch_size` / `_interval_seconds` | 后台补齐向量 / 批次 / 间隔 | `true` / `24` / `300` | 高级 |
| `vision_verify_mode` | 视觉复核（off/embedding/always） | `embedding` | 与 `vision_review` 合并为三态 |

### 2.5 搜索 / Laya / 预算

| 设置键 | 界面标签 | 所在分区 | 读写 API | 层级 | 默认值 | 适用性 / 显示条件 | 备注 |
|---|---|---|---|---|---|---|---|
| `deepseek_provider_id` | DeepSeek API 凭据来源 | 模型与连接 > 搜索服务（`1023`） | `GET R/search`、`POST R/search/save`（`model_api.py:661,674`） | 全局（`configuration_scope: global`） | `""`=自动 | 仅 `news_share_enabled` / `news_daily_hot_read_enabled` / `web_exploration_enabled` / `slang_web_search_enabled` 任一为真 | 只存 provider id，凭据在 AstrBot |
| `laya.enabled` | 启用 Laya | Laya 决策（`1093`） | `GET R/laya`、`POST R/laya/save`（`695,706`） | 全局 | `false` | 仅 `laya.enabled` 或 `package_installed` 为真时展开（`GET R/laya`） | |
| `laya.mode` | 接入方式（本地 Python / 远程 HTTP） | 同 | 同 | 全局 | `local` | 仅 `laya.enabled` / `package_installed` 时展开 | |
| `laya.endpoint` / `api_key` / `local_model_path` | 服务地址 / API Key / 检查点目录 | 同 | 同 | 全局 | `""` | 仅 `laya.enabled` / `package_installed` 时展开 | |
| `laya.timeout_seconds` | 调用超时 | 同 | 同 | 全局 | `20`（1–120） | 仅 `laya.enabled` / `package_installed` 时展开 | |
| `laya.followup_confidence_threshold` | 连续接话置信阈值 / % | 同 | 同 | 全局 | `0`=关 | 仅 `laya.enabled` / `package_installed` 时展开 | |
| `laya.decision_fields.*`（7 个） | 判断是否说完 / 对话行为 / 回复意图 / 表达风格 / 回复形式 / 分段倾向 / 能力需求 | 同 | 同 | 全局 | 全 `true` | 仅 `laya.enabled` / `package_installed` 时展开 | 模型输出 schema 的实现细节 |
| `model.budget.enable_daily_token_soft_limit` / `daily_token_soft_limit` | 启用每日软限额 / 每日软限额 | 模型与连接底部「后台任务预算」（`app.js:3662`） | `CFG`（**不在 model_api**） | 安装 + 角色 | `false` / `800000`（`budget.py:43-48`） | 通用 | 与生图/语音无关，纯成本控制 |

### 2.6 只读诊断（在 `model_api.py` 里，本区域不展示，另挂「治理与维护」）

`GET R/maintenance`（用量/缓存/预算诊断，`model_api.py:529`）、`GET R/memory`（532）、`GET R/balance`（543）、`POST R/test/storage`（579）、`GET R/image/observability`（1575）、`GET R/image/review/providers`（1561）、`GET R/laya/logs`（723）。这些接口保留：`/maintenance`、`/memory`、`/balance`、`/test/storage` 已在 `maintenance-page.js:3104` 与 `perception-overview.js` 使用，`/image/observability` 与 `/image/review/providers` 在 `output-page.js` 使用，`/laya/logs` 在模型页使用。新 UI 的做法是把它们统一收进「治理与维护 > 运行诊断」，不在能力页重复。

---

## 3. 操作清单

| 按钮/动作 | 位置 | API | 效果 |
|---|---|---|---|
| 刷新配置 | `models-page.js:274` | `GET R?layer=` | 重新读取并重建全部草稿 |
| 角色默认 / 当前私聊微调（作用域） | 288 | 无（只改查询 layer） | 切 layer，**有未保存改动时被拒绝**（618-625） |
| 搜索任务 / 按提供方筛选 / 视图切换 / 来源筛选 / 通道筛选 | 286-297 | 无（本地过滤） | 5 个筛选维度 |
| 批量指派模型提供方 | 298 + `assign` 532 | 无（只改草稿） | 能力不符的任务静默跳过并提示 |
| 恢复跟随上级 | 299 + `restoreInherit` 546 | 无 | 把 9 个字段全部标为继承 |
| 全部保存 / 核对保存 | 301-307 + `saveTasks` 466 | `POST R/configure`（逐任务） | 串行保存；bridge 超时会用同一 `operation_key` 重试一次（221-231） |
| 保存（单卡） | 396-401 | 同上 | |
| 放弃 / 已核对，保留草稿 | 394-399 | 无 / `GET R` | rebase 草稿基线 |
| 测试（provider 探活） | 396 + `probeProvider` 1665 | `POST R/test` | 30s 真实调用 |
| 批量测试 | 1690 + `runMapTest` 1677 | `POST R/test` ×N | 逐个 provider |
| 保存 / 放弃草稿（替换策略） | 1917 | `POST R/configure` | |
| 新增规则 / 删除 / JSON 失焦提交 | 2004、2006、1972 | 无（写草稿） | 规则序列化进 `replacement_rules` |
| 写入这项任务的时段规则 | 1876 + 2032 | 无（写草稿） | **会删除本任务所有「纯时段规则」**（2033-2034） |
| 语音：保存语音配置 | 923 | `POST R/voice/save` | 全量 `changes`，带 `edit_token` |
| 语音：测试合成 | 916 + `voiceTest` 691 | `POST R/voice/test`（125s） | 真实合成并回 base64 试听 |
| 语音：新建/保存/克隆/测试语音服务 | 798/808/809/810 | `POST R/tts/providers/*` | 写 AstrBot 宿主配置；多语种共用时自动「拆分克隆」 |
| 生图：保存能力开关 | 1455 | `POST R/image/save` | 3 个 bool |
| 生图：检查注册 | 1447 | `POST R/image/test` | 只查注册状态 |
| 生图：保存模型配置 | 1430 | `POST R/image/output/save`（revision） | 队列 + 端点 + 工作流一次提交 |
| 生图：生成测试图 | 1384 | `POST R/image/output/test` | **真实付费生成**，超时按端点超时 + 10s |
| 生图：上移/下移/移除/添加模型 | 1557-1570 | 无（改草稿） | |
| 搜索：保存搜索配置 | 1033 | `POST R/search/save`（revision） | |
| Laya：保存 / 测试 / 调用 / 复制安装命令 | 1101、1102、1111、1117 | `POST R/laya/save`、`/test`、`/decide` | 测试最长 600s；本地模式首次会下权重 |
| 语义：保存配置 / 重建索引 | `semantic-page.js:159-161`（学习）、`199-202`（表达） | `POST SEM action=configure`、`action=reindex` | revision 冲突保留草稿 |
| 语义：导入素材（多选 ≤20 张） | `semantic-page.js:386` | `POST SEM action=import` ×N | 逐张串行，失败计数 |
| 语义：检索 | `semantic-page.js:152` | `POST SEM action=search` | 与聊天内检索不是同一套排序（见 §5） |
| 语义：编辑 / 补全 / 删除 | `semantic-page.js:92-101,350` | `POST SEM action=edit`、`analyze`、`delete` | |
| 素材：登记相册图 / 上传 / 改用途 / 撤回 / 排序 | `image-materials-page.js:244-337`、`442-640`、`709-730` | `POST IM/references*` | 每动作一个 `operation_key`，即时生效，无「保存草稿」 |
| 素材：新增衣柜 / 设为今日 / 撤回 | 337、700、712 | `POST IM/wardrobe`、`IM/daily-outfit` | |

---

## 4. 重复与冲突

### 4.1 同一设置可在多个页面修改

| 设置 | 位置 A | 位置 B | 位置 C | 位置 D | 后果 |
|---|---|---|---|---|---|
| `voice_<lang>_provider_id`、`voice_<channel>_<lang>_provider_id`、`voice_timeout_seconds` | 模型与连接 > 语音模型（`models-page.js:880-923`，`POST R/voice/save`） | 表达 > 语音朗读（`reply-page.js:357-367`，`POST R/reply/configure`） | 成员/窗口编辑（`workspaces/identity/member-editor.js:99-103`） | 语音默认值（`host-options-page.js:80,339-342`，安装级） | 4 处写同一组角色字段，其中 2 处用不同 API、不同 revision 语义；表达页自己还写着「音色与 TTS 合成后端在『模型与连接』中配置」（`reply-page.js:508`），而它自己就有这些下拉（`1270-1272`） |
| `voice_enabled` | 表达 > 语音朗读（`reply-page.js:358`） | 成员/窗口编辑（`member-editor.js:99`） | 语音模型 KPI 只读（`models-page.js:894`） | 感知概览状态（`perception-overview.js:578,681`） | 关掉它会让模型页所有绑定静默失效，模型页只显示「未开启」 |
| `fallback` | 精确配置卡片（`models-page.js:370`） | 替换策略 > 拒答替代（`1886-1890`） | — | — | 同一字段两个编辑面，互不知道对方的草稿状态 |
| `replacement_rules` | 关键词换模规则卡（`1837`） | 高价时段替代（`1849`，会删掉纯时段规则） | JSON 源码框（`1847`） | — | 三个编辑器按不同语义重写同一 JSON |
| 表情开关（`reactions_*`） | 表达 > 表情配图（`semantic-page.js:38-43`） | 学习 > 语义目录（只有 `vision_review`，`semantic-page.js:44,141`） | 「表情检索」配置组（`config-editor.js:406`，另一套存储） | — | 表情能力有 **6 个开关散在 2 个页面 + 1 个配置组** |
| 「视觉复核」 | `vision_review`（语义设置，`semantic-page.js:43`） | `vision_verify_mode`（配置注册表，`config-editor.js:427`） | — | — | 同一能力两个开关，语义重叠且互不感知 |
| 生图总闸 | 能力开关 3 个（`models-page.js:1433`） | `image.output.enabled`（`1405`） | `photo.reference.enabled`（`app.js:3361`） | `wardrobe.enabled`（同上） | 「生图能不能用」要看 5 个开关 |
| 生图参数 | 模型与连接 > 生图模型（端点/队列/工作流） | 产出 > 生图偏好（`config-editor.js:368-404`：触发方式、提示词、风格、场景预设） | — | — | 两页都叫「生图」，一页管模型、一页管行为 |
| 语义 provider | 学习 > 语义目录（`semantic-page.js:45`） | 模型与连接 > 功能模型顶部横幅（`models-page.js:1597`，只跳转） | 感知概览（`perception-overview.js:599`，只显示） | — | 三处都在说「模型」，只有一处能改 |
| 后台预算 | 模型与连接底部（`app.js:3662`） | token 用量卡跳转（`app.js:4462,4700`） | — | — | 预算与「模型与连接」主题无关，却挂在这里 |

### 4.2 同一数据在多处展示

| 数据 | 展示位置 |
|---|---|
| 任务 → provider 路由 | 态势图清单（`1621`）/ 精确配置卡（`353`）/ 按提供方视图（`405`）/ provider 抽屉（`2042`）/ 快速配置卡（`1696`）/ token 用量卡跳转——**同一份数据 5 种画法** |
| provider 能力与上限 | 精确配置下拉（`382`）/ 态势图图例（`1645`）/ 按提供方 panel（`409`）/ 抽屉（`2046`）/ 测试结果（`396`） |
| 语义素材 | 表达页列表（`semantic-page.js:216`）/ 学习页列表（`renderLearning`）/ 感知概览计数 |
| 参考图与衣柜开关 | 图片素材页顶部徽标（`image-materials-page.js:200-213`）/ 产出页配置组（`app.js:3361`） |
| 生图能力状态 | 模型页 KPI + 每行 `state/loaded/registered` 诊断（`models-page.js:1440-1447`）/ 产出页 `outputProviderLine`（`app.js:3366`）/ 感知概览 |

### 4.3 同一概念多种叫法

| 后端概念 | 界面叫法 |
|---|---|
| AstrBot provider | 模型提供方（模型页）/ 模型服务 / Provider（错误文案里混用）/ 「语音服务」（语音 tab） |
| TTS provider | 「语音服务」（模型页）/ 「TTS 扩展」（表达页、成员页）/ 「Provider」（测试结果） |
| 语义模块 | 语义校验（page guard `app.js:1232`）/ 语义目录（学习）/ 语义理解与素材（页面标题）/ 表情配图（表达）/ 表情库 |
| 参考图 | 参考素材 / 参考图 / 图库 / 参考图库 / 相册（产出相册） |
| 角色/窗口层 | 角色默认 / 当前私聊微调 / 当前群聊微调 / 跟随上级 / 上级配置 / 单独设置 |
| 保存结果未知 | 「核对保存」/「核对原保存结果」/「保存结果待核对」/「可重试原操作」（`models-page.js:301-307,390-393`） |

### 4.4 语义冲突/重复实现

- UI 的任务分组是手写的，已与后端 profile 清单不一致：`screen.peek`（`models-page.js:18`）与 `conversation.image_review`（`models-page.js:20`）都不是模型 profile（前者是设备任务 `ScreenPeekService`，`screen/peek.py:34`；后者是 action kind，`review_service.py:30`，真正的 profile 是 `image_review`，`review_service.py:33`），**这两张卡永远不会出现**。
- 反过来，`conversation.poke_reply`（QQ 戳一戳）是真的模型 profile（`multi_session.py:422`），UI 分组里却没有（`models-page.js:12-31`），只能以「其他任务 / 其他模型任务」出现（`taskName` 102）。
- 语义页面的 `search` 与聊天内 `/表情` 检索使用**不同的排序参数**（`semantic_api.py:318` vs `reactions.py:281-292`），页面预览的「相似度」与实发不一致。
- 语义设置是**全局一份**（`semantic.py:45-50`），表达式页却按目标/角色渲染，用户会以为改的是当前角色。

---

## 5. 交互问题

| # | 问题 | 具体位置 | 说明 |
|---|---|---|---|
| 1 | 首屏即最重的视图 | `models-page.js` mount 默认 `tab:"fn", sub:"cfg", cm:"precise"`（2104-2118） | 精确配置**不折叠**（`.model-sc-bd` 始终渲染，`models-page.css:206`），≈22 张卡 × ≈17 个控件同时出现 |
| 2 | 9 个「跟随上级」复选框 | `models-page.js:386-390` | 字段与「是否继承」分列两行，反向心智模型；想改一项必须先取消勾选 |
| 3 | 保存模型有 6 种 | 任务：`saveTasks` + `operation_key` + `edit_token` + pending 队列（466-530）；语音：`voiceSave` + `edit_token` + 重试（668-689）；生图：能力开关无 token、模型配置用 `revision`（1300-1320）；Laya/Search：`revision`；语义：`revision` + 草稿；素材：每动作 `operation_key` 即时生效 | 同一页面内 6 种保存语义，用户无法形成预期 |
| 4 | 「保存结果未确认」话术 | `301-307`、`390-393`、`669-689` | 桥超时后按钮变成「核对保存」，文案是内部实现（幂等键/重放）泄漏 |
| 5 | 作用域切换被草稿阻塞 | `618-625` | 「请先保存或放弃当前范围的改动，再切换配置作用域」，无法一步切换 |
| 6 | 群目标下 4/5 个标签不可用 | `model_api.py` 只为 `GroupModelWebAPI` 注册 2 条路由（`group_model_api.py:23-25`） | 选群后点「语音/生图/搜索/Laya」会走未注册路径，只得到「无法读取…」；UI 仍显示 5 个 tab |
| 7 | 能力不符只在保存/指派后暴露 | `assign` 532-545、`validatePatch` 258-274 | 下拉只过滤能力匹配项，但 fallback 与上限冲突要等保存 |
| 8 | 输出上限被静默改小 | `fitLimit` 127、`fnInput` 564-566 | 改 provider 时自动改 `max_output_tokens` 并弹提示，用户原值丢失 |
| 9 | 时段带 + 起止 + 时区三件套 | `1862-1865`（24 格）、`1827` 与 `1989`（`Asia/Shanghai` 硬编码） | 用户只需要「晚上别用贵模型」，却要理解时段格 |
| 10 | 替换策略作用范围三态 | `1904-1908` | 「仅插件调用 / 仅普通对话模型 / 全部生效」是内部路由概念 |
| 11 | 语音页默认日语、绑定计数写死 | `2110`（`ui:{lang:"ja"}`）、`894`（`bound + "/3"`） | 中文用户首屏看到日语；渠道数是硬编码 |
| 12 | TTS 连接管理是运维界面 | `ttsEditor` 772-812 | 13 种 provider 模板、动态密钥字段、克隆语义、`enable` 默认关，属于 AstrBot 宿主职责 |
| 13 | 生图端点 18 字段 + 3 段 JSON | `imageRouteCard` 1364-1400、`imageConfigEditor` 1403-1431 | 平台列表还含「待适配 · 可保留原配置」三项（`1343`）；`legacy_options` 原样展示 JSON |
| 14 | 「生成测试图」会花钱 | `1384`、`imageEndpointTest` 1247 | 提示写在页面底部小字里（`1430`） |
| 15 | Laya 是开发者工具 | `1093-1129` | 复制 shell 安装命令、Python 解释器路径、HF 缓存路径、请求/响应原始 JSON |
| 16 | 语义页一屏 20+ 控件 | `semantic-page.js:103-162` | 学习视图 6 开关 + 3 provider + 5 数字；表达视图 6 开关 + 4 数字 + 3 下拉；百分比/秒/分钟三种单位在前后端各转一次（`semantic-page.js:193,364`） |
| 17 | 语义状态词晦涩 | `semantic-page.js:107,186`（`ready/lexical_fallback/disabled`）、`129`（「向量待重建」） | 用户不知道「关键词回退」意味着什么 |
| 18 | 语义索引进度不可见 | `run("reindex")` 295-320 | 只回「已安排」，异步重建无进度 |
| 19 | 素材页动作全部即时生效 | `image-materials-page.js:442-640` | 没有草稿/撤销；排序是唯一有「保存图库」的动作（377-388），与其它动作不一致 |
| 20 | 素材页前置条件链 | `image-materials-page.js:139-141,238` | 每日穿搭需 3 个开关同时开，关闭时按钮直接消失（不解释） |
| 21 | 错误码折叠 | `model_api.py` 中 `model_request_invalid` 覆盖 15 处成因；`semantic_api.py:240-256` 把所有 ValueError 折成 `semantic_request_invalid`；`image_material_api.py:186-190` 同样 | 用户看到同一句话，无法自查 |
| 22 | 英文码直出 | `image-materials-page.js:18-56` 映射表未覆盖 `reference_limit_reached`/`*_too_large`/`image_material_request_invalid` | 界面会显示原始 code |
| 23 | 加载时长不可控 | `semantic_api.py:218-232`（24 条 × 缩略图解码）、`semantic_search.py:88-107`（全量扫描 + 分批补向量，冷启动数十秒）、`models-page.js` 30s 超时、语音测试 125s、生图端点测试最长 1900s | 长任务没有进度，只有「测试中…」 |
| 24 | 循环跳转 | 模型页横幅「打开向量模型配置」→ 学习 > 语义目录（`models-page.js:1597`）；语义页「语义提供方」→ 模型页（`semantic-page.js:156`） | 两页互指，用户找不到「到底在哪设」 |
| 25 | 双挂载点 | `app.js:965` 与 `app.js:1998` 两个 `#modelWorkspace` | 感知页里的模型面板与主页面是同一组件，任何状态不共享（`states` 按 key 缓存，图层仍在但草稿各自一份） |

---

## 6. 按条件显示（不做功能删减）

本区域**不删任何能力**：旧的 UI 入口可以合并，但每个能力在重构后都必须仍然可达。下表给每项在什么条件下显示、判断依据来自哪个字段；没有可判断字段的，最后单列“需新增的能力探测”。判断依据全部来自现有接口（`GET R` = 任务状态，`GET SEM` = 语义，`GET IM` = 图片素材，`GET R/laya`、`GET R/voice`、`GET R/image*` 同前）。

| 对象 | 显示条件 | 依据字段 / 接口 | 缺字段时 |
|---|---|---|---|
| 任务卡（每类模型任务） | `tasks[].kind` 存在即显示 | `GET R` → `tasks[]` | — |
| 上下文图片摘要 / 当前图片转述 | `tasks` 含 `conversation.context_image_caption` / `conversation.image_narration`（后端按 provider 能力决定是否注册） | `GET R` | — |
| 视频转述 | `tasks` 含 `conversation.video_narration`（需 video 能力 provider） | `GET R` | — |
| 群聊成图审核 | `tasks` 含 `image_review` | `GET R` | — |
| 能力开关：生图 3 个动作 | `GET R/image` 的 `actions[].action` 存在；单项 `state==='ready'` 才算“可调用” | `actions[].state/loaded/registered/diagnostic_code` | — |
| 生图模块诊断行 | `module.state!=='running'` 或任一 `action.state!=='ready'` | `module.state`、`module.issue_code`、`actions[].diagnostic_code` | — |
| 生图后端与队列（文生图/改图） | `GET R/image/output` → `enabled===true` 且 `operation_routes[op].length>0` | `settings.enabled`、`operation_routes` | — |
| 端点连接字段（地址/密钥/协议） | 端点卡展开时 | `endpoints[].base_url/api_key_set/clear_api_key`、`platform` | — |
| 尺寸标签 vs 宽高 | `endpoint.size_label===''` 时显示宽高，否则显示尺寸标签 | `endpoint.size_label` | — |
| 图片质量 / 最多参考图 | `endpoint.platform!=='minimax'`（minimax 不支持改图与质量） | `platform` + `max_reference_images` | — |
| 自定义请求头 | `endpoint.custom_header_names` 非空，或用户主动展开 | `custom_headers_set`、`custom_header_names` | — |
| 协议下拉里的“待适配”项 | 始终列出，但标注需适配；可否调用由 `imageRouteAvailable()` 判定 | `IMAGE_PROTOCOL_SUPPORT`、`imageRouteAvailable` | — |
| ComfyUI / SD WebUI 工作流 | 对应后端出现在 `operation_routes` 里 | `config.comfyui.base_url`、`sd_webui.base_url` | — |
| 图片下载代理 | 展开“工作流与网络选项” | `network.download_proxy_set/use_environment_proxy` | — |
| legacy 兼容参数 | `legacy_backend` 非空或 `legacy_options` 非空 | `GET R/image/output` | — |
| “生成测试图” | `config.enabled && endpoint.enabled && platform 已适配 && 无未保存改动` | `imageRouteAvailable()` + `endpoint.platform` | — |
| 语音语种绑定（3 个） | `GET R/voice` → `languages[]` 始终存在；`bind` 为空时选项显示“跟随会话” | `languages[].bind`、`providers[]` | — |
| 语音渠道覆盖（6 个） | 至少一个 `channels[].bindings` 有值，或用户展开“渠道覆盖” | `channels[].bindings` | 判断“是否配过”需后端补计数字段 |
| 合成超时 | `voice_enabled===true` 时显示；关闭时折叠 | `GET R/voice` → `voice_enabled` | — |
| 测试合成 / 试听 | 当前语种 `bind` 指向 `providers[]` 中已加载的 id | `languages[].bind` ∈ `providers[].id` | — |
| TTS 连接管理（新建/克隆/启用/密钥） | 用户展开“管理连接”，或 `providers.length===0` 时直接显示“新建” | `GET R/tts/providers` → `items`、`templates`、`catalog_state` | 版本不支持时报 `tts_provider_unsupported` |
| 替换策略（关键词/时段/拒答） | 该任务 `fields.replacement_rules.explicit===true` 或 `fields.fallback_on_refusal.explicit===true`；否则收进“高级路由” | `GET R` → `fields.*.explicit` | — |
| 高价时段替代 | 上述条件且 `replacement_rules` 中已存在 `time_window` 规则 | 解析 `fields.replacement_rules.value` | — |
| 拒答替代 | `fields.fallback_on_refusal.explicit===true` 或 `fields.fallback.explicit===true` | 同上 | — |
| 语义目录总闸 / 提供方 / 超时 | `GET SEM` → `settings` 可读即显示 | `settings.enabled`、`providers.embedding` | — |
| 语义记忆与群黑话 | 目标 `scope_kind==='group'` 且 `selection_ready===true` | `GET SEM` → `selection_ready`、`sessions` | 群尚无消息时只能读不能写（`semantic_group_input_required`） |
| 黑话联网 3 项 | `settings.slang_enabled && settings.slang_web_search_enabled` | `GET SEM` → `settings` | — |
| 表情开关（私聊/群聊） | `settings.enabled && settings.reactions_enabled` | `GET SEM` → `settings` | — |
| 自动收录与收录概率 | 对应 `reactions_collection_private_enabled` / `_group_enabled===true` | 同上 | — |
| 表情素材库列表 | `catalog.reaction.total>0`；为 0 时只显示“导入” | `GET SEM` → `catalog.reaction` | — |
| 检索 / 索引状态 / 重建索引 | `state!=='disabled'`；重建索引还要 `selection_ready===true` | `.state`、`.selection_ready` | — |
| 「QQ 表情」发送格式选项 | `target.platform_id` ∈ `{aiocqhttp, onebot, qq, default}`（`product-page.js:676` 已按此判定平台）；`wechat_helper` 下不渲染该选项 | `catalog.targets[].platform_id` | 想做“该平台是否支持 Face”的精确判断，需新增发送能力探测 |
| 戳一戳任务卡（`conversation.poke_reply`） | 平台属 OneBot 且 `tasks` 含该 kind | `platform_id` + `GET R` | 同上 |
| 屏幕解读 / 屏幕速览任务卡 | 存在屏幕授权 | `GET <role>/perception-native`、`screen-access` | 需新增“屏幕/摄像头授权”聚合探测 |
| 参考图 / 衣柜 / 每日穿搭 | `GET IM` → `settings.references.enabled`、`settings.wardrobe.enabled`、两者开且 `daily_outfit_enabled` | `GET IM` | — |
| 产出相册登记 | `references.enabled && album.items.length>0` | `GET IM/album` | — |
| 图库排序保存按钮 | 草稿顺序与基础顺序不同 | 前端 `galleryBaseOrder` vs draft | — |
| 后台预算输入 | `enable_daily_token_soft_limit===true` | `CFG budget` | — |
| 搜索服务绑定 | 任一消费者开启：`news_share_enabled` / `news_daily_hot_read_enabled` / `web_exploration_enabled`（感知配置组 `share.news` / `share.web`）或 `slang_web_search_enabled` | `CFG` + `GET SEM` + `GET R/search` | 若前端读不到这些配置，需新增“搜索是否被使用”探测 |
| Laya 整块 | `laya.enabled===true` 或 `package_installed===true` 或（`mode==='remote'` 且 `endpoint` 非空）；否则只留一个入口开关 | `GET R/laya` | — |
| Laya 安装命令 | `package_installed===false`（本地）或 `mode==='remote'` | `install_command` / `remote_install_command` / `remote_start_command` | — |
| Laya 决策分类 7 项 | `enabled===true` | `decision_fields` | — |
| Laya 预览 / 日志 | `enabled===true` | `GET R/laya/logs` | — |
| 路由总览（原态势图）/ 批量测试 / provider 抽屉 | 保留为“路由总览”视图；任务数 > 6 时默认展开，否则折叠 | `tasks.length` | — |
| 诊断类接口（`/maintenance`、`/memory`、`/balance`、`/test/storage`、`/image/observability`、`/image/review/providers`） | 不放能力页，统一挂到「治理与维护 > 运行诊断」；该页已在用 `/maintenance` 与 `/voice`（`maintenance-page.js:3104`） | 对应 GET/POST | — |
| 解释性长句 | 不作为独立区块；只在错误态下显示一句原因 | 现有 notice 字段 | — |

### 6.1 需新增的能力探测（后端目前没有字段）

| 想要的显示条件 | 缺什么 | 现状证据 |
|---|---|---|
| “该平台能否发表情 / QQ 表情 / 戳一戳” | 平台能力声明（如 `supports_face`、`supports_poke`） | 适配器只声明 `supports_images` / `supports_poke`（`multi_session.py:468`），且 `supports_poke=True` 是硬编码；`wechat_helper` 实际会拒 Face（`SendRejected(unsupported_component)`） |
| “屏幕 / 摄像头 / 现实硬件是否授权” | 授权状态聚合（现在分散在 `perception-native`、`screen-access`、`reality-access`） | `multi_api.py:167-175` 三个路由相互独立 |
| “搜索有没有被任何能力使用” | 一个 `search_consumers` 汇总（现在要读 `share.news`/`share.web` 配置 + 语义设置） | `news_events.py:94-102`、`semantic.py` 分散 |
| “某个能力是否曾经配置过” | 语义/语音/生图的 `explicit` 汇总计数（语音只有 `bind` 字符串，分不清默认与显式） | `GET R/voice` 无 explicit 字段；语义/任务路由有 `explicit` |
| “当前任务属于前台还是后台” | 已有 `tasks[].lane`，可直接用 | 无需新增 |

## 7. 功能完整性清单（重构不得丢失）

新 UI 可以换布局、改叫法、收起细节，但下表每一项都必须仍能操作与读取；括号里是判断它有没有被漏掉的核对点。

| # | 能力 | 现有入口 | 关键字段 / 接口 | 核对点 |
|---|---|---|---|---|
| 1 | 任务模型路由 | 模型与连接 > 功能模型 | `provider` / `fallback` / `max_output_tokens` / `timeout_seconds` / `prompt`（`POST R/configure`） | 每个 `tasks[].kind` 都能改到；`conversation.reply` 只开放 `prompt` |
| 2 | 替换与兜底规则 | 模型与连接 > 替换策略 | `replacement_rules` / `replacement_scope` / `fallback_on_refusal` / `refusal_terms` | 能编辑、能保留 JSON 原样 |
| 3 | 批量指派与继承 | 快速配置 / 工具条 | `fields[].explicit` | 能批量写，也能恢复继承 |
| 4 | 连通性测试 | 卡片“测试”、态势图批量测试 | `POST R/test` | 单 provider 与批量两条路径都在 |
| 5 | 语音语种绑定 | 模型与连接 > 语音模型 | `voice_<lang>_provider_id`、`voice_<channel>_<lang>_provider_id`、`voice_timeout_seconds`（`POST R/voice/save`） | 3 语种 + 6 渠道 + 超时 |
| 6 | TTS 服务管理 | 语音模型 > 管理连接 | `GET/POST R/tts/providers/*`（create/update/clone/test） | 新建、改密钥、克隆、启用、测试 |
| 7 | 语音试听 | 语音模型 | `POST R/voice/test` | 能听到 base64 音频 |
| 8 | 生图动作开关 | 生图模型 | `image.generate/edit/mask_edit`（`POST R/image/save`）、`POST R/image/test` | 3 个开关 + 注册检查 |
| 9 | 生图后端与队列 | 生图模型 | `image.output.enabled`、`operation_routes`（`POST R/image/output/save`） | 两个功能的模型顺序都能调整 |
| 10 | 在线模型连接与密钥 | 生图模型 > 端点卡 | `endpoints[]`（15 子字段）、`clear_api_key`、`clear_custom_headers` | 能改地址/密钥/协议/尺寸/质量/参考图上限 |
| 11 | 本地后端（ComfyUI / SD WebUI） | 生图模型 | `sd_webui.*`、`comfyui.workflows`、`/image-schema` 表单 | 能编辑工作流 JSON 与采样参数 |
| 12 | 网络与 legacy | 生图模型 > 工作流与网络选项 | `network.*`、`legacy_backend`、`legacy_options` | 能改代理；legacy 只读也要能看到 |
| 13 | 生图测试 | 端点卡 | `POST R/image/output/test` | 保留（真实调用，需确认） |
| 14 | 语义设置 27 项 | 学习 > 语义目录 / 表达 > 表情配图 | `POST SEM action=configure` | 27 个键一个都不能丢（含 `reactions_proactive_enabled` 目前无 UI） |
| 15 | 表情检索边界 9 项 | 表达 > 表情配图 > 表情检索 | `CFG` 的 `expression.reaction` 组 | 9 个键都在 |
| 16 | 素材库操作 | 表达 > 表情配图 / 学习 > 语义目录 | `POST SEM` import/search/edit/analyze/delete/reindex | 6 个 action 全在 |
| 17 | 收录概览 | 表达 > 表情配图 | `GET SEM` → `reaction_collection` | 能看四类计数与最近记录 |
| 18 | 参考图库 | 产出 > 参考素材与衣柜 | `GET IM`、`POST IM/references*`（含 order） | 上传、登记、改用途、排序、撤回 |
| 19 | 产出相册 | 同上 | `GET IM/album` | 分页可读、可登记 |
| 20 | 衣柜与每日穿搭 | 同上 | `POST IM/wardrobe`、`/wardrobe/withdraw`、`/daily-outfit` | 新增、撤回、设为今日 |
| 21 | 搜索绑定 | 模型与连接 > 搜索服务 | `deepseek_provider_id`（`POST R/search/save`） | 能选、能存、能看到可用性 |
| 22 | Laya 全部配置 | 模型与连接 > Laya 决策 | `POST R/laya/save`、`/laya/test`、`/laya/decide`、`GET R/laya/logs` | 6 输入 + 7 分类 + 测试 + 预览 + 日志 |
| 23 | 后台预算 | 模型与连接底部 | `CFG` → `model.budget.*` | 两个键 |
| 24 | 诊断只读 | 治理与维护 > 运行诊断 | `GET R/maintenance`、`/memory`、`/balance`、`POST R/test/storage`、`GET R/image/observability` | 全部仍可达，只是搬家 |
| 25 | QQ 平台能力 | 语音/表情/任务卡 | `qq_emoji`、`conversation.poke_reply` | 平台切到 OneBot 时必须自动出现，不能被写死成隐藏 |

## 8. 给新 UI 的建议

**目标：一屏四张卡，不减少可做的事。**

进入「能力」页（左侧导航一行，如「能力」），从上到下四张卡，每张卡固定三行：能力名 + 开关（或「跟随」）+ 一句状态 + 一个主操作。

```
┌ 聊天回复  ────────────────────────────────┐
│  模型：AstrBot 当前会话（只读）             │
│  后台任务：▾ 跟随聊天  /  指定模型          │
└────────────────────────────────────────────┘
┌ 表情包  ── 已开（私聊）· 群聊开 ───────────┐
│  素材 323 张 · 平均 3.4s                    │
│  [管理素材]                                 │
└────────────────────────────────────────────┘
┌ 语音  ── 已关 ─────────────────────────────┐
│  日语：fishaudio-ja · 中文：跟随            │
│  [试听]  [更换]                             │
└────────────────────────────────────────────┘
┌ 生图  ── 已开 ─────────────────────────────┐
│  模型：Seedream 4.0 · 参考图 3 张           │
│  [生成一张试试]                             │
└────────────────────────────────────────────┘
```

具体收敛规则（对齐“像苹果一样”的产品原则；每条都保留原能力）：

1. **只需要一个「模型」概念。** 后台任务默认全部跟随聊天模型，主界面只暴露一个「后台任务用便宜模型」的开关 + 一个下拉；`provider/fallback/max_output_tokens/timeout_seconds` 仍在，藏在「高级路由」里（依据 §6 的 `explicit` 判定是否已单独设置）。
2. **能力=卡片，细节=卡内折叠。** 5 个主标签 + 3 个子标签 + 3 种替换策略合并为 4 张卡；替换规则/拒答/时段收进「高级路由」抽屉，字段与 JSON 原样保留，不再占首屏。
3. **作用域默认角色层。** 窗口级微调收进对象切换器（`layer=window` 仍可用），不再作为主界面开关；群目标下只显示后端已注册的两条路由对应的功能，语音/生图/搜索/Laya 显示为“切换回私聊对象后可配置”，而不是报错。
4. **一个能力一个主开关，细分条件显示。** 生图：`image.output.enabled` 作为主开关，3 个 action 开关放在卡内；语音：`voice_enabled` 与语种绑定合并；表情：私聊/群聊两个勾选，QQ 表情项按 `platform_id` 出现。
5. **状态只说两句话。** 「可用」/「不可用（已自动重试）」；`diagnostic_code`、`owner`、`registered`、`adopted`、`lexical_fallback` 收进「详情」折叠，默认不显示。
6. **保存只有一个模型：即时保存 + 乐观更新。** `edit_token`/`revision`/`operation_key` 对用户不可见；冲突时重读并提示「已同步」。语义/素材/语音/生图全部走这一条路径，删除“核对保存”这套话术。
7. **素材库独立成页**（从「表情包」卡进入）：网格 + 导入 + 删除 + 搜索；`tags/emotions/intents/visible_text/manual_fields` 仍在编辑抽屉里，只是不占列表。语义参数（embedding/rerank/权重/门槛/批次/回填）收进「高级」。
8. **默认收起、不删能力**：Laya、搜索服务、TTS 连接管理、路由总览/批量测试、替换策略、预算、诊断接口全部保留入口；前四项按 §6 的条件显示。
9. **后端需要补的探测**（否则只能写死隐藏，等于变相删功能）：平台发送能力（Face/戳一戳）、屏幕与现实硬件授权聚合、搜索消费者汇总、语音/语义“是否曾显式配置”的计数。见 §6.1。
10. **可选聚合接口**：`GET /capabilities` 一次返回 voice + image enabled + semantic settings + catalog 计数，避免新首页打 5 个接口、等 5 个 30s 超时。

---

## 附：本区域事实速查

- `model_api.py` 共 33 条路由；`GroupModelWebAPI` 只有 2 条；`semantic` 是单路由 + 7 个 action；`image-materials` 10 条。
- 设置级可写键约 80 个：语义 27（`semantic.py:11-23`）+ 表情检索 9（`reaction_configuration.py:46-57`）+ 语音绑定 10（`model_api.py:52-63`）+ 任务路由 9（`management.py:23-24`，按任务分片）+ 生图动作 3 + 生图 output 8 组（`output_configuration.py:232-235`）+ Laya 6+7 + 搜索 1 + 预算 2。界面几乎全部暴露，另加单端点 15 个子字段。
- 已注册模型任务 21–23 个（固定 20 + `content.authoring.draft` + 条件项 `conversation.image_narration` / `conversation.video_narration`；我们环境 22 个）。UI 分组声明 24 个：多 2 个永不出现的（`screen.peek`、`conversation.image_review`），漏 1 个 QQ 戳一戳（`conversation.poke_reply`）。
- 单条表情素材上限 5 MiB / 16 Mpx；body 7 MiB；语义超时默认 8s（1–30）。
- 参考图：上线 24 张 / 上传 12 MiB / 相册 20 MiB / 角色总量 256 MiB；相册 16 张一页（480px 缩略图）。
