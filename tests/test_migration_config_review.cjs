const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../pages/陪伴小屋/migration-config-table.js'), 'utf8');
function review(rows) {
  const sandbox = {window: {CompanionConfigEditors: {searchEntries: () => [
    {group: 'proactive.contact', field: 'enabled', label: '主动联系'},
  ]}}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../pages/陪伴小屋/migration-config-review.js'), 'utf8'), sandbox);
  vm.runInNewContext(source, sandbox);
  const api = sandbox.window.CompanionMigrationConfiguration;
  api.update({plan_token: 'plan-a', configuration_review: {version: 1, rows}});
  return api;
}
const row = (id, status = 'merge', extra = {}) => ({id, selection_id: id, selection_unit: id,
  field: 'proactive.contact.enabled', status, before: true, after: false, current_known: true, ...extra});

test('comparisons show real values and per-row choices determine the submitted selection', () => {
  const api = review([row('switch'), row('interval', 'merge', {field: 'proactive.contact.interval_seconds', before: 600, after: 900})]);
  assert.match(api.render(), /主动联系/);
  assert.match(api.render(), /旧版 → 当前/);
  assert.match(api.render(), /600/);
  api.click({migrationConfigAction: 'choose', row: 'switch', choice: 'keep'});
  assert.deepEqual([...api.selection()], ['interval']);
  assert.deepEqual({...api.stats()}, {total: 2, pending: 0, merge: 1, keep: 1, archive: 0, deferred: 0});
});

test('batch choices leave required confirmations pending and connected settings move together', () => {
  const api = review([row('ordinary'), row('credential', 'confirm', {selection_unit: 'connection'}),
    row('endpoint', 'confirm', {selection_unit: 'connection'})]);
  api.click({migrationConfigAction: 'bulk', group: 'life', choice: 'keep'});
  assert.equal(api.stats().pending, 2);
  api.click({migrationConfigAction: 'choose', row: 'credential', choice: 'keep'});
  assert.equal(api.stats().pending, 0);
  assert.equal(api.selection().length, 0);
  api.click({migrationConfigAction: 'reset'});
  assert.equal(api.stats().pending, 2);
  assert.deepEqual([...api.selection()], ['ordinary']);
});

test('search and filters narrow the real rows and empty states remain actionable', () => {
  const api = review([row('one'), row('two', 'confirm', {field: 'image.output.backend', label: '图片生成', before: 'comfyui'})]);
  api.search('comfyui');
  assert.match(api.render(), /图片生成/);
  assert.doesNotMatch(api.render(), /scope="row" class="migration-config-field"><strong>主动联系/);
  api.click({migrationConfigAction: 'filter', filter: 'merge'});
  assert.match(api.render(), /没有匹配的配置/);
  api.search('<script>');
  assert.doesNotMatch(api.render(), /value="<script>/);
});

test('unsupported settings can be deferred without becoming writable', () => {
  const api = review([{id: 'unavailable', field: 'reality.camera', label: '摄像头授权', status: 'manual', note: '请重新授权'}]);
  assert.equal(api.stats().pending, 0);
  api.click({migrationConfigAction: 'choose', row: 'unavailable', choice: 'merge'});
  assert.equal(api.stats().pending, 0);
  api.click({migrationConfigAction: 'choose', row: 'unavailable', choice: 'keep'});
  assert.equal(api.stats().deferred, 1);
  assert.equal(api.selection().length, 0);
  assert.match(api.render(), /已选稍后设置/);
});

test('choices survive equivalent refreshes and reset when the reviewed source changes', () => {
  const api = review([row('one')]);
  api.click({migrationConfigAction: 'choose', row: 'one', choice: 'keep'});
  api.update({plan_token: 'plan-a', configuration_review: {version: 1, rows: [row('one')]}});
  assert.equal(api.selection().length, 0);
  api.update({plan_token: 'plan-b', configuration_review: {version: 1, rows: [row('one')]}});
  assert.deepEqual([...api.selection()], ['one']);
});

test('audited limitations do not become confirmations and supported settings retain their editor', () => {
  const api = review([
    {id: 'unsupported', field: 'reactive_poke_config.reactive_poke_back_prompts', source_key: 'reactive_poke_config.reactive_poke_back_prompts', audit: true, status: 'manual'},
    {id: 'settings', field: 'model_assignment_config.FAST_RESPONSE_PROVIDER_ID', source_key: 'model_assignment_config.FAST_RESPONSE_PROVIDER_ID', audit: true, status: 'manual'},
  ]);
  assert.equal(api.stats().pending, 0);
  assert.match(api.render(), /暂不支持/);
  assert.match(api.render(), /data-setup-legacy-settings="models"/);
  api.click({migrationConfigAction: 'choose', row: 'settings', choice: 'keep'});
  assert.equal(api.stats().pending, 0);
  assert.equal(api.selection().length, 0);
});

test('large configuration lists paginate while batch changes cover the filtered group', () => {
  const api = review(Array.from({length: 85}, (_, index) => row(String(index))));
  assert.match(api.render(), /第 1 \/ 3 页/);
  api.click({migrationConfigAction: 'bulk', group: 'life', choice: 'keep'});
  assert.equal(api.stats().keep, 85);
  api.click({migrationConfigAction: 'page', direction: '1'});
  assert.match(api.render(), /第 2 \/ 3 页/);
});
