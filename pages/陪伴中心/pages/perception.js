import {ensureStyles, esc, card, row, toggle, textField, numberField, select, saveBar, setSaveState, settingsOf, tokenOf, postChanges, postAction, status, empty, buttonBar, summaryGrid, more, advancedCard, pathJoin, fieldRows, confirmAction} from "./ability-shared.js";

const CHANNELS = [
  ["当前日期与时间", "时空", "calendar"], ["所在地与天气", "时空", "weather"], ["天气预警", "时空", "weather_alert"], ["日历与节气", "时空", "calendar_detail"],
  ["对话模型", "模型能力", "model"], ["视觉模型", "模型能力", "vision"], ["语音模型", "模型能力", "voice"], ["生图模型", "模型能力", "image"],
  ["手机与定位", "现实功能", "reality"], ["屏幕观察", "现实功能", "screen"], ["摄像头", "现实功能", "camera"], ["米家设备", "现实功能", "mihome"],
  ["外部资讯", "外部与记录", "news"], ["余额感知", "外部与记录", "balance"], ["撤回记录", "外部与记录", "recalls"], ["语义素材", "外部与记录", "semantic"]
];
const BALANCE_FIELDS = [["url", "数据地址", "text"], ["user_id", "用户编号", "text"], ["value_divisor", "换算系数", "number", ""], ["api_key", "访问密钥", "text"]];
const WEATHER_FIELDS = [["provider", "数据源", "select", {qweather: "和风天气", open_meteo: "公开天气服务"}], ["api_key", "访问密钥", "text"], ["base_url", "地址", "text"]];
const NATIVE_FIELDS = [["news_source_kind", "资讯源类型", "select", {host: "默认服务", disabled: "关闭", bilibili: "B 站", rss: "资讯订阅", json: "结构化数据"}], ["news_source_url", "资讯源地址", "text"], ["news_source_uid", "B 站账号编号", "text"], ["news_source_limit", "每次条数", "number", "条"]];
const SCREEN_FIELDS = [["enabled", "启用屏幕观察", "bool"], ["recent_observation_enabled", "保存最近观测", "bool"], ["max_observations", "最近观测上限", "number", "条"]];
const FALLBACK_REALITY = [["location", "定位"], ["mobile", "手机"], ["screen", "屏幕"], ["camera", "摄像头"], ["mihome", "米家"], ["microphone", "麦克风"], ["contacts", "联系人"], ["calendar", "日历"]];
const safeGet = async (ctx, path, query) => { if (!path) return {}; try { return await ctx.api.get(path, query); } catch (_) { return {}; } };
const settingData = (data, section = "") => section ? (data?.sections?.[section] || data?.[section] || {}) : settingsOf(data);
const capabilityItems = data => Array.isArray(data?.capabilities) ? data.capabilities : data?.capabilities && typeof data.capabilities === "object" ? Object.entries(data.capabilities).map(([id, value]) => ({id, ...value})) : FALLBACK_REALITY.map(([id, name]) => ({id, name, invokable: true}));
const channelText = (key, data) => {
  const value = data[key] || {};
  if (key === "weather") return value?.settings?.planning_weather_location || value.location || value.status || "天气地点待配置";
  if (key === "model") { const tasks = value.tasks || value.data?.tasks || []; return tasks.length ? `${tasks.length} 项任务` : value.status || "模型状态待检查"; }
  if (key === "voice") { const providers = value.providers || value.data?.providers || []; return providers.length ? "语音服务已发现" : value.status || "暂无语音服务"; }
  if (key === "image") { const actions = value.actions || value.data?.actions || []; return actions.length ? "图像动作已发现" : value.status || "暂无图像动作"; }
  if (key === "balance") return value.source || value.settings?.url || "尚未配置数据源";
  if (key === "recalls") return Array.isArray(value.entries) ? `${value.entries.length} 条近期记录` : value.status || "近期记录待检查";
  if (key === "semantic") return value.state || value.settings?.state || "语义目录待检查";
  return value.state || value.status || value.value || "通道待检查";
};
const available = (key, data) => Boolean(data[key] && Object.keys(data[key]).length);

const page = {
  id: "ability-perception", section: "能力", title: "感知",
  async render(root, ctx) {
    ensureStyles(); root.innerHTML = `<div class="page-loading">正在读取感知通道</div>`;
    const role = ctx.role || {};
    const configPath = role.config_api || (role.reply_api || "").replace(/\/reply$/, "/config");
    const paths = {
      model: role.model_api, voice: role.voice_api, image: role.image_api,
      perception: role.perception_native_api ? pathJoin(role.perception_native_api, "runtime") : "",
      native: role.perception_native_api, screen: role.screen_access_api,
      reality: role.reality_access_api, recalls: role.reply_api ? pathJoin(role.reply_api, "recalls") : "",
      extensions: "extensions", balance: "host-options/balance", weather: "host-options/weather", semantic: "semantic"
    };
    const reads = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await safeGet(ctx, path, key === "recalls" ? {limit: 5} : undefined)]));
    const data = Object.fromEntries(reads);
    const config = await safeGet(ctx, configPath, {sections: "screen,proactive.contact"});
    const screenSettings = settingData(config, "screen");
    const proactive = settingData(config, "proactive.contact");
    const state = {balance: settingData(data.balance), weather: settingData(data.weather), native: settingData(data.native), screen: {...screenSettings}, tokens: {balance: tokenOf(data.balance), weather: tokenOf(data.weather), native: tokenOf(data.native), screen: tokenOf(config?.sections?.screen || config?.screen || config)}, drafts: {}, notice: "", busy: false};
    state.drafts = {balance: {...state.balance}, weather: {...state.weather}, native: {...state.native}, screen: {...state.screen}};
    const platformId = String(ctx.target?.platform_id || "");
    const draw = () => {
      const groups = [...new Set(CHANNELS.map(item => item[1]))];
      const channels = groups.map(group => `<div class="ability-channel-group"><h3>${esc(group)}</h3>${CHANNELS.filter(item => item[1] === group).map(([label, , key]) => `<div class="ability-channel"><span class="ability-channel-name">${esc(label)}</span>${status(available(key, data) ? "可读" : "待检查", available(key, data) ? "ready" : "pending")}<span class="ability-channel-value">${esc(channelText(key, data))}</span></div>`).join("")}</div>`).join("");
      const balanceMore = `<div data-form-kind="balance-more" class="ability-form">${row("移除配置", '<button type="button" class="ability-button is-danger" data-remove-balance>移除数据源</button>')}</div>`;
      const balance = card("余额数据源", `<div data-form-kind="balance" class="ability-form">${fieldRows(state.drafts.balance, BALANCE_FIELDS)}</div>${more(balanceMore, "更多")}${buttonBar('<button type="button" class="ability-button" data-balance-test>测试数据源</button>')}`);
      const weather = card("天气数据源", `<div data-form-kind="weather" class="ability-form">${fieldRows(state.drafts.weather, WEATHER_FIELDS)}</div>`);
      const nativeMore = `<div data-form-kind="native-more" class="ability-form">${fieldRows(state.drafts.native, NATIVE_FIELDS.slice(3))}</div>`;
      const native = paths.native ? card("原生感知设置", `<div data-form-kind="native" class="ability-form">${fieldRows(state.drafts.native, NATIVE_FIELDS.slice(0, 3))}</div>${more(nativeMore, "更多")}`) : "";
      const screenInstalled = data.extensions?.screen?.assembled || data.extensions?.screen?.desired_state === "assembled" || Boolean(paths.screen);
      const screenMore = `<div data-form-kind="screen-more" class="ability-form">${fieldRows(state.drafts.screen, SCREEN_FIELDS.slice(2))}${summaryGrid([["最近观测", data.screen?.last_observation || data.screen?.last || "暂无"]])}</div>`;
      const screenCard = screenInstalled ? card("屏幕观察", `<div data-form-kind="screen" class="ability-form">${fieldRows(state.drafts.screen, SCREEN_FIELDS.slice(0, 2))}</div>${more(screenMore, "更多")}`) : "";
      const proactiveCard = card("主动联系素材条件", `${summaryGrid([["天气", proactive.weather_enabled === false ? "未提供" : "可用"], ["资讯", proactive.news_share_enabled === false ? "未提供" : "可用"], ["余额", proactive.balance_awareness_enabled === false ? "未提供" : "可用"]])}<div class="ability-readonly-line"><span>编辑位置</span><span>生活 › 主动联系</span><button type="button" class="ability-link-button" data-nav="生活/主动联系">去设置</button></div>`);
      const reality = paths.reality ? card("现实触及", capabilityItems(data.reality).map(item => {
        const id = item.id || item.capability_id || item.name || "capability";
        const settings = item.settings || item.config || {};
        const fields = Object.entries(settings).slice(0, 12).map(([key, value]) => [key, key, typeof value === "boolean" ? "bool" : typeof value === "number" ? "number" : "text", typeof value === "number" ? "" : ""]);
        const body = fields.length ? `<div data-reality-id="${esc(id)}" class="ability-form">${fieldRows(settings, fields)}</div>${buttonBar(`<button type="button" class="ability-button is-primary" data-reality-save="${esc(id)}">保存</button>`)}` : empty(item.invokable === false ? "当前能力未授权" : "没有可编辑参数");
        return `<details class="ability-more"><summary>${esc(item.name || id)}<span>${status(item.invokable === false ? "未授权" : item.state || "可用", item.invokable === false ? "muted" : "ready")}</span></summary><div class="ability-more-body">${body}</div></details>`;
      }).join("")) : "";
      root.innerHTML = `<div class="page-stack">${state.notice ? `<div class="ability-notice">${esc(state.notice)}</div>` : ""}${card("感知通道总览", `<div class="ability-channel-board">${channels}</div>`, {meta: `${platformId || "当前平台"} · 16 通道`})}${balance}${weather}${native}${screenCard}${reality}${proactiveCard}${saveBar("perception", {disabled: state.busy})}</div>`;
    };
    draw();
    const formKind = field => field.closest("[data-form-kind]")?.dataset.formKind || "";
    const readField = field => field.type === "number" ? Number(field.value || 0) : field.value;
    root.addEventListener("click", async event => {
      const nav = event.target.closest("[data-nav]"); if (nav) { ctx.navigate(nav.dataset.nav); return; }
      const sw = event.target.closest("[data-ui-toggle]");
      if (sw) { const key = sw.dataset.uiToggle, value = sw.getAttribute("aria-checked") !== "true"; sw.setAttribute("aria-checked", String(value)); sw.classList.toggle("is-on", value); const kind = formKind(sw); if (kind && state.drafts[kind]) state.drafts[kind][key] = value; return; }
      const remove = event.target.closest("[data-remove-balance]");
      if (remove && await confirmAction("移除余额数据源配置？")) { try { await postAction(ctx, "host-options/balance", {changes: {url: "", user_id: "", value_divisor: 1, api_key: ""}}, "balance-remove"); state.notice = "余额数据源已移除"; } catch (_) { state.notice = "移除失败"; } draw(); return; }
      const test = event.target.closest("[data-balance-test]");
      if (test) { test.disabled = true; test.textContent = "测试中"; try { const result = await ctx.api.post("host-options/balance/test", {operation_key: ctx.api.operationKey("balance-test")}); test.textContent = result?.reachable === false ? "不可达" : "测试完成"; } catch (_) { test.textContent = "测试失败"; } setTimeout(() => { test.disabled = false; test.textContent = "测试数据源"; }, 1500); return; }
      const save = event.target.closest("[data-ui-save]");
      if (save) {
        const kind = "perception"; state.busy = true; setSaveState(root, kind, "保存中");
        try { const entries = [["balance","host-options/balance",""],["weather","host-options/weather",""],["native",pathJoin(paths.native,"configure"),""],["screen",configPath,"screen"]]; for (const [name,path,section] of entries) { if (!path || !state.drafts[name]) continue; const result = await postChanges(ctx,path,state.drafts[name],state.tokens[name],section); state.tokens[name] = tokenOf(result) || state.tokens[name]; } state.notice = "配置已保存"; setSaveState(root, kind, "已保存", "ok"); }
        catch (_) { setSaveState(root, kind, "保存失败", "error"); }
        state.busy = false; draw(); return;
      }
      const realitySave = event.target.closest("[data-reality-save]");
      if (realitySave) { const id = realitySave.dataset.realitySave, box = root.querySelector(`[data-reality-id="${CSS.escape(id)}"]`), changes = {}; box?.querySelectorAll("[data-ui-field]").forEach(field => { changes[field.dataset.uiField] = readField(field); }); box?.querySelectorAll("[data-ui-toggle]").forEach(node => { changes[node.dataset.uiToggle] = node.getAttribute("aria-checked") === "true"; }); try { await postChanges(ctx, pathJoin(paths.reality, `${id}/configure`), changes, tokenOf(data.reality)); state.notice = `${id} 已保存`; } catch (_) { state.notice = "现实触及保存失败"; } draw(); }
    });
    root.addEventListener("input", event => { const field = event.target.closest("[data-ui-field]"); if (!field) return; const kind = formKind(field); if (state.drafts[kind]) state.drafts[kind][field.dataset.uiField] = readField(field); });
    root.addEventListener("change", event => { const field = event.target.closest("[data-ui-field]"); if (!field) return; const kind = formKind(field); if (state.drafts[kind]) state.drafts[kind][field.dataset.uiField] = readField(field); });
  }
};
export default page;
