import {card, saveBar, link} from "../ui.js";
import {ensureStyles, safeGet, safePost, op, formRows, pageStack, notice, actions, lifeButton, confirm, editDialog, itemTitle, dateText, stateLabel, scopeNote, targetIsPrivate, bindForm, applyDependencies, bindNavigation, esc} from "./life-shared.js";

const accessFields = [{name:"read_enabled",label:"读取成长记录",type:"bool",default:false},{name:"propose_enabled",label:"提出成长建议",type:"bool",default:false}];
function rowsOf(data) { return Array.isArray(data?.items) ? data.items : []; }
function growthCard(item) {
  const buttons = (item.actions || []).map(action => lifeButton({confirm:"确认",resume:"继续",pause:"暂停",complete:"已完成",retire:"归档",withdraw:"撤回",revise:"修订"}[action] || action, `growth:${action}:${item.growth_id}`, {danger:["retire","withdraw"].includes(action), secondary:!["confirm","resume","complete"].includes(action)}));
  return `<article class="life-growth-card"><header><div><h3>${esc(item.title || "来源已不可读取")}</h3><span class="life-pill">${esc(stateLabel(item.state))}</span></div><small>${esc(({skill:"能力",goal:"目标"}[item.kind] || "成长记录"))} · ${esc(dateText(item.updated_at || item.created_at))}</small></header><p>${esc(item.unavailable_reason ? "来源已不可读取，正文暂不展示。" : item.description || "")}</p>${item.progress_note ? `<div class="life-progress-note">${esc(item.progress_note)}</div>` : ""}<div class="life-growth-meta"><span>版本 ${esc(item.revision || 1)}</span><span>依据 ${esc(item.source_count ?? item.sources?.length ?? 0)} 条</span></div>${actions([lifeButton("查看依据", `evidence:${item.growth_id}`, {secondary:true}), ...buttons])}</article>`;
}
const page = {
  id:"life-growth", section:"生活", title:"学习与成长",
  async render(root, ctx) {
    ensureStyles();
    if (!targetIsPrivate(ctx) || !ctx.role?.growth_api) { root.innerHTML = pageStack(card("学习与成长", `<div class="life-empty"><strong>当前范围没有成长记录工作区</strong><span>成长记录归属于私聊角色。</span>${link("查看角色默认", "生活/学习与成长")}</div>`)); return; }
    root.innerHTML = `<div class="page-loading">正在读取</div>`;
    let data, reviews;
    try { [data, reviews] = await Promise.all([safeGet(ctx, ctx.role.growth_api, {limit:20}), safeGet(ctx, `${ctx.role.growth_api}/progress`, {limit:20})]); }
    catch (_) { root.innerHTML = `<div class="page-empty">成长工作区暂时不可用</div>`; return; }
    const editable = ctx.scope === "object";
    const render = () => {
      const access = data?.access || {};
      root.innerHTML = pageStack(`${card("成长权限", `${editable ? formRows(accessFields, access.settings || {}) : `<div class="life-readonly-grid">${accessFields.map(field => `<span><b>${esc(field.label)}</b>${esc(access.settings?.[field.name] ? "已开启" : "已关闭")}</span>`).join("")}</div>`}${scopeNote(ctx, editable)}`, {meta:"当前对象权限"})}${card("成长记录", `<div class="life-growth-toolbar">${lifeButton("提出成长建议", "propose", {secondary:true})}${lifeButton("刷新", "refresh", {secondary:true})}</div><div class="life-growth-list">${rowsOf(data).map(growthCard).join("") || `<p class="life-muted">暂无成长记录。</p>`}</div>`, {meta:"后端动作决定可用按钮"})}${card("待审阅进展", `<div class="life-review-list">${rowsOf(reviews).map(item => `<article><div><strong>${esc(item.title || item.growth_title || "进展")}</strong><p>${esc(item.progress_note || item.description || "")}</p></div>${actions([lifeButton("采纳", `review:accept:${item.review_id}`, {secondary:true}), lifeButton("不采纳", `review:reject:${item.review_id}`, {danger:true})])}</article>`).join("") || `<p class="life-muted">暂无待审阅进展。</p>`}</div>`, {meta:"采纳 / 不采纳"})}${!editable ? `<div class="life-readonly-footer">${link("去当前窗口设置", "生活/学习与成长")}</div>` : saveBar("growth", {disabled:true})}${notice()}`);
      if (editable && data?.access) {
        bindForm(root, accessFields, data.access.settings || {}, async changes => { await safePost(ctx, `${ctx.role.growth_api}/command`, {action:"configure", ...op("growth-access"), edit_token:data.access.edit_token, changes}); }, "growth");
        applyDependencies(root, [{parent:"read_enabled", child:"propose_enabled"}]);
      }
    };
    render();
    bindNavigation(root, ctx);
    root.addEventListener("click", async event => {
      const action = event.target.closest("[data-life-action]")?.dataset.lifeAction; if (!action) return;
      const [name, verb, id] = action.split(":");
      try {
        if (name === "refresh") { data = await safeGet(ctx, ctx.role.growth_api, {limit:20}); reviews = await safeGet(ctx, `${ctx.role.growth_api}/progress`, {limit:20}); render(); return; }
        if (name === "evidence") { const result = await safeGet(ctx, `${ctx.role.growth_api}/evidence`, {growth_id:id, limit:20}); root.querySelector("[data-life-notice]").textContent = `依据 ${result?.items?.length ?? result?.sources?.length ?? 0} 条`; return; }
        if (name === "growth") {
          const item = rowsOf(data).find(row => String(row.growth_id) === id); if (!item || !(item.actions || []).includes(verb)) return;
          if (["withdraw","retire"].includes(verb) && !await confirm(root, "确认成长记录操作", `确认${verb === "withdraw" ? "撤回" : "归档"}这条成长记录？`)) return;
          let extra = {};
          if (verb === "revise") { const values = await editDialog(root, "修订成长记录", [{name:"title",label:"标题",type:"text"},{name:"description",label:"描述",type:"textarea"},{name:"progress_note",label:"当前进展",type:"textarea"}], item, "保存"); if (!values) return; extra = values; }
          await safePost(ctx, `${ctx.role.growth_api}/command`, {action:verb, ...op(`growth-${verb}`), view_token:item.view_token, growth_id:item.growth_id, expected_revision:item.revision, ...extra}); data = await safeGet(ctx, ctx.role.growth_api, {limit:20}); render(); return;
        }
        if (name === "review") { const item = rowsOf(reviews).find(row => String(row.review_id) === id); if (!item) return; await safePost(ctx, `${ctx.role.growth_api}/progress/command`, {review_id:item.review_id, action:verb, expected_revision:item.base_revision || item.revision, view_token:item.view_token, ...op(`growth-review-${verb}`)}); reviews = await safeGet(ctx, `${ctx.role.growth_api}/progress`, {limit:20}); render(); return; }
        if (name === "propose") { const values = await editDialog(root, "提出成长建议", [{name:"kind",label:"记录类型",type:"text",default:"goal"},{name:"title",label:"标题",type:"text"},{name:"description",label:"描述",type:"textarea"},{name:"progress_note",label:"当前进展",type:"textarea"},{name:"sources",label:"来源引用列表",type:"textarea",default:"[]"}], {}, "提出"); if (!values) return; const sources = JSON.parse(values.sources); await safePost(ctx, `${ctx.role.growth_api}/command`, {action:"propose", ...op("growth-propose"), view_token:data?.view_token || "", kind:values.kind, title:values.title, description:values.description, progress_note:values.progress_note, sources}); data = await safeGet(ctx, ctx.role.growth_api, {limit:20}); render(); }
      } catch (_) { root.querySelector("[data-life-notice]").textContent = "操作未完成，请刷新核对成长记录。"; }
    });
  }
};
export default page;
