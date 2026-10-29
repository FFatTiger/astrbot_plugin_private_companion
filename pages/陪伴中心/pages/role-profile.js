import * as ui from "../ui.js";

const LABELS = {
  name: "名字", species: "种族", birthday: "生日", age: "年龄", gender: "性别", occupation: "身份或职业",
  identity: "身份与经历", appearance_points: "外貌要点", hair: "头发", eyes: "眼睛", clothing: "衣着",
  image_identity_hint: "图像识别提示", appearance: "外貌特征", personality: "性格底色", first_person: "第一人称",
  speech_style: "说话方式", emotional_style: "情绪表达", social_distance: "社交距离", reaction_patterns: "反应模式",
  voice_examples: "口吻示例", signature_phrases: "标志表达", daily_habits: "日常习惯", key_lore: "关键经历",
  character_extra: "角色补充", motivations: "动机", core_values: "核心价值", desire: "愿望与目标",
  hobbies: "兴趣爱好", boundaries: "相处边界", taboos: "忌讳", world_name: "世界名称", era: "时代",
  tone: "世界基调", rules: "世界规则", scenes: "典型场景", network: "组织与关系", world_extra: "世界补充",
  world: "完整世界设定", main_companion_subject: "主要陪伴对象", expression_private_source_mode: "私聊表达来源",
  expression_private_source_subject_ids: "私聊表达来源对象", expression_private_application_mode: "私聊表达应用范围",
  expression_private_application_subject_ids: "私聊表达应用对象", avatar_data_url: "头像"
};
const CARDS = [
  ["身份与外貌", ["name", "species", "identity", "appearance_points", "appearance"], ["birthday", "age", "gender", "occupation", "hair", "eyes", "clothing", "image_identity_hint"]],
  ["性格与口吻", ["personality", "first_person", "speech_style", "emotional_style", "voice_examples"], ["social_distance", "reaction_patterns", "signature_phrases"]],
  ["动机、习惯与边界", ["motivations", "core_values", "desire", "hobbies", "boundaries"], ["daily_habits", "key_lore", "character_extra", "taboos"]],
  ["世界设定", ["world_name", "era", "tone", "rules", "world"], ["scenes", "network", "world_extra"]],
  ["表达学习范围", ["main_companion_subject", "expression_private_source_mode", "expression_private_application_mode"], ["expression_private_source_subject_ids", "expression_private_application_subject_ids"], true]
];
const LONG = new Set(["identity", "appearance_points", "appearance", "personality", "speech_style", "emotional_style", "social_distance", "reaction_patterns", "voice_examples", "daily_habits", "key_lore", "character_extra", "motivations", "core_values", "desire", "hobbies", "boundaries", "taboos", "rules", "scenes", "network", "world_extra", "world"]);
const MODES = {owner: "仅主要对象", selected: "指定对象", all: "所有私聊对象"};

function ensureStyle() {
  if (document.querySelector("link[data-role-style]")) return;
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = new URL("../pages/role.css", import.meta.url).href; link.dataset.roleStyle = ""; document.head.append(link);
}
function sectionData(data, name) { return data?.sections?.[name] || data?.[name] || {}; }
function settingsOf(data, name) { return sectionData(data, name).settings || {}; }
function control(name, value, disabled = false) {
  const label = LABELS[name] || name;
  if (name.endsWith("_mode")) return ui.select(name, value, MODES, {disabled, label});
  if (name.endsWith("_subject_ids")) return `<textarea class="ui-textarea" data-ui-field="${ui.esc(name)}" aria-label="${ui.esc(label)}"${disabled ? " disabled" : ""}>${ui.esc(value || "")}</textarea>`;
  if (name === "avatar_data_url") return `<div class="role-avatar-control"><div class="role-avatar-preview" data-avatar-preview>${value ? `<img src="${ui.esc(value)}" alt="角色头像">` : ""}</div><input class="ui-input" type="file" accept="image/jpeg" data-avatar-file aria-label="上传头像"${disabled ? " disabled" : ""}></div>`;
  if (LONG.has(name)) return `<textarea class="ui-textarea" data-ui-field="${ui.esc(name)}" aria-label="${ui.esc(label)}"${disabled ? " disabled" : ""}>${ui.esc(value || "")}</textarea>`;
  return ui.textField(name, value, {disabled, label, maxlength: 4200});
}
function rows(settings, names, disabled = false) {
  return names.filter(name => name !== "expression_private_source_subject_ids" || settings.expression_private_source_mode === "selected").filter(name => name !== "expression_private_application_subject_ids" || settings.expression_private_application_mode === "selected").map(name => ui.row(LABELS[name] || name, control(name, settings[name] ?? "", disabled), {name})).join("");
}
function more(settings, names) { const content = rows(settings, names); return content ? ui.more(content) : ""; }
function collapsedCard(title, content) { return ui.foldCard(title, content); }
function profileCard(title, settings, common, advanced, collapsed = false) { const content = `${rows(settings, common)}${more(settings, advanced)}`; return collapsed ? collapsedCard(title, content) : ui.card(title, content); }
function readConfig(ctx) { return ctx.api.get(ctx.role.config_api, {sections: "role_profile"}); }
function roleStatus(data) { return data?.sections?.role_profile || data?.role_profile || data || {}; }
function draftFields(entries) { return entries.map(([name, value]) => `<label class="role-draft-field"><input type="checkbox" data-draft-field="${ui.esc(name)}" checked><span>${ui.esc(LABELS[name] || name)}</span><textarea data-draft-value="${ui.esc(name)}" class="ui-textarea">${ui.esc(value || "")}</textarea></label>`).join(""); }

async function openDraftDialog(root, ctx, state) {
  if (!ctx.role?.persona_api) return;
  const dialog = document.createElement("dialog"); dialog.className = "role-dialog";
  dialog.innerHTML = `<form method="dialog" class="role-dialog-inner"><header><h2>从人格整理角色档案</h2><button value="cancel" class="role-dialog-close" aria-label="关闭">×</button></header><div class="role-dialog-body"><label class="role-form-label">来源人格<select data-draft-persona class="ui-select"></select></label><label class="role-form-label">补充已确认的角色设定<textarea class="ui-textarea" data-draft-supplement placeholder="补充当前人格没有写明的稳定设定"></textarea></label><button type="button" class="role-action" data-draft-generate>生成草稿</button><div data-draft-output></div></div></form>`;
  root.append(dialog); dialog.showModal();
  try {
    const data = await ctx.api.get(ctx.role.persona_api);
    const choices = data.personas || [];
    const select = dialog.querySelector("[data-draft-persona]");
    select.innerHTML = choices.map(item => `<option value="${ui.esc(item.value || item.persona_id || "")}">${ui.esc(item.label || item.name || item.value || "")}</option>`).join("");
    if (data.persona?.persona_id) select.value = data.persona.persona_id;
  } catch (_) { dialog.querySelector("[data-draft-persona]").innerHTML = "<option value=\"\">当前人格</option>"; }
  dialog.addEventListener("click", async event => {
    const button = event.target.closest("[data-draft-generate]"); if (!button) return;
    button.disabled = true; button.textContent = "生成中";
    try {
      const body = {persona_id: dialog.querySelector("[data-draft-persona]").value, supplement: dialog.querySelector("[data-draft-supplement]").value};
      const result = await ctx.api.post(`${ctx.role.persona_api}/profile-draft`, body);
      const fields = result.draft?.fields || {};
      const entries = Object.entries(fields); const common = draftFields(entries.slice(0, 6)); const advanced = draftFields(entries.slice(6));
      dialog.querySelector("[data-draft-output]").innerHTML = `<div class="role-dialog-result"><div class="role-dialog-result-head"><strong>草稿字段</strong><span>勾选后带回档案</span></div>${common}${advanced ? `<details class="role-more" data-more><summary>更多</summary><div class="role-more-body">${advanced}</div></details>` : ""}<button type="button" class="role-action" data-draft-apply>带回已勾选字段</button></div>`;
    } catch (error) { dialog.querySelector("[data-draft-output]").innerHTML = `<p class="role-inline-error">${ui.esc(error.message || "生成失败")}</p>`; }
    button.disabled = false; button.textContent = "重新生成";
  });
  dialog.addEventListener("click", event => {
    const button = event.target.closest("[data-draft-apply]"); if (!button) return;
    dialog.querySelectorAll("[data-draft-field]:checked").forEach(item => { const name = item.dataset.draftField; state.draft[name] = dialog.querySelector(`[data-draft-value="${CSS.escape(name)}"]`)?.value || ""; });
    dialog.close(); dialog.remove(); root._drawRoleProfile?.();
  });
  dialog.addEventListener("close", () => dialog.remove(), {once: true});
}

async function openMigrationDialog(root, ctx) {
  if (!ctx.role?.persona_api) return;
  const dialog = document.createElement("dialog"); dialog.className = "role-dialog";
  dialog.innerHTML = `<form method="dialog" class="role-dialog-inner"><header><h2>迁入已有设定</h2><button value="cancel" class="role-dialog-close" aria-label="关闭">×</button></header><div class="role-dialog-body"><label class="role-form-label">来源人格<select data-migration-persona class="ui-select"></select></label><button type="button" class="role-action" data-migration-plan>预览迁入</button><div data-migration-output></div></div></form>`;
  root.append(dialog); dialog.showModal();
  try { const data = await ctx.api.get(ctx.role.persona_api); const select = dialog.querySelector("[data-migration-persona]"); select.innerHTML = (data.personas || []).map(item => `<option value="${ui.esc(item.value || item.persona_id || "")}">${ui.esc(item.label || item.name || item.value || "")}</option>`).join(""); if (data.persona?.persona_id) select.value = data.persona.persona_id; } catch (_) {}
  dialog.addEventListener("click", async event => {
    const button = event.target.closest("[data-migration-plan]"); if (!button) return;
    button.disabled = true; button.textContent = "读取中";
    try {
      const personaId = dialog.querySelector("[data-migration-persona]").value;
      const plan = await ctx.api.post(`${ctx.role.persona_api}/profile-migration-plan`, {persona_id: personaId});
      const changes = plan.changes || {};
      dialog.querySelector("[data-migration-output]").innerHTML = `<div class="role-dialog-result"><p>可迁入 ${ui.esc(plan.counts?.to_import ?? Object.keys(changes).length)} 项；已存在的设定不会覆盖。</p>${Object.entries(changes).map(([name, value]) => `<div class="role-migration-row"><strong>${ui.esc(LABELS[name] || name)}</strong><span>${ui.esc(value)}</span></div>`).join("")}<button type="button" class="role-action" data-migration-apply>确认应用</button></div>`;
      dialog.querySelector("[data-migration-apply]").addEventListener("click", async () => {
        if (!await ui.confirm(root, "确认迁入角色档案", "确认把预览中的设定迁入角色档案？", {confirmLabel: "确认应用"})) return;
        const apply = dialog.querySelector("[data-migration-apply]"); apply.disabled = true;
        try { await ctx.api.post(`${ctx.role.persona_api}/profile-migration-apply`, {persona_id: personaId, plan_token: plan.plan_token, edit_token: plan.edit_token, changes}); dialog.close(); dialog.remove(); await root._refreshRoleProfile?.(); } catch (error) { apply.disabled = false; dialog.querySelector("[data-migration-output]").insertAdjacentHTML("beforeend", `<p class="role-inline-error">${ui.esc(error.message || "应用失败")}</p>`); }
      });
    } catch (error) { dialog.querySelector("[data-migration-output]").innerHTML = `<p class="role-inline-error">${ui.esc(error.message || "预览失败")}</p>`; }
    button.disabled = false; button.textContent = "重新预览";
  });
  dialog.addEventListener("close", () => dialog.remove(), {once: true});
}

async function drawProfile(root, ctx, previous) {
  const raw = previous || await readConfig(ctx); const section = roleStatus(raw); const settings = {...(section.settings || {})};
  const state = previous || {settings, draft: {...settings}, base: {...settings}, token: section.edit_token || "", saving: false};
  if (!previous) { state.settings = settings; state.draft = {...settings}; state.base = {...settings}; state.token = section.edit_token || ""; }
  const draw = () => {
    const canEdit = Boolean(ctx.role?.config_api);
    root.innerHTML = `<div class="page-stack role-page" data-role-profile>${canEdit ? `<div class="role-toolbar"><button type="button" class="role-action" data-open-draft${!ctx.role?.persona_api ? " disabled" : ""}>从人格整理</button><button type="button" class="role-action secondary" data-open-migration${!ctx.role?.persona_api ? " disabled" : ""}>迁入已有设定</button></div>${CARDS.map(([title, common, advanced, collapsed]) => profileCard(title, state.draft, common, advanced, collapsed)).join("")}${collapsedCard("头像", rows(state.draft, ["avatar_data_url"]))}${ui.saveBar("role-profile", {disabled: !Object.keys(state.draft).some(key => state.draft[key] !== state.base[key])})}` : ui.card("角色档案", `<div class="role-readonly">当前对象没有可编辑的角色档案。角色档案只在私聊角色默认范围维护。</div>`)}</div>`;
  };
  draw();
  root._drawRoleProfile = draw;
  root._refreshRoleProfile = async () => { const fresh = roleStatus(await readConfig(ctx)); state.settings = {...(fresh.settings || {})}; state.draft = {...state.settings}; state.base = {...state.settings}; state.token = fresh.edit_token || ""; draw(); };
  if (!ctx.role?.config_api) return;
  const mark = () => { const save = root.querySelector('[data-ui-save="role-profile"]'); const dirty = Object.keys(state.draft).some(key => state.draft[key] !== state.base[key]); if (save) save.disabled = !dirty; };
  root.addEventListener("input", event => { const field = event.target.closest("[data-ui-field]"); if (field) { state.draft[field.dataset.uiField] = field.value; mark(); } });
  root.addEventListener("change", event => {
    const field = event.target.closest("[data-ui-field]"); if (field) { state.draft[field.dataset.uiField] = field.value; if (field.dataset.uiField.endsWith("_mode")) draw(); mark(); return; }
    const file = event.target.closest("[data-avatar-file]"); if (!file?.files?.[0]) return;
    const reader = new FileReader(); reader.onload = () => { state.draft.avatar_data_url = String(reader.result || ""); const preview = root.querySelector("[data-avatar-preview]"); if (preview) preview.innerHTML = `<img src="${ui.esc(state.draft.avatar_data_url)}" alt="角色头像">`; mark(); }; reader.readAsDataURL(file.files[0]);
  });
  root.addEventListener("click", async event => {
    if (event.target.closest("[data-open-draft]")) return openDraftDialog(root, ctx, state);
    if (event.target.closest("[data-open-migration]")) return openMigrationDialog(root, ctx);
    const save = event.target.closest('[data-ui-save="role-profile"]'); if (!save || save.disabled || state.saving) return;
    const changes = Object.fromEntries(Object.keys(state.draft).filter(key => state.draft[key] !== state.base[key]).map(key => [key, state.draft[key]]));
    if (!Object.keys(changes).length) return;
    state.saving = true; save.disabled = true; ui.setSaveState(root, "role-profile", "保存中");
    try { await ctx.api.post(`${ctx.role.config_api}/configure`, {section: "role_profile", operation_key: ctx.api.operationKey("role-profile"), edit_token: state.token, changes}); ui.setSaveState(root, "role-profile", "已保存", "ok"); await root._refreshRoleProfile?.(); } catch (error) { state.saving = false; save.disabled = false; ui.setSaveState(root, "role-profile", error.message || "保存失败", "error"); }
  });
}

const page = {id: "role-profile", section: "角色", title: "角色档案", async render(root, ctx) { ensureStyle(); if (!ctx.role?.config_api) { root.innerHTML = `<div class="page-stack role-page">${ui.card("角色档案", `<div class="role-readonly">当前对象没有可编辑的角色档案。角色档案只在私聊角色默认范围维护。</div>`)}</div>`; return; } await drawProfile(root, ctx, null); }};
export default page;
