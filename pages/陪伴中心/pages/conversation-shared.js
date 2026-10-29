import {api} from "../api.js";
import {row, toggle, textField, numberField, select, tagInput, saveBar, setSaveState, readTags, normalizeListValue, listValueMeta, restoreListValue, card, link, more, foldCard, statusBadge} from "../ui.js";

let cssReady = false;
export function ensureConversationCss() {
  if (cssReady || document.querySelector('link[data-conversation-css]')) return;
  const linkNode = document.createElement("link");
  linkNode.rel = "stylesheet"; linkNode.href = new URL("./conversation.css", import.meta.url).href; linkNode.dataset.conversationCss = "";
  document.head.appendChild(linkNode); cssReady = true;
}
export const choices = {
  streaming_mode: {buffered:"收齐后分段发送", incremental:"边生成边分段发送"},
  rule_mode: {words:"词列表", regex:"正则表达式", sentences:"按句子", paragraphs:"按段落"},
  part_gap_mode: {fixed:"固定", random:"随机", log:"按文本长度"},
  prompt_style_mode: {constraint:"约束", free:"自由", guided:"引导"},
  content_cleanup_mode: {words:"按清理词", regex:"按正则"},
  content_cleanup_scope: {leading:"句首", middle:"句中", trailing:"句尾"},
  recall_forbidden_scope: {bot_only:"角色自己的回复", group_only:"群聊回复", bot_and_group:"角色回复与群聊"},
  image_position: {after_text:"文字后", before_text:"文字前"},
  voice_trigger_mode: {always:"每轮", request:"按请求", adaptive:"模型择句"},
  voice_generation_mode: {plain:"朗读正文", model_tag:"模型语音标签"},
  voice_conversion_scope: {full:"完整口述", partial:"选择适合口述的短句"},
  voice_segment_mode: {whole:"整段语音", each:"每一段", first:"仅首段", last:"仅末段"},
  voice_delivery_mode: {voice_and_text:"文字与语音", voice_only:"仅语音（完整覆盖时）"},
  voice_position: {before_text:"文字前", after_text:"文字后", after_media:"所有组件后"},
  voice_language: {zh:"中文", ja:"日语", en:"英语"},
  voice_foreign_text_mode: {original:"原文", translation:"中文译文", bilingual:"双语"},
  component_order: {text:"文字", image:"图片", voice:"语音", face:"表情"},
};
export const labels = {
  enabled:"启用分段", streaming:"启用流式", streaming_mode:"流式分段发送方式", rule_mode:"规则分段方式", split_words:"分段标记词",
  match_width_variants:"兼容全角与半角", rule_regex:"分段正则", threshold:"分段字数阈值", min_segment_chars:"短段合并参考字数", max_segments:"最多消息条数", prompt:"模型分段提示词",
  part_gap_mode:"分段间隔方式", part_gap_ms:"固定段间隔", part_gap_min_ms:"随机间隔下限", part_gap_max_ms:"随机间隔上限", part_gap_log_base:"长度调节强度",
  prompt_style_mode:"提示词风格", style_prompt:"风格提示词", enable_humanized_expression:"拟人表达", humanized_expression_prompt:"拟人表达提示",
  content_cleanup_enabled:"启用文字清理", content_cleanup_mode:"清理模式", content_cleanup_scope:"清理范围", content_cleanup_rule:"清理规则", content_cleanup_words:"清理标记词", content_replacement_enabled:"启用文字替换", content_replacements:"替换表",
  framework_error_guard_enabled:"清理框架内部标记", enable_forbidden_word_recall:"命中词撤回", recall_forbidden_words:"撤回词条", recall_forbidden_scope:"撤回范围", recall_forbidden_word_case_sensitive:"区分大小写", reply_diagnostic_limit:"诊断条数",
  component_order:"消息组件顺序", image_position:"图片位置", reply_quote_enabled:"引用触发消息", reply_quote_group_enabled:"群聊中引用", reply_quote_first_part_only:"仅引用首段", reply_quote_skip_chars:"引用跳过字数", reply_mention_speaker_enabled:"群聊回复时 @ 发言者",
  voice_enabled:"启用语音", voice_trigger_mode:"触发方式", voice_generation_mode:"朗读内容", voice_conversion_scope:"转换范围", voice_segment_mode:"分段方式", voice_delivery_mode:"投递方式", voice_language:"语言", voice_foreign_text_mode:"外语处理", voice_position:"朗读位置", voice_provider_id:"通用 TTS", voice_zh_provider_id:"中文 TTS", voice_ja_provider_id:"日语 TTS", voice_en_provider_id:"英语 TTS", voice_trigger_keywords:"触发关键词", voice_extra_prompt:"额外提示", voice_primary_mention_keywords:"核心用户提及词", voice_primary_mention_probability:"核心用户提及概率", voice_primary_mention_prompt:"核心用户提及提示",
  voice_private_zh_provider_id:"私聊 · 中文 TTS", voice_private_ja_provider_id:"私聊 · 日语 TTS", voice_private_en_provider_id:"私聊 · 英语 TTS", voice_group_zh_provider_id:"群聊 · 中文 TTS", voice_group_ja_provider_id:"群聊 · 日语 TTS", voice_group_en_provider_id:"群聊 · 英语 TTS",
  enable_context_image_captioning:"启用上下文图片摘要", context_image_caption_max_items:"上下文描述条数", enable_private_image_self_recognition:"启用图片转述", enable_private_image_vision_cache:"复用重复图片转述", private_image_vision_cache_max_items:"缓存条目上限", private_image_self_recognition_hint:"自我识别线索", private_image_vision_custom_prompt:"转述提示词补充", private_image_vision_max_chars:"转述长度上限", private_image_vision_wait_seconds:"转述等待时间", private_image_provider_failure_cooldown_seconds:"识图失败冷却",
  video_understanding_enabled:"启用视频理解", video_understanding_max_chars:"视频转述字数上限", video_understanding_wait_seconds:"视频转述等待时间", video_understanding_private_enabled:"私聊视频理解", video_understanding_group_enabled:"群聊视频理解", video_self_recognition_hint:"视频自我识别线索", video_understanding_prompt:"视频理解提示词",
  busy_reply_gate_enabled:"启用忙碌处理", busy_reply_min_delay_seconds:"私聊最短顺延", busy_reply_max_delay_seconds:"私聊最长顺延", busy_reply_proactive_resume_buffer_minutes:"主动联系恢复缓冲", busy_activity_keywords:"忙碌活动关键词", busy_exclude_keywords:"排除忙碌关键词", busy_urgent_keywords:"紧急关键词",
};
const boolNames = new Set(["enabled","streaming","match_width_variants","enable_humanized_expression","content_cleanup_enabled","content_replacement_enabled","framework_error_guard_enabled","enable_forbidden_word_recall","recall_forbidden_word_case_sensitive","reply_quote_enabled","reply_quote_group_enabled","reply_quote_first_part_only","reply_mention_speaker_enabled","voice_enabled","enable_context_image_captioning","enable_private_image_self_recognition","enable_private_image_vision_cache","video_understanding_enabled","video_understanding_private_enabled","video_understanding_group_enabled","busy_reply_gate_enabled"]);
const tagNames = new Set(["split_words","content_cleanup_words","recall_forbidden_words","voice_trigger_keywords","voice_primary_mention_keywords","busy_activity_keywords","busy_exclude_keywords","busy_urgent_keywords"]);
const listNames = new Set([...tagNames, "component_order", "content_replacements"]);
const textAreaNames = new Set(["prompt","style_prompt","humanized_expression_prompt","content_cleanup_rule","content_replacements","voice_extra_prompt","voice_primary_mention_prompt","private_image_self_recognition_hint","private_image_vision_custom_prompt","video_self_recognition_hint","video_understanding_prompt"]);
const numberNames = new Set(["threshold","min_segment_chars","max_segments","part_gap_ms","part_gap_min_ms","part_gap_max_ms","part_gap_log_base","reply_diagnostic_limit","reply_quote_skip_chars","voice_primary_mention_probability","context_image_caption_max_items","private_image_vision_cache_max_items","private_image_vision_max_chars","private_image_vision_wait_seconds","private_image_provider_failure_cooldown_seconds","video_understanding_max_chars","video_understanding_wait_seconds","busy_reply_min_delay_seconds","busy_reply_max_delay_seconds","busy_reply_proactive_resume_buffer_minutes"]);
const units = {threshold:"字", min_segment_chars:"字", max_segments:"条", part_gap_ms:"毫秒", part_gap_min_ms:"毫秒", part_gap_max_ms:"毫秒", reply_diagnostic_limit:"条", reply_quote_skip_chars:"字", voice_primary_mention_probability:"%", context_image_caption_max_items:"张", private_image_vision_cache_max_items:"条", private_image_vision_max_chars:"字", private_image_vision_wait_seconds:"秒", private_image_provider_failure_cooldown_seconds:"秒", video_understanding_max_chars:"字", video_understanding_wait_seconds:"秒", busy_reply_min_delay_seconds:"秒", busy_reply_max_delay_seconds:"秒", busy_reply_proactive_resume_buffer_minutes:"分钟"};
const defaults = {enabled:true, streaming:true, streaming_mode:"buffered", rule_mode:"words", split_words:["。","！","？"], match_width_variants:true, rule_regex:"", threshold:120, min_segment_chars:8, max_segments:4, prompt:"", part_gap_mode:"fixed", part_gap_ms:800, part_gap_min_ms:400, part_gap_max_ms:1400, part_gap_log_base:2.1, prompt_style_mode:"free", style_prompt:"", enable_humanized_expression:false, humanized_expression_prompt:"", content_cleanup_enabled:true, content_cleanup_mode:"words", content_cleanup_scope:"middle", content_cleanup_rule:"", content_cleanup_words:[], content_replacement_enabled:false, content_replacements:[], framework_error_guard_enabled:true, enable_forbidden_word_recall:false, recall_forbidden_words:[], recall_forbidden_scope:"bot_and_group", recall_forbidden_word_case_sensitive:false, reply_diagnostic_limit:30, component_order:["text","image","voice"], image_position:"after_text", reply_quote_enabled:false, reply_quote_group_enabled:false, reply_quote_first_part_only:true, reply_quote_skip_chars:0, reply_mention_speaker_enabled:false, voice_enabled:false, voice_trigger_mode:"request", voice_generation_mode:"plain", voice_conversion_scope:"full", voice_segment_mode:"whole", voice_delivery_mode:"voice_and_text", voice_language:"zh", voice_foreign_text_mode:"original", voice_position:"after_text", voice_provider_id:"", voice_zh_provider_id:"", voice_ja_provider_id:"", voice_en_provider_id:"", voice_private_zh_provider_id:"", voice_private_ja_provider_id:"", voice_private_en_provider_id:"", voice_group_zh_provider_id:"", voice_group_ja_provider_id:"", voice_group_en_provider_id:"", voice_trigger_keywords:[], voice_extra_prompt:"", voice_primary_mention_keywords:[], voice_primary_mention_probability:0, voice_primary_mention_prompt:"", enable_context_image_captioning:false, context_image_caption_max_items:3, enable_private_image_self_recognition:false, enable_private_image_vision_cache:true, private_image_vision_cache_max_items:20, private_image_self_recognition_hint:"", private_image_vision_custom_prompt:"", private_image_vision_max_chars:800, private_image_vision_wait_seconds:8, private_image_provider_failure_cooldown_seconds:60, video_understanding_enabled:false, video_understanding_max_chars:1200, video_understanding_wait_seconds:10, video_understanding_private_enabled:false, video_understanding_group_enabled:false, video_self_recognition_hint:"", video_understanding_prompt:"", busy_reply_gate_enabled:true, busy_reply_min_delay_seconds:10, busy_reply_max_delay_seconds:60, busy_reply_proactive_resume_buffer_minutes:30, busy_activity_keywords:[], busy_exclude_keywords:[], busy_urgent_keywords:[]};
export const fieldNames = Object.keys(defaults);
export const valueOf = (draft, name) => draft[name] ?? defaults[name] ?? "";
// 群角色没有 config_api：去同 role_id 的私聊角色上取；找不到就不可用，绝不再拼 /config。
export const pathFor = (ctx, role = ctx?.role) => ctx?.roleWithConfig?.(role)?.config_api || "";
export async function readConfig(ctx, role, section) { const path = pathFor(ctx, role); if (!path) return {}; const value = await api.get(path, {sections: section}); return value?.sections?.[section] || value?.settings || value || {}; }
export async function saveConfig(ctx, role, section, changes, editToken) { const path = pathFor(ctx, role); if (!path) throw new Error("当前对象没有可用的角色配置接口"); return api.post(`${path}/configure`, {section, operation_key: api.operationKey(section), edit_token: editToken, changes}); }
export async function readReply(role) { return api.readRole(role); }
export function settingsOf(value) { return value?.settings || value || {}; }
export function providersOf(reply, ctx) { return reply?.tts?.providers || reply?.status?.tts?.providers || reply?.settings?.status?.tts?.providers || ctx.capabilities?.tts?.providers || ctx.capabilities?.providers || []; }
export function hasCapability(ctx, task) { const tasks = ctx.capabilities?.tasks || ctx.capabilities?.model_tasks; if (tasks == null) return false; return Array.isArray(tasks) ? tasks.some(item => typeof item === "string" ? item === task : item?.kind === task || item?.id === task || item?.capability_id === task) : tasks?.[task] === true; }
function choicesFor(name, extra = {}) { return extra[name] || choices[name] || {}; }
function control(name, value, options = {}) {
  const disabled = options.disabled ? true : false, label = labels[name] || name;
  if (name === "component_order") return select(name, Array.isArray(value) ? value.join(",") : value, {"text,image,voice":"文字、图片、语音", "text,voice,image":"文字、语音、图片", "image,text,voice":"图片、文字、语音", "text,image,voice,face":"文字、图片、语音、表情"}, {disabled, label});
  if (boolNames.has(name) || options.type === "bool") return toggle(name, Boolean(value), {disabled, label});
  if (tagNames.has(name) || Array.isArray(value)) return tagInput(name, normalizeListValue(value), {disabled, label, placeholder:"输入后回车"});
  const choiceMap = options.choices?.[name] || choices[name];
  if (options.type === "select" || choiceMap) return select(name, value, choiceMap || {}, {disabled, label});
  if (numberNames.has(name) || options.type === "number") { const display = name === "voice_primary_mention_probability" ? Number(value || 0) * 100 : value; return numberField(name, display, units[name] || options.unit || "", {disabled, label, min: options.min, max: options.max, step: options.step || 1}); }
  if (textAreaNames.has(name) || options.type === "textarea") { const text = name === "content_replacements" ? JSON.stringify(value || [], null, 2) : String(value ?? ""); return `<textarea class="ui-textarea" data-ui-field="${name}" rows="${options.rows || 4}" maxlength="${options.maxlength || 4000}" aria-label="${label}"${disabled ? " disabled" : ""}>${text.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</textarea>`; }
  return textField(name, value, {disabled, label, maxlength: options.maxlength});
}
export function renderFields(state, specs, extraChoices = {}) {
  return specs.map(spec => { const name = typeof spec === "string" ? spec : spec.name; const value = valueOf(state.draft, name); const unavailable = state.readonly || (state.available.size && !state.available.has(name)); const options = typeof spec === "string" ? {} : spec; const dependency = options.showWhen; const dependencyAttrs = dependency ? ` data-show-field="${dependency.field}" data-show-values="${(dependency.values || []).join(",")}" data-show-not="${dependency.not ? "true" : "false"}"` : ""; const markup = row((typeof spec === "string" ? labels[name] : spec.label) || labels[name] || name, control(name, value, {...options, disabled: unavailable || options.disabled, choices: extraChoices}), {name}); return dependency ? `<div class="conversation-field"${dependencyAttrs}>${markup}</div>` : markup; }).join("");
}
export function syncDependencies(root, draft) {
  root.querySelectorAll("[data-show-field]").forEach(node => { const value = draft[node.dataset.showField]; const expected = node.dataset.showValues.split(","); const match = expected.includes(String(value)) || expected.includes(value === true ? "true" : "false"); node.hidden = node.dataset.showNot === "true" ? match : !match; });
}
export function normalizeSettings(settings) { const next = {...defaults, ...(settings || {})}; if (next.content_cleanup_scope === "all") next.content_cleanup_scope = "middle"; return next; }
export function setupEditor(root, state, saveName, onSave) {
  const mark = () => { state.dirty = Object.keys(state.draft).some(name => JSON.stringify(state.draft[name]) !== JSON.stringify(state.base[name])); const button = root.querySelector(`[data-ui-save="${saveName}"]`); if (button) button.disabled = state.readonly || !state.dirty; state.onChange?.(); };
  const update = (name, raw) => { let value = raw; if (name === "component_order") value = normalizeListValue(String(raw).split(",").filter(Boolean)); if (name === "content_replacements") { try { value = normalizeListValue(JSON.parse(String(raw || "[]"))); } catch (_) {} } if (name === "voice_primary_mention_probability") value = Number(raw || 0) / 100; state.draft[name] = value; mark(); };
  root.addEventListener("click", event => {
    const toggleNode = event.target.closest("[data-ui-toggle]");
    if (toggleNode) { const name = toggleNode.dataset.uiToggle; const checked = toggleNode.getAttribute("aria-checked") !== "true"; toggleNode.setAttribute("aria-checked", String(checked)); toggleNode.classList.toggle("is-on", checked); update(name, checked); return; }
    const remove = event.target.closest("[data-ui-tag-remove]");
    if (remove) { const box = remove.closest("[data-ui-tags]"), name = box.dataset.uiTags; update(name, readTags(root, name).filter(item => item !== remove.dataset.uiTagRemove)); remove.closest(".ui-tag")?.remove(); return; }
    const save = event.target.closest(`[data-ui-save="${saveName}"]`); if (!save || save.disabled || state.saving) return;
    state.saving = true; save.disabled = true; setSaveState(root, saveName, "保存中"); Promise.resolve(onSave()).then(() => { state.base = JSON.parse(JSON.stringify(state.draft)); state.dirty = false; setSaveState(root, saveName, "已保存", "ok"); }).catch(() => { setSaveState(root, saveName, "保存失败", "error"); save.disabled = false; }).finally(() => { state.saving = false; mark(); });
  });
  const readField = field => field.type === "number" ? Number(field.value) || 0 : field.value;
  const onField = event => { const field = event.target.closest("[data-ui-field]"); if (field) update(field.dataset.uiField, readField(field)); };
  root.addEventListener("input", onField); root.addEventListener("change", onField);
  root.addEventListener("keydown", event => { const input = event.target.closest("[data-ui-tags] input"); if (!input || event.key !== "Enter") return; event.preventDefault(); const box = input.closest("[data-ui-tags]"), name = box.dataset.uiTags, value = input.value.trim(); if (!value) return; const values = [...new Set([...readTags(root, name), value])]; update(name, values); input.value = ""; const tag = document.createElement("span"); tag.className = "ui-tag"; tag.dataset.uiTag = value; tag.innerHTML = `<span></span><button type="button" data-ui-tag-remove=""></button>`; tag.querySelector("span").textContent = value; tag.querySelector("button").dataset.uiTagRemove = value; tag.querySelector("button").textContent = "×"; box.insertBefore(tag, input); });
  mark(); return {mark, update};
}
export function replyState(raw, extra = {}) {
  const rawSettings = raw?.reply?.settings || raw?.settings || {}, settings = normalizeSettings(rawSettings), listFormats = {};
  for (const name of listNames) {
    const source = Object.hasOwn(rawSettings, name) ? rawSettings[name] : settings[name];
    listFormats[name] = listValueMeta(source);
    settings[name] = normalizeListValue(source);
  }
  const draft = {...settings, ...extra};
  return {draft, base:{...draft}, listFormats, available:new Set(Object.keys(rawSettings)), token:raw?.reply?.edit_token || raw?.edit_token || "", dirty:false, saving:false};
}
export async function saveReply(role, state, reset = false) {
  const changes = {};
  Object.keys(state.draft).forEach(name => {
    if (state.available.has(name) && JSON.stringify(state.draft[name]) !== JSON.stringify(state.base[name])) changes[name] = state.listFormats?.[name] ? restoreListValue(state.listFormats[name], state.draft[name]) : state.draft[name];
  });
  if (!Object.keys(changes).length && !reset) return;
  const body = {operation_key:api.operationKey("reply"), edit_token:state.token, changes}; if (reset) body.reset_to_inherit = true;
  const result = await api.post(`${role.reply_api}/configure`, body); state.token = result?.edit_token || result?.data?.edit_token || state.token;
}
export function platformSupports(ctx, kind) { const components = ctx.capabilities?.message_components; if (!components || components[kind] == null) return false; return components[kind] === true; }
export function statusText(value) { return value === true ? "已开启" : value === false ? "已关闭" : "—"; }
export {api, card, row, toggle, textField, numberField, select, tagInput, saveBar, setSaveState, link, more, foldCard, statusBadge};
