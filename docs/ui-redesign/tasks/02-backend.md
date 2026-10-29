# 任务 02：新 UI 需要的后端小改动（插件 fork）
仓库 /home/claude/Documents/program/astrbot_plugin_private_companion（分支 wechat，工作区里另有人在 pages/陪伴控制台/ 写前端，别碰那个目录和 docs/）。
先读 docs/ui-redesign/IA.md 第 5 节，docs/ui-audit/api.md。
## 硬性规则
- 不开子代理；不要以"等待"结束回合；一口气做完，最后一条消息是交付总结（≤25 行）。
- 不 push；不访问服务器/Dashboard；不读任何密码文件；不改任务范围外的文件。
- 不打绕过性补丁，只做本任务要求的正规改动。
- 不 git commit（我来提交）。
## 做
IA 第 5 节第 1–4 项（第 5 项不做，新页面不走 iframe 桥）：
1. GET /host/capabilities（按 target/role）：message_components(face/poke/quote/mention)、presence、screen/reality 授权聚合、语音/语义/模型是否已配置。只聚合已有状态，不新增业务逻辑；拿不到的字段给 null 不要猜。
2. 在现有 page/targets 响应里加 overview（或新 GET /page/overview），合成首页快照。
3. page/targets 群目标补 display_name，来自宿主原生群目录（wechat_helper 有群名；QQ 走平台已有能力），拿不到回退 group_id。
4. 账号目录同时返回原生已发现但未受管的群，带 managed / available_for_target；不改保存契约。
- 路由注册方式、鉴权、返回格式完全沿用现有 api 模块的写法。
- 每项配最小测试，放 tests/ 下沿用现有风格；跑相关测试 + 全量 pytest 对比改前改后失败集合一致（先记录基线）。
## 交付
总结里给出：每个接口的路径、方法、返回字段示例 JSON；改动文件；测试结果（基线 vs 改后）。同时把这些写进 docs/ui-redesign/BACKEND.md。
