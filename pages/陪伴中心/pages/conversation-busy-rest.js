import {api, card, more, ensureConversationCss, readConfig, saveConfig, renderFields, syncDependencies, setupEditor, pathFor} from "./conversation-shared.js";
import {saveBar} from "../ui.js";

const yes = field => ({field, values:["true"]});
const busyCommon = [{name:"busy_reply_gate_enabled",label:"启用忙碌处理",type:"bool"},{name:"busy_activity_keywords",label:"忙碌活动关键词",showWhen:yes("busy_reply_gate_enabled")},{name:"busy_urgent_keywords",label:"紧急关键词",showWhen:yes("busy_reply_gate_enabled")}];
const busyMore = [{name:"busy_reply_min_delay_seconds",label:"私聊最短顺延",type:"number",unit:"秒",showWhen:yes("busy_reply_gate_enabled")},{name:"busy_reply_max_delay_seconds",label:"私聊最长顺延",type:"number",unit:"秒",showWhen:yes("busy_reply_gate_enabled")},{name:"busy_reply_proactive_resume_buffer_minutes",label:"主动联系恢复缓冲",type:"number",unit:"分钟",showWhen:yes("busy_reply_gate_enabled")},{name:"busy_exclude_keywords",label:"排除忙碌关键词",showWhen:yes("busy_reply_gate_enabled")}];
const lifeCommon = [{name:"enable_rest_reply_simulation",label:"启用休息时段回复判定",type:"bool"},{name:"rest_reply_mode",label:"判定方式",type:"select",showWhen:yes("enable_rest_reply_simulation")},{name:"enable_rest_backlog_reply",label:"记录休息期未回消息",type:"bool",showWhen:yes("enable_rest_reply_simulation")}];
const lifeMore = [{name:"rest_reply_probability",label:"概率判定放行率",type:"number",unit:"%",showWhen:{field:"rest_reply_mode",values:["probability"]}},{name:"rest_reply_llm_threshold",label:"模型判定放行分阈值",type:"number",showWhen:{field:"rest_reply_mode",values:["llm"]}},{name:"rest_reply_active_windows",label:"生效时段",showWhen:yes("enable_rest_reply_simulation")},{name:"rest_reply_awake_grace_minutes",label:"被唤醒后免重判",type:"number",unit:"分钟",showWhen:yes("enable_rest_reply_simulation")},{name:"rest_backlog_max_messages",label:"补看消息上限",type:"number",unit:"条",showWhen:yes("enable_rest_backlog_reply")}];
const defaults = {busy_reply_gate_enabled:true,busy_reply_min_delay_seconds:10,busy_reply_max_delay_seconds:60,busy_reply_proactive_resume_buffer_minutes:30,busy_activity_keywords:[],busy_exclude_keywords:[],busy_urgent_keywords:[],enable_rest_reply_simulation:true,rest_reply_mode:"probability",rest_reply_probability:60,rest_reply_llm_threshold:60,rest_reply_active_windows:"23:00-08:00",rest_reply_awake_grace_minutes:30,enable_rest_backlog_reply:true,rest_backlog_max_messages:20};
const merge = (busy,life) => ({...defaults,...(busy?.settings || busy || {}),...(life?.settings || life || {})});
const makeState = (draft,busy,life) => ({draft,base:{...draft},available:new Set([...Object.keys(busy?.settings || busy || {}),...Object.keys(life?.settings || life || {})]),busyToken:busy?.edit_token || "",lifeToken:life?.edit_token || "",dirty:false});

const page = {id:"conversation-busy-rest",section:"对话",title:"忙碌与休息",async render(root,ctx) {
  ensureConversationCss(); root.innerHTML = `<div class="page-loading">正在读取</div>`;
  if (!pathFor(ctx)) { root.innerHTML = `<div class="page-empty">当前对象没有可用的角色配置接口</div>`; return; }
  const [busy,life] = await Promise.all([readConfig(ctx,ctx.role,"busy_gate").catch(()=>({})),readConfig(ctx,ctx.role,"life").catch(()=>({}))]); const state = makeState(merge(busy,life),busy,life); state.readonly = !ctx.configEditable; state.onChange = () => syncDependencies(root,state.draft);
  root.innerHTML = `<div class="page-stack conversation-page" data-busy-root>${ctx.configEditable ? "" : `<p class="ui-hint">这些是角色默认设置，所有群共用；请把作用范围切到「角色默认」再修改。</p>`}${card("忙碌时的回复与主动联系",`${renderFields(state,busyCommon)}${more(renderFields(state,busyMore))}`,{meta:"角色设置"})}${card("休息时的回复与补看",`${renderFields(state,lifeCommon,{rest_reply_mode:{probability:"概率判定",llm:"模型判定"}})}${more(renderFields(state,lifeMore))}`,{meta:"角色设置"})}${saveBar("busy-rest",{disabled:true})}</div>`;
  syncDependencies(root,state.draft);
  setupEditor(root,state,"busy-rest",async()=>{
    const busyChanges={},lifeChanges={}; [...busyCommon,...busyMore,...lifeCommon,...lifeMore].forEach(spec=>{const name=spec.name;if(!state.available.has(name)||JSON.stringify(state.draft[name])===JSON.stringify(state.base[name]))return;(busyCommon.concat(busyMore).some(item=>item.name===name)?busyChanges:lifeChanges)[name]=state.draft[name];});
    if(Object.keys(busyChanges).length){const result=await saveConfig(ctx,ctx.role,"busy_gate",busyChanges,state.busyToken);state.busyToken=result?.edit_token||state.busyToken;}
    if(Object.keys(lifeChanges).length){const result=await saveConfig(ctx,ctx.role,"life",lifeChanges,state.lifeToken);state.lifeToken=result?.edit_token||state.lifeToken;}
  });
}};
export default page;
