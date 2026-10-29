import {api, card, foldCard, more, ensureConversationCss, readReply, replyState, renderFields, syncDependencies, setupEditor, saveReply, providersOf, platformSupports} from "./conversation-shared.js";
import {numberField, setSaveState, saveBar, link} from "../ui.js";

const show = (field, ...values) => ({field, values});
const yes = field => show(field, "true");
const sections = {
  segment: {
    common: ["enabled", {name:"streaming", label:"启用流式"}, {name:"streaming_mode", showWhen:yes("streaming")}, "rule_mode", {name:"split_words", showWhen:show("rule_mode","words")}],
    more: [{name:"match_width_variants", showWhen:show("rule_mode","words")}, {name:"rule_regex", showWhen:show("rule_mode","regex")}, "threshold", "min_segment_chars", "max_segments", "prompt", "part_gap_mode", {name:"part_gap_ms", showWhen:show("part_gap_mode","fixed")}, {name:"part_gap_min_ms", showWhen:show("part_gap_mode","random")}, {name:"part_gap_max_ms", showWhen:show("part_gap_mode","random")}, {name:"part_gap_log_base", showWhen:show("part_gap_mode","log")}]
  },
  style: {
    common: ["prompt_style_mode", "enable_humanized_expression"],
    more: [{name:"style_prompt", showWhen:show("prompt_style_mode","constraint","guided")}, {name:"humanized_expression_prompt", showWhen:yes("enable_humanized_expression")}]
  },
  cleanup: {
    common: ["content_cleanup_enabled", {name:"content_cleanup_mode", showWhen:yes("content_cleanup_enabled")}, {name:"content_cleanup_scope", showWhen:yes("content_cleanup_enabled")}, {name:"content_replacement_enabled", showWhen:yes("content_cleanup_enabled")}],
    more: [{name:"content_cleanup_rule", showWhen:show("content_cleanup_enabled","true")}, {name:"content_cleanup_words", showWhen:show("content_cleanup_enabled","true")}, {name:"content_replacements", showWhen:show("content_replacement_enabled","true")}]
  },
  voice: {
    common: ["voice_enabled", {name:"voice_trigger_mode", showWhen:yes("voice_enabled")}, {name:"voice_generation_mode", showWhen:yes("voice_enabled")}, {name:"voice_language", showWhen:yes("voice_enabled")}],
    more: [{name:"voice_conversion_scope", showWhen:yes("voice_enabled")}, {name:"voice_segment_mode", showWhen:yes("voice_enabled")}, {name:"voice_delivery_mode", showWhen:yes("voice_enabled")}, {name:"voice_foreign_text_mode", showWhen:yes("voice_enabled")}, {name:"voice_position", showWhen:yes("voice_enabled")}, {name:"voice_trigger_keywords", showWhen:yes("voice_enabled")}, {name:"voice_extra_prompt", showWhen:yes("voice_enabled")}, {name:"voice_primary_mention_keywords", showWhen:yes("voice_enabled")}, {name:"voice_primary_mention_probability", showWhen:yes("voice_enabled")}, {name:"voice_primary_mention_prompt", showWhen:yes("voice_enabled")}]
  },
  components: {
    common: ["component_order", "image_position", "reply_quote_enabled"],
    more: [{name:"reply_quote_group_enabled", showWhen:yes("reply_quote_enabled")}, {name:"reply_quote_first_part_only", showWhen:yes("reply_quote_enabled")}, {name:"reply_quote_skip_chars", showWhen:yes("reply_quote_enabled")}, {name:"reply_mention_speaker_enabled"}]
  },
  guard: {
    common: ["framework_error_guard_enabled", "enable_forbidden_word_recall"],
    more: [{name:"recall_forbidden_words", showWhen:yes("enable_forbidden_word_recall")}, {name:"recall_forbidden_scope", showWhen:yes("enable_forbidden_word_recall")}, {name:"recall_forbidden_word_case_sensitive", showWhen:yes("enable_forbidden_word_recall")}, "reply_diagnostic_limit"]
  }
};
const providerNames = ["voice_provider_id","voice_zh_provider_id","voice_ja_provider_id","voice_en_provider_id","voice_private_zh_provider_id","voice_private_ja_provider_id","voice_private_en_provider_id","voice_group_zh_provider_id","voice_group_ja_provider_id","voice_group_en_provider_id"];
const providerLabels = {voice_provider_id:"通用 TTS",voice_zh_provider_id:"中文 TTS",voice_ja_provider_id:"日语 TTS",voice_en_provider_id:"英语 TTS",voice_private_zh_provider_id:"私聊 · 中文 TTS",voice_private_ja_provider_id:"私聊 · 日语 TTS",voice_private_en_provider_id:"私聊 · 英语 TTS",voice_group_zh_provider_id:"群聊 · 中文 TTS",voice_group_ja_provider_id:"群聊 · 日语 TTS",voice_group_en_provider_id:"群聊 · 英语 TTS"};
const hostDefaults = {enabled:true, probability:0.2, private_probability:-1, group_probability:-1};
const hostLabels = {enabled:"允许语音回复", probability:"基础触发概率", private_probability:"私聊默认概率", group_probability:"群聊默认概率"};
const esc = value => String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
const area = (name, value, rows = 5) => `<textarea class="ui-textarea" data-speech-preview-input="${name}" rows="${rows}" aria-label="${name}">${esc(value)}</textarea>`;
function providerChoices(reply, ctx, fallback) { const options = {"": fallback}; providersOf(reply, ctx).forEach(item => { if (typeof item === "string") options[item] = item; else if (item?.id) options[item.id] = [item.id,item.model,item.voice].filter(Boolean).join(" · "); }); return options; }
function readOnlyDiagnostics(items) { const recent = Array.isArray(items) ? items : []; return `<details class="console-card conversation-fold"><summary class="card-title"><span>回复诊断</span><small>最近 ${recent.length} 轮</small></summary><div class="card-body conversation-diagnostics">${recent.length ? recent.map(item => `<details><summary>${esc(item.state || "状态未知")} · ${esc(item.response_type || "回应")} · ${esc(item.created_at || "时间未知")}</summary><p>任务 ${esc(item.turn_type || "conversation.reply")} · 有效输入 ${Number(item.current_inputs) || 0} 条 · 分段 ${Array.isArray(item.parts) ? item.parts.length : 0} 条</p>${item.failure_code ? `<p>失败分类：${esc(item.failure_code)}</p>` : ""}</details>`).join("") : `<p class="page-empty">暂无近期回复记录。</p>`}</div></details>`; }

const speechPage = {id:"conversation-speech", section:"对话", title:"说话", async render(root, ctx) {
  ensureConversationCss(); root.innerHTML = `<div class="page-loading">正在读取</div>`;
  if (!ctx.role?.reply_api) { root.innerHTML = `<div class="page-empty">当前对象不可用</div>`; return; }
  const raw = await readReply(ctx.role); const state = replyState(raw); state.onChange = () => syncDependencies(root, state.draft); const providers = providersOf(raw.reply, ctx); const group = ctx.target?.scope_kind === "group";
  const extraChoices = {}; providerNames.forEach(name => { extraChoices[name] = providerChoices(raw.reply, ctx, "跟随上级"); });
  const fieldSpecs = (key, groupOnly = false) => sections[key].common.map(spec => { if (typeof spec === "string") return spec; return spec; });
  const advanced = (key) => { const specs = sections[key].more.map(spec => key === "components" && spec.name === "reply_mention_speaker_enabled" ? {...spec, disabled: !group || !platformSupports(ctx,"mention")} : spec); return more(renderFields(state, specs, extraChoices)); };
  const makeCard = (title, key, meta = "") => card(title, `${renderFields(state, fieldSpecs(key), extraChoices)}${advanced(key)}`, {meta});
  const body = `${makeCard("分段回复","segment")}${makeCard("说话方式","style")}${makeCard("文字整理","cleanup")}${makeCard("语音与朗读","voice")}${makeCard("消息组件与引用","components",!platformSupports(ctx,"quote") ? "当前平台不提供引用" : "")}${makeCard("发送前检查","guard")}`;
  const providerFields = providerNames.filter(name => group || !name.startsWith("voice_group_")).map(name => ({name, label:providerLabels[name], showWhen:yes("voice_enabled")}));
  const providerCard = providers.length ? foldCard("TTS 语种绑定", renderFields(state, providerFields, extraChoices), {meta:"进阶"}) : foldCard("TTS 语种绑定", `<div class="conversation-muted">暂无可用 TTS Provider</div><p>${link("去系统 › 模型与连接", "系统/模型与连接")}</p>`, {meta:"进阶"});
  const host = await api.get("host-options").catch(() => ({})); const hostValue = {...hostDefaults, ...(host?.voice_reply || host?.voice || {})}; const hostToken = host?.edit_tokens?.voice || host?.voice?.edit_token || host?.edit_token || "";
  const hostRows = `<div class="ui-row"><label class="ui-label">${hostLabels.enabled}</label><div class="ui-control"><button type="button" class="ui-switch${hostValue.enabled ? " is-on" : ""}" role="switch" aria-checked="${Boolean(hostValue.enabled)}" data-host-toggle aria-label="${hostLabels.enabled}"></button></div></div>${["probability","private_probability","group_probability"].map(name => `<div class="ui-row"><label class="ui-label">${hostLabels[name]}</label><div class="ui-control">${numberField(`host_${name}`, Number(hostValue[name]) < 0 ? 0 : Number(hostValue[name] || 0) * 100, "%", {min:0,max:100,step:1,label:hostLabels[name]})}</div></div>`).join("")}`;
  root.innerHTML = `<div class="page-stack conversation-page" data-speech-root>${body}${providerCard}${foldCard("语音默认值", `${hostRows}${saveBar("host-voice", {disabled:true})}`, {meta:"进阶 · 安装范围"})}${foldCard("分段效果预览", `<div class="preview-grid"><label class="preview-input"><span>示例输入</span>${area("text", "我刚才整理了一下今天的安排。\n有一件小事想先和你说。\n剩下的我们可以慢慢聊。")}</label><label class="preview-input"><span>图片数量</span>${numberField("preview-image-count", 0, "张", {min:0,max:8,label:"图片数量"})}</label><button type="button" class="conversation-action" data-preview>计算预览</button></div><div class="conversation-preview" data-preview-result>尚未计算</div>`, {meta:"进阶"})}${saveBar("speech", {disabled:true})}${readOnlyDiagnostics(raw.reply?.recent)}<div class="conversation-reset"><button type="button" class="conversation-action" data-reset>全部恢复继承</button></div></div>`;
  setupEditor(root, state, "speech", async () => saveReply(ctx.role, state)); syncDependencies(root, state.draft);
  const hostDraft = {...hostValue}; const hostButton = root.querySelector('[data-ui-save="host-voice"]'); const markHost = () => { if (hostButton) hostButton.disabled = false; setSaveState(root,"host-voice",""); };
  root.addEventListener("click", async event => {
    const hostToggle = event.target.closest("[data-host-toggle]"); if (hostToggle) { const enabled = hostToggle.getAttribute("aria-checked") !== "true"; hostToggle.setAttribute("aria-checked", String(enabled)); hostToggle.classList.toggle("is-on", enabled); hostDraft.enabled = enabled; markHost(); return; }
    const hostSave = event.target.closest('[data-ui-save="host-voice"]'); if (hostSave && !hostSave.disabled) { hostSave.disabled=true; setSaveState(root,"host-voice","保存中"); try { const result = await api.post("host-options/voice", {operation_key:api.operationKey("host-voice"), edit_token:hostToken, changes:hostDraft}); Object.assign(hostDraft, result?.settings || result?.voice_reply || {}); setSaveState(root,"host-voice","已保存","ok"); } catch (_) { setSaveState(root,"host-voice","保存失败","error"); hostSave.disabled=false; } return; }
    if (event.target.closest("[data-preview]")) { const text = root.querySelector('[data-speech-preview-input="text"]')?.value || ""; const imageCount = Number(root.querySelector('[data-ui-field="preview-image-count"]')?.value || 0); const result = root.querySelector("[data-preview-result]"); result.textContent = "计算中"; try { const preview = await api.post(`${ctx.role.reply_api}/preview`, {settings:state.draft,text,image_count:imageCount}); result.innerHTML = Array.isArray(preview?.parts) ? preview.parts.map((part,index) => `<div><b>${index + 1}</b>${esc(part)}</div>`).join("") : "预览结果不可用"; } catch (_) { result.textContent = "预览失败"; } }
    if (event.target.closest("[data-reset]") && window.confirm("将当前说话设置全部恢复为继承值？")) { try { await saveReply(ctx.role,state,true); setSaveState(root,"speech","已恢复继承","ok"); } catch (_) { setSaveState(root,"speech","恢复失败","error"); } }
  });
  root.addEventListener("input", event => { const field = event.target.closest('[data-ui-field^="host_"]'); if (!field) return; const key = field.dataset.uiField.replace(/^host_/,''); hostDraft[key] = Number(field.value || 0) / 100; markHost(); });
  root.addEventListener("change", event => { const field = event.target.closest('[data-ui-field^="host_"]'); if (field) { const key = field.dataset.uiField.replace(/^host_/,''); hostDraft[key] = Number(field.value || 0) / 100; markHost(); } });
}};
export default speechPage;
