// The timeline's arithmetic, kept apart from the component so it can be tested with node --test
// (test/timeline.test.mjs). Times are milliseconds; d0 is the start of the day.

export const DAY_MS = 864e5;

// The day is as long as the slots the backend sent: 23 or 25 hours on a day the clocks change.
export function dayLength(timeline) {
  const n = timeline?.lines?.[0]?.slots?.length;
  const slotMs = (timeline?.slotMinutes || 10) * 60000;

  return n ? n * slotMs : DAY_MS;
}

// The minute under a point a fraction f (0..1) along the track.
export function minuteAt(f, d0, dayMs) {
  const c = Math.min(1, Math.max(0, f));

  return d0 + Math.round((c * dayMs) / 60000) * 60000;
}

// What a press from a to b picks: a drag of 5 minutes or more snaps outwards to whole slots,
// so the range matches the bars it covers; anything shorter is a click and picks its slot.
export function pickRange(a, b, d0, slotMs, dayMs) {
  const lo = Math.min(a, b) - d0;
  const hi = Math.max(a, b) - d0;

  if (hi - lo >= 5 * 60000) {
    return [d0 + Math.floor(lo / slotMs) * slotMs, d0 + Math.min(dayMs, Math.ceil(hi / slotMs) * slotMs)];
  }
  const start = Math.min(Math.floor(lo / slotMs) * slotMs, dayMs - slotMs);

  return [d0 + start, d0 + start + slotMs];
}

// Bar heights in percent: square root of the operations, so one busy slot does not flatten
// the rest, and at least 12% so a single operation is still visible.
export function barHeights(slots) {
  const marks = (slots || []).filter((s) => s.ops > 0);
  const max = Math.max(1, ...marks.map((s) => s.ops));

  return marks.map((s) => ({ ...s, h: Math.max(12, Math.round((Math.sqrt(s.ops) / Math.sqrt(max)) * 100)) }));
}

// Position along the day in percent, clamped to the track.
export function pctOf(t, d0, dayMs) {
  return Math.min(100, Math.max(0, ((t - d0) / dayMs) * 100));
}
