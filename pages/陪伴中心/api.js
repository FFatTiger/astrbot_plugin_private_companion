const PREFIX = "/astrbot_plugin_private_companion/";
let bridgePromise;

const problem = (code, message = code) => Object.assign(new Error(message), {code});
const relative = path => {
  if (typeof path !== "string") throw problem("invalid_path");
  const clean = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path.replace(/^\/+/, "");
  if (!clean || clean.split("/").some(part => !part || part === "." || part === "..")) throw problem("invalid_path");
  return clean;
};
const envelope = value => {
  const candidate = value?.status === "ok" || value?.status === "error" ? value
    : value?.data?.status === "ok" || value?.data?.status === "error" ? value.data : null;
  if (candidate?.status === "error") throw problem(candidate.data?.code || candidate.message || "request_failed", candidate.message || "request failed");
  let data = candidate ? candidate.data : value;
  if (data && !Array.isArray(data) && data.data && !data.status && Object.keys(data).length === 1) data = data.data;
  return data;
};

async function bridge() {
  if (window.CompanionMockApi) return window.CompanionMockApi;
  if (window.AstrBotPluginPage?.apiGet) return window.AstrBotPluginPage;
  if (!bridgePromise) {
    bridgePromise = new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window.AstrBotPluginPage?.apiGet) return resolve(window.AstrBotPluginPage);
        if (Date.now() - started > 12000) return reject(problem("bridge_unavailable", "无法连接"));
        setTimeout(tick, 60);
      };
      tick();
    });
  }
  return bridgePromise;
}

async function request(method, path, body, options = {}) {
  const transport = await bridge();
  const route = relative(path);
  if (transport.request) return envelope(await transport.request(method, route, body, options));
  const call = method === "GET" ? transport.apiGet(route, body, options) : transport.apiPost(route, body, options);
  // 宿主 bridge 拒绝时只把后端 message（即错误码）放进 Error.message，没有 code；补上，页面才能按码分支。
  return envelope(await call.catch(error => { throw error?.code ? error : Object.assign(error instanceof Error ? error : problem(String(error)), {code: /^[a-z][a-z0-9_]*$/.test(error?.message || "") ? error.message : "request_failed"}); }));
}

export const api = {
  get: (path, query) => request("GET", path, query),
  post: (path, body, options) => request("POST", path, body, options),
  relative,
  operationKey: prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  async directory() {
    try {
      const overview = await request("GET", "page/overview");
      const targets = overview?.targets || [];
      let accounts = null;
      try { accounts = await request("GET", "accounts"); } catch (_) {}
      return {...overview, targets, accounts, overview: true};
    } catch (_) {
      const targets = await request("GET", "page/targets");
      let accounts = null;
      try { accounts = await request("GET", "accounts"); } catch (_) {}
      return {targets, accounts, overview: false};
    }
  },
  async capabilities(target) {
    const role = target?.roles?.[0];
    if (!target?.target_id || !role?.role_id) return {};
    try { return await request("GET", "host/capabilities", {target_id: target.target_id, role_id: role.role_id}); } catch (_) { return {}; }
  },
  async readRole(role, scope = "role", configRole = null) {
    const reply = role?.reply_api;
    if (!reply) return {reply: {}, config: {}, participation: {}};
    const result = {reply: {}, config: {}, participation: {}};
    try { result.reply = await request("GET", reply); } catch (_) {}
    // 群角色没有 config_api，不能把 reply_api 改写成 /config：后端没有这个路由。
    // 群配置归「角色默认」，由调用方传入同样 role_id 但带 config_api 的私聊角色。
    const configPath = configRole?.config_api || role.config_api;
    if (configPath) {
      try {
        const config = await request("GET", configPath, {sections: "group_participation"});
        result.config = config?.sections?.group_participation || config;
      } catch (_) {}
    }
    if (scope === "group") {
      try { result.participation = await request("GET", `${reply}/participation`); } catch (_) {}
    }
    return result;
  },
  async saveReply(role, changes, editToken) {
    return request("POST", `${role.reply_api}/configure`, {operation_key: api.operationKey("reply"), edit_token: editToken, changes});
  },
  async saveConfig(role, changes, editToken, section = "group_participation", configRole = null) {
    const path = configRole?.config_api || role.config_api;
    if (!path) throw problem("config_unavailable", "当前对象没有配置接口");
    return request("POST", `${path}/configure`, {section, operation_key: api.operationKey("config"), edit_token: editToken, changes});
  },
  async saveGroupParticipation(role, changes, editToken) {
    return request("POST", `${role.reply_api}/participation/configure`, {operation_key: api.operationKey("group-participation"), edit_token: editToken, changes});
  },
};
export { relative, request };
