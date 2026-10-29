# 陪伴插件 UI 重构 · reply 区域只读审计

- 仓库：`/home/claude/Documents/program/astrbot_plugin_private_companion`，分支 `wechat`，基线 `2e29e3f`
- 范围：回复/表达/决策/感知/主动联系 —— `reply-page.js`、`decision-page.js`、`perception-overview.js`、`contact-page.js`、`config-editor.js`（+ 实际承载编辑内核的 `workbench-page.js`），后端 `reply_api.py`、`group_reply_api.py`、`configuration_api.py`、`host_options_api.py`、`companion_v2` 配置合同
- 只读：未改动仓库任何已有文件，未提交，未访问线上接口
- 配套机器可读清单：`docs/ui-audit/reply.items.json`（398 条，每处可见/可编辑位置一条）

## 0. 结论摘要

| # | 结论 | 依据 |
|---|---|---|
| 1 | **名义四层继承，实际只有两个可写作用域**：私聊回复固定写角色层，群回复固定写窗口层。用户从不在这四层里做选择 | `reply_api.py:85`（`layer=ConfigLayer.ROLE`）、`group_reply_api.py:119`（`ConfigLayer.WINDOW`）、`reply_settings.py:35` |
| 2 | **表达设置在界面上有 4 个物理落点，只有 1 个组件**：表达页、决策页内部、理解页、以及被 `append()` 在 3 个 host 之间搬动 | `app.js:909-918`、`app.js:3475-3496` |
| 3 | **决策页自身 0 请求、0 输入控件**，却渲染 5 tab / 20 张 stat 卡；真实控件全由 reply-page 与 config-editor 挂入 | `grep -cE "fetch|apiGet|request" decision-page.js` = 0；`decision-page.js:262-298` |
| 4 | **`proactive.contact` 有 16 个字段当前没有任何 UI**（含 5 个提示词模板），因为承载它们的编辑器挂在永不存在的容器上 | `app.js:3651-3656`（`renderContactPageOriginal` 零调用）、`app.js:3846`、`reply.items.json` `status=no_entry` |
| 5 | **「恢复继承」在 25/26 个分区是死按钮**：请求体只在声明了 `resetKey` 时才带 `reset_to_inherit`，全仓仅 3 处声明 | `workbench-page.js:2328`、`management.py:209,213`、`reply-page.js:1266` |
| 6 | **11 个字段的界面标签被段说明覆盖**（JS 字面量后者覆盖前者），页面上直接把一段话当标签显示 | `reply-page.js:137` vs `:152`；`:141-145` vs `:153-162`；`reply.items.json` `label_override_count>1` |
| 7 | **语音被切成两半**：概率类在宿主配置（AstrBot 插件设置），其余在角色层，两个页面两份存储 | `reply_settings.py:41-44`（`VOICE_FIELDS` 排除 4 个概率/冷却）、`host_options_api.py:92-118` |
| 8 | 感知页 1424 行里**只有 5 个输入字段**（NewAPI 余额表单），其余是只读通道、解释文案与约 300 行缓存/焦点恢复 | `perception-overview.js:403-465`、`grep -c "render("` = 36 |

**对重构最要紧的一句**：这个区域的复杂度不在"功能多"，而在**同一批配置被 6 个挂载点、3 个页面、2 套写入语义反复投影**。新 UI 要做的不是减功能，是把"一个字段一个家"。

---

## 1. 页面/视图清单

### 1.1 导航入口（全站仅 21 个一级入口）

`app.js:51-56` 定义 4 组导航；本区域占 5 项：

| 组 | 入口 | 路由 | 挂载 |
|---|---|---|---|
| 互动能力 | 感知 | `manage/perception` | `app.js:985` → `perception-overview.js` + 4 个配置 tab |
| 互动能力 | 理解 | `manage/understanding` | `app.js:915-916` → reply-page `view:'perception'` |
| 互动能力 | 决策 | `manage/decision` | `app.js:885-888` → `decision-page.js` |
| 互动能力 | 主动联系 | `manage/contact` | `app.js:857-860` → `contact-page.js` |
| 互动能力 | 表达 | `manage/expression` | `app.js:909-912` → reply-page `view:'expression'` |

别名路由（同一页面两套地址）：`app.js:227-231` —— `reply→[manage,expression]`、`preferences→[manage,contact]`、`semantic→[manage,perception]`。

### 1.2 表达页（reply-page `view:'expression'`）

4 层导航：`互动能力` → `表达` → 5 个模块 tab → 工作台分区侧栏 → 预览弹窗。

| # | 层 | 内容 | 位置 |
|---|---|---|---|
| 1 | 模块 tab（5） | 文字风格与分段 / 语音朗读 / 表情配图 / 平台动作 / 群聊表达 | `app.js:3506-3512` |
| 2 | 设置卡 | 卡头 + 作用域徽标 + 左侧分区导航 + 字段行 + 底部操作条 | `reply-page.js:1250-1288` |
| 3 | 分区（7） | 分段回复 17 / 说话方式与表达形式 4 / 文字整理 7 / 语音与朗读 22 / 私聊·群聊语音覆盖 6 / 引用与消息组件 7 / 发送前检查 6 | `reply-page.js:290-372` |
| 4 | 预览卡 | 三态格 + 左栏示例输入 + 右栏结果 + 2 个内部 `<details>` | `reply-page.js:893-919` |
| 5 | 预览配置弹窗 | 示例预设 / 预览会话 / 5 个位置下拉 / 高亮保护范围 | `reply-page.js:881-891` |
| 6 | 回复诊断 | 每轮一个 `<details>`，默认折叠，默认抓 80 轮 | `reply-page.js:558-637` |

折叠/记忆：分区选择只在内存（`workbench-page.js:989`），不落 localStorage；草稿与未确认请求进 sessionStorage（`workbench-page.js:12,1018-1024`）。

### 1.3 决策页（decision-page.js）

**不是独立页面，是 3 个宿主容器的编排层**：自身只渲染 tab 与统计卡。

| # | tab | 标签 | 实际控件来源 |
|---|---|---|---|
| 0 | `overview` | 总览 | 无（5 stat 卡 + 4 段判断链 + 8 chip + 4 行快照 + 4 个跳转） |
| 1 | `response` | 回应判断 | reply-page 3 段 13 字段 |
| 2 | `tempo` | 参与节奏 | reply-page 4 段 18 字段 |
| 3 | `safety` | 沉默与安全 | reply-page 4 段 13 字段 + `busy_gate`/`life` 16 字段 + 玩笑护栏 |
| 4 | `group` | 群聊参与 | `group_participation` 16 字段 + 本群插话 5 字段（窗口层） |

- `decision-page.js:3-9` 定义 5 view；`:16` 默认 `overview`
- `:217-232` 按 view 显示 `#decisionReplyWorkspace`（response/tempo/safety）、群聊编辑器（safety/group）、本群插话（group）
- `:10-14` 的 `replyViewSections` **从未被使用**，且已与活映射 `reply-page.js:426-430` 漂移（缺 `group_continuation`、`private_debounce`）
- `decision-page.js:184-190` 每次状态变化整块 `innerHTML` 重写；`:258-260` 任意输入触发 `renderPanels()`

### 1.4 主动联系页（contact-page.js）

左侧 8 项竖排轨道 + 右侧单视图整块重绘（`contact-page.js:952-957`、`:2029`），默认 `dial`，**全文只有 1 个 `<details>`**（测试结果里的技术详情 `:1420`），所有内容一次铺开。

| # | 视图 | 布局块 | 可编辑键 |
|---|---|---|---|
| 1 | 节律盘 | 全局开关 / 免打扰外圈 / 活动曲线次圈 / 强度三圈 / 问候窗口内圈 + SVG 钟面 | 16 |
| 2 | 晨间唤醒 | 晨间流程 / 角色作息 / 清醒确认 | 14 |
| 3 | 消息测试 | 概览 + 覆盖统计 + 17 张测试卡 + 确认 dialog | 0（调试） |
| 4 | 契机矩阵 | 概况 4 数字 + 筛选 + 3 桶（关系/日程/分享） | 30（15 目的×2） + 15 只读 chip |
| 5 | 开口闸门 | 5 张判定卡 + 回复与补看 + 临时暂停 | 2（其余为只读复述） |
| 6 | 额度与去重 | 每日额度 / 重复抑制 / 连发与收尾 | 15 |
| 7 | 外部触发源 | 8 组（天气/预警/资讯/饭点与纪念日/网络探索/屏幕与动作/约定与上下文/余额与其它） | 58 |
| 8 | 主动检视 | 类型筛选 + 工具条 + 素材卡网格 | 0（展示） |

### 1.5 感知页（perception-overview.js + app.js 写死的配置区）

两段结构：**只读仪表盘 + 配置工作区**（后者才是 tab，默认 `hidden`）。

| 区块 | 内容 | 位置 |
|---|---|---|
| 页头 | kicker「实时感知」+ 标题「感知仪表盘」+ 同步胶囊 +「N 个感知通道 · M 项实况在线」+ 重新读取 | `perception-overview.js:916-927` |
| 板 1 时空·环境 | 地点/时钟/日期/农历/节气/黄历/预警/温度/重要日子 | `:790,856-890` |
| 板 2 模型能力 | 对话/TTS/生图/视觉 4 磁贴 | `:791,894-896` |
| 板 3 现实感知功能 | 定位/识屏/手机/摄像头/米家 | `:792,808-827` |
| 板 4 外部与记录 | 余额/外部资讯/撤回记录/其他注入 | `:793,828-855` |
| 配置工作区 | 4 tab × 14 个 `<details>`，**全部默认 `open`** | `app.js:1954-2078` |

### 1.6 通用分层编辑器（config-editor.js → workbench-page.js）

**首要更正**：`config-editor.js`（1927 行）自述为薄适配层（`config-editor.js:1-7`），只存 26 个分区的标题/标签/帮助/枚举/域内错误码；字段渲染、层轨、草稿、脏状态、冲突、幂等重试全在 `workbench-page.js`（2524 行，`workbench-page.js:1-13`）。`config-editor.css` 仅 25 行，且只样式化旧类名。

| 对外接口 | 位置 | 说明 |
|---|---|---|
| `create(kinds, rootProvider, views, endpointOverride)` | `config-editor.js:1769` | 一个挂载点可挂多个分区，每分区独立实例/独立 `edit_token` |
| `spec` / `searchEntries` / `errors` / `endpointFor` | `:1926` | 声明表 + 全局搜索 + 错误码中文映射 + 路由推导 |
| 内核 `create(...)` | `workbench-page.js:949` | 返回 `save/saveField/dirty/changedFields/saveBeforeLeave/discard/selectSection/setVisibleGroups` |
| 调用点 | `app.js:3723-3737`（`mountConfigEditor`）+ 30 处挂载 `app.js:3748-3860`；`setup-guide.js:96/470/2535` | |

---

## 2. 设置项清单

> 完整逐条清单见 `reply.items.json`（398 条）。本节按分区给字段、层级、默认值与平台/能力条件。
> 行号为 `pages/陪伴小屋/` 下文件行号，默认值取自后端 defaults。

### 2.1 表达页 · 分段回复（17 项，role 层）

| 字段 | 标签原文 | 控件 | 默认 |
|---|---|---|---|
| `enabled` | 启用分段 | 开关 | true（`segmentation.py:233`） |
| `streaming` | 启用模型流式传输 | 开关 | 快照给出 |
| `streaming_mode` | 流式分段发送方式 | 单选：收齐后分段发送／边生成边分段发送 | buffered |
| `llm_controlled` | 由模型决定边界 | 开关 | false |
| `rule_mode` | 规则分段方式 | 单选：词列表／正则表达式／按句子／按段落 | words |
| `split_words` | 分段标记词 | 词条列表 ≤80 | `。？！~～?.!;；……）…` |
| `match_width_variants` | 兼容全角与半角标点 | 开关 | true |
| `rule_regex` | 分段正则表达式 | 多行 3 行 | `(?<=[。！？!?…~～])\s*\|\n+` |
| `threshold` | 规则分段字数阈值 | 数字 1–65536 | 500 |
| `min_segment_chars` | 短段合并参考字数 | 数字 | 5 |
| `max_segments` | 最多消息条数 | 数字 1–64 | 5 |
| `prompt` | 模型分段提示词 | 多行 4 行 ≤4000 | ""（内置默认） |
| `part_gap_mode` | 分段间隔方式 | 单选：固定／随机／按文本长度 | log |
| `part_gap_ms` | 固定段间隔（毫秒） | 数字 0–60000 | 由 gap 推算 |
| `part_gap_min_ms` / `part_gap_max_ms` | 随机间隔下限／上限 | 数字 100–60000 | 1500 / 3500 |
| `part_gap_log_base` | 按长度调节强度 | 权重 1.1–5.0 | 2.1 |

### 2.2 表达页 · 其余 6 个分区（52 项）

| 分区 | 字段 | 备注 |
|---|---|---|
| 说话方式与表达形式（4） | `prompt_style_mode`(约束/自由/引导, 默认自由)、`style_prompt`、`enable_humanized_expression`(默认 false)、`humanized_expression_prompt` | 两个提示词是 `ROLE_PROMPT_FIELDS`（`reply_settings.py:36`），同 payload 内但只写角色层 |
| 文字整理（7） | `content_cleanup_enabled`(true)、`_mode`、`_scope`、`_rule`、`_words`、`content_replacement_enabled`(false)、`content_replacements` | 旧值 `all` 前端改写为 middle（`reply-page.js:670-673`） |
| 语音与朗读（22） | `voice_enabled`(false)、`voice_trigger_mode`/`generation_mode`/`conversion_scope`/`segment_mode`/`delivery_mode`/`language`/`foreign_text_mode`/`position`、`voice_provider_id`、`voice_probability`、`voice_cooldown_seconds`、`voice_max_speech_chars`(1800)、`voice_timeout_seconds`(30)、`voice_zh/ja/en_provider_id`、`voice_trigger_keywords`、`voice_extra_prompt`、`voice_primary_mention_*`(3) | 见 §6：概率/渠道冷却在宿主配置，不在此 |
| 私聊/群聊语音覆盖（6） | `voice_private_{zh,ja,en}_provider_id`、`voice_group_{zh,ja,en}_provider_id` | 留空跟随语种绑定 |
| 引用与消息组件（7） | `component_order`、`reply_quote_enabled`(false)、`reply_quote_group_enabled`(true)、`reply_quote_first_part_only`(true)、`reply_quote_skip_chars`(0)、`reply_mention_speaker_enabled`(false)、`image_position`(after_text) | 平台条件见 §6 |
| 发送前检查（6） | `framework_error_guard_enabled`(true)、`enable_forbidden_word_recall`(false)、`recall_forbidden_words`、`recall_forbidden_scope`、`recall_forbidden_word_case_sensitive`、`reply_diagnostic_limit`(80) | 最后一项是"诊断区长度"，属调试 |

### 2.3 决策页 · 回应判断 / 参与节奏 / 沉默与安全（44 项，role 层）

| 段 | 字段（默认） |
|---|---|
| 明确参与信号（5） | `group_wakeup_enabled`(true)、`group_wakeup_direct_words`、`group_wakeup_context_words`、`group_wakeup_question_enabled`(false)、`group_wakeup_question_threshold`(65) |
| 兴趣与概率参与（4） | `group_wakeup_interest_keywords`、`group_wakeup_interest_probability`(0.18)、`group_wakeup_image_enabled`(false)、`group_wakeup_image_weight`(0.2) |
| 直呼与成员（4） | `group_wakeup_bot_name_enabled`(true)、`group_wakeup_bot_name`、`group_wakeup_primary_member_ids`、`group_wakeup_owner_direct_words` |
| 冷场与等待（4） | `group_wakeup_cold_group_enabled`(false)、`_threshold`(65)、`_idle_minutes`(25)、`group_wakeup_short_text_wait_ms`(15000) |
| 疲劳与冷却（7） | `group_wakeup_fatigue_limit`(5)、`_decay_minutes`(90)、`group_wakeup_cooldown_seconds`(90)、`group_wakeup_generated_keyword_limit`(24)、`group_wakeup_topic_interest_max_boost`(45)、`group_wakeup_debounce_pending_penalty`(65)、`group_wakeup_log_limit`(80) |
| 连续对话与熔断（3） | `group_conversation_followup_enabled`(true)、`_seconds`(120)、`_max_turns`(3) |
| 私聊节奏·连续输入（4） | `private_debounce_enabled`、`_min_ms`(1500)、`_max_ms`(4000)、`_total_ms`(8000) |
| 沉默策略（3） | `recall_silence_enabled`(true)、`private_closing_guard_enabled`(true)、`private_closing_guard_prompt_enabled`(true) |
| 空气护栏·细则（5） | `group_air_guard_enabled`(true)、`_window_seconds`(60)、`_max_bot_replies`(3)、`_cooldown_seconds`(150)、`_polite_loop_limit`(2) |
| 私聊收尾·细则（2） | `private_closing_guard_window_seconds`(1800)、`group_high_intensity_enabled`(false) |
| 内容护栏·挡说错话（3） | `enable_group_injection_guard`/`_privacy_guard`/`_reality_promise_guard`（均 true） |

### 2.4 主动联系（`proactive.contact`，173 项，installation 层）

| 分区（config-editor 口径） | 字段数 | 当前渲染位置 |
|---|---|---|
| master 总开关与补充偏好 | 3 | 主动联系（节律盘 + 开口闸门） |
| rhythm 开口节奏与每日额度 | 6 | 主动联系 3 项；**3 项无入口** |
| freshness 素材与关系线索时效 | 1 | 状态页（按窗口）；主动联系无 |
| intensity 强度档位与连发 | 11 | 主动联系 10 项；**1 项无入口** |
| quiet 免打扰与临时暂停 | 5 | 主动联系 + 状态页（双处） |
| dedup 重复与抑制 | 7 | 主动联系 |
| judgement 开口判定与人格复核 | 6 | 主动联系 3 项；状态页 2 项；**1 项无入口** |
| followup 接回旧话题时机 | 2 | **无入口** |
| greeting 问候与失眠夜 | 10 | 主动联系 7 项；**3 项无入口** |
| morning 起床与晨间确认 | 14 | 主动联系（晨间唤醒） |
| meal 饭点话题 | 4 | 主动联系 + 感知（双处） |
| date 生日与纪念日 | 3 | 感知；`important_dates` 无控件 |
| weather 天气与预警 | 8 | 主动联系 + 感知（双处） |
| news 外部资讯源 | 8 | 主动联系 + 感知（双处） |
| web 网络探索 | 4 | 主动联系 + 感知（双处） |
| selflink 外部事件与自身经历关联 | 3 | 感知 |
| balance 余额感知 | 9 | 主动联系 + 感知（双处） |
| screen 屏幕观察 | 8 | 主动联系 + 感知（双处） |
| action 语音与戳一戳 | 6 | 主动联系 |
| appointment 约定执行时机 | 3 | 主动联系 |
| context 生成上下文 | 3 | 主动联系 2 项；**`style_prompt` 无入口** |
| prompts 主动表达模板 | 4 | **全部无入口** |
| 15 个目的 × {enabled, weight, pause_until} | 45 | 契机矩阵（`pause_until` 只读 chip） |

### 2.5 群聊参与 / 忙碌闸门 / 状态页

| 组 | 项数 | 层 | 位置 |
|---|---|---|---|
| `conversation.group_participation` | 28 | role（本群插话 5 项为 window） | 决策页 群聊参与 + 表达页 群聊表达（去噪） |
| `busy_gate` | 7 | role | 决策页 沉默与安全；主动联系 开口闸门 |
| `life`（休息/补看） | 6 | role | 同上两处 |
| `state-contact.js`（按窗口） | 21 | window | 状态页 行为规划与沉默 |

### 2.6 感知页

| 内容 | 项数 | 说明 |
|---|---|---|
| 余额数据源表单 | 5 | `url` / `user_id` / `value_divisor` / `api_key` / `clear_configuration`（`perception-overview.js:430-436`） |
| 配置折叠块内嵌编辑器 | 6 个挂载点 | `proactive.contact` 的 meal/date/weather/news+web+selflink/balance/screen 切片（`app.js:3772-3786`） |
| 原生感知 / 模型路由 / 现实扩展 | 由其余页渲染 | `perception-native-page.js`、`models-page.js`、`native-extension-management.js`（本次未逐字段核对） |
| 宿主语音默认值 | 4 | `voice_reply.{enabled,probability,private_probability,group_probability}`（`host_options_api.py:114-118`，宿主选项页） |

---

## 3. 操作清单

| 页面 | 动作原文 | API | 效果 |
|---|---|---|---|
| 表达 | 保存 / ⌘S | `POST {reply_api}/configure` | 显式保存，`changes` 只带改动字段 |
| 表达 | 使用已保存配置 | — | 丢弃草稿 |
| 表达 | 全部恢复继承 | `POST {reply_api}/configure`（`reset_to_inherit`） | 仅本页声明了 `resetKey`，可用 |
| 表达 | 分段效果预览 / 立即预览 | `POST {reply_api}/preview` | 260ms 防抖自动预览，不调模型 |
| 表达 | 简单/复杂/模型边界示例 | — | 换示例文本 |
| 表达 | 预览配置（弹窗） | — | 5 个下拉**均为预览模拟**，不写入任何设置 |
| 表达 | 回复诊断展开 | `GET {reply_api}` → `recent` | 读最近 N 轮 |
| 决策 | 5 个 tab / 判断链 4 卡 | — | 纯视图切换 |
| 决策 | 跳到 模型与连接 / 群聊回应理解 / 表达约束 / 群聊词义 / 表达去噪 | — | `data-go` 委托 |
| 主动联系 | 保存 / 放弃改动 / 重新读取 | `POST /config/configure` · `GET /config?sections=` | 只写 installation 层 |
| 主动联系 | 消息测试（17 卡） | `POST setup/proactive-diagnostic` | **真实投递**到管理员私聊，超时 180s/300s |
| 主动联系 | 恢复默认曲线 / 拉平 / 强度 5 档 | — | 只改草稿 |
| 主动联系 | 刷新检视记录 / 筛选 | `GET perception-native/materials` | 素材池与发送轨迹 |
| 主动联系 | 调整开口闸门 | — | 跳到 `busy_gate`/`life` 编辑器并聚焦 |
| 感知 | 重新读取状态 | **一次发 9 个请求**：`model`、`/voice`、`/image`、`perception-native/runtime`、`semantic`、`reply/recalls`、`extensions`、`model/balance`、`host-options/balance` | 全量重读 |
| 感知 | 通道卡/板头 | — | 打开下方配置并滚动 |
| 感知 | 余额 测试连接 / 保存 / 移除 | `POST host-options/balance[/test]` | 写宿主配置 |
| 群回复 | （无独立按钮） | `POST {group reply_api}/participation/configure` | 本群插话 5 字段，支持 `reset_to_inherit` |

---

## 4. 重复与冲突

### 4.1 同一字段的多个可见/可编辑位置（机器统计 79 条）

| 字段组 | 位置 1 | 位置 2 | 位置 3 |
|---|---|---|---|
| `proactive.contact.quiet_*` / `pause_until` / `note` | 主动联系 节律盘/开口闸门 | **状态页**（按窗口，`state-contact.js:4-19`） | — |
| `enabled` / `automatic_enabled` | 主动联系 开关 | 主动联系 闸门只读卡 | 环心 verdict 与页头徽章 |
| `proactive_hour_activity_curve` | 主动联系 24 柱编辑器 | 同页 textarea | 同页 次圈柱图 |
| `weather_*` / `news_*` / `meal_*` / `balance_*` / `screen_glance_*` | 主动联系 外部触发源 | **感知页** 对应折叠块 | — |
| `busy_gate` / `life` | 决策页 沉默与安全 | 主动联系 开口闸门 | 表达页（`replyGateConfigWorkspace` 声明但容器 dead） |
| `group_wakeup_*` | 表达页 群聊表达 | 决策页 回应判断/参与节奏 | — |
| `group_interject_*` | 决策页 本群插话（window） | `group_participation` 编辑器 | 直接接口 `/participation` |
| `silence_min_confidence` / `silence_feedback_penalty` / `event_max_age_seconds` | 状态页（按窗口） | — | 主动联系无入口（见 §7） |
| `voice_*` 概率 | 宿主语音默认值 | 表达页语音与朗读（其余参数） | — |

### 4.2 同一份配置的多套编辑 UI

| 组 | UI 套数 | 说明 |
|---|---|---|
| `proactive.contact` | **3 套** | ①`contact-page.js`（133 键，活）②`config-editor.js` 21 分区（**死**，容器永不出现）③`state-contact.js`（按窗口，活） |
| `conversation.presentation` | **4 个落点** | 表达页 / 决策页 / 理解页 / 群聊表达，同一组件被 `append()` 搬运（`app.js:3475-3496`） |
| `conversation.group_participation` | **3 处** | 决策页（behavior 段）／本群插话（独立端点）／表达页 群聊表达 去噪 |

### 4.3 同一概念的不同叫法（原文）

| 概念 | 别名 |
|---|---|
| 分段 | `分段回复` / `分段` / `分段效果预览` / `规则补充` / `模型边界` / `分段路径` |
| 频率 | `强度档位` / `开口节奏与每日额度` / `节律盘` / `活动曲线·按小时权重` / `相对权重` / `分享类开口概率` / `间隔·等候基础值` |
| 额度 | `每日额度` / `每日上限` / `每日确认上限` / `每日最多实际联系` / `本窗口每日最多实际联系` |
| 不打扰 | `免打扰时段` / `安静时段` / `预约定前静默` / `收尾静默时长` / `暂缓` |
| 暂停 | `临时暂停` / `暂缓全部联系至` / `暂缓中` / `全局暂停中` |
| 开口 | `开口` / `联系` / `投递` / `发送` / `主动消息` |
| 语音 | `语音与朗读` / `语音朗读` / `朗读位置预览` / `语音表达偏好` / `宿主语音默认值` |
| 消息组件 | `引用与消息组件` / `平台动作` / `消息组件顺序` / `组件位置策略` / `组件挂载·预览模拟` |
| 回退 | `继承自角色` / `恢复继承` / `全部恢复继承` / `使用已保存配置` / `安装与角色` |
| 诊断 | `回复诊断` / `近期回复诊断条数` / `近期判定记录上限` / `内容指纹` |

### 4.4 语义冲突（会误导用户）

| 冲突 | 证据 |
|---|---|
| 界面写「立即生效」，后端是「下一条封存回复生效」 | `workbench-page.js:910` 显示 `立即生效`；`reply_management.py:154` `apply_mode="next_sealed_reply"`；前端只把 `next_task` 认作下一个任务生效 |
| 预览弹窗 5 个位置下拉**没有一个是真实设置**，且后端预览永远把图片挂末段 | `reply-page.js:888`；`reply_management.py:184` |
| 主动联系页徽标「全局设置」，但 `max_contacts_24h` 是窗口级字段，关系层写入会被拒 | `contact-page.js:939`；`configuration.py:32,392-398` |
| 感知页与主动联系编辑同一组字段，但一个用「全局默认」，一个用「按来源」切片 | `app.js:3772-3786`、`app.js:3846` |
| 状态页与主动联系对同一字段用不同单位写法（秒/分钟后缀 vs unit 小字） | `state-contact.js:5-9` vs `contact-page.js:1044-1047` |

### 4.5 死代码与孤儿挂载点

| 项 | 位置 | 事实 |
|---|---|---|
| `renderContactPageOriginal` | `app.js:3651-3656` | 零调用 → `#contactPreferencesWorkspace` 永不出现 → config-editor 的 `proactive.contact` 21 分区不可达 |
| 搜索跳转目标 | `app.js:4474` | `proactive.contact` 跳 `#contactPreferencesWorkspace`（不存在） |
| `#busyGateWorkspace` | `app.js:3768` | 全仓无此容器，挂载分支永不命中 |
| `decision-page.js` `replyViewSections` | `:10-14` | 定义后从未使用，且已漂移 |
| `reply-page.js` | `:519-523`、`:638-647` | `state.loading/denied/notice/bad`、`summary()`、`imageLabel()` 无赋值/无调用 |

---

## 5. 交互问题

| # | 类别 | 位置 | 具体表现 |
|---|---|---|---|
| 1 | 层级过深 | `app.js:1739` → `:3506` → `workbench-page.js:856` → `reply-page.js:881` | 改一个「合成超时」要穿 3 次导航 + 1 个弹窗 |
| 2 | 一屏塞太多 | `contact-page.js:1703-1797` | 外部触发源 58 项 / 8 组 / 无折叠；晨间唤醒 14 项整屏 |
| 3 | 分区不翻页而是全平铺 | `workbench-page.js:842,953` | `navigationLimit` 默认 8，超出即全部平铺；`proactive.contact` 25 段时单页铺满 |
| 4 | 解释文案爆炸 | `reply-page.js:164-288`（helps 90+ 条，永不折叠）、`contact-page.js:1091-1097`（105 个控件各带一行小字） | 说明量 > 控件量；17 个分段字段配 600+ 字说明 |
| 5 | 标签被长句覆盖 | `reply-page.js:137` vs `:152`、`:141-145` vs `:153-162` | **11 个字段**的标签实际是一段说明，页面上把整句话当标签 |
| 6 | 状态提示过多 | 表达预览三态格 + 状态行 + `实时` 徽标 + dirty 文字 + notice + 按钮文字；主动联系 页头徽章 + 环心 verdict + 5 张闸门卡 | 同一件事 3–6 处指示器 |
| 7 | 保存模型难预测 | `workbench-page.js:920-931,1018-1024,2311-2340`；`contact-page.js:406-472` | 显式保存 vs 只提交改动字段 vs pendingWrite 幂等重发 vs 冲突保留草稿；pending 存在时全页字段静默置灰（`contact-page.js:761-762,2043`） |
| 8 | 错误提示晦涩 | `workbench-page.js:2386` 兜底「保存未通过。请读取当前设置后核对。」；`reply-page.js:1223`「配置工作台未加载」 | 实现内部名（工作台/已初始化对象/角色映射）直接上台面 |
| 9 | 死按钮 + 错误提示指错方向 | §0-5 | 点「恢复继承」→ 后端报 `*_configuration_invalid` → 界面显示「请核对数值是否在范围内」，而用户没填任何数值 |
| 10 | 层级对键盘/读屏不可达 | `workbench-page.js:431,435` | 层轨整体 `aria-hidden`，节点是无动作属性的 `<span>`，层名只在 tooltip |
| 11 | 只读字段无可见解释 | `workbench-page.js:775,792,800` | 控件 `disabled`，原因藏在 aria-hidden 的 title |
| 12 | 每次加载全页重建 | `perception-overview.js:927`（`root.innerHTML`）+ 36 处 `render(` | mount 并发 9 个 refresh，每个渲染两次 |
| 13 | 展示占据首屏 | `decision-page.js:74-135`；`perception-overview.js:749-779` | 决策页 20 张 stat 卡全是设置复述；感知页 16 通道里 10 个在我们场景永远「暂无快照/需授权」 |
| 14 | 术语密度高 | `contact-page.js:1185,1581,1703,1915`；`reply-page.js:40-44,83` | 契机矩阵 / 开口闸门 / 节律盘 / 主动检视 / 空气护栏 / 短段合并参考字数 |
| 15 | 量纲三套控件 | `contact-page.js:1026,1051,1707` | 时刻字段混用 `time` 输入与自由文本 `07:45-10:20`、`08:30` |
| 16 | 数学不可见 | `contact-page.js:1005-1010,1144-1153` | 真实间隔 = 基础值 × 档位乘数，用户需心算 |
| 17 | 加载等待无进度 | `contact-page.js:2378-2388`（bridge.ready 最长 10s）、`:2272`（测试 180s/300s） | 只有一句「正在运行…」 |
| 18 | 空态用词五种 | `reply-page.js:630,783,802,872,915` | 「暂无/无组件/无样本/无附加提示词/等待预览」 |

---

## 6. 按条件显示清单（能力/平台驱动，不删功能）

原则：**功能全部保留**，新 UI 只根据"当前实际接入的平台 + 已装配的扩展 + 已配置的后端"决定显示/收起。判断依据如下。

### 6.1 可用的判断源

| 判断源 | 接口/字段 | 位置 |
|---|---|---|
| 平台 | `targets[].platform_id` / `platform_name`；已有平台标签映射 `qq/aiocqhttp/onebot → QQ · OneBot`、`qq_official(_webhook) → QQ 官方机器人`、其它 → `当前平台` | `product-page.js:676`；清单来自 `GET .../staging` → `targets` |
| 扩展装配状态 | `GET /astrbot_plugin_private_companion/integration/manifest` → `extensions[]`：`capability_id`、`integration_state`、`desired_state`、`assembled` | `integration_api.py:29-58`；前端 `app.js:436-438,1688` |
| 扩展目录 | capability：`content`(含 QQ 空间)、`image`、`reality`、`screen`、`together`、`game`、`live`、`private_core_legacy` | `integration_catalog.py:13-52` |
| 能力是否可用 | 错误码 `capability_not_installed` / `capability_not_active` / `capability_role_disabled` / `capability_consent_missing`；动作级 `invokable` 布尔 | `reality-access.js:12-15,106`；`screen-access.js:10-12`；`game-access.js:13` |
| TTS 是否可用 | `GET {reply_api}` → `status.tts.providers`（`[{id, model, voice}]`） | `reply_api.py:109-110`；`reply-page.js:1269-1303` |
| 模型能力 | `GET {model_api}`、`/voice`、`/image`、`balance` | `perception-overview.js:958-1009` |
| 文档解析是否装好 | `GET {reply_api}` → `status.documents`（`parser_availability()`） | `reply_api.py:110-112` |
| 网页理解 | `GET {reply_api}` → `status.web` | `reply_api.py:113-117` |
| 余额源是否配好 | `GET host-options/balance` → `has_api_key` / `source` | `host_options_api.py:124-129`；`perception-overview.js:420-436` |
| 资讯源 | `news_source_kind`（`host` / `disabled` / `bilibili` / `rss` / `json`） | `perception-native-page.js:23-29` |

### 6.2 按平台条件显示

| 字段/功能 | 条件 | 依据 |
|---|---|---|
| `reply_quote_enabled` / `reply_quote_group_enabled` / `reply_quote_first_part_only` / `reply_quote_skip_chars` | 平台能提供"可引用的原始消息"才有意义（微信场景返回空） | `outbound_plan.py:77-88`：无 `inputs` 直接返回 `""` |
| `reply_mention_speaker_enabled` | 平台支持原生 @ | `reply-page.js:211` help 自述依赖原生 @ |
| `component_order` 中的 `at` / `face` | `face` 仅 OneBot 适配器构造 | `onebot.py:211-212` |
| `poke_action_enabled` / `poke_action_daily_limit` / `poke_action_cooldown_minutes` + 宿主 poke 策略 | 平台支持戳一戳（OneBot 家族） | `host_options_api.py:62`；`companion_v2/conversation/pokes.py` |
| 显示名/群名片相关（OneBot 查询） | 平台能查显示名 | `astrbot_host/display_names.py` |

### 6.3 按扩展装配状态条件显示

| 字段/功能 | 条件 | 依据 |
|---|---|---|
| `screen_glance_*`（8 项）、感知页「识屏信息」「屏幕解读与观察契机」、`screen_glance_enabled` 相关 `action` 目的 | `screen` 能力已装配且当前作用域可用 | `integration_catalog.py:37`；`screen-access.js:10-12` |
| 现实触及相关（定位/手机/摄像头/米家）、`app.js:2038-2050` 两个折叠块 | `reality` 能力已装配且逐动作 `invokable` | `integration_catalog.py:32`；`reality-access.js:12-15,106` |
| 一起房间 / 游戏棋桌 / 直播与表演 | `together` / `game` / `live` 能力 | `integration_catalog.py:42-52`；`game-access.js:13` |
| QQ 空间（qzone 组、发说说/点赞/回复） | `content` 能力 + QQ 系平台；未装配时现已有兜底文案 | `integration_catalog.py:22`；`app.js:3856-3862`（`qzoneConfigUnavailable`） |
| 生图 / 相册 | `image` 能力 + `model_api` 有图像模型 | `integration_catalog.py:27` |

### 6.4 按"已配置后端"条件显示（字段级）

| 字段组 | 条件 | 依据 |
|---|---|---|
| `voice_*` 全部（表达页语音分区、私聊/群聊覆盖 6 项） | `status.tts.providers` 非空；为空时整区收起并给一句"去模型与连接配置 TTS" | `reply_api.py:109-110` |
| `voice_action_*`（3 项） | 同上 | 同上 |
| `group_wakeup_image_enabled` / `_weight` | 有视觉模型且本轮可带图 | `model_api /image` |
| `enable_context_image_captioning` / `context_image_caption_max_items`、理解视图「图片视觉转述」8 项 | 有视觉模型 | 同上 |
| 理解视图「文件理解」6 项 | `status.documents` 可用（`parser_availability`） | `reply_api.py:110-112` |
| 理解视图「模型能力」下的网页/联网相关 | `status.web` | `reply_api.py:113-117` |
| `news_*`（8 项）+ 感知「外部资讯源」 | `news_source_kind != disabled` 且有可用来源 | `configuration.py:246-252` |
| `official_weather_alert_enabled` / `official_alert_*`（3 项） | 天气源支持预警 | 天气源配置（感知页） |
| `balance_*`（9 项）+ 感知余额表单/通道 | `host-options/balance` 配好 `has_api_key` | `host_options_api.py:124-129` |
| `web_exploration_*`（4 项） | 允许联网检索 | `configuration.py:247-249` |
| 宿级语音概率 4 项 | 同 TTS 条件 | `host_options_api.py:92-118` |

### 6.5 现成的平台相关帮助文案（新 UI 可以保留语义、精简措辞）

- `reply-page.js:211`：语音核心用户提及依赖原生 @
- `reply-page.js:509`：音色与 TTS 合成后端在「模型与连接」中配置
- `contact-page.js:1745`：屏幕观察依赖设备侧原生调用
- `app.js:2148-2160`：各能力 `actionProviderStatus` 已有"未装配/已暂停/状态待检查"三态

---

## 7. 功能完整性清单（新 UI 验收用）

格式：功能 → 当前入口 → 依赖接口。
标 **⚠ 无入口** 的 16 项是当前**没有任何界面可达**的字段，新 UI 必须补上（这是"100% 覆盖"的硬缺口）。

### 7.1 表达（69 项，全部有入口）

| 功能 | 当前入口 | 依赖接口 |
|---|---|---|
| 分段开关 / 流式 / 流式方式 | 表达 › 文字风格与分段 › 分段回复 | `GET/POST {reply_api}` → `/configure` |
| 分段规则（词列表/正则/句子/段落） | 同上 | 同上 |
| 分段阈值 / 短段合并 / 最多条数 | 同上 | 同上 |
| 模型分段提示词 | 同上 | 同上 |
| 分段间隔（固定/随机/按长度） | 同上 | 同上 |
| 说话方式（提示词风格 / 风格提示词 / 拟人表达） | 同上 › 说话方式与表达形式 | 同上 |
| 文字清理与替换 | 同上 › 文字整理 | 同上 |
| 语音开关与 8 个形式参数 | 同上 › 语音与朗读 | 同上（TTS 目录来自 `status.tts`） |
| TTS 绑定（通用 + 3 语种） | 同上 | 同上 |
| 私聊/群聊语音覆盖（6） | 同上 › 私聊/群聊语音覆盖 | 同上 |
| 消息组件顺序 / 引用 4 项 / @ 发言者 / 图片位置 | 同上 › 引用与消息组件 | 同上（平台条件见 §6.2） |
| 发送前检查（框架标记/命中词/范围/大小写/诊断条数） | 同上 › 发送前检查 | 同上 |
| 分段效果预览 | 同上 预览卡 | `POST {reply_api}/preview` |
| 回复诊断 | 同上 › 回复诊断 | `GET {reply_api}` → `recent` |

### 7.2 决策（44 + 28 + 13 项）

| 功能 | 当前入口 | 依赖接口 |
|---|---|---|
| 群聊回应总闸 / 直呼词 / 上下文词 / 提问阈值 | 决策 › 回应判断 | `GET/POST {reply_api}` |
| 兴趣关键词与概率 / 图片相关性 | 同上 | 同上 |
| 角色群名 / 主要成员 / 专属直呼 | 同上 | 同上 |
| 冷群重启 3 项 / 短消息等待 | 决策 › 参与节奏 | 同上 |
| 疲劳 2 项 / 冷却 / 记忆兴趣词 / 加权 / 降权 / 记录上限 | 同上 | 同上 |
| 非点名续接 3 项 | 同上 | 同上 |
| 私聊连续输入防抖 4 项 | 同上 | 同上 |
| 撤回沉默 / 私聊收尾 3 项 | 决策 › 沉默与安全 | 同上 |
| 空气护栏 5 项 / 高强度硬收口 | 同上 | 同上 |
| 3 个内容护栏 | 同上 | 同上 |
| 群聊话题线 / 氛围 3 项 / 名场面 2 项 | 决策 › 群聊参与 | `POST /config/configure`（`group_participation`） |
| 复读参与 9 项 | 同上 | 同上 |
| 玩笑护栏 | 同上（附加边界） | 同上 |
| 本群主动插话 5 项（窗口层） | 决策 › 群聊参与 | `GET/POST {group reply_api}/participation` |
| 忙碌闸门 7 项 / 休息与补看 6 项 | 决策 › 沉默与安全；主动联系 › 开口闸门 | `POST /config/configure`（`busy_gate`、`life`） |

### 7.3 主动联系（173 项）

| 功能 | 当前入口 | 依赖接口 |
|---|---|---|
| 总开关 / 后台自动 / 补充偏好 | 主动联系 › 节律盘 / 开口闸门 | `GET /config?sections=proactive.contact` → `POST /config/configure` |
| 间隔 / 等候 / 每日额度 | 主动联系 › 节律盘 | 同上 |
| ⚠ 未回复放缓 3 项（`unanswered_slowdown_start` / `_pause_after` / `_max_interval_multiplier`） | **无入口** | 同上 |
| ⚠ 素材时效 `event_max_age_seconds` | 状态页有（按窗口）；主动联系无 | 同上 |
| 强度档位 / 连发 4 项 / 小时曲线 / 收尾 2 项 / 分享概率 | 主动联系 › 节律盘 / 额度与去重 | 同上 |
| ⚠ 档位身长提示 `proactive_intensity_body_chars` | **无入口** | 同上 |
| 免打扰 4 项 / 临时暂停 | 主动联系 › 节律盘 / 开口闸门；状态页 | 同上 |
| 去重 7 项 | 主动联系 › 额度与去重 | 同上 |
| 人格复核 3 项（阈值/缓存/日限） | 主动联系 › 外部触发源 › 约定与上下文 | 同上 |
| ⚠ `proactive_persona_judge_exempt_purposes` | **无入口** | 同上 |
| ⚠ 接回旧话题 2 项（`contact_followup_after_minutes` / `_cooldown_minutes`） | **无入口** | 同上 |
| 每日问候 + 3 窗口 / 深夜一条 | 主动联系 › 节律盘 | 同上 |
| ⚠ `greeting_idle_minutes` | **无入口** | 同上 |
| ⚠ `insomnia_night_daily_limit` | **无入口** | 同上 |
| 失眠需睡眠态（窗口级） | 状态页 | 同上 |
| 晨间流程 14 项 | 主动联系 › 晨间唤醒 | 同上 |
| 饭点 4 项 | 主动联系 › 外部触发源；感知 重要日子与饭点 | 同上 |
| 纪念日 3 项 | 感知 › 重要日子与饭点 | 同上 |
| ⚠ `important_dates`（后端仍接受，页面声明"不再需要填写"） | **无控件** | 同上 |
| 天气 5 项 / 官方预警 3 项 | 主动联系 › 外部触发源；感知 天气 | 同上 |
| 资讯 8 项 | 主动联系 › 外部触发源；感知 外部与记录 | 同上 |
| 网络探索 4 项 | 同上 | 同上 |
| 自关联 3 项 | 感知 › 外部与记录 | 同上 |
| 屏幕与动作 14 项 | 主动联系 › 外部触发源 | 同上（能力条件 §6.3） |
| 约定执行 3 项 | 主动联系 › 外部触发源 | 同上 |
| 生成上下文 2 项 | 同上 | 同上 |
| ⚠ `style_prompt`（主动联系风格） | **无入口** | 同上 |
| ⚠ 提示词模板 4 项（`expression_prompt` / `news_sharing_prompt` / `length_prompt` / `news_length_prompt`） | **无入口** | 同上 |
| 余额 9 项 | 主动联系 › 外部触发源；感知 余额联系条件 | 同上 |
| 15 个目的 开关 + 权重 | 主动联系 › 契机矩阵 | 同上 |
| 15 个目的 暂缓至（只读） | 同上（chip） | 同上 |
| 消息测试 / 主动检视（调试） | 主动联系 › 消息测试 / 主动检视 | `POST setup/proactive-diagnostic`；`GET perception-native/materials` |

### 7.4 感知（11 项 + 6 个内嵌编辑器）

| 功能 | 当前入口 | 依赖接口 |
|---|---|---|
| 余额数据源 5 字段 | 感知 › 外部与记录 › 余额数据源 | `GET/POST host-options/balance[/test]` |
| 天气/日历/重要日子/资讯/余额/屏幕 6 组联系素材条件 | 感知 › 4 个 tab 内 6 个折叠块 | `GET/POST /config/configure`（`proactive.contact` 切片） |
| 感知通道总览（16 通道） | 感知 首页 | `model_api`、`perception-native/runtime`、`semantic`、`reply/recalls`、`extensions` |
| 原生感知设置（日期/环境/模型能力/现实扩展） | 感知 › 各 tab | `perception-native`、`models`、`native-extension` |

### 7.5 状态（按窗口，21 项）

| 功能 | 当前入口 | 依赖接口 |
|---|---|---|
| 主动联系窗口级覆盖（开关/间隔/额度/免打扰/暂停/备注/沉默门槛/天气 4 项/预警 3 项/素材时效） | 小屋 › 状态（行为规划与沉默） | `POST /config/configure`（`proactive.contact`，window） |

---

## 8. 给新 UI 的建议

### 8.1 结构：这个区域只需要三屏

| 屏 | 管什么 | 必须能改的东西 |
|---|---|---|
| **说话** | 怎么说、说几条、要不要出声 | 分段开关 + 最多条数 + 间隔一档（"快/正常/慢"）+ 表达风格提示词 + 去句尾标点 + 语音开关与音色 |
| **参与** | 群里什么时候接话、什么时候闭嘴 | 群聊回应总闸 + 直呼词（含角色名）+ 兴趣概率 + 冷群/疲劳各一档 + 空气护栏 + 3 个内容护栏 + 本群插话开关 |
| **主动** | 能不能主动找我、什么时候别找、多久一次、说什么 | 总开关/后台自动 + 免打扰区间 + 活跃度一档（直接写 `proactive_intensity_preset`）+ 每日额度 + 15 个目的归成 6 组开关 + 暂停到… |

其余全部进「高级」（每屏底部一个入口，或用二级抽屉）：分段算法 8 参数、语音渠道矩阵 6 项、引用/@/组件顺序、去重 7 项、连发 5 项、晨间 14 项、外部触发源 58 项、人格复核、约定、提示词模板、消息测试、主动检视、回复诊断。

### 8.2 分层怎么呈现（最重要）

**不要呈现四层。** 事实是只有两个作用域：

- 私聊/角色默认 → 写 role 层（`reply_api.py:85`）
- 某个群 → 写该群 window 层（`group_reply_api.py:119`）

建议：顶部一个作用域切换器（`角色默认` / `群：xxx`），只在群语境下出现；字段只显示「当前生效值 + 是否改过」。层轨、图例、`继承自…`、`安装·角色·关系·窗口` 四份视觉噪音全部替换成一个 `默认` / `已修改` 小标记。

**但必须修 `reset_to_inherit`**：现在 25/26 个分区点「恢复继承」会静默失败并给出错误方向的提示（`workbench-page.js:2328` + `management.py:209,213`）。修法二选一：把 `resetKey` 在 `config-editor.js:1849` 固定为 `reset_to_inherit`，或让 `configure` 接受"只回退"的请求。

### 8.3 必须保留的机制（砍掉会静默失败）

| 机制 | 为什么 |
|---|---|
| `edit_token` 原样回传（64 字符） | 不匹配即 revision conflict |
| `operation_key` 幂等键 | 重试会变成二次写入 |
| `/config/configure` 的 `section` 判别字段 | 多分区复用同一端点 |
| `changes` 键名 `<group>.<short>` | 否则 unknown setting |
| 每字段 `kind/minimum/maximum/maximum_chars` | 页面放行非法值 → `invalid_configuration_value` |
| `audit` 组合校验（如知识库字符上限 vs 单条上限） | 跨字段约束只在后端报一个笼统码 |
| 离页守卫 `dirtyEditors()` / `saveBeforeLeave()` | 用户切页丢改动 |

### 8.4 界面层面可以减的（功能不动）

| 做 | 位置 |
|---|---|
| 合并重复入口：`busy_gate`/`life` 从 3 个挂载点收到 1 个（决策页或主动联系，二者选一），另一处改为跳转链接 | `app.js:3847-3854`、`app.js:3768`（孤儿） |
| 合并重复编辑位置：`proactive.contact` 在主动联系页全量、感知页 5 个切片，改为「主动联系页唯一编辑 + 感知页只读摘要 + 跳转」 | `app.js:3772-3786` |
| 拍平层级：表达页 5 模块 tab × 7 分区 = 35 个格子，收成 1 屏 3 组 | `app.js:3506-3512`、`reply-page.js:290-372` |
| 分区超限不平铺：`navigationLimit` 默认 8 且超出后全铺（`workbench-page.js:842,953`），改为始终分页/分 tab | 同上 |
| 精简文案：helps 90+ 条改为「一行 + 悬浮/展开」，105 行 help 同理 | `reply-page.js:164-288`、`contact-page.js:1091-1097` |
| 修标签覆盖 bug：11 个字段的标签现在是整段说明 | `reply-page.js:137 vs 152`、`:141-145 vs :153-162` |
| 诊断/调试收进「高级 · 诊断」：消息测试 17 卡、主动检视、回复诊断 80 轮、感知「其他注入」、同步胶囊、通道计数 | `contact-page.js:1264-1300,1915-2000`；`reply-page.js:558-637`；`perception-overview.js:780-784,908-927` |
| 展示性统计移出首屏：决策页 20 张 stat 卡、感知页 10 个永远空态的通道，改成一行摘要 | `decision-page.js:74-181`；`perception-overview.js:749-779` |
| 状态提示收敛：预览三态格 + 状态行 + `实时` 徽标只留一个 | `reply-page.js:905-917` |
| 统一时刻控件：去掉自由文本窗口输入 | `contact-page.js:1051,1707,1730,1731,1734` |
| 数字直给：活跃度显示"大约每 2 小时最多一条、每天最多 3 条"，不显示乘数 | `contact-page.js:1005-1010,1144-1153` |
| 修语义错：`立即生效` → 按后端 `apply_mode` 显示 `下一条回复生效` | `workbench-page.js:910` vs `reply_management.py:154` |
| 预览弹窗：去掉 4 个不写入任何设置的下拉，只留示例预设与"立即预览" | `reply-page.js:881-891` |

### 8.5 补齐入口（新 UI 必须做，否则"功能 100% 覆盖"不成立）

| 缺口 | 建议位置 |
|---|---|
| 主动联系：未回复放缓 3 项 | 主动 屏「高级 › 节奏」 |
| 主动联系：素材时效、档位身长、人格复核豁免、接回旧话题 2 项 | 主动 屏「高级 › 节奏 / 复核」 |
| 主动联系：问候空闲、失眠日限、失眠需睡眠态 | 主动 屏「高级 › 问候」 |
| 主动联系：`style_prompt` + 4 个提示词模板 | 主动 屏「高级 › 表达模板」（现在整块无 UI） |
| `important_dates` | 明确二选一：补一个日期清单控件，或前后端一起标废弃并写进注释 |
| 状态页 21 项窗口覆盖 | 「参与」屏底部的"这个群/这个人单独设置" |

### 8.6 实现前置约束（会撞到的仓库规则）

| 约束 | 依据 |
|---|---|
| 只能有一个 Dashboard 入口页 `pages/陪伴小屋/index.html` | `tools/build_v2_release.py:381-384` |
| 新增 js/css 必须跑 `tools/sync_framework_page.py` 更新 `page-build.json` 哈希 | `tools/build_v2_release.py:385-389` |
| 字号/间距/圆角必须走 `--fs-* / --sp-* / --r-*`，且新文件要进 `audit_page_scale.py` 的 `MIGRATED` 白名单 | `tools/audit_page_scale.py:1-40,416-427` |
| 两层写入语义不同：reply / 群插话支持 `reset_to_inherit`，`/config/configure` 不支持 | `reply_api.py:107`、`group_reply_api.py:99-101`、`configuration_api.py:158` |

---

## 附：本次核对方式与未决项

- 全部结论来自静态阅读 + grep 计数 + AST 解析后端 defaults；未运行前端、未调用接口。
- 机器清单 `reply.items.json` 由脚本从「后端字段全集 × 页面源码出现位置」生成：398 条 = 377 setting + 21 action；其中 79 条有多处可见位置、58 条带平台/能力条件、15 条只读展示、16 条当前无入口。
- 未逐字段核对：天气数据源面板、模型路由、现实扩展 provider（由 `weather-source-page`、`models-page`、`native-extension-management.js` 渲染）。
- `app.js:3843` 注释写 `proactive.contact` 为「160 项」，实际静态统计约 173 项（含 15 目的 ×3 与提示词模板），注释已过期。
- 标签覆盖 bug（11 处）与 `reset_to_inherit` 死按钮（25/26 分区）为高置信静态结论，落地前建议各用一次真实保存复现。
