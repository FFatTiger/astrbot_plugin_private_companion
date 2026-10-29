import * as ui from "../ui.js";

const QUESTIONS = {identity: "姓名、身份、经历、种族、年龄", appearance: "外貌、衣着、标志特征", personality: "性格底色、优缺点、反差", values: "价值观、目标、动机、在意的事", relationships: "对陌生人、朋友、亲近之人的态度变化", speech: "说话方式、语气、常用表达、情绪表达", habits: "日常习惯、兴趣、擅长的事", boundaries: "相处边界、忌讳、压力下的反应", world: "世界观、时代、地点、组织与关键规则", supplement: "其他补充"};
const SECTIONS = {identity: "基本信息", appearance: "外貌特征", world: "世界设定", personality: "性格特质", motivations: "价值、目标与关系", habits: "表达习惯与日常", boundaries: "社交距离与边界", supplement: "长期补充条件"};
const SCENES = {everyday: "日常往来", comfort: "低落时刻", closeness: "关系靠近", boundary: "表达边界", misunderstanding: "发生误解", praise: "收到夸奖"};

function ensureStyle() { if (!document.querySelector("link[data-role-style]")) { const link = document.createElement("link"); link.rel = "stylesheet"; link.href = new URL("../pages/role.css", import.meta.url).href; link.dataset.roleStyle = ""; document.head.append(link); } }
function textarea(name, value, label, options = {}) { return `<textarea class="ui-textarea role-workshop-textarea" data-persona-field="${ui.esc(name)}" aria-label="${ui.esc(label)}"${options.readonly ? " readonly" : ""}>${ui.esc(value || "")}</textarea>`; }
function personaId(state) { return state.persona?.persona_id || state.selectedPersona || ""; }
function selectedText(state) { return Object.entries(state.selectedReplies).map(([sceneId, index]) => { const row = state.tryouts.find(item => item.id === sceneId); const option = row?.options?.[Number(index)]; return option?.text ? {scene_id: sceneId, text: option.text} : null; }).filter(Boolean); }
function mergeStyle(text, style, examples) {
  if (!style && !examples) return text;
  let result = String(text || "");
  const styleHeading = "## 对话风格";
  if (result.includes(styleHeading)) result = result.replace(/## 对话风格[\s\S]*?(?=\n## |<\/Output_Constraints>)/, `${styleHeading}\n${style || ""}${examples ? `\n\n## 口吻示例与标志表达\n${examples}` : ""}\n`);
  else result += `\n\n${styleHeading}\n${style}${examples ? `\n\n## 口吻示例与标志表达\n${examples}` : ""}`;
  return result;
}

async function load(ctx, state) {
  const data = await ctx.api.get(ctx.role.persona_api, {limit: 30, ...(state.selectedPersona ? {persona_id: state.selectedPersona} : {})});
  state.data = data; state.persona = data.persona || {}; state.personas = data.personas || []; state.versions = data.versions || []; state.current = data.current || null; state.selectedPersona = state.persona.persona_id || state.selectedPersona || ""; state.originalText = state.persona.text || ""; state.expectedCurrent = state.current?.version_id || "";
}
function choices(state) { return state.personas.map(item => `<option value="${ui.esc(item.value || item.persona_id || "")}"${(item.value || item.persona_id) === state.selectedPersona ? " selected" : ""}>${ui.esc(item.label || item.name || item.value || item.persona_id || "")}</option>`).join(""); }
function questionnaire(state, names) { return names.map(key => ui.row(QUESTIONS[key], textarea(`answer:${key}`, state.answers[key], QUESTIONS[key]))).join(""); }
function more(content) { return content ? ui.more(content) : ""; }
function collapsedCard(title, content) { return ui.foldCard(title, content); }
function draftSections(state) { const sections = state.draft?.sections || {}; return Object.entries(SECTIONS).map(([key, label]) => ui.row(label, textarea(`section:${key}`, sections[key], label, {readonly: true}))).join(""); }
function tryoutMarkup(state) {
  if (!state.tryouts.length) return `<div class="role-muted">先生成基础稿，再生成六个固定情景的试答。</div>`;
  return state.tryouts.map(scene => `<article class="role-tryout"><header><strong>${ui.esc(scene.title || SCENES[scene.id] || scene.id)}</strong><span>${ui.esc(scene.context || "")}</span></header><p>${ui.esc(scene.message || "")}</p><div class="role-options">${(scene.options || []).map((option, index) => `<label><input type="radio" name="tryout-${ui.esc(scene.id)}" data-tryout="${ui.esc(scene.id)}" value="${index}"${String(state.selectedReplies[scene.id]) === String(index) ? " checked" : ""}><span>${ui.esc(option.text || "")}</span>${option.tag ? `<small>${ui.esc(option.tag)}</small>` : ""}</label>`).join("")}</div></article>`).join("");
}
function draw(root, ctx, state) {
  const resolved = Boolean(state.persona?.resolved);
  const draft = state.draft || {};
  root.innerHTML = `<div class="page-stack role-page role-workshop">
    ${ui.card("01 问卷与来源", `<div class="role-workshop-toolbar"><label class="role-form-label">来源人格<select class="ui-select" data-persona-select>${choices(state)}</select></label><button type="button" class="role-action secondary" data-persona-refresh>重新读取</button></div><div class="role-source-tabs"><label><input type="radio" name="source-mode" value="current"${state.sourceMode === "current" ? " checked" : ""}>当前人格</label><label><input type="radio" name="source-mode" value="paste"${state.sourceMode === "paste" ? " checked" : ""}>粘贴材料</label></div>${state.sourceMode === "paste" ? textarea("source-text", state.sourceText, "人格来源材料") : `<pre class="role-source-preview">${ui.esc(state.persona?.text || "当前人格为空")}</pre>`}${ui.row("整理强度", ui.segmented("strength", state.strength, {light: "轻度", medium: "中度", deep: "深度"}))}${ui.row("参考材料", textarea("reference-material", state.referenceMaterial, "参考材料"))}${more(questionnaire(state, Object.keys(QUESTIONS)))}<div class="role-action-row"><button type="button" class="role-action" data-standardize${!resolved ? " disabled" : ""}>生成基础稿</button><span class="role-muted">${resolved ? "基于当前人格和问卷生成可审核草稿" : "当前人格不可用"}</span></div>`) }
    ${ui.card("02 基础稿审核", draft.text ? `<div class="role-draft-note">${(draft.notes || []).map(note => `<span>${ui.esc(note)}</span>`).join("")}</div>${ui.row("基础稿正文", textarea("draft-text", draft.text, "基础稿正文"))}${more(draftSections(state))}<div class="role-action-row"><button type="button" class="role-action" data-tryouts${!draft.text ? " disabled" : ""}>生成情景试答</button></div>` : `<div class="role-muted">完成问卷后生成基础稿。</div>`) }
    ${collapsedCard("03 情景试答", `${tryoutMarkup(state)}<div class="role-action-row"><button type="button" class="role-action" data-style${!draft.text || !state.tryouts.length ? " disabled" : ""}>根据已选试答生成风格规则</button></div>`) }
    ${collapsedCard("04 风格规则", state.style ? `${ui.row("对话风格", textarea("style-text", state.style.text, "对话风格"))}${ui.row("口吻示例", textarea("style-examples", state.style.examples, "口吻示例"))}${ui.row("表达偏好", textarea("speech-preference", state.speechPreference, "表达偏好"))}${ui.row("约束偏好", textarea("constraint-preference", state.constraintPreference, "约束偏好"))}` : `<div class="role-muted">生成情景试答后，从中选择内容再整理风格。</div>`) }
    ${ui.card("05 对照与落地", `<div class="role-compare"><div><h3>初始人格</h3><pre class="role-source-preview">${ui.esc(state.originalText || "（空）")}</pre></div><div><h3>标准化版本</h3><pre class="role-source-preview" data-compare-draft>${ui.esc(draft.text || "（尚未生成）")}</pre></div></div>${ui.row("版本备注", ui.textField("version-note", state.note, {label: "版本备注", placeholder: "保存时必填"}))}<div class="role-action-row"><button type="button" class="role-action" data-save-version${!draft.text ? " disabled" : ""}>保存当前版本</button></div>`) }
    <details class="console-card role-collapsed-card" data-more><summary class="card-title"><span>版本列表与恢复</span><span class="more-chevron">⌄</span></summary><div class="card-body"><div class="role-versions">${state.versions.length ? state.versions.map(version => `<article class="role-version"><div><strong>${version.kind === "restore" ? "恢复" : "草稿"} · 第 ${ui.esc(version.sequence)} 版</strong><span>${ui.esc(version.note || "无备注")}</span></div><button type="button" class="role-action secondary" data-restore="${ui.esc(version.version_id)}"${version.version_id === state.expectedCurrent ? " disabled" : ""}>恢复到右侧</button></article>`).join("") : `<div class="role-muted">暂无保存版本。</div>`}</div></div></details>
  </div>`;
}

const page = {id: "persona-workshop", section: "角色", title: "人格整理", async render(root, ctx) {
  ensureStyle(); if (!ctx.role?.persona_api) { root.innerHTML = `<div class="page-stack role-page">${ui.card("人格整理", `<div class="role-readonly">人格整理只对私聊角色开放。当前对象没有人格接口。</div>`)}</div>`; return; }
  const state = {selectedPersona: "", persona: {}, personas: [], versions: [], current: null, originalText: "", expectedCurrent: "", answers: {}, sourceMode: "current", sourceText: "", referenceMaterial: "", strength: "medium", draft: null, tryouts: [], selectedReplies: {}, style: null, styleText: "", styleExamples: "", speechPreference: "", constraintPreference: "", note: "", busy: false};
  await load(ctx, state); draw(root, ctx, state);
  const rerender = () => draw(root, ctx, state);
  root.addEventListener("input", event => {
    const uiField = event.target.closest("[data-ui-field]");
    if (uiField) { if (uiField.dataset.uiField === "version-note") state.note = uiField.value; return; }
    const field = event.target.closest("[data-persona-field]"); if (!field) return;
    const name = field.dataset.personaField;
    if (name.startsWith("answer:")) state.answers[name.slice(7)] = field.value;
    else if (name === "source-text") state.sourceText = field.value;
    else if (name === "reference-material") state.referenceMaterial = field.value;
    else if (name === "draft-text") { state.draft = {...state.draft, text: field.value}; const compare = root.querySelector("[data-compare-draft]"); if (compare) compare.textContent = field.value; }
    else if (name === "style-text") { state.style = {...state.style, text: field.value}; state.styleText = field.value; }
    else if (name === "style-examples") { state.style = {...state.style, examples: field.value}; state.styleExamples = field.value; }
    else if (name === "speech-preference") state.speechPreference = field.value;
    else if (name === "constraint-preference") state.constraintPreference = field.value;
  });
  root.addEventListener("change", async event => {
    const select = event.target.closest("[data-persona-select]"); if (select) { state.selectedPersona = select.value; state.draft = null; state.tryouts = []; await load(ctx, state); draw(root, ctx, state); return; }
    const mode = event.target.closest('input[name="source-mode"]'); if (mode) { state.sourceMode = mode.value; rerender(); return; }
    const strength = event.target.closest('[data-ui-segment="light"], [data-ui-segment="medium"], [data-ui-segment="deep"]'); if (strength) { state.strength = strength.dataset.uiSegment; rerender(); return; }
    const tryout = event.target.closest("[data-tryout]"); if (tryout) state.selectedReplies[tryout.dataset.tryout] = tryout.value;
    const field = event.target.closest('[data-persona-field="version-note"]'); if (field) state.note = field.value;
  });
  root.addEventListener("click", async event => {
    const segment = event.target.closest("[data-ui-segment]");
    if (segment) { state.strength = segment.dataset.uiSegment; rerender(); return; }
    const refresh = event.target.closest("[data-persona-refresh]"); if (refresh) { await load(ctx, state); rerender(); return; }
    const standardize = event.target.closest("[data-standardize]");
    if (standardize && !state.busy) {
      state.busy = true; standardize.disabled = true;
      try { const body = {persona_id: personaId(state), answers: state.answers, strength: state.strength, source_mode: state.sourceMode, reference_material: state.referenceMaterial}; if (state.sourceMode === "paste") body.source_text = state.sourceText; const result = await ctx.api.post(`${ctx.role.persona_api}/standardize`, body); state.draft = result.draft || null; state.tryouts = []; state.selectedReplies = {}; state.style = null; rerender(); } catch (error) { window.alert(error.message || "标准化失败"); } finally { state.busy = false; } return;
    }
    const tryouts = event.target.closest("[data-tryouts]");
    if (tryouts && !state.busy) {
      state.busy = true; tryouts.disabled = true;
      try { const result = await ctx.api.post(`${ctx.role.persona_api}/tryouts`, {persona_id: personaId(state), draft_text: state.draft?.text || "", variation: 0}); state.tryouts = result.scenarios || []; state.selectedReplies = {}; rerender(); } catch (error) { window.alert(error.message || "试答生成失败"); } finally { state.busy = false; } return;
    }
    const style = event.target.closest("[data-style]");
    if (style && !state.busy) {
      state.busy = true; style.disabled = true;
      try { const result = await ctx.api.post(`${ctx.role.persona_api}/style-rules`, {persona_id: personaId(state), draft_text: state.draft?.text || "", selections: selectedText(state), reference_material: state.referenceMaterial, speech_preference: state.speechPreference, constraint_preference: state.constraintPreference}); state.style = result.style || null; state.styleText = state.style?.text || ""; state.styleExamples = state.style?.examples || ""; rerender(); } catch (error) { window.alert(error.message || "风格规则生成失败"); } finally { state.busy = false; } return;
    }
    const save = event.target.closest("[data-save-version]");
    if (save && !state.busy) {
      const note = state.note.trim(); if (!note) { window.alert("版本备注不能为空"); return; }
      const text = mergeStyle(state.draft?.text || "", state.style?.text || state.styleText, state.style?.examples || state.styleExamples);
      state.busy = true; save.disabled = true;
      try { await ctx.api.post(`${ctx.role.persona_api}/command`, {action: "save", persona_id: personaId(state), text, original_text: state.originalText, note, expected_current: state.expectedCurrent}); state.note = ""; await load(ctx, state); state.draft = {text}; rerender(); } catch (error) { window.alert(error.message || "保存失败"); } finally { state.busy = false; } return;
    }
    const restore = event.target.closest("[data-restore]");
    if (restore && !state.busy) {
      const version = state.versions.find(item => item.version_id === restore.dataset.restore); if (!version || !window.confirm("确认恢复这份人格版本？恢复会追加一条新版本记录。")) return;
      state.busy = true; restore.disabled = true;
      try { const result = await ctx.api.post(`${ctx.role.persona_api}/command`, {action: "restore", persona_id: personaId(state), version_id: version.version_id, note: `恢复到第 ${version.sequence} 版`, expected_current: state.expectedCurrent}); await load(ctx, state); state.draft = {text: result.version?.draft_text || version.draft_text}; rerender(); } catch (error) { window.alert(error.message || "恢复失败"); } finally { state.busy = false; } return;
    }
  });
}};
export default page;
