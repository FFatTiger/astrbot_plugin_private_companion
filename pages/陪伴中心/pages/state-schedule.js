import {card, saveBar, link} from "../ui.js";
import {ensureStyles, safeGet, safePost, op, formRows, detailsCard, pageStack, notice, actions, lifeButton, confirm, editDialog, stateLabel, dateText, scopeNote, targetIsPrivate, bindForm, applyDependencies, bindNavigation, valueOf, esc} from "./life-shared.js";

const stateFields = [
  {name:"enabled",label:"启用后台状态维护",type:"bool",default:true},{name:"maintenance_minutes",label:"维护间隔",type:"number",unit:"分钟",default:30},{name:"calendar_enabled",label:"启用角色日程",type:"bool",default:false},{name:"schedule_simulation_mode",label:"日程模式",type:"select",choices:{continuous:"连续日程",orchestrated:"日程编排"},default:"orchestrated"},{name:"planning_enabled",label:"启用自动规划",type:"bool",default:false},{name:"planning_timezone",label:"规划时区",type:"text",default:"Asia/Shanghai"},{name:"planning_horizon_days",label:"长期规划范围",type:"number",unit:"天",default:7},{name:"planning_refine_minutes",label:"提前细化时间",type:"number",unit:"分钟",default:30},{name:"planning_max_items",label:"每次最多安排",type:"number",unit:"项",default:8},{name:"planning_prompt",label:"规划偏好",type:"textarea",default:""},{name:"planning_annual_calendars",label:"年度日历与调休",type:"textarea",default:""},
  {name:"planning_weather_enabled",label:"启用角色天气感知",type:"bool",default:false},{name:"planning_weather_location",label:"角色天气地点",type:"text",default:""},{name:"planning_weather_max_age_minutes",label:"天气最长沿用",type:"number",unit:"分钟",default:60},
  {name:"energy_enabled",label:"模拟能量",type:"bool",default:true},{name:"health_enabled",label:"模拟健康",type:"bool",default:true},{name:"hunger_enabled",label:"模拟饥饿",type:"bool",default:true},{name:"sleep_enabled",label:"模拟睡眠",type:"bool",default:true},{name:"cycle_enabled",label:"启用生理期模拟",type:"bool",default:false},{name:"mood_enabled",label:"启用心情模拟",type:"bool",default:true},{name:"busy_enabled",label:"模拟忙碌",type:"bool",default:true},{name:"location_enabled",label:"模拟位置",type:"bool",default:true},
  ...["energy","health","hunger","sleep","cycle","mood","busy","location"].map(name => ({name:`home_show_${name}`,label:`首页展示 · ${name}`,type:"bool",default:true})),
  {name:"home_only_special_health",label:"健康仅特殊状态展示",type:"bool",default:false},{name:"home_only_special_hunger",label:"饥饿仅特殊状态展示",type:"bool",default:false},{name:"home_only_special_sleep",label:"睡眠仅失眠时展示",type:"bool",default:false},{name:"home_only_special_cycle",label:"生理期仅经期展示",type:"bool",default:false},{name:"home_only_special_busy",label:"忙碌仅忙碌时展示",type:"bool",default:false},
  {name:"humanized_state_intensity",label:"状态表达强度",type:"number",unit:"/100",default:50},{name:"energy_expression_prompt",label:"精力模拟引导",type:"textarea",default:""},{name:"health_expression_prompt",label:"健康感受引导",type:"textarea",default:""},{name:"hunger_expression_prompt",label:"饥饿感受引导",type:"textarea",default:""},
  {name:"cycle_mode",label:"生理期阶段模式",type:"select",choices:{basic:"基础三阶段",six_phase:"六阶段"},default:"six_phase"},{name:"cycle_timezone",label:"周期时区",type:"text",default:"Asia/Shanghai"},{name:"cycle_initialization",label:"首次定位方式",type:"select",choices:{natural:"自然定位",unknown:"暂不定位",first_day:"从第 1 天开始"},default:"natural"},{name:"cycle_variation_enabled",label:"允许阶段天数波动",type:"bool",default:false},{name:"cycle_discomfort_enabled",label:"允许模拟不适",type:"bool",default:false},{name:"cycle_link_intensity",label:"精力随周期缩放",type:"bool",default:true},{name:"cycle_discomfort_chance",label:"不适参考概率",type:"number",unit:"%",default:20},{name:"cycle_discomfort_types",label:"可选体感",type:"text",default:"痛经,头痛,腰酸"},{name:"cycle_expression_prompt",label:"阶段表达偏好",type:"textarea",default:""},
  {name:"mood_update_probability",label:"每轮更新心情概率",type:"number",unit:"0–1",step:.01,default:.2},{name:"mood_update_max_delta",label:"单轮最大变化",type:"number",unit:"级",default:2},{name:"mood_decay_half_life_minutes",label:"心情半衰期",type:"number",unit:"分钟",default:180},{name:"daily_state_patrol_enabled",label:"启用每日状态巡视",type:"bool",default:false},{name:"daily_state_patrol_time",label:"巡视时刻",type:"time",default:"04:00"},{name:"daily_state_patrol_retention_days",label:"巡视记录保留",type:"number",unit:"天",default:30},
  {name:"typing_enabled",label:"正在输入提示",type:"bool",default:false},{name:"typing_refresh_seconds",label:"输入提示刷新间隔",type:"number",unit:"秒",default:3},{name:"presence_enabled",label:"QQ 自定义短状态",type:"bool",default:false},{name:"online_status_enabled",label:"QQ 在线状态",type:"bool",default:false}
];
const cyclePhaseFields = ["menstrual","follicular","pre_ovulation","ovulation","luteal","pms"].flatMap((phase, index) => [
  {name:`cycle_${phase}_days`,label:`${["经期","卵泡期","排卵前","排卵期","黄体期","经前期"][index]}天数`,type:"number",unit:"天",default:5},
  {name:`cycle_${phase}_energy`,label:`${["经期","卵泡期","排卵前","排卵期","黄体期","经前期"][index]}精力偏移`,type:"number",unit:"级",default:0},
  {name:`cycle_${phase}_prompt`,label:`${["经期","卵泡期","排卵前","排卵期","黄体期","经前期"][index]}表达引导`,type:"textarea",default:""},
  {name:`cycle_${phase}_mood`,label:`${["经期","卵泡期","排卵前","排卵期","黄体期","经前期"][index]}氛围词`,type:"text",default:""}
]);
stateFields.push(...cyclePhaseFields);
const dashboardFields = ["energy","health","hunger","sleep","cycle","mood","busy","location"];
const presentationFields = stateFields.filter(field => ["typing_enabled","typing_refresh_seconds","presence_enabled","online_status_enabled"].includes(field.name));
const windowStateFields = stateFields.filter(field => field.name === "enabled" || field.name === "maintenance_minutes" || field.name.startsWith("home_show_") || field.name.startsWith("home_only_special_") || field.name.endsWith("_enabled") || presentationFields.some(item => item.name === field.name));
function settingsOf(result) { return {...Object.fromEntries(stateFields.map(field => [field.name, field.default ?? ""])), ...(result?.settings || {})}; }
function dashboard(result) {
  const values = result?.state?.values || {};
  if (result?.settings?.enabled === false) return card("状态看板", `<div class="life-empty"><strong>后台状态维护已关闭</strong><span>已有记录保留；打开「后台维护与首页展示」中的总开关后才会继续更新。</span></div>`);
  return card("状态看板", `<div class="life-status-grid">${dashboardFields.map(name => `<button type="button" class="life-status-tile" data-status-feature="${name}"><strong>${esc({energy:"能量",health:"健康",hunger:"饥饿",sleep:"睡眠",cycle:"生理期",mood:"心情",busy:"忙碌",location:"位置"}[name])}</strong><span>${esc(typeof values[name] === "object" ? values[name]?.description || values[name]?.value : values[name] ?? "尚未记录")}</span></button>`).join("")}</div><div class="life-status-updated">${result?.state?.updated_at ? `更新于 ${esc(dateText(result.state.updated_at))}` : "尚无更新记录"}</div>`);
}
function calendarCard(result, qq = false) {
  const items = result?.occurrences || result?.calendar || [];
  return card("日程条目", `<div class="life-calendar-list">${Array.isArray(items) && items.length ? items.map(item => `<article><div><strong>${esc(item.title || item.name || "未命名日程")}</strong><span>${esc(dateText(item.starts_at || item.start_at || item.due_at))}</span></div><div>${lifeButton("改整组", `calendar-revise:${item.id}`, {secondary:true})}${lifeButton("仅改本次", `calendar-exception:${item.id}`, {secondary:true})}${lifeButton("取消", `calendar-cancel:${item.id}`, {danger:true})}${lifeButton("提醒", `calendar-remind:${item.id}`, {secondary:true})}${qq ? lifeButton("公开短文案", `calendar-presence:${item.id}`, {secondary:true}) : ""}</div></article>`).join("") : `<p class="life-muted">暂无日程条目。</p>`}</div>${lifeButton("创建日程", "calendar-create")}`);
}
const page = {
  id:"life-state", section:"生活", title:"状态与日程",
  async render(root, ctx) {
    ensureStyles();
    if (!targetIsPrivate(ctx) || !ctx.role?.state_api) { root.innerHTML = pageStack(card("状态与日程", `<div class="life-empty"><strong>当前范围没有角色状态工作区</strong><span>群目标不提供独立的角色状态写入入口。</span>${link("查看角色默认", "生活/状态与日程")}</div>`)); return; }
    root.innerHTML = `<div class="page-loading">正在读取</div>`;
    let result;
    try { result = await safeGet(ctx, ctx.role.state_api, {limit:100}); if (result?.settings?.planning_weather_enabled) result.weather = await safeGet(ctx, `${ctx.role.state_api}/weather`, {refresh:"0"}); }
    catch (_) { root.innerHTML = `<div class="page-empty">状态工作区暂时不可用</div>`; return; }
    const settings = settingsOf(result), editable = ctx.scope === "role" || ctx.scope === "object", editableFields = ctx.scope === "object" ? windowStateFields : stateFields;
    const render = () => {
      const qq = ctx.capabilities?.presence != null;
      root.innerHTML = pageStack(`${dashboard(result)}${card("环境", `<div class="life-environment-grid"><span><b>天气</b>${esc(result?.weather?.state || (settings.planning_weather_enabled ? "已启用" : "未启用"))}</span><span><b>时区</b>${esc(settings.planning_timezone)}</span><span><b>QQ 状态</b>${qq ? "可配置" : "当前平台只读"}</span><span><b>日程模式</b>${esc(settings.schedule_simulation_mode)}</span></div>`)}${detailsCard("后台维护与首页展示", editableFields.slice(0, 11).concat(editableFields.slice(15, 32)), settings)}${detailsCard("天气", editableFields.slice(11, 14), settings, {advanced:true})}${detailsCard("状态模拟与表达", editableFields.slice(14), settings, {advanced:true})}${settings.cycle_enabled ? card("周期校准", lifeButton("周期校准", "cycle-align", {secondary:true})) : ""}${calendarCard(result, qq)}${card("立即更新", `${lifeButton("立即更新", "maintain")}${result?.maintenance?.result ? `<span class="life-inline-note">${esc(stateLabel(result.maintenance.result.state))}</span>` : ""}`)}${card("QQ 展示与回执", qq ? `${formRows(presentationFields, settings)}<div class="life-receipts">${(result?.presentation_diagnostics?.receipts || result?.presentation?.receipts || []).slice(0, 5).map(item => `<div><span>${esc(item.channel || "展示")}</span><b>${esc(stateLabel(item.state))}</b></div>`).join("") || `<span class="life-muted">暂无展示回执。</span>`}</div>` : `<span class="life-muted">当前平台没有 QQ 展示端口，设置仅在 QQ 目标下可用。</span>`)}${editable ? saveBar("state", {disabled:true}) : ""}${notice()}`);
      if (editable) bindForm(root, editableFields, settings, async changes => {
        const roleFields = new Set(stateFields.map(field => field.name));
        const action = ctx.scope === "role" ? "configure_role" : "configure_window";
        const token = ctx.scope === "role" ? result.role_edit_token : result.edit_token;
        await safePost(ctx, `${ctx.role.state_api}/command`, {action, ...op(`state-${action}`), ...(ctx.scope === "role" ? {role_edit_token:token} : {edit_token:token}), changes});
      }, "state");
      applyDependencies(root, [
        {parent:"enabled", child:"calendar_enabled"}, {parent:"enabled", child:"energy_enabled"}, {parent:"enabled", child:"health_enabled"}, {parent:"enabled", child:"hunger_enabled"}, {parent:"enabled", child:"sleep_enabled"}, {parent:"enabled", child:"mood_enabled"},
        {parent:"calendar_enabled", child:"schedule_simulation_mode"}, {parent:"schedule_simulation_mode", child:"planning_enabled", test:value => value === "orchestrated"}, {parent:"schedule_simulation_mode", child:"planning_timezone", test:value => value === "orchestrated"}, {parent:"schedule_simulation_mode", child:"planning_horizon_days", test:value => value === "orchestrated"}, {parent:"schedule_simulation_mode", child:"planning_refine_minutes", test:value => value === "orchestrated"}, {parent:"schedule_simulation_mode", child:"planning_max_items", test:value => value === "orchestrated"}, {parent:"schedule_simulation_mode", child:"planning_prompt", test:value => value === "orchestrated"}, {parent:"schedule_simulation_mode", child:"planning_annual_calendars", test:value => value === "orchestrated"}, {parent:"calendar_enabled", child:"planning_enabled"}, {parent:"calendar_enabled", child:"planning_timezone"}, {parent:"calendar_enabled", child:"planning_horizon_days"}, {parent:"calendar_enabled", child:"planning_refine_minutes"}, {parent:"calendar_enabled", child:"planning_max_items"}, {parent:"calendar_enabled", child:"planning_prompt"}, {parent:"calendar_enabled", child:"planning_annual_calendars"},
        {parent:"planning_weather_enabled", child:"planning_weather_location"}, {parent:"planning_weather_enabled", child:"planning_weather_max_age_minutes"},
        {parent:"cycle_enabled", child:"cycle_mode"}, {parent:"cycle_enabled", child:"cycle_timezone"}, {parent:"cycle_enabled", child:"cycle_initialization"}, {parent:"cycle_enabled", child:"cycle_variation_enabled"}, {parent:"cycle_enabled", child:"cycle_discomfort_enabled"}, {parent:"cycle_enabled", child:"cycle_discomfort_chance"}, {parent:"cycle_enabled", child:"cycle_discomfort_types"}, {parent:"cycle_enabled", child:"cycle_expression_prompt"},
        {parent:"mood_enabled", child:"mood_update_probability"}, {parent:"mood_enabled", child:"mood_update_max_delta"}, {parent:"mood_enabled", child:"mood_decay_half_life_minutes"},
        {parent:"daily_state_patrol_enabled", child:"daily_state_patrol_time"}, {parent:"daily_state_patrol_enabled", child:"daily_state_patrol_retention_days"},
        {parent:"home_show_health", child:"home_only_special_health"}, {parent:"home_show_hunger", child:"home_only_special_hunger"}, {parent:"home_show_sleep", child:"home_only_special_sleep"}, {parent:"home_show_cycle", child:"home_only_special_cycle"}, {parent:"home_show_busy", child:"home_only_special_busy"}
      ]);
    };
    render();
    bindNavigation(root, ctx);
    root.addEventListener("click", async event => {
      const feature = event.target.closest("[data-status-feature]")?.dataset.statusFeature;
      if (feature) { const values = result?.state?.values || {}; const text = typeof values[feature] === "object" ? values[feature]?.description || values[feature]?.value : values[feature]; const box = root.querySelector("[data-life-notice]"); box.textContent = `${feature}：${text ?? "尚未记录"}`; return; }
      const action = event.target.closest("[data-life-action]")?.dataset.lifeAction; if (!action) return;
      if (["maintain","calendar-cancel","calendar-remind"].some(name => action.startsWith(name)) && !await confirm(root, "确认即时操作", action === "maintain" ? "立即排队更新状态？" : "确认执行这项日程操作？")) return;
      let payload = null;
      try {
        if (action === "maintain") payload = {action:"maintain", ...op("state-maintain"), view_token:result?.state?.view_token, expected_revision:result?.state?.revision};
        else if (action === "cycle-align") { const values = await editDialog(root, "周期校准", [{name:"applicability",label:"这次周期状态",type:"select",choices:{applicable:"指定当前周期日",not_applicable:"该角色不适用",unknown:"保持尚未确定",auto:"交回角色判断"},default:"auto"},{name:"day",label:"当前周期日",type:"number",default:1}], {}, "校准"); if (!values) return; payload = {action:"cycle.align", ...op("cycle-align"), expected_revision:result?.state?.revision, view_token:result?.state?.view_token, settings_token:result?.cycle_settings_token, data:{applicability:values.applicability,day:values.applicability === "applicable" ? values.day : null}}; }
        else if (action === "calendar-create") { const values = await editDialog(root, "创建日程", [{name:"title",label:"标题",type:"text"},{name:"starts_at",label:"开始时间",type:"text"},{name:"duration_minutes",label:"时长",type:"number",default:30},{name:"description",label:"备注",type:"textarea"}], {}, "创建"); if (!values) return; payload = {action:"calendar.create", ...op("calendar-create"), view_token:result?.state?.view_token, expected_revision:result?.state?.revision, id:crypto.randomUUID(), data:values}; }
        else if (action.startsWith("calendar-presence:")) { const values = await editDialog(root, "公开短文案", [{name:"text",label:"短文案（最多 8 字）",type:"text"}], {}, "发送"); if (!values) return; payload = {action:"calendar.presence", ...op("calendar-presence"), id:action.split(":")[1], view_token:result?.state?.view_token, expected_revision:result?.state?.revision, text:values.text}; }
        else if (action.startsWith("calendar-")) { const [name,id] = action.split(":"); const item = (result?.occurrences || result?.calendar || []).find(row => String(row.id) === id) || {}; const map = {"calendar-revise":"calendar.revise","calendar-exception":"calendar.exception","calendar-cancel":"calendar.cancel","calendar-remind":"calendar.remind"}; payload = {action:map[name], ...op(name), id, view_token:result?.state?.view_token, expected_revision:item.revision ?? result?.state?.revision}; if (name === "calendar-remind") payload.sequence = item.sequence || 0; if (name !== "calendar-cancel" && name !== "calendar-remind") payload.data = item; }
        else return;
        await safePost(ctx, `${ctx.role.state_api}/command`, payload); result = await safeGet(ctx, ctx.role.state_api, {limit:100}); render();
      } catch (_) { root.querySelector("[data-life-notice]").textContent = "操作未完成，请刷新核对状态或日程回执。"; }
    });
  }
};
export default page;
