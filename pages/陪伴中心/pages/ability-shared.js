import {esc, card, row, toggle, textField, numberField, select, segmented, saveBar, setSaveState, readTags, more as sharedMore, foldCard, actionButton, statusBadge, confirm as uiConfirm, labelOf, booleanText, stateText} from "../ui.js";

export {esc, card, row, toggle, textField, numberField, select, segmented, saveBar, setSaveState, readTags, foldCard, actionButton, statusBadge};

export function ensureStyles() {
  const href = new URL("./ability.css", import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

// 扩展装配态只有一个口径：manifest 的 assembled/desired_state 加运行期失败。
// 各页面（首页、能力总览、感知、平台扩展）都从这里取，避免各写一份判断。
export const EXTENSION_STATE_LABELS = {assembled: "已装配", paused: "已暂停", discarded: "未装配", desired: "待检查", failed: "启动失败"};
export const EXTENSION_STATE_TONES = {assembled: "ready", paused: "paused", discarded: "muted", desired: "pending", failed: "failed"};
export function extensionStateOf(item) {
  if (item?.desired_state === "paused") return "paused";
  if (item?.desired_state === "discarded" || item?.assembled === false) return "discarded";
  if (item?.runtime?.state === "failed" || item?.state === "failed") return "failed";
  if (item?.assembled === true || item?.desired_state === "assembled") return "assembled";
  return "desired";
}
export function extensionItems(data) {
  const raw = Array.isArray(data?.extensions) ? data.extensions
    : data?.extensions && typeof data.extensions === "object" ? Object.entries(data.extensions).map(([id, item]) => ({extension_id: id, ...item}))
      : [];
  return raw.map(item => ({...item, extension_id: item.extension_id || item.id || item.name || ""}));
}
export const settingsOf = data => data?.settings && typeof data.settings === "object"
  ? {...data.settings}
  : data && typeof data === "object" ? {...data} : {};
export const tokenOf = data => data?.edit_token || data?.settings_token || data?.configuration_token || data?.revision || "";
export const revisionOf = data => data?.revision ?? data?.settings_revision ?? data?.edit_token ?? "";
export const listOf = (data, key) => Array.isArray(data?.[key]) ? data[key] : Array.isArray(data?.data?.[key]) ? data.data[key] : [];
export const routeOf = (role, key, fallback = "") => role?.[key] || fallback;
export const pathJoin = (base, suffix = "") => base ? `${String(base).replace(/\/$/, "")}/${String(suffix).replace(/^\//, "")}` : "";
export const action = (label, name, options = {}) => `<button type="button" class="ability-button${options.primary ? " is-primary" : ""}${options.danger ? " is-danger" : ""}${options.small ? " ability-button-small" : ""}" data-ability-action="${esc(name)}"${options.disabled ? " disabled" : ""}>${esc(label)}</button>`;
export const status = (label, tone = "muted") => statusBadge(label, tone);
export const empty = text => `<div class="ability-empty">${esc(text)}</div>`;
export const buttonBar = content => `<div class="ability-actions">${content}</div>`;
export const summaryGrid = items => `<div class="ability-summary-grid">${items.map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("")}</div>`;
export const more = (content, title = "更多", open = false) => sharedMore(content, title, {open});
export const advancedCard = (title, content, options = {}) => `<details class="console-card ability-advanced-card"${options.open ? " open" : ""}><summary class="card-title"><span>${esc(title)}</span><span class="ability-summary-chevron" aria-hidden="true">⌄</span></summary><div class="card-body">${content}</div></details>`;

export function fieldRows(draft, fields, disabled = false) {
  return fields.map(([key, label, kind = "text", extra = "", options = {}]) => {
    const value = draft?.[key] ?? options.default ?? (kind === "number" ? 0 : kind === "bool" ? false : "");
    const resolvedKind = kind === "text" && typeof value === "boolean" ? "bool" : kind;
    let control;
    if (resolvedKind === "bool") control = toggle(key, Boolean(value), {disabled, label});
    else if (resolvedKind === "number") control = numberField(key, value, extra, {disabled, label, min: options.min, max: options.max, step: options.step || 1});
    else if (resolvedKind === "select") control = select(key, value, extra || {}, {disabled, label});
    else if (resolvedKind === "textarea") control = `<textarea class="ui-textarea" data-ui-field="${esc(key)}" aria-label="${esc(label)}"${disabled ? " disabled" : ""}>${esc(value)}</textarea>`;
    else control = textField(key, value, {disabled, label: labelOf(label), placeholder: options.placeholder});
    return row(label, control, {name: key});
  }).join("");
}

export function changedFields(root, fields, draft) {
  const names = fields.map(field => Array.isArray(field) ? field[0] : field);
  const changes = {};
  for (const name of names) {
    const field = root.querySelector(`[data-ui-field="${CSS.escape(name)}"]`);
    const sw = root.querySelector(`[data-ui-toggle="${CSS.escape(name)}"]`);
    if (field) changes[name] = field.type === "number" ? Number(field.value || 0) : field.value;
    else if (sw) changes[name] = sw.getAttribute("aria-checked") === "true";
    else if (draft && Object.hasOwn(draft, name)) changes[name] = draft[name];
  }
  return changes;
}

export function bindDraft(root, draft, onChange = () => {}) {
  root.addEventListener("click", event => {
    const node = event.target.closest("[data-ui-toggle]");
    if (!node || node.disabled) return;
    const key = node.dataset.uiToggle;
    const value = node.getAttribute("aria-checked") !== "true";
    draft[key] = value;
    node.setAttribute("aria-checked", String(value));
    node.classList.toggle("is-on", value);
    onChange(key, value);
  });
  const read = field => field.type === "number" ? Number(field.value || 0) : field.value;
  root.addEventListener("input", event => {
    const field = event.target.closest("[data-ui-field]");
    if (!field) return;
    draft[field.dataset.uiField] = read(field);
    onChange(field.dataset.uiField, draft[field.dataset.uiField]);
  });
  root.addEventListener("change", event => {
    const field = event.target.closest("[data-ui-field]");
    if (!field) return;
    draft[field.dataset.uiField] = read(field);
    onChange(field.dataset.uiField, draft[field.dataset.uiField]);
  });
}

export async function postChanges(ctx, path, changes, token, section = "") {
  const body = {operation_key: ctx.api.operationKey("ability"), edit_token: token || "", changes};
  if (section) body.section = section;
  return ctx.api.post(path, body);
}
export async function postAction(ctx, path, body = {}, prefix = "ability-action") {
  return ctx.api.post(path, {...body, operation_key: body.operation_key || ctx.api.operationKey(prefix)});
}
export function confirmAction(message) { return uiConfirm(document.body, "请确认操作", message, {danger:true}); }
export function asSettings(data, section) {
  return section ? (data?.sections?.[section] || data?.[section] || {}) : settingsOf(data);
}
export function schemaFields(schema) {
  const properties = schema?.properties || schema?.fields || {};
  return Object.entries(properties).filter(([, descriptor]) => descriptor && typeof descriptor === "object").map(([key, descriptor]) => [
    key,
    descriptor.title || descriptor.label || key,
    descriptor.type === "boolean" ? "bool" : ["number", "integer"].includes(descriptor.type) ? "number" : descriptor.enum ? "select" : descriptor.multiline ? "textarea" : "text",
    descriptor.enum ? Object.fromEntries(descriptor.enum.map(value => [value, value])) : descriptor.unit || ""
  ]);
}
