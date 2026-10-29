import {ensureStyles, esc, card, action, status, empty, fieldRows, settingsOf, revisionOf, postAction, confirmAction, buttonBar, summaryGrid, schemaFields} from "./ability-shared.js";

const STATE_LABELS = {assembled: "已装配", paused: "已暂停", discarded: "未装配", desired: "待检查", failed: "启动失败"};
const STATE_TONES = {assembled: "ready", paused: "paused", discarded: "muted", desired: "pending", failed: "failed"};
const extensionName = item => item?.name || item?.title || item?.extension_id || item?.id || "未命名扩展";
const extensionId = item => item?.extension_id || item?.id || item?.name || "";
function stateOf(item) {
  if (item?.desired_state === "paused") return "paused";
  if (item?.desired_state === "discarded" || item?.assembled === false) return "discarded";
  if (item?.runtime?.state === "failed" || item?.state === "failed") return "failed";
  if (item?.assembled === true || item?.desired_state === "assembled") return "assembled";
  return "desired";
}
function normalize(data) {
  const raw = Array.isArray(data?.extensions) ? data.extensions : data?.extensions && typeof data.extensions === "object"
    ? Object.entries(data.extensions).map(([id, item]) => ({extension_id: id, ...item})) : [];
  return raw.map(item => ({...item, extension_id: extensionId(item)}));
}
const actionText = name => ({assemble: "装配", pause: "暂停", resume: "恢复", update: "更新", uninstall: "卸载"}[name] || "调整");
const categoryText = value => ({extension:"拓展",basic:"基础"}[String(value || "").toLowerCase()] || "能力");

const page = {
  id: "ability-overview", section: "能力", title: "能力总览",
  async render(root, ctx) {
    ensureStyles();
    root.innerHTML = `<div class="page-loading">正在读取能力清单</div>`;
    let extensions = [];
    try { extensions = normalize(await ctx.api.get("integration/manifest")); }
    catch (_) { root.innerHTML = `<div class="page-stack">${card("能力清单", empty("能力清单暂不可读"))}</div>`; return; }
    const state = {filter: "all", modal: null, busy: false, notice: ""};
    const manifest = async () => { extensions = normalize(await ctx.api.get("integration/manifest")); };
    const renderModal = () => {
      if (!state.modal) return "";
      const item = state.modal.item, fields = schemaFields(item.schema || item.settings_schema), draft = state.modal.draft;
      const settings = fields.length ? fieldRows(draft, fields) : empty("该扩展没有可编辑设置");
      const actions = ["assemble", "pause", "resume", "update", "uninstall"].filter(name => {
        const current = stateOf(item);
        return name === "assemble" ? current === "discarded" : name === "pause" ? current === "assembled" : name === "resume" ? current === "paused" : name === "uninstall" ? current !== "discarded" : Boolean(item.update_available) && current === "assembled";
      }).map(name => action(actionText(name), `modal-${name}`, {danger: name === "uninstall"})).join("");
      return `<div class="ability-modal-backdrop" data-modal-close><section class="ability-modal" role="dialog" aria-modal="true" aria-label="${esc(extensionName(item))}"><header><h2>${esc(extensionName(item))}</h2><button type="button" class="ability-icon-button" data-modal-close aria-label="关闭">×</button></header><div class="ability-modal-body">${summaryGrid([["状态", STATE_LABELS[stateOf(item)]], ["版本", item.version || item.installed_version || "—"], ["扩展编号", item.extension_id || "—"]])}${fields.length ? `<div class="ability-form">${settings}</div>` : ""}</div><footer>${buttonBar(`${actions}<button type="button" class="ability-button" data-modal-close>关闭</button>${fields.length ? `<button type="button" class="ability-button is-primary" data-extension-save>保存设置</button>` : ""}`)}</footer></section></div>`;
    };
    const draw = () => {
      const filtered = extensions.filter(item => {
        const current = stateOf(item), category = String(item.category || item.kind || "").toLowerCase();
        return state.filter === "all" || (state.filter === "pending" ? current === "desired" : category === state.filter);
      });
      const filters = {all: "全部", basic: "基础", extension: "拓展", pending: "待检查"};
      const list = filtered.length ? filtered.map(item => {
        const current = stateOf(item), label = STATE_LABELS[current], id = item.extension_id;
        const primary = current === "assembled" ? action("暂停", "pause", {disabled: state.busy}) : current === "paused" ? action("恢复", "resume", {primary: true, disabled: state.busy}) : current === "discarded" ? action("装配", "assemble", {primary: true, disabled: state.busy}) : action("检查", "refresh", {disabled: state.busy});
        return `<article class="ability-extension" data-extension-id="${esc(id)}"><div class="ability-extension-copy"><div class="ability-kicker">${esc(categoryText(item.category || item.kind))}</div><h3>${esc(extensionName(item))}</h3><p>${esc(item.description || item.summary || "")}</p>${summaryGrid([["状态", label], ["版本", item.version || item.installed_version || "—"], ["能力", item.capability_id || item.capability || "—"]])}</div><div class="ability-extension-actions">${status(label, STATE_TONES[current])}${primary}${current === "assembled" && item.update_available ? action("更新", "update", {disabled: state.busy}) : ""}${action("详情", "details", {disabled: state.busy})}</div></article>`;
      }).join("") : empty("没有符合当前筛选的能力");
      root.innerHTML = `<div class="page-stack">${state.notice ? `<div class="ability-notice">${esc(state.notice)}</div>` : ""}<div class="ability-filterbar">${Object.entries(filters).map(([key, label]) => `<button type="button" class="ability-filter${state.filter === key ? " is-active" : ""}" data-filter="${key}">${label}</button>`).join("")}<span class="ability-filter-count">${extensions.length} 项</span></div>${card("能力清单", list, {className: "ability-list-card"})}${renderModal()}</div>`;
    };
    draw();
    root.addEventListener("click", async event => {
      const filter = event.target.closest("[data-filter]");
      if (filter) { state.filter = filter.dataset.filter; draw(); return; }
      if (event.target.closest("[data-modal-close]")) { state.modal = null; draw(); return; }
      const rowNode = event.target.closest("[data-extension-id]");
      if (!rowNode) return;
      const item = extensions.find(value => value.extension_id === rowNode.dataset.extensionId);
      if (!item) return;
      const operation = event.target.closest("[data-ability-action]")?.dataset.abilityAction;
      if (operation === "details") { state.modal = {item, draft: settingsOf(item)}; draw(); return; }
      if (operation === "refresh") { try { await manifest(); state.notice = "清单已刷新"; } catch (_) { state.notice = "清单刷新失败"; } draw(); return; }
      if (!operation || !await confirmAction(`确认${actionText(operation)}「${extensionName(item)}」？`)) return;
      state.busy = true; draw();
      try { await postAction(ctx, "integration/lifecycle", {extension_id: item.extension_id, action: operation, expected_revision: revisionOf(item)}, "extension-lifecycle"); await manifest(); state.notice = `已${actionText(operation)}`; }
      catch (_) { state.notice = `${actionText(operation)}失败`; }
      state.busy = false; draw();
    });
    root.addEventListener("input", event => {
      const field = event.target.closest("[data-ui-field]");
      if (field && state.modal) state.modal.draft[field.dataset.uiField] = field.type === "number" ? Number(field.value || 0) : field.value;
    });
    root.addEventListener("click", async event => {
      const toggle = event.target.closest("[data-ui-toggle]");
      if (toggle && state.modal) state.modal.draft[toggle.dataset.uiToggle] = toggle.getAttribute("aria-checked") === "true";
      if (!event.target.closest("[data-extension-save]") || !state.modal) return;
      state.busy = true;
      try { await postAction(ctx, "extensions/configure", {extension_id: state.modal.item.extension_id, updates: state.modal.draft, revision: revisionOf(state.modal.item)}, "extension-configure"); state.modal = null; await manifest(); state.notice = "扩展设置已保存"; }
      catch (_) { state.notice = "扩展设置保存失败"; }
      state.busy = false; draw();
    });
  }
};
export default page;
