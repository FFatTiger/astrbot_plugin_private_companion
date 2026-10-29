# 任务 08：真实数据下的修正

新 UI（pages/陪伴中心/，原名陪伴控制台，已改名）已部署到线上。用真实后端打开后发现问题。真实接口返回样本见 docs/ui-redesign/live-sample.json（page/targets 与两个 reply GET，已脱敏）。先读它、CONTRACT.md，再读相关代码。

## 硬性规则
- 只改 pages/陪伴中心/ 下文件（含 dev mock）。不改 Python、不 commit、不访问服务器、不开子代理、不要以"我先做X"结束回合；回复简短。

## 问题
1. 列表字段真实值可能是 JSON 字符串（如 `"group_wakeup_direct_words": "[\"hcuu\", \"大肥鱼\"]"`），也可能是数组或对象包装。唤醒词被渲染成 `["hcuu"`、`"大肥鱼"]` 两个错误标签。在 ui.js 做一处统一的值归一化（字符串 JSON 数组→数组；保存时按读取时的原格式写回），所有 tag/list 字段都走它。全局排查同类字段。
2. 顶部对象选择器：真实 targets 的 display_name/group_name/account_name 都是空串，选项显示成「当前私聊」「当前群」这种泛称，三个群无法区分。显示名回退链：display_name → group_name → 私聊用 participant_id / 群用 group_id（去掉 @chatroom 后缀）；同时保留按 scope 分组（私聊/群）。
3. 范围分段控件只该显示当前对象实际可用的范围；确认选中群时出现「当前群」、选中私聊时出现「当前私聊」，不要重复项。
4. 用 live-sample.json 的结构更新 dev/mock*.html 的假数据（至少 targets 与 reply 两类），让 mock 反映真实形态，并验证以上三点。

## 验收
node --check；mock 逐页渲染 0 错误；交付总结 ≤6 行。
