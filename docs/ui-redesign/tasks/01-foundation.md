# 任务 01：新 UI 地基（外壳 + 设计系统 + 样板页「对话 › 参与」）

仓库：/home/claude/Documents/program/astrbot_plugin_private_companion（分支 wechat）。
先读：docs/ui-redesign/IA.md（第 2、3 节必读）、docs/ui-redesign/mockup-B.png 的文字描述（见下）、pages/陪伴小屋/index.html、pages/陪伴小屋/embedded-bridge.js、pages/陪伴小屋/reply-page.js、pages/陪伴小屋/decision-page.js。

## 硬性规则
- 只新建 `pages/陪伴控制台/` 目录下的文件，以及 `docs/ui-redesign/CONTRACT.md`。不改任何 Python、不改旧页面、不改 _conf_schema.json。
- 不 git commit，不 push，不访问任何服务器、不登录 Dashboard、不读任何密码文件。
- 不开子代理，不要"等待"什么而结束回合；一口气做完，最后一条消息就是交付总结。
- 不加依赖、不加构建步骤：原生 HTML/CSS/JS（ES module 或 IIFE 均可，与旧页面一致即可）。
- 不写说明性提示文字到界面上（没有"提示：……"、没有横幅解释）。字段名用人话。
- 不做本任务外的页面，其它一级导航下的页面只放占位路由（空白页 + 页面标题），后续任务填。

## 要做的
1. **外壳** `index.html` + `shell.js` + `tokens.css` + `shell.css`
   - 左侧导航：首页、角色、联系人、对话、生活、能力、系统；选中一级后在其下展开二级（按 IA 2.2 页面树）。hash 路由 `#/对话/参与`。
   - 顶部：页面标题；当前对象选择器（私聊对象/群，数据来自 accounts/host targets 相关 GET 接口，读旧页面怎么取的）；范围分段控件「角色默认 / 当前私聊 / 当前群」，只显示当前对象实际可用的范围（IA 2.1）。
   - 能力驱动显示：按 IA 第 3 节，用现有接口能拿到的平台/能力信息决定显示；拿不到时保守显示，不报错。
2. **设计系统（风格 B：暖白琥珀）**
   - 背景 #f4f3f0，卡片 #faf9f7 + 1px 边框 #e7e4de + 极淡阴影，主文字 #141311，次文字 #6b6760，唯一强调色琥珀 #d99a16（选中导航、选中分段、开关开、主按钮），无其它彩色。
   - 卡片：标题加粗，行之间细分隔线，左标签右控件；文本框/下拉在右半栏较宽；开关靠右。系统字体栈含 PingFang SC / Microsoft YaHei。
   - 组件（放 `ui.js` 导出）：card、row、toggle、textField、numberField(带单位)、select、tagInput(唯一化、回车添加、× 删除)、segmented、saveBar(编辑→保存→一个结果状态)、跳转链接「去设置」。
   - 窄屏（<760px）导航折叠成顶部抽屉。
3. **API 层** `api.js`：沿用旧页面 embedded-bridge 的调用方式（同一套鉴权/前缀/token 与幂等键处理），不要自造新协议。
4. **页面模块契约**：每个页面一个文件 `pages/<一级>-<二级>.js`，导出 `{ id, section, title, render(root, ctx) }`；ctx 含 api、当前对象、当前范围、ui 组件、navigate()。写进 `docs/ui-redesign/CONTRACT.md`（≤80 行，给后续并行实现者看）。
5. **样板页「对话 › 参与」**：真实读写现有接口（reply / reply/configure / reply/participation / group_participation 相关，读 reply-page.js、decision-page.js 怎么调的）。内容至少：
   - 卡片「唤醒」：叫它的名字、唤醒词（tag）、有人提问时接话、冷场时接话（群）。
   - 卡片「连续对话」：回复后继续接话、接话时长（秒）、最多接话（含"不限"）。
   - 卡片「私聊」：等你说完再回（秒，防抖）——仅私聊范围显示。
   - 其余属于"参与"归属的 key（IA 表中唯一归属为 对话 › 参与 的）都要有位置，次要的收进卡片底部「更多」折叠。
6. **首页**：只放占位卡片（今天），后续任务填。

## 验收
- `node --check` 所有 js 通过。
- 写 `pages/陪伴控制台/dev/mock.html`（或同等）+ 一份假数据，用 `python3 -m http.server` 本地打开能看到外壳与参与页完整渲染、能切换范围、能点保存（对 mock）。不需要截图工具，自己读 DOM/控制台确认即可。
- 交付总结（≤25 行）：新增文件列表、契约要点、参与页每个控件对应的接口字段、你没把握的地方。

## mockup-B 描述
左侧导航纵列图标+文字，选中项浅琥珀底+琥珀字+左侧琥珀竖条；二级项缩进无图标。顶部右侧：对象下拉（白底细边）+ 三段分段控件（选中段浅琥珀底琥珀字）。主体三张卡片纵向排列，右下角琥珀实心「保存」按钮。大量留白，无任何解释性文字。
