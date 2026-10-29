import {card, row, select, textField, numberField, toggle, saveBar, setSaveState, link, esc, foldCard, statusBadge, confirm as uiConfirm, labelOf, stateText} from "../ui.js";

const style = () => { if (!document.querySelector("link[data-system-style]")) { const node = document.createElement("link"); node.rel = "stylesheet"; node.href = new URL("./system.css", import.meta.url).href; node.dataset.systemStyle = "1"; document.head.append(node); } };
const unwrap = value => value?.data && !value.tasks && !value.settings ? value.data : value || {};
const taskLabels = {"conversation.reply":"对话回复","conversation.context_image_caption":"图片摘要","conversation.image_narration":"图片转述","conversation.video_narration":"视频转述","screen.interpretation":"屏幕解读","screen.peek":"屏幕速览","image_review":"图片审核","conversation.image_review":"图片审核","proactive.compose":"主动联系","proactive.judge":"主动联系复核","memory.reflect":"记忆整理","calendar.plan":"日程规划","role.state.maintain":"角色状态","role.reading.consume":"阅读理解","role.growth.progress":"成长进展","role.journal.diary":"日记","role.journal.dream":"梦境","role.journal.derive":"书写整理","role.journal.select":"素材选择","role.expression.learn":"表达学习","role.expression.review":"回复表达复核","role.expression.contact_review":"主动表达复核","role.self_review":"每日复盘","content.authoring.draft":"内容起草"};
const groupLabels = {对话:"对话",感知:"感知",主动与记忆:"主动与记忆",私人书写:"私人书写",学习:"学习",生活与成长:"生活与成长",内容工作:"内容工作"};
const taskLabel = key => taskLabels[key] || "其他任务";
const groupOf = key => key.startsWith("conversation.") ? "对话" : key.startsWith("screen.") || key.includes("image") ? "感知" : key.startsWith("proactive.") || key.startsWith("memory.") ? "主动与记忆" : key.startsWith("role.journal") ? "私人书写" : key.startsWith("role.expression") || key === "role.self_review" ? "学习" : key.startsWith("role.") || key.startsWith("calendar") ? "生活与成长" : "内容工作";
const choicesOf = value => Object.fromEntries((Array.isArray(value) ? value : []).map(item => [item.id || item.provider_id || item.name, item.label || item.name || item.id || item.provider_id]));
const taskValue = (task, name) => task[name] ?? task.settings?.[name] ?? task.fields?.[name]?.value ?? "";
const fieldNames = ["provider", "fallback", "max_output_tokens", "timeout_seconds", "prompt", "replacement_rules", "fallback_on_refusal", "refusal_terms", "replacement_scope"];
const statusOf = task => task.kind === "conversation.reply" ? ["由运行服务管理", "muted"] : taskValue(task, "provider") ? ["已配置", "ok"] : ["跟随上级", "muted"];
const button = (label, action, extra = "") => `<button type="button" class="system-button${extra}" data-model-action="${esc(action)}">${esc(label)}</button>`;
const valueFrom = (root, name, fallback = "") => root.querySelector(`[data-ui-field="${CSS.escape(name)}"]`)?.value ?? fallback;

const page = { id: "system-models", section: "系统", title: "模型与连接", async render(root, ctx) {
  style(); root.innerHTML = `<div class="page-loading">正在读取</div>`;
  const role = ctx.role, api = ctx.api;
  if (!role?.model_api) { root.innerHTML = `<div class="system-empty">当前角色没有模型配置接口。</div>`; return; }
  let data;
  try { data = unwrap(await api.get(role.model_api)); } catch (error) { root.innerHTML = `<div class="system-error">模型目录读取失败：${esc(error.message || "")}</div>`; return; }
  const tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(task => ({...task}));
  const providers = choicesOf(data.providers || data.status?.providers || []);
  const quickGroups = [...new Set(tasks.map(task => groupOf(task.kind)))];
  const state = {dirty:false, expanded:new Set(), saving:false, message:""};
  const draft = new Map(tasks.map(task => [task.kind, {...task, fields:{...(task.fields || {})}}]));
  const field = (index, name, value, type = "text", disabled = false) => {
    const id = `task-${index}-${name}`;
    if (type === "select") return select(id, value, {"":"跟随上级", ...providers}, {id, label:labelOf(name), disabled});
    if (type === "number") return numberField(id, value, "", {id, label:labelOf(name), disabled});
    return `<textarea class="ui-textarea" id="${esc(id)}" data-task-field="${esc(id)}" aria-label="${esc(labelOf(name))}"${disabled ? " disabled" : ""}>${esc(value)}</textarea>`;
  };
  const taskTable = () => {
    const groups = {};
    tasks.forEach(task => (groups[groupOf(task.kind)] ||= []).push(task));
    return Object.entries(groups).map(([group, items]) => `<details class="console-card system-task-group" open><summary class="card-title"><span>${esc(groupLabels[group] || group)}</span><small>${items.length} 项</small><span class="more-chevron" aria-hidden="true">⌄</span></summary><div class="card-body system-table-wrap"><table class="system-table system-model-table"><thead><tr><th>任务</th><th>主模型</th><th>备用模型</th><th>状态</th></tr></thead><tbody>${items.map(task => {
      const index = tasks.indexOf(task), current = draft.get(task.kind) || task, managed = task.kind === "conversation.reply", status = statusOf(current), open = state.expanded.has(task.kind);
      return `<tr class="system-model-row${open ? " is-open" : ""}" data-task-row="${esc(task.kind)}"><td><button type="button" class="system-task-trigger" data-task-expand="${esc(task.kind)}"><strong>${esc(taskLabel(task.kind))}</strong><span class="more-chevron" aria-hidden="true">${open ? "⌃" : "⌄"}</span></button></td><td>${esc(taskValue(current, "provider") || "跟随上级")}</td><td>${esc(taskValue(current, "fallback") || "不设置")}</td><td>${statusBadge(status[0], status[1])}</td></tr><tr class="system-model-editor${open ? " is-open" : ""}" data-task-editor="${esc(task.kind)}"${open ? "" : " hidden"}><td colspan="4"><div class="system-task-editor">${row("主模型", select(`task-${index}-provider`, taskValue(current, "provider"), {"":"跟随上级", ...providers}, {id:`task-${index}-provider`, label:"主模型", disabled:managed}))}${row("备用模型", select(`task-${index}-fallback`, taskValue(current, "fallback"), {"":"不设置", ...providers}, {id:`task-${index}-fallback`, label:"备用模型", disabled:managed}))}${row("附加提示词", field(index, "prompt", taskValue(current, "prompt"), "text"))}${row("输出上限", numberField(`task-${index}-max_output_tokens`, taskValue(current, "max_output_tokens"), "字", {id:`task-${index}-max_output_tokens`, label:"输出上限", disabled:managed}))}${row("请求超时", numberField(`task-${index}-timeout_seconds`, taskValue(current, "timeout_seconds"), "秒", {id:`task-${index}-timeout_seconds`, label:"请求超时", disabled:managed}))}<details class="system-details"><summary>高级设置</summary>${managed ? `<p class="system-note">这些字段由运行服务托管，只能在 AstrBot 里调整；本页只保留附加提示词可编辑。</p>` : ""}<div class="system-choice-grid">${fieldNames.filter(name => ["provider","fallback","max_output_tokens","timeout_seconds","prompt"].indexOf(name) < 0).map(name => `<label class="system-choice"><span>${esc(labelOf(name))}</span><input type="checkbox" data-task-inherit="${index}:${esc(name)}"${current.fields?.[name]?.explicit === false ? " checked" : ""}${managed ? " disabled" : ""}></label>`).join("")}</div></details></div></td></tr>`;
    }).join("")}</tbody></table></div></details>`).join("") || card("任务模型", `<div class="system-empty">当前没有注册任务。</div>`);
  };
  const quick = foldCard("批量指派", `<p class="system-note">先应用到页面草稿，最后统一保存。</p>${quickGroups.map((group, index) => row(groupLabels[group] || group, `<div class="system-inline">${select(`quick-provider-${index}`, "", {"":"不修改", ...providers}, {label:groupLabels[group] || group})}${button("应用到草稿", `quick-${index}`)}</div>`)).join("")}`);
  const replacement = card("拒答替代", `${row("作用范围", select("replacement-scope", data.replacement_scope || "", {"":"按任务", role:"角色默认", window:"当前对象"}, {label:"作用范围"}))}${row("启用替代", toggle("fallback-on-refusal", Boolean(data.fallback_on_refusal), {label:"启用拒答替代"}))}${row("拒答匹配词", textField("refusal-terms", Array.isArray(data.refusal_terms) ? data.refusal_terms.join(", ") : data.refusal_terms || "", {label:"拒答匹配词"}))}<details class="system-details"><summary>替代规则</summary><textarea class="system-json" data-model-json="replacement" aria-label="替代规则">${esc(JSON.stringify(data.replacement_rules || [], null, 2))}</textarea></details>`);
  let voice = {}; try { voice = unwrap(await api.get(`${role.model_api}/voice`)); } catch (_) {}
  const voiceProviders = choicesOf(voice.providers || data.voice?.providers || []);
  const voiceCard = foldCard("语音模型", row("中文语音", select("voice-zh", data.voice_zh_provider_id || voice.languages?.find(item => item.code === "zh")?.provider_id || "", {"":"跟随上级", ...voiceProviders}, {label:"中文语音"})) + row("日语语音", select("voice-ja", data.voice_ja_provider_id || "", {"":"不设置", ...voiceProviders}, {label:"日语语音"})) + row("英语语音", select("voice-en", data.voice_en_provider_id || "", {"":"不设置", ...voiceProviders}, {label:"英语语音"})) + row("合成超时", numberField("voice-timeout", data.voice_timeout_seconds || 30, "秒", {label:"合成超时"})));
  let tts = {}; try { tts = unwrap(await api.get(`${role.model_api}/tts/providers`)); } catch (_) {}
  const ttsItems = Array.isArray(tts.items) ? tts.items : Array.isArray(tts.providers) ? tts.providers : [];
  const ttsRows = ttsItems.map((item, index) => `<li class="system-list-item"><div><strong>${esc(item.name || "语音连接")}</strong><small>${esc(item.model || item.voice || "")}</small></div><div class="system-inline">${statusBadge(item.enable === false || item.enabled === false ? "已停用" : "已启用", item.enable === false || item.enabled === false ? "warn" : "ok")}${button("编辑", `edit-tts-${index}`)}${button("克隆", `clone-tts-${index}`)}${button("测试", `test-tts-${index}`)}${button(item.enable === false || item.enabled === false ? "启用" : "停用", `toggle-tts-${index}`)}</div></li>`).join("");
  const connections = foldCard("语音连接管理", `<ul class="system-list">${ttsRows || "<li class=\"system-empty\">暂无语音连接</li>"}</ul>${button("新建连接", "create-tts")}`);
  const search = data.search || {}, laya = data.laya || {}, budget = data.budget || {};
  root.innerHTML = `<div class="page-stack" data-model-page>${taskTable()}${quick}${replacement}${voiceCard}${connections}${foldCard("搜索服务", row("搜索模型服务", select("deepseek-provider", search.deepseek_provider_id || "", {"":"未指定", ...providers}, {label:"搜索模型服务"})))}${foldCard("决策服务", `${row("启用决策服务", toggle("laya-enabled", Boolean(laya.enabled), {label:"启用决策服务"}))}${row("接入方式", select("laya-mode", laya.mode || "remote", {remote:"远程服务", local:"本地模型"}, {label:"接入方式"}))}${row("服务端点", textField("laya-endpoint", laya.endpoint || "", {label:"服务端点"}))}${row("超时", numberField("laya-timeout", laya.timeout_seconds || 30, "秒", {label:"超时"}))}`)}${foldCard("后台任务预算", `${row("启用软限额", toggle("budget-enabled", Boolean(budget.enabled), {label:"启用软限额"}))}${row("每日软限额", numberField("budget-daily", budget.daily_limit || 0, "次", {label:"每日软限额"}))}`)}${saveBar("models", {disabled:false})}<p class="system-message" data-model-message aria-live="polite">${esc(state.message)}</p></div>`;
  const message = text => { state.message = text; const node = root.querySelector("[data-model-message]"); if (node) node.textContent = text; };
  // tts/providers/update 只收 {provider_id, values}（model_api.tts_provider_update），
  // 所以编辑表单按 item.fields 渲染，提交时原样把 values 发回去；密钥留空表示不改。
  const openTtsEditor = item => {
    if (!item) return;
    const fields = Array.isArray(item.fields) ? item.fields : [];
    const control = field => {
      const key = esc(field.key), value = field.value ?? "";
      if (field.type === "bool") return `<input type="checkbox" data-tts-field="${key}" data-tts-type="bool"${value === true ? " checked" : ""}>`;
      if (field.type === "int" || field.type === "float") return `<input class="ui-input" type="number" data-tts-field="${key}" data-tts-type="number" value="${esc(value)}"${field.min != null ? ` min="${esc(field.min)}"` : ""}${field.max != null ? ` max="${esc(field.max)}"` : ""}${field.step != null ? ` step="${esc(field.step)}"` : ` step="${field.type === "int" ? 1 : .01}"`}>`;
      if (Array.isArray(field.options) && field.options.length) return `<select class="ui-select" data-tts-field="${key}" data-tts-type="text">${field.options.map(option => `<option value="${esc(option.value)}"${String(option.value) === String(value) ? " selected" : ""}>${esc(option.label || option.value)}</option>`).join("")}</select>`;
      if (field.type === "object" || field.type === "list") return `<textarea class="system-json" data-tts-field="${key}" data-tts-type="text" aria-label="${esc(field.label || field.key)}">${esc(typeof value === "object" ? JSON.stringify(value, null, 2) : value)}</textarea>`;
      if (field.secret) return `<input class="ui-input" type="password" data-tts-field="${key}" data-tts-type="text" value="" placeholder="${field.set ? "已设置，留空保留" : "未设置"}">`;
      return `<input class="ui-input" data-tts-field="${key}" data-tts-type="text" value="${esc(value)}">`;
    };
    const dialog = document.createElement("dialog");
    dialog.className = "ui-dialog";
    dialog.innerHTML = `<form method="dialog"><header><h2>编辑语音连接</h2><button value="cancel" aria-label="关闭">×</button></header><div class="ui-dialog-body"><div class="system-drawer">${fields.length ? fields.map(field => `<label class="system-choice"><span>${esc(field.label || field.key)}</span>${control(field)}${field.hint ? `<small>${esc(field.hint)}</small>` : ""}</label>`).join("") : `<p class="system-note">这个连接没有可编辑字段。</p>`}</div></div><footer><button value="cancel" class="ui-action-button is-secondary">取消</button><button value="save" class="ui-action-button">保存</button></footer></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", async () => {
      const accepted = dialog.returnValue === "save";
      const values = {};
      dialog.querySelectorAll("[data-tts-field]").forEach(node => {
        const key = node.dataset.ttsField;
        if (node.dataset.ttsType === "bool") values[key] = node.checked;
        else if (node.dataset.ttsType === "number") { if (node.value.trim() !== "") values[key] = Number(node.value); }
        else if (node.type === "password") { if (node.value !== "") values[key] = node.value; }
        else values[key] = node.value;
      });
      dialog.remove();
      if (!accepted) return;
      try { await api.post(`${role.model_api}/tts/providers/update`, {provider_id: item.id, values}); message("语音连接已保存"); await page.render(root, ctx); }
      catch (error) { message(error.message || "语音连接保存失败"); }
    }, {once: true});
    try { dialog.showModal(); } catch (_) { dialog.remove(); }
  };
  const updateDraft = (index, name, value) => { const task = tasks[index], current = draft.get(task.kind) || {...task}; current[name] = value; draft.set(task.kind, current); state.dirty = true; const save = root.querySelector('[data-ui-save="models"]'); if (save) save.disabled = false; };
  root.addEventListener("input", event => { const node = event.target.closest("[data-task-field]"); if (!node) return; const match = node.dataset.taskField.match(/^task-(\d+)-(.+)$/); if (match) updateDraft(Number(match[1]), match[2], node.value); state.dirty = true; });
  root.addEventListener("change", event => { const node = event.target.closest("[data-ui-field]"); if (!node) return; const id = node.dataset.uiField, match = id.match(/^task-(\d+)-(.+)$/); if (match) updateDraft(Number(match[1]), match[2], node.type === "number" ? Number(node.value || 0) : node.value); state.dirty = true; });
  root.addEventListener("click", async event => {
    const expand = event.target.closest("[data-task-expand]"); if (expand) { const key = expand.dataset.taskExpand; state.expanded.has(key) ? state.expanded.delete(key) : state.expanded.add(key); page.render(root, ctx); return; }
    const action = event.target.closest("[data-model-action]")?.dataset.modelAction; if (!action || event.target.disabled) return;
    const node = event.target; try {
      if (action.startsWith("quick-")) { const index = Number(action.slice(6)), group = quickGroups[index], provider = root.querySelector(`[data-ui-field="quick-provider-${index}"]`)?.value; if (provider) tasks.filter(task => groupOf(task.kind) === group).forEach(task => { const current = draft.get(task.kind) || {...task}; current.provider = provider; draft.set(task.kind, current); }); state.dirty = true; message("已应用到页面草稿"); return; }
      if (action === "test-voice" || action.startsWith("test-tts-")) { if (!await uiConfirm(root, "确认调用语音服务", "测试可能调用真实服务并产生费用。", {confirmLabel:"继续", danger:true})) return; }
      if (action.startsWith("clone-tts-") && !await uiConfirm(root, "确认克隆连接", "将新增一个语音连接副本。", {confirmLabel:"克隆"})) return;
      if (action.startsWith("toggle-tts-")) { const item = ttsItems[Number(action.slice(11))]; await api.post(`${role.model_api}/tts/providers/update`, {provider_id:item.id, values:{enable:item.enable === false || item.enabled === false}}); message("连接状态已更新"); return; }
      if (action.startsWith("test-tts-")) { const item = ttsItems[Number(action.slice(9))]; await api.post(`${role.model_api}/tts/providers/test`, {id:item.id}); message("测试已提交"); return; }
      if (action.startsWith("clone-tts-")) { const item = ttsItems[Number(action.slice(10))]; await api.post(`${role.model_api}/tts/providers/clone`, {id:item.id, new_id:`${item.id}-copy`}); message("连接副本已创建"); return; }
      if (action === "create-tts") { await api.post(`${role.model_api}/tts/providers/create`, {id:"new-provider", name:"新语音服务"}); message("新连接已创建"); return; }
      if (action.startsWith("edit-tts-")) { openTtsEditor(ttsItems[Number(action.slice(9))]); return; }
      const save = event.target.closest('[data-ui-save="models"]'); if (!save) return;
    } catch (error) { message(error.message || "操作未完成"); }
  });
  root.querySelector('[data-ui-save="models"]')?.addEventListener("click", async event => {
    const save = event.currentTarget; if (state.saving) return; state.saving = true; save.disabled = true; setSaveState(root, "models", "保存中");
    try {
      const inheritNodes = [...root.querySelectorAll("[data-task-inherit]")];
      for (const task of tasks) {
        const index = tasks.indexOf(task), current = draft.get(task.kind) || task, managed = task.kind === "conversation.reply";
        const changes = {}, reset = [];
        for (const name of ["provider", "fallback", "max_output_tokens", "timeout_seconds", "prompt"]) if (JSON.stringify(taskValue(task, name)) !== JSON.stringify(current[name])) changes[name] = current[name];
        // 高级「跟随上级」按后端契约用 reset 表达显式回退；取消勾选则把当前值写成 explicit。
        if (!managed) for (const node of inheritNodes) {
          const [indexText, name] = node.dataset.taskInherit.split(":");
          if (Number(indexText) !== index || !Object.hasOwn(task.fields || {}, name)) continue;
          if (node.checked) { delete changes[name]; reset.push(name); }
          else if (task.fields?.[name]?.explicit === false) changes[name] = task.fields?.[name]?.value ?? "";
        }
        if (Object.keys(changes).length || reset.length) await api.post(`${role.model_api}/configure`, {kind:task.kind, operation_key:api.operationKey("model-task"), edit_token:data.edit_token, changes, reset});
      }
      const replacement = {replacement_rules:JSON.parse(root.querySelector('[data-model-json="replacement"]')?.value || "[]"), replacement_scope:valueFrom(root, "replacement-scope"), fallback_on_refusal:root.querySelector('[data-ui-toggle="fallback-on-refusal"]')?.getAttribute("aria-checked") === "true", refusal_terms:valueFrom(root, "refusal-terms").split(/[,，]/).map(value => value.trim()).filter(Boolean)};
      await api.post(`${role.model_api}/configure`, {kind:"replacement_rules", operation_key:api.operationKey("model-replacement"), edit_token:data.edit_token, changes:replacement});
      await api.post(`${role.model_api}/voice/save`, {operation_key:api.operationKey("voice"), edit_token:voice.edit_token || data.edit_token, changes:{voice_zh_provider_id:valueFrom(root,"voice-zh"),voice_ja_provider_id:valueFrom(root,"voice-ja"),voice_en_provider_id:valueFrom(root,"voice-en"),voice_timeout_seconds:Number(valueFrom(root,"voice-timeout",30))}});
      await api.post(`${role.model_api}/search/save`, {revision:search.revision, changes:{deepseek_provider_id:valueFrom(root,"deepseek-provider")}}).catch(() => {});
      await api.post(`${role.model_api}/laya/save`, {revision:laya.revision, changes:{enabled:root.querySelector('[data-ui-toggle="laya-enabled"]')?.getAttribute("aria-checked") === "true", mode:valueFrom(root,"laya-mode"), endpoint:valueFrom(root,"laya-endpoint"), timeout_seconds:Number(valueFrom(root,"laya-timeout",30))}}).catch(() => {});
      await api.post("config/configure", {section:"budget", operation_key:api.operationKey("budget"), edit_token:budget.edit_token, changes:{enabled:root.querySelector('[data-ui-toggle="budget-enabled"]')?.getAttribute("aria-checked") === "true", daily_limit:Number(valueFrom(root,"budget-daily",0))}}).catch(() => {});
      state.dirty = false; setSaveState(root, "models", "已保存", "ok"); message("模型与连接已保存");
    } catch (error) { save.disabled = false; setSaveState(root, "models", stateText(error.message || "保存失败"), "error"); } finally { state.saving = false; }
  });
} };
export default page;
