// node --test pkg/audit-loupe/test/  (no extra packages; Node 20 or later)
// The v6 layout functions over a small made-up response (no lab names). The server cuts and
// judges the behaviours; these tests check only how the page lays them out and words them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  normalize, activityRows, actorsOpen, flipActor, findingsSections, trackMarks, behaviourSpan, titleText, headline, whatText,
  tagTexts, rangeText, viewFromQuery, queryFromView, listSig, apiParams, scopeActors, scopeGroups, identityGroups, identityRows,
  mergedGaps, stripBars, settingNote, defaultIdentity, defaultPlace, actorLabel, overlapsOf, summaryChips, parsePlace, placeKey, NOKEY
} from '../lib/v6.js';
import { textsV6 } from '../lib/v6text.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const D0 = Date.UTC(2026, 0, 1, 16); // 2026-01-02 00:00 at UTC+8
const MIN = 60000;
const CELL = 10 * MIN;
const at = (h, m = 0) => D0 + (h * 60 + m) * MIN;
const seg = (h, m, cells, ops) => ({
  fromMs: at(h, m), toMs: at(h, m) + cells * CELL, firstMs: at(h, m) + MIN, lastMs: at(h, m) + cells * CELL - 2 * MIN, ops
});
const zh = textsV6({ getters: { 'i18n/current': () => 'zh-hant' } });
const en = textsV6({ getters: { 'i18n/current': () => 'en-us' } });

const person = {
  key: 'u-1', name: 'alice', category: 'human', group: 'people', noteCode: 'rancher-local-user', note: '', dependsOn: null
};
const admin = {
  key: 'cert', name: 'system:admin', category: 'human', group: 'people', noteCode: 'admin-cert', dependsOn: null
};
const nobody = {
  key: '', name: '', category: 'unknown', group: 'unrecorded', noteCode: 'no-apiserver-audit', dependsOn: {
    code: 'no-apiserver-audit', cluster: 'c2', collectors: ['rancher', 'watch']
  }
};
const sa = {
  key: 'system:serviceaccount:apps:runner', name: 'system:serviceaccount:apps:runner', category: 'serviceaccount', group: 'routine', noteCode: 'sa-workload'
};

const RES = {
  day:        '2026-01-02',
  tz:         'Asia/Taipei',
  dayStartMs: D0,
  dayEndMs:   D0 + 864e5,
  settings:   { cellMinutes: 10, joinMinutes: 60 },
  summary:    {
    behaviors: 5,
    byTier:    {
      look: 1, notable: 1, normal: 1, unrecorded: 1, unauthenticated: 0, routine: 1
    },
    look:     [{ id: 'b1', title: { verb: 'delete', kind: 'Namespace', name: 'demo' } }],
    longGaps: [],
  },
  hidden:    {
    system: 9, uiMaintenance: 1, requestOnly: 2, failed: 3, failedSystem: 4
  },
  gaps:      [
    {
      cluster: 'c1', collector: 'watch', fromMs: at(10), toMs: at(12), kind: 'heartbeat', reasonCode: 'collector-silent'
    },
    {
      cluster: 'c1', collector: 'file', fromMs: at(10, 1), toMs: at(13), kind: 'heartbeat', reasonCode: 'collector-silent'
    },
  ],
  behaviors: [
    {
      id: 'b1', cluster: 'c1', actor: admin, scope: 'demo', tier: 'look', title: {
        verb: 'delete', kind: 'Namespace', name: 'demo', t: at(8, 40), rule: 'namespace_deleted', severity: 'high'
      }, what: [{ verb: 'create', kind: 'Pod', count: 7 }, { verb: 'delete', kind: 'Pod', count: 7 }, { verb: 'delete', kind: 'Namespace', count: 1 }], segments: [seg(8, 0, 3, 14), seg(8, 40, 1, 1)], ops: 15, objects: 8, via: ['direct'], tags: ['direct', 'off-hours', 'bypassed-rancher'], rules: [{
        rule: 'namespace_deleted', severity: 'high', count: 1, tagOnly: false
      }, {
        rule: 'off_hours', severity: 'low', count: 15, tagOnly: true
      }], truncated: false
    },
    {
      id: 'b2', cluster: 'c1', actor: admin, scope: 'apps', tier: 'notable', title: {
        verb: 'portforward', kind: 'Pod', name: 'web-1', t: at(6, 36)
      }, what: [{ verb: 'portforward', kind: 'Pod', count: 31 }], segments: [seg(6, 30, 2, 20), seg(7, 20, 1, 11)], ops: 31, objects: 1, via: ['direct'], tags: ['direct'], rules: [], truncated: false
    },
    {
      id: 'b3', cluster: 'c1', actor: person, scope: '', tier: 'normal', title: null, what: [{ verb: 'patch', kind: 'Node', count: 2 }], segments: [seg(9, 0, 1, 2)], ops: 2, objects: 1, via: ['rancher'], tags: ['via-rancher'], rules: [], truncated: false
    },
    {
      id: 'u~c2~kube-public~1', cluster: 'c2', actor: nobody, scope: 'kube-public', tier: 'unrecorded', title: null, what: [{ verb: 'modified', kind: 'ConfigMap', count: 4 }], segments: [seg(1, 0, 1, 4)], ops: 4, objects: 1, via: ['unknown'], tags: [], rules: [], truncated: false
    },
    {
      id: 'b5', cluster: 'c1', actor: sa, scope: 'apps', tier: 'routine', title: null, what: [{ verb: 'update', kind: 'Lease', count: 600 }], segments: [seg(0, 0, 144, 600)], ops: 600, objects: 1, via: ['direct'], tags: [], rules: [], truncated: true
    },
  ],
  actors: [
    {
      ...admin, clusters: ['c1'], behaviors: 2, ops: 46, look: 1
    },
    {
      ...person, clusters: ['c1'], behaviors: 1, ops: 2, look: 0
    },
    {
      ...nobody, clusters: ['c2'], behaviors: 1, ops: 4, look: 0
    },
    {
      ...sa, clusters: ['c1'], behaviors: 1, ops: 600, look: 0
    },
  ],
  scopes: [
    {
      cluster: 'c1', scope: 'demo', actors: 1, behaviors: 1, ops: 15, look: 1, tier: 'look'
    },
    {
      cluster: 'c1', scope: 'apps', actors: 2, behaviors: 2, ops: 631, look: 0, tier: 'notable'
    },
    {
      cluster: 'c2', scope: 'kube-public', actors: 1, behaviors: 1, ops: 4, look: 0, tier: 'unrecorded'
    },
  ],
  strip: {
    cellMinutes: 10, cells: [{
      t: at(8), people: 9, routine: 4, unrecorded: 0, unauthenticated: 0
    }, {
      t: at(9), people: 0, routine: 1, unrecorded: 0, unauthenticated: 0
    }, {
      t: at(11), people: 0, routine: 0, unrecorded: 0, unauthenticated: 0
    }]
  },
  overlaps: [{
    actors: ['u-1', 'cert'], cells: 1, fromMs: at(9), toMs: at(9, 10)
  }],
  selected: 'b1',
  detail:   null,
};

const M = normalize(RES);
const L = M.behaviours;
const byId = (id) => L.find((b) => b.id === id);

test('values the server did not send stay empty, never guessed', () => {
  const b = normalize({ behaviors: [{ id: 7, segments: [] }] }).behaviours[0];

  assert.equal(b.id, '7');
  assert.equal(b.tier, null);
  assert.equal(b.ops, null);
  assert.equal(b.objects, null);
  assert.equal(b.firstMs, null);
  assert.equal(b.actor.group, 'people', 'an actor without a group is shown, not hidden');
  assert.equal(rangeText(b, 'Asia/Taipei'), null);
  assert.equal(behaviourSpan(b), null);
});

test('activity: people open per target namespace, the other groups one merged line per cluster', () => {
  const rows = activityRows(L, { groups: ['people'], actors: actorsOpen(viewFromQuery({}), L) });

  assert.deepEqual(rows.map((r) => r.type), ['group', 'actor', 'sub', 'sub', 'actor', 'sub', 'group', 'merged', 'group', 'merged']);
  const first = rows[1];

  assert.equal(first.actorKey, 'cert', 'the account with the most serious behaviour first');
  assert.deepEqual(rows.slice(2, 4).map((r) => r.scope), ['demo', 'apps'], 'its worst namespace first');
  assert.equal(rows[0].ops, 48);
  assert.equal(rows[0].behaviours, 3);
  assert.equal(rows[0].actors, 2);
  assert.equal(rows[7].cluster, 'c2');
  assert.equal(rows[9].behaviours[0].id, 'b5');
});

test('activity: an opened group lists its accounts closed; a flipped account opens or closes', () => {
  const v = viewFromQuery({ open: 'people,routine', flip: 'cert' });
  const rows = activityRows(L, { groups: v.open, actors: actorsOpen(v, L) });
  const cert = rows.find((r) => r.key === 'a|cert|c1');
  const runner = rows.find((r) => r.actorKey === sa.key);

  assert.equal(cert.open, false);
  assert.deepEqual(cert.behaviours.map((b) => b.id), ['b2', 'b1'], 'a closed account shows all its behaviours on its own line');
  assert.equal(runner.open, false);
  assert.equal(rows.filter((r) => r.type === 'merged').length, 1, 'only the unrecorded group stays merged');
  assert.deepEqual(flipActor(v, 'cert'), []);
  assert.deepEqual(flipActor(v, 'u-1'), ['cert', 'u-1']);
});

test('findings: look and worth knowing open, the rest closed; no system section unless listed', () => {
  const s = findingsSections(L);

  assert.deepEqual(s.map((x) => x.tier), ['look', 'notable', 'normal', 'unrecorded', 'unauthenticated', 'routine']);
  assert.deepEqual(s.filter((x) => x.open).map((x) => x.tier), ['look', 'notable']);
  assert.equal(s.find((x) => x.tier === 'unauthenticated').items.length, 0);
  assert.deepEqual(findingsSections(L, ['routine']).filter((x) => x.open).map((x) => x.tier), ['routine']);
});

test('blocks and dashed links sit where the server put the parts', () => {
  const { blocks, dashes } = trackMarks(byId('b1'), D0, 864e5);
  const p = (h, m) => ((h * 60 + m) / 1440) * 100;

  assert.equal(blocks.length, 2);
  assert.ok(Math.abs(blocks[0].left - p(8, 0)) < 1e-9);
  assert.ok(Math.abs(blocks[0].width - (p(8, 30) - p(8, 0))) < 1e-9);
  assert.equal(dashes.length, 1);
  assert.ok(Math.abs(dashes[0].left - p(8, 30)) < 1e-9);
  assert.ok(Math.abs(dashes[0].width - (p(8, 40) - p(8, 30))) < 1e-9);
  assert.deepEqual(behaviourSpan(byId('b1')), [at(8), at(8, 50)]);
  assert.equal(trackMarks(byId('b5'), D0, 864e5).blocks[0].width, 100);
});

test('titles name the actual action; without one the title is where and what', () => {
  assert.equal(titleText(zh, byId('b1').title), '刪除 Namespace demo');
  assert.equal(titleText(zh, byId('b2').title), '轉送連接埠 Pod web-1', 'a port-forward is not called exec');
  assert.equal(titleText(en, byId('b2').title), 'port-forward Pod web-1');
  assert.equal(headline(zh, byId('b3')), '叢集範圍：修改 Node ×2');
  assert.equal(whatText(zh, byId('b1').what, 2), '新增 Pod ×7、刪除 Pod ×7 等 3 種');
  assert.equal(headline(zh, byId('u~c2~kube-public~1')), 'kube-public：有變化 ConfigMap ×4');
});

test('labels: a bypass is said once, as the route', () => {
  assert.deepEqual(tagTexts(zh, byId('b1')), ['直連 apiserver', '非上班時間']);
  assert.deepEqual(tagTexts(en, byId('b3')), ['Through Rancher']);
});

test('the unrecorded actor: its own name, never "no author found", and the setting it depends on', () => {
  const b = byId('u~c2~kube-public~1');

  assert.equal(actorLabel(zh, b.actor), '未記錄執行者');
  assert.equal(actorLabel(en, b.actor), 'Author not recorded');
  assert.deepEqual(settingNote(b.actor), { code: 'no-apiserver-audit', cluster: 'c2', collectors: ['rancher', 'watch'] });
  assert.equal(settingNote(byId('b1').actor), null);
  assert.equal(zh.dependsAudit('c2'), '取決於設定：c2 未啟用 apiserver audit log');
  assert.equal(zh.note['no-actor'], '未記錄執行者');
  assert.equal(actorLabel(zh, sa), 'runner');
});

test('"no author found" appears nowhere in the v6 page', () => {
  const files = [
    path.join(here, '../lib/v6.js'), path.join(here, '../lib/v6text.js'), path.join(here, '../pages/ChangeMapV6.vue'),
    ...readdirSync(path.join(here, '../components/v6')).map((f) => path.join(here, '../components/v6', f)),
  ];

  for (const f of files) {
    const src = readFileSync(f, 'utf8');

    assert.ok(!src.includes('找不到執行者'), f);
    assert.ok(!/No author found/i.test(src), f);
  }
  assert.equal(zh.noActor, '未記錄執行者');
});

test('identities and scopes take the server\'s lists', () => {
  assert.deepEqual(identityGroups(M.actors).map((g) => g.group), ['people', 'unrecorded', 'routine']);
  assert.equal(defaultIdentity(L), 'cert');
  assert.deepEqual(identityRows(L, 'cert').map((r) => r.scope), ['demo', 'apps']);
  assert.deepEqual(scopeGroups(M.scopes).map((g) => [g.cluster, g.items.map((x) => x.key)]), [['c1', ['c1/demo', 'c1/apps']], ['c2', ['c2/kube-public']]]);
  assert.equal(defaultPlace(L), 'c1/demo');
  assert.deepEqual(parsePlace(placeKey('c1', '')), { cluster: 'c1', scope: '' });
});

test('scopes: one line per account, its counts added up, the worst first', () => {
  const a = scopeActors(L, 'c1/apps');

  assert.deepEqual(a.map((x) => x.actorKey), ['cert', sa.key]);
  assert.equal(a[0].ops, 31);
  assert.equal(a[0].head.id, 'b2');
  assert.equal(a[1].head, null);
  assert.equal(a[1].what[0].count, 600);
});

test('gaps of one cluster merge for drawing and keep their collectors', () => {
  assert.deepEqual(mergedGaps(M.gaps, 'c1'), [{
    cluster: 'c1', fromMs: at(10), toMs: at(13), collectors: ['watch', 'file']
  }]);
  assert.deepEqual(mergedGaps(M.gaps, 'c2'), []);
});

test('the strip: only cells with operations; people never taller than the cell', () => {
  const bars = stripBars(M.strip);

  assert.equal(bars.length, 2);
  assert.equal(bars[0].hTotal, 100);
  assert.ok(bars[0].hPeople < bars[0].hTotal);
  assert.equal(bars[1].hPeople, 0);
  assert.deepEqual(stripBars(null), []);
});

test('overlap hints name the other account and never claim one person', () => {
  assert.deepEqual(overlapsOf(M.overlaps, 'cert'), [{
    other: 'u-1', cells: 1, fromMs: at(9), toMs: at(9, 10)
  }]);
  assert.match(zh.overlap('alice', '09:00', '09:10', 1), /無法確認是否同一人/);
});

test('summary chips are the server\'s counts, in tier order', () => {
  assert.deepEqual(summaryChips(M.summary).map((c) => [c.tier, c.count]), [['look', 1], ['notable', 1], ['normal', 1], ['unrecorded', 1], ['unauthenticated', 0], ['routine', 1]]);
  assert.equal(summaryChips(null)[0].count, null);
});

test('the URL keeps the whole view; picking a behaviour alone does not reload the list', () => {
  const v = viewFromQuery({
    day: '2026-01-02', tab: 'scopes', cluster: ['c1', 'c2'], select: 'b2', place: 'c1/apps', open: 'people,unrecorded', flip: `cert,${ NOKEY }`, show: 'look,routine'
  });

  assert.deepEqual(viewFromQuery(queryFromView(v)), v);
  assert.deepEqual(v.flip, ['cert', '']);
  assert.equal(listSig(v), listSig({ ...v, select: 'b1', tab: 'activity' }));
  assert.notEqual(listSig(v), listSig({ ...v, system: true }));
  assert.equal(apiParams(v).get('select'), 'b2');
  assert.deepEqual(apiParams(v).getAll('cluster'), ['c1', 'c2']);
  assert.deepEqual(queryFromView(viewFromQuery({ day: '2026-01-02' })), { day: '2026-01-02', tab: 'activity' });
  assert.equal(viewFromQuery({ tab: 'overview' }).tab, 'activity', 'old v5 tab names fall back to the first tab');
});

test('times are the first and last operation, in the server time zone', () => {
  assert.equal(rangeText(byId('b1'), 'Asia/Taipei'), '08:01–08:48');
  assert.equal(rangeText(byId('b3'), 'Asia/Taipei'), '09:01–09:08');
});
