<script>
import { fmtTime, shiftDay, clusterLabel } from '../../lib/v5';
import { stripBars, mergedGaps, headline } from '../../lib/v6';
import { minuteAt, pickRange } from '../../lib/timeline';

// The bottom time bar of v6: the day picker as in v5, and the day's operations per cell (people
// dark, everyone else light), collection gaps hatched, the behaviours to look at as red dots,
// and the selected behaviour's span outlined. Cells come from the server (strip.cells).
// Clicking a cell or dragging picks a range: the page then lists only the behaviours that
// overlap it (the server cuts whole days; counts stay whole-day).
export default {
  name:  'AlStripBar',
  props: {
    T:     { type: Object, required: true },
    strip: { type: Object, default: null },
    gaps:  { type: Array, default: () => [] },
    look:  { type: Array, default: () => [] },
    mark:  { type: Array, default: null },
    day:   { type: String, required: true },
    d0:    { type: Number, required: true },
    dayMs: { type: Number, required: true },
    tz:    { type: String, required: true },
    range: { type: Array, default: null },
  },
  emits: ['day', 'range'],
  data() {
    return { drag: null };
  },
  computed: {
    cellMs() {
      return (this.strip?.cellMinutes || 10) * 60000;
    },
    bars() {
      return stripBars(this.strip);
    },
    gapBands() {
      const clusters = [...new Set(this.gaps.map((g) => g.cluster))];

      return clusters.flatMap((c) => mergedGaps(this.gaps, c));
    },
    markStyle() {
      const m = this.mark;

      return m ? { left: `${ this.pct(m[0]) }%`, width: `${ Math.max(0.4, this.pct(m[1]) - this.pct(m[0])) }%` } : null;
    },
    selStyle() {
      const r = this.drag ? [Math.min(this.drag.a, this.drag.b), Math.max(this.drag.a, this.drag.b)] : this.range;

      return r ? { left: `${ this.pct(r[0]) }%`, width: `${ Math.max(0.4, this.pct(r[1]) - this.pct(r[0])) }%` } : null;
    },
    // With system components listed, the light bars include them too.
    withSystem() {
      return (this.strip?.cells || []).some((c) => c.system !== undefined);
    },
    hours() {
      return [0, 3, 6, 9, 12, 15, 18, 21, 24];
    },
  },
  methods: {
    pct(t) {
      return Math.min(100, Math.max(0, ((t - this.d0) / this.dayMs) * 100));
    },
    fmt(ms) {
      return fmtTime(ms, this.tz);
    },
    at(e) {
      const r = this.$refs.track.getBoundingClientRect();

      return minuteAt((e.clientX - r.left) / r.width, this.d0, this.dayMs);
    },
    down(e) {
      const t = this.at(e);

      this.drag = { a: t, b: t };
      window.addEventListener('pointermove', this.move);
      window.addEventListener('pointerup', this.up, { once: true });
    },
    move(e) {
      if (this.drag) {
        this.drag.b = this.at(e);
      }
    },
    up() {
      window.removeEventListener('pointermove', this.move);
      const d = this.drag;

      this.drag = null;
      if (d) {
        this.$emit('range', pickRange(d.a, d.b, this.d0, this.cellMs, this.dayMs));
      }
    },
    endText(t) {
      return t >= this.d0 + this.dayMs ? '24:00' : this.fmt(t);
    },
    barTitle(c) {
      return this.T.strip.bar(this.fmt(c.t), this.fmt(c.t + this.cellMs), c.people, c.other);
    },
    gapTitle(g) {
      return `${ this.T.strip.gap } ${ this.fmt(g.fromMs) }–${ this.fmt(g.toMs) } ・ ${ clusterLabel(this.$store, g.cluster) }`;
    },
    // A dot at the operation that made the behaviour "look" (its title), else its start.
    dotAt(b) {
      return b.title?.t ?? b.fromMs;
    },
    dotTitle(b) {
      return `${ this.T.strip.look } ・ ${ this.fmt(this.dotAt(b)) } ・ ${ headline(this.T, b) }`;
    },
    shiftDay,
  },
};
</script>

<template>
  <div class="tl sb">
    <div class="tl-top">
      <button
        type="button"
        class="btn-al"
        :aria-label="T.tl.prev"
        :title="T.tl.prev"
        @click="$emit('day', shiftDay(day, -1))"
      >
        ◀
      </button>
      <input
        type="date"
        :value="day"
        :aria-label="T.tl.date"
        @change="$event.target.value && $emit('day', $event.target.value)"
      >
      <button
        type="button"
        class="btn-al"
        :aria-label="T.tl.next"
        :title="T.tl.next"
        @click="$emit('day', shiftDay(day, 1))"
      >
        ▶
      </button>
      <b>{{ T.strip.title }}</b>
      <span class="muted">{{ T.tl.range }}</span>
      <b
        v-if="range"
        class="num"
      >{{ fmt(range[0]) }}–{{ endText(range[1]) }}</b>
      <span
        v-else
        class="muted"
      >{{ T.tl.rangeAll }}</span>
      <button
        v-if="range"
        type="button"
        class="link"
        @click="$emit('range', null)"
      >
        {{ T.tl.clearRange }}
      </button>
      <span class="muted small">{{ T.strip.rangeHint }}</span>
      <span
        v-if="strip"
        class="muted small"
      >{{ T.strip.cell(strip.cellMinutes ?? T.tbc) }}</span>
      <div class="legend">
        <span><i class="lg people" />{{ T.strip.people }}</span>
        <span><i class="lg other" />{{ withSystem ? T.strip.otherSys : T.strip.other }}</span>
        <span><i class="lg blind" />{{ T.strip.gap }}</span>
        <span><i class="lg lookdot" />{{ T.strip.look }}</span>
        <span><i class="lg mark" />{{ T.strip.mark }}</span>
      </div>
    </div>
    <div
      ref="track"
      class="sb-track"
      @pointerdown.prevent="down"
    >
      <i
        v-for="(g, j) in gapBands"
        :key="`g${j}`"
        class="sb-gap"
        :style="{left: `${pct(g.fromMs)}%`, width: `${Math.max(0.1, pct(g.toMs) - pct(g.fromMs))}%`}"
        :title="gapTitle(g)"
      />
      <template
        v-for="c in bars"
        :key="c.t"
      >
        <i
          class="sb-bar other"
          :style="{left: `${pct(c.t)}%`, width: `${(cellMs / dayMs) * 100}%`, height: `${(c.hTotal * 30) / 100}px`}"
          :title="barTitle(c)"
        />
        <i
          v-if="c.people"
          class="sb-bar people"
          :style="{left: `${pct(c.t)}%`, width: `${(cellMs / dayMs) * 100}%`, height: `${(c.hPeople * 30) / 100}px`}"
          :title="barTitle(c)"
        />
      </template>
      <i
        v-for="b in look"
        :key="`k${b.id}`"
        class="sb-dot"
        :style="{left: `${pct(dotAt(b))}%`}"
        :title="dotTitle(b)"
      />
      <div
        v-if="selStyle"
        class="sb-sel"
        :style="selStyle"
      />
      <div
        v-if="markStyle"
        class="sb-mark"
        :style="markStyle"
        :title="`${ T.strip.mark } ${ fmt(mark[0]) }–${ fmt(mark[1]) }`"
      />
    </div>
    <div class="sb-axis muted num">
      <span
        v-for="h in hours"
        :key="h"
        :class="{first: h === 0, last: h === 24}"
        :style="{left: `${pct(d0 + h * 3600000)}%`}"
      >{{ String(h).padStart(2, '0') }}:00</span>
    </div>
  </div>
</template>
