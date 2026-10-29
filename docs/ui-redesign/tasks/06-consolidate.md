# 任务 06：新 UI 收尾 A——组件上收、英文文件名、接入新后端接口

仓库 /home/claude/Documents/program/astrbot_plugin_private_companion，目录 pages/陪伴控制台/。六个一级导航已由不同人实现完毕，各自在 `pages/<区>-共享.js`、各页文件里重复实现了确认框、「更多」折叠卡、依赖显隐表单、左列表右详情、统一保存等。先读 docs/ui-redesign/CONTRACT.md、BACKEND.md、REVIEW-NOTES.md，再通读 pages/陪伴控制台/ 全部代码。

## 硬性规则
- 只改 pages/陪伴控制台/ 下文件、docs/ui-redesign/CONTRACT.md，以及 tests/ 里 `test_sdk_discovers_same_voxel_shell_and_injects_scoped_bridge` 所在测试的页面清单（让它认识新页面目录，别改断言逻辑）。
- 不改 Python 业务代码、不改旧页面、不 git commit、不访问服务器、不开子代理、不要以"我先做X"结束回合；回复简短，一口气做完。
- 不改功能、不删字段、不改各页调用的后端契约。

## 做
1. **组件上收**：把各区重复实现的通用组件合并进 `ui.js`（confirm 对话框、foldCard「更多」、依赖显隐 `when()`、listDetail 布局、统一 saveBar、状态 badge、actionButton+回执）。各区改用公共组件，删掉各区重复实现；各区 `-共享.js` 只留真正本区专用的逻辑。各区 CSS 中通用部分并入 shell.css。
2. **英文文件名**：目录名 `陪伴控制台` 保留。其余文件改英文 kebab-case，如 `pages/conversation-participation.js`、`pages/life-memory.js`、`pages/conversation.css`、`dev/mock-conversation.html`。路由仍是中文 `#/对话/参与`，在 shell.js 用一张 中文路由→模块文件 映射表。
3. **接入新接口**（BACKEND.md）：shell 启动用 `GET page/overview`（失败时回退原有并发读取）；对象选择器用群 `display_name`；能力驱动显示统一读 `GET host/capabilities`，值为 null 时保守处理；账号与会话页列出未受管群（`managed=false`）供勾选，保存仍走原契约。
4. 更新 CONTRACT.md（≤80 行）反映以上。

## 验收
- 全部 js `node --check`；全部 dev/mock-*.html 用 /usr/bin/google-chrome --headless=new 或 playwright 逐页渲染，控制台 0 错误；mock 补上新接口的假数据。
- 跑那一个测试文件确认通过（用 /home/claude/Documents/program/.venv-companion-pytest/bin/python -m pytest <文件>）。
- 交付总结 ≤12 行：上收的组件清单、删除的重复代码行数、文件改名映射位置、接口接入情况。
