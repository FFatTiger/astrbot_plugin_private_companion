# 陪伴插件 UI 重构信息架构

> 依据：7 份审计产物（shell、setup、reply、models、memory、workspaces、api）及其 items 清单。范围是新 UI 的页面与入口设计；旧页面保持不动。原则是兼容、能力驱动显示、一个设置一个编辑位置，不删任何功能。
>
> 清单口径：按 items 的后端 key 精确合并；reply 清单使用 field 作为 key。重复表保留同一路由的 GET/POST 成对项，避免把 API 读写误判成页面重复。机器清单中有 1,509 条记录、1,259 个非空 key，其中 165 个 key 出现至少 2 次（415 条出现记录）；其中 25 个是同一路径的读写契约重复，页面级/设置级重复 key 为 140 个。



## 1. 跨页面重复表

处理规则：唯一归属列是新 UI 的唯一编辑位置；其它位置按“只读展示”或“跳转”处理。删除的是入口/编辑器，不是后端能力。叫法差异按审计原文收敛，推荐一个用户词；同名的通用字段只有在带上完整 key 后才视作同一项。

## 1A. 重复项逐键明细（机器清单精确 key）

以下表以 7 份 `.items.json` 的 `key`（reply 使用 `field`）精确合并；API 路径的 GET/POST 成对记录也保留，表示同一后端契约而非两个页面。位置压缩为“区域：用户路径”，只删重复编辑入口，不删能力。

| key（出现次数） | 所有位置（区域：用户路径） | 叫法差异 | 新 UI 唯一归属 | 其它位置处理 |
|---|---|---|---|---|
| `state` ×11 | workspaces：workspaces/relationships/app.js:5,116｜人物与群聊关系 > 关系与情感 > 关系记录 > 列表<br>workspaces：workspaces/relationships/app.js:141｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情<br>workspaces：workspaces/relationships/index.html:29-31, app.js:174,229｜人物与群聊关系 > 关系与情感 > 关系记录 > 筛选<br>workspaces：workspaces/relationships/app.js:6,163,205-227｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情 > 审阅通过<br>workspaces：workspaces/relationships/app.js:6,163｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情 > 采用到对话<br>workspaces：workspaces/relationships/app.js:6,163,193-204｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情 > 撤回记录弹窗<br>workspaces：workspaces/relationships/group-memory.js:79｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 列表<br>workspaces：workspaces/relationships/group-memory.js:90｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 陈述详情<br>workspaces：workspaces/relationships/group-memory.js:62,151-155｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 筛选<br>workspaces：workspaces/relationships/group-memory.js:95-99,126-133｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 陈述详情 > 管理员撤回<br>workspaces：workspaces/relationships/group-memory.js:108｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 回执 | 待审阅 / 已审阅 / 已采用 / 已撤回；筛选状态 / 全部状态；审阅通过；采用到对话；撤回记录；badge（acti | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact` ×9 | setup：；开始使用 > 第5步 > 主动功能与强度<br>setup：；开始使用 > 快速配置 > 主动联系<br>shell：app.js:3846 #contactPreferencesWorkspace + 主动与联系<br>shell：app.js:3772 #perceptionDatesWorkspace + 感知 > 时空与环境<br>shell：app.js:3775 #perceptionBalanceConfigWorkspace + 感知 > 外部与记录<br>shell：app.js:3778 #perceptionWeatherConfigWorkspace + 感知 > 时空与环境<br>shell：app.js:3781 #perceptionOnlineQueryWorkspace + 感知 > 外部与记录<br>shell：app.js:3784 #perceptionContactScreenWorkspace + 感知 > 现实触及 > 屏幕与感知<br>workspaces：workspaces/identity/member-editor.js:674｜人物与群聊关系 > 关系网 > 成员详情 > 身份与权限 | 主动联系（master/rhythm/quiet/greeting 四分区）；主动联系常用设置；主动联系；重要日子与饭点 | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `private_access` ×6 | setup：；开始使用 > 快速配置 > 人物与资料<br>shell：app.js:4028 #identityPrivateAccessSettingsWorkspace + 用户页标题弹窗<br>shell：app.js:4017 #privateAccessWorkspace + #manage/identity-access<br>workspaces：app.js:4240-4243 → app.js:4028 + 4039<br>workspaces：app.js:4017-4021（#manage/identity-access 独立页）<br>workspaces：app.js:3641（renderIdentityPageOriginal） | 新用户默认权限；私聊用户权限；私聊默认权限；访问规则 / 私聊默认权限 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `conversation.presentation` ×5 | shell：app.js:909 #replyWorkspace + 表达 > 文字风格与分段<br>shell：app.js:3475 #expressionVoiceReplyHost + 表达 > 语音朗读<br>shell：app.js:3475 #expressionPlatformReplyHost + 表达 > 平台动作<br>shell：app.js:910 #decisionReplyWorkspace + 决策<br>shell：app.js:912 #contextImageWorkspace + 理解 > 总览「适用范围」 | 文字风格与分段；语音朗读；平台动作；回应判断/参与节奏/沉默与安全；图片、视频与文件理解 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `knowledge` ×5 | shell：app.js:3626 #knowledgeConfigWorkspace + 自我 > 世界知识<br>shell：app.js:4029 #identityMemberClueSettingsWorkspace + 群聊页标题弹窗<br>shell：app.js:3634 #memberClueWorkspace + renderIdentityPageOriginal<br>workspaces：；<br>workspaces：app.js:3629（自我 > 世界知识） | 世界知识与来源；群聊成员线索；群成员线索 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `default_nickname` ×4 | workspaces：self-relationship.js:48,58,181｜自我 > 相处资料<br>workspaces：workspaces/identity/member-editor.js:580,1321｜人物与群聊关系 > 关系网 > 成员详情 > 关系设定<br>workspaces：workspaces/identity/app.js:571｜人物与群聊关系 > 关系网 > 关系雷达标签<br>workspaces：workspaces/identity/member-editor.js:575｜人物与群聊关系 > 关系网 > 成员详情 > 人工关系资料 | 对用户的称呼；称呼（节点副标题）；称呼 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `group_participation` ×4 | shell：app.js:3829 #groupParticipationConfigWorkspace + 决策<br>shell：app.js:3832 #groupInterjectionConfigWorkspace + 决策<br>shell：app.js:3520 #groupDenoiseWorkspace + 表达 > 群聊表达<br>shell：app.js:3836 #behaviorLearningConfigWorkspace + 学习 > 行为模仿 | 群聊参与；本群主动插话；群聊表达去噪；行为模仿策略 | 对话 › 参与 | 保留唯一编辑位置；其它位置只读或跳转 |
| `growth_records` ×4 | memory：learning-page.js:684（chainWorkView）+ 学习与成长 > 成长链路<br>memory：learning-overview.js:111-151 + 学习与成长 > 总览<br>memory：product-page.js:1180（growthMarkup）+ 小屋 > 家具「成长花架」<br>memory：learning-page.js:572-637（trackView/lane/card）+ layout!=chain 时 | 成长记录列表；待裁决 / 培育中泳道；目标与成长清单；轨道视图（生产不可达） | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `life` ×4 | shell：app.js:3848 #replyGateConfigWorkspace + 主动与联系 > 开口闸门<br>shell：app.js:3852 #decisionGateWorkspace + 决策 > 沉默策略<br>shell：app.js:797 #lifeConfigWorkspace + 日记与生活页底部<br>workspaces：app.js:791-793（小屋 > 日记与生活面板内） | 休息时的回复与补看；生活例程 | 生活 › 日记与作息 | 保留唯一编辑位置；其它位置只读或跳转 |
| `model.provider_id` ×4 | setup：；开始使用 > 第2步 > 配置插件模型<br>setup：；开始使用 > 快速配置 > 模型路由<br>setup：；资料与维护 > 旧版资料迁入 > 配置对照 > 审计项「去设置」<br>workspaces：workspaces/host/index.html:28-38、app.js:1312-1343｜账号与会话 > 共享启动模型 | 初始主 Provider；陪伴通用模型；模型（迁移流程内嵌模型页）；共享启动模型（固定/保存） | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `person` ×4 | shell：app.js:4027 #identityPersonSettingsWorkspace + 用户页标题弹窗<br>shell：app.js:3636 #personConfigWorkspace + renderIdentityPageOriginal<br>workspaces：app.js:4240-4243（关系网页头按钮）→ app.js:4027 + 4039（openIdentitySettings 弹窗）<br>workspaces：app.js:3635（renderIdentityPageOriginal 的 details 块） | 用户默认资料；熟人卡默认设置 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `review_state` ×4 | workspaces：workspaces/relationships/group-memory.js:10,90｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 安全审阅 > 命中详情<br>workspaces：workspaces/relationships/group-memory.js:144-147｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 安全审阅 > 筛选<br>workspaces：workspaces/relationships/group-memory.js:104,134-139｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 安全审阅 > 命中详情<br>workspaces：workspaces/relationships/group-memory.js:104,134-139｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 安全审阅 > 命中详情 | 待审阅 / 已审阅 / 已忽略；筛选（待审阅/已审阅/已忽略/全部）；标记已审阅；忽略此命中 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role_relation` ×4 | workspaces：self-relationship.js:49,58,181｜自我 > 相处资料<br>workspaces：workspaces/identity/member-editor.js:580,1321｜人物与群聊关系 > 关系网 > 成员详情 > 关系设定<br>workspaces：workspaces/identity/app.js:570-575｜人物与群聊关系 > 关系网 > 关系雷达标签<br>workspaces：workspaces/identity/member-editor.js:574｜人物与群聊关系 > 关系网 > 成员详情 > 人工关系资料 | 关系定位；称呼 · 关系（节点副标题）；关系 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role_state` ×4 | shell：app.js:787 #roleStateWorkspace + 生活 > 状态<br>shell：app.js:890 #perceptionRoleWeatherWorkspace + 感知 > 时空与环境<br>shell：app.js:712 #roleStateWorkspace feature=planning + 家具「生活挂历」<br>shell：app.js:3685 #roleStateWorkspace section=patrol + 治理与维护 > 每日巡视 | 角色状态；角色天气设置；当天安排；每日巡视 | 今天/生活 | 保留唯一编辑位置；其它位置只读或跳转 |
| `acquaintance` ×3 | shell：app.js:4006 workspace('identity','network') + 左栏「关系网」<br>shell：app.js:4011 workspace('identity','people') + #manage/identity-people<br>shell：app.js:4014 workspace('identity','groups') + #manage/identity-groups | 关系网；用户；群聊 | 联系人与群 | 保留唯一编辑位置；其它位置只读或跳转 |
| `binding` ×3 | setup：；管理 > 开始使用 > 第1步（pending 确认卡/已绑定卡/发送指令卡三态 + bindingFacts:2851）<br>setup：；开始使用 > 第1步 > 核对核心管理员窗口<br>setup：；开始使用 > 第1步 | 核心管理员窗口（平台/Bot 账号/私聊对象/人格）；确认此窗口；我已发送，检查绑定 / 重新读取 | 系统 › 开始使用 | 保留唯一编辑位置；其它位置只读或跳转 |
| `busy_gate` ×3 | shell：app.js:3847 #replyGateConfigWorkspace + 主动与联系 > 开口闸门<br>shell：app.js:3851 #decisionGateWorkspace + 决策 > 沉默策略<br>shell：app.js:3768 #busyGateWorkspace | 忙碌时的回复与主动联系；忙碌时的回复与联系；忙碌闸门 | 对话 › 参与 › 忙碌与休息 | 保留唯一编辑位置；其它位置只读或跳转 |
| `growth.command` ×3 | memory：learning-page.js:639 动作按钮组（由后端 actions 下发）<br>memory：learning-overview.js:113-173 + 总览卡片<br>memory：product-page.js:1182 + 成长花架卡片 | 确认 / 继续 / 暂停 / 已完成 / 归档 / 撤回；确认 / 暂停 / 归档… | 生活 › 学习与成长 | 保留唯一编辑位置；其它位置只读或跳转 |
| `interpretation` ×3 | workspaces：workspaces/relationships/app.js:117, style.css:19｜人物与群聊关系 > 关系与情感 > 关系记录 > 列表<br>workspaces：workspaces/relationships/app.js:145｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情<br>workspaces：workspaces/relationships/index.html:47-48, app.js:199,211｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情 > 更正理解弹窗 | 正文摘要（两行）；正文；完整的关系理解 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `items` ×3 | workspaces：workspaces/relationships/index.html:27-35, app.js:168-192｜人物与群聊关系 > 关系与情感 > 关系记录<br>workspaces：workspaces/relationships/group-memory.js:62,74-82｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述<br>workspaces：workspaces/relationships/group-memory.js:61-62,74-82｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 安全审阅 | 关系记录；共享陈述；安全审阅 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `model_task_route.{kind}.provider/fallback` ×3 | setup：；开始使用 > 第2步 > 任务模型路由<br>setup：；开始使用 > 快速配置 > 模型路由<br>setup：；资料与维护 > 旧版资料迁入 > 迁移配置调整 | 任务模型路由（17 种任务全列）；常用后台任务（仅 proactive.compose/calendar.plan/ro | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `prompt` ×3 | models：models-page.js:375 + 模型与连接 > 功能模型 > 精确配置（任务卡）<br>memory：maintenance-page.js:814（promptWorkspaceMarkup）+ 治理与维护 > 任务提示词<br>memory：models-page.js:343 + 连接与运行 > 模型与连接 > 任务配置 | 任务附加提示词 / 对话附加提示；任务提示词；附加提示词 | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `provider` ×3 | models：models-page.js:369 + 管理 > 模型与连接 > 功能模型 > 模型配置 > 精确配置（任务卡）<br>models：models-page.js:1714 + 模型与连接 > 功能模型 > 模型配置 > 快速配置（分组卡）<br>models：models-page.js:298 + 模型与连接 > 功能模型 > 精确配置 > 工具条 | 主模型提供方；统一指派模型提供方；批量指派模型提供方（工具条） | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `refresh` ×3 | workspaces：workspaces/identity/index.html:22-24｜关系网 / 用户 / 群聊 > 页头<br>workspaces：workspaces/persona/index.html:38 / app.js:615 · 自我 > 人格问卷 > 01 问卷与来源<br>workspaces：workspaces/life/app.js:230｜小屋 > 日记与生活 > 顶部 | 重新读取；重新读取人格（↻）；刷新记录 | 当前页面的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `relationship_profile.*` ×3 | setup：；开始使用 > 第4步 > 整理熟人卡<br>setup：；开始使用 > 快速配置 > 人物与资料<br>setup：role-profile-draft.js openDialog(target=relationship_profile)；其他页面经 data-role-profile-draft-open 可复用 | 熟人卡（13 字段草稿勾选保存）；人物与资料（relationship_profile journal 呈现）；整理当前 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `replacement_rules` ×3 | models：models-page.js:1837-1846 + 模型与连接 > 功能模型 > 替换策略 > 关键词换模<br>models：models-page.js:1849-1878 + 模型与连接 > 功能模型 > 替换策略 > 高价时段替代<br>models：models-page.js:1847 + 模型与连接 > 功能模型 > 替换策略 > 关键词换模 > JSON 源码 | 关键词换模（规则卡）；高价时段替代（24 格时段带）；JSON 源码 | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `revision` ×3 | workspaces：workspaces/identity/member-editor.js:599-601（保存按钮 disabled=!person.revision）<br>workspaces：workspaces/relationships/app.js:143｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情<br>workspaces：workspaces/relationships/group-memory.js:78｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 列表 | （不显示）；第 N 版 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_timezone` ×3 | memory：state-maintenance.js:39 + 小屋 > 状态 > 时间与日期<br>memory：state-maintenance.js:39 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:39 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 规划时区 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.state.values` ×3 | memory：state-page.js:304（dashboardMarkup）+ 状态页<br>memory：home-sidebar.js:183-215（renderState，由 product-page.js:736 stateCard 调用）+ 小屋首页<br>memory：app.js:1648-1659（observationContent）+ 小屋 > 生活观察 > 状态变化 | 状态看板 8 图块；此刻的状态（首页状态条）；状态变化（生活观察页签） | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role_profile` ×3 | shell：app.js:3618 #roleProfileConfigWorkspace + 自我 > 角色档案<br>workspaces：；<br>workspaces：app.js:3621 · 自我 > 角色档案（跨区域） | 角色稳定档案；角色稳定档案 / 角色档案；角色档案（role_profile 字段组） | 角色 › 角色档案 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role_profile.*` ×3 | setup：；开始使用 > 第3步 > 从人格整理角色设定<br>setup：；开始使用 > 快速配置 > 人物与资料<br>setup：； | 角色设定（45 字段草稿勾选保存）；人物与资料（role_profile journal 呈现）；整理角色资料（全局弹窗 | 角色 › 角色档案 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_enabled` ×3 | models：reply-page.js:358 + 表达 > 语音朗读 > 语音与朗读<br>models：workspaces/identity/member-editor.js:99 + 关系网 > 用户/群聊 > 成员编辑 > 语音回复<br>models：models-page.js:894 + 模型与连接 > 语音模型 | 启用语音；启用语音回复；语音回复 已开启/未开启（KPI） | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_ja_provider_id` ×3 | models：models-page.js:901-903 + 模型与连接 > 语音模型 > 语种绑定<br>models：reply-page.js:361-362 + 表达 > 语音朗读 > 语音与朗读<br>models：workspaces/identity/member-editor.js:99-103 + 关系网 > 用户/群聊 > 成员编辑 > 语音回复 | 日语 语音服务；日语 TTS 扩展；日语语音扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_timeout_seconds` ×3 | models：models-page.js:921 + 模型与连接 > 语音模型 > 合成超时与保存<br>models：reply-page.js:361 + 表达 > 语音朗读 > 语音与朗读<br>models：workspaces/identity/member-editor.js:99-103 + 关系网 > 用户/群聊 > 成员编辑 > 语音回复 | 合成超时（秒） | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `/astrbot_plugin_private_companion/accounts` ×2 | api：<br>api： | 同一路径的读/写条目 | 联系人与群 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/acquaintance/authorization` ×2 | api：<br>api： | 同一路径的读/写条目 | 联系人与群 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/acquaintance/open-loops` ×2 | api：<br>api： | 同一路径的读/写条目 | 联系人与群 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/acquaintance/settings` ×2 | api：<br>api： | 同一路径的读/写条目 | 联系人与群 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/host-options/balance` ×2 | api：<br>api： | 同一路径的读/写条目 | 对应域的唯一设置页 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/host-options/weather` ×2 | api：<br>api： | 同一路径的读/写条目 | 对应域的唯一设置页 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/perception` ×2 | api：<br>api： | 同一路径的读/写条目 | 能力 › 感知 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/semantic` ×2 | api：<br>api： | 同一路径的读/写条目 | 能力 › 表情与语义 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `/astrbot_plugin_private_companion/storage` ×2 | api：<br>api： | 同一路径的读/写条目 | 系统 › 资料与维护 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `accounts.role` ×2 | setup：；资料与维护 > 旧版资料迁入 > 第1步 > 新建角色<br>workspaces：account_session_api.py:145-217； | 新建角色 / 创建角色并继续（角色名 + 人格多选）；（本页无入口） | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `after_id` ×2 | workspaces：workspaces/relationships/index.html:33-34, app.js:230-231｜人物与群聊关系 > 关系与情感 > 关系记录 > 分页<br>workspaces：workspaces/relationships/group-memory.js:157-158｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 分页 | 上一页 / 下一页 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `analysis_provider` ×2 | models：semantic-page.js:45,138 + 学习与成长 > 语义目录<br>models：perception-overview.js:599 + 感知 > 概览 | 视觉与词义分析；识图模型状态 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `budget` ×2 | shell：app.js:3662 #budgetConfigWorkspace + 模型与连接<br>memory：app.js:3663（renderModelsPage 内 budgetConfigWorkspace）+ 模型与连接 | 后台任务预算 | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `busy_gate + life` ×2 | workspaces：app.js:2136（决策页）<br>workspaces：app.js:4053-4056（主动联系 > 开口闸门） | 沉默策略 · 忙碌与休息；开口闸门设置 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `companion-v2-density` ×2 | shell：appearance-page.js + 外观与设置<br>shell：app.js:1700 appearancePanel | 显示密度 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `companion-v2-motion` ×2 | shell：appearance-page.js + 外观与设置<br>shell：app.js:1703 appearancePanel | 动效 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `companion-v2-radius` ×2 | shell：appearance-page.js + 外观与设置<br>shell：app.js:1701 appearancePanel | 圆角 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `companion-v2-theme` ×2 | shell：appearance-page.js:301 + 外观与设置<br>shell：app.js:1705 appearancePanel + 旧外观弹窗/内联面板 | 主题 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `companion-v2-type-scale` ×2 | shell：appearance-page.js + 外观与设置<br>shell：app.js:1702 appearancePanel | 字号 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `draft.text` ×2 | workspaces：workspaces/persona/app.js:303 · 自我 > 人格问卷 > 02 基础稿审核 > 未分区草稿<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 原始文本（未分区草稿）；未分区原文（左：初始人格 / 右：标准化版本） | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `enabled` ×2 | models：semantic-page.js:38 + 学习与成长 > 语义目录<br>workspaces：workspaces/relationships/app.js:102-107｜人物与群聊关系 > 关系与情感 > 关系记录 > 不可用卡片 | 启用语义目录；当前配置开关未启用 | 各自所属能力的唯一设置页 | 保留唯一编辑位置；其它位置只读或跳转 |
| `extra` ×2 | workspaces：self-relationship.js:54,58,181｜自我 > 相处资料<br>workspaces：workspaces/identity/member-editor.js:585,1321｜人物与群聊关系 > 关系网 > 成员详情 > 关系设定 | 其他补充 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `fallback` ×2 | models：models-page.js:370 + 模型与连接 > 功能模型 > 精确配置（任务卡）<br>models：models-page.js:1888-1890 + 模型与连接 > 功能模型 > 替换策略 > 拒答替代 | 备用模型提供方；拒答替代模型 | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `fields[].explicit` ×2 | models：models-page.js:386-387 + 模型与连接 > 功能模型 > 精确配置（任务卡底部）<br>models：models-page.js:299 + 模型与连接 > 功能模型 > 精确配置 > 工具条 | 跟随上级（9 个复选框）；恢复跟随上级 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `group_networks` ×2 | workspaces：workspaces/identity/app.js:944-1140｜关系网 / 用户 / 群聊 > 群聊 > 群详情<br>workspaces：workspaces/host/app.js:937-1164｜账号与会话 > 群节点抽屉 | 群详情（V2 群聊接入 / 群聊近况 / 活跃群友 / 成员互动 / 成员与熟人卡 / 待确认成员线索）；群成员与关系网 | 联系人与群 | 保留唯一编辑位置；其它位置只读或跳转 |
| `group_participation.atmosphere/denoise/interjection` ×2 | setup：；开始使用 > 第7步 > 群聊配置<br>setup：；开始使用 > 快速配置 > 群聊参与 | 群聊参与方式 | 对话 › 参与 | 保留唯一编辑位置；其它位置只读或跳转 |
| `groups[]` ×2 | workspaces：workspaces/identity/index.html:94-125、app.js:1015（navigate group-memory）<br>workspaces：workspaces/identity/index.html:88-97、app.js:842-857｜关系网 / 用户 / 群聊 > 关系网 | 群聊入口 / 群内成员；群聊入口（卡片） | 联系人与群 | 保留唯一编辑位置；其它位置只读或跳转 |
| `growth.command#revise` ×2 | memory：learning-page.js:716（reviseForm）+ 成长链路右栏<br>memory：product-page.js:1182 弹窗 #growth-form | 修订（标题/描述/进展）；修订 | 生活 › 学习与成长 | 保留唯一编辑位置；其它位置只读或跳转 |
| `host.start` ×2 | setup：；开始使用 > 完成页（host.accepting=false 时）<br>workspaces：workspaces/host/index.html:19 + app.js:1825-1847｜账号与会话 > 状态面板 | 重新连接；准备并启动 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `identity_tier` ×2 | workspaces：workspaces/identity/member-editor.js:663-753｜成员详情 > 身份与权限 > 身份级别<br>workspaces：workspaces/identity/member-editor.js:571,573,675｜人物与群聊关系 > 关系网 > 成员详情 > 身份与权限 | 身份级别（普通用户/重要用户/核心用户）+「设为核心用户」；身份级别 / 身份 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `interaction` ×2 | workspaces：self-relationship.js:53,58,181｜自我 > 相处资料<br>workspaces：workspaces/identity/member-editor.js:584,1321｜人物与群聊关系 > 关系网 > 成员详情 > 关系设定 | 相处方式 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `kind` ×2 | workspaces：workspaces/relationships/app.js:31,116｜人物与群聊关系 > 关系与情感 > 关系记录 > 列表<br>workspaces：workspaces/relationships/app.js:31,140｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情 | 关系背景 / 情绪片段 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `largeText` ×2 | shell：appearance-page.js:196 + 外观与设置<br>shell：app.js:1714 appearancePanel data-display=largeText | 放大辅助文字 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `legacy.data-plan` ×2 | setup：；资料与维护 > 旧版资料迁入 > 逐项迁移<br>setup：；资料与维护 > 旧版资料迁入 > 逐项迁移 | 读取资料清单 / 重新试算所选资料 / 刷新资料清单；资料明细与保留项目（表情/日记/世界书/私聊用户/任务/相册/记忆 | 系统 › 开始使用/迁移 | 保留唯一编辑位置；其它位置只读或跳转 |
| `legacy.install` ×2 | setup：；资料与维护 > 旧版资料迁入 > 安装提示卡<br>setup：；资料与维护 > 旧版资料迁入 > 安装提示卡（restart_observed 时） | 立即继承旧版配置；确认重载后运行正常 | 系统 › 开始使用/迁移 | 保留唯一编辑位置；其它位置只读或跳转 |
| `legacy.scope` ×2 | setup：；资料与维护 > 旧版资料迁入 > 第2步 > 迁移范围<br>setup：；资料与维护 > 旧版资料迁入 > 第2步 | 读取迁移范围（重新读取迁移范围按钮）；迁移范围（人格自动归入/群自动归入/私聊联系人/需确认 四宫格 + 明细列） | 系统 › 开始使用/迁移 | 保留唯一编辑位置；其它位置只读或跳转 |
| `life.routine/sleep` ×2 | setup：；开始使用 > 第6步 > 日程与观察<br>setup：；开始使用 > 快速配置 > 日程与作息 | 日程与作息（routine/sleep）；日记例程与睡眠作息 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `life_activities` ×2 | shell：app.js:1615 homeScheduleBand + 首页右栏<br>shell：app.js:1628 observationFilter=timeline + 生活观察 | 今日安排；生活轨迹 | 今天/生活 | 保留唯一编辑位置；其它位置只读或跳转 |
| `memory_atoms` ×2 | memory：memory-page.js:454（corpusMarkup）+ 事实与经历 > 事实治理<br>memory：product-page.js:775（row「记忆工作区 · 查看」）+ 小屋首页概览行 | 事实列表；记忆工作区（首页概览入口） | 生活 › 记忆 | 保留唯一编辑位置；其它位置只读或跳转 |
| `model.maintenance.recent` ×2 | memory：maintenance-page.js:1141（recentPreviewMarkup）+ Token 统计<br>memory：maintenance-page.js:1219（recentMarkup）+ 治理与维护 > 最近调用 | 最近调用预览；最近调用（完整表） | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |

[92 more lines in file. Use offset=81 to continue.]| `model.modelStatus.tasks` ×2 | memory：maintenance-page.js:1565（taskAuditMarkup）+ 排障折叠<br>memory：models-page.js:113-385 + 模型与连接 | 模型任务路由；任务模型配置 | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `model_tasks` ×2 | shell：app.js:3662 #modelWorkspace + 模型与连接<br>shell：app.js:1986 #modelWorkspace + 感知 > 模型能力 | 任务模型配置；模型能力与路由 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `note` ×2 | workspaces：workspaces/relationships/group-memory.js:135｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 安全审阅 > 命中详情<br>workspaces：workspaces/persona/index.html:111 · 自我 > 人格问卷 > 05 对照与落地 > 保存 | （无界面标签）；版本备注 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `observed_at` ×2 | workspaces：workspaces/relationships/app.js:32,118｜人物与群聊关系 > 关系与情感 > 关系记录 > 列表<br>workspaces：workspaces/relationships/app.js:143｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情 | 日期（2026年·月·日）；观察于 … | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `persons[]` ×2 | workspaces：workspaces/identity/app.js:107-160（mergeDirectoryPeople）｜关系网 | 用户 | 群聊<br>workspaces：workspaces/identity/index.html:63-86、app.js:780-857｜关系网 / 用户 / 群聊 > 关系网 | 关系网 / 用户目录 / 群聊目录；关系分层（两边都有 / 仅私聊 / 仅群聊 / 暂无往来） | 联系人与群 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.automatic_enabled` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 总开关与补充偏好；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.dedup_weather_window_minutes` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.enabled` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 总开关与补充偏好；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.idle_seconds` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 开口节奏与每日额度；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.interval_seconds` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 开口节奏与每日额度；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.note` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 总开关与补充偏好；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.official_alert_min_severity` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.official_alert_poll_minutes` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.official_weather_alert_enabled` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.pause_until` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 免打扰与临时暂停；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.quiet_enabled` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 免打扰与临时暂停；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.quiet_end` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 免打扰与临时暂停；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.quiet_start` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 免打扰与临时暂停；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.quiet_timezone` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 免打扰与临时暂停；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.weather_change_enabled` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.weather_checkin_enabled` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.weather_checkin_time` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive.contact.weather_sample_minutes` ×2 | reply：互动能力 › 主动联系<br>reply：小屋 › 状态 | 天气与预警；主动联系（本窗口） | 生活 › 主动联系 | 保留唯一编辑位置；其它位置只读或跳转 |
| `proactive_test` ×2 | setup：；开始使用 > 第8步<br>setup：；开始使用 > 第8步/完成页 | 运行主动联系测试 / 重新运行主动联系；主动测试回执（delivered/received/failed/unknown | 系统 › 开始使用 | 保留唯一编辑位置；其它位置只读或跳转 |
| `relationship_profile` ×2 | shell：app.js:3572 #relationshipProfileConfigWorkspace + 自我 > 相处资料<br>workspaces：app.js:3582 + 3623-3624（自我 > 相处资料，#relationshipProfileConfigWorkspace → self-relationship.js） | 核心用户关系资料；核心用户关系资料 / 相处资料 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `relay` ×2 | shell：app.js:3638 #relayConfigWorkspace + renderIdentityPageOriginal<br>workspaces：app.js:3641（markup）+ app.js:3792（mount） | 跨窗口递话 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.growth.propose_enabled` ×2 | memory：learning-page.js:522（gateView）+ 成长链路顶部<br>memory：关系与权限 > 用户 > 成长授权 | 提出成长建议 | 生活 › 学习与成长 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.growth.read_enabled` ×2 | memory：learning-page.js:522（gateView）+ 成长链路顶部<br>memory：关系与权限 > 用户 > 成长授权（app.js:4073 附近） | 读取成长记录 | 生活 › 学习与成长 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.calendar_enabled` ×2 | memory：state-maintenance.js:25 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:25 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 启用角色日程 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.cycle_enabled` ×2 | memory：state-maintenance.js:59 + 小屋 > 状态 > 齿轮「状态功能与首页展示」弹窗<br>memory：state-maintenance.js:59 + 小屋 > 状态 > 生理期 > 周期方案 / 阶段表达 | 启用生理期模拟 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.daily_state_patrol_enabled` ×2 | memory：state-maintenance.js:77 + 小屋 > 状态 > 每日巡视<br>memory：state-maintenance.js:77 + 连接与运行 > 治理与维护 > 每日巡视（同一组件 section=patrol） | 启用每日状态巡视 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.daily_state_patrol_retention_days` ×2 | memory：state-maintenance.js:79 + 小屋 > 状态 > 每日巡视<br>memory：state-maintenance.js:79 + 连接与运行 > 治理与维护 > 每日巡视（同一组件 section=patrol） | 巡视记录保留天数 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.daily_state_patrol_time` ×2 | memory：state-maintenance.js:78 + 小屋 > 状态 > 每日巡视<br>memory：state-maintenance.js:78 + 连接与运行 > 治理与维护 > 每日巡视（同一组件 section=patrol） | 巡视时刻（HH:MM，本地时间） | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.health_enabled` ×2 | memory：state-maintenance.js:52 + 小屋 > 状态 > 齿轮「状态功能与首页展示」弹窗<br>memory：state-maintenance.js:52 + 小屋 > 状态 > 健康 > 配置健康设置 | 模拟健康感受 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.hunger_enabled` ×2 | memory：state-maintenance.js:51 + 小屋 > 状态 > 齿轮「状态功能与首页展示」弹窗<br>memory：state-maintenance.js:51 + 小屋 > 状态 > 饥饿 > 配置饥饿设置 | 模拟饥饿感受 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.mood_enabled` ×2 | memory：state-maintenance.js:72 + 小屋 > 状态 > 齿轮「状态功能与首页展示」弹窗<br>memory：state-maintenance.js:72 + 小屋 > 状态 > 心情 > 调整心情 | 启用心情模拟 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_annual_calendars` ×2 | memory：state-maintenance.js:46 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:46 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 年度日历与调休 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_enabled` ×2 | memory：state-maintenance.js:38 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:38 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 启用自动规划 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_horizon_days` ×2 | memory：state-maintenance.js:40 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:40 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 长期规划范围（天） | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_max_items` ×2 | memory：state-maintenance.js:42 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:42 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 每次最多安排（项） | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_prompt` ×2 | memory：state-maintenance.js:43 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:43 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 规划偏好 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_refine_minutes` ×2 | memory：state-maintenance.js:41 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:41 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 提前细化时间（分钟） | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_weather_enabled` ×2 | memory：state-maintenance.js:48 + 小屋 > 状态 > 天气 > 编辑地点与感知<br>memory：state-maintenance.js:48 + 互动能力 > 感知 > 角色天气（同一组件 section=weather） | 启用角色天气感知 | 生活 › 状态 › 天气 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_weather_location` ×2 | memory：state-maintenance.js:49 + 小屋 > 状态 > 天气 > 编辑地点与感知<br>memory：state-maintenance.js:49 + 互动能力 > 感知 > 角色天气（同一组件 section=weather） | 角色天气地点 | 生活 › 状态 › 天气 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.planning_weather_max_age_minutes` ×2 | memory：state-maintenance.js:50 + 小屋 > 状态 > 天气 > 编辑地点与感知<br>memory：state-maintenance.js:50 + 互动能力 > 感知 > 角色天气（同一组件 section=weather） | 天气信息最长沿用（分钟） | 生活 › 状态 › 天气 | 保留唯一编辑位置；其它位置只读或跳转 |
| `role.state.schedule_simulation_mode` ×2 | memory：state-maintenance.js:37 + 小屋 > 状态 > 日程配置 > 编辑日程与规划设置<br>memory：state-maintenance.js:37 + 小屋 > 生活挂历（家具面板，同一 planning 子页） | 日程模式 | 生活 › 状态 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.appearance` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 外貌特征；外貌特征（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.boundaries` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 社交距离与边界；社交距离与边界（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.habits` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 兴趣习惯与表达；兴趣习惯与表达（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.identity` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 基本信息；基本信息（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.motivations` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 价值、目标与关系；价值、目标与关系（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.personality` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 性格特质；性格特质（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.supplement` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 长期补充条件；长期补充条件（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `sections.world` ×2 | workspaces：workspaces/persona/app.js:298-320 · 自我 > 人格问卷 > 02 基础稿审核<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 世界设定；世界设定（左：初始人格 / 右：标准化版本） | 角色 › 人格问卷 | 保留唯一编辑位置；其它位置只读或跳转 |
| `source_count` ×2 | workspaces：workspaces/relationships/app.js:118｜人物与群聊关系 > 关系与情感 > 关系记录 > 列表<br>workspaces：workspaces/relationships/app.js:146｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情 | N 个来源；N 个原来源当前有效 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `state_summary` ×2 | shell：app.js:1613 homeStateBand + 首页右栏<br>shell：app.js:1638 observationFilter=state + 生活观察 | 此刻的状态；状态变化 | 今天 | 保留唯一编辑位置；其它位置只读或跳转 |
| `statement` ×2 | workspaces：workspaces/relationships/group-memory.js:77｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 列表<br>workspaces：workspaces/relationships/group-memory.js:89｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 陈述详情 | 陈述标题 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `status.providers` ×2 | models：models-page.js:405-415 + 模型与连接 > 功能模型 > 精确配置 > 视图：按提供方<br>models：models-page.js:2042-2052 + 模型与连接 > 功能模型 > 态势图 > 点 provider 名 | 按提供方；模型提供方抽屉 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `status.tasks` ×2 | models：models-page.js:1621-1650 + 模型与连接 > 功能模型 > 态势图<br>models：app.js:1989-1998 + 感知 > 配置 > 模型能力 | 态势图（任务 → provider 清单）；模型能力 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `style.examples` ×2 | workspaces：workspaces/persona/index.html:99 · 自我 > 人格问卷 > 04 风格规则<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 口吻示例与标志表达；口吻示例与标志表达（左：初始人格 / 右：标准化版本） | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `style.text` ×2 | workspaces：workspaces/persona/index.html:98 · 自我 > 人格问卷 > 04 风格规则<br>workspaces：workspaces/persona/app.js:433-457 · 自我 > 人格问卷 > 05 对照与落地 | 对话风格；对话风格（左：初始人格 / 右：标准化版本） | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `timeout_seconds` ×2 | models：models-page.js:372 + 模型与连接 > 功能模型 > 精确配置（任务卡）<br>models：semantic-page.js:46 + 学习与成长 > 语义目录 | 请求超时；模型超时 / 秒 | 系统 › 模型与连接 | 保留唯一编辑位置；其它位置只读或跳转 |
| `unavailable_reason` ×2 | workspaces：workspaces/relationships/app.js:146｜人物与群聊关系 > 关系与情感 > 关系记录 > 记录详情<br>workspaces：workspaces/relationships/group-memory.js:77,93｜人物与群聊关系 > 关系与情感（群目标） > 群公共记忆 > 共享陈述 > 列表/详情 | 来源状态：不可用；来源当前不可用 | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `upgrade.plan_token` ×2 | setup：；开始使用 > 已识别旧版配置卡<br>setup：； | 确认并接续旧版配置；接续配置并继续（启动弹窗） | 按 key 对应的唯一编辑器 | 保留唯一编辑位置；其它位置只读或跳转 |
| `user_birthday` ×2 | workspaces：self-relationship.js:51,58,181｜自我 > 相处资料<br>workspaces：workspaces/identity/member-editor.js:581,1321｜人物与群聊关系 > 关系网 > 成员详情 > 关系设定 | 生日；生日或纪念日 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `user_gender` ×2 | workspaces：self-relationship.js:50,58,181｜自我 > 相处资料<br>workspaces：workspaces/identity/member-editor.js:581,1321｜人物与群聊关系 > 关系网 > 成员详情 > 关系设定 | 性别 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `user_occupation` ×2 | workspaces：self-relationship.js:52,58,181｜自我 > 相处资料<br>workspaces：workspaces/identity/member-editor.js:581,1321｜人物与群聊关系 > 关系网 > 成员详情 > 关系设定 | 职业 | 联系人与群 › 当前对象资料 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_en_provider_id` ×2 | models：models-page.js:901-903 + 模型与连接 > 语音模型 > 语种绑定<br>models：reply-page.js:361-362 + 表达 > 语音朗读 > 语音与朗读 | 英语 语音服务；英语 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_group_en_provider_id` ×2 | models：models-page.js:904-907 + 模型与连接 > 语音模型 > 渠道覆盖<br>models：reply-page.js:365-367 + 表达 > 语音朗读 > 私聊 / 群聊语音覆盖 | 群聊 · 英语 覆盖；群聊 · 英语 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_group_ja_provider_id` ×2 | models：models-page.js:904-907 + 模型与连接 > 语音模型 > 渠道覆盖<br>models：reply-page.js:365-367 + 表达 > 语音朗读 > 私聊 / 群聊语音覆盖 | 群聊 · 日语 覆盖；群聊 · 日语 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_group_zh_provider_id` ×2 | models：models-page.js:904-907 + 模型与连接 > 语音模型 > 渠道覆盖<br>models：reply-page.js:365-367 + 表达 > 语音朗读 > 私聊 / 群聊语音覆盖 | 群聊 · 中文 覆盖；群聊 · 中文 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_private_en_provider_id` ×2 | models：models-page.js:904-907 + 模型与连接 > 语音模型 > 渠道覆盖<br>models：reply-page.js:365-367 + 表达 > 语音朗读 > 私聊 / 群聊语音覆盖 | 私聊 · 英语 覆盖；私聊 · 英语 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_private_ja_provider_id` ×2 | models：models-page.js:904-907 + 模型与连接 > 语音模型 > 渠道覆盖<br>models：reply-page.js:365-367 + 表达 > 语音朗读 > 私聊 / 群聊语音覆盖 | 私聊 · 日语 覆盖；私聊 · 日语 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_private_zh_provider_id` ×2 | models：models-page.js:904-907 + 模型与连接 > 语音模型 > 渠道覆盖<br>models：reply-page.js:365-367 + 表达 > 语音朗读 > 私聊 / 群聊语音覆盖 | 私聊 · 中文 覆盖；私聊 · 中文 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `voice_zh_provider_id` ×2 | models：models-page.js:901-903 + 模型与连接 > 语音模型 > 语种绑定<br>models：reply-page.js:361-362 + 表达 > 语音朗读 > 语音与朗读 | 中文 语音服务；中文 TTS 扩展 | 对话 › 说话 › 语音 | 保留唯一编辑位置；其它位置只读或跳转 |
| `…/host/targets/{target_id}/roles/{role_digest}/model` ×2 | api：<br>api： | 同一路径的读/写条目 | 系统 › 模型与连接 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/model/configure` ×2 | api：<br>api： | 同一路径的读/写条目 | 系统 › 模型与连接 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/configure` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/expression` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/expression/configure` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/preview` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/command` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/export` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/import/apply` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/import/preview` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/learn` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/revise` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/samples` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |
| `…/host/targets/{target_id}/roles/{role_digest}/reply/style/samples/command` ×2 | api：<br>api： | 同一路径的读/写条目 | 对话 › 说话/参与 | 合并为同一契约数据源；GET/POST 仍按 API 需要保留 |

### 1B. 机器清单中的通用 key 说明

`state`、`items`、`enabled`、`note`、`revision`、`kind`、`refresh` 等是工作区数据/动作的通用字段，不代表跨域共用配置；表中保留它们是为了不漏掉 items 清单，但归属按所在域解释。具体唯一归属为：`conversation.presentation`→对话 › 说话；`knowledge`→角色 › 世界知识；`private_access`/`person`/`relay`→联系人 › 默认规则；`growth_records`/`growth.command`→生活 › 学习与成长；`interpretation`/`review_state`→生活 › 关系理解；`model_task_route.*`/`provider`/`fallback`/`prompt`/`replacement_rules`/`model_tasks`/`status.tasks`/`status.providers`→系统 › 模型与连接；`analysis_provider`→能力 › 表情与语义；`draft.text`/`sections.*`/`style.*`→角色 › 人格整理；外观 key→系统 › 资料与外观。仅展示的 `revision`、`after_id`、`source_count`、`observed_at`、`unavailable_reason`、`refresh` 不产生编辑入口。API 路径的“所有位置”由 key 本身给出；`api.items.json` 没有用户路径字段，因此表中的 `api：` 是同一路径 GET/POST 契约标记。

## 2. 新信息架构

### 2.1 导航原则与统一分层

新 UI 的 Dashboard 入口仍只有「陪伴小屋」；首页是品牌/今天的默认落点，不计入左侧一级导航。因此一级导航为 **6 个**：角色、联系人、对话、生活、能力、系统。所有页面顶部固定一个“当前对象”选择器：私聊对象或群；角色跟随当前对象，只有存在多个角色时才显示第二个选择器。

设置分层统一用同一种模式：**范围栏 + 当前值卡 + 高级覆盖**。范围栏只出现用户能实际选择的范围：`角色默认`、当前私聊对象、当前群；安装级设置显示为 `安装`。成员设置从联系人详情进入，作为当前成员的覆盖范围；不在全站暴露“安装/角色/关系/窗口”四层轨道。每个设置只在一个范围卡里可编辑，其他页面显示当前生效值和一个“去设置”跳转。继承只显示“跟随默认/已单独设置”，token、revision、edit_token、operation_key 不上屏。

保存统一为“编辑 → 保存 → 一个结果状态”；即时动作（删除、归档、审阅、迁移、扩展装配）仍保留确认或回执，但不再复制成另一套表单。所有接口仍按各自 API 契约带 token 与幂等键。

### 2.2 完整页面树

| 一级导航 | 二级页面 | 用途 | 唯一编辑设置组 / key 引用 |
|---|---|---|---|
| **首页（今天，非一级导航）** | 今天 | 只看当前对象的状态、今日安排和最近活动，提供去设置链接 | `role.state.state.values`、`role.state.occurrences`、`life_activities`、`memory_atoms`（只读）；`scene`/`weather`/`roomLayouts` 只写本机展示 |
| **角色** | 角色档案 | 编辑角色稳定身份、外貌、性格、动机、边界、世界与表达学习范围 | `role_profile.*`（唯一）；生成草稿走 `persona/profile-draft`，保存仍回 `config_api` |
|  | 人格整理 | 五步问卷、标准化、试答、风格规则、版本保存；不再把草稿字段伪装成正式档案 | persona GET/`persona/command`/`standardize`/`tryouts`/`style-rules`；`sections.*`、`draft.text`、`style.text`、`style.examples` |
|  | 世界知识 | 管理角色世界知识、导入与来源；群成员线索只从联系人群详情跳入 | `knowledge`；其它页面只读摘要/跳转 |
|  | 角色成长策略 | 配置是否使用成长记录、技能域和日程影响强度 | `role.growth.skills.*`；成长记录动作本体在生活 › 学习与成长 |
| **联系人** | 关系网 | 浏览人/群目录、关系层级、互动网络和搜索 | `acquaintance`、`persons[]`、`groups[]`、`group_networks`（只读目录）；`refresh` 只保留一个页头动作 |
|  | 联系人详情 | 统一承载称呼、关系资料、身份、权限、回复/联系覆盖和往来记录 | `admin_nickname`、`identity_tier`、`default_nickname`、`role_relation`、`user_gender`、`user_birthday`、`user_occupation`、`interaction`、`extra`、`acquaintance/settings`、`acquaintance/authorization`、`open_loops[]` |
|  | 群详情 | 群接入、群成员、群公共档案、安全线索与本群设置跳转 | `group-memory`、`review_state`、`statement`、`group_networks`；群回应跳转对话 › 参与，群目标编辑系统 › 账号与会话 |
|  | 默认权限与跨窗口 | 配置新联系人默认权限和跨窗口递话；成员详情只做当前成员覆盖 | `person`、`private_access`、`relay`（唯一编辑位置为联系人 › 默认规则） |
| **对话** | 说话 | 控制文字风格、分段、清理、语音行为、引用和发送前检查 | `conversation.presentation.*`、`voice_enabled`、`reply_quote_*`、`reply_mention_speaker_enabled`、`component_order`；语音 provider/连接跳系统 › 模型与连接 |
|  | 理解 | 控制图片/视频/文件/网页/合并转发的理解方式 | `web_understanding`、`conversation.context_image_caption`、`conversation.image_narration`、`conversation.video_narration`、`forward_intake`；按后端任务和能力显示 |
|  | 参与 | 控制私聊连续输入、群唤醒、兴趣、冷群、疲劳、续接、空气护栏和内容护栏 | `group_wakeup_*`、`group_conversation_followup_*`、`private_debounce_*`、`group_air_guard_*`、`private_closing_guard_*`、`enable_group_*_guard`、`group_participation` |
|  | 忙碌与休息 | 统一设置忙碌时回复、休息、补看；状态页和主动联系页只读并跳转 | `busy_gate`、`life` 中 rest/backlog/quiet 相关字段 |
|  | 表达学习 | 查看、审阅、修订、导入导出表达样本；不重复编辑角色档案 | `reply/style/*`、`expression.learning`、`growth.command` 中表达相关动作 |
| **生活** | 主动联系 | 唯一编辑主动联系总开关、节奏、免打扰、额度、触发源、目的、提示词和窗口覆盖 | `proactive.contact.*`（含当前 16 个无入口字段）；窗口覆盖从联系人详情进入，状态页只读 |
|  | 日记与作息 | 管理日记、梦境、阅读、睡眠、休息与写作，并保留全部 life command | `life.*`、`life.routine/sleep`、`library`；日记/阅读/睡眠/回执为二级页 |
|  | 状态与日程 | 统一状态维护、日程、周期、心情、天气、每日巡视和首页展示 | `role.state.*`、`role.state.planning_*`、`role.state.daily_state_patrol_*`；天气源凭据跳能力 › 感知 |
|  | 记忆 | 私聊事实、整理、检索、归档、导入导出、清理和记忆策略；群目标切换为群公共记忆 | `memory.*`、`memory_atoms`、`growth_records`；群侧 `group-memory` |
|  | 学习与成长 | 成长记录列表、依据、状态动作、修订、提出建议、复盘 | `growth_records`、`growth.command`、`growth.command#revise`、`role.growth.read_enabled`、`role.growth.propose_enabled` |
|  | 关系理解 | 私聊关系理解记录的审阅/采用/更正/撤回；群目标显示共享陈述和安全审阅 | `interpretation`、`review_state`、`state`、`after_id`、`source_count` |
| **能力** | 能力总览 | 按 manifest 展示已装配、暂停、未装配的能力；未启用能力只显示一行状态和装配入口 | `integration/manifest`、`integration/lifecycle`、`content`、`image`、`together`、`game`、`screen`、`reality`、`live` |
|  | 感知 | 管理时间/环境、外部资讯、屏幕观察、现实触及、余额和主动联系素材条件 | `perception`、`perception-native`、`host-options/weather`、`host-options/balance`、`screen`、`reality-access`；`proactive.contact` 只读摘要跳主动联系 |
|  | 表情与语义 | 管理表情开关、语义目录、黑话、视觉复核、检索边界、导入/分析/编辑/删除/重建 | `semantic` 全部 settings、`reaction`、`reactions_proactive_enabled`、`vision_review`、`vision_verify_mode` |
|  | 生图与素材 | 管理生图动作/端点/队列/工作流、参考图、相册、衣柜和每日穿搭 | `image.*`、`image.output.*`、`photo.reference.*`、`wardrobe.*`、image-materials 全部 action |
|  | 平台扩展 | 按平台/扩展显示 QQ 空间、戳一戳、一起看、游戏、直播、屏幕、现实设备和手机连接 | `qzone`、`poke*`、`together`、`game-access`、`live`、`screen-access`、`reality-access`；功能关闭时只收起详细设置 |
| **系统** | 开始使用 | 未绑定/未配模型/已完成三态；只保留绑定、通用模型、完成后的跳转和主动测试 | `binding`、`model.provider_id`、`model_task_route.{kind}`、`proactive_test`；移除快速配置的重复编辑器 |
|  | 账号与会话 | 管理平台账号、角色映射、窗口链接、群目标、投递授权和宿主启停 | `accounts`、`accounts.role`、`host.start`、`host/status`、`group_targets`、`window_links`、`authorize-*`/`revoke-*` |
|  | 模型与连接 | 管理任务路由、搜索、语音连接/TTS、provider、替换策略、后台预算和 Laya | `model.modelStatus.tasks`、`provider`、`fallback`、`prompt`、`replacement_rules`、`voice_*`、`status.tasks`、`status.providers`、`budget`、`laya`、`deepseek_provider_id` |
|  | 资料与外观 | 管理存储、备份、恢复、旧版迁移、主题、密度、圆角、字号、动效和大字 | `storage`、`backup`、`legacy.*`、`upgrade.plan_token`、`companion-v2-*`、`largeText` |
|  | 高级与诊断 | 汇总运行诊断、Token、缓存、最近调用、提示词审计、模型/存储/主动测试；不进入日常页面 | `model.maintenance.*`、`model.maintenance.recent`、`model.modelStatus.tasks`（只读）、`reply.recalls`、`/host/preview`、`/host/batches`、storage test、proactive-diagnostic |

### 2.3 重复入口的统一处理

- 开始使用只负责“能不能开始”：绑定、通用模型、完成与测试；档案、关系、主动、日程、群聊设置均跳转到上述唯一页面，不再嵌入 `ADVANCED_BLOCKS`。
- 感知只读显示主动联系条件；主动联系是 `proactive.contact` 唯一编辑位置。状态页只显示窗口生效值并提供跳转。
- 模型与连接是模型路由和语音连接唯一编辑位置；表达页只编辑语音行为，成员详情只编辑成员级覆盖。
- 关系网、用户、群聊合为联系人一级下的三个二级视图；工作区内部不再复制一套外壳 tab。
- 主页、家具、状态卡、Token 统计、模型态势图都变成只读摘要或深链，不再拥有第二个编辑器。
- `page/targets` 先决定当前 target/role 的 API；`host/status` 补投递授权、状态和 failure_code；新 UI 不再读取死的 staging 路由。

## 3. 能力驱动显示规则表

规则顺序固定为：先判断宿主性能/初始化，再按当前对象与平台，再按扩展装配，再按后端能力/开关，最后按数据是否存在。关闭能力时保留总开关或入口，详细设置收起；没有开关的必需能力不人为增加开关。

| 功能 / 设置组 | 显示条件 | 判断依据（接口 + 字段） | 缺口 / 处理 |
|---|---|---|---|
| 完整 UI / 性能旁路 | `host/performance` 未开启；开启时只显示轻量状态页 | `GET /host/performance`；或 `setup/status.host` | 现有字段足够；不要在插件页提供反向开关 |
| 当前对象的私聊设置 | 当前 target 为私聊且对应 role 有 `config_api`/`memory_api`/`state_api` 等 | `GET /page/targets` 的 `scope_kind`、角色 API 字段 | 现有字段足够 |
| 群聊设置 | 当前 target `scope_kind=group`；只显示群角色实际拥有的 API | `page/targets.target.scope_kind`、`group_memory_api`、`reply_api`、`model_api` | 现有字段足够；群没有私聊域时不渲染空壳 |
| 群成员设置 | 成员有可配置私聊窗口时可编辑；否则保留 history/只读目录 | `GET /acquaintance` 的 `private_target`、`settings_available`、`configured` | admin-name/identity 不应被 `private_target` 门禁误伤；前端可先移出门禁 |
| 角色/成员/窗口覆盖 | 当前范围为角色默认、当前对象或当前成员时显示对应覆盖卡 | `config` 返回的 `scope`、`editable_layers`、`provenance`；成员 `/acquaintance/settings` | 不显示四层轨道，只显示“跟随默认/已单独设置” |
| 主动联系详细设置 | `proactive.contact.enabled` 或用户打开主动联系页；窗口覆盖仅在当前对象可用时显示 | `GET /config?sections=proactive.contact` 的 `enabled`、`automatic_enabled`；成员 settings | 现成字段足够；感知/状态只读并跳转 |
| 主动联系触发源：天气/资讯/网络/余额/屏幕 | 主动联系总开关开启；分别叠加来源可用 | `proactive.contact` 各 `*_enabled`；`host-options/weather`、`host-options/balance`、`perception-native`、screen 状态 | 搜索是否被其他能力使用需汇总探测；见后端改动 |
| 忙碌与休息详细设置 | `busy_gate` 或 life 中相应能力存在；字段关闭时收起其细项 | `GET /config` 的 `busy_gate`、`life`；各 `enabled`/quiet/rest 字段 | 现有字段足够；唯一编辑位置为对话 › 忙碌与休息 |
| 文字表达/分段 | `reply_api` 存在（私聊和群均有） | `page/targets.roles[].reply_api`、`GET reply` | 必需能力，不给“回复”开关 |
| 群唤醒/群参与/本群插话 | 当前对象是群；群 reply API 返回 participation | `scope_kind=group`、`GET <role>/reply/participation` | 现有字段足够；私聊不显示群专属细项 |
| 图片理解 | `model` 的 tasks 含对应 kind，或视觉模型能力可用 | `GET <role>/model` 的 `tasks[].kind`；`/image`/视觉 provider | 任务存在即显示配置；调用能力不足显示不可用状态 |
| 视频/文件/网页理解 | 相应任务或 status 能力存在 | `model.tasks` 的 `conversation.video_narration`；`reply.status.documents`、`status.web` | 字段现成；不存在的任务不显示 |
| 语音行为 | TTS provider 非空且 `voice_enabled` 为真时展开细项；总开关始终可见 | `GET reply` 的 `status.tts.providers`、`voice_enabled`；`GET model/voice` | provider 连接管理只在系统 › 模型与连接编辑 |
| 语音语言/私聊群聊绑定 | 用户进入语音连接页，或已有绑定；群覆盖只在群目标 | `GET model/voice` 的 `languages[]`、`channels[]`；`scope_kind` | 现成字段足够；表达/成员页只读跳转 |
| 引用、@、平台消息组件 | 平台/目标具备对应输出端口 | `page/targets.platform_id`、reply status、组件可用性 | 精确能力（Face、poke、原生 @）目前没有统一探测，列入后端新增 `host/capabilities` |
| QQ 空间 | 当前平台可用且 content 扩展已装配/启用；群/私聊再按 API 能力过滤 | `target.platform_id`；`integration/manifest.extensions[]` 的 `capability_id=content`、`assembled`、`desired_state`；qzone status | 不硬编码只认 aiocqhttp；平台能力声明缺失时由 `host/capabilities` 提供 |
| 戳一戳 / QQ 短状态 / 正在输入 / 在线状态 | 对应平台端口存在 | `state.presentation_diagnostics.*.reason`；`host-options/poke`；`state.settings.typing/presence` | presence/poke 统一探测需后端补聚合字段；当前先按 diagnostics 收起 |
| 一起看/通话房间 | together 扩展已装配且未 discarded | `integration/manifest.extensions[]`：`capability_id=together`、`assembled`、`desired_state` | 未装配仍在能力总览显示“未装配”，不显示详细表单 |
| 游戏/棋桌 | game 扩展已装配且可调用 | manifest `capability_id=game`；`GET game-access` 的可用状态 | 现有字段足够 |
| 屏幕观察 | screen 扩展已装配，且当前 role/target 有授权 | manifest screen；`GET screen-access`、`perception-native` 的 action 状态 | 观测授权的聚合字段缺失，需 `host/capabilities.screen` |
| 现实触及：手机/定位/摄像头/音响/米家 | reality 扩展已装配，单项 action `invokable` | manifest reality；`GET reality-access` 的各 capability status/invokable；extensions | 现有接口分散但可读；建议由 capabilities 聚合后再渲染 |
| 直播与表演 | live 扩展已装配且非 discarded | manifest `capability_id=live` | 现有字段足够；旧 live dead routes 不作为显示依据 |
| 生图能力 | image 扩展已装配，且图像模型动作存在 | manifest image；`GET model/image.actions[].state/registered/loaded`；`image/output.enabled`、operation_routes | `image.output.enabled` 与三动作开关分开显示，不能合成一个错误总闸 |
| 生图端点/工作流 | output 已启用且对应 operation route 有端点；legacy 参数非空才展开 | `GET model/image/output` 的 `enabled`、`operation_routes`、`endpoints[]`、`legacy_backend/options` | 现有字段足够 |
| 参考图/衣柜/每日穿搭 | image-materials 可用；每日穿搭需参考图、衣柜、daily 三项同时开 | `GET image-materials` 的 settings；`photo.reference.*`、`wardrobe.*`；album/items | 现有字段足够 |
| 表情包表达 | semantic settings 可读且 `enabled && reactions_enabled`；私聊/群聊分别按 scope | `GET /semantic` 的 `settings.enabled`、`reactions_enabled`、`reactions_private_enabled`、`reactions_group_enabled`、`selection_ready` | 现有字段足够；素材为 0 时只显示导入 |
| QQ 表情格式 | 当前平台明确支持 Face | `target.platform_id` 只能作旧兼容判断；适配器发送能力 | 必须新增 `host/capabilities.message_components.face`，微信 helper 当前会拒绝 Face |
| 群黑话/语义学习 | 当前对象为群且 selection ready；联网参考还需搜索开关 | `scope_kind=group`；semantic `selection_ready`、`slang_enabled`、`slang_web_search_enabled` | 现有字段足够 |
| 语义 provider/视觉分析/索引高级项 | semantic settings 可读；详细项按总开关/索引状态折叠 | `GET semantic.settings` 的 providers、state、timeout、batch 等 | 现有字段足够 |
| 角色状态维护 | `state_api` 存在；详细维护项仅在 `state.settings.enabled` 为真 | `GET state.settings.enabled`、`maintenance_minutes` | 现有字段足够；`enabled` 是必需总开关，不能隐藏 |
| 生理期/心情/每日巡视 | 各自总开关开启才显示详细项 | `state.settings.cycle_enabled`、`mood_enabled`、`daily_state_patrol_enabled` | 现有字段足够 |
| 日程自动规划 | `calendar_enabled` 为真；规划字段仅在 `planning_enabled` 且模式支持时显示 | `state.settings.calendar_enabled`、`planning_enabled`、`schedule_simulation_mode` | 现有字段足够 |
| 角色天气 | weather 总开关开启；地点/时效随之显示 | `state.settings.planning_weather_enabled`、`planning_weather_location` | 现有字段足够；天气源凭据在能力 › 感知 |
| QQ 状态展示 | presence 端口可用 | `state.presentation_diagnostics` | 无端口时保留只读状态，不显示编辑控件 |
| 记忆策略 | 私聊 target 有 memory_api；记忆总能力是核心能力，不给用户关闭入口 | `page/targets` 的 memory_api；`GET memory/settings` 的 `values` | `memory.enabled` 可读但按产品原则不做可见开关；关闭由系统状态处理 |
| 私聊记忆事实/整理/归档 | 当前对象为私聊且相应数据/批次存在 | `scope_kind=private`、memory API；reflections items、archive/clear preview counts | 空数据只显示空态，不显示空表单 |
| 群公共记忆/成员安全线索 | 当前对象为群且 group-memory API 存在；成员线索在群详情 | `scope_kind=group`、`group_memory_api`、`safety` | 现有字段足够 |
| 成长记录 | growth_api 存在；读取/建议开关开启后显示记录和动作 | `role.growth.read_enabled`、`propose_enabled`、growth `actions[]` | “提出建议”当前无入口，新 UI 必须补 |
| 日记/阅读/睡眠 | life_api 存在；各 `life.config.enabled/diary_enabled/sleep_enabled` 控制细项 | `GET life` 的 config 与 receipts/history | 现有字段足够 |
| 旧版迁移 | `upgrade.present && !configured` 或发现 `legacy` 的 v1_present | `setup/status.upgrade`、`GET <role>/legacy`/legacy group data | 现有字段足够；迁移入口不常驻 |
| 迁移资料子项 | 对应 data-plan 有非空来源/计数 | `legacy data-plan` 的 `persona_sources`、groups、memory record_count、各 import count | 现有字段足够 |
| 安装/账号/角色/窗口管理 | 页面已初始化；按 accounts/discovered/personas/groups/window_links 有数据显示子块 | `GET accounts`、`host/status`、`page/targets` | 新增群发现目前不完整，见后端改动 |
| 模型任务卡 | `model.tasks[].kind` 存在即显示；`conversation.reply` 只允许附加提示 | `GET <role>/model.tasks[]`、fields | 现有字段足够，不能使用前端手写任务清单 |
| 搜索服务 | 至少一个消费者开启 | `deepseek_provider_id` + `news_*`/`web_exploration_*` + semantic `slang_web_search_enabled` | 需一个 `search_consumers` 聚合字段，或前端拼读多个配置 |
| Laya 决策 | `laya.enabled`、已安装、远程 endpoint 任一成立 | `GET model/laya` 的 `enabled/package_installed/mode/endpoint` | 现有字段足够 |
| 预算与维护诊断 | 预算开启或用户主动进入高级；诊断数据/外部 token source 非空时显示对应卡 | `budget.enable_daily_token_soft_limit`、`model/maintenance.external_token_sources`、recent/cache/runtime | 现有字段足够 |
| 备份/存储 | 系统页始终有资料入口；恢复/迁移按钮按 pending/legacy 数据出现 | `GET backup`、`backup/pending`、storage status、setup legacy status | 现有字段足够 |
| 外观 | 始终可用，本机 localStorage 设置不受对象切换影响 | `companion-v2-*`、`largeText` | 现有字段足够 |

“需后端新增探测”集中为：平台消息组件能力（Face、poke、@、presence）、屏幕/现实授权聚合、搜索消费者汇总、语音/能力是否曾显式配置的汇总。没有这些字段时，新 UI 只能把对应高级块保守地显示为可读状态，不能误判为不存在。

## 4. 功能覆盖对照

以下按七份审计的“功能完整性清单”合并同义项；同一后端能力只保留一行映射。**保留**表示新 UI 必须可读/可操作；**现无入口**表示审计已确认当前没有可达编辑入口，新 UI 必须补，不是删除建议。

| 合并后的功能 | 来源审计 | 新 IA 唯一页面 / key 或 API | 当前状态与新 UI 动作 |
|---|---|---|---|
| 唯一 Dashboard 页面、性能旁路、启动前主题、导航/浮层、旧 hash 改写 | shell | 首页 + 系统 › 资料与外观；`host/performance`、localStorage、导航映射 | 保留；首页是唯一 Dashboard，性能模式继续整页旁路；所有旧地址继续改写到新页面 |
| 全局对象/角色切换、搜索、未保存离开拦截 | shell / memory / models | 全站范围栏；`page/targets`、各编辑器 dirty/saveBeforeLeave | 保留；选择器只留一个全局实例，搜索命中跳唯一编辑位置 |
| 小屋场景、天气/时段/光照、布置、7 机位、家具目录、生活观察 | shell | 首页；`scene`、`weather`、`roomLayouts`、`integration/manifest` | 保留；场景只在首页加载，配置页不再带 3D；展示数据只读跳转 |
| 状态 13 功能块、今日安排、状态摘要、每日巡视 | shell / memory | 生活 › 状态与日程；`role.state.*`、`role.state.occurrences`、`daily_state_patrol_*` | 保留；首页/维护页只读摘要，巡视唯一编辑位置为状态与日程 |
| 日记与梦境、阅读书架、睡眠记录、执行/回执记录及 life 14 actions | shell / workspaces / api | 生活 › 日记与作息；`life` GET/`life/command`、`library` | 保留；按 `life.config` 显示/收起，群目标不挂私聊 life |
| 绑定核心窗口、候选核对、初始 provider、任务模型路由 | setup / workspaces / api | 系统 › 开始使用；`binding`、`model.provider_id`、`model_task_route.*`、`setup/status` | 保留；向导收成绑定→模型→完成三态，所有任务路由仍可达，高级路由折叠 |
| 开始使用进度、完成页、主动测试回执、宿主重连 | setup | 系统 › 开始使用；`setup/complete`、`proactive_test`、`setup/host/start` | 保留；主动测试是完成页动作，不再成为第八个重复页面 |
| 旧版升级检测、一键接续、配置差异/范围/逐项迁移 | setup / api | 系统 › 资料与外观 › 旧版迁移；`upgrade.*`、`legacy/*` | 保留；有 `upgrade.present` 或 V1 发现时才出现，旧版配置/资料/角色映射全部支持 |
| 旧版资料导入：表情、世界书、联系人权限、日记、表达、参考图、衣柜、记忆库、归档 | setup | 系统 › 旧版迁移；`legacy/data-plan`、`data-apply`、group-data、private-memory | 保留；按 data-plan 的非空来源显示，逐项确认收敛为按页确认，不删导入种类 |
| 关系网、人目录、群目录、搜索/筛选/雷达/群活动/成员线索 | workspaces / shell | 联系人 › 关系网；`acquaintance`、`persons[]`、`groups[]`、`group_networks` | 保留；三个旧 tab 合成一个二级页面的三视图，只有一个目录数据源 |
| 成员称呼、关系资料、身份级别、默认资料、权限、回复覆盖、联系覆盖 | workspaces / shell / models | 联系人 › 联系人详情；`admin_nickname`、`identity_tier`、`acquaintance/settings`、`authorization`、`person`、`private_access` | 保留；成员覆盖只在详情编辑，角色默认资料不再在成员页重复编辑 |
| 跨窗口递话 | shell / workspaces / api | 联系人 › 默认规则；`relay` / `config/configure` | **现无可达入口**：只在死的 `renderIdentityPageOriginal`；新 UI 必须补唯一编辑器 |
| 群接入、群目标、群成员网络、群公共档案、安全线索、群公共记忆 | workspaces / memory / api | 联系人 › 群详情；`accounts`/`group_targets`、`group-memory`、`group_networks` | 保留；群公共记忆按群目标切换，群档案跳转不再错指核心用户关系页 |
| 账号、人格/角色映射、窗口链接/解绑、会话、群目标、投递授权 | workspaces / api | 系统 › 账号与会话；`accounts`、`accounts/role`、`accounts/window-link/unlink`、`accounts/session`、`authorize-*` | 保留；前端只显示一套拓扑/编辑器，账号列表按平台能力驱动 |
| 回复分段、流式、规则/模型边界、阈值、间隔、样式、文字清理/替换 | reply / api | 对话 › 说话；`conversation.presentation.*`、`reply/configure`、`reply/preview` | 保留 69 项；常用项首屏，规则/正则/提示词进高级，预览保留但不伪装成真实配置 |
| 语音行为、三语种绑定、私聊/群聊覆盖、超时、试听、TTS 连接管理 | reply / models / workspaces | 对话 › 说话（行为）；系统 › 模型与连接（连接）；`voice_*`、`model/voice`、`tts/providers/*` | 保留；绑定/超时只在系统唯一编辑，表达页和成员页只读/跳转；无 provider 时收起细项 |
| 引用、@ 发言者、组件顺序、图片位置、平台动作、发送前检查 | reply | 对话 › 说话；`reply_quote_*`、`reply_mention_speaker_enabled`、`component_order`、host options | 保留；按平台能力显示 Face/poke/引用，诊断条数收进高级 |
| 群回应总闸、直呼/兴趣/图片、冷群、疲劳、连续对话、私聊防抖 | reply | 对话 › 参与；`group_wakeup_*`、`group_conversation_followup_*`、`private_debounce_*` | 保留 44 项；私聊不显示群组，群目标显示本群窗口覆盖 |
| 空气护栏、收尾/撤回沉默、内容/隐私/现实承诺护栏 | reply | 对话 › 参与 / 忙碌与休息；`group_air_guard_*`、`private_closing_guard_*`、`enable_group_*_guard`、`busy_gate` | 保留；默认只露一个总卡，细则与诊断折叠 |
| 群聊氛围、去噪、复读、名场面、群插话窗口设置 | reply / setup | 对话 › 参与；`group_participation`、`reply/participation/configure` | 保留；setup 只跳转，群目标才出现 window 层插话 |
| 主动联系总开关、后台自动、节奏、额度、免打扰、暂停、去重、目的矩阵 | reply / shell | 生活 › 主动联系；`proactive.contact.*` | 保留 173 项；主动联系为唯一编辑位置，状态页和感知页降为只读摘要 |
| 主动天气/预警、资讯、网络探索、饭点/纪念日、余额、屏幕/动作、约定、上下文 | reply / shell | 生活 › 主动联系；`proactive.contact.*`、`host-options/*`、`perception-native` | 保留；每个来源按能力收起，`important_dates` 现无控件，新 UI 必须补日期清单 |
| 主动联系当前没有入口的 16 项 | reply | 生活 › 主动联系 › 高级：节奏/复核/问候/表达模板 | **现无入口，必须补**：`unanswered_slowdown_*` 3、`proactive_intensity_body_chars`、`proactive_persona_judge_exempt_purposes`、`contact_followup_*` 2、`greeting_idle_minutes`、`insomnia_night_daily_limit`、`important_dates`、`style_prompt`、`expression_prompt`、`news_sharing_prompt`、`length_prompt`、`news_length_prompt` |
| 感知总览、时空环境、原生日期、模型能力、现实通道、资讯/余额/撤回记录 | reply / shell / api | 能力 › 感知；`perception`、`perception-native`、`host-options/balance`、`model/*` | 保留；统计/同步胶囊/空通道收高级，实际设置跳唯一页面 |
| 图片/视频/文件/网页/合并转发理解 | reply / models | 对话 › 理解；`web_understanding`、model tasks、documents/web status | 保留；任务不存在就不渲染，不能因当前微信没有能力而删除 |
| 任务模型路由、逐任务/批量指派、继承、provider/fallback、输出上限、超时、提示词 | models / setup / memory | 系统 › 模型与连接；`model` GET/`model/configure` | 保留每个 `tasks[].kind`；批量/恢复跟随只保留在路由总览，`conversation.reply` 只改允许字段 |
| 替换/兜底规则、关键词、高价时段、拒答词、测试/批量测试 | models | 系统 › 模型与连接 › 高级路由；`replacement_rules`、`fallback*`、`model/test` | 保留；三个 replacement_rules 编辑器合成一个规则编辑器 |
| 语音模型与 TTS provider 新建/改/克隆/测试 | models | 系统 › 模型与连接 › 语音连接；`model/voice`、`tts/providers/*` | 保留；连接管理默认折叠，不在表达/联系人复制 |
| 生图动作、后端/队列、端点密钥、尺寸/质量/参考图、ComfyUI/SD、代理、legacy | models | 能力 › 生图与素材；`model/image*` | 保留；image 扩展/动作/route 条件显示；测试动作保留并明确属于真实调用 |
| 生图偏好、触发/群开关、审核、配额、参考图/相册/衣柜/每日穿搭 | models / shell / api | 能力 › 生图与素材；`image.output.*`、`image_review`、`quota`、`photo.reference.*`、`wardrobe.*`、image-materials | 保留；“模型连接”和“生图行为”同页不同组，不能互相覆盖 |
| 语义目录、表情开关、群黑话、分析 provider、视觉复核、检索边界、索引 | models | 能力 › 表情与语义；`semantic`、`reaction` | 保留全部 27+9 键；`reactions_proactive_enabled` 当前无入口，新 UI 必须补 |
| 表情素材导入、搜索、编辑、分析、删除、重建，收录概览 | models / api | 能力 › 表情与语义；`semantic` action 全部 7 类 | 保留；素材/检索仍使用全局 semantic 存储，不按当前角色伪装成独立副本 |
| 事实记忆：列表、详情、来源、版本、置顶/撤回/遗忘/更正 | memory / api | 生活 › 记忆；`memory/*` | 保留；技术字段默认折叠，事实详情是唯一编辑位置 |
| 记忆检索、归档/移回、导出/导入、范围清理、整理重试/排队 | memory / api | 生活 › 记忆 › 高级；`memory/query`、archive、import、clear、reflections | 保留；按数据 preview 有效项显示，动作仍可逆/需确认 |
| 记忆策略 30 项、私聊/群经历、习惯学习 | memory | 生活 › 记忆 › 策略；`memory.*` | 保留；总开关与从属组按条件收起，不能在搜索结果再开编辑器 |
| 成长记录列表、依据、确认/继续/暂停/完成/归档/撤回、修订 | memory | 生活 › 学习与成长；`growth.*`、`growth.command` | 保留；总览/成长花架/轨道只读或跳转同一详情动作 |
| 提出成长建议 | memory | 生活 › 学习与成长 | **当前无 UI 入口**：后端有 `growth.command#propose`；新 UI 必须按权限开关显示按钮 |
| 状态维护、能量/健康/饥饿/睡眠/周期/心情/忙碌/位置、首页展示策略 | memory | 生活 › 状态与日程；`role.state.*`、`state/command` | 保留；总开关关闭时收起细节，不删除状态能力 |
| 日程创建/修改本次/整组/取消/提醒/周期校准/状态写入 | memory / api | 生活 › 状态与日程；`calendar.*`、`cycle.align`、`state.write` | 保留；`role.state.calendar.accept` 和 `role.state.write` 当前无入口，新 UI 必须补 |
| 关系理解私聊记录：审阅、采用到对话、更正、撤回、分页 | workspaces / api | 生活 › 关系理解；`relationships`、`interpretation`、`state`、`after_id` | 保留；动作由 API actions 驱动，不能写死成三套按钮 |
| 群共享陈述、安全命中审阅/忽略/撤回、操作回执 | workspaces / api | 联系人 › 群详情或生活 › 关系理解（群视图）；`group-memory/*`、`review_state` | 保留；按群目标显示，分页游标保留 |
| 人格问卷：来源、标准化、基础稿、情景试答、风格规则、对照保存、版本 | workspaces / api | 角色 › 人格整理；persona 全部 8 条路由 | 保留；当前 iframe 白名单拒绝 `tryouts`/`style-rules`，新 UI 必须直连现有 API 或放行，不把功能当成可删 |
| 角色档案/关系资料草稿生成、字段选择保存、迁移已有设定 | setup / workspaces | 角色 › 角色档案；`role_profile.*`、`relationship_profile.*`、profile-draft/migration | 保留；统一全局草稿弹窗，向导/快速配置/旧弹窗改跳转 |
| 扩展装配/暂停/恢复/更新/卸载与扩展配置 | shell / api | 能力 › 能力总览/平台扩展；`integration/lifecycle`、`extensions/*` | 保留；状态由 manifest 驱动，扩展关闭时设置收起但数据不删 |
| QQ 空间、一起看、游戏、直播、屏幕、现实触及、手机网关 | shell / api | 能力 › 平台扩展；qzone、together、game、live、screen、reality 路由 | 保留；当前微信默认收起，接入 QQ/装配扩展后自动出现 |
| 备份、恢复预览/确认、存储、迁移归档 | shell / api | 系统 › 资料与外观；`backup/*`、`storage`、legacy archive | 保留；恢复仍需 hash/确认，常规页不展示内部 token |
| Token、缓存、最近调用、回复效率、模型/存储/主动/Provider 诊断 | memory / models / api | 系统 › 高级与诊断；maintenance/memory/balance/storage test/recalls | 保留；所有诊断聚合，默认不进日常信息架构 |
| 宿主启停、探测、初始化、性能、投递授权/撤回、单条群目标、会话动作 | workspaces / api | 系统 › 账号与会话 › 高级 | **部分现无入口**：host stop、probe、initialize、四类 authorize/revoke、accounts/session、单条 `accounts/group-target`、performance 仅有旁路，均需在新 UI 的高级中补齐；不删除后端路由 |

### API 路由覆盖校验

新 UI 以 `page/targets` 返回的角色 API 为入口，不复制路由。安装级 `page/integration/acquaintance/semantic/setup/accounts/extensions/backup/host-options/storage/config/behavior` 分别落到首页、能力、联系人、系统、对话和高级；私聊角色的 `memory/state/reply/model/perception/life/relationships/growth/persona/image-materials/qzone/reality/screen/game/legacy` 已在上表有唯一页面；群角色的 `group-memory/reply/model/legacy-group-data` 由联系人群详情、对话参与、系统模型和迁移页承接。旧 `staging/*`、live page_api、米家 mihome、reality mobile 等死路由不作为新 UI 数据源，但对应功能按现存有效 API/扩展状态保留。

## 5. 需要的后端小改动

最多只列新 UI 无法可靠绕过的边界；不为页面重构重写现有配置 API。

| # | 小改动 | 为什么前端绕不过去 |
|---|---|---|
| 1 | **新增 `GET /host/capabilities`**，按 target/role 返回 `message_components`（face、poke、quote、mention）、`presence`、screen/reality 授权聚合、搜索消费者、语音/语义/模型显式配置摘要 | 现在平台能力被 `platform_id`、多个扩展状态、多个诊断接口和适配器实际发送结果分散表达；前端仅凭平台名会误把微信 Face、QQ 专属端口当成可用，或把已授权的屏幕/现实能力收起。一个能力探测是能力驱动 UI 的可靠条件 |
| 2 | **`GET /page/overview`（或在现有 page/targets 响应增加 overview）**，合成当前安装、当前对象/角色、host 状态、今日状态/安排和性能标记 | 首页现在必须并发拼 `setup/status`、`page/targets`、`host/status`、state/life API，且这些数据的失败/权限语义不同；前端可以拼但无法得到一致的“当前对象可用性”和首屏快照。该项是首屏稳定性优化，非功能新增 |
| 3 | **给 `page/targets` 的群目标补可靠 `display_name`**，来自原生群目录，不能只返回 `group_id`/`xxx@chatroom` | 前端没有微信群名查询能力，无法从现有接口推导友好名称；顶栏、群选择器、群目标列表必须显示稳定名称。QQ 显示名也应继续由后端按平台能力提供 |
| 4 | **账号目录同时返回“原生已发现但尚未受管”的群**，并标记 `managed`/`available_for_target`；保存群目标仍走现有 `POST /accounts` 或正规 group-target | 当前 `GET accounts`/discovered 主要列已组装目标，首次出现的群在 UI 勾选列表不可见；前端无法发现未受管对象。仅新增返回字段，不改变现有保存契约 |
| 5 | **工作区桥的有效路由白名单补齐** `persona/tryouts`、`persona/style-rules`、`accounts/window-link`、`accounts/window-unlink`（或提供同等受控的页面代理） | 这些后端路由已经存在，当前功能失败不是页面逻辑问题，而是 iframe bridge 在到达后端前拒绝；新 UI 若继续复用工作区生成物，前端单改布局无法让请求通过。若新页面不再 iframe 化，则此项可不做 |

## 6. 开放问题

1. **首页是否保持“默认落点但不计入一级导航”？** 本文按 6 个一级导航处理；若产品希望首页也固定占一个导航位，需要从“能力”或“系统”中合并一个入口。
2. **范围栏默认是否只允许“角色默认 / 当前对象 / 当前成员”？** 本文隐藏安装、关系、窗口等实现层；需要确认成员覆盖是否必须从联系人详情进入，而不是在全站范围栏直接切换。
3. **语音连接是否统一归系统 › 模型与连接？** 本文把 provider/语种/渠道/超时放系统，把语音行为放对话；若希望用户在对话页一次改完，两者仍必须保持不同存储的单一写入口。
4. **开始使用是否确认收缩为“绑定 → 模型 → 完成/测试”三态？** 本文移除向导内档案、主动、日程、群聊的重复编辑，但保留所有设置页和后端进度字段。
5. **`important_dates` 是否作为正式日期清单恢复入口？** 当前后端仍接受但页面没有控件；需要选择补日期编辑器，或明确该字段只读/迁移兼容并保留数据。
6. **高级诊断中的宿主动作是否都对普通管理员可见？** 本文保留 stop、probe、initialize、投递授权/撤回、session、单条 group-target 等入口，但默认收起；需要确认是否按管理员身份进一步隐藏。
7. **平台能力探测接口上线前，未知平台采用什么策略？** 本文建议保守显示只读状态并允许进入高级配置，只有明确 `invokable=true` 才显示可调用控件；需要确认是否接受这一兼容策略。
8. **迁移的确认粒度是否从多复选框改为每页一次确认？** 本文不减少导入类型，只把成员/人格/群/记忆映射确认合并为“我已核对本页映射”；若需要逐项审计，需保留逐项展开但不再复制设置编辑器。
