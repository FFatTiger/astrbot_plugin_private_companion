import {card, segmented, link, esc} from "../ui.js";

const CSS_URL = new URL("./contacts.css", import.meta.url).href;
function styles() {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const node = document.createElement("link"); node.rel = "stylesheet"; node.href = CSS_URL; document.head.append(node);
  }
}
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const personName = person => person?.display_name || person?.admin_nickname || person?.native_account_id || "未命名成员";
const groupName = group => group?.display_name || group?.group_name || `群 ${group?.group_id || "未知"}`;
const groupsOf = person => person?.groups && typeof person.groups === "object" ? person.groups : {};
const lastDate = value => {
  if (!value) return "—";
  const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("zh-CN", {month:"numeric", day:"numeric"}).format(date);
};
const routeKey = person => JSON.stringify([person?.subject_id, person?.platform, person?.bot_id, person?.account_id, person?.role_id]);
const remembered = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
const readDirectory = async api => api.get("acquaintance");
const peopleWithMergedRoutes = persons => {
  const merged = new Map();
  for (const person of persons || []) {
    const key = String(person.subject_id || person.native_account_id || routeKey(person));
    const current = merged.get(key);
    if (!current) { merged.set(key, {...person, display_routes: person.display_routes || []}); continue; }
    current.private_chat ||= Boolean(person.private_chat);
    current.group_member ||= Boolean(person.group_member);
    current.private = current.private || person.private;
    current.total = current.total || person.total;
    current.total = {...current.total, msg_count: Math.max(number(current.total?.msg_count), number(person.total?.msg_count)), active_days: Math.max(number(current.total?.active_days), number(person.total?.active_days)), last_seen: String(current.total?.last_seen || "") > String(person.total?.last_seen || "") ? current.total?.last_seen : person.total?.last_seen};
    current.groups = {...groupsOf(current), ...groupsOf(person)};
    if (person.display_routes?.length) current.display_routes.push(...person.display_routes);
  }
  return [...merged.values()];
};
const closeness = person => {
  const messages = number(person.total?.msg_count) + number(person.private?.msg_count) * .65 + Object.values(groupsOf(person)).reduce((sum, item) => sum + number(item?.msg_count) * .35, 0);
  const days = number(person.total?.active_days) + number(person.private?.active_days) * .5;
  const recent = person.total?.last_seen ? Math.exp(-Math.max(0, Date.now() - Date.parse(person.total.last_seen)) / 86400000 / 45) : 0;
  return Math.max(.08, Math.min(1, Math.log1p(messages) / Math.log1p(160) * .5 + Math.min(1, days / 45) * .25 + recent * .25));
};
const statusLabel = group => group.configured ? "已接入" : group.discovered ? "待处理" : "历史往来";

function radarMarkup(people) {
  const limit = 48, visible = [...people].sort((a, b) => closeness(b) - closeness(a)).slice(0, limit), hidden = Math.max(0, people.length - visible.length);
  const cx = 340, cy = 220, inner = 92, outer = 174;
  const nodes = visible.map((person, index) => {
    const privateUser = Boolean(person.private_chat), radius = privateUser ? inner + 12 : outer - 4;
    const angle = -Math.PI / 2 + index / Math.max(1, visible.length) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius, name = personName(person);
    const labelX = Math.cos(angle) >= 0 ? x + 10 : x - 10, anchor = Math.cos(angle) >= 0 ? "start" : "end";
    return `<g class="contact-radar-node ${privateUser ? "is-private" : "is-group"}" data-contact-person="${esc(JSON.stringify(person))}" tabindex="0" role="button" aria-label="打开${esc(name)}"><line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line><circle cx="${x}" cy="${y}" r="${privateUser ? 6 : 5}"></circle><text x="${labelX}" y="${y + (Math.sin(angle) > .6 ? 20 : -10)}" text-anchor="${anchor}">${esc([...name].slice(0, 8).join("") + (name.length > 8 ? "…" : ""))}</text></g>`;
  }).join("");
  const clusters = hidden ? `<g class="contact-radar-cluster" data-contact-cluster="hidden" tabindex="0" role="button"><circle cx="${cx + 40}" cy="${cy - outer + 16}" r="24"></circle><text x="${cx + 40}" y="${cy - outer + 21}" text-anchor="middle">+${hidden}</text></g>` : "";
  return `<div class="contact-radar-wrap"><svg class="contact-radar" viewBox="0 0 680 470" role="img" aria-label="关系雷达"><circle class="radar-ring" cx="${cx}" cy="${cy}" r="${outer}"></circle><circle class="radar-ring inner" cx="${cx}" cy="${cy}" r="${inner}"></circle><circle class="radar-core" cx="${cx}" cy="${cy}" r="42"></circle><text class="radar-core-label" x="${cx}" y="${cy + 4}" text-anchor="middle">当前角色</text><text class="radar-zone" x="${cx - inner + 4}" y="${cy - inner - 12}">私聊 · 内圈</text><text class="radar-zone" x="${cx + outer - 54}" y="${cy - 5}">群聊 · 外圈</text>${nodes}${clusters}</svg><p class="contact-radar-caption">${people.length} 位用户 · ${hidden ? `已收起 ${hidden} 位，` : ""}光点越靠近中心，近期与高频互动信号越集中</p></div>`;
}
function personTierMarkup(people) {
  const groups = [
    ["both", "私聊 + 群聊", item => item.private_chat && item.group_member],
    ["private", "仅私聊", item => item.private_chat && !item.group_member],
    ["group", "仅群聊", item => !item.private_chat && item.group_member],
    ["idle", "暂无往来", item => !item.private_chat && !item.group_member],
  ];
  const max = Math.max(1, ...people.map(item => number(item.total?.msg_count)));
  return groups.map(([key, label, match]) => {
    const rows = people.filter(match).sort((a, b) => number(b.total?.msg_count) - number(a.total?.msg_count));
    return `<section class="contact-tier" data-tier="${key}"><header><strong>${label}</strong><span>${rows.length} 人</span></header><div class="contact-person-list">${rows.length ? rows.map(person => `<button type="button" class="contact-person-row" data-contact-person="${esc(JSON.stringify(person))}"><span><b>${esc(personName(person))}</b><small>${esc(person.native_account_id || "")} · 最近 ${lastDate(person.total?.last_seen)}</small></span><span class="contact-meter"><i style="width:${Math.min(100, number(person.total?.msg_count) / max * 100)}%"></i></span><em>${number(person.total?.msg_count)} 条</em></button>`).join("") : `<p class="contact-muted">暂无成员</p>`}</div></section>`;
  }).join("");
}

export default {
  id: "contacts-network", section: "联系人", title: "关系网",
  async render(root, ctx) {
    styles(); root.innerHTML = `<div class="page-loading">正在读取</div>`;
    let data;
    try { data = await readDirectory(ctx.api); } catch (_) { root.innerHTML = `<div class="page-empty">关系目录暂不可用</div>`; return; }
    const people = peopleWithMergedRoutes(Array.isArray(data?.persons) ? data.persons : []);
    const groups = Array.isArray(data?.groups) ? data.groups : [];
    let graphScope = "all", filter = "all", search = "", hideIdle = true;
    const render = () => {
      const term = search.toLocaleLowerCase();
      const matching = people.filter(person => !term || [personName(person), person.native_account_id, person.subject_id, ...Object.keys(groupsOf(person))].join(" ").toLocaleLowerCase().includes(term));
      const graphPeople = matching.filter(person => graphScope === "private" ? person.private_chat : graphScope === "group" ? person.group_member : true).filter(person => !hideIdle || person.private_chat || person.group_member);
      const shown = matching.filter(person => filter === "all" || filter === "both" && person.private_chat && person.group_member || filter === "private" && person.private_chat || filter === "group" && person.group_member || filter === "idle" && !person.private_chat && !person.group_member);
      root.innerHTML = `<div class="contact-page-stack"><div class="contact-page-actions"><button type="button" class="contact-button secondary" data-refresh>重新读取</button></div>${card("关系分层", `<div class="contact-filter-line"><div data-filter-control>${segmented("contact-filter", filter, {all:"全部", both:"两边都有", private:"仅私聊", group:"仅群聊", idle:"暂无往来"})}</div><label class="contact-check"><input type="checkbox" data-hide-idle ${hideIdle ? "checked" : ""}>隐藏无往来用户</label><input class="ui-input contact-search" data-search placeholder="搜索用户、账号或群名" value="${esc(search)}"></div><div class="contact-tier-grid">${personTierMarkup(shown)}</div>`, {meta: `${shown.length} 人`})}${card("互动雷达", `<div class="contact-radar-toolbar">${segmented("graph-filter", graphScope, {all:"全部", private:"私聊内圈", group:"群聊外圈"})}</div>${graphPeople.length ? radarMarkup(graphPeople) : `<div class="contact-empty">没有符合当前范围的互动</div>`}`, {meta: graphPeople.length > 48 ? "最多显示 48 人" : `${graphPeople.length} 人`})}${card("群聊入口", `<div class="contact-group-grid">${groups.length ? groups.filter(group => !term || [groupName(group), group.group_id].join(" ").toLocaleLowerCase().includes(term)).map(group => `<button type="button" class="contact-group-card" data-contact-group="${esc(JSON.stringify(group))}"><span><b>${esc(groupName(group))}</b><small>${esc(group.group_id || "")} · ${number(group.member_count)} 人 · ${number(group.msg_count)} 条</small></span><em>${statusLabel(group)}</em></button>`).join("") : `<p class="contact-muted">暂无群聊</p>`}</div>`, {meta: `${groups.length} 个群`})}</div>`;
      root.querySelectorAll("[data-ui-segmented=contact-filter] [data-ui-segment]").forEach(button => button.addEventListener("click", () => { filter = button.dataset.uiSegment; render(); }));
      root.querySelectorAll("[data-ui-segmented=graph-filter] [data-ui-segment]").forEach(button => button.addEventListener("click", () => { graphScope = button.dataset.uiSegment; render(); }));
      root.querySelector("[data-hide-idle]")?.addEventListener("change", event => { hideIdle = event.target.checked; render(); });
      root.querySelector("[data-search]")?.addEventListener("input", event => { search = event.target.value; render(); const input = root.querySelector("[data-search]"); input?.focus(); input?.setSelectionRange(search.length, search.length); });
      root.querySelector("[data-refresh]")?.addEventListener("click", () => ctx.navigate("联系人/关系网"));
      root.querySelectorAll("[data-contact-person]").forEach(node => node.addEventListener("click", () => { remembered("companion-contact-person", JSON.parse(node.dataset.contactPerson)); ctx.navigate("联系人/联系人详情"); }));
      root.querySelectorAll("[data-contact-group]").forEach(node => node.addEventListener("click", () => { remembered("companion-contact-group", JSON.parse(node.dataset.contactGroup)); ctx.navigate("联系人/群详情"); }));
    };
    render();
  }
};
