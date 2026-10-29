import {api} from "../api.js";
import {card, row, toggle, textField, numberField, tagInput, saveBar, setSaveState, readTags, normalizeListValue, listValueMeta, restoreListValue, esc} from "../ui.js";

const REPLY_FIELDS = [
  "group_wakeup_bot_name", "group_wakeup_direct_words", "group_wakeup_context_words",
  "group_wakeup_question_enabled", "group_wakeup_question_threshold", "group_wakeup_interest_keywords",
  "group_wakeup_interest_probability", "group_wakeup_image_enabled", "group_wakeup_image_weight",
  "group_wakeup_bot_name_enabled", "group_wakeup_primary_member_ids", "group_wakeup_owner_direct_words",
  "group_wakeup_cold_group_enabled", "group_wakeup_cold_group_threshold", "group_wakeup_cold_group_idle_minutes",
  "group_wakeup_short_text_wait_ms", "group_wakeup_fatigue_limit", "group_wakeup_fatigue_decay_minutes",
  "group_wakeup_cooldown_seconds", "group_wakeup_generated_keyword_limit", "group_wakeup_topic_interest_max_boost",
  "group_wakeup_debounce_pending_penalty", "group_wakeup_log_limit", "group_conversation_followup_enabled",
  "group_conversation_followup_seconds", "group_conversation_followup_max_turns", "private_debounce_enabled",
  "private_debounce_min_ms", "private_debounce_max_ms", "private_debounce_total_ms", "private_closing_guard_enabled",
  "private_closing_guard_window_seconds", "private_closing_guard_prompt_enabled", "group_air_guard_enabled",
  "group_high_intensity_enabled", "group_air_guard_window_seconds", "group_air_guard_max_bot_replies",
  "group_air_guard_cooldown_seconds", "group_air_guard_polite_loop_limit", "enable_group_injection_guard",
  "enable_group_privacy_guard", "enable_group_reality_promise_guard"
];
const GROUP_FIELDS = [
  "enable_group_behavior_feedback", "enable_group_behavior_imitation", "enable_group_behavior_learning",
  "enable_group_interjection", "enable_group_interjection_feedback", "enable_group_joke_guard",
  "enable_group_moment_portrait", "enable_group_moments", "enable_group_mood_detection",
  "enable_group_persona_denoise", "enable_group_repeat_follow", "enable_group_roleplay_strength",
  "enable_group_social_context", "enable_group_topic_threads", "group_behavior_guidance",
  "group_context_max_age_hours", "group_interject_feedback_window_seconds", "group_interject_max_daily",
  "group_interject_min_interval_minutes", "group_repeat_count_distinct_users_only", "group_repeat_follow_probability",
  "group_repeat_interrupt_image_path", "group_repeat_interrupt_probability", "group_repeat_interrupt_probability_step",
  "group_repeat_interrupt_text", "group_repeat_trigger_threshold", "group_repeat_window_seconds", "group_topic_thread_max"
];
const TAG_FIELDS = new Set(["group_wakeup_direct_words", "group_wakeup_context_words", "group_wakeup_interest_keywords", "group_wakeup_primary_member_ids", "group_wakeup_owner_direct_words"]);
const BOOL_FIELDS = new Set(REPLY_FIELDS.concat(GROUP_FIELDS).filter(name => name.startsWith("enable_") || name.endsWith("_enabled") || name.endsWith("_only")));
const NUMBER_FIELDS = new Set(REPLY_FIELDS.concat(GROUP_FIELDS).filter(name => !BOOL_FIELDS.has(name) && name !== "group_wakeup_bot_name" && name !== "group_behavior_guidance" && name !== "group_repeat_interrupt_text" && name !== "group_repeat_interrupt_image_path" && !TAG_FIELDS.has(name)));
const DEFAULTS = {
  group_wakeup_bot_name: "", group_wakeup_direct_words: [], group_wakeup_context_words: [], group_wakeup_question_enabled: false,
  group_wakeup_question_threshold: 65, group_wakeup_interest_keywords: [], group_wakeup_interest_probability: .18,
  group_wakeup_image_enabled: false, group_wakeup_image_weight: .2, group_wakeup_bot_name_enabled: true,
  group_wakeup_primary_member_ids: [], group_wakeup_owner_direct_words: [], group_wakeup_cold_group_enabled: false,
  group_wakeup_cold_group_threshold: 65, group_wakeup_cold_group_idle_minutes: 25, group_wakeup_short_text_wait_ms: 15000,
  group_wakeup_fatigue_limit: 5, group_wakeup_fatigue_decay_minutes: 90, group_wakeup_cooldown_seconds: 90,
  group_wakeup_generated_keyword_limit: 24, group_wakeup_topic_interest_max_boost: 45, group_wakeup_debounce_pending_penalty: 65,
  group_wakeup_log_limit: 80, group_conversation_followup_enabled: true, group_conversation_followup_seconds: 120,
  group_conversation_followup_max_turns: 3, private_debounce_enabled: true, private_debounce_min_ms: 1500,
  private_debounce_max_ms: 4000, private_debounce_total_ms: 8000, private_closing_guard_enabled: true,
  private_closing_guard_window_seconds: 1800, private_closing_guard_prompt_enabled: true, group_air_guard_enabled: true,
  group_high_intensity_enabled: false, group_air_guard_window_seconds: 60, group_air_guard_max_bot_replies: 3,
  group_air_guard_cooldown_seconds: 150, group_air_guard_polite_loop_limit: 2, enable_group_injection_guard: true,
  enable_group_privacy_guard: true, enable_group_reality_promise_guard: true,
  enable_group_behavior_feedback: true, enable_group_behavior_imitation: true, enable_group_behavior_learning: true,
  enable_group_interjection: false, enable_group_interjection_feedback: true, enable_group_joke_guard: false,
  enable_group_moment_portrait: false, enable_group_moments: false, enable_group_mood_detection: false,
  enable_group_persona_denoise: true, enable_group_repeat_follow: true, enable_group_roleplay_strength: false,
  enable_group_social_context: false, enable_group_topic_threads: true, group_behavior_guidance: "",
  group_context_max_age_hours: 12, group_interject_feedback_window_seconds: 600, group_interject_max_daily: 2,
  group_interject_min_interval_minutes: 180, group_repeat_count_distinct_users_only: false, group_repeat_follow_probability: .18,
  group_repeat_interrupt_image_path: "", group_repeat_interrupt_probability: .1, group_repeat_interrupt_probability_step: .12,
  group_repeat_interrupt_text: "禁止复读", group_repeat_trigger_threshold: 4, group_repeat_window_seconds: 120, group_topic_thread_max: 12
};
const LABELS = {
  group_wakeup_bot_name: "它的名字", group_wakeup_direct_words: "唤醒词", group_wakeup_context_words: "上下文关联词",
  group_wakeup_question_enabled: "有人提问时接话", group_wakeup_question_threshold: "提问与求助阈值",
  group_wakeup_interest_keywords: "兴趣关键词", group_wakeup_interest_probability: "兴趣参与概率",
  group_wakeup_image_enabled: "考虑图片相关性", group_wakeup_image_weight: "图片相关性权重",
  group_wakeup_bot_name_enabled: "名字作为唤醒词", group_wakeup_primary_member_ids: "主要成员账号 ID",
  group_wakeup_owner_direct_words: "主要成员唤醒词", group_wakeup_cold_group_enabled: "冷场时接话",
  group_wakeup_cold_group_threshold: "冷场判断阈值", group_wakeup_cold_group_idle_minutes: "冷场时长",
  group_wakeup_short_text_wait_ms: "短消息等待", group_wakeup_fatigue_limit: "参与疲劳上限",
  group_wakeup_fatigue_decay_minutes: "疲劳恢复间隔", group_wakeup_cooldown_seconds: "兴趣冷却",
  group_wakeup_generated_keyword_limit: "记忆兴趣词上限", group_wakeup_topic_interest_max_boost: "话题加权上限",
  group_wakeup_debounce_pending_penalty: "待回复时兴趣降权", group_wakeup_log_limit: "判定记录上限",
  group_conversation_followup_enabled: "回复后继续接话", group_conversation_followup_seconds: "接话有效时间",
  group_conversation_followup_max_turns: "最多接话", private_debounce_enabled: "启用连续输入防抖",
  private_debounce_min_ms: "最短静默", private_debounce_max_ms: "等你说完再回", private_debounce_total_ms: "单轮等待上限",
  private_closing_guard_enabled: "私聊自然收尾", private_closing_guard_window_seconds: "收尾判断窗口",
  private_closing_guard_prompt_enabled: "提示模型自然收尾", group_air_guard_enabled: "读空气（空气护栏）",
  group_high_intensity_enabled: "高强度时旁听", group_air_guard_window_seconds: "接话统计窗口",
  group_air_guard_max_bot_replies: "连续回复参考上限", group_air_guard_cooldown_seconds: "密集接话收口期",
  group_air_guard_polite_loop_limit: "礼貌收尾参考上限", enable_group_injection_guard: "群聊提示注入防护",
  enable_group_privacy_guard: "群聊隐私防护", enable_group_reality_promise_guard: "群聊现实承诺防护",
  enable_group_behavior_feedback: "学习互动反馈", enable_group_behavior_imitation: "允许自然参与互动",
  enable_group_behavior_learning: "学习群聊互动习惯", enable_group_interjection: "允许主动插话",
  enable_group_interjection_feedback: "按反馈调整插话", enable_group_joke_guard: "接梗护栏",
  enable_group_moment_portrait: "识别发言者线索", enable_group_moments: "记录群聊名场面",
  enable_group_mood_detection: "识别群聊氛围", enable_group_persona_denoise: "原人格去噪",
  enable_group_repeat_follow: "复读跟读", enable_group_roleplay_strength: "判断扮演强度",
  enable_group_social_context: "群聊氛围参考", enable_group_topic_threads: "跟踪群聊话题线",
  group_behavior_guidance: "互动偏好", group_context_max_age_hours: "群聊历史回看时长",
  group_interject_feedback_window_seconds: "插话反馈时间窗", group_interject_max_daily: "每日插话上限",
  group_interject_min_interval_minutes: "插话最短间隔", group_repeat_count_distinct_users_only: "只在多人重复时触发",
  group_repeat_follow_probability: "跟读概率", group_repeat_interrupt_image_path: "打断图片",
  group_repeat_interrupt_probability: "打断概率", group_repeat_interrupt_probability_step: "概率递增",
  group_repeat_interrupt_text: "打断时说的话", group_repeat_trigger_threshold: "复读触发次数",
  group_repeat_window_seconds: "复读统计时间窗", group_topic_thread_max: "最多保留话题线"
};
const UNIT = {group_wakeup_question_threshold: "%", group_wakeup_interest_probability: "", group_wakeup_image_weight: "", group_wakeup_cold_group_threshold: "%", group_wakeup_cold_group_idle_minutes: "分钟", group_wakeup_short_text_wait_ms: "毫秒", group_wakeup_fatigue_limit: "点", group_wakeup_fatigue_decay_minutes: "分钟", group_wakeup_cooldown_seconds: "秒", group_wakeup_generated_keyword_limit: "条", group_wakeup_topic_interest_max_boost: "%", group_wakeup_debounce_pending_penalty: "%", group_wakeup_log_limit: "条", group_conversation_followup_seconds: "秒", group_conversation_followup_max_turns: "轮", private_debounce_min_ms: "毫秒", private_debounce_max_ms: "秒", private_debounce_total_ms: "毫秒", private_closing_guard_window_seconds: "秒", group_air_guard_window_seconds: "秒", group_air_guard_max_bot_replies: "轮", group_air_guard_cooldown_seconds: "秒", group_air_guard_polite_loop_limit: "轮", group_context_max_age_hours: "小时", group_interject_feedback_window_seconds: "秒", group_interject_max_daily: "次", group_interject_min_interval_minutes: "分钟", group_repeat_follow_probability: "", group_repeat_interrupt_probability: "", group_repeat_interrupt_probability_step: "", group_repeat_trigger_threshold: "次", group_repeat_window_seconds: "秒", group_topic_thread_max: "条"};
const MORE_REPLY = ["group_wakeup_context_words", "group_wakeup_question_threshold", "group_wakeup_interest_keywords", "group_wakeup_interest_probability", "group_wakeup_image_enabled", "group_wakeup_image_weight", "group_wakeup_bot_name_enabled", "group_wakeup_primary_member_ids", "group_wakeup_owner_direct_words", "group_wakeup_cold_group_threshold", "group_wakeup_cold_group_idle_minutes", "group_wakeup_short_text_wait_ms", "group_wakeup_fatigue_limit", "group_wakeup_fatigue_decay_minutes", "group_wakeup_cooldown_seconds", "group_wakeup_generated_keyword_limit", "group_wakeup_topic_interest_max_boost", "group_wakeup_debounce_pending_penalty", "group_wakeup_log_limit", "private_debounce_min_ms", "private_debounce_total_ms", "private_closing_guard_enabled", "private_closing_guard_window_seconds", "private_closing_guard_prompt_enabled", "group_air_guard_enabled", "group_high_intensity_enabled", "group_air_guard_window_seconds", "group_air_guard_max_bot_replies", "group_air_guard_cooldown_seconds", "group_air_guard_polite_loop_limit", "enable_group_injection_guard", "enable_group_privacy_guard", "enable_group_reality_promise_guard"];
const MORE_GROUP = GROUP_FIELDS;
const PRIVATE_REPLY = MORE_REPLY.filter(name => name.startsWith("private_"));
const GROUP_REPLY = MORE_REPLY.filter(name => !name.startsWith("private_"));

const valueOf = (state, name) => state.draft[name] ?? DEFAULTS[name];
// 后端 private_debounce_max_ms 是毫秒，范围见 companion_v2/conversation/private_debounce.LIMITS（10–120000）。
const DEBOUNCE_MAX_SECONDS = {min: 0.01, max: 120, step: 0.01};
const DEBOUNCE_MAX_HINT = "请填写 0.01–120 秒之间的数字";
function displayValue(name, value) { return name === "private_debounce_max_ms" ? Number(value || 0) / 1000 : value; }
function writeValue(name, value) { return name === "private_debounce_max_ms" ? Math.round(Number(value || 0) * 1000) : value; }
function maxTurnsControl(state, disabled) {
  const value = Number(valueOf(state, "group_conversation_followup_max_turns")), unlimited = value >= 999;
  return `<div class="ui-max-turns">${numberField("group_conversation_followup_max_turns", unlimited ? 999 : value, "轮", {disabled: disabled || unlimited, label: LABELS.group_conversation_followup_max_turns})}${toggle("group_conversation_followup_unlimited", unlimited, {label: "不限", disabled})}<span class="ui-unlimited-label">不限</span></div>`;
}
function fieldControl(state, name, disabled = false) {
  const value = valueOf(state, name), label = LABELS[name] || name;
  if (name === "group_conversation_followup_max_turns") return maxTurnsControl(state, disabled);
  if (BOOL_FIELDS.has(name)) return toggle(name, Boolean(value), {disabled, label});
  if (TAG_FIELDS.has(name)) return tagInput(name, normalizeListValue(value), {disabled, label});
  if (NUMBER_FIELDS.has(name)) {
    const range = name === "private_debounce_max_ms" ? DEBOUNCE_MAX_SECONDS : null;
    return numberField(name, displayValue(name, value), UNIT[name] || "", {disabled, step: range ? range.step : String(value).includes(".") ? .01 : 1, min: range?.min, max: range?.max, label});
  }
  return name === "group_behavior_guidance" ? `<textarea class="ui-textarea" data-ui-field="${name}" aria-label="${label}"${disabled ? " disabled" : ""}>${String(value || "")}</textarea>` : textField(name, value, {disabled, label});
}
function renderRows(state, names, disabled = false) { return names.map(name => row(LABELS[name] || name, fieldControl(state, name, disabled || !state.available.has(name)), {name})).join(""); }

const participationPage = {
  id: "conversation-participation", section: "对话", title: "参与",
  async render(root, ctx) {
    root.innerHTML = `<div class="page-loading">正在读取</div>`;
    const target = ctx.target, role = ctx.role;
    if (!role?.reply_api) { root.innerHTML = `<div class="page-empty">当前对象不可用</div>`; return; }
    const configRole = typeof ctx.roleWithConfig === "function" ? ctx.roleWithConfig(role) : null;
    const raw = await api.readRole(role, target.scope_kind === "group" ? "group" : "private", configRole);
    const reply = raw.reply || {}, config = raw.config || {}, participation = raw.participation || {};
    const listFormats = {}, draft = {...DEFAULTS};
    for (const source of [reply.settings || {}, config.settings || {}, participation.settings || {}]) {
      for (const [name, value] of Object.entries(source)) {
        if (TAG_FIELDS.has(name)) { draft[name] = normalizeListValue(value); listFormats[name] = listValueMeta(value); }
        else draft[name] = value;
      }
    }
    const state = {
      target, role, scope: ctx.scope, configRole, replyToken: reply.edit_token || "", configToken: config.edit_token || "", windowToken: participation.edit_token || "", listFormats,
      draft, base: {...draft},
      available: new Set([...Object.keys(reply.settings || {}), ...Object.keys(config.settings || {}), ...Object.keys(participation.settings || {})]), invalid: false, dirty: false
    };
    const group = target.scope_kind === "group";
    // GROUP_FIELDS 归「角色默认」：群角色本身没有 config_api，只有 scope=角色默认
    // 且能找到同 role_id 的私聊配置接口时才可编辑；当前群只读展示。
    const configEditable = ctx.scope === "role" && Boolean(configRole);
    const configNote = !group || ctx.scope === "role" ? "" : configRole ? "这些设置所有群共用，请到「角色默认」修改。" : "角色默认配置接口不可用，这里只能查看当前群自己的设置。";
    const mainReply = ["group_wakeup_bot_name", "group_wakeup_direct_words", "group_wakeup_question_enabled", "group_wakeup_cold_group_enabled"];
    const followup = ["group_conversation_followup_enabled", "group_conversation_followup_seconds", "group_conversation_followup_max_turns"];
    const privateFields = ["private_debounce_enabled", "private_debounce_max_ms"];
    const showRole = ctx.scope === "role";
    const showGroup = showRole || (group && ctx.scope === "object");
    const showPrivate = showRole || (!group && ctx.scope === "object");
    const moreReply = showRole ? MORE_REPLY : group ? GROUP_REPLY : PRIVATE_REPLY;
    const groupMain = ["enable_group_social_context", "enable_group_interjection", "enable_group_repeat_follow"];
    const groupMore = MORE_GROUP.filter(name => !groupMain.includes(name));
    const cards = [];
    if (showGroup) cards.push(card("唤醒", renderRows(state, mainReply), {meta: "群聊"}));
    if (showGroup) cards.push(card("连续对话", renderRows(state, followup)));
    if (showPrivate) cards.push(card("私聊", renderRows(state, privateFields), {meta: "当前私聊"}));
    if (showGroup) cards.push(card("群聊参与", renderRows(state, groupMain), {meta: "当前群"}));
    cards.push(`<details class="console-card" data-more><summary class="card-title"><span class="more-title"><span>更多</span><span class="more-chevron" aria-hidden="true">⌄</span></span></summary><div class="card-body">${renderRows(state, moreReply)}${showGroup ? `${configNote ? `<p class="ui-hint">${esc(configNote)}</p>` : ""}${renderRows(state, groupMore, !configEditable)}` : ""}</div></details>`);
    root.innerHTML = `<div class="page-stack" data-participation-root>${cards.join("")}${saveBar("participation", {disabled: true})}</div>`;
    const markDirty = () => {
      state.dirty = Object.keys(state.draft).some(name => JSON.stringify(state.draft[name]) !== JSON.stringify(state.base[name]));
      const button = root.querySelector("[data-ui-save=participation]"); if (button) button.disabled = !state.dirty || state.invalid;
      if (state.invalid) setSaveState(root, "participation", DEBOUNCE_MAX_HINT, "error");
      else if (state.dirty) setSaveState(root, "participation", "");
    };
    const update = (name, value) => { state.draft[name] = value; markDirty(); };
    root.addEventListener("click", async event => {
      const toggleNode = event.target.closest("[data-ui-toggle]");
      if (toggleNode) {
        const name = toggleNode.dataset.uiToggle, checked = toggleNode.getAttribute("aria-checked") !== "true";
        if (name === "group_conversation_followup_unlimited") update("group_conversation_followup_max_turns", checked ? 999 : 3);
        else update(name, checked);
        toggleNode.setAttribute("aria-checked", String(checked)); toggleNode.classList.toggle("is-on", checked);
        if (name === "group_conversation_followup_unlimited") { const input = root.querySelector('[data-ui-field="group_conversation_followup_max_turns"]'); if (input) { input.disabled = checked; input.value = checked ? "999" : String(state.draft.group_conversation_followup_max_turns); } }
        return;
      }
      const segment = event.target.closest("[data-ui-segment]");
      if (segment) return;
      const remove = event.target.closest("[data-ui-tag-remove]");
      if (remove) { const name = remove.closest("[data-ui-tags]").dataset.uiTags; update(name, readTags(root, name).filter(item => item !== remove.dataset.uiTagRemove)); remove.closest(".ui-tag")?.remove(); return; }
      const save = event.target.closest("[data-ui-save=participation]");
      if (!save || save.disabled || state.saving) return;
      state.saving = true; save.disabled = true; setSaveState(root, "participation", "保存中");
      const replyChanges = {}, configChanges = {}, windowChanges = {};
      for (const name of REPLY_FIELDS) if (JSON.stringify(state.draft[name]) !== JSON.stringify(state.base[name]) && state.available.has(name)) replyChanges[name] = state.listFormats[name] ? restoreListValue(state.listFormats[name], state.draft[name]) : state.draft[name];
      for (const name of GROUP_FIELDS) if (configRole && JSON.stringify(state.draft[name]) !== JSON.stringify(state.base[name]) && state.available.has(name)) configChanges[name] = state.listFormats[name] ? restoreListValue(state.listFormats[name], state.draft[name]) : state.draft[name];
      for (const name of ["enable_group_interjection", "enable_group_interjection_feedback", "group_interject_feedback_window_seconds", "group_interject_max_daily", "group_interject_min_interval_minutes"])
        if (JSON.stringify(state.draft[name]) !== JSON.stringify(state.base[name]) && state.available.has(name)) windowChanges[name] = state.listFormats[name] ? restoreListValue(state.listFormats[name], state.draft[name]) : state.draft[name];
      try {
        if (Object.keys(replyChanges).length) await api.saveReply(role, replyChanges, state.replyToken);
        if (Object.keys(configChanges).length) await api.saveConfig(role, configChanges, state.configToken, "group_participation", configRole);
        const onlyWindow = Object.keys(windowChanges).filter(name => !Object.hasOwn(configChanges, name));
        if (group && onlyWindow.length) await api.saveGroupParticipation(role, Object.fromEntries(onlyWindow.map(name => [name, state.draft[name]])), state.windowToken);
        state.base = {...state.draft}; state.dirty = false; setSaveState(root, "participation", "已保存", "ok");
      } catch (error) { setSaveState(root, "participation", "保存失败", "error"); save.disabled = false; }
      state.saving = false;
    });
    const readNumber = (field, name) => {
      const raw = field.value.trim();
      if (name !== "private_debounce_max_ms") { const value = Number(raw); return Number.isFinite(value) ? writeValue(name, value) : writeValue(name, Number(raw) || 0); }
      // 空值或越界一律不写回，保留原值并阻止保存，避免后端收到 0 毫秒。
      const seconds = Number(raw);
      if (!raw || !Number.isFinite(seconds) || seconds < DEBOUNCE_MAX_SECONDS.min || seconds > DEBOUNCE_MAX_SECONDS.max) { state.invalid = true; markDirty(); return undefined; }
      state.invalid = false;
      return writeValue(name, seconds);
    };
    root.addEventListener("input", event => {
      const field = event.target.closest("[data-ui-field]"); if (!field) return;
      const name = field.dataset.uiField;
      if (field.type === "number") { const value = readNumber(field, name); if (value === undefined) return; update(name, value); return; }
      update(name, field.value);
    });
    root.addEventListener("change", event => {
      const field = event.target.closest("[data-ui-field]"); if (!field) return;
      const name = field.dataset.uiField;
      if (field.type === "number") { const value = readNumber(field, name); if (value === undefined) return; update(name, value); return; }
      update(name, field.value);
    });
    root.addEventListener("keydown", event => {
      const input = event.target.closest("[data-ui-tags] input"); if (!input || event.key !== "Enter") return;
      event.preventDefault(); const box = input.closest("[data-ui-tags]"), name = box.dataset.uiTags, value = input.value.trim();
      if (!value) return; const values = [...new Set([...readTags(root, name), value])]; state.draft[name] = values; input.value = "";
      const tag = document.createElement("span"); tag.className = "ui-tag"; tag.dataset.uiTag = value; tag.innerHTML = `<span></span><button type="button" data-ui-tag-remove=""></button>`; tag.querySelector("span").textContent = value; tag.querySelector("button").dataset.uiTagRemove = value; tag.querySelector("button").textContent = "×"; box.insertBefore(tag, input); markDirty();
    });
  }
};
export default participationPage;
