window.CompanionMockLive = {
  targets() {
    const role = targetId => ({
      role_id: "role-wxid_bot_demo",
      role_name: "xiaojingyu_wechat",
      reply_api: `/astrbot_plugin_private_companion/host/targets/${targetId}/roles/a51ebcd54eac33e9661b77ac95f5e720e0ed2bd3fe44b9447b404fcc89f7869a/reply`,
      config_api: targetId.startsWith("group-") ? null : `/astrbot_plugin_private_companion/host/targets/${targetId}/roles/a51ebcd54eac33e9661b77ac95f5e720e0ed2bd3fe44b9447b404fcc89f7869a/config`,
      memory_api: targetId.startsWith("group-") ? null : `/astrbot_plugin_private_companion/host/targets/${targetId}/roles/a51ebcd54eac33e9661b77ac95f5e720e0ed2bd3fe44b9447b404fcc89f7869a/memory`,
      state_api: targetId.startsWith("group-") ? null : `/astrbot_plugin_private_companion/host/targets/${targetId}/roles/a51ebcd54eac33e9661b77ac95f5e720e0ed2bd3fe44b9447b404fcc89f7869a/state`,
      life_api: targetId.startsWith("group-") ? null : `/astrbot_plugin_private_companion/host/targets/${targetId}/roles/a51ebcd54eac33e9661b77ac95f5e720e0ed2bd3fe44b9447b404fcc89f7869a/life`,
      relationships_api: targetId.startsWith("group-") ? null : `/astrbot_plugin_private_companion/host/targets/${targetId}/roles/a51ebcd54eac33e9661b77ac95f5e720e0ed2bd3fe44b9447b404fcc89f7869a/relationships`,
      growth_api: targetId.startsWith("group-") ? null : `/astrbot_plugin_private_companion/host/targets/${targetId}/roles/a51ebcd54eac33e9661b77ac95f5e720e0ed2bd3fe44b9447b404fcc89f7869a/growth`
    });
    return [
      {target_id: "setup-core-wxid_bot_demo", scope_kind: "private", platform_id: "wechat_helper", account_id: "wxid_bot_demo", bot_id: "bot-wxid_bot_demo", participant_id: "wxid_owner_demo", group_id: null, display_name: "", group_name: null, account_name: "", roles: [role("setup-core-wxid_bot_demo")]},
      {target_id: "group-6915562ffc7dc742af87", scope_kind: "group", platform_id: "wechat_helper", account_id: "wxid_bot_demo", bot_id: "bot-wxid_bot_demo", participant_id: null, group_id: "10000000001@chatroom", display_name: "", group_name: "", account_name: "", roles: [role("group-6915562ffc7dc742af87")]},
      {target_id: "group-72615f0411230d2b70c6", scope_kind: "group", platform_id: "wechat_helper", account_id: "wxid_bot_demo", bot_id: "bot-wxid_bot_demo", participant_id: null, group_id: "10000000003@chatroom", display_name: "", group_name: "", account_name: "", roles: [role("group-72615f0411230d2b70c6")]},
      {target_id: "group-e9a8c1ed83a59a86400d", scope_kind: "group", platform_id: "wechat_helper", account_id: "wxid_bot_demo", bot_id: "bot-wxid_bot_demo", participant_id: null, group_id: "10000000002@chatroom", display_name: "", group_name: "", account_name: "", roles: [role("group-e9a8c1ed83a59a86400d")]}
    ];
  },
  reply() {
    return {
      group_wakeup_bot_name: "小鲸鱼",
      group_wakeup_direct_words: "[\"hcuu\", \"大肥鱼\"]",
      group_wakeup_context_words: {items: ["陪伴"]},
      group_wakeup_interest_keywords: "[\"设计\", \"电影\"]",
      group_wakeup_primary_member_ids: "[\"wxid_owner_demo\"]",
      group_wakeup_owner_direct_words: ["小鲸鱼"],
      group_conversation_followup_enabled: true,
      group_conversation_followup_seconds: 120,
      group_conversation_followup_max_turns: 999,
      private_debounce_enabled: true,
      private_debounce_max_ms: 4000
    };
  },
  accounts() {
    return {
      accounts: [],
      sessions: [
        {target_id: "setup-core-wxid_bot_demo", scope_kind: "private", display_name: "Proxy", group_name: ""},
        {target_id: "group-6915562ffc7dc742af87", scope_kind: "group", display_name: "Vibe", group_name: ""},
        {target_id: "group-72615f0411230d2b70c6", scope_kind: "group", display_name: "", group_name: "开黑群"},
        {target_id: "group-e9a8c1ed83a59a86400d", scope_kind: "group", display_name: "HCUUTEST", group_name: ""}
      ],
      discovered: {groups: []}
    };
  }
};
