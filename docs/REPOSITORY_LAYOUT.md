# 仓库布局与依赖

本仓库交付单个 AstrBot 插件 `astrbot_plugin_private_companion`。根目录只放 AstrBot 入口 `main.py`、元数据、配置 schema、依赖和用户导航文档，不放数据、日志、临时脚本或交付包。

| 路径 | 职责 |
| --- | --- |
| `main.py` | 唯一 Star 注册、启动、事件转发与退出。 |
| `astrbot_host/` | AstrBot SDK、Dashboard、OneBot 和七项内置能力的宿主适配。 |
| `companion_v2/` | 不反向依赖宿主包的领域逻辑、配置、迁移与存储；目录名是内部实现名称。 |
| `pages/陪伴小屋/` | 唯一公开 Dashboard 页面；其他工作区以 `workspace.html` 为源并嵌入小屋。 |
| `tests/`、`fixtures/` | 自动测试与合成数据，不保存用户资料。 |
| `tools/` | 开发、页面同步、交付包构建和验证工具。 |
| `docs/` | 当前工程合同、配置映射和开发者排障说明。历史设计与验收资料在发布准备归档中。 |

依赖方向是 `main.py → astrbot_host → companion_v2`。核心包不得导入 `astrbot_host` 或 AstrBot SDK。跨领域操作须经所属领域服务及权限边界，不能直接读写别的领域的持久表。

七项能力 Content、Image、Screen、Reality、Together、Game、Live 随同一本体交付，内部按各领域实现和启停，不额外注册 Star。插件身份、目录名、`metadata.name`、`PLUGIN_NAME` 和注册装饰器必须一致；领域产品 ID 仍为 `private_companion.v2`。页面规范源只在 `pages/陪伴小屋/`，同步使用 `tools/sync_framework_page.py`。

源码统一在该仓库维护。发布与安装都从同一份已验证源码生成；内嵌工作区和页面清单由源文件生成，不手工修改生成副本。设计稿、历史发布暂存、测试输出及备份放在仓库和 AstrBot 一级插件扫描目录之外，不作为后续修改的来源。

运行数据与旧版来源分开。迁移仅读取旧版配置和资料，选择明确目标后写入新数据根；不得修改旧版用户数据。测试、可加载副本和备份放在 AstrBot 一级插件扫描目录之外。宿主测试使用 AstrBot 自带 Python、`backend/app` 路径及独立临时 `ASTRBOT_ROOT`。

发布顺序：修改领域功能及实际配置 → 同步陪伴小屋 → 从当前源码构建交付包 → 对该包验证清单、迁移、生命周期、重载和路由注销。旧包的通过记录不能代替新包测试。公开升级与回退步骤见根目录 `README.md`。

## 运行目录同步

源码是唯一可编辑副本；AstrBot 运行目录
（`C:\Users\99505\.astrbot\data\plugins\astrbot_plugin_private_companion`）
是构建产物，不在那里直接改。`tools/sync_runtime.py` 提供检查、计划和应用三步：

```powershell
cd Z:\CompanionUpgrade\source\astrbot_plugin_private_companion
python tools/sync_runtime.py --check   # 差异存在时退出码为 1
python tools/sync_runtime.py --plan    # 备份将被覆盖的运行文件并生成 plan.json
python tools/sync_runtime.py --apply --plan-path <plan.json>
```

`--plan` 的备份写在仓库外
`Z:\CompanionUpgrade\backups\runtime-sync-<时间>\before`。运行目录的 `data/`、
`__pycache__/`、`.git/` 和构建生成的 `RELEASE_FILES.json` 不在同步范围内。
未经构建和定向测试的源码不直接应用；应用后仍按发布流程重载并核对。

## 工作树、备份与归档边界

| 路径 | 角色 |
| --- | --- |
| `Z:\CompanionUpgrade\source\astrbot_plugin_private_companion` | 唯一维护源码与工作树 |
| `Z:\CompanionUpgrade\releases` | 已验证交付包，只读 |
| `Z:\CompanionUpgrade\backups` | 源码快照与运行同步备份，只读 |
| `Z:\CompanionUpgrade\archive` | 历史现场与一次性整理，只读 |
| `C:\Users\99505\.astrbot\data\plugin_data\astrbot_plugin_private_companion` | V1 用户数据，迁移只读来源，不得修改 |
| `C:\Users\99505\.astrbot\data\plugins\astrbot_plugin_private_companion_v2` | V1 旧运行/设计目录，冻结，不加载、不编辑 |

顶层目录地图与规则见 `Z:\CompanionUpgrade\README.md`。不要在顶层再建开发副本；
需要并行开发时在源码仓库内使用分支或 worktree，并把副本放在 AstrBot 插件扫描目录之外。

> `Z:\CompanionUpgrade\archive\20261024-consolidation\archive\development-workspace`
> 同时是本仓库的 Git 公共对象库（当前 `source` 是它的链接 worktree）。它不能删除或移动；
> 若要把对象库迁出归档，先用 `git worktree repair` 处理，再从 `source` 验证 `git status`。
