// node --test pkg/audit-loupe/test/  (no extra packages; Node 20 or later)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailParams } from '../lib/v5.js';

const v = { day: '2026-10-20', system: false, from: null, to: null };

test('the detail asks for the same time range as the list', () => {
  const p = detailParams({ ...v, from: 1000, to: 2000 }, 'c1//configmaps/app/cfg');

  assert.equal(p.get('from'), '1000');
  assert.equal(p.get('to'), '2000');
  assert.equal(p.get('key'), 'c1//configmaps/app/cfg');
});

test('without a range the detail is the whole day', () => {
  const p = detailParams({ ...v, system: true }, 'k');

  assert.equal(p.get('day'), '2026-10-20');
  assert.equal(p.get('system'), '1');
  assert.equal(p.has('from'), false);
  assert.equal(p.has('to'), false);
});
