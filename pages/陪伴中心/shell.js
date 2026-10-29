const BUILD_ID = window.COMPANION_BUILD_ID || "20261030-01";
const versioned = path => `${path}?v=${BUILD_ID}`;
const [apiModule, uiModule, placeholderModule] = await Promise.all([
  import(versioned("./api.js")),
  import(versioned("./ui.js")),
  import(versioned("./pages/placeholder.js"))
]);
const {api} = apiModule;
const ui = uiModule;
const {placeholder} = placeholderModule;

const sections = [
  {id: "角色", icon: "user", pages: [["角色档案", "角色档案"], ["人格整理", "人格整理"], ["世界知识", "世界知识"], ["角色成长策略", "角色成长策略"]]},
  {id: "联系人", icon: "users", pages: [["关系网", "关系网"], ["联系人详情", "联系人详情"], ["群详情", "群详情"], ["默认权限与跨窗口", "默认权限与跨窗口"]]},
  {id: "对话", icon: "message-circle", pages: [["说话", "说话"], ["理解", "理解"], ["参与", "参与"], ["忙碌与休息", "忙碌与休息"], ["表达学习", "表达学习"]]},
  {id: "生活", icon: "leaf", pages: [["主动联系", "主动联系"], ["日记与作息", "日记与作息"], ["状态与日程", "状态与日程"], ["记忆", "记忆"], ["学习与成长", "学习与成长"], ["关系理解", "关系理解"]]},
  {id: "能力", icon: "box", pages: [["能力总览", "能力总览"], ["感知", "感知"], ["表情与语义", "表情与语义"], ["生图与素材", "生图与素材"], ["平台扩展", "平台扩展"]]},
  {id: "系统", icon: "settings", pages: [["开始使用", "开始使用"], ["账号与会话", "账号与会话"], ["模型与连接", "模型与连接"], ["资料与外观", "资料与外观"], ["高级与诊断", "高级与诊断"]]}
];
const routeModules = {
  "首页/今天": "./pages/today.js",
  "角色/角色档案": "./pages/role-profile.js", "角色/人格整理": "./pages/persona-curation.js", "角色/世界知识": "./pages/world-knowledge.js", "角色/角色成长策略": "./pages/role-growth-strategy.js",
  "联系人/关系网": "./pages/contacts-network.js", "联系人/联系人详情": "./pages/contact-details.js", "联系人/群详情": "./pages/group-details.js", "联系人/默认权限与跨窗口": "./pages/default-permissions.js",
  "对话/说话": "./pages/conversation-speaking.js", "对话/理解": "./pages/conversation-understanding.js", "对话/参与": "./pages/conversation-participation.js", "对话/忙碌与休息": "./pages/conversation-busy-rest.js", "对话/表达学习": "./pages/conversation-expression-learning.js",
  "生活/主动联系": "./pages/proactive-contact.js", "生活/日记与作息": "./pages/diary-routine.js", "生活/状态与日程": "./pages/state-schedule.js", "生活/记忆": "./pages/memory.js", "生活/学习与成长": "./pages/learning-growth.js", "生活/关系理解": "./pages/relationship-understanding.js",
  "能力/能力总览": "./pages/capability-overview.js", "能力/感知": "./pages/perception.js", "能力/表情与语义": "./pages/reaction-semantics.js", "能力/生图与素材": "./pages/image-materials.js", "能力/平台扩展": "./pages/platform-extensions.js",
  "系统/开始使用": "./pages/getting-started.js", "系统/账号与会话": "./pages/accounts-sessions.js", "系统/模型与连接": "./pages/model-connections.js", "系统/资料与外观": "./pages/profile-appearance.js", "系统/高级与诊断": "./pages/advanced-diagnostics.js"
};
async function pageFor(section, page) {
  const route = `${section}/${page}`, modulePath = routeModules[route];
  if (!modulePath) return placeholder(route, section, page);
  try { return (await import(versioned(modulePath))).default; }
  catch (_) { return placeholder(route, section, page); }
}

const state = {directory: null, capabilities: {}, target: null, role: null, scope: "role", path: ["对话", "参与"], navOpen: false, loading: true};
const $ = selector => document.querySelector(selector);
const hashPath = () => {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const parts = raw.split("/").filter(Boolean);
  return parts.length >= 2 ? parts.slice(0, 2) : ["对话", "参与"];
};
const setHash = (section, page) => { const next = `#/${encodeURIComponent(section)}/${encodeURIComponent(page)}`; if (location.hash !== next) location.hash = next; else render(); };
const sessionsOf = accounts => {
  const sessions = accounts?.sessions || accounts?.data?.sessions || accounts?.native_sessions || accounts?.data?.native_sessions;
  const discovered = accounts?.discovered?.targets || accounts?.data?.discovered?.targets;
  // discovered.targets carries the native names (群名/对方昵称); configured sessions do not.
  return [...(Array.isArray(discovered) ? discovered : []), ...(Array.isArray(sessions) ? sessions : [])];
};
const sessionFor = target => sessionsOf(state.directory?.accounts).find(session => String(session.target_id || "") === String(target?.target_id || ""));
const targetName = target => {
  const session = sessionFor(target);
  const named = [session?.display_name, session?.group_name, target?.display_name, target?.group_name].find(value => String(value ?? "").trim());
  if (named) return String(named).trim();
  const id = target?.scope_kind === "group" ? target?.group_id : target?.participant_id;
  return String(id || "").replace(/@chatroom$/i, "") || "未命名对象";
};
const targetLabel = target => `${target?.scope_kind === "group" ? "群" : "私聊"} · ${targetName(target)}`;
const roleFor = target => target?.roles?.[0] || null;
const targetScopes = target => {
  const scopes = [];
  if (target?.roles?.some(role => role?.reply_api || role?.config_api || role?.state_api || role?.life_api)) scopes.push(["role", "角色默认"]);
  if (target?.scope_kind === "group" && target?.roles?.some(role => role?.reply_api)) scopes.push(["object", "当前群"]);
  if (target?.scope_kind === "private" && target?.roles?.some(role => role?.reply_api)) scopes.push(["object", "当前私聊"]);
  return scopes;
};
const scopeLabel = scope => scope === "role" ? "角色默认" : state.target?.scope_kind === "group" ? "当前群" : "当前私聊";

function navMarkup() {
  return `<div class="brand"><span class="brand-mark">陪</span><span>陪伴中心</span></div><nav class="nav-list"><button class="nav-home${state.path[0] === "首页" ? " is-active" : ""}" data-route="首页/今天"><span class="nav-icon">${ui.icon("home")}</span><span>首页</span></button>${sections.map(section => `<div class="nav-section"><button class="nav-primary${state.path[0] === section.id ? " is-active" : ""}" data-section="${section.id}"><span class="nav-icon">${ui.icon(section.icon)}</span><span>${section.id}</span></button>${state.path[0] === section.id ? `<div class="subnav">${section.pages.map(([, title]) => `<button class="nav-secondary${state.path[1] === title ? " is-active" : ""}" data-route="${section.id}/${title}">${title}</button>`).join("")}</div>` : ""}</div>`).join("")}</nav>`;
}
function topMarkup(page) {
  const scopes = targetScopes(state.target);
  return `<div class="page-heading"><h1>${ui.esc(page.title)}</h1></div><div class="top-controls"><select class="object-select" data-target-select aria-label="当前对象">${["private", "group"].map(scope => { const items = (state.directory?.targets || []).filter(target => target.scope_kind === scope); if (!items.length) return ""; return `<optgroup label="${scope === "group" ? "群聊" : "私聊"}">${items.map(target => `<option value="${ui.esc(target.target_id)}"${target.target_id === state.target?.target_id ? " selected" : ""}>${ui.esc(targetLabel(target))}</option>`).join("")}</optgroup>`; }).join("") || "<option>当前对象</option>"}</select><div class="segmented" data-scope-control role="group">${scopes.map(([key, label]) => `<button type="button" data-scope="${key}" class="${state.scope === key ? "is-active" : ""}">${label}</button>`).join("")}</div></div>`;
}
async function chooseTarget(targetId) {
  const target = state.directory?.targets?.find(item => item.target_id === targetId);
  if (!target) return;
  state.target = target; state.role = roleFor(target); state.scope = "role"; state.capabilities = await api.capabilities(target); render();
}
async function loadDirectory() {
  state.loading = true; render();
  try {
    state.directory = await api.directory();
    const targets = state.directory.targets?.targets || state.directory.targets?.data?.targets || state.directory.targets?.items || state.directory.targets || [];
    state.directory.targets = Array.isArray(targets) ? targets : [];
    state.target = state.directory.targets[0] || null; state.role = roleFor(state.target); state.capabilities = await api.capabilities(state.target); state.loading = false;
  } catch (_) { state.directory = {targets: [], accounts: null}; state.loading = false; }
  render();
}
async function render() {
  if (!document.body) return;
  const [section, pageName] = state.path; const page = await pageFor(section, pageName);
  document.title = `${page.title} · 陪伴中心`;
  document.body.innerHTML = `<div class="console-shell${state.navOpen ? " nav-open" : ""}"><button class="mobile-menu" type="button" data-mobile-menu aria-label="打开导航">☰</button><aside class="console-sidebar">${navMarkup()}</aside><main class="console-main"><header class="console-topbar">${topMarkup(page)}</header><section class="console-content"><div id="page-root"></div></section></main></div>`;
  const root = $("#page-root");
  if (state.loading) { root.innerHTML = `<div class="page-loading">正在读取</div>`; return; }
  const ctx = {api, target: state.target, role: state.role, scope: state.scope, capabilities: state.capabilities, ui, navigate: (route) => { const [s, p] = route.replace(/^#\/?/, "").split("/"); setHash(decodeURIComponent(s), decodeURIComponent(p)); }};
  try { await page.render(root, ctx); } catch (_) { root.innerHTML = `<div class="page-empty">读取失败</div>`; }
}

document.addEventListener("click", event => {
  const route = event.target.closest("[data-route]");
  if (route) { const [section, page] = route.dataset.route.split("/"); setHash(section, page); return; }
  const section = event.target.closest("[data-section]");
  if (section) { const found = sections.find(item => item.id === section.dataset.section); setHash(found.id, found.pages[0][1]); return; }
  if (event.target.closest("[data-mobile-menu]")) { state.navOpen = !state.navOpen; document.querySelector(".console-shell")?.classList.toggle("nav-open", state.navOpen); return; }
  const scope = event.target.closest("[data-scope]");
  if (scope) { state.scope = scope.dataset.scope; render(); }
});
document.addEventListener("change", event => { if (event.target.matches("[data-target-select]")) chooseTarget(event.target.value); });
window.addEventListener("hashchange", () => { state.path = hashPath(); state.navOpen = false; render(); });
state.path = hashPath();
loadDirectory();
