# 区域审计：pages/陪伴小屋/workspaces/persona/（人格底稿 / 人格问卷工作区）

只读审计。基线 `wechat @ 2e29e3f`。审计对象：`pages/陪伴小屋/workspaces/persona/index.html`（122 行）、
`app.js`（726 行）、`style.css`（656 行）、后端 `astrbot_host/persona_workshop_api.py`（1099 行）。
`pages/人物设定工坊/` 是同一份代码的生成副本（`tools/sync_framework_page.py`），不重复审计；
`workspace-bundles/persona.js` 是 iframe 实际加载的打包版，请求路径与 `app.js` 一致（已比对：两份都调用
`persona/command`、`persona/standardize`、`persona/tryouts`、`persona/style-rules`）。

## 0. 八个重点问题速答

| # | 结论 | 证据 |
|---|---|---|
| 1 | 5 步是一条单向流水线：问卷→生成稿→审核→试答→风格→对照→保存。只有「上一步」按钮能回退；步骤条（`ol.flow-line`）**不可点击**；解锁靠 `unlockedStep` 状态，只在「下一步」按钮 / 生成成功 / 头部「已存 N 版」时提升 | `index.html:21-27`、`app.js:153-176`、`app.js:657-663`、`app.js:643-651` |
| 2 | 8 条路由里**这个工作区只用 5 条**（GET status、command、standardize、tryouts、style-rules）；`profile-draft` / `profile-migration-plan` / `profile-migration-apply` 归「自我页 · 角色档案」，不在本工作区 | `app.js:85-86` 的全部调用点；`role-profile-draft.js:122-123`、`role-profile-migration.js:258`、`:287` |
| 3 | **不会写回 AstrBot 人格，这是后端明确的设计**。全部写入只有「往插件自己的 `persona_draft_versions` 表 INSERT 一版」。落地要靠操作者手工把文本复制到 AstrBot 人格里，而复制按钮在 iframe 里很可能不可用（无 `clipboard-write` 权限、无 `allow-same-origin`）——这是本区最大的交互缺口 | `persona_workshop_api.py:1-30`、`companion_v2/persona_craft/service.py:1-13`、`repositories.py:1-6,62-64`、`tests/test_persona_workshop_api.py:627-665`、`product-page.js:819`、`app.js:459-465` |
| 4 | 「我现在是哪份人格」= 打开工作区即见（0 次额外点击）；「最近改了什么」要点 5~6 次（版本记录藏在第 5 步的折叠区里，头部「已存 N 版」只把你送到第 2 步） | `index.html:15`、`app.js:194-201`、`app.js:643-651`、`index.html:113-117` |
| 5 | 模型生成类操作有**两重超时**：桥 18s 就断，后端却等 90s，所以慢模型一律显示「连接超时」 | `embedded-bridge.js:5`、`app.js:85`（未传 `timeoutMs`）、`persona_workshop_api.py:777,834,894`（`wait_for(..., timeout=90)`） |
| 6 | 解释性文案密集：`index.html` 里 5 条步骤导语 + 每条目小字说明共约 40 处；`app.js` 里另生成 12 处说明性小字/清单 | 见 §5 表 |
| 7 | 工作区本身没有任何 QQ/群聊专属逻辑；但**群目标是根本不能用的**（后端不注册路由 + `_read_persona` 只接受私聊 scope） | `multi_api.py:180-181,312-347`、`persona_workshop_api.py:245-247` |
| 8 | 人格相关入口在旧面板另有 3 处（自我页 · 人格问卷 tab；自我页 · 角色档案「从当前人格整理 / 迁入已有设定」；开始使用页快捷入口），标「跨区域」 | `app.js:3626,3620,4457` |

## 1. 视图清单

| 步骤/分区/弹窗 | 怎么进来 | 用途一句话 | 主要组件 | 代码位置 |
|---|---|---|---|---|
| 头部（常驻） | 工作区加载即出现 | 显示当前人格名、原文字数、已存版本数、状态、返回 | `#persona-mark` `#persona-name` `#original-count` `#load-version`「已存 N 版」`#persona-state`「已解析到人格/无可用人格」`#back-self` | `index.html:13-17`；`app.js:194-201`；返回 `app.js:616-619` |
| 空态 | 人格未解析且来源=当前人格 | 没有人格的兜底 | `#absent`「没有可整理的人格」 | `index.html:19`；`app.js:181` |
| 通知条（常驻） | 任何操作 | 单行结果/错误（`role=status`） | `#notice` | `index.html:18`；`app.js:71-73` |
| 步骤条 | 常驻 | 仅指示 progress，不可点 | `ol.flow-line` + `[data-flow]` | `index.html:21-27`；`app.js:153-164` |
| STEP 01 问卷与来源 | 默认页 | 选来源、整理强度、填问卷、给参考材料，生成基础稿 | 来源单选、人格下拉+↻、粘贴框、强度 chips ×3、3 组 `<details>` 共 10 个 `textarea`、参考材料、生成按钮 | `index.html:30-68`；`app.js:546-571` |
| STEP 02 基础稿审核 | 生成成功后自动进；或头部「已存 N 版」 | 逐分区改模型给的稿，看固定骨架与审核清单 | 3 张指标卡 `#review-metrics`、8 分区 `textarea` `#review-sections`、`#skeleton-toggle`+`<pre>`、`#review-checklist` 三列 | `index.html:70-78`；`app.js:298-362` |
| STEP 03 情景试答 | 第 2 步点「确认，进入情景试答」 | 从 6 个固定情景的 3 条候选里挑口吻 | 2 个偏好输入、`#generate-tryouts`、`#refresh-tryouts`、6 题单卡翻页 + 自定义框 | `index.html:80-89`；`app.js:364-404` |
| STEP 04 风格规则 | 第 3 步点「继续归纳风格」 | 用审核稿+选择+参考材料归纳 `Output_Constraints / 对话风格` | `rule-map` 说明、`#generate-style`、两个可编辑 `textarea` | `index.html:91-102`；`app.js:594-608` |
| STEP 05 对照与落地 | 第 4 步点「去第 5 步」（或直接 `unlockedStep=5`） | 左右逐段对照（初始 vs 标准化），替换到左侧后存成新版本 | 左右两栏 `pair` 行（10~11 行）、差异徽标、⇦替换/还原此段、复制整体 ×2、版本备注 + 保存、`<details>` 版本记录（列表+预览+恢复/复制） | `index.html:104-118`；`app.js:433-457,494-543,609-614` |
| 版本记录（折叠） | 第 5 步底部 `<details>` | 看历史版本、改成「当前」、复制 | `#limit` 10/30/100、`#versions`、`#preview` | `index.html:113-117`；`app.js:494-523` |

## 2. 设置项 / 数据项

层级说明：本工作区的所有字段都不写进 AstrBot，也不写进 V2 角色配置；只有 `note` + 左侧成稿会落进
插件自己的草稿账本（owner = 安装 + 角色 + 宿主人格，`persona_craft/models.py:82-96`）。「我方是否需要」按
「已有手写 6000 字人格、只要看/改/回滚」判断。

| 字段 | 界面标签 | 位置 | 读 API | 写 API（含 action） | 层级 | 默认值（来源） | 我方是否需要 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 来源模式 | 「选择 AstrBot 人格 / 粘贴人格文本」 | `index.html:34-37` | GET status（personas） | standardize 的 `source_mode` | 角色+人格 | `current`（`app.js:52`） | 否（我们只有一份，就是当前人格） | 粘贴模式绕开「从问卷生成」的前提 |
| 宿主人格 | 「人格选择」 | `index.html:38` | GET status `personas[{value,label}]`（`persona_catalog.py:104-116`） | standardize/command 的 `persona_id` | 角色+人格 | 当前解析到的 `persona_id`（`app.js:194-199`） | 否（单角色单人格） | 单人格时下拉被禁用（`app.js:191`） |
| 粘贴原文 | 「原人格文本」 | `index.html:39` | 无 | standardize `source_text` | 本地 | 空 | 否 | 上限 30000 字 |
| 整理强度 | 「轻度/中度/深度」 | `index.html:44-48` | 无 | standardize `strength` | 本地 | `medium`（`app.js:52`） | 否 | 只影响提示词措辞（`persona_workshop_api.py:966-968`） |
| 问卷 10 项 | 「身份与经历…其他补充」 | `index.html:50-65` | 无 | standardize `answers{10 keys}` | 本地 | 空 | 否（人格已手写） | 每项 4000 字上限 |
| 参考材料 | 「平时怎样、熟了怎样、被误解怎样」 | `index.html:66` | 无 | standardize `reference_material`；style-rules 同名字段 | 本地 | 空 | 待定 | 4000 字上限 |
| 审核分区 ×8 | 「基本信息…长期补充条件」 | `index.html:73` + `app.js:4-13` | 无（来自 standardize 结果） | 只进 command.save 的 `text` | 本地 | 空 | 部分（要能编辑当前人格） | 分区标题硬编码在前后端两处（`app.js:4-13` / `persona_workshop_api.py:923-932`） |
| 固定骨架 | 「固定骨架 / 查看完整骨架文本」 | `index.html:74-75` | 无 | 无（只读展示） | 本地 | 硬编码三段（`app.js:23-27` / `persona_workshop_api.py:950-954`） | 待定（我们的 prompt 自带这些约束） | 前端 `canonical()` 会把它拼进成稿（`app.js:203-215`） |
| 说话/输出偏好 | 「初步说话偏好 / 输出约束偏好」 | `index.html:83-84` | 无 | style-rules `speech_preference` / `constraint_preference` | 本地 | 空 | 待定 | 各 500 字 |
| 情景试答选择 | 6 场景 × 单选项 + 自定义 | `app.js:364-404` | 无 | style-rules `selections[{scene_id,text}]` | 本地 | 空 | 否 | 场景表前后端各硬编码一份（`app.js:15-22` / `persona_workshop_api.py:934-948`） |
| 对话风格 / 口吻示例 | `<Output_Constraints>` + 「附带产出」 | `index.html:98-99` | 无 | 进 command.save 的 `text` | 本地 | `[STYLE_PENDING]`（`app.js:211`） | 待定 | 我们的人格已有口吻，不一定要模型归纳 |
| 左右对照文本 | 左「初始人格」/ 右「标准化版本」 | `index.html:107-110` | 无 | 左栏 → command.save `text`；`original_text` 取 `sourceSnapshot` | 本地 | 左=宿主原文（`app.js:293-297`） | 部分 | 差异徽标只有「一致/有差异/右侧有新增/待补充」（`app.js:410-419`），无行级 diff |
| 版本备注 | 「版本备注」 | `index.html:111` | 无 | command.save/restore `note` | 插件草稿账本 | 空（必填，≤200 字，`models.py:32`） | **需要**（就是「最近改了什么」） | 空备注直接被拒（`app.js:610-612`） |
| 版本列表 | 「版本记录 / 显示 N 版」 | `index.html:113-115` | GET status `versions[]`、`count` | 无 | 插件草稿账本 | `limit=30`（`index.html:114`） | **需要** | 版本含 `sequence/kind(draft\|restore)/note/created_at/draft_text/original_text`（`models.py:56-78`） |

## 3. 操作清单

| 按钮/动作 | API | 效果 | 保存模型 | 代码位置 |
|---|---|---|---|---|
| 打开工作区 / ↻ / 换人格 / 改「显示 N 版」 | `GET persona`（`?limit&persona_id`） | 读宿主当前人格 + 该 owner 的历史；返回 `{persona,current,versions,count,has_history,personas}` | 纯读 | `app.js:476-493`、`persona_workshop_api.py:290-314` |
| 「生成基础稿，进入审核」 | `POST persona/standardize` | 模型把「人格原文 + 问卷 + 参考材料」整理成 8 分区草稿 + notes；成功后 `unlockedStep=2` | 模型生成（后端 90s / 6800 tokens），**不落库** | `app.js:546-571`、`persona_workshop_api.py:718-804` |
| 「上一步 / 确认，进入情景试答 / 继续归纳风格 / 去第 5 步」 | 无 | 只改 `unlockedStep/activeStep`（前进即解锁，不校验内容） | 本地状态 | `app.js:165-176,657-663`、`index.html:77,88,101,112` |
| 「生成一批试答」/「换一批」 | `POST persona/tryouts` | 6 情景 × 3 候选；`variation` 递增换一批 | 模型生成（90s / 3600 tokens，`persona_workshop_api.py:834`），不落库。**当前被桥拦掉** | `app.js:572-585`、`persona_workshop_api.py:805-847` |
| 「归纳风格规则」 | `POST persona/style-rules` | 归纳 `{style:{text,examples}}`，回填第 4 步并解锁第 5 步 | 模型生成（90s / 2600 tokens），不落库。**当前被桥拦掉** | `app.js:594-608`、`persona_workshop_api.py:848-906` |
| 「⇦ 用右侧替换左侧」/「复制左侧/右侧整体」/「还原此段」 | 无 | 只改内存里的左右栏；复制走 `navigator.clipboard` | 本地 | `app.js:410-457,459-465,700-719` |
| 「保存左侧为新版本」 | `POST persona/command` `{action:"save", text, original_text, note, expected_current, persona_id}` | 往 `persona_draft_versions` **追加一版**；成功后清空备注、重读状态 | 持久（插件草稿账本）+ revision 乐观锁 | `app.js:609-614,525-541`、`persona_workshop_api.py:169-170,315-356` |
| 版本预览里「恢复到右侧」 | `POST persona/command` `{action:"restore", version_id, note, expected_current}` | **也追加一版**（正文=旧版正文，`kind="restore"`，记 `restored_from`），同时把旧文本载入右侧 | 持久（追加，不删旧版） | `app.js:512-523,542-545`、`service.py:81-93`、`repositories.py:62-80` |
| 「复制这一版」 | 无 | 剪贴板 | 本地 | `app.js:522` |
| 头部「已存 N 版」 | `GET persona`（已有数据）+ 本地解析 | 用**最新一版**填右侧、`unlockedStep=5`、跳到第 2 步 | 纯读 + 本地 | `app.js:643-651` |
| 「返回自我页」 | postMessage `navigate {tab:"selfProfile"}` | 切到自我页 · 角色档案 | 导航 | `app.js:616-619`、`product-page.js:1070-1077` |

### 3.1 草稿/版本模型（含 `action` 与 `expected_revision`）

- `action` 只有两个：`save`、`restore`（`persona_workshop_api.py:169-171`）。字段白名单是**精确集合**，
  多一个少一个都判 `persona_workshop_request_invalid`：save = `{action,text,note,expected_current}`（另允许
  `persona_id`、`original_text`），restore = `{action,version_id,note,expected_current}`（另允许 `persona_id`）。
- 没有 `expected_revision` 这个名字——乐观锁字段叫 **`expected_current`**，取「当前最新一版」的
  `version_id`（无历史时传 `""`），由前端 `expected()` 现算（`app.js:61`）。服务端比对最新一版，
  不一致抛 `persona_draft_conflict`（`service.py:96-104`）。
- 主键/口径：`version_id = "persona-draft-v000001"`（序号，不是哈希，`models.py:99-107`）；owner 不含窗口，
  只含 安装 + 角色 + 宿主人格（`models.py:82-96`），换私聊窗口不丢历史。
- 撤回语义 = 再加一版，永不 UPDATE/DELETE（`repositories.py:1-6`）。
- 上限：`draft_text ≤ 65536`、`original_text ≤ 30000`、`note ≤ 200`、一页 `limit ≤ 100`（`models.py:28-35`）。

### 3.2 「只写插件自己的草稿」的证据

| 主张 | 证据 |
|---|---|
| 模块自述「没有写人格的路径，这是设计而不是遗漏」 | `persona_workshop_api.py:16-27` |
| 服务层三条边界：只读宿主 / 只追加 / 原文随版本快照 | `companion_v2/persona_craft/service.py:1-13` |
| 唯一写路径是 `persona_draft_versions` 的 INSERT | `repositories.py:1-6`、`service.py:96-110` |
| 测试：跑完 status/save/restore 后宿主人格对象一字未改；且源码里禁止出现 `set_persona` 等调用 | `tests/test_persona_workshop_api.py:627-656` |
| 宿主人格是「宿主所有、只读」 | `companion_v2/persona_craft/models.py:1-16` |
| 整个插件没有别的 AstrBot 人格写入口（唯一的 `mobile_set_persona` 写的是 V2 手机端别名） | `astrbot_host/native_extensions/reality/mobile_gateway.py:1376-1387` |

## 4. 重复与冲突（含跨区域）

| # | 重复/冲突 | 位置 | 性质 |
|---|---|---|---|
| 1 | **跨区域**：旧面板「自我页 · 人格问卷」tab 就是挂这个工作区；同一屏还有「角色档案」「相处资料」「世界知识」三个同级 tab | `app.js:3582-3630`、`app.js:3865` | 入口即宿主 |
| 2 | **跨区域**：自我页 · 角色档案里的「从当前人格整理角色档案」（`profile-draft`）与「迁入已有设定」（`profile-migration-plan/apply`）——同样读宿主人格、同样产出「可审阅草稿」，但写的是 V2 角色配置 | `app.js:3620`、`role-profile-draft.js:122-123`、`role-profile-migration.js:258,287` | 与人格底稿是**两条不同的整理链路**，用户会分不清「整理人格」和「整理角色档案」 |
| 3 | **跨区域**：「开始使用」快捷入口里也列了一条「人格问卷 · 结构化整理角色设定并保存多个版本」 | `app.js:4457` | 第三处入口 |
| 4 | 分区标题 / 场景表 / 固定骨架在前端与后端各硬编码一份，靠字符串匹配对齐（`## 基本信息` 等） | `app.js:4-27` vs `persona_workshop_api.py:909-954` | 双份常量，改一处会静默错位 |
| 5 | 「来源=粘贴」这条路与「人格来源=选择 AstrBot 人格」在后续每一步都共用，但粘贴源没有 owner 概念，仍挂在当前 `persona_id` 名下 | `app.js:546-560`、`models.py:82-96` | 语义含混：草稿归属是宿主人格，正文来自粘贴 |
| 6 | 桥的白名单只放行 3 个 persona 路径，而工作区要发 5 个 | `product-page.js:1112-1115` vs `app.js:85-86` | **硬冲突**：第 3、4 步必然失败（见 §5-1） |

## 5. 交互问题

| # | 问题 | 影响 | 定位 |
|---|---|---|---|
| 1 | **第 3、4 步必然失败**：`product-page.js` 的请求白名单只接受 `persona`(GET)、`persona/command`(POST)、`persona/standardize`(POST)，`persona/tryouts`、`persona/style-rules` 被判 `invalid_response`，用户看到「数据不完整，请刷新核对。」 | 「生成一批试答 / 换一批 / 归纳风格规则」三个按钮永远失败；第 4 步的 `unlockedStep=5` 只能靠「去第 5 步」按钮硬闯 | `product-page.js:1112-1115`、`app.js:572,594`；已用 Node 复算该布尔判据确认 REJECT |
| 2 | **超时优先级错位**：工作区 `apiPost` 不传 `timeoutMs` → 桥固定 18s（+1s 计时）就 reject，后端却允许模型跑 90s | 只要模型 >18s，用户看到「连接超时，请刷新核对。」（`errors.bridge_timeout`），而不是 `role_profile_draft_timeout`；慢模型等于功能不可用 | `embedded-bridge.js:5,56-64`、`app.js:85`、`persona_workshop_api.py:777,834,894` |
| 3 | **落地路径断在剪贴板上**：iframe 是 `sandbox="allow-scripts allow-forms"`（opaque origin，且无 `allow="clipboard-write"`），`navigator.clipboard.writeText` 大概率抛错，只剩「请在文本框中全选后复制」提示 | 「复制右侧整体」这个唯一把结果带出工作区的动作不可靠；用户仍需自己找 AstrBot 人格编辑页 | `product-page.js:819`、`app.js:459-464` |
| 4 | **本地草稿在 iframe 里存不住**：`persist()`/`restoreLocal()` 用 `localStorage`，opaque origin 下会抛 `SecurityError`（`persist` 静默吞掉，`restoreLocal` 回落 `resetWorkspace()`） | 切 tab / 切对象 / 重挂载后，问卷与左右栏内容全部丢失；只有已 `save` 的版本活着 | `app.js:87-137`（尤其 `:90`、`:104`） |
| 5 | 步骤条不可点击，`showStep` 只接受 `≤ unlockedStep`，且没有任何「跳到第 5 步」的直达入口 | 已保存 N 版的老用户想看历史，仍要先在 3 个「下一步」里穿一遍 | `app.js:165-166`、`index.html:21-27` |
| 6 | 头部「已存 N 版」按钮的 `aria-label/title` 写的是「读取已存稿/最新已存稿」，实际效果是**跳到第 2 步**，不打开历史 | 用户以为会看到版本列表，结果进了审核页 | `index.html:15`、`app.js:643-651` |
| 7 | 前进不校验内容：第 2 步什么都不改也能一路走到第 5 步并「保存左侧为新版本」 | 能保存一份与原文近乎相同的版本，把「最近的改动」列表冲淡 | `app.js:653-660` |
| 8 | 「恢复到右侧」会**立刻追加一条 restore 版本**，同时把旧文本放进右侧——一次点击改了两件事（账本 + 编辑面），还要再点保存才成为左侧 | 心智模型混乱：回滚到底是「看一眼」还是「生效」不清楚 | `app.js:525-545`、`service.py:81-93` |
| 9 | 差异徽标只有 4 种状态、无行级高亮；10 个 `pair` 行每行两个 textarea 平铺 | 对照阅读成本高，看不出改了哪句 | `app.js:410-419,433-457` |
| 10 | 每次输入都 `persist()` 全量序列化（含 65536 字的 raw） | 大稿下输入卡顿；配合问题 4 又是白做 | `app.js:88-100,636,684,692` |
| 11 | 群目标下 tab 依然出现在自我页，但容器只渲染一行「当前角色尚未提供这个工作区」；`persona_workshop_scope_unsupported`（「人格问卷目前只适用于私聊对象。」）实际到不了 | 群聊场景下这一格是死入口，且没有任何引导 | `product-page.js:717,818`、`multi_api.py:180-181,312-313`、`app.js:43` |
| 12 | 空态两句「没有可整理的人格 / 请先在 AstrBot 中配置人格，或选择粘贴文本。」指向的是本页之外的操作，没有出口按钮 | 空态无法继续 | `index.html:19` |
| 13 | 只有「返回自我页」一个出口；没有「去 AstrBot 人格设置」的深链 | 落地缺口 3 的放大器 | `app.js:616-619` |

## 6. 解释性文案清单（新 UI 原则：不写解释）

`index.html`（步骤导语 5 条 + 条目小字）：

| 行 | 文案 | 类型 |
|---|---|---|
| 19 | 「请先在 AstrBot 中配置人格，或选择粘贴文本。」 | 空态指引 |
| 31 | 「选定人格来源与整理强度，再填写你有把握的信息。未提供的内容会留空，不会臆造。」 | 步骤导语 |
| 35 | 「只生成可编辑底稿，不切换实际对话人格」 | 来源说明 |
| 36 | 「整理列表外的人格或另一份文本」 | 来源说明 |
| 38 | 「选择要整理的人格；未选择时使用当前人格」 | 字段小字 |
| 39 | placeholder「…这里只生成审核稿，不会修改原人格」 | 占位说明 |
| 43 | 「决定模型改动幅度；生成后仍可逐项审核，不会覆盖当前人格。」 | 分区导语 |
| 45-47 | 「轻度 · 排版与明显冲突」「中度 · 补齐模块并优化表达」「深度 · 按完整模板重组」 | 选项解释 |
| 51-53,56-58,61-62 | 10 处字段小字（「职业、来历或重要经历」…） | 字段说明 |
| 66 | 「同时作为风格参考，最多 4000 字」+ 多行 placeholder 示例 | 字段说明 |
| 67 | 「预计 30–120 秒 · 生成的是审核稿，不覆盖原文；内容过短时会自动补充」 | 耗时/免责声明 |
| 71 | 「固定骨架由系统补齐，其余内容按模板分区编辑；对话风格留到后续试答后归纳。」 | 步骤导语 |
| 74 | 「# 基本要求 · # 初始化：…」「# 对话安全：…」 | 骨架摘要 |
| 81 | 「为模拟情景选择最贴近角色的回应；…选择只作为风格依据，不写入角色事实。」 | 步骤导语 |
| 83-84 | 「只作为试答参考」「不会写入角色事实」 | 字段小字 |
| 92 | 「根据审核稿、情景选择与参考材料归纳对话风格；结果仍可手动调整。」 | 步骤导语 |
| 94 | 「归纳来源：基础稿 · 情景试答 · 参考材料 → 回填到 Output_Constraints / 对话风格」 | 流程说明 |
| 105 | 「逐区核对并把需要的内容替换到左侧，…不会覆盖当前 AstrBot 人格。」 | 步骤导语 |

`app.js` 运行时生成的说明性小字/清单：

| 行 | 文案 |
|---|---|
| 303 | 「保留未识别的内容，可在这里整理」 |
| 309 | 8 条 `section.hint`（「姓名、身份、经历、职业」…，见 `app.js:4-13`） |
| 316 | 「来自第 4 步，可继续编辑」/「STYLE_PENDING · 第 4 步回填」 |
| 344-345 | 「整理为 N 个标准分区。」「对话风格将在第 4 步归纳。」 |
| 348-351 | 「需要审核」「暂无待确认内容。」 |
| 356-359 | 审核清单 5 条（「身份信息 / 外貌与世界 / 性格六层 …」） |
| 391 | 「生成后会出现三条候选回复。」 |
| 514 | 「历史版本和当时对应的原文会一起保留。」 |

合计：约 20 行静态文案 + 约 20 处运行时文案，其中「不会覆盖人格」「只作为参考」「不写入角色事实」
这类免责说明反复出现 8 次以上——新 UI 应当直接删掉，用行为本身表达。

## 7. 按条件显示清单（不是删除建议）

口径：**兼容 + 页面重构**，功能一条都不删，5 步问卷全部保留。本节只回答「每一项在什么条件下才该出现」，
条件一律来自已有接口字段或已有代码判断，不新增后端。

| # | 功能/步骤 | 只在什么条件下有意义 | 判断条件出自（接口.字段 / 代码） | 条件不成立时当前表现 |
|---|---|---|---|---|
| 1 | 整个工作区 + 自我页「人格问卷」tab | 当前对象是私聊（才有 `persona_api`） | `role().persona_api !== null`：`product-page.js:818` 判空；群目标给 `None` 出自 `multi_api.py:180-181`；服务端第二道门 `context.scope.kind is not ScopeKind.PRIVATE`（`persona_workshop_api.py:245-247`，码 `persona_workshop_scope_unsupported`） | 容器只显示「当前角色尚未提供这个工作区」（`product-page.js:717,818`）；群目标下后端根本不注册 persona 路由（`multi_api.py:312-313`） |
| 2 | 人格下拉「人格选择」+ ↻ | 宿主里存在 ≥2 份 AstrBot 人格 | `GET {persona_api}` 回包 `personas[].length`（`app.js:191` `select.disabled = choices.length < 2`；来源 `persona_catalog.py:101-116`） | 下拉禁用，只显示当前值 |
| 3 | 空态「没有可整理的人格」 | 人格未解析、且来源模式=当前人格 | `GET {persona_api}`.`persona.resolved === false`（`app.js:181`；字段定义 `service.py:42-58`、`models.py:63-78`） | 隐藏 |
| 4 | 头部「已存 N 版」/ 版本记录 / 恢复 / 复制这一版 | 该 owner 至少有一版历史 | `GET {persona_api}`.`count ≥ 1`（`app.js:200`）、`versions[]` 非空（`app.js:494-500`） | 按钮禁用；列表显示「暂无保存版本」 |
| 5 | 「读取最新已存稿」（把最新版装进第 2 步） | 存在最新版 | `GET {persona_api}`.`current !== null`（`app.js:643-646`） | 点击提示「当前人格还没有保存过底稿。」 |
| 6 | **STEP 01 问卷与来源（整步保留）** | 需要「拿问卷/外部文本生成或重组人格」时才进；**已有手写人格、只想看/改/回滚时默认不进这一步** | 用户意图，无接口字段；可用性由 `persona.resolved` + `persona.text` 长度决定（`app.js:546-551`） | 现在它是默认首屏（`app.js:52` `activeStep=1`）——这就是要改的地方 |
| 7 | 粘贴原文模式 | 宿主没有可读人格文本，或要整理插件外的另一份文本 | `persona.resolved === false` 或用户显式切 `source_mode`（`app.js:177-182`） | 默认隐藏 |
| 8 | 整理强度 chips | 同第 6 行 | 无接口字段，仅 `standardize.strength` 入参（`persona_workshop_api.py:966-981`） | 默认 `medium`（`app.js:52`） |
| 9 | 问卷 10 项 + 参考材料 | 同第 6 行 | 无接口字段，写进 `standardize.answers`/`reference_material`（`persona_workshop_api.py:729-741`） | 默认折叠（`index.html:50-65`） |
| 10 | 「生成基础稿，进入审核」 | 有可用模型 + 人格文本非空 | `persona.resolved` 与 `sourceId`（`app.js:181`）；模型可用性**没有任何预检字段**，只有调用后才知道（`persona_workshop_api.py:263-273` 抛 `role_profile_model_unavailable`） | 按钮可点，但失败后才知道模型不行 |
| 11 | STEP 02 审核（分区/指标/骨架/清单） | 手上有一份待审核的生成稿 | 前端状态 `rightSections`/`rightRaw` 非空（`app.js:550-568`） | 空白面板 |
| 12 | STEP 03 情景试答 | 需要模型归纳口吻，且桥放行 `tryouts` | 桥白名单 `product-page.js:1112-1115`（当前 REJECT）+ 审核稿非空（`app.js:574-575`） | 点「生成一批试答」→「数据不完整，请刷新核对。」 |
| 13 | STEP 04 风格规则 | 同第 12 行 | 同上 + 至少一条选择（`app.js:586-592`；后端 selections 允许空列表，`persona_workshop_api.py:861-882`） | 同上 |
| 14 | STEP 05 左右对照 / 替换 / 还原 | 有「初始原文」可对照 | `sourceSnapshot` / `leftBaseline`（`app.js:261-297`）；右侧稿非空（`app.js:411-418`） | 行徽标「待补充」，替换按钮禁用 |
| 15 | 「保存左侧为新版本」 | 左侧非空 + 填了备注 | 前端校验 `app.js:609-614`；后端 `note` 非空（`models.py:31,118-126`，码 `persona_note_invalid`） | 前端拦下并聚焦备注框 |
| 16 | 「恢复到右侧」 | 选中了一版，且它不是最新版 | `version.version_id === expected()`（`app.js:521` 禁用条件） | 按钮禁用 |
| 17 | 冲突提示 / 自动重读 | 两人或两窗口同时改同一份 | `expected_current` ≠ 最新版（`service.py:96-104`，码 `persona_draft_conflict`） | 失败后静默重读再提示（`app.js:535-538`） |
| 18 | 迁移旧人格（跨区域，非本工作区） | 有 V1 数据目录且人格绑定对得上 | `profile-migration-plan` 回包 `source.kind`；失败码 `role_profile_migration_source_unbound` / `..._persona_mismatch`（`persona_workshop_api.py:514-600`） | 入口在自我页角色档案，见 §4-2 |
| 19 | 模型类步骤（第 1/3/4 步）的错误提示 | 只在模型调用真的发生时才出现 | `role_profile_model_unavailable` / `role_profile_draft_timeout` / `role_profile_source_changed`（`persona_workshop_api.py:263-273,777,834,894`） | 无预检，无法提前收起 |

**结论口径**：5 步问卷整体保留。只是当「已有手写人格、只想看/改/回滚」时，新 UI 默认进入的屏幕应当是
**版本列表 / 当前人格**，把第 1 步和 3/4 步作为「按需进入的高级流程」（见 §8）。

## 8. 给新 UI 的形态建议

**所有 8 条路由全部保留（兼容优先）；界面收敛成 2 个屏幕 + 一个按需进入的高级流程。**

共用的路由（新 UI 照旧调用，全部保留）：

1. `GET {persona_api}?limit=N`（可不传 `persona_id`）——拿 `persona{name,text,resolved}`、`versions[]`、
   `count`、`current`、`personas[]`。
2. `POST {persona_api}/command` `action=save`（`text` + `note` + `expected_current`）。
3. `POST {persona_api}/command` `action=restore`（`version_id` + `note` + `expected_current`）。
4. `POST {persona_api}/standardize`、`/tryouts`、`/style-rules`——问卷与口吻归纳，保留，收进高级流程。
5. `POST {persona_api}/profile-draft`、`/profile-migration-plan`、`/profile-migration-apply`——属于自我页
   角色档案区域，保留在原处。

只改界面层级，不改能力：把 5 步向导从「默认路径」改成「高级：重新整理人格」（可展开的按需流程），
默认屏是版本列表。**如果希望新 UI 真的能「保存到 AstrBot 人格」，必须新增后端能力——现有 8 条路由里
没有任何一条可以做到**（`persona_workshop_api.py:1-30`、`tests/test_persona_workshop_api.py:644-656`）。
这是一个需要产品决策的前置条件，不是 UI 层能绕开的。

屏幕 1「人格」：

- 顶部一行：人格名 + 「共 N 版 · 最近 2026-10-…」+ 一个「编辑」按钮。人格原文默认只读全文（可折叠段落），
  不做 8 分区、不做骨架卡片、不做步骤导语。
- 主按钮两个：「编辑当前人格」（进屏幕 2）、「历史」（展开同屏列表，不另开屏）。
- 空态（`resolved=false`）只留一句 + 「去 AstrBot 人格设置」深链。

屏幕 2「编辑」：

- 一个整段 textarea 承载左侧正文，配一个自动保存/保存按钮 + 备注（备注可默认填「YYYY-MM-DD 编辑」，
  后端要求非空，别把这个规则暴露给用户）。
- 历史以抽屉/侧栏形式常驻可见：每行「第 N 版 · 备注 · 时间 · 字数」+ 「恢复」；恢复即 `action=restore`，
  恢复后刷新当前正文。不要「恢复到右侧」这种中间态。
- 顶部一个「复制成稿」按钮（并说明失效时的降级：全选文本框）。若要做真正的闭环，见上：需要新增后端写回
  路由，或者至少给 AstrBot 人格编辑页的深链。
- 冲突处理：`persona_draft_conflict` → 静默重读 + 一句「已有更新，已载入最新版」；纯读写路径（`GET` 与
  `command`）都是毫秒级，不会碰到 18s 桥超时，所以**默认屏走这两条路由就不会遇到超时问题**；问卷/试答/
  风格三条模型路由留在高级流程里，超时问题也只会在那里出现（§5-2）。

## 9. 本次审计的验证与风险

- 只读：未修改仓库任何既有文件，未 commit/push，未联网调用任何接口。
- 已验证：`node --check pages/陪伴小屋/workspaces/persona/app.js` → 通过；用 Node 复算
  `product-page.js:1112-1115` 的白名单布尔式 → `persona/tryouts`、`persona/style-rules` 均 REJECT，其余 3 条 ALLOW。
- 未验证（静态推断，标「待定」）：`localStorage` 在 opaque-origin iframe 下抛错、`navigator.clipboard` 被
  permissions policy 拦截——两者都需要在真实宿主页面里跑一次才能定论，审计规则禁止运行线上/宿主页面。
- 风险：若产品决定「新 UI 要能直接改 AstrBot 人格」，会触碰 `instruction_hash` 与「人格宿主所有、只读」的既有
  设计约束（`persona_workshop_api.py:18-26`），需要单独的设计评审；本审计不提供该结论。

## 10. 功能完整性清单（新 UI 验收用）

口径：**兼容 + 页面重构，能力一条都不能丢**。下表覆盖 §1 视图、§2 字段、§3 操作的全部条目，含 8 条路由
各自对应的界面动作。路径中的 `{persona_api}` 取 `role().persona_api`（`multi_api.py:180-181`）。

| # | 功能点/步骤 | 当前入口 | 依赖接口（方法 + 路径，含 action） | 平台 / 能力前提 | 代码位置 |
|---|---|---|---|---|---|
| 1 | 打开工作区，首次读状态 | 自我页 · 人格问卷 tab（自动挂载） | `GET {persona_api}?limit=30` | 私聊目标（persona_api 非 null）、dashboard 登录 + `memory.manage`、宿主可解析人格 | `app.js:476-493,721-725`；`persona_workshop_api.py:213-231,244-254,290-314` |
| 2 | 头部：人格名 / 原文字数 / 状态徽标 / 版本数 | 常驻 | `GET {persona_api}`（回包 `persona.name/text/resolved`、`count`） | 同 #1 | `app.js:194-201`；`service.py:42-58`；`index.html:13-17` |
| 3 | ↻ 重新读取人格 | 头部 ↻ | `GET {persona_api}?persona_id=…` | 同 #1 | `app.js:615`；`index.html:38` |
| 4 | 切换宿主人格 | 「人格选择」下拉 | `GET {persona_api}?persona_id=…` | 宿主有 ≥2 份人格（单人格时下拉禁用） | `app.js:183-192,621-624`；`persona_catalog.py:101-116` |
| 5 | 每页版本数 10/30/100 | 第 5 步「显示 N 版」 | `GET {persona_api}?limit=…` | 无 | `app.js:620`；`index.html:114` |
| 6 | 宿主映射变更后自动重读 | 桥事件 `companion-mappings-change` | `GET {persona_api}` | 父页发出该事件 | `app.js:720`；`embedded-bridge.js:34-38` |
| 7 | 「已存 N 版」把最新版装进第 2 步 | 头部按钮 | `GET {persona_api}`（取 `current`）+ 本地解析 | 至少一版历史 | `app.js:643-651`；`index.html:15` |
| 8 | 保存为新版本 | 「保存左侧为新版本」/ 备注框回车 | `POST {persona_api}/command` `{action:"save",text,original_text,note,expected_current[,persona_id]}` | 左侧非空、`note` 非空、`expected_current` 等于最新版 | `app.js:609-614,688-689`；`persona_workshop_api.py:169-170,315-356`；`service.py:62-70` |
| 9 | 恢复历史版本（追加式回滚） | 版本预览「恢复到右侧」 | `POST {persona_api}/command` `{action:"restore",version_id,note,expected_current[,persona_id]}` | 该版本存在且不是最新版 | `app.js:520-521,542-545`；`service.py:71-93` |
| 10 | 版本预览（这一版正文 + 当时对照的原文） | 点版本行 | 无（用 `GET` 已取回的 `versions[]`） | 至少一版 | `app.js:494-524`；`index.html:113-115` |
| 11 | 复制某一版正文 | 预览「复制这一版」 | 无 | 浏览器 Clipboard 可用（沙箱 iframe 下待验证） | `app.js:522,459-464` |
| 12 | 备注必填且 ≤200 字 | 保存前校验 | 无（前端）；后端 `note` 非空 | 无 | `app.js:610-612`；`models.py:31,118-126` |
| 13 | 冲突后自动重读 | 保存/恢复失败时 | 上一次 `POST …/command` 返回 `persona_draft_conflict` → `GET {persona_api}` | 并发编辑同一 owner | `app.js:535-538`；`service.py:96-104` |
| 14 | 来源模式：当前人格 / 粘贴文本 | 第 1 步单选 | 本地（决定 `standardize.source_mode`） | 无 | `index.html:34-37`；`app.js:625-627,177-182` |
| 15 | 生成基础稿（问卷 → 8 分区草稿） | 「生成基础稿，进入审核」 | `POST {persona_api}/standardize` `{persona_id,answers,strength,source_mode,reference_material[,source_text]}` | 有可用 provider（`text_chat`）、人格文本 ≤30000 字、桥白名单放行 | `app.js:546-571,642`；`persona_workshop_api.py:718-804` |
| 16 | 整理强度 轻/中/深 | 第 1 步 chips | 无（`standardize.strength`） | 无 | `index.html:44-48`；`app.js:628-634` |
| 17 | 问卷 10 项 | 第 1 步 3 组 `<details>` | 无（`standardize.answers`） | 无 | `index.html:50-65`；`app.js:635-637` |
| 18 | 补充参考材料（≤4000 字） | 第 1 步卡片 | 无（`standardize`/`style-rules` 的 `reference_material`） | 无 | `index.html:66`；`app.js:639` |
| 19 | 粘贴人格原文（≤30000 字） | 第 1 步粘贴模式 | 无（`standardize.source_text`） | 无 | `index.html:39`；`app.js:638` |
| 20 | 空态「没有可整理的人格」 | 第 1 步 / 头部 | `GET {persona_api}`.`persona.resolved` | 人格未解析 | `index.html:19`；`app.js:181` |
| 21 | 审核指标卡（已填分区 / 提醒数 / 字数） | 第 2 步顶部 | 无 | 有生成稿 | `app.js:321-331`；`index.html:72` |
| 22 | 8 分区编辑 + 「未分区草稿」 | 第 2 步 | 无（最终进 `command save` 的 `text`） | 有生成稿 | `app.js:298-320,690-695`；`index.html:73` |
| 23 | 查看完整固定骨架文本 | 「查看完整骨架文本」 | 无（只读展示，内容硬编码） | 无 | `app.js:332-338,652-656`；`index.html:74-75` |
| 24 | 改动摘要 / 需要审核 / 审核清单 | 第 2 步底部三列 | 无 | 有生成稿 | `app.js:340-362`；`index.html:76` |
| 25 | 上一步 / 下一步（解锁后续步骤） | 第 2~5 步页脚 | 无（只改 `unlockedStep/activeStep`） | 无 | `app.js:165-176,657-663`；`index.html:77,88,101,112` |
| 26 | 生成一批情景试答 | 第 3 步 | `POST {persona_api}/tryouts` `{persona_id,draft_text,variation}` | 有可用模型 + 审核稿非空 + **桥白名单放行（当前 REJECT）** | `app.js:572-585,664`；`persona_workshop_api.py:805-847`；`product-page.js:1112-1115` |
| 27 | 换一批（`variation` 递增） | 第 3 步 | 同上 | 已生成过至少一批 | `app.js:665,578-580` |
| 28 | 6 情景翻页 / 单选 / 自定义回复 | 第 3 步卡片 | 无 | 已生成候选 | `app.js:364-404,666-680`；`index.html:86-87` |
| 29 | 说话偏好 / 输出约束偏好（各 ≤500 字） | 第 3 步顶部 | 无（`style-rules` 入参） | 无 | `index.html:83-84`；`app.js:640-641` |
| 30 | 归纳风格规则 | 「归纳风格规则」 | `POST {persona_api}/style-rules` `{persona_id,draft_text,selections,reference_material,speech_preference,constraint_preference}` | 有可用模型 + **桥白名单放行（当前 REJECT）** | `app.js:594-608,681`；`persona_workshop_api.py:848-906` |
| 31 | 风格 / 口吻示例文本编辑 | 第 4 步两个 `textarea` | 无（最终进 `command save` 的 `text`） | 有归纳结果或手填 | `app.js:406-408,682-685`；`index.html:98-99` |
| 32 | 左右逐段对照 + 差异徽标 | 第 5 步 | 无 | 有初始原文与右侧稿 | `app.js:410-419,433-457,696-699`；`index.html:107-110` |
| 33 | ⇦ 用右侧替换左侧 / 还原此段 | 每个对照行两个按钮 | 无 | 该行右侧非空 / 存在基线 | `app.js:700-719` |
| 34 | 复制左侧整体 / 右侧整体 | 对照头部 | 无 | 浏览器 Clipboard 可用（待验证） | `app.js:686-687,459-465`；`index.html:107-108` |
| 35 | 版本记录折叠区（列表 + 预览 + limit） | 第 5 步底部 `<details>` | 配合 #5 的 `GET {persona_api}?limit=…` | 至少一版 | `index.html:113-117`；`app.js:494-524` |
| 36 | **跨区域**：从当前人格整理角色档案 | 自我页 · 角色档案 ·「从当前人格整理角色档案」 | `POST {persona_api}/profile-draft` `{supplement,target,persona_id}` | 有可用模型、人格文本 ≤`MAX_SOURCE_CHARS`、V2 角色配置可读 | `app.js:3620`；`role-profile-draft.js:122-123`；`persona_workshop_api.py:357-470` |
| 37 | **跨区域**：迁入已有设定（预览） | 自我页 ·「迁入已有设定」 | `POST {persona_api}/profile-migration-plan` `{persona_id}` | V1 数据目录可读 + 人格绑定匹配 + 私聊目标 | `role-profile-migration.js:258`；`persona_workshop_api.py:514-600,640-662` |
| 38 | **跨区域**：迁入已有设定（执行） | 同一对话框确认 | `POST {persona_api}/profile-migration-apply` `{persona_id,plan_token,edit_token,changes}` | 同上 + V2 角色配置 `edit_token` 未变 | `role-profile-migration.js:287`；`persona_workshop_api.py:663-716` |
| 39 | 返回自我页 | 头部「返回自我页」 | 无（postMessage `navigate {tab:"selfProfile"}`） | 必须在宿主 iframe 内 | `app.js:616-619`；`product-page.js:1069-1077` |
| 40 | 通知条（单行结果 / 错误） | 常驻 `#notice` | 无（由 GET/POST 结果驱动） | 无 | `index.html:18`；`app.js:71-73` |
| 41 | 错误码 → 中文文案（27 条） | 任何失败 | 无（映射桥转发来的 `code`） | 无 | `app.js:28-51`；`product-page.js:30-40,1124-1136` |
| 42 | 本地草稿续存（问卷 / 左右栏 / 试答选择） | 自动（每次输入） | 无（`localStorage`，按 `sourceId` 分键） | iframe 需允许 `localStorage`（当前 sandbox 无 `allow-same-origin`，**待验证**） | `app.js:87-152` |
| 43 | 外观 / 主题注入（theme、density、radius…） | 父页 postMessage | 无 | 父页发出 appearance/theme 消息 | `embedded-bridge.js:13-50` |
| 44 | 工作区挂载、上下文下发、重挂载 | 旧面板容器 | 无（`srcdoc` + postMessage） | 角色目录已读到（`catalog`） | `product-page.js:803-819,942-1010` |
| 45 | 群目标下的空态兜底 | 自我页 · 人格问卷（群对象） | 无（后端不注册 persona 路由） | 当前目标为 group | `product-page.js:717,818`；`multi_api.py:180-181,312-313` |
| 46 | 桥请求白名单转发（只放行 3 条 persona 路径） | 工作区所有请求的转发层 | 白名单：`persona`(GET)、`persona/command`(POST)、`persona/standardize`(POST) | 上下文 `kind === "persona"` | `product-page.js:1112-1115` |
| 47 | 服务端权限门（安装级管理） | 所有 persona 路由 | 无（`memory.manage` on `page.management` scope） | dashboard 管理员账号、插件未停止 | `persona_workshop_api.py:213-231`；`web_api.py:65-76` |

合计 47 条。其中 #8/#9（`command`）、#15（`standardize`）、#26（`tryouts`）、#30（`style-rules`）、#36/#37/#38
（`profile-draft` / `profile-migration-plan` / `profile-migration-apply`）逐条对应 8 条路由的全部界面动作；
`GET {persona_api}` 另由 #1/#2/#3/#4/#5/#6/#7/#20 八个动作共用。新 UI 验收时按本表逐行对照即可。

