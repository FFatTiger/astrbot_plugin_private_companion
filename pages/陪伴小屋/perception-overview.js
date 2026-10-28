"use strict";
window.CompanionPerceptionOverviewPage = (() => {
  const product = window.CompanionProduct;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const modelAvailabilityLabel = value => ({ready:"宸插氨缁?,disabled:"宸插叧闂?,missing:"灏氭湭閰嶇疆",unavailable:"鏆備笉鍙敤",
    unknown:"鐘舵€佸緟鏍稿",invalid:"閰嶇疆寰呮牳瀵?,failed:"璇诲彇澶辫触",unsupported:"鏆備笉鏀寔"})[value] || "鐘舵€佸緟鏍稿";
  let root = null, scope = "", snapshot = null, runtimeSnapshot = null, runtimeState = "loading";
  let modelStatus = null, modelState = "loading", voiceStatus = null, voiceState = "loading";
  let imageStatus = null, imageState = "loading", semanticStatus = null, semanticState = "loading";
  let recallStatus = null, recallState = "loading", recallError = "", mihomeStatus = null, mihomeState = "loading";
  let huaweiHealth = null, huaweiHealthState = "loading", huaweiHealthError = "";
  let materialPool = null, materialPoolState = "loading", materialPoolError = "";
  let itemPreviewMarkup = new Map(), activePreviewItemId = "";
  let balanceConfig = null, balanceDraft = null, balanceExpanded = false, balanceConfigLoading = false;
  let balanceWorkspace = null, balanceMarkup = "", selectedDestination = "", selectedModelTab = "", selectedItemId = "";
  let balanceStatus = null, balanceStatusLoading = false, balanceStatusRefreshQueued = false, balanceStatusError = "";
  let balanceSaving = false, balanceTesting = false, balanceTestResult = null;
  let balanceResultScope = "", balanceResultConfigToken = "", balanceResultConfigKey = "", balanceResultIsDraft = false;
  let balanceMessage = "", balanceError = "", balanceTestError = "";
  let unsubscribe = null, clockTimer = null, abort = null, generation = 0, lastDay = "";
  /* 鎰熺煡椤垫瘡娆℃崲璺敱閮戒細閲嶆柊鎸傝浇銆傛渶杩戜竴娆℃垚鍔熷揩鐓у彧鍦ㄥ綋鍓嶉〉闈㈠唴瀛樹腑
     鎸夎鑹?浼氳瘽鍜屽涓昏矾鐢变繚鐣欙紝杩斿洖鏃跺厛灞曠ず瀹冿紝鍐嶅紓姝ユ牳瀵规渶鏂扮姸鎬併€?*/
  const overviewCache = new Map();
  /* 浣欓灞炰簬褰撳墠瑙掕壊/浼氳瘽锛屼絾涓嶅睘浜庢煇涓叿浣撶殑鎰熺煡璺敱銆傚崟鐙瓨涓€浠斤紝
     杩欐牱浠庝华琛ㄧ洏鍒囧埌閰嶇疆銆佸啀鍒囧洖鏃朵笉浼氬洜涓轰笅鏂归厤缃伐浣滃尯琚嵏杞借€屼涪鎺?     鏈€杩戞垚鍔熻鏁般€傚彧鎸戦€夊彲瀹夊叏灞曠ず鐨勫瓧娈碉紱API 浠ょ墝鍜?edit token 姘镐笉缂撳瓨銆?*/
  const balanceCache = new Map();
  let overviewRouteKey = "";
  function activeScopeKey() {
    try {
      const scoped = product.scopeKey?.();
      if (scoped != null && String(scoped).trim()) return String(scoped);
      const role = product.role?.() || {};
      const selection = product.selection?.() || {};
      const fallback = [selection.installation_id, selection.target_id, role.installation_id,
        role.target_id, role.role_id, role.model_api].filter(value => value != null && String(value).trim());
      return fallback.length ? fallback.join(":") : "default";
    } catch (_) { return "default"; }
  }
  function routeKey() {
    try {
      const role = product.role?.() || {};
      return [role.model_api, role.perception_native_api, role.screen_access_api, role.reality_access_api].join("|");
    } catch (_) { return ""; }
  }
  function overviewCacheEntry() {
    const key = `${scope}:${overviewRouteKey}`;
    let entry = overviewCache.get(key);
    if (!entry) { entry = {}; overviewCache.set(key, entry); }
    return entry;
  }
  function rememberOverview(name, value, stateName, stateValue) {
    const entry = overviewCacheEntry();
    if (value != null) entry[name] = value;
    if (stateName) entry[stateName] = stateValue;
  }
  function forgetOverview(name, stateName) {
    const entry = overviewCacheEntry();
    delete entry[name];
    if (stateName) delete entry[stateName];
  }

  function safeBalanceConfig(value) {
    if (!value || typeof value !== "object") return null;
    return {
      source: value.source || "none",
      source_state: value.source_state || "not_configured",
      provider: value.provider || "newapi",
      url: typeof value.url === "string" ? value.url : "",
      user_id: typeof value.user_id === "string" ? value.user_id : "",
      value_divisor: String(value.value_divisor || "500000"),
      has_api_key: value.has_api_key === true,
    };
  }

  function safeBalanceDraft(value) {
    if (!value || typeof value !== "object") return null;
    return {
      url: typeof value.url === "string" ? value.url : "",
      user_id: typeof value.user_id === "string" ? value.user_id : "",
      value_divisor: String(value.value_divisor || "500000"),
      /* A typed nap_ token is deliberately discarded on route changes. */
      api_key: "",
      clear_configuration: value.clear_configuration === true,
    };
  }

  function safeBalanceObservation(value) {
    if (!value || typeof value !== "object") return null;
    const amount = Number(value.amount);
    if (value.available !== true || !Number.isFinite(amount) || amount < 0) return null;
    return {
      tested: value.tested === true,
      available: true,
      provider: typeof value.provider === "string" ? value.provider : "newapi",
      provider_label: typeof value.provider_label === "string" ? value.provider_label : "NewAPI",
      currency_label: typeof value.currency_label === "string" ? value.currency_label : "棰濆害",
      amount: formatBalanceAmount(amount),
      observed_at: typeof value.observed_at === "string" ? value.observed_at : "",
    };
  }

  function safeBalanceStatus(value) {
    if (!value || typeof value !== "object" || typeof value.configured !== "boolean"
        || typeof value.available !== "boolean") return null;
    const amount = Number(value.amount);
    if (value.available && (!Number.isFinite(amount) || amount < 0)) return null;
    return {
      configured:value.configured, available:value.available,
      provider:typeof value.provider === "string" ? value.provider : "newapi",
      provider_label:typeof value.provider_label === "string" ? value.provider_label : "NewAPI",
      currency_label:typeof value.currency_label === "string" ? value.currency_label : "棰濆害",
      amount:value.available ? formatBalanceAmount(amount) : null,
      observed_at:typeof value.observed_at === "string" ? value.observed_at : "",
      state:typeof value.state === "string" ? value.state : value.available ? "available" : "unavailable",
    };
  }

  function balanceStatusMessage(value) {
    if (value?.available) return "";
    if (value?.state === "not_configured" || value?.configured === false) return "灏氭湭閰嶇疆鏈嶅姟浣欓鏁版嵁婧愩€?;
    if (value?.state === "configuration_invalid") return "浣欓鏁版嵁婧愰厤缃棤鏁堬紝璇锋鏌ラ厤缃€?;
    return "浣欓璇诲彇澶辫触锛岃妫€鏌?NewAPI 鍦板潃銆佷护鐗屽拰缃戠粶銆?;
  }

  function balanceConfigKey(value) {
    const config = safeBalanceConfig(value);
    return config ? JSON.stringify(config) : "";
  }

  function rememberBalanceCache() {
    if (!scope) return;
    const entry = {};
    const config = safeBalanceConfig(balanceConfig);
    const draft = safeBalanceDraft(balanceDraft);
    const observation = safeBalanceObservation(balanceTestResult);
    const status = safeBalanceStatus(balanceStatus);
    if (config) entry.config = config;
    if (draft) entry.draft = draft;
    if (status) entry.status = status;
    if (observation) {
      entry.observation = observation;
      entry.observationIsDraft = balanceResultIsDraft === true;
      entry.observationConfigKey = balanceResultConfigKey || "";
    }
    if (Object.keys(entry).length) balanceCache.set(scope, entry);
    else balanceCache.delete(scope);
  }

  function restoreBalanceCache(nextScope) {
    const entry = balanceCache.get(nextScope) || {};
    balanceConfig = entry.config ? {...entry.config} : null;
    balanceDraft = entry.draft ? {...entry.draft, api_key: ""} : null;
    balanceStatus = safeBalanceStatus(entry.status);
    balanceStatusError = balanceStatus ? balanceStatusMessage(balanceStatus) : "";
    balanceTestResult = entry.observation ? {...entry.observation} : null;
    balanceResultScope = balanceTestResult ? nextScope : "";
    balanceResultConfigToken = "";
    balanceResultConfigKey = entry.observationConfigKey || "";
    balanceResultIsDraft = entry.observationIsDraft === true;
  }

  function formatBalanceAmount(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric.toFixed(2) : String(value ?? "");
  }
  function clearBalanceResult() {
    balanceTestResult = null;
    balanceResultConfigToken = "";
    balanceResultConfigKey = "";
    balanceResultIsDraft = false;
    rememberBalanceCache();
  }

  function validRoot(ticket) {
    return ticket === generation && !!root?.isConnected && scope === activeScopeKey();
  }
  function localParts(date, timezone) {
    const parts = new Intl.DateTimeFormat("en-CA-u-nu-latn", {timeZone:timezone, year:"numeric", month:"2-digit", day:"2-digit"})
      .formatToParts(date);
    return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  }
  function dayNumber(parts) { return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000); }
  function chineseParts(date, timezone) {
    const parts = new Intl.DateTimeFormat("en-u-ca-chinese-nu-latn", {timeZone:timezone, month:"numeric", day:"numeric"})
      .formatToParts(date);
    const month = parts.find(part => part.type === "month")?.value || "";
    const day = Number(parts.find(part => part.type === "day")?.value);
    const numericMonth = Number(month.replace(/bis/i, ""));
    return {month:numericMonth, day, leap:/bis/i.test(month)};
  }
  function upcomingDates(data, now = new Date()) {
    const contact = data?.contact;
    if (!contact) return [];
    const lookahead = Number(contact.lookaheadDays);
    if (!Number.isInteger(lookahead) || lookahead < 0 || lookahead > 30) return [];
    let rows;
    try { rows = JSON.parse(contact.dates || "[]"); } catch (_) { return []; }
    if (!Array.isArray(rows) || !rows.length) return [];
    const timezone = contact.timezone || data.environment?.timezone || data.model?.timezone || "UTC";
    let today;
    try { today = localParts(now, timezone); } catch (_) { return []; }
    const todayNumber = dayNumber(today), found = [];
    for (const row of rows) {
      if (!row || typeof row.label !== "string") continue;
      /* The runtime already projects profile dates in the local timezone.
         Prefer its authoritative date/days_until pair; keep the legacy
         month/day calculation for older bridges and cached snapshots. */
      if (typeof row.date === "string" && Number.isInteger(row.days_until)) {
        if (row.days_until >= 0 && row.days_until <= lookahead) {
          found.push({label: row.label, days: row.days_until,
                      calendar: row.calendar === "lunar" ? "lunar" : "gregorian"});
        }
        continue;
      }
      if (!Number.isInteger(row.month) || !Number.isInteger(row.day)) continue;
      if (row.calendar === "lunar") {
        let formatterReady = true;
        try { chineseParts(now, timezone); } catch (_) { formatterReady = false; }
        if (!formatterReady) continue;
        for (let days = 0; days <= lookahead; days++) {
          const candidate = new Date(Date.UTC(today.year, today.month - 1, today.day + days, 12));
          let lunar;
          try { lunar = chineseParts(candidate, timezone); } catch (_) { break; }
          if (lunar.month === row.month && lunar.day === row.day && lunar.leap === (row.leap_month === true)) {
            found.push({label:row.label, days, calendar:"lunar"});
            break;
          }
        }
        continue;
      }
      if (row.calendar && row.calendar !== "gregorian") continue;
      for (let year = today.year; year <= today.year + 1; year++) {
        const candidate = new Date(Date.UTC(year, row.month - 1, row.day, 12));
        if (candidate.getUTCMonth() !== row.month - 1 || candidate.getUTCDate() !== row.day) continue;
        const days = dayNumber({year, month:row.month, day:row.day}) - todayNumber;
        if (days >= 0 && days <= lookahead) {
          found.push({label:row.label, days, calendar:"gregorian"});
          break;
        }
      }
    }
    return found.sort((a,b) => a.days - b.days || a.label.localeCompare(b.label, "zh-CN")).slice(0, 4);
  }
  function calendarDetailsMarkup(calendar) {
    if (!calendar || calendar.status === "disabled") return "";
    const rows = [];
    if (calendar.holiday?.status === "available") rows.push(["鏃ュ巻", calendar.holiday.label]);
    if (calendar.lunar_status === "available" && calendar.lunar_date) rows.push(["鍐滃巻", calendar.lunar_date]);
    const terms = calendar.automatic_solar_terms || {};
    if (terms.status === "available") {
      if (terms.today?.length) rows.push(["鑺傛皵", terms.today.join("銆?)]);
      else if (terms.upcoming?.length) {
        const next = terms.upcoming[0];
        rows.push(["鑺傛皵", `${next.days_ahead} 澶╁悗 ${next.names.join("銆?)}`]);
      }
    }
    if (calendar.almanac?.status === "available") rows.push(["杞婚噺榛勫巻", `瀹?${calendar.almanac.yi} 路 蹇?${calendar.almanac.ji}`]);
    return rows.length ? `<dl class="perception-calendar-details">${rows.map(([label,value]) =>
      `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : "";
  }
  function stateValue(value) {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const candidate = value.label ?? value.name ?? value.value ?? value.description;
      if (typeof candidate === "string" || typeof candidate === "number") return String(candidate);
    }
    return "";
  }
  function ageLabel(value) {
    const date = typeof value === "number" ? new Date(value * 1000) : new Date(value || "");
    if (Number.isNaN(date.getTime())) return "鏃堕棿鏈煡";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "鍒氬垰";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 鍒嗛挓鍓峘;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 灏忔椂鍓峘;
    return new Intl.DateTimeFormat("zh-CN", {month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit"}).format(date);
  }
  function reasonLabel(code) {
    return ({capability_consent_missing:"绛夊緟姝ょ鑱婃巿鏉?, capability_consent_revoked:"姝ょ鑱婂凡鎾ゅ洖鎺堟潈",
      camera_consent_missing:"绛夊緟姝ょ鑱婃巿鏉?, camera_tool_unavailable:"鎽勫儚澶村伐鍏锋殏涓嶅彲鐢?,
      capability_role_disabled:"姝よ鑹叉湭鍚敤鎵嬫満璇诲彇", reality_provider_unavailable:"Reality 鎵╁睍鏈氨缁?,
      reality_tool_unavailable:"鎵嬫満璇诲彇宸ュ叿鏆備笉鍙敤", no_recent_snapshot:"鎺堟潈宸插氨缁紝灏氭棤鏈€杩戝揩鐓?,
      no_recent_observation:"鎽勫儚澶存巿鏉冨凡灏辩华锛屽皻鏃犳渶杩戝崟甯х粨鏋?,
      reality_private_required:"浠呭湪褰撳墠绉佽亰涓鍙?, screen_repository_unavailable:"灞忓箷瑙ｈ鏈嶅姟鏈氨缁?,
      screen_consent_missing:"绛夊緟姝ょ鑱婂睆骞曟巿鏉?, screen_consent_revoked:"姝ょ鑱婂凡鎾ゅ洖灞忓箷鎺堟潈",
      capability_not_installed:"Reality 鑳藉姏灏氭湭鐧昏", capability_not_active:"Reality 鑳藉姏宸插仠鐢?})[code]
      || "褰撳墠娌℃湁鍙樉绀虹殑鏁版嵁";
  }
  function modelRoute(kind = "conversation.reply") {
    const tasks = modelStatus?.tasks;
    const task = Array.isArray(tasks) ? tasks.find(item => item?.kind === kind) : null;
    const fields = task?.fields || {};
    const providerId = fields.provider?.value;
    const provider = modelStatus?.providers?.find(item => item?.id === providerId);
    const fallbackId = fields.fallback?.value;
    const fallback = modelStatus?.providers?.find(item => item?.id === fallbackId);
    if (!task || !providerId) return null;
    return {model:provider?.model || providerId, provider:providerId,
      fallback:fallback ? fallback.model || fallback.id : ""};
  }
  function providerSignal(id) {
    const provider = product.capability(id);
    if (!provider) return {state:"unknown", title:"灏氭湭璇诲彇鎵╁睍", detail:"鑳藉姏鐩綍灏氭湭鎻愪緵鐘舵€?};
    const names = {connected:"宸茶繛鎺?, installed:"宸插畨瑁?, missing:"鏈畨瑁?, disabled:"宸插仠鐢?,
      waiting:"绛夊緟灏辩华", degraded:"鐘舵€佸緟妫€鏌?, conflict:"閲嶅瀹夎", stopped:"鎻掍欢宸插仠姝?};
    let state = provider.integration_state || "unknown";
    let title = names[state] || "鐘舵€佹湭鐭?;
    if (state === "connected" && provider.runtime_ready === false) { state = "waiting"; title = "杩愯鏈氨缁?; }
    const detail = provider.reason || (provider.runtime_ready === true ? "鎵╁睍鎶ュ憡杩愯灏辩华" : "璁惧宸ヤ綔鍖鸿礋璐ｇ‘璁ら噰闆嗘巿鏉?);
    return {state:state === "connected" ? "ready" : state === "missing" || state === "disabled" ? "off" : "pending", title, detail};
  }
  /* === 鏈嶅姟绔棩鍘嗘槸鏃ユ湡璇箟鐨勫敮涓€鍩哄噯 ===
     鍏巻銆佹槦鏈熴€佸啘鍘嗐€佽妭鍋囨棩涓庤妭姘旈兘鐢辨湇鍔＄ project_local_date 鎸夎鑹叉椂鍖虹畻鍑猴紝
     闅?/runtime 蹇収涓嬪彂锛堥〉闈粠鏉ユ病鏈夎嚜宸辩畻杩欎簺鐨勬潈闄愶級銆?     鍙湁"绉?蹇呴』鏈湴璧帮細鐢ㄦ湇鍔＄缁欑殑鏃跺尯鎺ㄨ繘锛岃法鏃ュ垯閲嶆柊鎷夊彇鏈嶅姟绔棩鍘嗭紝
     鍥犱负鍐滃巻涓庤妭鍋囨棩璺ㄦ棩浼氬彉锛屾湰鍦版帹绠椾細缁欏嚭閿欒鐨勪竴澶┿€?*/
  function calendarContext() {
    const value = runtimeSnapshot?.calendar;
    if (!value || typeof value !== "object") return null;
    if (value.status === "disabled" || typeof value.local_date !== "string") return null;
    return value;
  }
  function calendarTags(value) {
    const tags = [];
    const add = item => { if (typeof item === "string" && item && tags.indexOf(item) < 0) tags.push(item); };
    const configured = value.configured_annual_calendar?.listed_today;
    if (configured && typeof configured === "object") {
      add(configured.holiday);
      (Array.isArray(configured.solar_terms) ? configured.solar_terms : []).forEach(add);
    }
    if (value.holiday?.status === "available" && value.holiday?.kind === "holiday") add(value.holiday.label);
    add(value.fixed_gregorian_holiday);
    return tags.slice(0, 2);
  }
  function serverDateLabel() {
    const value = calendarContext();
    if (!value) return "";
    const bits = [];
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.local_date);
    if (parts) bits.push(`${Number(parts[2])} 鏈?${Number(parts[3])} 鏃);
    if (typeof value.weekday === "string" && value.weekday) bits.push(value.weekday);
    if (value.lunar_status === "available" && typeof value.lunar_date === "string" && value.lunar_date)
      bits.push(value.lunar_date.startsWith("鍐滃巻") ? value.lunar_date : `鍐滃巻${value.lunar_date}`);
    return bits.join(" 路 ");
  }
  function clockZone() {
    return calendarContext()?.timezone || snapshot?.model?.timezone || snapshot?.environment?.timezone
      || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
  function updateClock() {
    if (!root?.isConnected) return;
    const calendar = calendarContext();
    const timezone = clockZone(), now = new Date();
    const write = (selector, text) => {
      const node = root.querySelector(selector);
      if (node) node.textContent = text;
      return node;
    };
    try {
      const formatter = new Intl.DateTimeFormat("zh-CN", {timeZone:timezone, hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
      const dateFormatter = new Intl.DateTimeFormat("zh-CN", {timeZone:timezone, year:"numeric", month:"long", day:"numeric"});
      const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {timeZone:timezone, weekday:"long"});
      write("[data-context-clock-time]", formatter.format(now));
      write("[data-context-clock-zone]", timezone);
      /* 鏈嶅姟绔棩鍘嗗湪鎵嬪氨鐢ㄥ畠鐨勫啘鍘嗕笌鑺傚亣鏃ワ紱璇讳笉鍒版墠閫€鍥炴湰鏈烘帹绠楋紝涓斾笉鍐嶅亣瑁呮湁鍐滃巻銆?*/
      const serverLabel = serverDateLabel();
      write("[data-context-clock-date]", serverLabel || dateFormatter.format(now));
      write("[data-context-clock-lunar]", serverLabel ? "" : weekdayFormatter.format(now));
      const today = calendar ? calendarTags(calendar)[0] || "" : "";
      const tag = write("[data-context-clock-tag]", today);
      if (tag) tag.hidden = !today;
      const parts = localParts(now, timezone), day = `${parts.year}-${parts.month}-${parts.day}`;
      /* 璺ㄦ棩涓嶈兘鏈湴鎺ㄧ畻锛氶噸鏂版媺鍙?/runtime锛岃鏈嶅姟绔寜鏂扮殑涓€澶╃畻鍐滃巻涓庤妭鍋囨棩銆?*/
      if (lastDay && day !== lastDay) { lastDay = day; refreshRuntime(); return; }
      lastDay = day;
    } catch (_) {
      write("[data-context-clock-time]", now.toLocaleTimeString("zh-CN", {hour12:false}));
      write("[data-context-clock-zone]", "鏈満鏃跺尯");
    }
  }
  function emptyBalanceDraft(config) {
    return {url:config?.url || "", user_id:config?.user_id || "",
      value_divisor:config?.value_divisor || "500000", api_key:"", clear_configuration:false};
  }
  function rememberBalanceDraft(form) {
    const field = name => form.querySelector(`[name="${name}"]`);
    balanceDraft = {
      url:String(field("url")?.value || "").trim(),
      user_id:String(field("user_id")?.value || "").trim(),
      value_divisor:String(field("value_divisor")?.value || "").trim(),
      api_key:String(field("api_key")?.value || ""),
      clear_configuration:field("clear_configuration")?.checked === true,
    };
    return balanceDraft;
  }
  function balanceDraftIsCurrent() {
    return !!balanceConfig && !!balanceDraft && !balanceDraft.clear_configuration
      && balanceConfig.source_state === "configured"
      && balanceDraft.url === (balanceConfig.url || "")
      && balanceDraft.user_id === (balanceConfig.user_id || "")
      && balanceDraft.value_divisor === (balanceConfig.value_divisor || "500000")
      && !balanceDraft.api_key;
  }
  function balanceConfigMarkup() {
    if (!balanceExpanded) return "";
    if (balanceConfigLoading) return '<div id="perception-balance-source" class="perception-balance-config" role="status">姝ｅ湪璇诲彇浣欓鏁版嵁婧愨€?/div>';
    if (!balanceConfig) return `<div id="perception-balance-source" class="perception-balance-config" role="status">
      <p>${esc(balanceError || "浣欓鏁版嵁婧愰厤缃殏涓嶅彲璇汇€?)}</p><button type="button" data-balance-reload ${balanceSaving || balanceTesting ? "disabled" : ""}>閲嶆柊璇诲彇</button></div>`;
    const draft = balanceDraft || emptyBalanceDraft(balanceConfig);
    const busy = balanceConfigLoading || balanceSaving || balanceTesting;
    const balanceActionLabel = balanceDraftIsCurrent() ? "閲嶆柊璇诲彇浣欓" : "娴嬭瘯杩炴帴";
    const testable = !draft.clear_configuration && (balanceDraftIsCurrent()
      || (draft.url && (draft.api_key || balanceConfig.has_api_key)));
    const displayObservation = balanceResultIsDraft ? balanceTestResult
      : balanceStatus?.available ? balanceStatus : balanceTestResult;
    const displayMessage = displayObservation
      ? (balanceResultIsDraft ? "鑽夌娴嬭瘯鎴愬姛" : "褰撳墠浣欓宸茶鍙?) + "锛? + formatBalanceAmount(displayObservation.amount)
        + " " + (displayObservation.currency_label || "棰濆害") + " 路 " + (displayObservation.observed_at || "鏃堕棿鏈煡")
      : balanceStatusLoading ? "姝ｅ湪璇诲彇褰撳墠浣欓鈥? : balanceStatusError
        || (balanceStatus?.state === "not_configured" ? "灏氭湭閰嶇疆鏈嶅姟浣欓鏁版嵁婧愩€? : "");
    const sourceMessage = balanceConfig.source === "plugin" ? "鏈〉淇濆瓨鐨?NewAPI 鏁版嵁婧愪紭鍏堢敤浜庢煡璇笌涓诲姩鑱旂郴銆?
      : balanceConfig.source === "environment" ? "褰撳墠鏁版嵁婧愭潵鑷彃浠剁幆澧冮厤缃紱鍦ㄨ繖閲屼繚瀛樺悗灏嗕紭鍏堜娇鐢ㄦ湰椤甸厤缃€?
        : balanceConfig.source_state === "invalid" ? "妫€娴嬪埌鏁版嵁婧愰厤缃紝浣嗚鍙栧け璐ワ紱璇锋鏌ュ湴鍧€銆佷护鐗屽拰鐜鍙橀噺銆?
          : "濉啓 NewAPI 鍦板潃鍜岀鐞嗕护鐗屽悗锛屾彃浠跺嵆鍙煡璇㈡湇鍔￠搴︺€?;
    const sourceState = balanceConfig.source_state === "invalid" ? "鏁版嵁婧愰厤缃棤鏁?
      : balanceConfig.source === "plugin" ? balanceConfig.has_api_key ? "NewAPI 鏁版嵁婧愬凡閰嶇疆" : "NewAPI 浠ょ墝缂哄け"
      : balanceConfig.source === "environment" ? "姝ｅ湪浣跨敤鎻掍欢鐜閰嶇疆"
        : "灏氭湭閰嶇疆鏁版嵁婧?;
    return `<form id="perception-balance-source" class="perception-balance-config" data-balance-form novalidate aria-label="浣欓鎰熺煡鏁版嵁婧愰厤缃?>
      <div class="perception-balance-config-head"><span>${icon("wallet-cards")}</span><div><strong>浣欓鏁版嵁婧?/strong><small>${esc(sourceState)} 路 ${esc(sourceMessage)}</small></div></div>
      <label class="perception-balance-field"><span>NewAPI 鍦板潃</span><input name="url" data-balance-field="url" type="url" inputmode="url" autocomplete="url" maxlength="2048"
        placeholder="https://newapi.example.com" value="${esc(draft.url)}" ${busy || draft.clear_configuration ? "disabled" : ""} required></label>
      <label class="perception-balance-field"><span>NewAPI 鐢ㄦ埛 ID锛堝彲閫夛級</span><input name="user_id" data-balance-field="user_id" type="text" inputmode="numeric" autocomplete="off" maxlength="19"
        pattern="[1-9][0-9]{0,18}" placeholder="榛樿浣跨敤浠ょ墝鎵€灞炶处鍙? value="${esc(draft.user_id)}" ${busy || draft.clear_configuration ? "disabled" : ""}></label>
      <label class="perception-balance-field"><span>棰濆害鍗曚綅闄ゆ暟</span><input name="value_divisor" data-balance-field="value_divisor" type="text" inputmode="decimal" autocomplete="off" maxlength="64"
        value="${esc(draft.value_divisor)}" ${busy || draft.clear_configuration ? "disabled" : ""} required></label>
      <label class="perception-balance-field"><span>NewAPI 绠＄悊浠ょ墝锛坣ap_锛?/span><input name="api_key" data-balance-field="api_key" type="password" autocomplete="new-password" maxlength="4096"
        value="${esc(draft.api_key)}" placeholder="${balanceConfig.has_api_key ? "宸蹭繚瀛橈紱鐣欑┖淇濈暀褰撳墠浠ょ墝锛岃緭鍏ユ柊浠ょ墝鍙洿鎹? : "杈撳叆甯?profile:read 鏉冮檺鐨勪釜浜鸿闂护鐗?}"
        ${busy || draft.clear_configuration ? "disabled" : ""}></label>
      <p class="perception-balance-note">鏌ヨ浣跨敤涓汉璁块棶浠ょ墝锛堥渶 profile:read锛夛紝涓嶆槸妯″瀷璋冪敤鐢ㄧ殑 sk- Key銆傞搴︽寜 NewAPI 鐨?QuotaPerUnit 鎹㈢畻锛涚暀绌烘椂浣跨敤 500000銆?/p>
      ${balanceConfig.source === "plugin" ? `<label class="perception-balance-clear"><input type="checkbox" name="clear_configuration" data-balance-field="clear_configuration" ${draft.clear_configuration ? "checked" : ""} ${busy ? "disabled" : ""}><span>绉婚櫎鏈〉淇濆瓨鐨勬暟鎹簮</span><small>绉婚櫎鍚庝細缁х画浣跨敤鎻掍欢鐜閰嶇疆锛堝鏋滃凡璁剧疆锛夈€?/small></label>` : ""}
      <p class="perception-balance-message" role="status" aria-live="polite" ${balanceMessage ? "" : "hidden"}>${esc(balanceMessage)}</p>
      <p class="perception-balance-message is-error" role="alert" ${balanceError ? "" : "hidden"}>${esc(balanceError)}</p>
      <p class="perception-balance-message" data-balance-test-result role="status" aria-live="polite" ${displayMessage ? "" : "hidden"}>${esc(displayMessage)}</p>
      <p class="perception-balance-message is-error" role="alert" ${balanceTestError ? "" : "hidden"}>${esc(balanceTestError)}</p>
      <footer class="perception-balance-actions">
        <button type="button" class="perception-balance-contact" data-go="manage" data-manage="contact" data-contact-view="sources">${icon("settings-2")}<span>鍓嶅線涓诲姩鑱旂郴 路 澶栭儴瑙﹀彂婧?/span></button>
        <span class="perception-balance-buttons">
          <button type="button" class="perception-balance-test" data-balance-test ${busy || !testable || (balanceStatusLoading && balanceDraftIsCurrent()) ? "disabled" : ""}>${balanceTesting ? balanceDraftIsCurrent() ? "姝ｅ湪璇诲彇鈥? : "姝ｅ湪娴嬭瘯鈥? : balanceActionLabel}</button>
          <button type="submit" class="perception-balance-save" ${busy ? "disabled" : ""}>${balanceSaving ? "姝ｅ湪淇濆瓨鈥? : draft.clear_configuration ? "绉婚櫎鏁版嵁婧? : "淇濆瓨鏁版嵁婧?}</button>
        </span>
      </footer>
    </form>`;
  }
  function balanceFocus(form, active = window.document?.activeElement) {
    if (!active || !form?.contains?.(active)) return null;
    return {toggle:false, focus:active.getAttribute?.("name")
      || (active.matches?.('button[type="submit"]') ? "__submit" : active.matches?.("[data-balance-test]") ? "__test" : ""),
      selectionStart:active.selectionStart, selectionEnd:active.selectionEnd};
  }
  function restoreBalanceFocus(saved) {
    const form = balanceWorkspace?.querySelector("[data-balance-form]");
    const focus = saved?.focus === "__submit" ? form?.querySelector('button[type="submit"]')
      : saved?.focus === "__test" ? form?.querySelector("[data-balance-test]")
        : saved?.focus ? form?.querySelector(`[name="${saved.focus}"]`) : null;
    focus?.focus({preventScroll:true});
    if (focus && Number.isInteger(saved.selectionStart) && Number.isInteger(saved.selectionEnd))
      focus.setSelectionRange?.(saved.selectionStart, saved.selectionEnd);
  }
  function renderBalanceSource() {
    if (!balanceWorkspace || !balanceExpanded) return;
    const markup = balanceConfigMarkup();
    if (markup === balanceMarkup) return;
    const savedFocus = balanceFocus(balanceWorkspace.querySelector("[data-balance-form]"));
    balanceWorkspace.innerHTML = markup;
    balanceMarkup = markup;
    if (savedFocus) restoreBalanceFocus(savedFocus);
  }
  function syncSelection() {
    for (const card of root?.querySelectorAll?.(".perception-board-card") || []) card.classList.remove("is-selected");
    for (const button of root?.querySelectorAll?.("[data-board-goto]") || []) {
      const active = selectedItemId
        ? button.dataset.perceptionItem === selectedItemId
        : button.dataset.boardGoto === selectedDestination
          && (!button.dataset.boardModelTab || button.dataset.boardModelTab === selectedModelTab);
      button.setAttribute("aria-expanded", String(active));
      button.classList.toggle("is-selected", active);
      if (active) button.closest(".perception-board-card")?.classList.add("is-selected");
    }
  }
  function select(destination, {modelTab="", itemId=""} = {}) {
    if (!root?.isConnected) return;
    selectedDestination = destination;
    selectedModelTab = modelTab;
    selectedItemId = itemId;
    syncSelection();
    balanceExpanded = ["config-news","config-balance","config-recall"].includes(destination.split(":")[0]);
    renderBalanceSource();
    if (balanceExpanded && !balanceConfig && !balanceConfigLoading) void readBalanceConfig(generation);
  }
  function preview(itemId) {
    activePreviewItemId = String(itemId || "").trim();
    const panel = typeof document !== "undefined" ? document.getElementById("perceptionSingleItemPreview") : null;
    if (!activePreviewItemId) {
      if (panel) { panel.hidden = true; panel.innerHTML = ""; }
      return "";
    }
    const markup = itemPreviewMarkup.get(activePreviewItemId)
      || `<p class="perception-preview-empty">杩欎竴椤规殏鏃犲彲灞曠ず鐨勫唴瀹广€?/p>`;
    if (panel) { panel.innerHTML = markup; panel.hidden = false; }
    return markup;
  }
  function render({balanceSource=true} = {}) {
    if (!root?.isConnected) return;
    const active = window.document?.activeElement;
    const focusedId = active && root.contains?.(active) ? active.id : "";
    const ready = snapshot?.ready === true;
    const configurationFailed = !ready && (!!snapshot?.error || snapshot?.loading === false);
    const configurationState = configurationFailed ? "璇诲彇澶辫触" : "姝ｅ湪璇诲彇鈥?;
    const environment = snapshot?.environment || {}, model = snapshot?.model || {};
    const calendar = runtimeSnapshot?.calendar || {};
    const weather = runtimeSnapshot?.weather || {}, screenResult = runtimeSnapshot?.screen || {};
    const realityResult = runtimeSnapshot?.reality || {}, mobile = realityResult.snapshot || {};
    const cameraResult = runtimeSnapshot?.camera || {state:"unavailable", reason:"camera_runtime_unavailable"};
    const modelInfo = modelRoute();
    const modelStateLabel = modelInfo ? "璺敱宸茶鍙? : modelState === "loading" ? "姝ｅ湪璇诲彇妯″瀷璺敱" : "妯″瀷璺敱鏆備笉鍙";
    const news = snapshot?.news || {};
    const locationName = environment.locationName || "";
    const balanceEnabled = snapshot?.contact?.balanceAwarenessEnabled;
    const balanceAllowed = snapshot?.contact?.automaticAllowed;
    const balanceSourceConfigured = balanceConfig?.source_state === "configured";
    const balanceSourceInvalid = balanceConfig?.source_state === "invalid";
    const balanceDraftObservation = balanceResultIsDraft && balanceTestResult?.available === true ? balanceTestResult : null;
    const balanceObservation = balanceDraftObservation || (balanceStatus
      ? balanceStatus.available ? balanceStatus : null
      : balanceTestResult?.available === true ? balanceTestResult : null);
    const balanceObservationIsDraft = balanceObservation === balanceDraftObservation && !!balanceDraftObservation;
    const balanceValue = !ready ? `${balanceSourceConfigured ? "鏁版嵁婧愬凡閰嶇疆锛? : ""}浣欓鑱旂郴璁剧疆${configurationState === "璇诲彇澶辫触" ? "璇诲彇澶辫触" : "姝ｅ湪璇诲彇"}` : balanceEnabled === true
      ? balanceAllowed === true ? "鏈嶅姟浣欓鑱旂郴宸插惎鐢? : "浣欓濂戞満宸插紑锛屼絾鍚庡彴鑷姩鑱旂郴鏈紑鍚?
      : balanceSourceConfigured ? "鏁版嵁婧愬凡閰嶇疆锛屼綑棰濊仈绯绘湭寮€鍚?
        : balanceSourceInvalid ? "浣欓鏁版嵁婧愰厤缃棤鏁堬紝鑱旂郴鏈紑鍚?
          : "鏈嶅姟浣欓鑱旂郴濂戞満鏈惎鐢?;
    const balanceTag = !ready ? configurationFailed ? "璇诲彇澶辫触" : "璇诲彇涓? : balanceEnabled === true
      ? balanceAllowed === true ? "涓诲姩鑱旂郴" : "鎬诲紑鍏冲彈闄?
      : balanceSourceConfigured ? "鏁版嵁婧愬凡閰嶇疆" : balanceSourceInvalid ? "寰呬慨澶? : ready ? "鏈惎鐢? : "寰呰鍙?;
    const balanceDetail = !ready ? "浣欓鑱旂郴鏉′欢灏氭湭鏍稿锛涘彲灞曞紑閰嶇疆鏁版嵁婧愶紝鎴栭噸鏂拌鍙栫姸鎬併€?
      : balanceSourceConfigured && balanceEnabled !== true
      ? "鏁版嵁婧愬凡閰嶇疆锛涜繕闇€鍦ㄤ富鍔ㄨ仈绯荤殑澶栭儴瑙﹀彂婧愪腑寮€鍚綑棰濇劅鐭ャ€?
      : "浠呭湪鏈嶅姟浣欓杈惧埌闃堝€兼椂浣滀负涓诲姩鑱旂郴绱犳潗锛屼笉浼氭寔缁敞鍏ユ棩甯稿璇濓紱涓嶈〃绀虹敤鎴锋瑺娆俱€?;
    const searchSource = news.sourceKind === "search";
    const dailySource = /AI\s*(鏃╂姤|鏃ユ姤)|姗橀甫/i.test(news.label || "");
    const explorationEnabled = news.explorationEnabled === true;
    const sourceAssembled = news.assembled ?? news.ready;
    const networkSucceeded = news.networkStatus === "succeeded";
    const networkLabel = news.networkStatus === "failed" ? "涓婃缃戠粶妫€鏌ュけ璐?
      : news.networkStatus === "succeeded" ? "缃戠粶妫€鏌ラ€氳繃"
        : sourceAssembled ? "缃戠粶灏氭湭妫€鏌? : "鏉ユ簮鏈閰?;
    const externalValue = !ready ? configurationFailed ? "澶栭儴鏉ユ簮璁剧疆璇诲彇澶辫触" : "姝ｅ湪璇诲彇澶栭儴鏉ユ簮" : searchSource
      ? explorationEnabled ? networkSucceeded ? news.label || "缃戠粶鎼滅储妫€鏌ラ€氳繃" : sourceAssembled ? `缃戠粶鎼滅储宸查厤缃?路 ${networkLabel}` : "缃戠粶鎺㈢储宸插惎鐢紝鎼滅储婧愭湭瑁呴厤" : "缃戠粶鎺㈢储鏈惎鐢?
      : dailySource ? `AI 鏃ユ姤宸茶閰?路 ${networkSucceeded ? "鍚庡彴鎸佺画缁存姢" : networkLabel}`
        : sourceAssembled ? `${news.label || "璧勮鏉ユ簮"} 路 ${networkSucceeded ? "鍚庡彴鎸佺画缁存姢" : networkLabel}`
          : ready ? "灏氭湭閰嶇疆澶栭儴鏉ユ簮" : "姝ｅ湪璇诲彇澶栭儴鏉ユ簮";
    const externalState = !ready ? "pending" : searchSource && explorationEnabled
      ? networkSucceeded ? "ready" : "pending"
      : networkSucceeded ? "ready" : sourceAssembled ? "pending" : "off";
    const externalDetail = [
      searchSource ? "AstrBot 缃戦〉鎼滅储鎴栬嚜瀹氫箟鎼滅储婧? : dailySource ? "鍐呯疆 AI 鏃ユ姤鏉ユ簮" : `鏉ユ簮绫诲瀷 ${news.sourceKind || "鏈€夋嫨"}`,
      news.explorationInterests ? `鍏磋叮锛?{news.explorationInterests}` : "鏈寚瀹氭悳绱㈠叴瓒?,
      Number.isInteger(news.explorationIntervalHours) ? `鏈€鐭棿闅?${news.explorationIntervalHours} 灏忔椂` : "",
      Number.isInteger(news.explorationResultCount) ? `姣忔鏈€澶?${news.explorationResultCount} 鏉 : "",
      Number.isInteger(news.itemCount) ? `鏈€杩戞鏌?${news.itemCount} 鏉 : "",
      networkLabel,
      news.lastAttemptAt ? `鏈€杩戝皾璇?${news.lastAttemptAt}` : "",
      news.lastCheckedAt ? `鏈€杩戝悓姝?${news.lastCheckedAt}` : "",
    ].filter(Boolean).join(" 路 ");
    const weatherValue = weather.state === "available"
      ? `${weather.location || environment.locationName || "褰撳墠浣嶇疆"} 路 ${weather.condition || "澶╂皵宸茶鍙?}${weather.temperature_c == null ? "" : ` 路 ${weather.temperature_c}掳C`}`
      : weather.state === "disabled" ? "澶╂皵鎰熺煡鏈惎鐢?
        : weather.state === "unconfigured" ? "灏氭湭璁剧疆澶╂皵鍦扮偣"
          : runtimeState === "loading" ? "姝ｅ湪璇诲彇澶╂皵瀹炲喌" : "澶╂皵瀹炲喌鏆備笉鍙敤";
    const weatherDetail = weather.state === "available"
      ? `${weather.provider || "澶╂皵鏉ユ簮"} 路 瑙傛祴 ${ageLabel(weather.observed_at)}${weather.humidity_pct == null ? "" : ` 路 婀垮害 ${weather.humidity_pct}%`}${weather.wind_kph == null ? "" : ` 路 椋庨€?${weather.wind_kph} km/h`}`
      : weather.state === "disabled" ? "鍚敤鍚庢€昏鏄剧ず褰撳墠瀹炲喌锛涚鑱婅闂ぉ姘旀椂鎸夐渶璇诲彇锛屾棩甯歌鍒掍篃鍙弬鑰冦€?
        : weather.state === "unconfigured" ? "鍦ㄤ笅鏂圭幆澧冮厤缃缃鑹插湴鐐广€?
          : "瀹炲喌璇诲彇澶辫触鏃朵笉浼氭部鐢ㄦ棫鏁版嵁鍐掑厖褰撳墠澶╂皵銆?;
    const routeLabel = (route, pending) => route?.model || (pending ? "姝ｅ湪璇诲彇妯″瀷璺嚎" : "灏氭湭鍒嗛厤");
    const detailForRoute = route => route
      ? `Provider ${route.provider}${route.fallback ? ` 路 澶囩敤 ${route.fallback}` : ""}`
      : modelState === "error" ? "浠诲姟璺敱鏆備笉鍙" : "姝や换鍔″綋鍓嶆病鏈夊彲鐢ㄨ矾鐢?;
    const voiceLanguage = voiceStatus?.languages?.find(item => /^(zh|zh[-_])|涓枃/i.test(item.k || item.n || ""))
      || voiceStatus?.languages?.[0];
    const voiceProvider = voiceStatus?.providers?.find(item => item.id === voiceLanguage?.bind);
    const voiceValue = voiceState === "loading" ? "姝ｅ湪璇诲彇璇煶缁戝畾"
      : voiceState === "error" ? "TTS 缁戝畾鏆備笉鍙"
        : voiceStatus?.voice_enabled === false ? "璇煶鍥炲鏈惎鐢?
          : voiceProvider?.model || voiceProvider?.label || voiceProvider?.name || voiceLanguage?.bind || "灏氭湭缁戝畾 TTS";
    const generated = imageStatus?.actions?.find(item => item.action === "image.generate");
    const imageRoute = modelRoute("image.generate");
    const preferredImage = imageStatus?.preferred_image && typeof imageStatus.preferred_image === "object"
      ? imageStatus.preferred_image : null;
    /* image.native is the native action owner, not a model.  The status API
       projects the first model in the configured generate queue so this card
       shows the same concrete model as the image configuration page. */
    const preferredImageModel = typeof preferredImage?.model === "string" ? preferredImage.model : "";
    const imageValue = imageState === "loading" ? "姝ｅ湪璇诲彇鐢熷浘鐘舵€?
      : imageState === "error" ? "鐢熷浘鐘舵€佹殏涓嶅彲璇?
        : imageRoute?.model || preferredImageModel || generated?.provider_id || generated?.owner || "灏氭湭鍒嗛厤鐢熷浘妯″瀷";
    const imageDetail = imageRoute
      ? `${generated?.owner ? `${generated.owner} 路 ` : ""}${imageRoute.model} 路 ${modelAvailabilityLabel(generated?.state)}`
      : preferredImageModel
        ? `${preferredImage.name || preferredImage.route || "鍦ㄧ嚎鐢熷浘妯″瀷"} 路 ${preferredImage.enabled ? "棣栭€? : "宸插仠鐢?}`
        : generated?.owner
          ? `${generated.owner} 路 ${modelAvailabilityLabel(generated.state)}`
          : "Native 鐢熷浘鍔ㄤ綔涓庢墿灞曠敱妯″瀷涓庤繛鎺ラ〉绠＄悊銆?;
    const visionRoute = modelRoute("vision.review") || modelRoute("screen.interpretation");
    const analysisProvider = semanticStatus?.settings?.analysis_provider;
    const events = upcomingDates(snapshot);
    const alertList = weather.state === "available" && Array.isArray(weather.alerts) ? weather.alerts.slice(0, 4) : [];
    const screenValue = screenResult.state === "available" ? screenResult.interpretation || "宸叉湁灞忓箷瑙ｈ"
      : screenResult.state === "blocked" ? reasonLabel(screenResult.reason)
        : screenResult.state === "empty" ? "鏆傛棤宸蹭繚瀛樿В璇?
          : runtimeState === "loading" ? "姝ｅ湪鏍稿灞忓箷鏉冮檺" : "灞忓箷瑙ｈ鏆備笉鍙";
    const mobileValue = mobile.location?.available
      ? mobile.location.label || "闄勮繎浣嶇疆宸茶鍙?
      : runtimeState === "loading" ? "姝ｅ湪璇诲彇瀹氫綅鐘舵€?
        : runtimeState === "error" ? "瀹氫綅鐘舵€佽鍙栧け璐?
          : realityResult.reason ? reasonLabel(realityResult.reason)
        : realityResult.state === "ready" ? "鎺堟潈宸插氨缁紝鏆傛棤浣嶇疆蹇収"
          : "鏆傛棤宸叉巿鏉冪殑浣嶇疆蹇収";
    const device = mobile.device || {}, activity = mobile.activity || {};
    const health = mobile.health && typeof mobile.health === "object" ? mobile.health : {};
    const healthReadings = Array.isArray(health.measurements) ? health.measurements : [];
    const healthLabels = {heart_rate:"蹇冪巼", steps:"姝ユ暟", sleep_duration:"鐫＄湢", active_calories:"娲诲姩娑堣€?,
      body_temperature:"浣撴俯", oxygen_saturation:"琛€姘?, weight:"浣撻噸", exercise_minutes:"杩愬姩鏃堕暱"};
    const healthParts = healthReadings.slice(0, 4).map(item => {
      const label = typeof item.label === "string" && item.label ? item.label
        : healthLabels[item.type] || (typeof item.type === "string" ? item.type : "娴嬮噺");
      const value = Number.isFinite(Number(item.value)) ? Number(item.value) : item.value;
      return `${label} ${value}${item.unit ? ` ${item.unit}` : ""}`;
    });
    if (typeof health.activity === "string" && health.activity) healthParts.push(`娲诲姩 ${health.activity}`);
    const healthAvailable = health.available === true && healthParts.length > 0;
    const healthReason = typeof health.reason === "string" ? health.reason : "";
    const healthSourceDisabled = healthReason === "telemetry_disabled" || healthReason === "mobile_gateway_disabled";
    const healthValue = healthAvailable ? healthParts.join(" 路 ")
      : runtimeState === "loading" ? "姝ｅ湪璇诲彇鍋ュ悍鎽樿"
        : runtimeState === "error" ? "鍋ュ悍鎽樿璇诲彇澶辫触"
          : healthReason === "telemetry_disabled" ? "鎵嬫満鍋ュ悍涓婃姤鏈紑鍚?
            : healthReason === "no_recent_telemetry" ? "绛夊緟鎵嬫満涓婃姤鍋ュ悍鏁版嵁"
              : healthReason === "telemetry_expired" ? "鏈€杩戝仴搴锋暟鎹凡杩囨湡"
                : health.available === true ? "鏈€杩戜笂鎶ユ病鏈夊彲鐢ㄦ祴閲?
                  : realityResult.reason ? reasonLabel(realityResult.reason) : "鏆傛棤宸叉巿鏉冪殑鍋ュ悍鎽樿";
    const phoneParts = [];
    if (device.available === true) {
      if (Number.isFinite(device.battery_percent)) phoneParts.push(`鐢甸噺 ${device.battery_percent}%`);
      if (device.charging === true) phoneParts.push("鍏呯數涓?);
      const appState = ({foreground:"鍓嶅彴杩愯",background:"鍚庡彴杩愯"})[device.app_state];
      if (appState) phoneParts.push(appState);
    }
    if (activity.available === true && activity.label) phoneParts.push(`${activity.stale ? "涓婃娲诲姩" : "娲诲姩"} 路 ${activity.label}`);
    const phoneAvailable = phoneParts.length > 0;
    const phoneValue = phoneAvailable ? phoneParts.join(" 路 ")
      : runtimeState === "loading" ? "姝ｅ湪璇诲彇鎵嬫満鐘舵€?
        : runtimeState === "error" ? "鎵嬫満鐘舵€佽鍙栧け璐?
          : realityResult.reason ? reasonLabel(realityResult.reason) : "鏆傛棤宸叉巿鏉冪殑鎵嬫満鐘舵€佸揩鐓?;
    const cameraObservation = cameraResult.observation || {};
    const cameraValue = cameraResult.state === "available"
      ? cameraResult.answer_available
        ? cameraObservation.summary || cameraObservation.scene_description || cameraObservation.purpose_answer || "鏈€杩戝崟甯у凡璇嗗埆"
        : cameraObservation.uncertainty || cameraResult.message || "鏈€杩戝崟甯х粨鏋滀笉纭畾"
      : runtimeState === "loading" ? "姝ｅ湪璇诲彇鎽勫儚澶寸姸鎬?
        : runtimeState === "error" ? "鎽勫儚澶寸姸鎬佽鍙栧け璐?
          : cameraResult.reason ? reasonLabel(cameraResult.reason)
        : cameraResult.state === "ready" ? "鎺堟潈宸插氨缁紝鏆傛棤璇嗗埆缁撴灉" : "鏆傛棤鍙敤鐨勬憚鍍忓ご缁撴灉";
    const recalls = Array.isArray(recallStatus?.entries) ? recallStatus.entries : [];
    const recallValue = recallState === "loading" ? "姝ｅ湪璇诲彇鎾ゅ洖璁板綍"
      : recallState === "error" ? "鎾ゅ洖璁板綍鏆備笉鍙"
        : recallStatus?.enabled === false ? "鎾ゅ洖杞綍鏈惎鐢?
        : recalls.length ? `褰撳墠绐楀彛 ${recalls.length} 鏉″彲璇昏褰昤 : "杩戞湡娌℃湁鍙璁板綍";
    const recallDetail = recalls[0]
      ? `${recalls[0].local_time || ageLabel(recalls[0].withdrawn_at)} 路 ${String(recalls[0].text || "").slice(0, 72)}`
      : recallState === "error" ? (
        recallError === "core_access_required"
          ? "浠呮牳蹇冪鐞嗗憳鍙杩欎釜瑙掕壊绐楀彛鐨勬挙鍥炶褰曪紱褰撳墠 Dashboard 璐﹀彿鏉冮檺涓嶈冻銆?
          : recallError === "recall_scope_denied"
            ? "杩欎釜瑙掕壊绐楀彛杩樻病瑙ｆ瀽鍑哄彲璇昏寖鍥达紱纭瀹冨凡缁戝畾浼氳瘽鍚庡啀璇曘€?
            : `璇诲彇澶辫触锛?{recallError || "鍘熷洜鏈煡"}锛壜?妫€鏌ュ綋鍓嶈鑹茬獥鍙ｇ殑鎺堟潈涓庢挙鍥炶浆褰曞紑鍏炽€俙)
        : recallStatus?.enabled === false ? "鎵撳紑涓嬫柟鎾ゅ洖杞綍璁剧疆鍚庯紝鎵嶄細鏄剧ず鎺堟潈鑼冨洿鍐呯殑璁板綍銆?
          : "浠呮樉绀哄綋鍓嶄細璇濇巿鏉冭寖鍥村唴鐨勮褰曪紝涓嶄細閲嶆柊杩涘叆瀵硅瘽銆?;
    const configuredDevices = (mihomeStatus?.devices || []).filter(item => item?.configured === true || item?.aliases?.length);
    const onlineCount = configuredDevices.filter(item => item.online === true).length;
    const offlineCount = configuredDevices.filter(item => item.online === false).length;
    const unknownCount = configuredDevices.length - onlineCount - offlineCount;
    const mihomeEnabled = mihomeState === "ready" && mihomeStatus?.enabled === true;
    const mihomeSummary = mihomeEnabled
      ? configuredDevices.length
        ? `${onlineCount} 鍦ㄧ嚎 路 ${offlineCount} 绂荤嚎 路 ${unknownCount} 鏈牳瀹?路 ${configuredDevices.length} 鍙板凡閰嶇疆`
        : "鍙璁惧鐘舵€佸凡寮€鍚紝灏氭棤宸叉槧灏勮澶?
      : "";
    const injections = Array.isArray(runtimeSnapshot?.other_injections)
      ? runtimeSnapshot.other_injections.filter(item => typeof item === "string" || item?.label || item?.name).slice(0, 6) : [];
    const injectionLabels = injections.map(item => typeof item === "string" ? item : item.label || item.name);
    /* === 鎰熺煡閫氶亾鍗曚竴鏁版嵁婧?===
       浠〃鐩樺彧鐧昏"褰撳墠鐪熷疄瀛樺湪鐨勯€氶亾"锛?       姣忔潯閮藉甫涓婂畠鑷繁鐨勮鏁颁笌璇存槑銆備笉缁欓€氶亾缂栭€犳暟鍊笺€佺櫨鍒嗘瘮鎴栫粺涓€鎬绘暟锛?       璇讳笉鍒板氨璇磋涓嶅埌锛堟湭鍚敤 / 寰呮巿鏉冿級锛屼笉鎷挎棫鏁版嵁鍐掑厖褰撳墠鍊笺€?*/
    const percepts = [];
    const channel = (id, board, spec) => percepts.push({id, board, ...spec});
    const tabModel = "config-models:perception-detail-model-route";
    const tabPlace = "config-environment:perception-detail-place";
    const tabDevice = "config-screen:perception-detail-device-access";
    const tabCalendar = "config-models:perception-detail-context";
    const tabHealth = "config-health:perception-detail-health";

    channel("model-conversation", "models", {tab:tabModel, modelTab:"fn", icon:"cpu", title:"瀵硅瘽妯″瀷",
      value:routeLabel(modelInfo, modelState === "loading"), detail:detailForRoute(modelInfo),
      state:modelInfo ? "ready" : "pending", tag:modelInfo ? "褰撳墠璺敱" : modelStateLabel});
    channel("model-tts", "models", {tab:tabModel, modelTab:"voice", icon:"audio-lines", title:"璇煶妯″瀷",
      value:voiceValue,
      detail:voiceLanguage ? `${voiceLanguage.n || voiceLanguage.k} 路 ${modelAvailabilityLabel(voiceStatus?.catalog_state)}` : "鎸夎绉嶇粦瀹氾紝閰嶇疆鍦ㄦā鍨嬩笌杩炴帴椤点€?,
      state:voiceState === "error" || voiceState === "loading" ? "pending" : voiceStatus?.voice_enabled === false || !voiceLanguage?.bind ? "off" : "ready",
      tag:voiceState === "error" ? "璇诲彇澶辫触" : voiceState === "loading" ? "璇诲彇涓? : voiceStatus?.voice_enabled === false ? "鏈惎鐢? : voiceLanguage?.bind ? "宸茬粦瀹? : "鏈粦瀹?});
    channel("model-image", "models", {tab:tabModel, modelTab:"image", icon:"image", title:"鐢熷浘妯″瀷",
      value:imageValue,
      detail:imageDetail,
      state:imageState !== "ready" ? "pending"
        : imageRoute ? "ready"
        : preferredImageModel ? preferredImage.enabled ? "ready" : "off"
        : generated?.state === "ready" ? "ready" : generated?.state === "disabled" ? "off" : "pending",
      tag:imageState === "error" ? "璇诲彇澶辫触" : imageState === "loading" ? "璇诲彇涓?
        : imageRoute ? "宸插垎閰?
        : preferredImageModel ? preferredImage.enabled ? "棣栭€夋ā鍨? : "宸插仠鐢?
        : generated?.state === "ready" ? "鍙皟鐢? : generated?.state === "disabled" ? "宸插叧闂? : "寰呮鏌?});
    if (visionRoute || analysisProvider) channel("model-vision", "models", {tab:tabModel, modelTab:"fn", icon:"scan-eye", title:"瑙嗚妯″瀷",
      value:visionRoute?.model || analysisProvider,
      detail:visionRoute ? detailForRoute(visionRoute) : "璇箟瑙嗚鍒嗘瀽 Provider",
      state:"ready", tag:"宸查厤缃?});

    /* 鏃ユ湡涓庡巻娉曪細鏈嶅姟绔?project_local_date 鐨勪骇鍑哄繀椤绘湁鍑哄彛銆?       姣忎竴椤归兘鍙湪鏈嶅姟绔湡鐨勭粰鍑烘椂鎵嶆樉绀衡€斺€斿巻娉曢」鍚勬湁涓€涓€诲紑鍏筹紝娌″紑灏辨槸娌″紑銆?*/
    const calendarView = (() => {
      const cal = calendarContext();
      if (!cal) return null;
      const labels = [];
      if (typeof cal.weekday === "string" && cal.weekday) labels.push(cal.weekday);
      if (typeof cal.period === "string" && cal.period) labels.push(cal.period);
      const detail = [];
      if (cal.lunar_status === "available" && typeof cal.lunar_date === "string" && cal.lunar_date)
        detail.push(cal.lunar_date.startsWith("鍐滃巻") ? cal.lunar_date : `鍐滃巻${cal.lunar_date}`);
      const terms = [];
      const today = cal.automatic_solar_terms?.today;
      if (Array.isArray(today)) for (const item of today) for (const name of item?.names || []) terms.push(name);
      const listed = cal.configured_annual_calendar?.listed_today?.solar_terms;
      if (Array.isArray(listed)) terms.push(...listed);
      if (terms.length) detail.push(`鑺傛皵 ${terms.slice(0, 2).join("銆?)}`);
      if (cal.almanac?.status === "available" && cal.almanac.yi && cal.almanac.ji)
        detail.push(`瀹?${cal.almanac.yi} 路 蹇?${cal.almanac.ji}`);
      return {
        labels: labels.length ? labels.join(" 路 ") : "鍘嗘硶宸插惎鐢?,
        detail: detail.length ? detail.join(" 路 ") : "鏈嶅姟绔湭浜у嚭鏇村鍘嗘硶鏄庣粏锛涘啘鍘嗐€佽妭姘斾笌榛勫巻鍚勬湁鐙珛寮€鍏炽€?,
      };
    })();
    if (calendarView) channel("env-calendar", "environment", {tab:tabCalendar, icon:"calendar-days", title:"鏃ユ湡涓庡巻娉?,
      value:calendarView.labels, detail:calendarView.detail, state:"ready", tag:"鏈嶅姟绔棩鍘?});
    channel("env-location", "environment", {tab:tabPlace, icon:"map-pin", title:"鎵€鍦ㄥ湴",
      value:locationName || (!ready ? `瑙掕壊鍦扮偣${configurationState}` : "灏氭湭璁剧疆瑙掕壊鍦扮偣"),
      detail:locationName ? "浣跨敤瑙掕壊閰嶇疆鐨勫尯鍩燂紱涓嶆樉绀虹粡绾害銆? : "鍦ㄦ棩绋嬩笌瑙勫垝涓～鍐欒鑹叉墍鍦ㄥ湴銆?,
      state:locationName ? "ready" : ready ? "off" : "pending", tag:locationName ? "宸查厤缃? : !ready ? configurationFailed ? "璇诲彇澶辫触" : "璇诲彇涓? : "寰呰缃?});
    channel("env-weather", "environment", {tab:tabPlace, icon:"cloud-sun", title:"澶╂皵瀹炲喌",
      value:weather.state === "available"
        ? `${weather.condition || "澶╂皵宸茶鍙?}${weather.temperature_c == null ? "" : ` 路 ${weather.temperature_c}掳C`}`
        : weatherValue,
      detail:weatherDetail,
      state:weather.state === "available" ? "ready" : weather.state === "disabled" ? "off" : "pending",
      tag:weather.state === "available" ? "瀹炲喌" : weather.state === "disabled" ? "鏈惎鐢? : weather.state === "unconfigured" ? "寰呴厤缃? : runtimeState === "loading" ? "璇诲彇涓? : "璇诲彇澶辫触"});
    if (alertList.length) channel("env-alert", "environment", {tab:tabPlace, icon:"triangle-alert", title:"澶╂皵棰勮",
      value:alertList[0].title || alertList[0].event_name || "鏈夊畼鏂归璀?,
      detail:`${alertList[0].severity || "绾у埆寰呮牳瀵?}${alertList[0].ends_at ? ` 路 鑷?${new Date(alertList[0].ends_at).toLocaleString("zh-CN")}` : ""}${alertList.length > 1 ? ` 路 鍙︽湁 ${alertList.length - 1} 鏉 : ""}`,
      state:"pending", tag:`${alertList.length} 鏉￠璀});
    channel("ext-external", "external", {tab:"config-news:perception-detail-external", icon:"globe-2", title:"澶栭儴璧勮",
      value:externalValue, detail:externalDetail + (news.failureCode ? ` 路 ${news.failureCode}` : ""),
      state:externalState,
      tag:!ready ? configurationFailed ? "璇诲彇澶辫触" : "璇诲彇涓? : externalState === "ready" ? "妫€鏌ラ€氳繃" : externalState === "off" ? "鏈惎鐢? : news.networkStatus === "failed" ? "妫€鏌ュけ璐? : "寰呮鏌?});
    channel("ext-balance", "external", {tab:"config-balance:perception-detail-balance-source", icon:"wallet-cards", title:"浣欓鎰熺煡",
      value:balanceValue, detail:[balanceDetail, balanceObservation ? `${balanceResultIsDraft ? "鑽夌娴嬭瘯" : "鏈€杩戞煡璇?} ${formatBalanceAmount(balanceObservation.amount)} ${balanceObservation.currency_label || "棰濆害"}` : "灏氭棤浣欓鏌ヨ缁撴灉"].join(" 路 "),
      state:balanceObservation ? "ready" : balanceSourceConfigured || balanceSourceInvalid || balanceEnabled === true || !ready || balanceError || balanceTestError || balanceStatusError ? "pending" : "off",
      tag:balanceTag});

    const realityNeedsConsent = /capability_role_disabled|capability_consent_missing|consent/.test(realityResult.reason || "");
    channel("device-location", "devices", {tab:"config-screen:perception-detail-reality-access", icon:"smartphone", title:"褰撳墠瀹氫綅",
      value:mobileValue,
      detail:mobile.location?.available ? `鏈€杩戣鍙?${ageLabel(mobile.location.captured_at)} 路 浠呭睍绀烘巿鏉冨尯鍩燂紝涓嶆樉绀哄潗鏍嘸
        : realityNeedsConsent ? "鎵嬫満璇诲彇涓€娆℃巿鏉冨悗锛屽畾浣嶅拰鎵嬫満鐘舵€佷竴璧峰彲鐢ㄣ€? : "鍙洖鏄惧璇濆凡缁忚鍙栫殑浣嶇疆锛屼笉涓诲姩閲囬泦銆?,
      state:mobile.location?.available ? "ready" : realityResult.reason === "capability_role_disabled" ? "off" : "pending",
      tag:mobile.location?.available ? "宸茶鍙? : realityNeedsConsent ? "闇€鎵嬫満璇诲彇" : runtimeState === "error" ? "璇诲彇澶辫触" : runtimeState === "loading" ? "璇诲彇涓? : "鏆傛棤蹇収"});
    channel("device-screen", "devices", {tab:tabDevice, icon:"scan-eye", title:"璇嗗睆",
      value:screenValue,
      detail:screenResult.state === "available" ? `${screenResult.surface || "灞忓箷鐢婚潰"} 路 閲囬泦 ${ageLabel(screenResult.captured_at)} 路 瑙ｈ ${ageLabel(screenResult.created_at)}`
        : "鍙樉绀烘渶杩戝畬鎴愮殑鎺堟潈瑙ｈ锛涘埛鏂颁笉浼氳Е鍙戦噰闆嗐€?,
      state:screenResult.state === "available" ? "ready" : "pending",
      tag:screenResult.state === "available" ? "鏈夌粨鏋? : runtimeState === "error" ? "璇诲彇澶辫触" : runtimeState === "loading" ? "璇诲彇涓? : screenResult.state === "blocked" ? "闇€鎺堟潈" : "鏆傛棤缁撴灉"});
    channel("device-phone", "devices", {tab:"config-screen:perception-detail-reality-access", icon:"smartphone", title:"鎵嬫満鐘舵€?,
      value:phoneValue,
      detail:realityNeedsConsent ? "涓庡綋鍓嶅畾浣嶅叡鐢ㄤ竴娆℃墜鏈鸿鍙栨巿鏉冿紱涓嶄細涓诲姩閲囬泦銆? : "灞曠ず鏈€杩戝凡鎺堟潈蹇収涓殑鐢甸噺銆佽繍琛岀姸鎬佷笌娲诲姩锛涘埛鏂伴〉闈笉浼氳Е鍙戞墜鏈洪噰闆嗐€?,
      state:phoneAvailable ? "ready" : realityResult.reason === "capability_role_disabled" ? "off" : "pending",
      tag:phoneAvailable ? "鏈夊揩鐓? : realityNeedsConsent ? "闇€鎵嬫満璇诲彇" : runtimeState === "error" ? "璇诲彇澶辫触" : runtimeState === "loading" ? "璇诲彇涓? : "鏆傛棤蹇収"});
    const healthBlocked = /consent|capability_role_disabled|reality_provider|reality_tool/.test(realityResult.reason || "");
    const huaweiReady = huaweiHealthState === "ready";
    const huaweiBound = huaweiReady && huaweiHealth?.bound === true;
    const huaweiLatest = huaweiBound && huaweiHealth?.latest && typeof huaweiHealth.latest === "object"
      ? huaweiHealth.latest : null;
    const huaweiSummary = huaweiLatest && typeof huaweiLatest.summary === "string"
      ? huaweiLatest.summary.split("\n").map(line => line.trim()).find(Boolean) || "" : "";
    const healthTitleValue = huaweiBound
      ? huaweiLatest ? huaweiSummary.slice(0, 120) : "宸茬粦瀹?路 灏氭棤鍋ュ悍鎽樿"
      : healthAvailable ? healthValue
        : huaweiReady ? "杩愬姩鍋ュ悍璐﹀彿鏈粦瀹?
          : huaweiHealthState === "error" ? "杩愬姩鍋ュ悍鐘舵€佹殏涓嶅彲璇?
            : "姝ｅ湪璇诲彇杩愬姩鍋ュ悍";
    const healthTitleDetail = huaweiBound
      ? huaweiLatest ? `杩愬姩鍋ュ悍 路 ${ageLabel(huaweiLatest.observed_at)} 路 鍙綔浜ゆ祦鑳屾櫙锛屼笉鍋氬尰鐤楀垽鏂璥
        : "璐﹀彿宸茬粦瀹氾紱鍦ㄣ€屽仴搴锋劅鐭ャ€嶉〉鎷夊彇鏈€鏂版憳瑕?
      : healthAvailable ? `鎵嬫満绔渶杩戞巿鏉冧笂鎶?${ageLabel(health.captured_at)}${huaweiReady ? " 路 杩愬姩鍋ュ悍璐﹀彿鏈粦瀹? : ""} 路 鍙綔浜ゆ祦鑳屾櫙`
        : huaweiReady ? "鍦ㄣ€屾劅鐭?鈫?鍋ュ悍鎰熺煡銆嶉噷缁戝畾杩愬姩鍋ュ悍璐﹀彿"
          : huaweiHealthState === "error" ? huaweiHealthError || "杩愬姩鍋ュ悍鐘舵€佹殏涓嶅彲璇伙紝璇峰埌鍋ュ悍鎰熺煡椤甸噸鏂拌鍙?
            : healthSourceDisabled ? "鎵撳紑銆屾劅鐭?鈫?鍋ュ悍鎰熺煡銆嶉噷鐨勫仴搴锋憳瑕侊紝骞跺湪銆岃繍鍔ㄥ仴搴枫€嶅崱缁戝畾璐﹀彿銆?
              : healthReason === "no_recent_telemetry" ? "鎺ユ敹宸插紑鍚紝绛夊緟鎵嬫満绔笅涓€娆′笂鎶ワ紱鍒锋柊涓嶄細瑙﹀彂閲囬泦銆?
                : healthReason === "telemetry_expired" ? "涓婃涓婃姤宸茶秴杩囨湁鏁堟湡锛涚瓑鎵嬫満閲嶆柊涓婃姤鍚庡啀浣跨敤銆?
                  : healthBlocked ? "鎵撳紑鍋ュ悍鎰熺煡鍚庯紝鍦ㄣ€岃繍鍔ㄥ仴搴枫€嶅崱瀹屾垚 Cookie 鎴栬处鍙峰瘑鐮佺櫥褰曘€?
                    : "鍙樉绀烘渶杩戜竴娆″凡鎺堟潈鍋ュ悍鎽樿锛涜繍鍔ㄥ仴搴疯处鍙风粦瀹氬拰鍙栨暟鍏ュ彛鍦ㄥ仴搴锋劅鐭ラ〉銆?;
    const healthState = huaweiBound ? huaweiLatest ? "ready" : "pending"
      : healthAvailable ? "ready" : huaweiReady ? "off" : huaweiHealthState === "error" ? "pending"
        : healthSourceDisabled || healthBlocked ? "off" : "pending";
    const healthTag = huaweiBound ? huaweiLatest ? "宸插悓姝? : "寰呮媺鍙?
      : healthAvailable ? "鎵嬫満蹇収" : huaweiReady ? "鏈粦瀹?
        : huaweiHealthState === "error" ? "璇诲彇澶辫触" : "璇诲彇涓?;
    channel("device-health", "devices", {tab:tabHealth, icon:"heart-pulse", title:"杩愬姩鍋ュ悍",
      value:healthTitleValue, detail:healthTitleDetail, state:healthState, tag:healthTag});
    channel("device-camera", "devices", {tab:"config-screen:perception-detail-reality-access", icon:"camera", title:"鎽勫儚澶?,
      value:cameraValue,
      detail:cameraResult.state === "available" ? `鏈€杩戣鍙?${ageLabel(cameraResult.captured_at)} 路 ${cameraResult.purpose || "鎸夋湰杞槑纭姹?}`
        : realityNeedsConsent ? "鎽勫儚澶村崟鐙巿鏉冿紝鍙湪鏄庣‘璇锋眰鏃惰鍙栧崟甯с€? : "鍙樉绀哄凡缁忓畬鎴愮殑鍗曞抚璇嗗埆锛涗笉浼氬洜鍒锋柊鑰屾媿鎽勩€?,
      state:cameraResult.state === "available" && cameraResult.answer_available === true ? "ready" : "pending",
      tag:cameraResult.state === "available" ? "宸茶瘑鍒? : realityNeedsConsent ? "闇€鎽勫儚澶存巿鏉? : cameraResult.state === "blocked" ? "闇€鎺堟潈" : cameraResult.state === "ready" ? "寰呰姹? : "鏈氨缁?});
    channel("device-recalls", "external", {tab:"config-recall:perception-detail-recalls", icon:"message-square-quote", title:"鎾ゅ洖璁板綍",
      value:recallValue, detail:recallDetail,
      state:recallState === "error" || recallState === "loading" ? "pending" : recalls.length ? "ready" : "off",
      tag:recallState === "error" ? "璇诲彇澶辫触" : recallState === "loading" ? "璇诲彇涓? : recallStatus?.enabled === false ? "鏈惎鐢? : recalls.length ? "鍙璁板綍" : "鏃犺褰?});
    if (mihomeEnabled) channel("device-mihome", "devices", {tab:"config-screen:perception-detail-mihome", icon:"plug-zap", title:"绫冲璁惧",
      value:mihomeSummary,
      detail:configuredDevices.slice(0, 3).map(item => `${item.name || item.aliases?.[0] || "璁惧"} ${item.online === true ? "鍦ㄧ嚎" : item.online === false ? "绂荤嚎" : "鐘舵€佹湭鐭?}`).join(" 路 ")
        + (mihomeStatus?.snapshot_at ? ` 路 鍚屾 ${mihomeStatus.snapshot_at}` : ""),
      state:offlineCount ? "pending" : "ready", tag:offlineCount ? `${offlineCount} 鍙扮绾縛 : "璁惧姝ｅ父"});
    if (injectionLabels.length) channel("ext-injection", "external", {tab:"config-injection:perception-detail-injection", icon:"layers-3", title:"鍏朵粬娉ㄥ叆",
      value:`${injectionLabels.length} 椤硅繘鍏ユ湰杞笂涓嬫枃`, detail:injectionLabels.join(" 路 "), state:"ready", tag:"鏈疆鏉愭枡"});

    const activeCount = percepts.filter(item => item.state === "ready").length;
    /* === 椤堕儴鎬佸娍鏉?===
       鍥涘紶鍗℃寜鑳藉姏绨囧垎鏉匡紝姣忓潡鍙敤涓€涓富瑙嗚璇磋瘽锛氱幆澧冨崱缁欏ぉ姘旇鏁般€佹ā鍨嬪崱缁欑璐淬€?       璁惧涓庡閮ㄥ崱绐佸嚭瀹氫綅涓庝綑棰濓紝鐘舵€佽鏄剧ず瀹為檯璇绘暟銆佹椂闂村強缂哄け鍘熷洜銆?       鍗″ご涓庨€氶亾鐩存帴閫夋嫨浠〃鐩樹笅鏂圭殑鐪熷疄閰嶇疆椤碉紝涓嶅湪鍗″唴閲嶅灞曞紑鐘舵€佸垪琛ㄣ€?*/
    const boardRows = id => percepts.filter(item => item.board === id);
    const boardSpecs = [
      {id:"environment", tone:"environment", icon:"cloud-sun", title:"鏃剁┖ 路 鐜", tab:tabPlace},
      {id:"models", tone:"models", icon:"cpu", title:"妯″瀷鑳藉姏", tab:tabModel, modelTab:"fn"},
      {id:"devices", tone:"devices", icon:"radar", title:"鐜板疄鎰熺煡鍔熻兘", tab:tabDevice},
      {id:"external", tone:"external", icon:"layers-2", title:"澶栭儴涓庤褰?, tab:"config-news:perception-detail-external"},
    ];
    const destinationAttrs = (destination, modelTab="") => `data-board-goto="${esc(destination)}" aria-controls="${esc(destination.split(":")[0])}" aria-expanded="false"${modelTab ? ` data-board-model-tab="${esc(modelTab)}"` : ""}`;
    const singleAttrs = (destination, title, itemId="", modelTab="") => `${destinationAttrs(destination, modelTab)} data-board-single="true" data-perception-item="${esc(itemId)}" data-item-title="${esc(title)}"`;
    const customAttrs = (destination, title, itemId, modelTab="") => `id="perception-channel-${esc(itemId)}" ${singleAttrs(destination, title, itemId, modelTab)} title="${esc(title)}" aria-label="${esc(`${title}銆傛墦寮€杩欎竴椤圭殑璁剧疆`)}"`;
    const channelAttrs = item => `id="perception-channel-${item.id}" ${singleAttrs(item.tab, item.title, item.id, item.modelTab)} title="${esc(`${item.tag} 路 ${item.value} 路 ${item.detail}`)}" aria-label="${esc(`${item.title}锛?{item.tag}銆?{item.value}銆?{item.detail}銆傛墦寮€杩欎竴椤圭殑璁剧疆`)}"`;
    const channelById = id => percepts.find(item => item.id === id);
    const timeMarkup = (value, fallback="") => {
      const date = typeof value === "number" ? new Date(value * 1000) : new Date(value || "");
      return Number.isNaN(date.getTime()) ? fallback ? `<small class="perception-reading-age">${esc(fallback)}</small>` : ""
        : `<time class="perception-reading-age" datetime="${esc(date.toISOString())}" title="${esc(date.toLocaleString("zh-CN", {timeZone:clockZone()}))}">${esc(ageLabel(value))}</time>`;
    };
    const badgeMarkup = (state, label) => `<span class="perception-reading-badge is-${state}"><i class="perception-dot" aria-hidden="true"></i>${esc(label)}</span>`;
    const readingRow = (item, label, value, observedAt, fallback="") => `<button type="button" class="perception-reading-row is-${item.state}" ${channelAttrs(item)}>
      <span class="perception-reading-icon">${icon(item.icon)}</span><strong>${esc(label)}</strong>
      <span class="perception-reading-value">${esc(value)}</span>${timeMarkup(observedAt, fallback)}<i class="perception-dot" aria-hidden="true"></i>
    </button>`;
    const deviceCard = (() => {
      const location = channelById("device-location"), screen = channelById("device-screen"), phone = channelById("device-phone");
      const health = channelById("device-health"), camera = channelById("device-camera"), mihome = channelById("device-mihome");
      const cameraAuthorized = cameraResult.state === "available" || cameraResult.state === "ready";
      const cameraTag = cameraAuthorized ? "宸叉巿鏉? : runtimeState === "error" ? "璇诲彇澶辫触" : runtimeState === "loading" ? "璇诲彇涓? : /consent/.test(cameraResult.reason || "") ? "寰呮巿鏉? : "鏈氨缁?;
      const mihomeLabel = mihome ? mihomeSummary : mihomeState === "disabled" ? "鏈惎鐢? : mihomeState === "loading" ? "璇诲彇涓? : "鏆備笉鍙";
      return `<div class="perception-reading-card">
        <button type="button" class="perception-feature is-location is-${location.state}" ${channelAttrs(location)}>
          <span class="perception-feature-icon">${icon("map-pin")}</span>
          <span class="perception-feature-copy"><small>褰撳墠瀹氫綅</small><strong>${esc(mobileValue)}</strong><span>${mobile.location?.available ? "鏈€杩戞巿鏉冨揩鐓? : "鐐瑰嚮閰嶇疆瀹氫綅涓庢墜鏈烘巿鏉?}</span></span>
          <span class="perception-feature-meta">${badgeMarkup(location.state, mobile.location?.available ? "鏈€杩戜竴娆″畾浣? : location.tag)}${timeMarkup(mobile.location?.available ? mobile.location.captured_at : null)}</span>
        </button>
        ${readingRow(screen, "璇嗗睆", screenResult.state === "available" ? `涓婃璇嗗埆 路 ${screenResult.surface || "灞忓箷鐢婚潰"}` : screenValue, screenResult.state === "available" ? screenResult.created_at || screenResult.captured_at : null)}
        ${readingRow(phone, "鎵嬫満鐘舵€?, phoneValue, phoneAvailable ? device.last_report_at || activity.last_report_at || realityResult.captured_at : null)}
        ${readingRow(health, "鍋ュ悍鎽樿", healthValue, healthAvailable ? health.captured_at : null)}
        <div class="perception-board-footer"><span>璁惧鎺堟潈</span><div class="perception-authorization-chips">
          <button type="button" class="perception-authorization-chip is-${cameraAuthorized ? "ready" : camera.state}" ${channelAttrs(camera)}><i class="perception-dot" aria-hidden="true"></i>鎽勫儚澶?路 ${esc(cameraTag)}</button>
          <button type="button" class="perception-authorization-chip is-${mihome?.state || (mihomeState === "disabled" ? "off" : "pending")}" ${mihome ? channelAttrs(mihome) : destinationAttrs(tabDevice)} title="${esc(mihome?.detail || mihomeLabel)}"><i class="perception-dot" aria-hidden="true"></i>绫冲 路 ${esc(mihomeLabel)}</button>
        </div></div>
      </div>`;
    })();
    const externalCard = (() => {
      const balance = channelById("ext-balance"), external = channelById("ext-external"), recall = channelById("device-recalls"), injection = channelById("ext-injection");
      const balanceReadLabel = balanceObservation ? balanceObservationIsDraft ? "鑽夌娴嬭瘯缁撴灉" : "鏈€杩戜竴娆℃煡璇?
        : balanceTesting || balanceStatusLoading ? "鏌ヨ涓? : balanceTestError || balanceError || balanceStatusError ? "璇诲彇澶辫触"
          : balanceStatus?.state === "not_configured" || balanceConfig ? "鏈厤缃? : balanceConfigLoading ? "璇诲彇涓? : balanceSourceInvalid ? "閰嶇疆鏃犳晥" : "绛夊緟璇诲彇";
      const balanceReadDetail = balanceTestError || balanceError || balanceStatusError || (balanceObservation ? balanceObservation.provider_label || "NewAPI"
        : balanceSourceInvalid ? "璇锋鏌ユ暟鎹簮閰嶇疆" : balanceSourceConfigured ? "璇诲彇鏈嶅姟浣欓涓? : "閰嶇疆鏁版嵁婧愬悗璇诲彇鏈嶅姟浣欓");
      const newsSummary = !ready ? externalValue : networkSucceeded
        ? `${Number.isInteger(news.itemCount) && news.itemCount >= 0 ? `鏈€杩戞鏌?${news.itemCount} 鏉 : "鏈€杩戞鏌ラ€氳繃"} 路 ${news.label || "璧勮鏉ユ簮"}`
        : news.networkStatus === "failed" ? "涓婃妫€鏌ュけ璐?路 璇锋鏌ユ潵婧? : externalValue;
      return `<div class="perception-reading-card">
        <button type="button" class="perception-feature is-balance is-${balance.state}" ${channelAttrs(balance)}>
          <span class="perception-feature-icon">${icon("circle-dollar-sign")}</span>
          <span class="perception-feature-copy"><small>浣欓鎰熺煡</small><strong>${balanceObservation ? `<span class="perception-balance-unit">${esc(balanceObservation.currency_label || "棰濆害")}</span> ${esc(formatBalanceAmount(balanceObservation.amount))}` : "灏氭棤浣欓璇绘暟"}</strong><span>${esc(balanceReadDetail)}</span></span>
          <span class="perception-feature-meta">${badgeMarkup(balance.state, balanceReadLabel)}${timeMarkup(balanceObservation?.observed_at)}</span>
        </button>
        ${readingRow(external, "澶栭儴璧勮", newsSummary, news.lastAttemptAt || news.lastCheckedAt)}
        ${readingRow(recall, "鎾ゅ洖璁板綍", recallState === "ready" && recallStatus?.enabled !== false ? `褰撳墠绐楀彛 ${recalls.length} 鏉″彲璇昏褰昤 : recallValue, recalls[0]?.withdrawn_at, recalls[0]?.local_time)}
        <div class="perception-board-footer">${injection ? `<button type="button" class="perception-injection-summary" ${channelAttrs(injection)}>${icon("layers-3")}<span>鍏朵粬娉ㄥ叆 路 鏈疆 ${injectionLabels.length} 椤?路 ${esc(injectionLabels.join("銆?))}</span></button>` : '<span>鏈疆鏆傛棤鍏朵粬娉ㄥ叆</span>'}</div>
      </div>`;
    })();
    const weatherIconName = condition => {
      const text = String(condition || "");
      if (/闆▅闆獆闆穦闆緗闇?.test(text)) return "cloud-rain";
      if (/闃?.test(text)) return "cloud";
      return "cloud-sun";
    };
    /* 鐜鍗★細鍦扮偣銆佹椂闂淬€佹洿鏂版椂鍒汇€侀璀︾姸鎬併€佹俯搴﹁鏁板叏闈犳帓鐗堝眰绾ц璇濓紝涓嶅啓鏍囩琛屻€?*/
    const weatherCard = (() => {
      const item = percepts.find(entry => entry.id === "env-weather");
      const available = weather.state === "available";
      const place = weather.location || locationName || (!ready ? `瑙掕壊鍦扮偣${configurationState}` : "灏氭湭璁剧疆瑙掕壊鍦扮偣");
      const alertState = alertList.length ? "瀹炴椂棰勮" : runtimeState === "error" ? "璇诲彇澶辫触"
        : runtimeState === "loading" ? "寰呰鍙? : weather.state === "disabled" || weather.state === "unconfigured" ? "鏈惎鐢?
          : !available || configurationFailed ? "鏆備笉鍙" : environment.alertsReady ? "褰撳墠鏃犻璀? : "鏈厤缃?;
      const metaBits = [weather.humidity_pct == null ? "" : `婀垮害 ${weather.humidity_pct}%`,
        weather.wind_kph == null ? "" : `椋?${weather.wind_kph} km/h`].filter(Boolean);
      return `<div class="perception-wx">
        <div class="perception-wx-top">
          <button type="button" class="perception-wx-place" ${destinationAttrs(tabPlace)} aria-label="鎵€鍦ㄥ湴锛?{esc(place)}銆傛墦寮€鎵€鍦ㄥ湴涓庡ぉ姘旈厤缃?>${icon("map-pin")}<b>${esc(place)}</b></button>
          <button type="button" class="perception-wx-time" ${destinationAttrs(tabCalendar)} aria-label="鎵撳紑鏃ユ湡涓庡巻娉曚笂涓嬫枃閰嶇疆" data-context-clock-time>--:--</button>
        </div>
        <div class="perception-wx-sub">
          <button type="button" class="perception-wx-date" ${destinationAttrs(tabCalendar)} aria-label="鏃ユ湡涓庡巻娉曪細${esc(calendarView?.detail || "鏈嶅姟绔棩鍘嗘殏涓嶅彲鐢?)}銆傛墦寮€鏃ユ湡涓庡巻娉曚笂涓嬫枃閰嶇疆"><i data-context-clock-date>${runtimeState === "loading" ? "鏃ユ湡涓庡巻娉曞緟璇诲彇" : ""}</i><i data-context-clock-lunar></i><em data-context-clock-tag hidden></em></button>
          <button type="button" class="perception-wx-chip is-${alertState === "瀹炴椂棰勮" ? "alert" : alertState === "褰撳墠鏃犻璀? ? "ready" : "off"}" ${destinationAttrs(tabPlace)} title="${esc(alertList.map(item => item.title || item.event_name || "瀹樻柟棰勮").join(" 路 "))}">${icon("triangle-alert")}<span>澶╂皵棰勮 路 ${alertState}</span></button>
        </div>
        <button type="button" class="perception-wx-main" ${channelAttrs(item)}>
          <span class="perception-wx-icon">${icon(available ? weatherIconName(weather.condition) : "cloud")}</span>
          <span class="perception-wx-temp">${esc(available && weather.temperature_c != null ? String(weather.temperature_c) : "鈥?)}<i>掳C</i></span>
          <span class="perception-wx-meta">
            <strong>${esc(available ? weather.condition || "瀹炲喌宸茶鍙? : item.value)}</strong>
            <small>${esc(metaBits.length ? metaBits.join(" 路 ") : item.detail)}</small>
          </span>
        </button>
        ${calendarView?.detail ? `<button type="button" class="perception-wx-calendar" ${destinationAttrs(tabCalendar)}>${esc(calendarView.detail)}</button>` : ""}
        <button type="button" class="perception-wx-events" ${destinationAttrs("config-environment:perception-detail-important-days")}>${icon("calendar-heart")}<span>${events.length ? events.map(event => `${esc(event.label)} 路 ${event.days === 0 ? "浠婂ぉ" : event.days === 1 ? "鏄庡ぉ" : `${event.days} 澶╁悗`}`).join("锛?) : "鏆傛棤杩戞湡鐢熸棩涓庣邯蹇垫棩"}</span></button>
      </div>`;
    })();
    const boardBadgeMarkup = (state, label) => `<span class="perception-reading-badge is-${esc(state)}"><i class="perception-dot" aria-hidden="true"></i>${esc(label)}</span>`;
    const heroMarkup = ({state="off", iconName="circle", title, value="", valueHtml="", detail="", detailHtml="", tag="", attrs="", tone="generic"}) =>
      `<button type="button" class="perception-hero is-${esc(tone)} is-${esc(state)}" ${attrs}>
        <span class="perception-hero-icon">${icon(iconName)}</span>
        <span class="perception-hero-copy"><small>${esc(title)}</small><strong>${valueHtml || esc(value)}</strong><span>${detailHtml || esc(detail)}</span></span>
        ${boardBadgeMarkup(state, tag)}
        <span class="perception-hero-chevron">${icon("chevron-right")}</span>
      </button>`;
    const miniMarkup = ({state="off", iconName="circle", title, value="", valueHtml="", detail="", detailHtml="", tag="", attrs=""}) =>
      `<button type="button" class="perception-mini is-${esc(state)}" ${attrs}>
        <span class="perception-mini-icon">${icon(iconName)}</span>
        <span class="perception-mini-copy"><small>${esc(title)}</small><strong>${valueHtml || esc(value)}</strong>${detail || detailHtml ? `<span>${detailHtml || esc(detail)}</span>` : ""}</span>
        ${boardBadgeMarkup(state, tag)}
      </button>`;
    const itemHero = (item, overrides={}) => heroMarkup({
      state:item.state, iconName:item.icon, title:item.title, value:item.value,
      detail:item.detail, tag:item.tag, attrs:channelAttrs(item), ...overrides,
    });
    const itemMini = (item, overrides={}) => miniMarkup({
      state:item.state, iconName:item.icon, title:item.title, value:item.value,
      detail:item.detail, tag:item.tag, attrs:channelAttrs(item), ...overrides,
    });
    const environmentBodyMarkup = () => {
      const alert = channelById("env-alert");
      const alertFailed = runtimeState === "error" || (!ready && configurationFailed);
      const alertMini = alert ? itemMini(alert) : miniMarkup({
        state: alertFailed ? "pending" : environment.alertsReady ? "ready" : "off",
        iconName:"triangle-alert", title:"澶╂皵棰勮",
        value: alertFailed ? "棰勮璇诲彇澶辫触" : environment.alertsReady ? "褰撳墠鏃犻璀? : "棰勮鐘舵€佹湭閰嶇疆",
        detail: weather.state === "available" ? `${weather.provider || "澶╂皵鏉ユ簮"} 路 宸叉鏌 : "澶╂皵涓嶅彲鐢ㄦ椂涓嶄細娌跨敤鏃ч璀?,
        tag: alertFailed ? "璇诲彇澶辫触" : environment.alertsReady ? "鏃犻璀? : "鏈厤缃?,
        attrs:customAttrs(tabPlace, "澶╂皵棰勮", "env-alert"),
      });
      const eventSummary = events.length
        ? events.map(event => `${event.label} 路 ${event.days === 0 ? "浠婂ぉ" : event.days === 1 ? "鏄庡ぉ" : `${event.days} 澶╁悗`}`).join("锛?)
        : "鏆傛棤杩戞湡鐢熸棩涓庣邯蹇垫棩";
      const datesMini = miniMarkup({
        state: events.length ? "ready" : "off", iconName:"calendar-heart", title:"閲嶈鏃ユ湡",
        value:eventSummary, detail:"瑙掕壊妗ｆ涓庣鑱婅祫鏂?, tag:events.length ? `${events.length} 椤筦 : "鏆傛棤",
        attrs:customAttrs("config-environment:perception-detail-important-days", "閲嶈鏃ユ湡", "env-dates"),
      });
      const available = weather.state === "available";
      const temp = available && weather.temperature_c != null ? `${weather.temperature_c}掳C` : "鈥?;
      const weatherBits = [weather.condition || "澶╂皵寰呰鍙?,
        weather.humidity_pct == null ? "" : `婀垮害 ${weather.humidity_pct}%`,
        weather.wind_kph == null ? "" : `椋?${weather.wind_kph} km/h`].filter(Boolean).join(" 路 ");
      const weatherItem = channelById("env-weather");
      const timeHero = heroMarkup({
        state:"ready", iconName:"clock", title:"鐜板湪", tone:"time", tag:"鏈湴",
        valueHtml:`<b data-context-clock-time>--:--</b>`,
        detailHtml:`<span data-context-clock-date>鏃ユ湡涓庡巻娉曞緟璇诲彇</span>${calendarView?.detail ? `<span class="perception-hero-extra">${esc(calendarView.detail)}</span>` : ""}`,
        attrs:customAttrs(tabCalendar, "褰撳墠鏃堕棿", "env-time"),
      });
      const weatherHero = weatherItem ? itemHero(weatherItem, {
        iconName: available ? weatherIconName(weather.condition) : "cloud",
        title:"澶╂皵瀹炲喌", value: temp, detail: weatherBits,
        tone:"weather", tag: weatherItem.tag,
      }) : "";
      const location = channelById("env-location");
      return `<div class="perception-hero-grid is-two">${timeHero}${weatherHero}</div>
        <div class="perception-mini-grid is-three">${location ? itemMini(location) : ""}${alertMini}${datesMini}</div>`;
    };
    const modelBodyMarkup = () => {
      const rows = boardRows("models");
      const conversation = rows.find(item => item.id === "model-conversation");
      const rest = rows.filter(item => item !== conversation);
      const modelHero = conversation ? itemHero(conversation, {
        title:"瀵硅瘽妯″瀷", tone:"model", value:conversation.value,
        detail:conversation.detail, tag:conversation.tag,
      }) : `<div class="perception-board-empty">妯″瀷璺敱鏆備笉鍙</div>`;
      return `<div class="perception-hero-grid is-one">${modelHero}</div>
        <div class="perception-mini-grid is-three">${rest.map(item => itemMini(item)).join("")}</div>`;
    };
    const realityBodyMarkup = () => {
      const location = channelById("device-location");
      const health = channelById("device-health");
      const minis = ["device-screen", "device-phone", "device-camera", "device-mihome"]
        .map(id => channelById(id)).filter(Boolean).map(item => itemMini(item)).join("");
      return `<div class="perception-hero-grid is-two">
        ${location ? itemHero(location, {title:"褰撳墠瀹氫綅", tone:"location"}) : ""}
        ${health ? heroMarkup({state:healthState, iconName:"heart-pulse", title:"杩愬姩鍋ュ悍", value:healthTitleValue,
          detail:healthTitleDetail, tag:healthTag, attrs:channelAttrs(health), tone:"health"}) : ""}
      </div><div class="perception-mini-grid is-two">${minis}</div>`;
    };
    const externalBodyMarkup = () => {
      const balance = channelById("ext-balance");
      const external = channelById("ext-external");
      let balanceValue = balance?.value || "", balanceDetail = balance?.detail || "", balanceTag = balance?.tag || "";
      if (balance && balanceObservation) {
        balanceValue = `${formatBalanceAmount(balanceObservation.amount)} ${balanceObservation.currency_label || "棰濆害"}`;
        balanceDetail = `${balanceObservation.provider_label || "NewAPI"} 路 ${balanceObservationIsDraft ? "鑽夌娴嬭瘯" : "鏈€杩戞煡璇?}${balanceObservation.observed_at ? ` 路 ${ageLabel(balanceObservation.observed_at)}` : ""}`;
        balanceTag = balanceObservationIsDraft ? "鑽夌娴嬭瘯" : "鏈€杩戞煡璇?;
      } else if (balance) {
        const error = balanceTestError || balanceError || balanceStatusError;
        if (error) { balanceDetail = error; balanceTag = "璇诲彇澶辫触"; }
      }
      const minis = ["device-recalls", "ext-injection"]
        .map(id => channelById(id)).filter(Boolean).map(item => itemMini(item)).join("");
      return `<div class="perception-hero-grid is-two">
        ${balance ? heroMarkup({state:balance.state, iconName:"wallet-cards", title:"浣欓鎰熺煡", value:balanceValue,
          detail:balanceDetail, tag:balanceTag, attrs:channelAttrs(balance), tone:"balance"}) : ""}
        ${external ? itemHero(external, {title:"澶栭儴璧勮", tone:"news"}) : ""}
      </div><div class="perception-mini-grid is-two">${minis}</div>`;
    };
    const boardBodyMarkup = spec => {
      if (spec.id === "environment") return environmentBodyMarkup();
      if (spec.id === "models") return modelBodyMarkup();
      if (spec.id === "devices") return realityBodyMarkup();
      return externalBodyMarkup();
    };
    const boardMarkup = `<section class="perception-board" aria-label="鎰熺煡鎬佸娍鏉?>${boardSpecs.map(spec => {
      const rows = boardRows(spec.id);
      const live = rows.filter(item => item.state === "ready").length;
      const count = spec.id === "environment" ? 5 : rows.length;
      return `<article class="perception-board-card is-${spec.tone}">
        <div id="perception-board-toggle-${spec.id}" class="perception-board-head is-static" data-perception-board="${spec.id}"
          aria-label="${esc(spec.title)}锛?{count} 涓潯鐩紝${live} 椤瑰疄鍐靛湪绾?>
          <span class="perception-board-icon">${icon(spec.icon)}</span>
          <span class="perception-board-title"><strong>${esc(spec.title)}</strong></span>
          <span class="perception-board-channels">${count} 椤?/span>
        </div>
        <div class="perception-board-body">${boardBodyMarkup(spec)}</div>
      </article>`;
    }).join("")}</section><p class="perception-board-hint">鐐瑰嚮鍔熻兘鏉夸腑鐨勪换鎰忔潯鐩紝鍦ㄤ笅鏂瑰崟鐙睍寮€璇ラ」閰嶇疆锛涗笉浼氬睍寮€鏁翠釜鍒嗙被銆?/p>`;

    const previewField = (label, value) => `<div class="perception-preview-field"><span>${esc(label)}</span><strong>${esc(value || "鈥?)}</strong></div>`;
    const previewFields = entries => `<div class="perception-preview-fields">${entries.map(([label, value]) => previewField(label, value)).join("")}</div>`;
    const previewCard = ({title, tag="", state="off", body="", note=""}) => `<section class="perception-item-preview">
      <header class="perception-preview-head"><div><small>褰撳墠鍐呭</small><h3>${esc(title)}</h3></div>${boardBadgeMarkup(state, tag)}</header>
      <div class="perception-preview-body">${body}</div>
      <p class="perception-preview-note">${esc(note || "杩欓噷灞曠ず褰撳墠宸茶鍙栨垨宸蹭繚瀛樼殑鍐呭锛涙槸鍚﹁繘鍏ヤ笅涓€杞璇濈敱瀹為檯涓婁笅鏂囧喅瀹氥€?)}</p>
    </section>`;
    const buildItemPreviews = () => {
      itemPreviewMarkup = new Map();
      for (const item of percepts) {
        itemPreviewMarkup.set(item.id, previewCard({title:item.title, state:item.state, tag:item.tag,
          body:previewFields([["褰撳墠璇绘暟", item.value], ["鏉ユ簮涓庢椂鏁?, item.detail]])}));
      }
      itemPreviewMarkup.set("env-time", previewCard({title:"褰撳墠鏃堕棿", state:"ready", tag:"鏈湴",
        body:previewFields([["鏈湴鏃堕棿", new Date().toLocaleTimeString("zh-CN", {hour12:false, timeZone:clockZone()})],
          ["鏃ユ湡涓庡巻娉?, serverDateLabel() || "鏃ユ湡涓庡巻娉曞緟璇诲彇"], ["鏃跺尯", clockZone()]])}));
      itemPreviewMarkup.set("env-location", previewCard({title:"鎵€鍦ㄥ湴", state:environment.locationName ? "ready" : ready ? "off" : "pending",
        tag:environment.locationName ? "宸查厤缃? : "寰呰缃?,
        body:previewFields([["鍦扮偣", environment.locationName || "灏氭湭璁剧疆"], ["鐢ㄩ€?, "鐢ㄤ簬澶╂皵銆佹棩绋嬩笌鐢熸椿瑙勫垝锛涗笉鏄剧ず缁忕含搴?]])}));
      itemPreviewMarkup.set("env-weather", previewCard({title:"澶╂皵瀹炲喌", state:weather.state === "available" ? "ready" : "off",
        tag:weather.state === "available" ? "瀹炲喌" : "鏈氨缁?,
        body:previewFields([["鍦扮偣", weather.location || locationName || "鈥?],
          ["澶╂皵", weather.state === "available" ? `${weather.condition || "宸茶鍙?}${weather.temperature_c == null ? "" : ` 路 ${weather.temperature_c}掳C`}` : weatherValue],
          ["婀垮害涓庨", [weather.humidity_pct == null ? "" : `婀垮害 ${weather.humidity_pct}%`, weather.wind_kph == null ? "" : `椋庨€?${weather.wind_kph} km/h`].filter(Boolean).join(" 路 ") || "鈥?],
          ["鏉ユ簮涓庢椂鏁?, weatherDetail]])
          + (alertList.length ? `<ul class="perception-preview-material-list">${alertList.map(alert => `<li><strong>${esc(alert.title || alert.event_name || "澶╂皵棰勮")}</strong><span>${esc(alert.severity || "绾у埆寰呮牳瀵?)}${alert.ends_at ? ` 路 鑷?${esc(new Date(alert.ends_at).toLocaleString("zh-CN"))}` : ""}</span></li>`).join("")}</ul>` : `<p class="perception-preview-empty">褰撳墠娌℃湁瀹樻柟澶╂皵棰勮銆?/p>`)}));
      itemPreviewMarkup.set("env-alert", previewCard({title:"澶╂皵棰勮", state:alertList.length ? "pending" : "ready",
        tag:alertList.length ? `${alertList.length} 鏉 : "鏃犻璀?,
        body:alertList.length ? `<ul class="perception-preview-material-list">${alertList.map(alert => `<li><strong>${esc(alert.title || alert.event_name || "澶╂皵棰勮")}</strong><span>${esc(alert.severity || "绾у埆寰呮牳瀵?)}${alert.ends_at ? ` 路 鑷?${esc(new Date(alert.ends_at).toLocaleString("zh-CN"))}` : ""}</span></li>`).join("")}</ul>` : `<p class="perception-preview-empty">褰撳墠鏃犻璀︺€?/p>`}));
      itemPreviewMarkup.set("env-dates", previewCard({title:"閲嶈鏃ユ湡", state:events.length ? "ready" : "off",
        tag:events.length ? `${events.length} 椤筦 : "鏆傛棤",
        body:events.length ? `<ul class="perception-preview-material-list">${events.map(event => `<li><strong>${esc(event.label)}</strong><span>${event.days === 0 ? "浠婂ぉ" : event.days === 1 ? "鏄庡ぉ" : `${event.days} 澶╁悗`}</span></li>`).join("")}</ul>` : `<p class="perception-preview-empty">杩戞湡娌℃湁鐢熸棩鎴栫邯蹇垫棩銆?/p>`}));
      if (calendarView) itemPreviewMarkup.set("env-calendar", previewCard({title:"鏃ユ湡涓庡巻娉?, state:"ready", tag:"鏈嶅姟绔棩鍘?,
        body:previewFields([["浠婂ぉ", calendarView.labels], ["鍐滃巻/鑺傛皵/榛勫巻", calendarView.detail],
          ["鏃跺尯", clockZone()]])}));
      const modelIds = ["model-conversation", "model-tts", "model-image", "model-vision"];
      for (const id of modelIds) {
        const item = channelById(id);
        if (item) itemPreviewMarkup.set(id, previewCard({title:item.title, state:item.state, tag:item.tag,
          body:previewFields([["褰撳墠璺敱", item.value], ["Provider 涓庣姸鎬?, item.detail]])}));
      }
      const location = channelById("device-location");
      if (location) itemPreviewMarkup.set("device-location", previewCard({title:"褰撳墠瀹氫綅", state:location.state, tag:location.tag,
        body:previewFields([["浣嶇疆", mobile.location?.available ? mobile.location.label || "闄勮繎浣嶇疆宸茶鍙? : mobileValue],
          ["璇诲彇鏃堕棿", mobile.location?.available ? ageLabel(mobile.location.captured_at) : "鏆傛棤宸叉巿鏉冨揩鐓?],
          ["浣跨敤杈圭晫", "鍙洖鏄惧璇濆凡缁忚鍙栫殑浣嶇疆锛屼笉涓诲姩閲囬泦锛涗笉鏄剧ず鍧愭爣"]])}));
      const screen = channelById("device-screen");
      if (screen) itemPreviewMarkup.set("device-screen", previewCard({title:"璇嗗睆", state:screen.state, tag:screen.tag,
        body:previewFields([["鏈€杩戣В璇?, screenResult.state === "available" ? screenResult.interpretation || "宸叉湁灞忓箷瑙ｈ" : screenValue],
          ["灞忓箷鏉ユ簮", screenResult.state === "available" ? screenResult.surface || "灞忓箷鐢婚潰" : "鈥?],
          ["閲囬泦涓庤В璇?, screenResult.state === "available" ? `閲囬泦 ${ageLabel(screenResult.captured_at)} 路 瑙ｈ ${ageLabel(screenResult.created_at)}` : "鏆傛棤宸蹭繚瀛樿В璇?]])}));
      const phone = channelById("device-phone");
      if (phone) itemPreviewMarkup.set("device-phone", previewCard({title:"鎵嬫満鐘舵€?, state:phone.state, tag:phone.tag,
        body:previewFields([["褰撳墠鐘舵€?, phoneValue], ["鏈€杩戜笂鎶?, phoneAvailable ? ageLabel(device.last_report_at || activity.last_report_at || realityResult.captured_at) : "鏆傛棤宸叉巿鏉冨揩鐓?], ["浣跨敤杈圭晫", "鍒锋柊椤甸潰涓嶄細瑙﹀彂鎵嬫満閲囬泦"]])}));
      const health = channelById("device-health");
      if (health) itemPreviewMarkup.set("device-health", previewCard({title:"杩愬姩鍋ュ悍", state:healthState, tag:healthTag,
        body:(huaweiLatest?.summary ? `<pre class="perception-preview-text">${esc(String(huaweiLatest.summary).slice(0,5000))}</pre>` : previewFields([["褰撳墠鎽樿", healthTitleValue], ["鏉ユ簮涓庢椂鏁?, healthTitleDetail]])),
        note:"鍋ュ悍鎽樿鍙綔涓轰氦娴佽儗鏅紝涓嶅仛鍖荤枟鍒ゆ柇锛屼篃涓嶉€愰」鎾姤鎸囨爣銆?}));
      const camera = channelById("device-camera");
      if (camera) itemPreviewMarkup.set("device-camera", previewCard({title:"鎽勫儚澶?, state:camera.state, tag:camera.tag,
        body:previewFields([["鏈€杩戣瀵?, cameraValue], ["鐢ㄩ€?, cameraResult.state === "available" ? cameraResult.purpose || "鎸夋湰杞槑纭姹? : "鍙湪鏄庣‘璇锋眰鏃惰鍙栧崟甯?],
          ["鏃堕棿", cameraResult.state === "available" ? ageLabel(cameraResult.captured_at) : "鏆傛棤宸蹭繚瀛樼粨鏋?]])}));
      const mihome = channelById("device-mihome");
      if (mihome) itemPreviewMarkup.set("device-mihome", previewCard({title:"绫冲璁惧", state:mihome.state, tag:mihome.tag,
        body:configuredDevices.length ? `<ul class="perception-preview-material-list">${configuredDevices.map(item => `<li><strong>${esc(item.name || item.aliases?.[0] || "鏈懡鍚嶈澶?)}</strong><span>${esc((item.aliases || []).join("銆?) || "鏈缃埆鍚?)} 路 ${item.online === true ? "鍦ㄧ嚎" : item.online === false ? "绂荤嚎" : "鐘舵€佹湭鐭?}</span></li>`).join("")}</ul>` : `<p class="perception-preview-empty">鍙璁惧鐘舵€佸凡寮€鍚紝鏆傛棤宸叉槧灏勮澶囥€?/p>`}));
      const external = channelById("ext-external");
      if (external) {
        const poolItems = Array.isArray(materialPool?.items) ? materialPool.items.filter(item => item && typeof item.title === "string") : [];
        const poolHtml = materialPoolState === "loading" ? `<p class="perception-preview-empty">姝ｅ湪璇诲彇璧勮姹犫€?/p>`
          : materialPoolState === "error" ? `<p class="perception-preview-empty">璧勮姹犺鍙栧け璐ワ細${esc(materialPoolError)}</p>`
            : poolItems.length ? `<ul class="perception-preview-material-list is-scroll">${poolItems.map(item => `<li><strong>${esc(item.title)}</strong>${item.detail ? `<span>${esc(String(item.detail).slice(0, 280))}</span>` : ""}<small>${esc(item.note || item.source || "璧勮")}${item.captured_at ? ` 路 ${esc(ageLabel(item.captured_at))}` : ""}</small></li>`).join("")}</ul>`
              : `<p class="perception-preview-empty">璧勮姹犳殏鏃犲彲灞曠ず鏉＄洰銆?/p>`;
        itemPreviewMarkup.set("ext-external", previewCard({title:"澶栭儴璧勮", state:external.state, tag:external.tag,
          body:previewFields([["鏉ユ簮", news.label || "灏氭湭閰嶇疆"], ["鑷€夊叴瓒?, news.explorationInterests || "鏈寚瀹?],
            ["妫€鏌ヨ妭濂?, [Number.isInteger(news.explorationIntervalHours) ? `鏈€鐭?${news.explorationIntervalHours} 灏忔椂` : "", Number.isInteger(news.explorationResultCount) ? `姣忔鏈€澶?${news.explorationResultCount} 鏉 : ""].filter(Boolean).join(" 路 ") || "鈥?],
            ["鏈€杩戞鏌?, [news.lastCheckedAt || "鈥?, Number.isInteger(news.itemCount) ? `${news.itemCount} 鏉 : ""].filter(Boolean).join(" 路 ")]])
            + poolHtml, note:"杩欓噷灞曠ず褰撳墠璧勮姹犱腑鐨勮嚜閫夊唴瀹癸紱鍙湁瀹為檯琚€変腑鐨勬潯鐩墠浼氳繘鍏ュ璇濓紝涓嶄細鏁存壒娉ㄥ叆銆?}));
      }
      const balance = channelById("ext-balance");
      if (balance) itemPreviewMarkup.set("ext-balance", previewCard({title:"浣欓鎰熺煡", state:balance.state, tag:balance.tag,
        body:previewFields([["褰撳墠棰濆害", balanceObservation ? `${formatBalanceAmount(balanceObservation.amount)} ${balanceObservation.currency_label || "棰濆害"}` : "灏氭棤浣欓璇绘暟"],
          ["鏈嶅姟鍟?, balanceObservation?.provider_label || "NewAPI"], ["鏈€杩戞煡璇?, balanceObservation?.observed_at ? ageLabel(balanceObservation.observed_at) : "灏氭棤鏌ヨ缁撴灉"],
          ["鐢ㄩ€?, "浠呭湪浣欓杈惧埌闃堝€兼椂浣滀负涓诲姩鑱旂郴绱犳潗锛屼笉杩涘叆鏃ュ父瀵硅瘽"]])}));
      const recallsItem = channelById("device-recalls");
      if (recallsItem) itemPreviewMarkup.set("device-recalls", previewCard({title:"鎾ゅ洖璁板綍", state:recallsItem.state, tag:recallsItem.tag,
        body:recalls.length ? `<ul class="perception-preview-material-list is-scroll">${recalls.map(item => `<li><strong>${esc(item.local_time || ageLabel(item.withdrawn_at))} 路 ${esc(item.author || "褰撳墠浼氳瘽")}</strong><span>${esc(String(item.text || "锛堟棤鍙睍绀烘枃鏈級").slice(0, 1000))}</span></li>`).join("")}</ul>` : `<p class="perception-preview-empty">${esc(recallState === "error" ? `璇诲彇澶辫触锛?{recallError || "鍘熷洜鏈煡"}锛塦 : recallStatus?.enabled === false ? "鎾ゅ洖杞綍鏈惎鐢ㄣ€? : "褰撳墠淇濈暀鏃堕檺鍐呮病鏈夊彲璇荤殑鎾ゅ洖璁板綍銆?)}</p>`}));
      if (injectionLabels.length) itemPreviewMarkup.set("ext-injection", previewCard({title:"鍏朵粬娉ㄥ叆", state:"ready", tag:"鏈疆鏉愭枡",
        body:`<ul class="perception-preview-material-list">${injectionLabels.map(label => `<li><strong>${esc(label)}</strong><span>鏈疆涓婁笅鏂囨潗鏂?/span></li>`).join("")}</ul>`}));
    };
    buildItemPreviews();
    /* 椤靛ご淇濈暀鐪熷疄鐨勬暣浣撹鏁帮細閫氶亾鏁颁笌"瀹炲喌鍦ㄧ嚎"閮界敱褰撳墠 percepts 鐜扮畻锛?       涓嶅啓姝绘€绘暟鈥斺€旀ā鍨嬭瑙夈€佸ぉ姘旈璀︺€佺背瀹惰繖绫婚€氶亾鏈潵灏辨椂鏈夋椂鏃犮€?*/
    /* 鍚屾鐘舵€佸繀椤昏鍑烘潵锛氭棩鏈熶笌澶╂皵閮界粦鍦ㄦ湇鍔＄蹇収涓婏紝璇诲け璐ユ椂椤甸潰浼氬仠鍦ㄦ棫鍊硷紝
       涓嶇粰鎻愮ず灏辩瓑浜庢嬁杩囨湡璇绘暟鍐掑厖褰撳墠瀹炲喌銆?*/
    const readStates = [runtimeState, modelState, voiceState, imageState, semanticState, recallState, huaweiHealthState];
    const syncState = readStates.includes("error") || configurationFailed ? {label:"璇诲彇鏈畬鎴?, tone:"warn", icon:"triangle-alert"}
      : readStates.includes("loading") || !ready ? {label:"姝ｅ湪璇诲彇瀹炲喌", tone:"pending", icon:"loader-circle"}
        : ready ? {label:"鐪熷疄鐘舵€佸凡鍚屾", tone:"ready", icon:"check"} : {label:"瑙掕壊涓婁笅鏂囧緟璇诲彇", tone:"pending", icon:"clock"};
    const barMarkup = `<header class="perception-board-bar">
      <div>
        <span class="perception-kicker">瀹炴椂鎰熺煡</span>
        <h1>鎰熺煡浠〃鐩?/h1>
      </div>
      <span class="perception-board-count">
        <span class="perception-board-sync is-${syncState.tone}" role="status" aria-live="polite">${icon(syncState.icon)}${syncState.label}</span>
        <b>${percepts.length} 涓劅鐭ラ€氶亾 路 ${activeCount} 椤瑰疄鍐靛湪绾?/b>
        <button type="button" id="perception-status-refresh" class="button small" data-context-refresh>${icon("refresh-cw")}閲嶆柊璇诲彇鐘舵€?/button>
      </span>
    </header>`;
    root.innerHTML = `${barMarkup}${boardMarkup}`;
    syncSelection();
    if (activePreviewItemId) preview(activePreviewItemId);
    if (balanceSource) renderBalanceSource();

    // 淇濈暀宸ヤ綔鍖哄鐞嗛€昏緫
    const page = root.parentElement;
    const mihomePanel = page?.querySelector("#perception-detail-mihome");
    if (mihomePanel) mihomePanel.hidden = !mihomeEnabled;
    const mihomeWorkspace = page?.querySelector("#mihomeStatusWorkspace");
    if (mihomeWorkspace) mihomeWorkspace.innerHTML = mihomeEnabled
      ? `<p class="perception-mihome-note">${mihomeStatus.snapshot_at ? `璁惧鐩綍鏈€杩戝悓姝?${esc(mihomeStatus.snapshot_at)}銆俙 : "褰撳墠灞曠ず绫冲鎵╁睍缂撳瓨鐨勮澶囩洰褰曠姸鎬併€?} 鐘舵€佹湭鐭ユ椂涓嶄細璋冪敤璁惧鎺ュ彛琛ラ噰銆?/p>${configuredDevices.length
        ? `<ul>${configuredDevices.map(item => `<li class="perception-mihome-device"><span><strong>${esc(item.name || item.aliases?.[0] || "鏈懡鍚嶈澶?)}</strong><small>${esc((item.aliases || []).join("銆?) || "鏈缃埆鍚?)}</small></span><b class="state-${item.online === true ? "online" : item.online === false ? "offline" : "unknown"}">${item.online === true ? "鍦ㄧ嚎" : item.online === false ? "绂荤嚎" : "鏈牳瀹?}</b></li>`).join("")}</ul>`
        : `<p class="memory-notice" role="status">鍙鐘舵€佸凡鍚敤锛屾殏鏃舵病鏈夊凡鏄犲皠璁惧銆?/p>`}` : "";
    const recallWorkspace = page?.querySelector("#perceptionRecallWorkspace");
    if (recallWorkspace) recallWorkspace.innerHTML = recallState === "loading"
      ? `<p class="memory-notice" role="status">姝ｅ湪璇诲彇褰撳墠绐楀彛鐨勬挙鍥炶褰曗€?/p>`
      : recallState === "error" ? `<p class="memory-notice" role="status">杩欎釜瑙掕壊绐楀彛鐨勬挙鍥炶褰曟殏涓嶅彲璇伙紙${esc(recallError || "鍘熷洜鏈煡")}锛夛紱妫€鏌ヨ鑹茬獥鍙ｆ巿鏉冨拰鎾ゅ洖杞綍寮€鍏炽€?/p>`
        : recallStatus?.enabled === false ? `<p class="memory-notice" role="status">鎾ゅ洖杞綍鏈惎鐢ㄣ€傞厤缃紑鍚悗锛屽彧璇昏褰曚細鍦ㄨ瀹氭椂闄愬唴鏄剧ず銆?/p>`
          : recalls.length ? `<ul>${recalls.map(item => `<li class="perception-recall-item"><span><strong>${esc(item.local_time || ageLabel(item.withdrawn_at))}</strong><small>${item.author ? `鍙戦€佽处鍙?${esc(item.author)}` : "褰撳墠浼氳瘽璁板綍"}</small></span><p>${esc(item.text || "锛堟棤鍙睍绀烘枃鏈級")}</p></li>`).join("")}</ul>`
            : `<p class="memory-notice" role="status">褰撳墠淇濈暀鏃堕檺鍐呮病鏈夊彲璇荤殑鎾ゅ洖璁板綍銆?/p>`;
    const injectionWorkspace = page?.querySelector("#perceptionInjectionWorkspace");
    if (injectionWorkspace) injectionWorkspace.innerHTML = injectionLabels.length
      ? `<ul>${injections.map(item => {
        const label = typeof item === "string" ? item : item.label || item.name;
        const detail = typeof item === "string" ? "鏈疆涓婁笅鏂囨潗鏂? : item.detail || item.source || "鏈疆涓婁笅鏂囨潗鏂?;
        return `<li><strong>${esc(label)}</strong><span>${esc(detail)}</span></li>`;
      }).join("")}</ul>` : "";
    if (focusedId) root.querySelector(`#${focusedId}`)?.focus?.({preventScroll:true});
    window.lucide?.createIcons({attrs:{"aria-hidden":"true"}});
    lastDay = ""; updateClock();
  }
  async function refreshMaterialPool(ticket = generation) {
    if (!validRoot(ticket)) return;
    materialPoolState = "loading"; materialPoolError = ""; render();
    try {
      const base = product.role?.()?.perception_native_api;
      if (typeof base !== "string" || !base) throw new Error("material_pool_route_missing");
      const route = product.relative(base).replace(/\/$/, "") + "/materials";
      const value = product.unwrap(await product.request("GET", route, null, {timeoutMs:15000}));
      if (!validRoot(ticket)) return;
      materialPool = value && typeof value === "object" ? value : null;
      materialPoolState = "ready";
      rememberOverview("materialPool", materialPool, "materialPoolState", "ready");
    } catch (error) {
      if (!validRoot(ticket)) return;
      materialPool = null; materialPoolState = "error";
      materialPoolError = error?.message && error.message !== error.code ? String(error.message).slice(0,180) : "璧勮姹犳殏涓嶅彲璇?;
      forgetOverview("materialPool", "materialPoolState");
    }
    render();
  }
  async function refreshHuaweiHealth(ticket = generation) {
    if (!validRoot(ticket)) return;
    huaweiHealthState = "loading"; huaweiHealthError = ""; render();
    try {
      const value = product.unwrap(await product.request("GET", "huawei-health/status", null, {timeoutMs:15000}));
      if (!validRoot(ticket)) return;
      huaweiHealth = value && typeof value === "object" ? value : null;
      huaweiHealthState = "ready";
      rememberOverview("huaweiHealth", huaweiHealth, "huaweiHealthState", "ready");
    } catch (error) {
      if (!validRoot(ticket)) return;
      huaweiHealth = null; huaweiHealthState = "error";
      huaweiHealthError = error?.message && error.message !== error.code ? String(error.message).slice(0, 180) : "杩愬姩鍋ュ悍鐘舵€佹殏涓嶅彲璇?;
      forgetOverview("huaweiHealth", "huaweiHealthState");
    }
    render();
  }
  async function refreshModel(ticket = generation) {
    if (!validRoot(ticket)) return;
    modelState = "loading"; render();
    try {
      const endpoint = product.role()?.model_api;
      if (typeof endpoint !== "string" || !endpoint) throw new Error("missing model route");
      const response = await product.request("GET", product.relative(endpoint));
      const value = product.unwrap(response);
      if (!validRoot(ticket)) return;
      if (!Array.isArray(value.tasks) || !Array.isArray(value.providers)) throw new Error("invalid model route");
      modelStatus = value; modelState = "ready"; rememberOverview("modelStatus", value, "modelState", "ready");
    } catch (_) {
      if (!validRoot(ticket)) return;
      modelStatus = null; modelState = "error";
      forgetOverview("modelStatus", "modelState");
    }
    render();
  }
  async function refreshVoice(ticket = generation) {
    if (!validRoot(ticket)) return;
    voiceState = "loading"; render();
    try {
      const endpoint = product.role()?.model_api;
      if (typeof endpoint !== "string" || !endpoint) throw new Error("missing voice route");
      const value = product.unwrap(await product.request("GET", product.relative(endpoint.replace(/\/$/, "") + "/voice")));
      if (!validRoot(ticket)) return;
      if (!Array.isArray(value.languages) || !Array.isArray(value.providers)) throw new Error("invalid voice status");
      voiceStatus = value; voiceState = "ready"; rememberOverview("voiceStatus", value, "voiceState", "ready");
    } catch (_) {
      if (!validRoot(ticket)) return;
      voiceStatus = null; voiceState = "error";
      forgetOverview("voiceStatus", "voiceState");
    }
    render();
  }
  async function refreshImage(ticket = generation) {
    if (!validRoot(ticket)) return;
    imageState = "loading"; render();
    try {
      const endpoint = product.role()?.model_api;
      if (typeof endpoint !== "string" || !endpoint) throw new Error("missing image route");
      const value = product.unwrap(await product.request("GET", product.relative(endpoint.replace(/\/$/, "") + "/image")));
      if (!validRoot(ticket)) return;
      if (!Array.isArray(value.actions)) throw new Error("invalid image status");
      imageStatus = value; imageState = "ready"; rememberOverview("imageStatus", value, "imageState", "ready");
    } catch (_) {
      if (!validRoot(ticket)) return;
      imageStatus = null; imageState = "error";
      forgetOverview("imageStatus", "imageState");
    }
    render();
  }
  async function refreshSemanticStatus(ticket = generation) {
    if (!validRoot(ticket)) return;
    semanticState = "loading"; render();
    try {
      const bridge = product.bridgeNow?.() || await product.bridgeFor();
      const value = product.unwrap(await bridge.apiGet("semantic", {...product.selection(), kind:"reaction"}));
      if (!validRoot(ticket)) return;
      if (!value || typeof value !== "object") throw new Error("invalid semantic status");
      semanticStatus = value; semanticState = "ready"; rememberOverview("semanticStatus", value, "semanticState", "ready");
    } catch (_) {
      if (!validRoot(ticket)) return;
      semanticStatus = null; semanticState = "error";
      forgetOverview("semanticStatus", "semanticState");
    }
    render();
  }
  async function refreshRecalls(ticket = generation) {
    if (!validRoot(ticket)) return;
    recallState = "loading"; render();
    try {
      const replyApi = product.role?.()?.reply_api;
      if (typeof replyApi !== "string" || !replyApi) throw new Error("recall_scope_denied");
      const route = product.relative(replyApi).replace(/\/$/, "") + "/recalls";
      const response = product.request
        ? await product.request("GET", route, {limit:5})
        : await (product.bridgeNow?.() || await product.bridgeFor()).apiGet(route, {limit:5});
      const value = product.unwrap(response);
      if (!validRoot(ticket)) return;
      if (!Array.isArray(value.entries)) throw new Error("invalid recall status");
      recallStatus = value; recallState = "ready"; recallError = "";
      rememberOverview("recallStatus", value, "recallState", "ready");
    } catch (error) {
      if (!validRoot(ticket)) return;
      /* 銆屾挙鍥炲師鏂囪浆鍐欍€嶅叧闂槸姝ｅ父鐘舵€侊紝涓嶆槸璇诲彇澶辫触锛氬悗绔細浠?         recall_transcribe_disabled 鎷掔粷璇诲彇銆傛妸瀹冪敾鎴愭晠闅滀細璁╀汉璺戝幓鏌ユ巿鏉冦€?*/
      const rawMessage = String(error?.message || "").trim();
      const code = /^[a-z][a-z0-9_]{2,80}$/.test(rawMessage) ? rawMessage
        : typeof error?.code === "string" && error.code ? error.code : "recall_request_failed";
      if (code === "recall_transcribe_disabled") {
        recallStatus = {enabled: false, entries: []}; recallState = "ready";
        rememberOverview("recallStatus", recallStatus, "recallState", "ready");
      } else {
        recallStatus = null; recallState = "error";
        recallError = code;
        forgetOverview("recallStatus", "recallState");
      }
    }
    render();
  }
  async function refreshMihome(ticket = generation) {
    if (!validRoot(ticket)) return;
    mihomeState = "loading"; render();
    try {
      const bridge = product.bridgeNow?.() || await product.bridgeFor();
      const value = product.unwrap(await bridge.apiGet("extensions", {}));
      if (!validRoot(ticket)) return;
      const reality = value?.extensions?.reality;
      const settings = reality?.settings;
      const mihome = reality?.management?.mihome;
      if (!settings || !mihome || mihome.available === false || !Array.isArray(mihome.devices)
          || typeof mihome.tool_settings?.enable_readonly_tool !== "boolean")
        throw new Error("invalid native MiHome status");
      if (settings.enabled === false || settings.mihome?.enabled === false
          || !mihome.tool_settings.enable_readonly_tool) {
        mihomeStatus = null; mihomeState = "disabled"; forgetOverview("mihomeStatus", "mihomeState");
        render();
        return;
      }
      mihomeStatus = {
        enabled:true,
        snapshot_at:typeof mihome.snapshot_at === "string" ? mihome.snapshot_at : "",
        devices:mihome.devices.filter(item => item?.configured === true || item?.aliases?.length)
          .map(item => ({
            configured:true,
            name:typeof item.name === "string" ? item.name.slice(0, 160) : "",
            aliases:Array.isArray(item.aliases)
              ? item.aliases.filter(alias => typeof alias === "string").slice(0, 20).map(alias => alias.slice(0, 120)) : [],
            online:item.online === true ? true : item.online === false ? false : null,
          })),
      };
      mihomeState = "ready";
      rememberOverview("mihomeStatus", mihomeStatus, "mihomeState", "ready");
    } catch (_) {
      if (!validRoot(ticket)) return;
      mihomeStatus = null; mihomeState = "unavailable";
      forgetOverview("mihomeStatus", "mihomeState");
    }
    render();
  }
  async function refreshRuntime(ticket = generation) {
    if (!validRoot(ticket)) return;
    runtimeState = "loading"; render();
    try {
      const endpoint = product.role()?.perception_native_api;
      if (typeof endpoint !== "string" || !endpoint) throw new Error("missing perception runtime route");
      const route = endpoint.replace(/\/$/, "") + "/runtime";
      const value = product.unwrap(await product.request("GET", product.relative(route)));
      if (!validRoot(ticket)) return;
      if (!value || typeof value !== "object" || !value.weather || !value.screen || !value.reality || !value.calendar)
        throw new Error("invalid perception runtime snapshot");
      runtimeSnapshot = value; runtimeState = "ready"; rememberOverview("runtimeSnapshot", value, "runtimeState", "ready");
    } catch (_) {
      if (!validRoot(ticket)) return;
      runtimeSnapshot = null; runtimeState = "error";
      forgetOverview("runtimeSnapshot", "runtimeState");
    }
    render();
  }
  async function requestCurrentBalance(ticket) {
    const endpoint = product.role()?.model_api;
    if (typeof endpoint !== "string" || !endpoint) throw new Error("褰撳墠瑙掕壊娌℃湁鍙敤鐨勬ā鍨嬩綑棰濇帴鍙ｃ€?);
    const route = product.relative(endpoint.replace(/\/$/, "") + "/balance");
    const value = product.unwrap(await product.request("GET", route));
    if (!validRoot(ticket)) return null;
    const status = safeBalanceStatus(value);
    if (!status) throw new Error("浣欓鎺ュ彛杩斿洖鐨勬暟鎹棤鏁堛€?);
    return status;
  }
  function unavailableBalanceStatus() {
    const configured = balanceConfig?.source_state === "configured" || balanceConfig?.source_state === "invalid";
    return {configured, available:false, provider:balanceConfig?.provider || "newapi",
      provider_label:"NewAPI", currency_label:"棰濆害", amount:null, observed_at:"",
      state:configured ? "unavailable" : "not_configured"};
  }
  async function refreshCurrentBalance(ticket = generation) {
    if (!validRoot(ticket)) return;
    if (balanceStatusLoading) {balanceStatusRefreshQueued = true; return;}
    balanceStatusLoading = true; balanceStatusError = ""; render();
    try {
      const status = await requestCurrentBalance(ticket);
      if (!validRoot(ticket) || !status) return;
      balanceStatus = status;
      balanceStatusError = balanceStatusMessage(status);
    } catch (error) {
      if (!validRoot(ticket)) return;
      balanceStatus = unavailableBalanceStatus();
      balanceStatusError = error.message || "浣欓璇诲彇澶辫触锛岃妫€鏌ユ暟鎹簮閰嶇疆銆?;
    } finally {
      if (validRoot(ticket)) {
        balanceStatusLoading = false;
        rememberBalanceCache();
        render();
        if (balanceStatusRefreshQueued) {
          balanceStatusRefreshQueued = false;
          void refreshCurrentBalance(ticket);
        }
      }
    }
  }
  async function readBalanceConfig(ticket = generation) {
    if (!validRoot(ticket) || balanceConfigLoading || balanceSaving || balanceTesting) return;
    balanceConfigLoading = true; balanceError = ""; balanceMessage = ""; render();
    try {
      const bridge = product.bridgeNow?.() || (product.bridgeFor ? await product.bridgeFor() : window.AstrBotPluginPage);
      if (!bridge?.apiGet) throw new Error("椤甸潰杩炴帴灏氭湭灏辩华锛岃绋嶅悗閲嶈瘯銆?);
      const value = product.unwrap(await bridge.apiGet("host-options/balance"));
      if (!validRoot(ticket)) return;
      if (!value?.service_balance || !value?.edit_tokens?.balance) throw new Error("浣欓鏁版嵁婧愰厤缃殏涓嶅彲璇汇€?);
      balanceConfig = value.service_balance;
      balanceConfig.edit_token = value.edit_tokens.balance;
      if ((balanceResultConfigToken && balanceResultConfigToken !== balanceConfig.edit_token)
          || (balanceResultConfigKey && balanceResultConfigKey !== balanceConfigKey(balanceConfig))) clearBalanceResult();
      if (!balanceDraft) balanceDraft = emptyBalanceDraft(balanceConfig);
      rememberBalanceCache();
    } catch (error) {
      if (!validRoot(ticket)) return;
      balanceConfig = null; balanceDraft = null;
      clearBalanceResult();
      balanceError = error.message || "浣欓鏁版嵁婧愰厤缃殏涓嶅彲璇汇€?;
    } finally {
      if (validRoot(ticket)) {balanceConfigLoading = false; render();}
    }
  }
  async function saveBalanceConfig(event) {
    const form = event.target?.closest?.("[data-balance-form]");
    if (!form) return;
    event.preventDefault();
    if (!balanceConfig?.edit_token || balanceSaving || balanceTesting) return;
    const pendingFocus = balanceFocus(form);
    const draft = rememberBalanceDraft(form);
    const {url, api_key:apiKey, user_id:userId, value_divisor:divisor, clear_configuration:clear} = draft;
    if (!clear && (!url || !/^https:\/\//i.test(url))) {
      balanceError = "璇峰～鍐欐湁鏁堢殑 HTTPS NewAPI 鍦板潃銆?; render(); return;
    }
    if (!clear && !apiKey && !balanceConfig.has_api_key) {
      balanceError = "棣栨閰嶇疆闇€瑕佸～鍐?NewAPI 绠＄悊浠ょ墝銆?; render(); return;
    }
    if (!clear && userId && !/^[1-9][0-9]{0,18}$/.test(userId)) {
      balanceError = "NewAPI 鐢ㄦ埛 ID 蹇呴』涓烘鏁存暟銆?; render(); return;
    }
    if (!clear && (!divisor || !Number.isFinite(Number(divisor)) || Number(divisor) <= 0)) {
      balanceError = "棰濆害鍗曚綅闄ゆ暟蹇呴』鏄ぇ浜?0 鐨勬暟瀛椼€?; render(); return;
    }
    balanceSaving = true; balanceError = ""; balanceMessage = "";
    balanceTestError = ""; clearBalanceResult();
    const ticket = generation;
    render();
    try {
      const bridge = product.bridgeNow?.() || (product.bridgeFor ? await product.bridgeFor() : window.AstrBotPluginPage);
      if (!bridge?.apiPost) throw new Error("椤甸潰杩炴帴灏氭湭灏辩华锛岃绋嶅悗閲嶈瘯銆?);
      const changes = clear ? {clear_configuration:true} : {url, api_key:apiKey, user_id:userId, value_divisor:divisor};
      const value = product.unwrap(await bridge.apiPost("host-options/balance", {
        edit_token:balanceConfig.edit_token, changes,
      }));
      if (!validRoot(ticket)) return;
      balanceConfig = value.service_balance;
      balanceConfig.edit_token = value.edit_tokens.balance;
      balanceMessage = clear ? "宸茬Щ闄ゆ湰椤垫暟鎹簮锛涚幆澧冨彉閲忔暟鎹簮浠嶅彲缁х画浣跨敤銆? : "宸蹭繚瀛樺苟绔嬪嵆鐢熸晥銆?;
      balanceDraft = emptyBalanceDraft(balanceConfig);
      clearBalanceResult(); balanceTestError = "";
      void refreshCurrentBalance(ticket);
    } catch (error) {
      if (!validRoot(ticket)) return;
      balanceError = error.message || "浣欓鏁版嵁婧愪繚瀛樺け璐ャ€?;
    } finally {
      if (validRoot(ticket)) {
        balanceSaving = false;
        const focusLost = window.document?.activeElement === window.document?.body;
        render();
        if (focusLost && pendingFocus) restoreBalanceFocus(pendingFocus);
      }
    }
  }
  const balanceTestErrors = {
    balance_test_timeout:"NewAPI 鏌ヨ瓒呮椂锛岃鏍稿鍦板潃鍜屾湇鍔＄姸鎬併€?,
    balance_test_failed:"杩炴帴澶辫触锛岃妫€鏌ヤ护鐗屾潈闄愩€佺敤鎴?ID 鍜屽湴鍧€銆?,
    host_options_conflict:"璁剧疆宸插湪鍒鏇存柊锛岃閲嶆柊璇诲彇鍚庨噸璇曘€?,
    dashboard_identity_required:"璇风櫥褰?AstrBot Dashboard 鍚庡啀娴嬭瘯鏁版嵁婧愩€?,
  };
  async function testBalanceConfig(form) {
    if (!balanceConfig?.edit_token || balanceSaving || balanceTesting
        || (balanceStatusLoading && balanceDraftIsCurrent())) return;
    const pendingFocus = balanceFocus(form);
    const draft = rememberBalanceDraft(form);
    let changes, usesCurrent = false;
    if (draft.clear_configuration) {
      balanceTestError = "鍏堝彇娑堢Щ闄ゆ暟鎹簮锛屽啀娴嬭瘯褰撳墠杩炴帴銆?; render(); return;
    }
    if (balanceDraftIsCurrent()) {
      usesCurrent = true;
    } else {
      if (!draft.url || !/^https:\/\//i.test(draft.url)) {
        balanceTestError = "璇峰～鍐欐湁鏁堢殑 HTTPS NewAPI 鍦板潃銆?; render(); return;
      }
      if (!draft.api_key && !balanceConfig.has_api_key) {
        balanceTestError = "璇峰～鍐欏甫 profile:read 鏉冮檺鐨?NewAPI 绠＄悊浠ょ墝鍚庡啀娴嬭瘯銆?; render(); return;
      }
      if (draft.user_id && !/^[1-9][0-9]{0,18}$/.test(draft.user_id)) {
        balanceTestError = "NewAPI 鐢ㄦ埛 ID 蹇呴』涓烘鏁存暟銆?; render(); return;
      }
      if (!draft.value_divisor || !Number.isFinite(Number(draft.value_divisor)) || Number(draft.value_divisor) <= 0) {
        balanceTestError = "棰濆害鍗曚綅闄ゆ暟蹇呴』鏄ぇ浜?0 鐨勬暟瀛椼€?; render(); return;
      }
      changes = {url:draft.url, api_key:draft.api_key, user_id:draft.user_id,
        value_divisor:draft.value_divisor};
    }
    balanceTesting = true; balanceTestError = ""; clearBalanceResult();
    const ticket = generation;
    render();
    try {
      if (usesCurrent) {
        const status = await requestCurrentBalance(ticket);
        if (!validRoot(ticket) || !status) return;
        balanceStatus = status;
        balanceStatusError = balanceStatusMessage(status);
        balanceTestError = balanceStatusError;
        if (status.available) {
          balanceTestError = "";
          balanceMessage = "浣欓宸查噸鏂拌鍙栥€?;
        }
      } else {
        const bridge = product.bridgeNow?.() || (product.bridgeFor ? await product.bridgeFor() : window.AstrBotPluginPage);
        if (!bridge?.apiPost) throw new Error("椤甸潰杩炴帴灏氭湭灏辩华锛岃绋嶅悗閲嶈瘯銆?);
        const value = product.unwrap(await bridge.apiPost("host-options/balance/test", {
          edit_token:balanceConfig.edit_token, changes,
        }));
        if (!validRoot(ticket)) return;
        if (value?.tested !== true || value?.available !== true || !["number", "string"].includes(typeof value.amount)
            || String(value.amount).trim() === "" || !Number.isFinite(Number(value.amount)) || Number(value.amount) < 0)
          throw new Error("NewAPI 鏈繑鍥炲彲鐢ㄤ綑棰濓紝璇锋鏌ラ厤缃悗閲嶈瘯銆?);
        balanceTestResult = {...value, amount:formatBalanceAmount(value.amount)};
        balanceResultScope = scope;
        balanceResultConfigToken = "";
        balanceResultConfigKey = "";
        balanceResultIsDraft = true;
      }
      rememberBalanceCache();
    } catch (error) {
      if (!validRoot(ticket)) return;
      if (usesCurrent) {
        balanceStatus = unavailableBalanceStatus();
        balanceStatusError = error.message || "浣欓璇诲彇澶辫触锛岃妫€鏌ユ暟鎹簮閰嶇疆銆?;
      }
      const code = error.code || "";
      balanceTestError = balanceTestErrors[code]
        || (error.message && error.message !== code ? error.message : "杩炴帴澶辫触锛岃妫€鏌ユ暟鎹簮閰嶇疆鍚庨噸璇曘€?);
    } finally {
      if (validRoot(ticket)) {
        balanceTesting = false;
        const focusLost = window.document?.activeElement === window.document?.body;
        render();
        if (focusLost && pendingFocus) restoreBalanceFocus(pendingFocus);
      }
    }
  }
  function input(event) {
    const field = event.target?.closest?.("[data-balance-field]");
    if (!field) return;
    const name = field.dataset?.balanceField || field.name;
    if (!["url", "user_id", "value_divisor", "api_key", "clear_configuration"].includes(name)) return;
    if (!balanceDraft) balanceDraft = emptyBalanceDraft(balanceConfig);
    balanceDraft[name] = name === "clear_configuration" ? field.checked === true : field.value;
    const hadDraftObservation = !!balanceTestResult && balanceResultIsDraft;
    balanceError = ""; balanceTestError = "";
    if (hadDraftObservation) clearBalanceResult();
    else rememberBalanceCache();
    const form = field.closest?.("[data-balance-form]");
    const result = form?.querySelector("[data-balance-test-result]");
    if (result && hadDraftObservation) result.hidden = true;
    const test = form?.querySelector("[data-balance-test]");
    if (test) test.disabled = balanceSaving || balanceTesting || (balanceStatusLoading && balanceDraftIsCurrent()) || balanceDraft.clear_configuration
      || !(balanceDraftIsCurrent() || (balanceDraft.url && (balanceDraft.api_key || balanceConfig?.has_api_key)));
    if (hadDraftObservation) render({balanceSource:false});
  }
  function click(event) {
    const testButton = event.target.closest("[data-balance-test]");
    if (testButton) {
      event.preventDefault();
      const form = testButton.closest("[data-balance-form]");
      if (form) void testBalanceConfig(form);
      return;
    }

    const gotoButton = event.target.closest("[data-board-goto]");
    if (gotoButton) {
      /* 閰嶇疆鏈綋鐢遍〉闈笅鏂圭殑鍒嗗尯闈㈡澘缁存姢銆傚姛鑳芥澘鏉＄洰鍙妸瀵瑰簲鐨?         鍗曢」闈㈡澘閫佸埌涓嬫柟锛屼笉灞曞紑鏁翠釜鍒嗙被銆?*/
      window.CompanionPerceptionTabs?.activate?.(gotoButton.dataset.boardGoto, {
        focus:true, scroll:true, modelTab:gotoButton.dataset.boardModelTab || "",
        single:gotoButton.dataset.boardSingle === "true",
        itemId:gotoButton.dataset.perceptionItem || "",
        itemTitle:gotoButton.dataset.itemTitle || "",
      });
      return;
    }
    if (event.target.closest("[data-balance-reload]")) {readBalanceConfig(generation); return;}
    if (event.target.closest("[data-balance-refresh]")) {void refreshCurrentBalance(generation); return;}
    if (!event.target.closest("[data-context-refresh]")) return;
    window.CompanionNativePerceptionPage?.refresh?.();
    const ticket = generation;
    refreshModel(ticket); refreshRuntime(ticket); refreshVoice(ticket); refreshImage(ticket);
    refreshSemanticStatus(ticket); refreshRecalls(ticket); refreshMihome(ticket); refreshHuaweiHealth(ticket); refreshMaterialPool(ticket);
    void refreshCurrentBalance(ticket);
    if (!balanceConfig || balanceDraftIsCurrent()) void readBalanceConfig(ticket);
  }
  function change(event) {
    input(event);
    const clear = event.target.closest('[name="clear_configuration"]');
    if (!clear) return;
    const form = clear.closest("[data-balance-form]");
    if (!form) return;
    for (const field of form.querySelectorAll('[name="url"], [name="user_id"], [name="value_divisor"], [name="api_key"]'))
      field.disabled = clear.checked;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = clear.checked ? "绉婚櫎鏁版嵁婧? : "淇濆瓨鏁版嵁婧?;
    const test = form.querySelector("[data-balance-test]");
    if (test) test.disabled = clear.checked || balanceTesting || balanceSaving
      || (balanceStatusLoading && balanceDraftIsCurrent());
  }
  function mount(node) {
    unmount();
    const nextScope = activeScopeKey();
    root = node; scope = nextScope; abort = new AbortController();
    overviewRouteKey = routeKey();
    restoreBalanceCache(nextScope);
    balanceWorkspace = root.parentElement?.querySelector("#perceptionBalanceSourceWorkspace") || null;
    const ticket = ++generation;
    const cached = overviewCache.get(`${scope}:${overviewRouteKey}`) || {};
    snapshot = cached.snapshot || null; runtimeSnapshot = cached.runtimeSnapshot || null;
    runtimeState = cached.runtimeState || "loading";
    modelStatus = cached.modelStatus || null; modelState = cached.modelState || "loading";
    voiceStatus = cached.voiceStatus || null; voiceState = cached.voiceState || "loading";
    imageStatus = cached.imageStatus || null; imageState = cached.imageState || "loading";
    semanticStatus = cached.semanticStatus || null; semanticState = cached.semanticState || "loading";
    recallStatus = cached.recallStatus || null; recallState = cached.recallState || "loading";
    mihomeStatus = cached.mihomeStatus || null; mihomeState = cached.mihomeState || "loading";
    huaweiHealth = cached.huaweiHealth || null; huaweiHealthState = cached.huaweiHealthState || "loading";
    materialPool = cached.materialPool || null; materialPoolState = cached.materialPoolState || "loading";
    root.addEventListener("click", click, {signal:abort.signal});
    if (balanceWorkspace) {
      balanceWorkspace.addEventListener("click", click, {signal:abort.signal});
      balanceWorkspace.addEventListener("submit", saveBalanceConfig, {signal:abort.signal});
      balanceWorkspace.addEventListener("input", input, {signal:abort.signal});
      balanceWorkspace.addEventListener("change", change, {signal:abort.signal});
    }
    unsubscribe = window.CompanionNativePerceptionPage?.subscribe?.(next => {
      if (!validRoot(ticket)) return;
      /* native 椤靛垰鎸傝浇鏃朵細鍏堝彂 loading銆傚凡鏈夋垚鍔熷揩鐓ф椂淇濈暀瀹冿紝閬垮厤鍒囬〉
         鍥炴潵鍑虹幇涓€鏁村潡绌虹櫧锛涙槑纭け璐ヤ粛娓呮帀鏃у揩鐓у苟灞曠ず澶辫触鐘舵€併€?*/
      if (next?.ready === true || !snapshot || (next?.loading === false && next?.error)) snapshot = next;
      if (snapshot?.ready === true) rememberOverview("snapshot", snapshot);
      else if (next?.loading === false && next?.error) forgetOverview("snapshot");
      render();
    }) || null;
    render();
    refreshModel(ticket); refreshRuntime(ticket); refreshVoice(ticket); refreshImage(ticket);
    refreshSemanticStatus(ticket); refreshRecalls(ticket); refreshMihome(ticket); refreshHuaweiHealth(ticket); refreshMaterialPool(ticket); readBalanceConfig(ticket);
    void refreshCurrentBalance(ticket);
    clockTimer = setInterval(updateClock, 1000);
  }
  function unmount() {
    rememberBalanceCache();
    generation++; abort?.abort(); abort = null; unsubscribe?.(); unsubscribe = null;
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null; root = null; scope = ""; overviewRouteKey = ""; snapshot = null; runtimeSnapshot = null; runtimeState = "loading";
    modelStatus = null; modelState = "loading"; voiceStatus = null; voiceState = "loading";
    imageStatus = null; imageState = "loading"; semanticStatus = null; semanticState = "loading";
    recallStatus = null; recallState = "loading"; mihomeStatus = null; mihomeState = "loading";
    lastDay = ""; selectedDestination = ""; selectedModelTab = "";
    balanceWorkspace = null; balanceMarkup = "";
    balanceConfig = null; balanceDraft = null; balanceExpanded = false; balanceConfigLoading = false;
    balanceStatus = null; balanceStatusLoading = false; balanceStatusRefreshQueued = false; balanceStatusError = "";
    balanceSaving = false; balanceTesting = false;
    balanceTestResult = null; balanceResultScope = ""; balanceResultConfigToken = ""; balanceResultConfigKey = ""; balanceResultIsDraft = false;
    balanceMessage = ""; balanceError = ""; balanceTestError = "";
  }
  return {mount, unmount, select, preview, refresh:refreshRuntime, upcomingDates};
})();
