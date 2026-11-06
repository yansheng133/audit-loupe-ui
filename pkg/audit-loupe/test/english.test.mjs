// node --test pkg/audit-loupe/test/english.test.mjs: English wording that reads right, and the
// page's own language choice reaching every page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texts, plural, isZh } from '../lib/model.js';
import { textsV5 } from '../lib/v5.js';
import { textsV6 } from '../lib/v6text.js';
import { titleText, whatText } from '../lib/v6.js';
import { backendMessage } from '../lib/api.js';

const store = (l) => ({ getters: { 'i18n/current': () => l } });
const en = textsV6(store('en-us'));
const zh = textsV6(store('zh-hant'));
const cjk = /[　-〿・一-鿿＀-￯]/;

test('counts of one are singular', () => {
  assert.equal(plural(1, 'record'), '1 record');
  assert.equal(plural(2, 'record'), '2 records');
  assert.equal(en.summary(1), '1 activity this day. ');
  assert.equal(en.actorLine(1, 1), '1 activity · 1 operation');
  assert.equal(en.actorLine(2, 3), '2 activities · 3 operations');
  assert.equal(texts(store('en-us')).cov.chainOk(1), 'Chain intact (1 record checked)');
  assert.equal(texts(store('en-us')).recompute.eta(61), 'about 2 minutes');
  assert.equal(texts(store('en-us')).recompute.eta(60), 'about 1 minute');
});

test('a refused or failed headline says so', () => {
  assert.equal(titleText(en, { verb: 'login', kind: 'login', name: 'login', code: 401 }), 'Login failed');
  assert.equal(titleText(en, { verb: 'login', kind: 'login', name: 'login', code: 200 }), 'logged in');
  assert.equal(titleText(en, { verb: 'get', kind: 'Secret', name: 'db', code: 403 }), 'read Secret db, denied (403)');
  assert.equal(titleText(en, { verb: 'delete', kind: 'Pod', name: 'web', code: 500 }), 'deleted Pod web (failed, HTTP 500)');
  assert.equal(titleText(en, { verb: 'delete', kind: 'Namespace', name: 'shop', code: 200 }), 'deleted Namespace shop');
  assert.equal(titleText(zh, { verb: 'login', kind: 'login', name: 'login', code: 401 }), '登入失敗');
});

test('"and N more" counts what is left, not the total', () => {
  const what = ['a', 'b', 'c', 'd', 'e'].map((k) => ({ verb: 'update', kind: k, count: 1 }));

  assert.equal(whatText(en, what, 3), 'updated a ×1, updated b ×1, updated c ×1 and 2 more');
});

test('an ended session is not told to ask for permission', () => {
  const e = Object.assign(new Error('HTTP 401'), { status: 401 });

  assert.match(backendMessage(texts(store('en-us')), e), /session has ended/);
  assert.match(backendMessage(textsV5(store('en-us')), e), /session has ended/);
  assert.doesNotMatch(backendMessage(texts(store('en-us')), e), /administrator/);
});

test('English tables carry no Chinese punctuation or text', () => {
  const walk = (o, at) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') {
        assert.doesNotMatch(v, cjk, `${ at }.${ k }`);
      } else if (typeof v === 'function') {
        const out = v(1, 2, 3, 4);

        if (typeof out === 'string') {
          assert.doesNotMatch(out, cjk, `${ at }.${ k }()`);
        }
      } else if (v && typeof v === 'object') {
        walk(v, `${ at }.${ k }`);
      }
    }
  };
  const allow = (t) => ({ ...t, lang: { ...t.lang, zh: '' } }); // the language menu names Chinese in Chinese

  walk(allow(en), 'v6');
  walk(textsV5(store('en-us')), 'v5');
  walk(texts(store('en-us')), 'model');
});

test('the page\'s own language choice wins over Rancher\'s, on every page', () => {
  const mem = {};

  globalThis.window = { localStorage: { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } } };
  try {
    assert.equal(isZh(store('zh-hant')), true);
    mem['audit-loupe.lang'] = 'en-us';
    assert.equal(isZh(store('zh-hant')), false);
    assert.equal(texts(store('zh-hant')).access.title, 'Access Review');
    assert.equal(textsV6(store('zh-hant')).zh, false);
    // An explicit choice passed in (the change map's menu) is used as is.
    assert.equal(textsV6(store('en-us'), 'zh-hant').zh, true);
  } finally {
    delete globalThis.window;
  }
});

test('a backend without title codes still marks a failed login and a 403', () => {
  assert.equal(titleText(en, { verb: 'login', kind: 'login', name: 'login', rule: 'login_failed' }), 'Login failed');
  assert.equal(titleText(en, { verb: 'get', kind: 'Secret', name: 'db', rule: 'forbidden' }), 'read Secret db, denied (403)');
  assert.equal(en.rangeLine('09:00', '10:00', 1, 0), 'Listing the activity that overlaps 09:00–10:00; the counts above cover the whole day.');
  assert.equal(en.summary(1234), '1,234 activities this day. ');
});

test('hidden-count line leaves out zero items and formats counts', () => {
  const h = {
    system: 0, uiMaintenance: 5, requestOnly: 1, failed: 2, failedSystem: 209
  };

  assert.equal(en.hiddenLine(h), 'Not listed as activities: 5 Rancher UI maintenance actions, 1 request that leaves no object, 2 failed requests (plus 209 from system components).');
  assert.equal(zh.hiddenLine(h), '沒有列成行為：Rancher 介面的維護動作 5 筆、不留下物件的請求 1 筆、失敗的請求 2 筆（系統元件另有 209 筆）');
  assert.equal(en.hiddenLine({ system: 1524, uiMaintenance: 0, requestOnly: 0, failed: 0, failedSystem: 0 }), 'Not listed as activities: 1,524 system component operations.');
  assert.equal(en.hiddenLine({ system: 0, uiMaintenance: 0, requestOnly: 0, failed: 0, failedSystem: 0 }), '');
  assert.match(whatText(en, [{ verb: 'update', kind: 'ConfigMap', count: 2591 }]), /×2,591/);
});

test('times on another day carry their date; one name for a missing actor', async() => {
  const { dayTime, dayStartMs } = await import('../lib/v5.js');
  const tz = 'Asia/Taipei';
  const d0 = dayStartMs('2026-11-06', tz);
  const dayMs = 864e5;
  const before = d0 - (11 * 60 - 3) * 60000; // 11/05 13:03

  assert.equal(dayTime(en, d0 + 45 * 60000, tz, d0, dayMs), '00:45');
  assert.equal(dayTime(en, before, tz, d0, dayMs), 'Nov 5, 13:03');
  assert.equal(dayTime(zh, before, tz, d0, dayMs), '11/5 13:03');
  assert.equal(dayTime(en, d0 + dayMs, tz, d0, dayMs), '24:00');
  assert.equal(dayTime(en, d0 + dayMs + 3600000, tz, d0, dayMs), 'Nov 7, 01:00');

  const v5en = textsV5(store('en-us'));
  const v5zh = textsV5(store('zh-hant'));

  assert.equal(v5en.noActor, en.groups.unrecorded);
  assert.equal(v5en.states.unclear, en.groups.unrecorded);
  assert.equal(texts(store('en-us')).access.unknown, en.groups.unrecorded);
  assert.equal(v5zh.noActor, zh.groups.unrecorded);
  assert.equal(texts(store('zh-hant')).access.unknown, zh.groups.unrecorded);
});

test('a title on its own starts with a capital in English only', async() => {
  const { asHeading } = await import('../lib/v6.js');

  assert.equal(asHeading(en, 'deleted Namespace shop'), 'Deleted Namespace shop');
  assert.equal(asHeading(zh, '刪除 Namespace shop'), '刪除 Namespace shop');
  assert.equal(asHeading(en, ''), '');
});

test('a heading never changes a namespace name', async() => {
  const { heading } = await import('../lib/v6.js');
  const b = { scope: 'suse-observability-agent', title: null, what: [{ verb: 'modified', kind: 'ConfigMap', count: 2 }] };

  assert.match(heading(en, b), /^suse-observability-agent: /);
  assert.match(heading(en, { ...b, title: { verb: 'delete', kind: 'Namespace', name: 'shop', code: 200 } }), /^Deleted Namespace shop/);
});

test('only an Audit Loupe 404 means an old backend; Kubernetes or Rancher 404s mean none', async() => {
  const { isOldBackend } = await import('../lib/v6.js');

  assert.equal(isOldBackend({ status: 404, body: null }), true);
  assert.equal(isOldBackend({ status: 404, body: { kind: 'Status', code: 404 } }), false);
  assert.equal(isOldBackend({ status: 404, body: { Code: { Code: 'NotFound', Status: 404 }, Message: 'clusters.management.cattle.io "x" not found' } }), false);
  assert.equal(isOldBackend({ status: 500, body: null }), false);
});
