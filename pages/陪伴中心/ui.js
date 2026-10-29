export const esc = value => String(value ?? "").replace(/[&<>\"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const ENUM_LABELS = {
  active:"进行中", inactive:"未启用", enabled:"已启用", disabled:"已停用", on:"已开启", off:"已关闭", true:"是", false:"否", null:"暂无",
  pending:"待处理", proposed:"待提出", planned:"待开始", running:"运行中", ready:"可用", complete:"已完成", completed:"已完成", done:"已完成", succeeded:"成功", success:"成功", failed:"失败", error:"失败", recorded:"已记录", unknown:"结果未知",
  approved:"已允许", rejected:"已拒绝", adopted:"已采用", reviewed:"已审阅", dismissed:"已忽略", retired:"已归档", retracted:"已撤回", paused:"已暂停", assembled:"已装配", unassembled:"待装配", discarded:"已移除", withdrawn:"已撤回",
  fact:"事实", experience:"经历", episode:"经历", relationship:"关系记录", emotion_episode:"情绪片段", skill:"能力", goal:"目标", diary:"日记", dream:"梦境", text:"手记", reading:"阅读", json:"结构化数据",
  platform:"平台名称", bot:"陪伴账号", configuration:"运行配置", page:"当前页面", role:"角色默认", window:"当前窗口", object:"当前对象", standard:"普通用户", important:"重要用户", core:"核心用户",
  buffered:"收齐后分段发送", incremental:"边生成边分段发送", probability:"按概率判断", llm:"由模型判断", words:"按词分段", regex:"按规则表达式", sentences:"按句子分段", paragraphs:"按段落分段"
};
const KEY_LABELS = {
  enabled:"启用", automatic_enabled:"自动联系", quiet_enabled:"免打扰时段", provider:"模型服务", fallback:"备用模型", prompt:"附加提示词", max_output_tokens:"输出上限", timeout_seconds:"请求超时",
  conversation_reply:"对话回复", context_image_caption:"图片摘要", image_narration:"图片转述", video_narration:"视频转述", proactive_compose:"主动联系", proactive_judge:"主动联系复核", memory_reflect:"记忆整理", calendar_plan:"日程规划",
  role_state_maintain:"角色状态", role_journal_diary:"日记", role_journal_dream:"梦境", role_expression_learn:"表达学习", role_expression_review:"回复表达复核", content_authoring_draft:"内容起草",
  identity_tier:"身份级别", name_basis:"名字来源", platform_nickname:"平台昵称", admin_nickname:"管理员备注", state:"状态", status:"状态", kind:"类型"
};
export const labelOf = value => {
  const raw = String(value ?? "");
  if (Object.hasOwn(ENUM_LABELS, raw)) return ENUM_LABELS[raw];
  const key = raw.replaceAll(".", "_");
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  return /[A-Za-z_]{3,}/.test(raw) ? "其他设置" : raw || "未标注";
};
export const stateText = value => { const raw = String(value ?? ""); return Object.hasOwn(ENUM_LABELS, raw) ? ENUM_LABELS[raw] : raw || "待核对"; };
export const booleanText = value => value === true || value === "true" ? "已开启" : value === false || value === "false" ? "已关闭" : "待核对";
const metaText = value => { const match = String(value ?? "").match(/\d+\s*(?:条|人|项|位|个|轮|张|边|连接|版本|来源|记录|成员|目的)/); return match ? match[0] : ""; };
const attrs = (value = {}) => Object.entries(value).filter(([, item]) => item !== false && item != null).map(([key, item]) => ` ${key}="${esc(item === true ? key : item)}"`).join("");
const iconPaths = {
  home: '<path d="m3.5 9.5 6.5-5 6.5 5v6.8a.7.7 0 0 1-.7.7H4.2a.7.7 0 0 1-.7-.7z"/><path d="M7.3 17v-4.2h5.4V17"/>',
  user: '<circle cx="10" cy="6.2" r="2.7"/><path d="M4.1 16.8c.4-3 2.2-4.5 5.9-4.5s5.5 1.5 5.9 4.5"/>',
  users: '<circle cx="7" cy="6.3" r="2.3"/><path d="M2.8 16.8c.3-2.7 1.7-4 4.2-4s3.9 1.3 4.2 4"/><path d="M11.5 4.3a2.3 2.3 0 0 1 0 4.3M12.4 12.9c2.8.1 4.3 1.3 4.8 3.9"/>',
  "message-circle": '<path d="M16.7 9.7a6.7 6.7 0 0 1-7 6.4 8 8 0 0 1-3.2-.7L3.3 17l1.1-3a6 6 0 0 1-1.4-3.8A6.7 6.7 0 0 1 10 3.7a6.7 6.7 0 0 1 6.7 6z"/>',
  leaf: '<path d="M16.8 3.7C10.2 3.8 5.1 5.3 4 9.3c-.8 2.8 1.1 4.8 3.8 4.1 4.1-1 6.6-5.2 8-9.7z"/><path d="M3.5 17c2.1-4.3 4.5-6.2 8.2-7.7"/>',
  box: '<path d="m3.5 6.6 6.5-3.1 6.5 3.1v6.8l-6.5 3.1-6.5-3.1z"/><path d="m3.7 6.7 6.3 3 6.3-3M10 9.8v6.5"/>',
  settings: '<circle cx="10" cy="10" r="2.3"/><path d="M10 2.8v1.5m0 11.4v1.5M17.2 10h-1.5M4.3 10H2.8m12.3-5.1-1.1 1.1M6 14l-1.1 1.1m10.2 0L14 14M6 6 4.9 4.9"/>'
};
export const icon = name => `<svg class="ui-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.box}</svg>`;

export const card = (title, content, options = {}) => `<section class="console-card${options.className ? ` ${options.className}` : ""}"${attrs(options.attrs)}><header class="card-title"><span>${esc(title)}</span>${metaText(options.meta) ? `<small>${esc(metaText(options.meta))}</small>` : ""}</header><div class="card-body">${content}</div></section>`;
export const row = (label, control, options = {}) => `<div class="ui-row" data-ui-row="${esc(options.name || "")}"><label class="ui-label"${options.forId ? ` for="${esc(options.forId)}"` : ""}>${esc(label)}</label><div class="ui-control">${control}</div></div>`;
export const toggle = (name, value, options = {}) => `<button type="button" class="ui-switch${value ? " is-on" : ""}" role="switch" aria-checked="${Boolean(value)}" data-ui-toggle="${esc(name)}"${options.disabled ? " disabled" : ""} aria-label="${esc(options.label || name)}"></button>`;
export const textField = (name, value = "", options = {}) => typeof value === "boolean" ? toggle(name, value, options) : `<input class="ui-input" id="${esc(options.id || name)}" data-ui-field="${esc(name)}" type="${options.type || "text"}" value="${esc(value)}"${attrs({placeholder: options.placeholder, maxlength: options.maxlength, disabled: options.disabled, "aria-label": options.label || name})}>`;
export const numberField = (name, value = "", unit = "", options = {}) => `<div class="ui-unit"><input class="ui-input" id="${esc(options.id || name)}" data-ui-field="${esc(name)}" type="number" value="${esc(value)}"${attrs({min: options.min, max: options.max, step: options.step || 1, disabled: options.disabled, "aria-label": options.label || name})}>${unit ? `<span class="ui-unit-label">${esc(unit)}</span>` : ""}</div>`;
export const select = (name, value, choices, options = {}) => `<select class="ui-select" id="${esc(options.id || name)}" data-ui-field="${esc(name)}"${attrs({disabled: options.disabled, "aria-label": options.label || name})}>${Object.entries(choices || {}).map(([key, label]) => { const visible = String(label) === String(key) ? stateText(key) : label; return `<option value="${esc(key)}"${String(key) === String(value) ? " selected" : ""}>${esc(visible)}</option>`; }).join("")}</select>`;
export function normalizeListValue(value) {
  return decodeListValue(value).values;
}
export function listValueMeta(value) {
  return decodeListValue(value);
}
function decodeListValue(value) {
  if (Array.isArray(value)) return {values: value.slice(), kind: "array"};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed !== value) return {values: decodeListValue(parsed).values, kind: "json", nested: decodeListValue(parsed)};
    } catch (_) {}
    const delimiter = value.includes("\n") ? "\n" : value.includes(",") || value.includes("，") ? (value.includes("，") ? "，" : ",") : "";
    return {values: value ? (delimiter ? value.split(delimiter).map(item => item.trim()).filter(Boolean) : [value]) : [], kind: delimiter ? "delimited" : "string", delimiter};
  }
  if (value && typeof value === "object") {
    for (const key of ["items", "values", "list", "data", "value"]) {
      if (!Object.hasOwn(value, key)) continue;
      const nested = decodeListValue(value[key]);
      return {values: nested.values, kind: "object", raw: value, key, nested};
    }
  }
  return {values: [], kind: "array"};
}
export function restoreListValue(meta, values) {
  const next = Array.isArray(values) ? values.slice() : [];
  if (!meta || meta.kind === "array") return next;
  if (meta.kind === "json") return JSON.stringify(restoreListValue(meta.nested, next));
  if (meta.kind === "object") return {...meta.raw, [meta.key]: restoreListValue(meta.nested, next)};
  if (meta.kind === "delimited") return next.join(meta.delimiter || ",");
  if (meta.kind === "string") return next.join(",");
  return next;
}
export const tagInput = (name, values = [], options = {}) => `<div class="ui-tags" data-ui-tags="${esc(name)}">${[...new Set(normalizeListValue(values).map(String).filter(Boolean))].map(value => `<span class="ui-tag" data-ui-tag="${esc(value)}"><span>${esc(value)}</span><button type="button" data-ui-tag-remove="${esc(value)}" aria-label="删除 ${esc(value)}">×</button></span>`).join("")}<input type="text" placeholder="${esc(options.placeholder || "")}" aria-label="${esc(options.label || name)}"${options.disabled ? " disabled" : ""}></div>`;
export const segmented = (name, value, choices, options = {}) => `<div class="segmented" data-ui-segmented="${esc(name)}" role="group">${Object.entries(choices || {}).map(([key, label]) => `<button type="button" class="${String(key) === String(value) ? "is-active" : ""}" data-ui-segment="${esc(key)}"${options.disabled ? " disabled" : ""}>${esc(label)}</button>`).join("")}</div>`;
export const saveBar = (name = "save", options = {}) => `<div class="ui-savebar"><span class="ui-save-state" data-ui-save-state="${esc(name)}" aria-live="polite"></span><button type="button" data-ui-save="${esc(name)}"${options.disabled ? " disabled" : ""}>${esc(options.label || "保存")}</button></div>`;
export const link = (label, route, options = {}) => `<a class="ui-link" href="#${esc(route)}" data-ui-link="${esc(route)}">${esc(label)}</a>`;

export function readTags(root, name) {
  return [...root.querySelectorAll(`[data-ui-tags="${CSS.escape(name)}"] .ui-tag`)].map(item => item.dataset.uiTag).filter(Boolean);
}
export function setSaveState(root, name, text, tone = "") {
  const node = root.querySelector(`[data-ui-save-state="${CSS.escape(name)}"]`);
  if (node) { node.textContent = text; node.className = `ui-save-state${tone ? ` is-${tone}` : ""}`; }
}

export const when = (condition, content) => condition ? (typeof content === "function" ? content() : content) : "";
export const foldCard = (title, content, options = {}) => `<details class="console-card ui-fold-card" data-more${options.open ? " open" : ""}><summary class="card-title"><span>${esc(title)}</span>${metaText(options.meta) ? `<small>${esc(metaText(options.meta))}</small>` : ""}<span class="more-chevron" aria-hidden="true">⌄</span></summary><div class="card-body">${content}</div></details>`;
export const more = (content, title = "更多", options = {}) => `<details class="ui-more" data-more${options.open ? " open" : ""}><summary><span class="more-title">${esc(title)}</span><span class="more-chevron" aria-hidden="true">⌄</span></summary><div class="ui-more-body">${content}</div></details>`;
export const statusBadge = (label, tone = "") => `<span class="ui-status-badge${tone ? ` is-${esc(tone)}` : ""}">${esc(label)}</span>`;
export const actionButton = (label, action, options = {}) => `<button type="button" class="ui-action-button${options.danger ? " is-danger" : ""}${options.secondary ? " is-secondary" : ""}${options.small ? " is-small" : ""}" ${options.dataKey || "data-ui-action"}="${esc(action)}"${options.disabled ? " disabled" : ""}${options.extra ? ` ${options.extra}` : ""}>${esc(label)}</button>`;
export const listDetail = (list, detail, options = {}) => `<div class="ui-list-detail${options.className ? ` ${esc(options.className)}` : ""}"><aside class="ui-list-detail-list">${list}</aside><section class="ui-list-detail-detail">${detail}</section></div>`;
export function confirm(root, title, message, options = {}) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog"); dialog.className = "ui-dialog";
    dialog.innerHTML = `<form method="dialog"><header><h2>${esc(title)}</h2><button value="cancel" aria-label="关闭">×</button></header><div class="ui-dialog-body"><p>${esc(message)}</p></div><footer><button value="cancel" class="ui-action-button is-secondary">${esc(options.cancelLabel || "取消")}</button><button value="confirm" class="ui-action-button${options.danger ? " is-danger" : ""}">${esc(options.confirmLabel || "确认")}</button></footer></form>`;
    (root || document.body).appendChild(dialog);
    const finish = () => { const accepted = dialog.returnValue === "confirm"; dialog.remove(); resolve(accepted); };
    dialog.addEventListener("close", finish, {once: true});
    try { dialog.showModal(); } catch (_) { dialog.remove(); resolve(false); }
  });
}
