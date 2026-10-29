import {card, saveBar, link, stateText} from "../ui.js";
import {ensureStyles, standardFields, safeGet, safePost, op, formRows, detailsCard, pageStack, notice, actions, lifeButton, confirm, editDialog, itemTitle, dateText, stateLabel, scopeNote, targetIsPrivate, bindForm, bindNavigation, esc, valueOf} from "./life-shared.js";

const memoryFields = standardFields.memory;
const editableMemoryFields = memoryFields.filter(field => field.name !== "enabled");
function factsOf(data) { return Array.isArray(data?.items) ? data.items : Array.isArray(data?.memory_atoms) ? data.memory_atoms : []; }
function overview(data) { const local = data?.local || data || {}; return card("记忆概况", `<div class="life-overview-grid">${[["事实",local.facts ?? local.atom_count ?? "—"],["经历",local.experiences ?? local.episode_count ?? "—"],["来源",local.sources ?? local.source_count ?? "—"],["整理批次",local.batches ?? local.batch_count ?? "—"]].map(([label,value]) => `<span><b>${label}</b>${esc(value)}</span>`).join("")}</div>`); }
function factDetail(item) {
  if (!item) return card("事实详情", `<div class="life-empty">选择一条事实查看详情。</div>`);
  return card("事实详情", `<div class="life-detail"><span class="life-eyebrow">${esc(stateText(item.kind || "事实"))} · 第 ${esc(item.revision || 1)} 版</span><h2>${esc(item.statement || item.text || item.value || "未命名事实")}</h2><p class="life-prose">${esc(item.content || item.description || item.value || item.statement || "来源暂不可用")}</p><div class="life-meta-line"><span>来源 ${esc(item.source_count ?? 0)} 个</span><span>置信度 ${esc(item.confidence ?? "—")}</span><span>${esc(dateText(item.updated_at || item.observed_at))}</span></div>${actions([lifeButton("版本历史", `revisions:${item.atom_id}`, {secondary:true}), lifeButton("原始来源", `source:${item.atom_id}`, {secondary:true}), lifeButton(item.pinned ? "取消置顶" : "置顶", `${item.pinned ? "unpin" : "pin"}:${item.atom_id}`, {secondary:true}), lifeButton("更正", `correct:${item.atom_id}`), lifeButton("撤回", `retract:${item.atom_id}`, {danger:true}), lifeButton("遗忘", `forget:${item.atom_id}`, {danger:true})])}</div>`);
}
const page = {
  id:"life-memory", section:"生活", title:"记忆",
  async render(root, ctx) {
    ensureStyles();
    if (!targetIsPrivate(ctx) || !ctx.role?.memory_api) { root.innerHTML = pageStack(card("记忆", `<div class="life-empty"><strong>当前范围没有私聊事实库</strong><span>群公共记忆请从联系人 › 群详情进入。</span>${link("查看群详情", "联系人/群详情")}</div>`)); return; }
    root.innerHTML = `<div class="page-loading">正在读取</div>`;
    let data, settings;
    try { [data, settings] = await Promise.all([safeGet(ctx, ctx.role.memory_api, {limit:20}), safeGet(ctx, `${ctx.role.memory_api}/settings`)]); }
    catch (_) { root.innerHTML = `<div class="page-empty">记忆工作区暂时不可用</div>`; return; }
    const facts = factsOf(data); let selected = facts[0] || null, queryText = "";
    const settingsValues = settings?.values || settings?.settings || {};
    const editable = ctx.scope === "role" || ctx.scope === "object";
    const render = () => {
      root.innerHTML = pageStack(`${overview(data)}${card("事实与检索", `<div class="life-query"><input class="ui-input" data-memory-query placeholder="搜索事实、来源与经历" value="${esc(queryText)}"><select class="ui-select" data-memory-kind><option value="all">全部资料</option><option value="facts">事实</option><option value="sources">来源</option><option value="experiences">经历</option></select>${lifeButton("检索", "query")}${lifeButton("刷新", "refresh", {secondary:true})}</div><div class="life-two-pane"><div class="life-record-list">${facts.length ? facts.map(item => `<button type="button" class="life-record${item === selected ? " is-selected" : ""}" data-fact-id="${esc(item.atom_id)}"><strong>${esc(item.statement || item.text || "事实")}</strong><small>${esc(stateLabel(item.state || item.kind))}</small></button>`).join("") : `<p class="life-muted">暂无事实。</p>`}</div><div>${factDetail(selected)}</div></div>`) }<details class="console-card life-details"><summary class="card-title"><span>整理与维护</span></summary><div class="card-body"><div class="life-maintenance-grid">${lifeButton("查看整理批次", "reflections", {secondary:true})}${lifeButton("修复未完成项", "retry-reflection", {secondary:true})}${lifeButton("冷归档预览", "archive-preview", {secondary:true})}${lifeButton("移回归档", "archive-restore", {secondary:true})}${lifeButton("范围清理预览", "clear-preview", {danger:true})}${lifeButton("导出记忆包", "export", {secondary:true})}${lifeButton("导入记忆包", "import", {secondary:true})}</div><div class="life-subresult" data-memory-maintenance></div></div></details>${editable ? `${detailsCard("记忆策略", memoryFields, settingsValues, {meta:ctx.scope === "role" ? "角色默认" : "当前窗口覆盖", advanced:true})}${saveBar("memory", {disabled:true})}` : card("记忆策略", `<div class="life-readonly-grid">${memoryFields.map(field => `<span><b>${esc(field.label)}</b>${esc(valueOf(settingsValues, field.name, field.default ?? "—"))}</span>`).join("")}</div><div class="life-readonly-footer">${scopeNote(ctx, false)} ${link("去角色默认设置", "生活/记忆")}</div>`)}${notice()}`);
      if (editable) bindForm(root, editableMemoryFields, settingsValues, async changes => { const prefixed = Object.fromEntries(Object.entries(changes).map(([name, value]) => [`memory.${name}`, value])); await safePost(ctx, `${ctx.role.memory_api}/settings/command`, {...op("memory-settings"), expected_edit_token:settings?.edit_token || "", layer:ctx.scope === "role" ? "role" : "window", changes:prefixed}); }, "memory");
    };
    render();
    bindNavigation(root, ctx);
    root.addEventListener("click", async event => {
      const factId = event.target.closest("[data-fact-id]")?.dataset.factId;
      if (factId) { selected = facts.find(item => String(item.atom_id) === factId) || selected; render(); return; }
      const action = event.target.closest("[data-life-action]")?.dataset.lifeAction; if (!action) return;
      const [name, id] = action.split(":");
      if (name === "refresh") { data = await safeGet(ctx, ctx.role.memory_api, {limit:20}); render(); return; }
      if (name === "query") { queryText = root.querySelector("[data-memory-query]")?.value.trim() || ""; try { data = await safePost(ctx, `${ctx.role.memory_api}/query`, {query:queryText, kind:root.querySelector("[data-memory-kind]")?.value || "all"}); selected = factsOf(data)[0] || null; } catch (_) { root.querySelector("[data-life-notice]").textContent = "检索未完成。"; return; } render(); return; }
      if (["revisions","source"].includes(name)) { const item = facts.find(row => String(row.atom_id) === id) || selected; if (!item) return; try { const result = name === "revisions" ? await safeGet(ctx, `${ctx.role.memory_api}/revisions`, {atom_id:item.atom_id,limit:20}) : await safePost(ctx, `${ctx.role.memory_api}/source`, {session_id:item.session_id,handle:item.source_handle}); root.querySelector("[data-memory-maintenance]").textContent = name === "revisions" ? `版本历史：${result?.items?.length ?? 0} 个版本` : `来源片段：${result?.text || result?.content || "已读取"}`; } catch (_) { root.querySelector("[data-life-notice]").textContent = "读取详情未完成。"; } return; }
      if (["retract","forget","archive-preview","archive-restore","clear-preview","export","import"].includes(name) && ["retract","forget","archive-preview","archive-restore","clear-preview"].includes(name) && !await confirm(root, "确认即时操作", name === "clear-preview" ? "先读取范围清理预览，确认后才会遗忘全部有效事实。" : "确认执行这项记忆操作？")) return;
      try {
        if (["pin","unpin","correct","retract","forget"].includes(name)) {
          const item = facts.find(row => String(row.atom_id) === id) || selected; if (!item) return;
          let extra = {};
          if (name === "correct") extra = await editDialog(root, "更正事实", [{name:"value",label:"更正内容",type:"textarea"}], {value:item.value || item.statement || ""}, "保存") || null;
          if (name === "correct" && !extra) return;
          await safePost(ctx, `${ctx.role.memory_api}/command`, {atom_id:item.atom_id, action:name, expected_revision:item.revision, view_token:item.view_token, ...op(`memory-${name}`), ...(extra || {})});
          data = await safeGet(ctx, ctx.role.memory_api, {limit:20}); selected = factsOf(data).find(row => row.atom_id === item.atom_id) || factsOf(data)[0] || null; render(); return;
        }
        const output = root.querySelector("[data-memory-maintenance]");
        if (name === "reflections") { const result = await safeGet(ctx, `${ctx.role.memory_api}/reflections`, {history:"1",limit:20}); output.textContent = `整理批次：${result?.items?.length ?? 0}`; return; }
        if (name === "retry-reflection") { const result = await safeGet(ctx, `${ctx.role.memory_api}/reflections`, {limit:20}); const batch = result?.items?.find(item => item.retryable || item.resumable); if (batch) await safePost(ctx, `${ctx.role.memory_api}/reflections/retry`, {batch_id:batch.batch_id, ...op("memory-reflection-retry")}); output.textContent = batch ? "修复已提交" : "没有可修复的批次"; return; }
        if (name === "archive-preview") { const result = await safeGet(ctx, `${ctx.role.memory_api}/archive/preview`, {idle_days:180}); output.innerHTML = `可归档 ${result?.items?.length ?? result?.count ?? 0} 条 ${(result?.token || result?.expected_archive_token) ? lifeButton("确认归档", "archive-commit", {danger:true}) : ""}`; if (result?.token || result?.expected_archive_token) output.dataset.token = result.token || result.expected_archive_token; return; }
        if (name === "clear-preview") { const result = await safeGet(ctx, `${ctx.role.memory_api}/clear/preview`); output.innerHTML = `预计清理 ${result?.count ?? result?.items?.length ?? 0} 条 ${result?.token ? lifeButton("确认范围清理", "clear-commit", {danger:true}) : ""}`; if (result?.token) output.dataset.token = result.token; return; }
        if (name === "archive-restore") { const values = await editDialog(root, "移回归档", [{name:"atom_ids",label:"事实编号（逗号分隔）",type:"text"}], {}, "移回"); if (!values) return; await safePost(ctx, `${ctx.role.memory_api}/archive/restore`, {atom_ids:values.atom_ids.split(/[,，\s]+/).filter(Boolean),...op("memory-archive-restore")}); output.textContent = "移回已提交"; return; }
        if (name === "archive-commit") { if (!await confirm(root, "确认冷归档", "归档后仍可从归档区移回。")) return; await safePost(ctx, `${ctx.role.memory_api}/archive`, {token:output.dataset.token,idle_days:180,...op("memory-archive")}); output.textContent = "归档已提交"; return; }
        if (name === "clear-commit") { if (!await confirm(root, "确认范围清理", "这会逻辑遗忘当前范围全部有效事实。")) return; await safePost(ctx, `${ctx.role.memory_api}/clear`, {token:output.dataset.token,...op("memory-clear")}); output.textContent = "范围清理已提交"; return; }
        if (name === "export") { const result = await safeGet(ctx, `${ctx.role.memory_api}/export`, {include_archived:"true"}); output.textContent = `记忆包已生成，共 ${JSON.stringify(result).length} 字符`; return; }
        if (name === "import") { const value = await editDialog(root, "导入记忆包", [{name:"bundle",label:"记忆包（结构化数据）",type:"textarea"}], {bundle:"{}"}, "校验并导入"); if (!value) return; const preview = await safePost(ctx, `${ctx.role.memory_api}/import/preview`, {bundle:JSON.parse(value.bundle)}); if (!await confirm(root, "确认导入", `校验通过，预计导入 ${preview?.count ?? preview?.items?.length ?? 0} 条。`)) return; await safePost(ctx, `${ctx.role.memory_api}/import`, {bundle:JSON.parse(value.bundle), token:preview.token || preview.expected_import_token, ...op("memory-import")}); output.textContent = "导入已提交"; }
      } catch (_) { root.querySelector("[data-life-notice]").textContent = "操作未完成，请刷新核对当前记忆状态。"; }
    });
  }
};
export default page;
