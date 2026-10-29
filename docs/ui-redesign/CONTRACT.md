# 新 UI 页面契约

## 页面与路由

页面模块导出 `{ id, section, title, render(root, ctx) }`。`ctx` 固定包含 `api`、`target`、`role`、`scope`、`capabilities`、`ui`、`navigate`；页面只使用插件相对路由，不直接 `fetch`、拼鉴权或读取旧页面全局状态。

中文 URL 路由保持不变，例如 `#/对话/参与`。`shell.js` 维护唯一的中文路由到英文 kebab-case 模块文件映射。目录 `pages/陪伴控制台/` 保留，页面、共享模块、CSS 与 mock 文件均使用英文文件名。

## 公共 UI

所有页面从 `ui.js` 使用 `card`、`row`、表单控件、`when`、`foldCard`/`more`、`confirm`、`listDetail`、`saveBar`、`statusBadge`、`actionButton` 等公共组件。各区共享模块只保留该区字段、数据和保存逻辑；通用折叠卡、确认框、依赖显隐、列表详情骨架和状态/动作控件不得在区内重复实现。通用 CSS 放在 `shell.css`。

## 数据与能力

启动优先调用 `GET page/overview`；失败才回退 `GET page/targets` 与原有并发读取。对象选择器显示目标的 `display_name`，群目标依次回退 `group_name`、群 ID。

能力统一读取 `GET host/capabilities?target_id=...&role_id=...`。能力值为 `null` 或缺失时保守隐藏或禁用相关 UI，不按平台名称猜测。角色 API 目录优先使用各角色的 `*_api`；群角色缺少 `config_api` 时由 `reply_api` 去掉 `/reply` 得到配置路由。

`GET accounts` 的 `discovered.groups` 包含未受管原生群；`managed=false` 的群在账号与会话页列出并可勾选。保存仍使用原有 `POST /accounts` 或 `POST /accounts/group-target` 请求契约，不向后端新增 `display_name` 字段。

## 保存

所有写请求由 `api.js` 生成 `operation_key`，沿用返回的令牌；超时不得换新幂等键重发。回复设置读取 `GET <reply_api>`，写 `POST <reply_api>/configure`，体为 `{operation_key, edit_token, changes}`。群参与使用配置接口的 `group_participation` section；窗口插话使用 `/participation` 与 `/participation/configure`。后端统一由 `api.js` 解包，错误以异常交给页面处理。

## 验收

全部 JavaScript 通过 `node --check`。全部 `dev/mock-*.html` 用无头 Chrome 或 Playwright 逐页渲染，控制台无错误；mock 覆盖 overview、capabilities、群显示名和未受管群数据。指定 SDK 页面发现测试的页面清单包含「陪伴控制台」。
