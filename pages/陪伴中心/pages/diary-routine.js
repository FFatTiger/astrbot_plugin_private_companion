import {card, saveBar, setSaveState, link} from "../ui.js";
import {ensureStyles, standardFields, safeGet, safePost, readConfig, saveConfig, op, formRows, detailsCard, pageStack, notice, actions, lifeButton, confirm, editDialog, itemTitle, dateText, stateLabel, scopeNote, targetIsPrivate, configPath, bindForm, applyDependencies, readonlyRows, bindNavigation, esc, valueOf} from "./life-shared.js";

const textFields = [{name:"title",label:"标题",type:"text"},{name:"text",label:"正文",type:"textarea"}];
const editFields = [{name:"body",label:"正文",type:"textarea"},{name:"afterglow",label:"梦后余韵",type:"textarea"}];
function lifeValue(data, name, fallback) { return data?.[name] ?? data?.config?.[name] ?? fallback; }
function listItems(data, name) { return Array.isArray(data?.[name]) ? data[name] : []; }
function recordList(title, items, selectedId, kind) {
  return card(title, `<div class="life-record-list">${items.length ? items.map((item, index) => `<button type="button" class="life-record${String(item.activity_id || item.id || item.local_date || index) === String(selectedId) ? " is-selected" : ""}" data-record-kind="${kind}" data-record-id="${esc(item.activity_id || item.id || item.local_date || index)}"><strong>${esc(itemTitle(item, kind === "journal" ? "日记" : kind === "text" ? "手记" : "阅读片段"))}</strong><small>${esc(item.local_date || stateLabel(item.state) || "记录")}</small></button>`).join("") : `<p class="life-muted">暂无${esc(title)}。</p>`}</div>`);
}
function detailCard(data, selected, ctx, root) {
  if (!selected) return card("详情", `<div class="life-empty">选择左侧记录查看详情。</div>`);
  const kind = selected.kind || "diary", id = selected.activity_id || selected.id || selected.local_date;
  const body = selected.body || selected.text || selected.reflection || selected.summary || "来源暂不可用";
  const danger = kind === "text" ? "delete-text" : kind === "reading" ? "withdraw-reading" : "delete-journal";
  const buttons = [];
  if (kind === "journal" || kind === "dream") buttons.push(lifeButton("更正正文", `edit:${id}`), lifeButton("提取索引", `derive:${id}`, {secondary:true}), lifeButton("删除", `${danger}:${id}`, {danger:true}));
  if (kind === "text") buttons.push(lifeButton("更正", `edit-text:${id}`), lifeButton("恢复", `restore:${id}`, {secondary:true}), lifeButton("删除", `delete-text:${id}`, {danger:true}));
  if (kind === "reading") buttons.push(lifeButton(stateLabel(selected.state) === "已暂停" ? "重新阅读" : "开始阅读", `read:${id}`), lifeButton("取消", `cancel:${id}`, {danger:true}), lifeButton("撤回原文", `withdraw-reading:${id}`, {danger:true}));
  if (kind === "sleep" && selected.state === "active") buttons.push(lifeButton("现在醒来", `wake:${id}`, {danger:true}));
  if (kind === "sleep" && selected.state === "completed") buttons.push(lifeButton("记录梦境", `dream:${id}`));
  return card("详情", `<div class="life-detail"><span class="life-eyebrow">${esc(selected.local_date || selected.title || "生活记录")}</span><h2>${esc(itemTitle(selected, kind === "dream" ? "梦境" : "日记"))}</h2><p class="life-prose">${esc(body)}</p>${selected.afterglow ? `<p class="life-afterglow">${esc(selected.afterglow)}</p>` : ""}${actions(buttons)}</div>`);
}
async function command(ctx, path, data) { return safePost(ctx, `${path}/command`, {...data, ...op(`life-${data.action}`)}); }
function configCards(config, editable) {
  const lifeConfig = config?.sections?.life?.settings || config?.life?.settings || config?.sections?.life || config?.life || config;
  const libraryConfig = config?.sections?.library?.settings || config?.library?.settings || config?.sections?.library || config?.library || {};
  if (!editable) return `${card("生活例程", readonlyRows(standardFields.life, lifeConfig), {meta:"只读"})}${card("阅读资料与偏好", readonlyRows(standardFields.library, libraryConfig), {meta:"只读"})}`;
  const values = {...Object.fromEntries(Object.entries(lifeConfig).map(([name, value]) => [`life.${name}`, value])), ...Object.fromEntries(Object.entries(libraryConfig).map(([name, value]) => [`library.${name}`, value]))};
  return `${detailsCard("生活例程", standardFields.life, values, {meta:"角色设置"})}${detailsCard("阅读资料与偏好", standardFields.library, values, {meta:"角色设置", advanced:true})}`;
}
const page = {
  id:"life-routine", section:"生活", title:"日记与作息",
  async render(root, ctx) {
    ensureStyles();
    if (!targetIsPrivate(ctx) || !ctx.role?.life_api) { root.innerHTML = pageStack(`${card("日记与作息", `<div class="life-empty"><strong>当前范围没有私聊生活工作区</strong><span>群聊只读展示共享能力，日记、阅读与睡眠记录归属于私聊角色。</span>${link("查看角色默认", "生活/日记与作息")}</div>`)}`); return; }
    root.innerHTML = `<div class="page-loading">正在读取</div>`;
    let data, config = {};
    try { [data, config] = await Promise.all([safeGet(ctx, ctx.role.life_api), readConfig(ctx, ctx.role, ["life", "library"])]); }
    catch (_) { root.innerHTML = `<div class="page-empty">生活记录暂时不可用</div>`; return; }
    const editable = ctx.scope === "role";
    const journals = listItems(data, "journals").map(item => ({...item, kind:item.kind || "journal"}));
    const texts = listItems(data, "texts").map(item => ({...item, kind:"text"}));
    const readings = listItems(data, "library").concat(listItems(data, "activities").filter(item => item.kind === "reading")).map(item => ({...item, kind:"reading"}));
    const sleeps = listItems(data, "activities").filter(item => item.kind === "sleep").map(item => ({...item, kind:"sleep"}));
    let selected = journals[0] || texts[0] || readings[0] || sleeps[0] || null;
    const render = () => {
      root.innerHTML = pageStack(`${card("生活记录", `<div class="life-toolbar"><span>${scopeNote(ctx, editable)}</span>${editable ? `${lifeButton("写日记", "diary")}${lifeButton("记录梦境", "dream", {secondary:true})}${lifeButton("添加手记", "add-text", {secondary:true})}${lifeButton("现在入睡", "sleep", {secondary:true})}` : ""}</div><div class="life-two-pane"><div>${recordList("日记与梦境", journals, selected?.activity_id || selected?.local_date, "journal")}${recordList("手记条目", texts, selected?.id, "text")}${recordList("阅读书架", readings, selected?.activity_id, "reading")}${recordList("睡眠记录", sleeps, selected?.activity_id, "sleep")}</div><div>${detailCard(data, selected, ctx, root)}</div></div>`, {meta:"列表与详情"})}${card("执行记录", `<div class="life-receipts">${listItems(data, "receipts").map((item, index) => `<div><span>书写记录 ${index + 1}</span><b>${esc(stateLabel(item.state))}</b>${item.state === "failed" ? lifeButton("重试", `retry:${item.operation_id || item.key}`, {secondary:true}) : ""}</div>`).join("") || `<span class="life-muted">暂无回执</span>`}</div>`)}${configCards(config, editable)}${!editable ? card("设置归属", link("去角色默认设置", "生活/日记与作息")) : ""}${editable ? saveBar("life", {disabled:true}) : ""}${notice()}`);
      if (editable) {
        const lifeConfig = config?.sections?.life?.settings || config?.life?.settings || config?.sections?.life || config?.life || {};
        const libraryConfig = config?.sections?.library?.settings || config?.library?.settings || config?.sections?.library || config?.library || {};
        const configValues = {...Object.fromEntries(Object.entries(lifeConfig).map(([name, value]) => [`life.${name}`, value])), ...Object.fromEntries(Object.entries(libraryConfig).map(([name, value]) => [`library.${name}`, value]))};
        bindForm(root, standardFields.life, lifeConfig, async changes => { await saveConfig(ctx, ctx.role, "life", changes, config?.sections?.life?.edit_token || config?.life?.edit_token || ""); }, "life");
        bindForm(root, standardFields.library, libraryConfig, async changes => { await saveConfig(ctx, ctx.role, "library", changes, config?.sections?.library?.edit_token || config?.library?.edit_token || ""); }, "library");
        root.querySelector('.ui-savebar[data-ui-save="library"]') || root.insertAdjacentHTML("beforeend", saveBar("library", {disabled:true}));
        applyDependencies(root, [{parent:"life.enabled", child:"life.diary_enabled"},{parent:"life.enabled", child:"life.diary_time"},{parent:"life.enabled", child:"life.timezone"},{parent:"life.enabled", child:"life.sleep_enabled"},{parent:"life.sleep_enabled", child:"life.sleep_time"},{parent:"life.sleep_enabled", child:"life.sleep_timezone"},{parent:"life.sleep_enabled", child:"life.sleep_variation_minutes"},{parent:"life.sleep_enabled", child:"life.sleep_window_minutes"},{parent:"life.sleep_enabled", child:"life.sleep_minutes"},{parent:"life.enabled", child:"life.derive_enabled"},{parent:"life.enabled", child:"life.diary_style_prompt"},{parent:"library.enabled", child:"library.reviews_enabled"},{parent:"library.enabled", child:"library.manual_entries_enabled"},{parent:"library.enabled", child:"library.reading_excerpt_chars"},{parent:"library.enabled", child:"library.max_entries_per_page"},{parent:"library.enabled", child:"library.rating_enabled"},{parent:"library.enabled", child:"library.preference_influence_enabled"},{parent:"library.enabled", child:"library.preference_min_ratings"},{parent:"library.enabled", child:"library.preference_max_terms"},{parent:"library.enabled", child:"library.min_interval_hours"},{parent:"library.enabled", child:"library.share_probability"},{parent:"library.enabled", child:"library.ask_probability"}]);
      }
    };
    render();
    bindNavigation(root, ctx);
    root.addEventListener("click", async event => {
      const record = event.target.closest("[data-record-id]");
      if (record) { const all = record.dataset.recordKind === "journal" ? journals : record.dataset.recordKind === "text" ? texts : record.dataset.recordKind === "reading" ? readings : sleeps; selected = all.find(item => String(item.activity_id || item.id || item.local_date) === record.dataset.recordId) || selected; render(); return; }
      const action = event.target.closest("[data-life-action]")?.dataset.lifeAction; if (!action || action === "materials") return;
      const [name, id] = action.split(":");
      if (name === "retry") {
        const receipt = listItems(data, "receipts").find(item => String(item.operation_id || item.key) === id);
        if (!receipt) return;
        try { await command(ctx, ctx.role.life_api, {action:receipt.kind === "dream" ? "dream" : "diary", local_date:receipt.local_date, retry_of:id, view_token:data.view_token}); data = await safeGet(ctx, ctx.role.life_api); render(); } catch (_) { root.querySelector("[data-life-notice]").textContent = "重试未完成，请核对执行记录。"; }
        return;
      }
      if (!editable && ["diary","dream","add-text","sleep"].includes(name)) return;
      const mappedAction = name === "diary" || name === "dream" ? name : name === "add-text" ? "add_text" : name === "sleep" ? "sleep" : name === "delete-journal" || name === "delete-text" ? "delete" : name === "withdraw-reading" ? "withdraw" : name;
      let payload = {action:mappedAction};
      const item = [...journals, ...texts, ...readings, ...sleeps].find(row => String(row.activity_id || row.id || row.local_date) === id);
      if (["delete-journal","delete-text","withdraw-reading","cancel"].includes(name) && !await confirm(root, "确认即时操作", `确认${name === "withdraw-reading" ? "撤回原文" : name === "cancel" ? "取消活动" : "删除这条记录"}？`)) return;
      if (["diary","dream","add-text","sleep","edit","edit-text","restore"].includes(name)) {
        const fields = name === "add-text" ? textFields : name === "sleep" ? [{name:"minutes",label:"睡眠时长（分钟）",type:"number",default:480}] : editFields;
        const values = await editDialog(root, name === "diary" ? "书写日记" : name === "dream" ? "记录梦境" : name === "add-text" ? "添加手记" : name === "sleep" ? "开始睡眠" : "编辑记录", fields, name === "sleep" ? {minutes:480} : item || {}, "提交");
        if (!values) return;
        payload = {action: name === "edit-text" ? "edit" : name, ...values};
        if (name === "add-text") payload.action = "add_text";
        if (["edit","edit-text","restore"].includes(name)) Object.assign(payload, {kind:item?.kind || "diary", local_date:item?.local_date, expected_revision:item?.revision, view_token:item?.view_token});
      } else if (item) Object.assign(payload, {activity_id:item.activity_id, kind:item.kind, local_date:item.local_date, expected_revision:item.revision, view_token:item.view_token || data.view_token});
      try { await command(ctx, ctx.role.life_api, payload); root.querySelector("[data-life-notice]").textContent = "操作已提交，正在重新读取。"; const fresh = await safeGet(ctx, ctx.role.life_api); data = fresh; render(); }
      catch (_) { root.querySelector("[data-life-notice]").textContent = "操作未完成，请刷新核对执行记录。"; }
    });
  }
};
export default page;
