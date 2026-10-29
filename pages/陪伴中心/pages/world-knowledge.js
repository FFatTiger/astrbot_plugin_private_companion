import * as ui from "../ui.js";

const LABELS = {import_enabled: "启用导入", import_paths: "导入路径", source_ids: "知识来源", entry_limit: "来源条目上限", entry_char_limit: "单条内容上限", source_limit: "最多来源数", candidate_char_budget: "候选内容预算", inject_enabled: "启用注入", inject_max_entries: "每轮最多条目", inject_max_chars: "每轮最多字数", member_recognition_enabled: "启用群成员识别", member_match_aliases: "匹配成员别名", member_inject_limit: "成员线索最多条目", member_clue_chars: "成员线索字数上限"};
const BOOLS = new Set(["import_enabled", "inject_enabled", "member_recognition_enabled", "member_match_aliases"]);
function ensureStyle() { if (!document.querySelector("link[data-role-style]")) { const link = document.createElement("link"); link.rel = "stylesheet"; link.href = new URL("../pages/role.css", import.meta.url).href; link.dataset.roleStyle = ""; document.head.append(link); } }
function sectionOf(data) { return data?.sections?.knowledge || data?.knowledge || data || {}; }
function control(name, value) {
  if (BOOLS.has(name)) return ui.toggle(name, Boolean(value), {label: LABELS[name]});
  if (name === "import_paths" || name === "source_ids") return `<textarea class="ui-textarea" data-knowledge-field="${ui.esc(name)}" aria-label="${ui.esc(LABELS[name])}">${ui.esc(value || "")}</textarea>`;
  return ui.numberField(name, value ?? 0, "", {min: name === "candidate_char_budget" ? 2000 : 1, max: name === "candidate_char_budget" ? 200000 : 5000, label: LABELS[name]});
}
const IMPORT_CHILDREN = new Set(["import_paths", "source_ids", "entry_limit", "entry_char_limit", "source_limit", "candidate_char_budget"]);
const INJECT_CHILDREN = new Set(["inject_max_entries", "inject_max_chars"]);
const MEMBER_CHILDREN = new Set(["member_match_aliases", "member_inject_limit", "member_clue_chars"]);
function rows(settings, names) { return names.filter(name => (settings.import_enabled || !IMPORT_CHILDREN.has(name)) && (settings.inject_enabled || !INJECT_CHILDREN.has(name)) && (settings.member_recognition_enabled || !MEMBER_CHILDREN.has(name))).map(name => ui.row(LABELS[name], control(name, settings[name]), {name})).join(""); }
function more(settings, names, extra = "") { const content = rows(settings, names) + extra; return content ? ui.more(content) : ""; }
function knowledgeCard(title, settings, common, advanced, extra = "") { return ui.card(title, `${rows(settings, common)}${more(settings, advanced, extra)}`); }
function collapsedCard(title, content) { return ui.foldCard(title, content); }
function sourceMarkup(section, settings) {
  if (!settings.import_enabled) return "";
  const sources = Array.isArray(section.knowledge_sources) ? section.knowledge_sources : [];
  if (!sources.length) return `<div class="role-muted">暂无可选知识来源。</div>`;
  return `<div class="role-source-list">${sources.map(source => `<button type="button" class="role-source-chip" data-source-id="${ui.esc(source.id || "")}">${ui.esc(source.name || source.id || "未命名来源")}</button>`).join("")}<small>点击来源加入知识来源</small></div>`;
}
async function renderKnowledge(root, ctx) {
  const raw = await ctx.api.get(ctx.role.config_api, {sections: "knowledge"}); const section = sectionOf(raw); const state = {settings: {...(section.settings || {})}, base: {...(section.settings || {})}, token: section.edit_token || ""};
  const draw = () => { const memberSummary = `${ui.row("启用群成员识别", ui.toggle("member_recognition_enabled", Boolean(state.settings.member_recognition_enabled), {disabled: true, label: "启用群成员识别"}))}${state.settings.member_recognition_enabled ? ui.row("成员别名匹配", `<span class="role-readonly-value">${state.settings.member_match_aliases ? "已启用" : "未启用"}</span>`) : ""}<div class="role-setting-link">${ui.link("去联系人 › 群详情设置", "#/联系人/群详情")}</div>`; root.innerHTML = `<div class="page-stack role-page role-knowledge">${knowledgeCard("导入与来源", state.settings, ["import_enabled"], ["import_paths", "source_ids", "entry_limit", "entry_char_limit", "source_limit", "candidate_char_budget"], sourceMarkup(section, state.settings))}${knowledgeCard("注入策略", state.settings, ["inject_enabled"], ["inject_max_entries", "inject_max_chars"])}${collapsedCard("群成员线索", memberSummary)}${ui.saveBar("knowledge", {disabled: true})}</div>`; };
  draw();
  const refresh = async () => { const fresh = sectionOf(await ctx.api.get(ctx.role.config_api, {sections: "knowledge"})); state.settings = {...(fresh.settings || {})}; state.base = {...state.settings}; state.token = fresh.edit_token || ""; draw(); };
  const mark = () => { const save = root.querySelector('[data-ui-save="knowledge"]'); if (save) save.disabled = !Object.keys(state.settings).some(key => state.settings[key] !== state.base[key]); };
  root.addEventListener("input", event => { const field = event.target.closest("[data-knowledge-field]"); const numeric = event.target.closest("[data-ui-field]"); if (field) state.settings[field.dataset.knowledgeField] = field.value; else if (numeric) state.settings[numeric.dataset.uiField] = Number(numeric.value) || 0; else return; mark(); });
  root.addEventListener("click", async event => {
    const source = event.target.closest("[data-source-id]"); if (source) { const ids = String(state.settings.source_ids || "").split(/[\n,，;；]+/).map(item => item.trim()).filter(Boolean); if (!ids.includes(source.dataset.sourceId)) ids.push(source.dataset.sourceId); state.settings.source_ids = ids.join("\n"); const textareaNode = root.querySelector('[data-knowledge-field="source_ids"]'); if (textareaNode) textareaNode.value = state.settings.source_ids; mark(); return; }
    const toggle = event.target.closest("[data-ui-toggle]"); if (toggle) { const name = toggle.dataset.uiToggle; const value = toggle.getAttribute("aria-checked") !== "true"; state.settings[name] = value; draw(); mark(); return; }
    const save = event.target.closest('[data-ui-save="knowledge"]'); if (!save || save.disabled) return;
    const changes = Object.fromEntries(Object.keys(state.settings).filter(key => state.settings[key] !== state.base[key]).map(key => [key, state.settings[key]])); save.disabled = true; ui.setSaveState(root, "knowledge", "保存中");
    try { await ctx.api.post(`${ctx.role.config_api}/configure`, {section: "knowledge", operation_key: ctx.api.operationKey("knowledge"), edit_token: state.token, changes}); ui.setSaveState(root, "knowledge", "已保存", "ok"); await refresh(); } catch (error) { save.disabled = false; ui.setSaveState(root, "knowledge", error.message || "保存失败", "error"); }
  });
  root.addEventListener("change", event => { const field = event.target.closest("[data-ui-field]"); if (!field) return; const value = field.type === "number" ? Number(field.value) : field.value; state.settings[field.dataset.uiField] = Number.isFinite(value) ? value : 0; mark(); });
}
const page = {id: "role-knowledge", section: "角色", title: "世界知识", async render(root, ctx) { ensureStyle(); if (!ctx.role?.config_api) { root.innerHTML = `<div class="page-stack role-page">${ui.card("世界知识", `<div class="role-readonly">当前对象没有可编辑的世界知识配置。角色默认知识只在私聊范围维护。</div>`)}</div>`; return; } await renderKnowledge(root, ctx); }};
export default page;
