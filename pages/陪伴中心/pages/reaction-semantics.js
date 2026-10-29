import {ensureStyles, esc, card, row, toggle, textField, numberField, select, saveBar, setSaveState, settingsOf, tokenOf, postChanges, postAction, confirmAction, status, empty, buttonBar, more, advancedCard, fieldRows, actionButton as uiActionButton} from "./ability-shared.js";

const MODELS = [["embedding_provider", "向量模型", "select"], ["rerank_provider", "候选重排", "select"], ["analysis_provider", "视觉与词义分析", "select"]];
const MODEL_MORE = [["timeout_seconds", "模型超时", "number", "秒"], ["batch_size", "索引批次", "number", "条"]];
const SLANG_MORE = [["slang_web_search_candidates", "检索词数", "number", "个"], ["slang_web_search_results", "每词参考数", "number", "条"], ["learning_interval_seconds", "词义整理间隔", "number", "分钟", {min: 1, max: 1440, step: 1}]];
const SEND_FIELDS = [["reactions_trigger_probability", "自动发送概率", "number", "%", {min: 0, max: 100, step: .1}], ["reactions_cooldown_seconds", "发送间隔", "number", "秒"], ["reactions_delivery_mode", "发送位置", "select", {separate_after: "正文后单独发送", same_message: "与正文同条发送", separate_before: "正文前单独发送"}], ["reactions_image_format", "发送格式", "select", {image: "普通图片", qq_emoji: "QQ 表情"}]];
const COLLECTION_FIELDS = [["reactions_collection_private_probability", "私聊收录概率", "number", "%", {min: 0, max: 100, step: .1}], ["reactions_collection_group_probability", "群聊收录概率", "number", "%", {min: 0, max: 100, step: .1}], ["reactions_collection_mode", "收录审核", "select", {automatic: "自动启用", confirm: "待人工确认"}]];
const BOUNDARY_FIELDS = [["low_latency_enabled", "低延迟模式", "bool"], ["embedding_backfill_enabled", "后台补齐向量", "bool"], ["candidate_limit", "每轮候选素材数", "number", "条"], ["embedding_candidate_limit", "向量检索候选上限", "number", "条"], ["embedding_backfill_batch_size", "补齐批次大小", "number", "条"], ["embedding_backfill_interval_seconds", "补齐间隔", "number", "秒"], ["embedding_weight", "向量权重", "number", "", {step: .01}], ["embedding_score_threshold", "向量相似度门槛", "number", "", {step: .01}]];
const VISION_MODE = ["vision_verify_mode", "视觉复核模式", "select", {off: "不复核", embedding: "仅向量命中时复核", always: "每次复核"}];
const catalogItems = data => Array.isArray(data?.items) ? data.items : Array.isArray(data?.catalog?.items) ? data.catalog.items : [];
// 后端存 0–1 小数（companion_v2/storage/semantic.py 的 PROBABILITY_FIELDS），界面用百分数。
const PERCENT_FIELDS = new Set(["reactions_trigger_probability", "reactions_collection_private_probability", "reactions_collection_group_probability"]);
const MINUTES_FIELD = "learning_interval_seconds";
const PERCENT_OF = value => Math.round(Number(value ?? 0) * 10000) / 100;
const FRACTION_OF = value => Math.min(100, Math.max(0, Number(value) || 0)) / 100;
const displayDraft = draft => {
  const next = {...draft};
  for (const name of PERCENT_FIELDS) if (next[name] != null) next[name] = PERCENT_OF(next[name]);
  if (next[MINUTES_FIELD] != null) next[MINUTES_FIELD] = Math.round(Number(next[MINUTES_FIELD]) / 60);
  return next;
};
const itemTitle = item => item?.payload?.name || item?.payload?.term || item?.name || item?.term || "未命名素材";
const itemImage = item => item?.thumbnail_url || item?.image_url || item?.payload?.image_url || item?.payload?.url || "";
const providers = data => { const p = data?.providers || {}; return Object.fromEntries([...(p.embedding || []), ...(p.rerank || []), ...(p.analysis || [])].map(item => [item.id || item.name || item, item.name || item.id || item])); };
const flag = (draft, key, label) => toggle(key, Boolean(draft[key]), {label});

const page = {
  id: "ability-semantic", section: "能力", title: "表情与语义",
  async render(root, ctx) {
    ensureStyles(); root.innerHTML = `<div class="page-loading">正在读取语义目录</div>`;
    let semantic = {}, reaction = {};
    try { [semantic, reaction] = await Promise.all([ctx.api.get("semantic"), ctx.role?.config_api ? ctx.api.get(ctx.role.config_api, {sections: "reaction"}) : Promise.resolve({})]); } catch (_) {}
    const group = ctx.target?.scope_kind === "group", qq = ctx.capabilities?.message_components?.face === true, configPath = ctx.role?.config_api || (ctx.role?.reply_api || "").replace(/\/reply$/, "/config");
    const reactionSection = reaction?.sections?.reaction || reaction?.reaction || {};
    const reactionSettings = settingsOf(reactionSection);
    const state = {semanticDraft: {...settingsOf(semantic)}, reactionDraft: {...reactionSettings}, semanticToken: tokenOf(semantic), reactionToken: tokenOf(reactionSection) || tokenOf(reaction), items: catalogItems(semantic), query: "", notice: "", modal: null, busy: false};
    const modelChoices = providers(semantic);
    const fields = (draft, list) => fieldRows(displayDraft(draft), list.map(item => item[2] === "select" && item.length < 5 ? [...item, modelChoices] : item));
    const actionButton = (label, name, id, danger = false) => uiActionButton(label, name, {small:true, danger, dataKey:"data-item-action", extra:`data-item-id="${esc(id || "")}"`});
    const modalFields = draft => fieldRows(draft, [["name", "名称", "text"], ["description", "描述", "textarea"], ["visible_text", "图中文字", "textarea"], ["tags", "标签（逗号分隔）", "text"], ["emotions", "情绪（逗号分隔）", "text"], ["intents", "意图（逗号分隔）", "text"], ["enabled", "允许检索", "bool"]]);
    const draw = () => {
      const settings = state.semanticDraft, reactionSettings = state.reactionDraft, enabled = settings.reactions_enabled !== false;
      const collectionPrivate = settings.reactions_collection_private_enabled !== false, collectionGroup = settings.reactions_collection_group_enabled !== false;
      const sendFields = SEND_FIELDS.map(item => item[0] === "reactions_image_format" ? [item[0], item[1], item[2], qq ? item[3] : {image: "普通图片"}] : item);
      const semanticCard = card("语义目录", `<div class="ability-flag-grid">${flag(settings, "enabled", "启用语义目录")}${flag(settings, "memory_enabled", "启用记忆检索")}${group ? flag(settings, "slang_enabled", "群聊黑话目录") : ""}${flag(settings, "slang_learning", "自动学习")}</div>`);
      const modelCard = card("模型绑定", `<div class="ability-form">${fields(settings, MODELS)}</div>${more(fields(settings, MODEL_MORE), "模型超时与索引批次")}`);
      const slangCard = group ? card("群聊黑话", `<div class="ability-flag-grid">${flag(settings, "slang_enabled", "启用黑话目录")}${flag(settings, "slang_learning", "自动学习黑话")}</div>${settings.slang_enabled ? more(flag(settings, "slang_web_search_enabled", "联网参考黑话") + (settings.slang_web_search_enabled ? fields(settings, SLANG_MORE) : ""), "联网参考与整理") : ""}`) : "";
      const collection = flag(settings, "reactions_collection_private_enabled", "从私聊自动收录") + (collectionPrivate ? fields(settings, COLLECTION_FIELDS.slice(0, 1)) : "") + (group ? flag(settings, "reactions_collection_group_enabled", "从群聊自动收录") + (collectionGroup ? fields(settings, COLLECTION_FIELDS.slice(1)) : "") : "");
      const reactionCard = card("表情表达", `<div class="ability-flag-grid">${flag(settings, "reactions_enabled", "启用表情包表达")}${flag(settings, "reactions_private_enabled", "私聊使用表情包")}${group ? flag(settings, "reactions_group_enabled", "群聊使用表情包") : ""}${flag(settings, "reactions_proactive_enabled", "主动表情")}</div>${enabled ? more(collection + fields(settings, sendFields), "收录与发送方式") : empty("表情包表达已关闭")}`);
      const mode = settings.vision_review ? reactionSettings.vision_verify_mode || "embedding" : "off";
      const visionCard = card("识图复核", `${flag(settings, "vision_review", "启用识图复核")}${settings.vision_review ? fieldRows({...reactionSettings, vision_verify_mode: mode}, [VISION_MODE]) : ""}`);
      const boundaryCard = advancedCard("表情检索边界", `${fields(reactionSettings, BOUNDARY_FIELDS)}${fieldRows(reactionSettings, [VISION_MODE])}`);
      const visibleItems = state.items.filter(item => !state.query || JSON.stringify(item).toLowerCase().includes(state.query.toLowerCase()));
      const catalog = visibleItems.length ? `<div class="ability-material-grid">${visibleItems.map(item => `<article class="ability-material"><div class="ability-material-image">${itemImage(item) ? `<img src="${esc(itemImage(item))}" alt="" loading="lazy">` : "<span>语义</span>"}</div><strong>${esc(itemTitle(item))}</strong><small>${esc(item.kind || "reaction")} · ${item.enabled === false ? "已停用" : "可检索"}</small><div>${actionButton("编辑", "edit", item.id)}${actionButton("补全", "analyze", item.id)}${actionButton("删除", "delete", item.id, true)}</div></article>`).join("")}</div>` : empty(state.items.length ? "没有匹配的素材" : "暂无语义素材；可从这里导入");
      const catalogCard = card("表情素材库", `<div class="ability-toolbar"><div class="ability-search"><input class="ui-input" data-catalog-query value="${esc(state.query)}" placeholder="搜索素材" aria-label="搜索素材"><button type="button" class="ability-button" data-catalog-search>检索</button></div><label class="ability-button is-primary ability-file-label">导入素材<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" data-catalog-file hidden></label>${state.semanticDraft.selection_ready !== false ? '<button type="button" class="ability-button" data-reindex>重建索引</button>' : ""}</div>${catalog}`);
      const modal = state.modal ? `<div class="ability-modal-backdrop" data-modal-close><section class="ability-modal" role="dialog" aria-modal="true"><header><h2>编辑语义素材</h2><button type="button" class="ability-icon-button" data-modal-close>×</button></header><div class="ability-modal-body">${modalFields(state.modal)}</div><footer>${buttonBar('<button type="button" class="ability-button" data-modal-close>取消</button><button type="button" class="ability-button is-primary" data-item-save>保存</button>')}</footer></section></div>` : "";
      root.innerHTML = `<div class="page-stack">${state.notice ? `<div class="ability-notice">${esc(state.notice)}</div>` : ""}${semanticCard}${modelCard}${slangCard}${reactionCard}${visionCard}${boundaryCard}${catalogCard}${modal}${saveBar("semantic", {disabled: state.busy})}</div>`;
    };
    draw();
    const read = field => field.type === "number" ? Number(field.value || 0) : field.value;
    root.addEventListener("click", async event => {
      const close = event.target.closest("[data-modal-close]"); if (close) { state.modal = null; draw(); return; }
      const toggleNode = event.target.closest("[data-ui-toggle]");
      if (toggleNode) { const key = toggleNode.dataset.uiToggle, value = toggleNode.getAttribute("aria-checked") !== "true"; toggleNode.setAttribute("aria-checked", String(value)); toggleNode.classList.toggle("is-on", value); if (state.modal) state.modal[key] = value; else state.semanticDraft[key] = value; draw(); return; }
      const save = event.target.closest("[data-ui-save]");
      if (save) {
        const name = "semantic"; state.busy = true; setSaveState(root, name, "保存中");
        try {
          let result;
          result = await postAction(ctx, "semantic", {action: "configure", changes: state.semanticDraft, revision: semantic.revision}, "semantic-configure");
          await postChanges(ctx, configPath, state.reactionDraft, state.reactionToken, "reaction");
          state.semanticToken = tokenOf(result) || state.semanticToken; state.reactionToken = tokenOf(result) || state.reactionToken; setSaveState(root, name, "已保存", "ok"); state.notice = "配置已保存";
        } catch (_) { setSaveState(root, name, "保存失败", "error"); }
        state.busy = false; draw(); return;
      }
      if (event.target.closest("[data-reindex]")) { state.busy = true; try { await postAction(ctx, "semantic", {action: "reindex"}, "semantic-reindex"); state.notice = "已安排重建索引"; } catch (_) { state.notice = "重建索引未完成"; } state.busy = false; draw(); return; }
      if (event.target.closest("[data-catalog-search]")) { try { state.items = catalogItems(await postAction(ctx, "semantic", {action: "search", query: state.query, limit: 50}, "semantic-search")); state.notice = "检索完成"; } catch (_) { state.notice = "检索失败"; } draw(); return; }
      const itemButton = event.target.closest("[data-item-action]");
      if (itemButton) { const item = state.items.find(value => String(value.id) === String(itemButton.dataset.itemId)); if (!item) return; const operation = itemButton.dataset.itemAction; if (operation === "edit") { state.modal = {...(item.payload || item), id: item.id, revision: item.revision}; draw(); return; } if (operation === "delete" && !await confirmAction(`删除「${itemTitle(item)}」？`)) return; try { await postAction(ctx, "semantic", {action: operation, item_id: item.id, revision: item.revision}, `semantic-${operation}`); semantic = await ctx.api.get("semantic"); state.items = catalogItems(semantic); state.notice = operation === "delete" ? "素材已删除" : "素材已补全"; } catch (_) { state.notice = "操作未完成"; } draw(); return; }
      if (event.target.closest("[data-item-save]") && state.modal) { try { await postAction(ctx, "semantic", {action: "edit", item_id: state.modal.id, revision: state.modal.revision, updates: state.modal}, "semantic-edit"); state.modal = null; semantic = await ctx.api.get("semantic"); state.items = catalogItems(semantic); state.notice = "素材已保存"; } catch (_) { state.notice = "保存失败"; } draw(); }
    });
    root.addEventListener("input", event => { const field = event.target.closest("[data-ui-field]"); if (field) { const key = field.dataset.uiField, value = read(field); if (state.modal) state.modal[key] = value; else if (PERCENT_FIELDS.has(key)) state.semanticDraft[key] = FRACTION_OF(value); else if (key === MINUTES_FIELD) state.semanticDraft[key] = Math.round(Math.min(1440, Math.max(1, Number(value) || 1)) * 60); else if (BOUNDARY_FIELDS.some(item => item[0] === key) || key === "vision_verify_mode") state.reactionDraft[key] = value; else state.semanticDraft[key] = value; } if (event.target.matches("[data-catalog-query]")) state.query = event.target.value; });
    root.addEventListener("change", async event => { const input = event.target.closest("[data-catalog-file]"); if (!input?.files?.length) return; for (const file of [...input.files].slice(0, 20)) { const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.readAsDataURL(file); }); try { await postAction(ctx, "semantic", {action: "import", data, mime_type: file.type, metadata: {name: file.name}}, "semantic-import"); } catch (_) { state.notice = "部分素材导入失败"; } } semantic = await ctx.api.get("semantic"); state.items = catalogItems(semantic); draw(); });
  }
};
export default page;
