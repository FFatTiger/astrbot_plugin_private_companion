# 任务 04：把线上补丁折叠进 fork 的分支提交
fork：/home/claude/Documents/program/astrbot_plugin_private_companion（主工作区有人在改，不要在主工作区操作）。
补丁：/home/claude/Documents/program/wechatauto-replica/integration/plugin/patches/private_companion-wechat_helper.patch（基于 2e29e3f / 上游 7.0.10）。
## 硬性规则
- 不开子代理；不要以"等待"结束回合；一口气做完，最后一条消息是交付总结（≤25 行）。
- 不 push；不访问服务器/Dashboard；不读任何密码文件；不改任务范围外的文件。
- 不打绕过性补丁，只做本任务要求的正规改动。
- 可以在你自己的 worktree 里 git commit，不 push。
## 做
1. git -C <fork> worktree add ../astrbot_plugin_private_companion-patches -b wechat-patches wechat
2. 在该 worktree 里 git apply 补丁，然后按主题拆成若干提交（例：wechat_helper 流式分段、续接不限轮、群成员显示名/目录备注、表情包投递、引用图片编辑、账号会话接口……按补丁实际内容分），每个提交消息中文一句话说明为什么。
3. 拆完后 worktree 的树必须与"2e29e3f + 整个补丁"逐字节一致（git diff 校验，给出命令与结果）。
4. 跑 pytest，对比 wechat 分支基线的失败集合（只报告，不修）。
## 交付
总结列出提交列表（hash + 消息 + 涉及文件），一致性校验结果，测试对比。
