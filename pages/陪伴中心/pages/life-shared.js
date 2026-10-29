import {card, row, toggle, textField, numberField, select, tagInput, saveBar, setSaveState, readTags, esc, link, more as sharedMore, confirm as sharedConfirm, statusBadge, actionButton, listDetail, labelOf, booleanText, stateText} from "../ui.js";
export {esc};

export function ensureStyles() {
  const href = new URL("./life.css", import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`)) {
    const node = document.createElement("link"); node.rel = "stylesheet"; node.href = href; document.head.appendChild(node);
  }
}

export const valueOf = (source, name, fallback = "") => {
  const value = source?.[name];
  return value === undefined || value === null ? fallback : value;
};
export const responseData = value => value?.data && !value?.status ? value.data : value;
export const sectionData = (value, name) => responseData(value)?.sections?.[name] || responseData(value) || {};
export const pathFor = (role, name) => role?.[name] || "";
export const roleOnly = (ctx, key) => ctx.scope === "role" ? key : `${key}（当前对象覆盖）`;
export const targetIsPrivate = ctx => ctx.target?.scope_kind === "private";
export const commandKey = name => `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const op = name => ({operation_key: commandKey(name)});
export const text = value => String(value ?? "");

export function fieldControl(spec, value, disabled = false) {
  const name = spec.name, domName = spec.domName || name, label = spec.label || name;
  if (spec.type === "bool") return toggle(domName, Boolean(value), {disabled, label});
  if (spec.type === "number") return numberField(domName, value, spec.unit || "", {disabled, min: spec.min, max: spec.max, step: spec.step || 1, label});
  if (spec.type === "select") return select(domName, value, spec.choices || {}, {disabled, label});
  if (spec.type === "tags") return tagInput(domName, value, {disabled, label, placeholder: spec.placeholder});
  if (spec.type === "textarea") return `<textarea class="ui-textarea" data-ui-field="${esc(domName)}" aria-label="${esc(label)}"${disabled ? " disabled" : ""}>${esc(value)}</textarea>`;
  if (spec.type === "readonly") return `<span class="life-readonly" data-ui-value="${esc(domName)}">${esc(typeof value === "boolean" ? booleanText(value) : value || "—")}</span>`;
  return textField(domName, value, {disabled, type: spec.type || "text", label, placeholder: spec.placeholder, maxlength: spec.maxlength});
}

export function formRows(fields, values, unavailable = new Set()) {
  return fields.map(spec => row(spec.label || spec.name, fieldControl(spec, valueOf(values, spec.valueKey || spec.name, spec.default ?? ""), unavailable.has(spec.name)), {name: spec.domName || spec.name})).join("");
}
export function readonlyRows(fields, values, commonCount = 6) {
  const render = list => list.map(spec => { const value = valueOf(values, spec.valueKey || spec.name, spec.default ?? "—"); return `<span><b>${esc(spec.label || spec.name)}</b>${esc(typeof value === "boolean" ? booleanText(value) : stateText(value))}</span>`; }).join("");
  const common = fields.slice(0, commonCount), more = fields.slice(commonCount);
  return `<div class="life-readonly-grid">${render(common)}</div>${more.length ? sharedMore(`<div class="life-readonly-grid">${render(more)}</div>`) : ""}`;
}
export function detailsCard(title, fields, values, options = {}) {
  const common = options.commonNames ? fields.filter(field => options.commonNames.includes(field.name)).slice(0, 6) : fields.slice(0, options.commonCount || 6);
  const commonSet = new Set(common);
  const more = fields.filter(field => !commonSet.has(field));
  const content = formRows(common, values, options.unavailable || new Set());
  const extra = more.length ? sharedMore(formRows(more, values, options.unavailable || new Set())) : "";
  const heading = `<span>${esc(title)}</span>`;
  return options.advanced ? `<details class="console-card life-details"${options.open ? " open" : ""}><summary class="card-title">${heading}</summary><div class="card-body">${content}${extra}</div></details>` : `<section class="console-card life-details"><header class="card-title">${heading}</header><div class="card-body">${content}${extra}</div></section>`;
}
export function lifeButton(label, action, options = {}) {
  const cls = options.danger ? " life-button danger" : options.secondary ? " life-button secondary" : " life-button";
  return `<button type="button" class="${cls.trim()}" data-life-action="${esc(action)}"${options.disabled ? " disabled" : ""}>${esc(label)}</button>`;
}
export function notice(textValue = "", tone = "") {
  return `<div class="life-notice${tone ? ` is-${tone}` : ""}" data-life-notice role="status" aria-live="polite">${esc(textValue)}</div>`;
}
export function empty(title, message = "") {
  return `<div class="life-empty"><strong>${esc(title)}</strong>${message ? `<span>${esc(message)}</span>` : ""}</div>`;
}
export function actions(actions = []) { return `<div class="life-actions">${actions.join("")}</div>`; }
export function itemTitle(item, fallback = "未命名记录") { return item?.title || item?.name || item?.statement || fallback; }
export function dateText(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString("zh-CN", {dateStyle: "medium", timeStyle: "short"}); }
export function stateLabel(value) { return labelOf(value) || "待核对"; }
export function makeDialog(root, title, body, submitLabel = "确认") {
  const dialog = document.createElement("dialog"); dialog.className = "life-dialog";
  dialog.innerHTML = `<form method="dialog"><header><h2>${esc(title)}</h2><button value="cancel" aria-label="关闭">×</button></header><div class="life-dialog-body">${body}</div><footer><button value="cancel" class="life-button secondary">取消</button><button value="confirm" class="life-button">${esc(submitLabel)}</button></footer></form>`;
  root.appendChild(dialog); return dialog;
}
export function confirm(root, title, message) { return sharedConfirm(root, title, message); }
export function editDialog(root, title, fields, initial = {}, submitLabel = "保存") {
  return new Promise(resolve => {
    const body = fields.map(spec => `<label class="life-dialog-field"><span>${esc(spec.label || spec.name)}</span>${fieldControl(spec, valueOf(initial, spec.name, spec.default ?? ""))}</label>`).join("");
    const dialog = makeDialog(root, title, body, submitLabel);
    dialog.addEventListener("close", () => {
      if (dialog.returnValue !== "confirm") { dialog.remove(); resolve(null); return; }
      const result = {};
      fields.forEach(spec => { result[spec.name] = readField(dialog, spec); });
      dialog.remove(); resolve(result);
    }, {once: true});
    dialog.showModal();
  });
}
export function readField(root, spec) {
  const domName = spec.domName || spec.name;
  if (spec.type === "bool") return root.querySelector(`[data-ui-toggle="${CSS.escape(domName)}"]`)?.getAttribute("aria-checked") === "true";
  if (spec.type === "tags") return readTags(root, domName);
  const node = root.querySelector(`[data-ui-field="${CSS.escape(domName)}"]`);
  if (!node) return "";
  if (spec.type === "number") return Number(node.value || 0);
  return node.value;
}
export function readFields(root, fields, base = {}) {
  return Object.fromEntries(fields.map(spec => [spec.name, readField(root, spec)]));
}
export function changedValues(root, fields, base = {}) {
  const values = readFields(root, fields, base);
  return {values, changes: Object.fromEntries(Object.entries(values).filter(([name, value]) => JSON.stringify(value) !== JSON.stringify(base?.[name])))};
}
export function applyDependencies(root, rules) {
  const update = () => rules.forEach(rule => {
    const parent = root.querySelector(`[data-ui-field="${CSS.escape(rule.parent)}"]`) || root.querySelector(`[data-ui-toggle="${CSS.escape(rule.parent)}"]`);
    const value = parent?.matches("[data-ui-toggle]") ? parent.getAttribute("aria-checked") === "true" : parent?.value;
    const visible = typeof rule.test === "function" ? rule.test(value, root) : rule.value === undefined ? Boolean(value) : String(value) === String(rule.value);
    const target = root.querySelector(`[data-ui-row="${CSS.escape(rule.child)}"]`) || root.querySelector(`[data-ui-field="${CSS.escape(rule.child)}"]`)?.closest(".life-dialog-field") || (rule.child === "proactive_hour_activity_curve" ? root.querySelector(`[data-curve-editor]`) : null);
    if (target) target.hidden = !visible;
  });
  update(); root.addEventListener("input", update); root.addEventListener("change", update); root.addEventListener("click", event => { if (event.target.closest("[data-ui-toggle]")) update(); });
  return update;
}
export function bindForm(root, fields, base, onSave, name = "life") {
  let draft = {...base};
  const update = () => {
    const result = changedValues(root, fields, base); draft = {...base, ...result.values};
    const button = root.querySelector(`[data-ui-save="${CSS.escape(name)}"]`); if (button) button.disabled = !Object.keys(result.changes).length;
    if (Object.keys(result.changes).length) setSaveState(root, name, "");
  };
  root.addEventListener("input", event => { if (event.target.closest("[data-ui-field]")) update(); });
  root.addEventListener("change", event => { if (event.target.closest("[data-ui-field]")) update(); });
  root.addEventListener("click", event => {
    const toggleNode = event.target.closest("[data-ui-toggle]");
    if (toggleNode && !toggleNode.disabled) { const checked = toggleNode.getAttribute("aria-checked") !== "true"; toggleNode.setAttribute("aria-checked", String(checked)); toggleNode.classList.toggle("is-on", checked); update(); }
    const save = event.target.closest(`[data-ui-save="${CSS.escape(name)}"]`);
    if (save && !save.disabled && !save.dataset.busy) { const result = changedValues(root, fields, base); save.dataset.busy = "1"; save.disabled = true; setSaveState(root, name, "保存中"); Promise.resolve(onSave(result.changes)).then(() => setSaveState(root, name, "已保存", "ok"), () => { save.disabled = false; setSaveState(root, name, "保存失败", "error"); }).finally(() => { delete save.dataset.busy; }); }
  });
  return {get draft() { return draft; }};
}
export async function safeGet(ctx, path, query) { return ctx.api.get(path, query); }
export async function safePost(ctx, path, body) { return ctx.api.post(path, body); }
export function configPath(role) { return role?.config_api || role?.reply_api?.replace(/\/reply$/, "/config") || ""; }
export async function readConfig(ctx, role, sections) { return sectionData(await safeGet(ctx, configPath(role), {sections: sections.join(",")})); }
export async function saveConfig(ctx, role, section, changes, editToken) { return safePost(ctx, `${configPath(role)}/configure`, {section, ...op(`config-${section}`), edit_token: editToken, changes}); }
export function pageStack(content) { return `<div class="page-stack life-page">${content}</div>`; }
export function scopeNote(ctx, editable = true) { return editable ? `<span class="life-scope">${esc(ctx.scope === "role" ? "角色默认" : "当前对象设置")}</span>` : `<span class="life-scope muted">只读展示</span>`; }
export function readOnlyLink(label, route, message = "") { return `${message ? `<span class="life-inline-note">${esc(message)}</span>` : ""}${link(label, route)}`; }
export function bindNavigation(root, ctx) { root.addEventListener("click", event => { const anchor = event.target.closest("[data-ui-link]"); if (!anchor || !ctx.navigate) return; event.preventDefault(); ctx.navigate(anchor.dataset.uiLink); }); }
export const standardFields = {
  life: [
    {name:"enabled",label:"启用生活例程",type:"bool",default:false},{name:"diary_enabled",label:"启用日记",type:"bool",default:true},{name:"diary_time",label:"日记时刻",type:"time",default:"23:50"},{name:"timezone",label:"日记时区",type:"text",default:"Asia/Shanghai"},
    {name:"sleep_enabled",label:"按角色作息自动入睡",type:"bool",default:false},{name:"sleep_time",label:"入睡时刻",type:"time",default:"00:30"},{name:"sleep_timezone",label:"睡眠时区",type:"text",default:"Asia/Shanghai"},{name:"sleep_variation_minutes",label:"入睡自然浮动",type:"number",unit:"分钟",default:20},{name:"sleep_window_minutes",label:"入睡执行窗口",type:"number",unit:"分钟",default:120},{name:"sleep_minutes",label:"目标睡眠时长",type:"number",unit:"分钟",default:480},{name:"reading_enabled",label:"启用阅读",type:"bool",default:false},{name:"derive_enabled",label:"自动提取索引",type:"bool",default:true},{name:"diary_style_prompt",label:"日记风格补充",type:"textarea",default:""}
  ],
  library: [
    {name:"enabled",label:"启用书架",type:"bool",default:false},{name:"reviews_enabled",label:"允许写书评",type:"bool",default:true},{name:"reading_excerpt_chars",label:"单轮读取字数上限",type:"number",unit:"字",default:4000},{name:"manual_entries_enabled",label:"允许手工添加书目",type:"bool",default:true},{name:"max_entries_per_page",label:"每页列出条目数",type:"number",unit:"项",default:20},{name:"rating_enabled",label:"允许给作品打分",type:"bool",default:true},{name:"preference_influence_enabled",label:"把阅读偏好写进提示词",type:"bool",default:true},{name:"preference_min_ratings",label:"形成偏好的最少打分数",type:"number",unit:"次",default:3},{name:"preference_max_terms",label:"单次提示词最多列出的作品数",type:"number",unit:"部",default:5},{name:"min_interval_hours",label:"两次主动开口的最短间隔",type:"number",unit:"小时",default:12},{name:"share_probability",label:"主动分享读书进展的概率",type:"number",unit:"0–1",step:.01,default:.3},{name:"ask_probability",label:"主动询问对方阅读的概率",type:"number",unit:"0–1",step:.01,default:.2}
  ],
  memory: [
    {name:"enabled",label:"记忆已启用",type:"readonly",default:true},{name:"automatic_context",label:"自动注入相关记忆",type:"bool",default:true},{name:"context_items",label:"自动上下文条数",type:"number",unit:"条",default:8},{name:"context_chars",label:"自动上下文字符数",type:"number",unit:"字",default:4000},{name:"query_items",label:"查询结果条数",type:"number",unit:"条",default:8},{name:"query_chars",label:"查询结果字符数",type:"number",unit:"字",default:4000},{name:"source_chars",label:"单个来源读取字符数",type:"number",unit:"字",default:4000},{name:"turn_chars",label:"单轮记忆字符预算",type:"number",unit:"字",default:6000},{name:"turn_calls",label:"单轮记忆查询次数",type:"number",unit:"次",default:3},{name:"core_items",label:"核心记忆条数",type:"number",unit:"条",default:12},{name:"core_chars",label:"核心记忆字符数",type:"number",unit:"字",default:6000},
    {name:"reflection_enabled",label:"定时整理",type:"bool",default:true},{name:"reflection_timezone",label:"整理时区",type:"text",default:"Asia/Shanghai"},{name:"reflection_time",label:"每日整理时间",type:"time",default:"03:30"},{name:"reflection_response_format",label:"模型返回格式",type:"select",choices:{json:"结构化数据",text:"文本"},default:"json"},{name:"reflection_auto_repair",label:"允许修复未完成整理项",type:"bool",default:true},{name:"inclusion_chars",label:"整理材料字符上限",type:"number",unit:"字",default:12000},
    {name:"group_episode_memory_enabled",label:"群聊经历记忆",type:"bool",default:true},{name:"group_episode_refresh_minutes",label:"群聊经历刷新间隔",type:"number",unit:"分钟",default:60},{name:"group_episode_min_messages",label:"群聊经历最少消息数",type:"number",unit:"条",default:20},{name:"max_group_episodes",label:"群聊经历上限",type:"number",unit:"条",default:20},{name:"dialogue_episode_memory_enabled",label:"私聊对话经历",type:"bool",default:true},{name:"dialogue_episode_refresh_messages",label:"对话经历刷新消息数",type:"number",unit:"条",default:20},{name:"dialogue_episode_refresh_minutes",label:"对话经历刷新间隔",type:"number",unit:"分钟",default:60},{name:"max_dialogue_episodes",label:"对话经历上限",type:"number",unit:"条",default:30},{name:"habit_learning_enabled",label:"用户习惯学习",type:"bool",default:true},{name:"habit_min_count",label:"习惯最少观察次数",type:"number",unit:"次",default:3},{name:"habit_max_items",label:"习惯条目上限",type:"number",unit:"条",default:20},{name:"habit_refresh_minutes",label:"习惯刷新间隔",type:"number",unit:"分钟",default:1440},{name:"food_menu_recommendation_enabled",label:"推荐菜谱",type:"bool",default:false}
  ]
};
standardFields.life.forEach(field => { field.valueKey = `life.${field.name}`; });
standardFields.library.forEach(field => { field.domName = `library.${field.name}`; field.valueKey = `library.${field.name}`; });
export const contactGroups = [
  {title:"总开关与偏好", fields:["enabled","automatic_enabled","note"]},
  {title:"开口节奏与每日额度", fields:["interval_seconds","idle_seconds","event_max_age_seconds","max_contacts_24h","unanswered_slowdown_start","unanswered_pause_after","unanswered_max_interval_multiplier","proactive_intensity_preset","proactive_intensity_body_chars","enable_proactive_burst","proactive_burst_max_messages","proactive_burst_gap_min_seconds","proactive_burst_gap_max_seconds","proactive_closing_grace_minutes","proactive_closing_contacts_threshold","proactive_share_probability"]},
  {title:"免打扰与临时暂停", fields:["quiet_enabled","quiet_start","quiet_end","quiet_timezone","pause_until"]},
  {title:"重复抑制与沉默", fields:["dedup_enabled","dedup_last_message_enabled","dedup_last_message_window_minutes","dedup_sent_window_minutes","dedup_weather_window_minutes","dedup_min_shared_tokens","dedup_min_overlap_ratio","dedup_policies","silence_min_confidence","silence_feedback_penalty"]},
  {title:"问候与失眠", fields:["enable_daily_greetings","greeting_morning_window","greeting_noon_window","greeting_evening_window","greeting_idle_minutes","allow_insomnia_night_message","insomnia_night_start","insomnia_night_end","insomnia_night_daily_limit","insomnia_require_sleep_state"]},
  {title:"晨间唤醒", fields:["morning_chain_enabled","morning_role_greeting_enabled","morning_nudge_enabled","routine_learning_enabled","wake_require_device_evidence","wake_morning_start","wake_morning_end","morning_nudge_delay_minutes","morning_nudge_max_attempts","routine_window_days","wake_contact_window_minutes","wake_contact_min_confidence","wake_contact_max_daily","morning_wake_confidence_floor"]},
  {title:"契机矩阵", fields:[]},
  {title:"外部触发源", fields:["meal_checkin_enabled","meal_lunch_time","meal_dinner_time","meal_care_followup_minutes","date_checkin_enabled","important_date_lookahead_days","important_dates","date_checkin_time","weather_checkin_enabled","weather_checkin_time","weather_change_enabled","weather_sample_minutes","official_weather_alert_enabled","official_alert_poll_minutes","official_alert_min_severity","news_share_enabled","news_source_kind","news_source_uid","news_source_url","news_check_interval_minutes","news_daily_hot_read_enabled","news_hot_sources","news_hot_result_count","web_exploration_enabled","web_exploration_interests","web_exploration_min_interval_hours","web_exploration_result_count","external_event_self_link_enabled","external_event_self_link_weight","external_event_self_link_cooldown_hours","balance_awareness_enabled","balance_include_amount_in_message","balance_currency_label","balance_low_threshold","balance_critical_threshold","balance_low_percent_threshold","balance_critical_percent_threshold","balance_check_interval_minutes","balance_message_cooldown_hours","screen_glance_enabled","screen_glance_daily_limit","screen_glance_cooldown_minutes","screen_glance_goodnight_enabled","screen_glance_goodnight_delay_minutes","screen_glance_followup_enabled","screen_glance_followup_after_minutes","screen_glance_followup_cooldown_minutes","voice_action_enabled","voice_action_max_chars","voice_action_cooldown_minutes","poke_action_enabled","poke_action_daily_limit","poke_action_cooldown_minutes","appointment_lead_minutes","appointment_lag_minutes","appointment_pre_silence_minutes"]},
  {title:"高级 · 节奏、复核与表达模板", fields:["contact_followup_after_minutes","contact_followup_cooldown_minutes","generation_history_limit","history_max_chars","style_prompt","expression_prompt","news_sharing_prompt","length_prompt","news_length_prompt","enable_llm_proactive_persona_judge","proactive_persona_judge_threshold","proactive_persona_judge_cache_minutes","proactive_persona_judge_exempt_purposes"]}
];
export const contactPurposeNames = ["affection","care","play","repair","chat","greeting","followup","invitation","reminder","meal","life","creation","news","environment","screen"];
export const contactLabels = Object.fromEntries(contactGroups.flatMap(group => group.fields).map(name => [name, labelOf(name)]));
Object.assign(contactLabels, {enabled:"允许主动联系",automatic_enabled:"启用后台自动联系",note:"补充联系偏好",interval_seconds:"两次联系至少间隔",idle_seconds:"对话结束后至少等候",max_contacts_24h:"每日最多联系",proactive_hour_activity_curve:"24 小时活跃曲线",proactive_hour_activity_enabled:"启用活跃曲线",important_dates:"重要日期清单",proactive_intensity_preset:"主动节奏档位",proactive_intensity_body_chars:"单条主动消息字数提示",enable_proactive_burst:"连续主动消息",proactive_burst_max_messages:"连续消息最多条数",proactive_burst_gap_min_seconds:"连续消息最短间隔",proactive_burst_gap_max_seconds:"连续消息最长间隔",quiet_enabled:"启用免打扰时段",quiet_start:"免打扰开始",quiet_end:"免打扰结束",quiet_timezone:"免打扰时区",pause_until:"暂缓全部联系至",news_source_kind:"资讯来源类型",official_alert_min_severity:"最低预警级别"});
export const contactChoices = {proactive_intensity_preset:{off:"不调整",balanced:"均衡",high_private:"私聊更主动",high_group:"群聊更主动",live:"高频"},news_source_kind:{host:"默认数据源",disabled:"停用资讯源",bilibili:"B 站动态",rss:"资讯订阅",json:"网页数据",search:"网络搜索",hot:"热榜"},official_alert_min_severity:{"":"不限制",minor:"蓝色 · 一般",moderate:"黄色 · 较重",severe:"橙色 · 严重",extreme:"红色 · 特别严重"}};
export function contactSpec(name) {
  const bool = /(^enabled$|^enable_|_enabled$|^allow_|^morning_|^routine_learning_enabled$|^wake_require_|^dedup_|^insomnia_require_|^balance_include_|^screen_glance_|^voice_action_enabled$|^poke_action_enabled$|^news_share_enabled$|^news_daily_hot_read_enabled$|^web_exploration_enabled$|^external_event_self_link_enabled$)/.test(name);
  const numeric = /seconds|minutes|hours|limit|count|threshold|probability|weight|chars|attempts|days|multiplier|ratio/.test(name);
  const textareas = /prompt|^note$|important_dates|interests|curve|dedup_policies|hot_sources/.test(name);
  const type = contactChoices[name] ? "select" : bool ? "bool" : textareas ? "textarea" : numeric ? "number" : /^(quiet_start|quiet_end|meal_.*_time|date_checkin_time|weather_checkin_time|insomnia_night_(start|end)|wake_morning_(start|end)|greeting_.*_window)$/.test(name) ? "text" : "text";
  return {name, label: contactLabels[name] || name.replaceAll("_", " "), type, choices: contactChoices[name], default: type === "bool" ? false : type === "number" ? 0 : ""};
}
export function contactFields(names) { return names.map(contactSpec); }
