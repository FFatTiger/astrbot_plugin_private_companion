# 任务 07：新 UI 收尾 B——按审阅清单打磨呈现

仓库 /home/claude/Documents/program/astrbot_plugin_private_companion，目录 pages/陪伴控制台/。先读 docs/ui-redesign/REVIEW-NOTES.md（审阅意见，逐条处理）、CONTRACT.md，再读相关页面代码。

## 硬性规则
- 只改 pages/陪伴控制台/ 下文件。不改 Python、不改旧页面、不 git commit、不访问服务器、不开子代理、不要以"我先做X"结束回合；回复简短，一口气做完。
- 只改呈现，不删功能、不改接口契约。

## 做
1. REVIEW-NOTES.md 中界面相关条目全部落实（Python/测试/合并相关条目跳过）。
2. 全局扫一遍：任何原始 key、英文枚举、true/false、null、内部术语（安装级、窗口、scope、token、revision、宿主等）上屏的地方，换成中文人话或不显示；布尔值一律开关。可做一张集中枚举→中文映射表放 ui.js。
3. 卡片右上灰色元说明全部删除，只留计数。
4. 每页只有一个保存栏；即时动作（审阅/撤回/删除…）保留各自按钮+确认框。
5. 仍在页面里各自实现的确认框（contact-details、group-details、ability-shared、life-shared、role-profile）改用 ui.js 的公共确认框。
6. 系统›模型与连接：改成紧凑表格（任务｜主模型｜备用模型｜状态），点行展开编辑附加提示词等；分组（对话/记忆/生活/生图…）可折叠。
7. 首页：状态卡值大标签小；家具按钮收进「家具与能力目录」折叠；枚举中文化。

## 验收
- node --check 全部通过；dev/mock-*.html 逐页渲染（/usr/bin/google-chrome --headless=new 或 playwright），控制台 0 错误。
- 用 playwright 在全部 mock 页面上搜索可见文本中的 ASCII 单词（[A-Za-z_]{3,}，排除 QQ、AI、wxid 显示、模型名、用户输入值），列出残留并清零或说明为何保留。
- 交付总结 ≤10 行。
