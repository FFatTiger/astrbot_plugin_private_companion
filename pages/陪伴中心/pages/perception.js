import {ensureStyles, esc, card, row, toggle, textField, numberField, select, saveBar, setSaveState, settingsOf, tokenOf, postChanges, postAction, status, empty, buttonBar, summaryGrid, more, advancedCard, pathJoin, fieldRows, confirmAction, extensionItems, extensionStateOf} from "./ability-shared.js";

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
// 读取结果连错误码一起留下：通道状态要区分「功能没开」和「真的读不到」。
const readOf = async (ctx, path, query) => {
  if (!path) return {value: {}, code: ""};
  try { return {value: await ctx.api.get(path, query), code: ""}; } catch (error) { return {value: {}, code: error?.code || "request_failed"}; }
};
const safeGet = async (ctx, path, query) => (await readOf(ctx, path, query)).value;
const settingData = (data, section = "") => settingsOf(section ? (data?.sections?.[section] || data?.[section] || {}) : data);
// 能力目录只认后端实际返回的清单；读不到就空，不按平台名猜一份“可调用”的能力。
const capabilityItems = data => Array.isArray(data?.capabilities) ? data.capabilities : data?.capabilities && typeof data.capabilities === "object" ? Object.entries(data.capabilities).map(([id, value]) => ({id, ...value})) : [];
// 后端给的是机器码：认得的翻成中文，认不出的原样显示，不替它编。
const REASON_TEXT = {
  reality_package_changed: "扩展已更新，待重新确认", screen_package_changed: "扩展已更新，待重新确认",
  capability_not_active: "扩展未启用", capability_role_disabled: "角色未启用该扩展",
  capability_consent_missing: "授权未开启", camera_consent_missing: "授权未开启",
  screen_read_consent_missing: "授权未开启", screen_process_consent_missing: "授权未开启",
  reality_tool_unavailable: "工具不可用", camera_tool_unavailable: "工具不可用", screen_tool_unavailable: "工具不可用",
  screen_repository_unavailable: "屏幕记录不可用", reality_provider_unavailable: "现实扩展不可用", reality_private_required: "仅私聊可用"
};
const reasonText = (reason, fallback, installedLabel = "未安装") => reason === "capability_not_installed" ? installedLabel : REASON_TEXT[reason] || (reason ? String(reason) : fallback);
const NEWS_LABELS = {host: "默认服务", bilibili: "B 站", rss: "资讯订阅", json: "网页数据", search: "网络搜索", hot: "热榜"};
const IMAGE_LABELS = {"image.generate": "生成", "image.edit": "改图", "image.mask_edit": "遮罩改图"};

const page = {
  id: "ability-perception", section: "能力", title: "感知",
  async render(root, ctx) {
    ensureStyles(); root.innerHTML = `<div class="page-loading">正在读取感知通道</div>`;
    const role = ctx.role || {};
    // 群目标的有效模型接口挂在 roleWithConfig 上，角色默认才在 role 上；和生图页同一口径。
    const modelApi = ctx.roleWithConfig?.()?.model_api || role.model_api;
    const configPath = ctx.roleWithConfig?.()?.config_api || "";
    const paths = {
      // 语音和生图没有独立接口：它们挂在模型接口的 voice / image 子路由上。
      model: modelApi, voice: pathJoin(modelApi, "voice"), image: pathJoin(modelApi, "image"),
      perception: role.perception_native_api ? pathJoin(role.perception_native_api, "runtime") : "",
      native: role.perception_native_api,
      screen: role.screen_access_api, reality: role.reality_access_api,
      recalls: role.reply_api && role.config_api ? pathJoin(role.reply_api, "recalls") : "",
      extensions: "integration/manifest", balance: "host-options/balance", weather: "host-options/weather", semantic: "semantic"
    };
    const queryOf = key => key === "recalls" ? {limit: 5} : key === "semantic" ? {target_id: ctx.target?.target_id, role_id: role.role_id} : undefined;
    const reads = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readOf(ctx, path, queryOf(key))]));
    const data = Object.fromEntries(reads.map(([key, result]) => [key, result.value]));
    const codes = Object.fromEntries(reads.map(([key, result]) => [key, result.code]));
    // proactive.contact 是安装级 section，只能从安装级 config 读；screen 在角色 config 上。
    const [config, installation] = await Promise.all([safeGet(ctx, configPath, {sections: "screen"}), safeGet(ctx, "config", {sections: "proactive.contact"})]);
    const screenSettings = settingData(config, "screen");
    const proactive = settingData(installation, "proactive.contact");
    const state = {balance: settingData(data.balance), weather: settingData(data.weather), native: settingData(data.native), screen: {...screenSettings}, tokens: {balance: tokenOf(data.balance), weather: tokenOf(data.weather), native: tokenOf(data.native), screen: tokenOf(config?.sections?.screen || config?.screen || config)}, drafts: {}, notice: "", busy: false};
    state.drafts = {balance: {...state.balance}, weather: {...state.weather}, native: {...state.native}, screen: {...state.screen}};
    const platformId = String(ctx.target?.platform_id || "");
    // 通道状态只认运行态：runtime 接口一次把日历/天气/屏幕/现实摊平，
    // 授权接口（screen_access / reality_access）只说明能不能调，不代表现在读到什么。
    const runtime = data.perception && typeof data.perception === "object" ? data.perception : {};
    const runtimePath = paths.perception, runtimeOk = Boolean(runtimePath) && Object.keys(runtime).length > 0;
    const channelStatus = key => {
      const failed = {tone: "pending", text: "读取失败"};
      const muted = text => ({tone: "muted", text});
      const ready = text => ({tone: "ready", text});
      // 该通道在当前范围（群目标）根本没有接口：属正常，不是读取失败。
      const onlyPrivate = () => muted("仅私聊可用");
      if (key === "calendar" || key === "calendar_detail") {
        if (!runtimePath) return onlyPrivate();
        if (!runtimeOk) return failed;
        const calendar = runtime.calendar || {};
        if (calendar.status !== "available") return muted(calendar.status === "disabled" ? "日期注入已关闭" : `日期状态 ${calendar.status || "未知"}`);
        if (key === "calendar") return ready([calendar.local_date, calendar.weekday, calendar.local_time].filter(Boolean).join(" ") || "已读取");
        const terms = calendar.automatic_solar_terms || {};
        const term = (terms.today || [])[0] || (terms.upcoming || [])[0]?.names?.[0] || "";
        const parts = [calendar.lunar_status === "available" ? calendar.lunar_date : "",
          calendar.holiday?.status === "available" ? calendar.holiday.label : "", term].filter(Boolean);
        return ready(parts.join(" · ") || "仅有公历日期");
      }
      if (key === "weather") {
        if (!runtimePath) return onlyPrivate();
        if (!runtimeOk) return failed;
        const weather = runtime.weather || {};
        if (weather.state === "available") {
          const temperature = typeof weather.temperature_c === "number" && Number.isFinite(weather.temperature_c) ? `${Math.round(weather.temperature_c)}°C` : "";
          return ready([weather.location, [weather.condition, temperature].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "已读取实况");
        }
        if (weather.state === "unconfigured") return muted("天气地点待配置");
        if (weather.state === "disabled") return muted("天气注入已关闭");
        if (weather.state === "unavailable") return muted("天气数据源暂不可用");
        return muted(`天气状态 ${weather.state || "未知"}`);
      }
      if (key === "weather_alert") {
        if (codes.weather) return failed;
        const alertsReady = data.weather?.alerts_ready;
        if (alertsReady === false) return muted("当前数据源不提供预警");
        if (alertsReady !== true) return muted("预警源状态未知");
        if (!runtimePath) return onlyPrivate();
        if (!runtimeOk) return failed;
        return ready(`${Number(runtime.weather?.alert_count) || 0} 条预警`);
      }
      if (key === "model" || key === "vision") {
        if (!paths.model) return muted("未配置模型接口");
        if (codes.model) return failed;
        const tasks = Array.isArray(data.model?.tasks) ? data.model.tasks : [];
        if (key === "model") return tasks.length ? ready(`${tasks.length} 项任务`) : muted("未配置模型任务");
        const vision = tasks.filter(task => Array.isArray(task?.capabilities) && task.capabilities.includes("image")).length;
        return vision ? ready(`${vision} 项识图任务`) : muted("未配置识图任务");
      }
      if (key === "voice") {
        if (!paths.voice) return muted("未配置模型接口");
        if (codes.voice) return failed;
        const voice = data.voice || {};
        // 绑定信息散在 languages[].bind 和 channels[].bindings 两处，任一处非空就算已绑定。
        const bound = (Array.isArray(voice.languages) && voice.languages.some(item => String(item?.bind || "").trim()))
          || (Array.isArray(voice.channels) && voice.channels.some(item => Object.values(item?.bindings || {}).some(value => String(value || "").trim())));
        return bound ? ready("已绑定") : muted("未绑定语音服务");
      }
      if (key === "image") {
        if (!paths.image) return muted("未配置模型接口");
        if (codes.image) return failed;
        const actions = Array.isArray(data.image?.actions) ? data.image.actions : [];
        const usable = actions.filter(item => item?.state === "ready").map(item => IMAGE_LABELS[item.action] || item.action);
        return usable.length ? ready(`${usable.join("/")}可用`) : muted("生图动作未就绪");
      }
      if (key === "screen") {
        if (!runtimePath) return onlyPrivate();
        if (!runtimeOk) return failed;
        const screen = runtime.screen || {};
        if (screen.state === "empty") return ready("暂无观测");
        if (screen.state === "available") return ready(screen.interpretation || "有最近观测");
        if (screen.state === "blocked" || screen.state === "unavailable") {
          return {tone: "muted", label: screen.reason === "capability_not_installed" ? "未安装" : "未开启", text: reasonText(screen.reason, screen.state === "blocked" ? "屏幕观察未授权" : "屏幕记录不可用", "屏幕扩展未安装")};
        }
        return muted(`屏幕状态 ${screen.state || "未知"}`);
      }
      if (key === "reality" || key === "camera" || key === "mihome") {
        if (!runtimePath) return onlyPrivate();
        if (!runtimeOk) return failed;
        const own = key === "camera" ? (runtime.camera || {}) : (runtime.reality || {});
        const state = own.state || "";
        const label = own.reason === "capability_not_installed" ? "未安装" : "未开启";
        // 米家没有独立接口，能说的只有现实扩展本身是否装好。
        if (key === "mihome") return {tone: "muted", label, text: reasonText(own.reason, "随现实扩展提供", "现实扩展未安装")};
        if (state === "blocked") return {tone: "muted", label, text: reasonText(own.reason, key === "camera" ? "摄像头未授权" : "未授权", "现实扩展未安装")};
        if (state === "unavailable") return {tone: "muted", label, text: reasonText(own.reason, "现实扩展不可用", "现实扩展未安装")};
        if (state === "available") {
          if (key === "camera") return ready(own.observation?.summary || own.observation?.scene_description || "有最近画面");
          const where = own.snapshot?.location?.available ? own.snapshot.location.label : "";
          return ready(where ? `手机位置 · ${where}` : "有最近快照");
        }
        if (state === "ready") return muted(key === "camera" ? "暂无观测" : "暂无快照");
        return muted(`现实状态 ${state || "未知"}`);
      }
      if (key === "news") {
        if (!paths.native) return onlyPrivate();
        const kind = data.native?.news?.settings?.news_source_kind ?? data.native?.contact?.settings?.news_source_kind ?? "";
        if (!kind) return muted("未配置");
        if (kind === "disabled") return muted("已关闭");
        return ready(`已配置 · ${NEWS_LABELS[kind] || kind}`);
      }
      if (key === "balance") {
        if (codes.balance) return failed;
        // host-options 返回整份安装级设置，余额只是其中一段。
        const view = data.balance || {}, balance = view.service_balance || view.balance || view;
        if (balance.source_state === "configured") return ready(balance.url || balance.provider || "数据源已配置");
        if (balance.source_state === "invalid") return muted("数据源配置无效");
        return muted("尚未配置数据源");
      }
      if (key === "recalls") {
        if (!paths.recalls) return onlyPrivate();
        if (codes.recalls === "recall_transcribe_disabled" || data.recalls?.enabled === false) return muted("撤回记录未开启");
        if (codes.recalls) return failed;
        const entries = Array.isArray(data.recalls?.entries) ? data.recalls.entries : [];
        return entries.length ? ready(`${entries.length} 条近期记录`) : muted("暂无近期记录");
      }
      if (key === "semantic") {
        if (codes.semantic) return failed;
        const state = data.semantic?.state || data.semantic?.settings?.state || "";
        if (state === "ready") return ready("语义检索可用");
        if (state === "disabled") return muted("语义检索已关闭");
        if (state === "lexical_fallback") return muted("仅词汇匹配");
        return muted(state || "语义目录未就绪");
      }
      return muted("未接入");
    };
    const PILL_TEXT = {ready: "可读", muted: "未开启", pending: "读取失败"};
    const draw = () => {
      const groups = [...new Set(CHANNELS.map(item => item[1]))];
      const channels = groups.map(group => `<div class="ability-channel-group"><h3>${esc(group)}</h3>${CHANNELS.filter(item => item[1] === group).map(([label, , key]) => { const channel = channelStatus(key); return `<div class="ability-channel"><span class="ability-channel-name">${esc(label)}</span>${status(channel.label || PILL_TEXT[channel.tone], channel.tone)}<span class="ability-channel-value">${esc(channel.text)}</span></div>`; }).join("")}</div>`).join("");
      const balanceMore = `<div data-form-kind="balance-more" class="ability-form">${row("移除配置", '<button type="button" class="ability-button is-danger" data-remove-balance>移除数据源</button>')}</div>`;
      const balance = card("余额数据源", `<div data-form-kind="balance" class="ability-form">${fieldRows(state.drafts.balance, BALANCE_FIELDS)}</div>${more(balanceMore, "更多")}${buttonBar('<button type="button" class="ability-button" data-balance-test>测试数据源</button>')}`);
      const weather = card("天气数据源", `<div data-form-kind="weather" class="ability-form">${fieldRows(state.drafts.weather, WEATHER_FIELDS)}</div>`);
      const nativeMore = `<div data-form-kind="native-more" class="ability-form">${fieldRows(state.drafts.native, NATIVE_FIELDS.slice(3))}</div>`;
      const native = paths.native ? card("原生感知设置", `<div data-form-kind="native" class="ability-form">${fieldRows(state.drafts.native, NATIVE_FIELDS.slice(0, 3))}</div>${more(nativeMore, "更多")}`) : "";
      // 屏幕设置卡只在 manifest 显示 screen 扩展已装配（assembled/desired_state）且 API 存在时出现。
      const screenExtension = extensionItems(data.extensions).find(item => item.extension_id === "screen") || {};
      const screenInstalled = Boolean(paths.screen) && extensionStateOf(screenExtension) === "assembled";
      const screenMore = `<div data-form-kind="screen-more" class="ability-form">${fieldRows(state.drafts.screen, SCREEN_FIELDS.slice(2))}${summaryGrid([["最近观测", data.screen?.last_observation || data.screen?.last || "暂无"]])}</div>`;
      const screenCard = screenInstalled ? card("屏幕观察", `<div data-form-kind="screen" class="ability-form">${fieldRows(state.drafts.screen, SCREEN_FIELDS.slice(0, 2))}</div>${more(screenMore, "更多")}`) : "";
      const proactiveCard = card("主动联系素材条件", `${summaryGrid([["天气", proactive.weather_enabled === false ? "未提供" : "可用"], ["资讯", proactive.news_share_enabled === false ? "未提供" : "可用"], ["余额", proactive.balance_awareness_enabled === false ? "未提供" : "可用"]])}<div class="ability-readonly-line"><span>编辑位置</span><span>生活 › 主动联系</span><button type="button" class="ability-link-button" data-nav="生活/主动联系">去设置</button></div>`);
      const realityItems = capabilityItems(data.reality);
      const reality = paths.reality ? card("现实触及", realityItems.length ? realityItems.map(item => {
        const id = item.id || item.capability_id || item.name || "capability";
        const settings = item.settings || item.config || {};
        const fields = Object.entries(settings).slice(0, 12).map(([key, value]) => [key, key, typeof value === "boolean" ? "bool" : typeof value === "number" ? "number" : "text", typeof value === "number" ? "" : ""]);
        const body = fields.length ? `<div data-reality-id="${esc(id)}" class="ability-form">${fieldRows(settings, fields)}</div>${buttonBar(`<button type="button" class="ability-button is-primary" data-reality-save="${esc(id)}">保存</button>`)}` : empty(item.invokable === false ? "当前能力未授权" : "没有可编辑参数");
        return `<details class="ability-more"><summary>${esc(item.name || id)}<span>${status(item.invokable === false ? "未授权" : item.state || "可用", item.invokable === false ? "muted" : "ready")}</span></summary><div class="ability-more-body">${body}</div></details>`;
      }).join("") : empty(data.reality?.installed === false ? "现实扩展未安装" : "能力目录暂不可读"), {meta: realityItems.length ? "" : "只读"}) : "";
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
        try { const entries = [["balance","host-options/balance",""],["weather","host-options/weather",""],["native",pathJoin(paths.native,"configure"),""],["screen",ctx.configEditable && configPath ? pathJoin(configPath, "configure") : "","screen"]]; for (const [name,path,section] of entries) { if (!path || !state.drafts[name]) continue; const result = await postChanges(ctx,path,state.drafts[name],state.tokens[name],section); state.tokens[name] = tokenOf(result) || state.tokens[name]; } state.notice = "配置已保存"; setSaveState(root, kind, "已保存", "ok"); }
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
