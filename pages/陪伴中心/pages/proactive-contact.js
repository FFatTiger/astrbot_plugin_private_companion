import {card, saveBar, setSaveState, link} from "../ui.js";
import {ensureStyles, contactGroups, contactFields, contactPurposeNames, contactSpec, contactChoices, safeGet, safePost, op, formRows, fieldControl, detailsCard, readonlyRows, pageStack, notice, actions, lifeButton, confirm, scopeNote, esc, valueOf, bindForm, applyDependencies, bindNavigation} from "./life-shared.js";

const purposeLabels = {affection:"想念与亲近",care:"情绪关怀",play:"轻松互动",repair:"关系修复",chat:"日常话题",greeting:"问候与纪念",followup:"接回旧话题",invitation:"共同活动邀请",reminder:"约定与提醒",meal:"饭点话题",life:"分享自己的生活",creation:"作品与阅读",news:"外部资讯",environment:"环境与状态变化",screen:"已授权屏幕观察",mobile_location:"手机地点主动消息",reaction_image:"带图主动消息"};
const purposeFields = contactPurposeNames.flatMap(name => [
  {name:`purpose.${name}.enabled`, label:`${purposeLabels[name]} · 启用`, type:"bool", default:true},
  {name:`purpose.${name}.weight`, label:`${purposeLabels[name]} · 相对权重`, type:"number", step:.01, default:1},
  {name:`purpose.${name}.pause_until`, label:`${purposeLabels[name]} · 暂缓至`, type:"text", default:""}
]);
const contactFieldNames = [...new Set(contactGroups.flatMap(group => group.fields).concat(["proactive_hour_activity_enabled","proactive_hour_activity_curve"], purposeFields.map(field => field.name)))];
const allFields = contactFieldNames.map(name => purposeFields.find(field => field.name === name) || contactSpec(name));
const windowFields = ["enabled","automatic_enabled","interval_seconds","idle_seconds","max_contacts_24h","note","quiet_enabled","quiet_start","quiet_end","quiet_timezone","pause_until","silence_min_confidence","weather_checkin_enabled","weather_checkin_time","weather_change_enabled","weather_sample_minutes","official_weather_alert_enabled","official_alert_poll_minutes","official_alert_min_severity","event_max_age_seconds","dedup_enabled"].map(contactSpec);

function curveMarkup(value) {
  const parts = String(value || "").replace(/，/g, ",").split(",");
  const values = Array.from({length:24}, (_, index) => Number.isFinite(Number(parts[index])) ? Number(parts[index]) : 1);
  return `<div class="life-curve" aria-label="24 小时活跃曲线">${values.map((item, index) => `<label><span>${String(index).padStart(2,"0")}</span><input type="number" min="0.05" max="2" step="0.05" value="${item}" data-curve-index="${index}" aria-label="${index} 时权重"></label>`).join("")}<textarea class="life-hidden-field" data-ui-field="proactive_hour_activity_curve" aria-label="24 小时活跃曲线">${esc(values.join(","))}</textarea></div>`;
}
function renderGroups(settings, readonly = false, readonlyNames = new Set()) {
  return contactGroups.map((group, index) => {
    if (group.title === "契机矩阵") {
      const renderPurpose = name => { const fields = purposeFields.filter(field => field.name.startsWith(`purpose.${name}.`)); const enabled = fields.find(field => field.name.endsWith(".enabled")); const weight = fields.find(field => field.name.endsWith(".weight")); const pause = fields.find(field => field.name.endsWith(".pause_until")); const disabled = readonly; return `<div class="life-purpose-row"><strong>${esc(purposeLabels[name])}</strong><span class="life-purpose-control">${fieldControl(enabled, valueOf(settings, enabled.name, true), disabled)}</span><span class="life-purpose-control">${fieldControl(weight, valueOf(settings, weight.name, 1), disabled)}</span><span class="life-purpose-control">${fieldControl(pause, valueOf(settings, pause.name, ""), disabled)}</span></div>`; };
      return card(group.title, `<div class="life-purpose-grid"><div class="life-purpose-head"><span>目的</span><span>开关</span><span>次数</span><span>暂停状态</span></div>${contactPurposeNames.map(renderPurpose).join("")}</div>`);
    }
    if (group.title === "外部触发源") {
      const fields = contactFields(group.fields).map(field => readonlyNames.has(field.name) ? {...field, type:"readonly"} : field);
      return readonly ? card(group.title, readonlyRows(fields, settings), {meta:"只读"}) : detailsCard(group.title, fields, settings, {meta:"天气、资讯、网络、饭点、日期、余额、屏幕与动作", advanced:true});
    }
    const fields = contactFields(group.fields).map(field => readonlyNames.has(field.name) ? {...field, type:"readonly"} : field);
    const commonNames = group.title === "开口节奏与每日额度" ? ["proactive_intensity_preset","enable_proactive_burst"] : group.title === "重复抑制与沉默" ? ["dedup_enabled","dedup_last_message_enabled"] : group.title === "问候与失眠" ? ["enable_daily_greetings","allow_insomnia_night_message"] : group.title === "晨间唤醒" ? ["morning_chain_enabled","morning_role_greeting_enabled","morning_nudge_enabled","routine_learning_enabled"] : undefined;
    return readonly ? card(group.title, readonlyRows(fields, settings), {meta:"只读"}) : detailsCard(group.title, fields, settings, {meta: index === 0 ? "安装级默认" : "", advanced:index >= 2, commonNames});
  }).join("");
}
function diagnosticCard() {
  const tests = [...contactPurposeNames, "mobile_location", "reaction_image"];
  return `<details class="console-card life-details"><summary class="card-title"><span>消息测试</span><small>17 项</small></summary><div class="card-body"><p class="life-card-note">选择测试目的后确认真实投递。</p><div class="life-diagnostic-grid">${tests.map(name => lifeButton(purposeLabels[name], `diagnostic:${name}`, {secondary:true})).join("")}</div></div></details>`;
}

const page = {
  id: "life-contact", section: "生活", title: "主动联系",
  async render(root, ctx) {
    ensureStyles(); root.innerHTML = `<div class="page-loading">正在读取</div>`;
    let status;
    try { status = await safeGet(ctx, ctx.scope === "object" ? ctx.role.config_api : "config", {sections:"proactive.contact"}); }
    catch (_) { root.innerHTML = `<div class="page-empty">主动联系设置暂时不可用</div>`; return; }
    const section = status?.sections?.["proactive.contact"] || status || {};
    const settings = {...Object.fromEntries(allFields.map(field => [field.name, field.default ?? ""])), ...(section.settings || {})};
    const isRole = ctx.scope === "role" || !ctx.scope, isWindow = ctx.scope === "object";
    const roleFields = allFields.filter(field => field.name !== "max_contacts_24h");
    const content = isRole ? `${renderGroups(settings, false, new Set(["max_contacts_24h"]))}${card("活动曲线", `${formRows([contactSpec("proactive_hour_activity_enabled")], settings)}<details class="life-more" data-curve-editor><summary><span>编辑 24 小时曲线</span><span aria-hidden="true">⌄</span></summary>${curveMarkup(settings.proactive_hour_activity_curve)}</details>`, {meta:"0:00–23:00"})}${diagnosticCard()}<details class="console-card life-details"><summary class="card-title"><span>主动检视</span></summary><div class="card-body"><div class="life-materials"><input class="ui-input" data-material-filter placeholder="按名称筛选素材">${lifeButton("读取素材", "materials", {secondary:true})}<div class="life-material-grid" data-material-grid><span>素材卡与筛选结果只读加载</span></div></div></div></details>` : `${renderGroups(settings, true)}${card("本窗口覆盖", `${formRows(windowFields, settings)}${scopeNote(ctx, true)}`, {meta:"当前对象 · 仅本窗口"})}`;
    root.innerHTML = pageStack(`${content}${isRole ? saveBar("contact", {disabled:true}) : isWindow ? saveBar("window-contact", {disabled:true}) : ""}${notice()}`);
    bindNavigation(root, ctx);
    if (isRole) {
      bindForm(root, roleFields, settings, async changes => {
        await safePost(ctx, "config/configure", {section:"proactive.contact", ...op("proactive-contact"), edit_token:section.edit_token || "", changes});
      }, "contact");
    }
    if (isWindow) {
      bindForm(root, windowFields, settings, async changes => { await safePost(ctx, `${ctx.role.config_api}/configure`, {section:"proactive.contact", ...op("window-proactive-contact"), edit_token:section.edit_token || "", changes}); }, "window-contact");
    }
    if (isRole) {
      applyDependencies(root, [
        {parent:"enabled", child:"automatic_enabled"}, {parent:"enabled", child:"interval_seconds"}, {parent:"enabled", child:"idle_seconds"},
        {parent:"quiet_enabled", child:"quiet_start"}, {parent:"quiet_enabled", child:"quiet_end"}, {parent:"quiet_enabled", child:"quiet_timezone"},
        {parent:"enable_daily_greetings", child:"greeting_morning_window"}, {parent:"enable_daily_greetings", child:"greeting_noon_window"}, {parent:"enable_daily_greetings", child:"greeting_evening_window"},
        {parent:"allow_insomnia_night_message", child:"insomnia_night_start"}, {parent:"allow_insomnia_night_message", child:"insomnia_night_end"}, {parent:"allow_insomnia_night_message", child:"insomnia_night_daily_limit"},
        {parent:"morning_chain_enabled", child:"morning_role_greeting_enabled"}, {parent:"morning_chain_enabled", child:"morning_nudge_enabled"}, {parent:"morning_chain_enabled", child:"wake_morning_start"}, {parent:"morning_chain_enabled", child:"wake_morning_end"},
        {parent:"news_source_kind", child:"news_source_uid", test:value => value === "bilibili"}, {parent:"news_source_kind", child:"news_source_url", test:value => value === "rss" || value === "json"}, {parent:"proactive_hour_activity_enabled", child:"proactive_hour_activity_curve"},
      ]);
    }
    root.addEventListener("input", event => {
      const curve = event.target.closest("[data-curve-index]"); if (!curve) return;
      const values = [...root.querySelectorAll("[data-curve-index]")].map(item => item.value || "1");
      const hidden = root.querySelector('[data-ui-field="proactive_hour_activity_curve"]'); if (hidden) { hidden.value = values.join(","); hidden.dispatchEvent(new Event("input", {bubbles:true})); }
    });
    root.addEventListener("click", async event => {
      const action = event.target.closest("[data-life-action]")?.dataset.lifeAction;
      if (!action) return;
      if (action === "materials") {
        const box = root.querySelector(".life-materials");
        try { const result = await safeGet(ctx, "perception-native/materials"); const items = result?.items || []; const filter = root.querySelector("[data-material-filter]")?.value.trim().toLowerCase() || ""; box.querySelector("[data-material-grid]").innerHTML = `<strong>${items.length} 张素材</strong>${items.filter(item => !filter || String(item.name || item.title || "").toLowerCase().includes(filter)).slice(0,24).map(item => `<span>${esc(item.name || item.title || "素材")}</span>`).join("")}`; }
        catch (_) { box.querySelector("[data-material-grid]").textContent = "素材暂不可用"; }
        return;
      }
      if (action.startsWith("diagnostic:")) {
        const purpose = action.split(":")[1];
        if (!await confirm(root, "确认真实投递", `将执行「${purposeLabels[purpose]}」测试，可能向当前私聊发送消息。`)) return;
        const node = root.querySelector(`[data-life-action="${action}"]`); if (node) node.disabled = true;
        try { await safePost(ctx, "setup/proactive-diagnostic", {purpose, confirm_delivery:true}); root.querySelector("[data-life-notice]").textContent = "测试已提交，请在回执中核对结果。"; }
        catch (_) { root.querySelector("[data-life-notice]").textContent = "测试未完成，请刷新回执。"; }
        finally { if (node) node.disabled = false; }
      }
    });
  }
};
export default page;
