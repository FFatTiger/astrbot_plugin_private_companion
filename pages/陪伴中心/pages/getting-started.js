import {card, row, select, saveBar, setSaveState, link, esc, statusBadge} from "../ui.js";

const style = () => { if (!document.querySelector('link[data-system-style]')) { const node = document.createElement("link"); node.rel = "stylesheet"; node.href = new URL("./system.css", import.meta.url).href; node.dataset.systemStyle = "1"; document.head.appendChild(node); } };
const dataOf = value => value?.data && !value.settings && !value.targets ? value.data : value || {};
const button = (label, action, extra = "") => `<button type="button" class="system-button${extra}" data-action="${esc(action)}">${esc(label)}</button>`;
const statusText = status => status?.ready ? ["已完成", "ok"] : status?.step === "binding" ? ["等待绑定", "warn"] : ["等待模型", "warn"];
const providersOf = value => value?.providers || value?.model?.providers || value?.catalog || [];
const providerChoices = providers => Object.fromEntries((Array.isArray(providers) ? providers : []).map(item => [item.id || item.provider_id || item.name, item.label || item.name || item.id || item.provider_id]));
const taskItems = value => Array.isArray(value?.tasks) ? value.tasks : Array.isArray(value?.model?.tasks) ? value.model.tasks : [];
const taskName = kind => ({"conversation.reply":"对话回复","proactive.compose":"主动联系","proactive.judge":"主动联系复核","memory.reflect":"记忆整理","calendar.plan":"日程规划","role.state.maintain":"角色状态","role.journal.diary":"日记","role.expression.learn":"表达学习"}[kind] || kind);

const page = {id:"system-setup", section:"系统", title:"开始使用", async render(root, ctx) {
  style(); root.innerHTML = `<div class="page-loading">正在读取</div>`;
  const api = ctx.api;
  let status = {}, model = {};
  try { status = dataOf(await api.get("setup/status")); } catch (_) { root.innerHTML = `<div class="system-error">无法读取开始使用状态</div>`; return; }
  if (ctx.role?.model_api) { try { model = dataOf(await api.get(ctx.role.model_api)); } catch (_) {} }
  const [stateLabel, stateTone] = statusText(status);
  const setupModel = status.model || {};
  const providers = providersOf(setupModel);
  const choices = providerChoices(providers);
  const binding = status.binding || {};
  const upgrade = status.upgrade || {};
  const host = status.host || {};
  const progress = Array.isArray(status.completed) ? status.completed : [];
  const skipped = Array.isArray(status.skipped) ? status.skipped : [];
  const tasks = taskItems(model);
  const taskRows = tasks.length ? tasks.slice(0, 17).map(task => `<li class="system-list-item"><div><strong>${esc(taskName(task.kind))}</strong><small>${esc(task.kind || "")}</small></div><div>${statusBadge(task.provider || task.settings?.provider || "跟随上级")}</div></li>`).join("") : `<li class="system-empty">角色模型目录尚未准备，完成启动后可在${link("模型与连接", "#/系统/模型与连接")}中配置。</li>`;
  const bindingInfo = Object.entries({平台:binding.platform || binding.platform_id, "陪伴账号":binding.account || binding.account_id, 私聊对象:binding.participant || binding.participant_id, 人格:binding.persona || binding.persona_id}).filter(([, value]) => value).map(([key,value]) => `<li class="system-list-item"><span>${esc(key)}</span><strong>${esc(value)}</strong></li>`).join("");
  const cards = [];
  cards.push(card("当前进度", `<div class="system-status"><i class="system-status-dot is-${stateTone}"></i><strong>${stateLabel}</strong><span>${status.ready ? "已完成初始化" : `当前步骤：${esc(status.step || "未开始")}`}</span></div><div class="system-actions">${status.ready ? "" : button("完成当前步骤", "complete")}${status.ready || !status.step ? "" : button("跳过当前步骤", "skip")}</div>`));
  if (status.step === "binding") {
    const facts = bindingInfo || `<li class="system-empty">还没有发现绑定候选。请在目标私聊发送「我会永远陪着你」，然后重新读取。</li>`;
    cards.push(card("核心管理员私聊", `<p class="system-lead">绑定后的管理员私聊同时用于管理操作与主动消息投递。</p><ul class="system-list">${facts}</ul><div class="system-actions">${button("我已发送，检查绑定", "reload-binding")}${binding.candidate || binding.participant_id ? button("确认此私聊", "confirm-binding", " primary") : ""}</div>`));
  }
  if (status.step === "model" && !status.ready) {
    const current = setupModel.provider_id || setupModel.provider || "";
    cards.push(card("初始主模型", `<p class="system-lead">选择插件初始化阶段使用的主模型。</p>${row("模型提供方", select("setup-provider", current, choices, {label:"初始主模型"}))}${saveBar("setup-model", {label:"保存并继续", disabled:!Object.keys(choices).length})}`));
  }
  if (upgrade.present && !status.configured) cards.push(card("旧版升级接续", `<div class="system-confirm">检测到旧版资料。确认后会按当前升级计划接续，完成前不会改写运行资料。</div><div class="system-actions">${button("查看并接续", "upgrade", " primary")}</div>`));
  if (status.ready && host.accepting === false) cards.push(card("运行服务连接", `<p class="system-lead">运行服务当前没有接收入站消息，可以重新准备并启动。</p><div class="system-actions">${button("准备并启动", "start-host", " primary")}</div>`));
  if (status.ready) {
    cards.push(card("任务模型路由", `<p class="system-note">任务路由统一在模型与连接页编辑，这里只展示当前角色的路由结果。</p><ul class="system-list">${taskRows}</ul><div class="system-actions">${link("去模型与连接", "#/系统/模型与连接")}</div>`));
    const test = status.proactive_test || {};
    cards.push(card("主动消息测试", `<p class="system-lead">测试会临时运行一次主动联系，不会改变长期开关。</p><div class="system-status"><i class="system-status-dot is-${test.state === "failed" ? "error" : test.state === "delivered" || test.state === "received" ? "ok" : "warn"}"></i><span>${esc(test.state || "尚未运行")}</span>${test.attempt_id ? `<small>${esc(test.attempt_id)}</small>` : ""}</div><div class="system-actions">${button(test.state ? "重新运行主动联系" : "运行主动联系测试", "proactive-test", " primary")}${test.attempt_id ? button("确认发送", "confirm-proactive") : ""}</div>`));
  }
  root.innerHTML = `<div class="page-stack" data-system-setup>${cards.join("")}</div>`;
  const stateNode = () => root.querySelector('[data-ui-save-state="setup-model"]');
  root.addEventListener("click", async event => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action || event.target.disabled) return;
    const call = async (route, body = {}) => { event.target.disabled = true; try { await api.post(route, body); await page.render(root, ctx); } catch (error) { const node = stateNode(); if (node) setSaveState(root, "setup-model", error.message || "操作失败", "error"); event.target.disabled = false; } };
    if (["confirm-binding","upgrade","start-host","confirm-proactive"].includes(action) && !window.confirm("确认执行此操作？")) return;
    if (action === "reload-binding") return page.render(root, ctx);
    if (action === "confirm-binding") return call("setup/binding/confirm", {});
    if (action === "upgrade") return call("setup/upgrade", {confirmed:true, plan_token:upgrade.plan_token});
    if (action === "start-host") return call("setup/host/start", {});
    if (action === "proactive-test") return call("setup/proactive-test", {enable_proactive:true});
    if (action === "confirm-proactive") return call("setup/proactive-test/confirm", {attempt_id:(status.proactive_test || {}).attempt_id});
    if (action === "complete" || action === "skip") return call("setup/complete", {step:status.step, skipped:action === "skip"});
  });
  root.addEventListener("click", async event => {
    const save = event.target.closest('[data-ui-save="setup-model"]'); if (!save || save.disabled) return;
    const field = root.querySelector('[data-ui-field="setup-provider"]'); if (!field) return;
    save.disabled = true; setSaveState(root, "setup-model", "保存中");
    try { await api.post("setup/model", {provider_id:field.value}); await page.render(root, ctx); } catch (error) { setSaveState(root, "setup-model", error.message || "保存失败", "error"); save.disabled = false; }
  });
}};
export default page;
