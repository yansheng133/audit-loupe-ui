// node --test pkg/audit-loupe/test/  (no extra packages; Node 20 or later)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayLength, minuteAt, pickRange, barHeights, pctOf, DAY_MS
} from '../lib/timeline.js';

const D0 = Date.UTC(2026, 9, 19, 16); // 2026-10-20 00:00 Asia/Taipei
const MIN = 60000;
const SLOT = 10 * MIN;

test('a day is as long as the slots sent', () => {
  const tl = (n, m) => ({ slotMinutes: m, lines: [{ slots: new Array(n).fill({}) }] });

  assert.equal(dayLength(tl(144, 10)), DAY_MS);
  assert.equal(dayLength(tl(1440, 1)), DAY_MS);
  assert.equal(dayLength(tl(138, 10)), 23 * 3600000, 'the day the clocks go forward');
  assert.equal(dayLength(tl(150, 10)), 25 * 3600000, 'the day the clocks go back');
  assert.equal(dayLength(null), DAY_MS);
});

test('a click picks the slot under it', () => {
  const t = D0 + 15 * 3600000 + 27 * MIN; // 15:27

  assert.deepEqual(pickRange(t, t, D0, SLOT, DAY_MS), [D0 + 15 * 3600000 + 20 * MIN, D0 + 15 * 3600000 + 30 * MIN]);
  assert.deepEqual(pickRange(t, t + 4 * MIN, D0, SLOT, DAY_MS)[0], D0 + 15 * 3600000 + 20 * MIN, 'under 5 minutes is still a click');
});

test('a click at the very end picks the last slot, not one after the day', () => {
  assert.deepEqual(pickRange(D0 + DAY_MS, D0 + DAY_MS, D0, SLOT, DAY_MS), [D0 + DAY_MS - SLOT, D0 + DAY_MS]);
});

test('a drag snaps outwards to whole slots, either direction', () => {
  const a = D0 + 14 * 3600000 + 52 * MIN; // 14:52
  const b = D0 + 16 * 3600000 + 22 * MIN; // 16:22
  const want = [D0 + 14 * 3600000 + 50 * MIN, D0 + 16 * 3600000 + 30 * MIN];

  assert.deepEqual(pickRange(a, b, D0, SLOT, DAY_MS), want);
  assert.deepEqual(pickRange(b, a, D0, SLOT, DAY_MS), want);
  assert.deepEqual(pickRange(D0 + 23 * 3600000, D0 + DAY_MS, D0, SLOT, DAY_MS)[1], D0 + DAY_MS, 'never past the day');
  assert.deepEqual(pickRange(D0 + 20 * MIN, D0 + 30 * MIN, D0, SLOT, DAY_MS), [D0 + 20 * MIN, D0 + 30 * MIN], 'already on slot edges');
});

test('the minute under the pointer, clamped to the track', () => {
  assert.equal(minuteAt(0, D0, DAY_MS), D0);
  assert.equal(minuteAt(1, D0, DAY_MS), D0 + DAY_MS);
  assert.equal(minuteAt(1.5, D0, DAY_MS), D0 + DAY_MS);
  assert.equal(minuteAt(-0.2, D0, DAY_MS), D0);
  assert.equal(minuteAt(0.5, D0, DAY_MS), D0 + 12 * 3600000);
  assert.equal(minuteAt(0.5, D0, 23 * 3600000), D0 + 11.5 * 3600000);
});

test('bars: only slots with operations, square-root heights, at least 12%', () => {
  const bars = barHeights([{ ops: 0 }, { ops: 1 }, { ops: 4 }, { ops: 100 }]);

  assert.deepEqual(bars.map((b) => b.h), [12, 20, 100]);
  assert.deepEqual(barHeights([]), []);
  assert.deepEqual(barHeights(undefined), []);
});

test('positions are clamped to the track', () => {
  assert.equal(pctOf(D0 - SLOT, D0, DAY_MS), 0);
  assert.equal(pctOf(D0 + DAY_MS / 4, D0, DAY_MS), 25);
  assert.equal(pctOf(D0 + 2 * DAY_MS, D0, DAY_MS), 100);
});
