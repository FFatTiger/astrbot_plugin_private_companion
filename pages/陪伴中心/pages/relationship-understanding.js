import {card, link} from "../ui.js";
import {ensureStyles, safeGet, safePost, op, pageStack, notice, actions, lifeButton, confirm, editDialog, dateText, stateLabel, scopeNote, targetIsPrivate, bindNavigation, esc} from "./life-shared.js";

const labels = {proposed:"待审阅",reviewed:"已审阅",adopted:"已采用",retracted:"已撤回"};
function rows(data) { return Array.isArray(data?.items) ? data.items : []; }
function kind(item) { return item.kind === "emotion_episode" ? "情绪片段" : "关系背景"; }
function record(item, selected) { return `<button type="button" class="life-record${selected ? " is-selected" : ""}" data-relationship-id="${esc(item.memory_id)}"><strong>${esc(kind(item))}<span class="life-pill">${esc(labels[item.state] || stateLabel(item.state))}</span></strong><small>${esc((item.interpretation || "来源已不可用").slice(0, 72))}</small><small>${esc(dateText(item.observed_at))} · ${esc(item.source_count ?? 0)} 个来源</small></button>`; }
function detail(item) {
  if (!item) return card("记录详情", `<div class="life-empty">选择一条关系记录查看详情。</div>`);
  const actionsFor = item.actions || [];
  return card("记录详情", `<div class="life-detail"><span class="life-eyebrow">${esc(kind(item))} · 第 ${esc(item.revision || 1)} 版</span><h2>${esc(labels[item.state] || "关系记录")}</h2><p class="life-prose">${esc(item.interpretation || "来源已失效或不再允许读取，正文已隐藏。")}</p><div class="life-meta-line"><span>观察于 ${esc(dateText(item.observed_at))}</span><span>${esc(item.source_count ?? 0)} 个原来源当前有效</span></div>${actions(actionsFor.map(action => lifeButton({review:"审阅通过",adopt:"采用到对话",revise:"更正理解",retract:"撤回记录"}[action] || action, `relationship:${action}:${item.memory_id}`, {danger:action === "retract", secondary:action === "revise"})))} </div>`);
}
const page = {
  id:"life-relationships", section:"生活", title:"关系理解",
  async render(root, ctx) {
    ensureStyles();
    if (!targetIsPrivate(ctx) || !ctx.role?.relationships_api) { root.innerHTML = pageStack(card("关系理解", `<div class="life-empty"><strong>当前范围没有私聊关系理解</strong><span>群聊共享陈述请从联系人 › 群详情进入。</span>${link("查看群详情", "联系人/群详情")}</div>`)); return; }
    root.innerHTML = `<div class="page-loading">正在读取</div>`;
    let data;
    try { data = await safeGet(ctx, ctx.role.relationships_api, {limit:20}); } catch (_) { root.innerHTML = `<div class="page-empty">关系记录暂时不可用</div>`; return; }
    let selected = rows(data)[0] || null;
    const render = () => { root.innerHTML = pageStack(`${card("关系记录", `<div class="life-toolbar"><select class="ui-select" data-relationship-state><option value="">全部状态</option><option value="proposed">待审阅</option><option value="reviewed">已审阅</option><option value="adopted">已采用</option><option value="retracted">已撤回</option></select>${lifeButton("刷新", "refresh", {secondary:true})}${scopeNote(ctx, false)}</div><div class="life-two-pane"><div class="life-record-list">${rows(data).map(item => record(item, item === selected)).join("") || `<p class="life-muted">当前范围没有关系记录。</p>`}</div><div>${detail(selected)}</div></div>`, {meta:"待审阅 / 已审阅 / 已采用 / 已撤回"})}${notice()}`); };
    render();
    bindNavigation(root, ctx);
    root.addEventListener("change", async event => { if (!event.target.matches("[data-relationship-state]")) return; data = await safeGet(ctx, ctx.role.relationships_api, {limit:20, state:event.target.value}); selected = rows(data)[0] || null; render(); });
    root.addEventListener("click", async event => {
      const recordId = event.target.closest("[data-relationship-id]")?.dataset.relationshipId;
      if (recordId) { selected = rows(data).find(item => String(item.memory_id) === recordId) || selected; render(); return; }
      const action = event.target.closest("[data-life-action]")?.dataset.lifeAction; if (!action) return;
      if (action === "refresh") { data = await safeGet(ctx, ctx.role.relationships_api, {limit:20}); selected = rows(data).find(item => item.memory_id === selected?.memory_id) || rows(data)[0] || null; render(); return; }
      const [, verb, id] = action.split(":"); const item = rows(data).find(row => String(row.memory_id) === id); if (!item) return;
      if (verb === "retract" && !await confirm(root, "确认撤回记录", "撤回后，后续对话不再使用这条关系理解。")) return;
      let extra = {};
      if (verb === "revise") { const values = await editDialog(root, "更正关系理解", [{name:"interpretation",label:"完整理解",type:"textarea"}], {interpretation:item.interpretation || ""}, "保存更正"); if (!values) return; extra = values; }
      try { await safePost(ctx, `${ctx.role.relationships_api}/command`, {memory_id:item.memory_id, action:verb, expected_revision:item.revision, view_token:item.view_token, ...op(`relationship-${verb}`), ...extra}); data = await safeGet(ctx, ctx.role.relationships_api, {limit:20}); selected = rows(data).find(row => row.memory_id === item.memory_id) || rows(data)[0] || null; render(); }
      catch (_) { root.querySelector("[data-life-notice]").textContent = "操作未完成，请刷新核对关系记录。"; }
    });
  }
};
export default page;
