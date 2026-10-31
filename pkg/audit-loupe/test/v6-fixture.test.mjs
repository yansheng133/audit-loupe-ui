// node --test pkg/audit-loupe/test/  (no extra packages; Node 20 or later)
// Checks the v6 layout over a real /api/behaviors response kept OUTSIDE the repo (it holds lab
// names). Set AL_V6_FIXTURE to its path; without it these tests are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  normalize, activityRows, actorsOpen, findingsSections, viewFromQuery, identityGroups, scopeGroups, scopeActors, identityRows, trackMarks, headline, actorLabel, stripBars, GROUPS
} from '../lib/v6.js';
import { textsV6 } from '../lib/v6text.js';

const file = process.env.AL_V6_FIXTURE;
const skip = !file || !existsSync(file) ? 'AL_V6_FIXTURE not set' : false;
const load = () => normalize(JSON.parse(readFileSync(file, 'utf8')));
const zh = textsV6({ getters: { 'i18n/current': () => 'zh-hant' } });

test('every behaviour lands in exactly one activity lane, and the counts add up to the server\'s', { skip }, () => {
  const M = load();
  const rows = activityRows(M.behaviours, { groups: GROUPS, actors: Object.fromEntries(M.behaviours.map((b) => [b.actor.id, true])) });
  const seen = rows.filter((r) => r.type === 'sub').flatMap((r) => r.behaviours.map((b) => b.id));

  assert.equal(seen.length, M.behaviours.length);
  assert.equal(new Set(seen).size, seen.length);
  assert.equal(M.behaviours.filter((b) => b.tier !== 'system').length, M.summary.behaviors);
  for (const [t, n] of Object.entries(M.summary.byTier)) {
    assert.equal(M.behaviours.filter((b) => b.tier === t).length, n, t);
  }
  const closed = activityRows(M.behaviours, { groups: ['people'], actors: actorsOpen(viewFromQuery({}), M.behaviours) });

  assert.ok(closed.filter((r) => r.type === 'merged').every((r) => r.group !== 'people'), 'only the other groups are merged by default');
});

test('red only for "look"; label-only rules never make a behaviour look or worth knowing', { skip }, () => {
  const M = load();

  for (const b of M.behaviours) {
    if (b.tier === 'look' || b.tier === 'notable') {
      assert.ok(b.rules.some((r) => !r.tagOnly), `${ b.id } is ${ b.tier } with only label rules`);
      assert.ok(b.title, `${ b.id } has no title`);
    }
    if (['routine', 'unrecorded', 'unauthenticated'].includes(b.tier)) {
      assert.ok(!['look', 'notable'].includes(b.tier));
    }
  }
});

test('parts: in order, within the day, never more than the join limit apart', { skip }, () => {
  const M = load();
  const join = (M.settings?.joinMinutes ?? 60) * 60000;
  const cell = (M.settings?.cellMinutes ?? 10) * 60000;

  for (const b of M.behaviours) {
    b.segments.forEach((s, i) => {
      assert.ok(s.fromMs < s.toMs, b.id);
      if (i) {
        const p = b.segments[i - 1];

        assert.ok(s.fromMs > p.toMs - 1, `${ b.id } parts overlap`);
        assert.ok(s.firstMs - p.lastMs <= join, `${ b.id } parts ${ s.firstMs - p.lastMs } ms apart`);
        assert.ok(s.fromMs - p.toMs >= cell, `${ b.id } parts are adjacent cells`);
      }
    });
    const m = trackMarks(b, M.dayStartMs, M.dayEndMs - M.dayStartMs);

    assert.ok(m.blocks.every((k) => k.left >= 0 && k.left + k.width <= 100.0001), b.id);
  }
});

test('no behaviour crosses the start of a collection gap of its cluster', { skip }, () => {
  const M = load();

  for (const b of M.behaviours) {
    // Crossing = an operation at or before the gap's start and one after it (contract: a gap
    // cuts where it starts; operations inside it still join). Open gaps do not cut yet.
    for (const g of M.gaps.filter((x) => x.cluster === b.cluster && !x.open)) {
      assert.ok(!(b.firstMs <= g.fromMs && g.fromMs < b.lastMs), `${ b.id } spans the gap starting ${ g.fromMs }`);
    }
  }
});

test('every account and namespace the server lists can be opened, and has words', { skip }, () => {
  const M = load();

  for (const g of identityGroups(M.actors)) {
    for (const a of g.items) {
      assert.ok(identityRows(M.behaviours, a.id).length, `account ${ a.id } has no lanes`);
      assert.ok(actorLabel(zh, a) !== zh.tbc || a.key === '', a.key);
    }
  }
  for (const g of scopeGroups(M.scopes)) {
    for (const s of g.items) {
      assert.ok(scopeActors(M.behaviours, s.key).length, `namespace ${ s.key } has no accounts`);
    }
  }
  for (const b of M.behaviours) {
    const h = headline(zh, b);

    assert.ok(h && !h.includes('undefined') && !h.includes('找不到執行者'), `${ b.id }: ${ h }`);
  }
  assert.ok(stripBars(M.strip).length > 0);
  assert.equal(findingsSections(M.behaviours).reduce((n, s) => n + s.items.length, 0), M.behaviours.length);
});
