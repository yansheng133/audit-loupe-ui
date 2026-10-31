<script>
import { fmtTime, shiftDay, eventReason, clusterLabel } from '../../lib/v5';
import {
  dayLength, minuteAt, pickRange, barHeights, pctOf
} from '../../lib/timeline';

// Bottom timeline, on every tab. One merged line by default; one line per selected cluster
// (per-minute slots when one is selected, as sent by the backend). Each slot is a bar: height =
// operations, colour = audit state. Clicking a slot picks it; dragging picks a range. The
// whole page then counts only that range (API v0.2); the timeline stays the whole day.
export default {
  name:  'AlTimelineBar',
  props: {
    T:        { type: Object, required: true },
    timeline: { type: Object, default: null },
    day:      { type: String, required: true },
    d0:       { type: Number, required: true },
    tz:       { type: String, required: true },
    range:    { type: Array, default: null },
  },
  emits: ['day', 'range'],
  data() {
    return { drag: null };
  },
  computed: {
    lines() {
      return this.timeline?.lines || [];
    },
    slotMs() {
      return (this.timeline?.slotMinutes || 10) * 60000;
    },
    dayMs() {
      return dayLength(this.timeline);
    },
    gaps() {
      return this.timeline?.gaps || [];
    },
    sel() {
      const r = this.drag ? [Math.min(this.drag.a, this.drag.b), Math.max(this.drag.a, this.drag.b)] : this.range;

      return r ? { left: this.pct(r[0]), width: `${ Math.max(0.5, ((r[1] - r[0]) / this.dayMs) * 100) }%` } : null;
    },
  },
  methods: {
    clusterName(id) {
      return clusterLabel(this.$store, id);
    },
    pct(t) {
      return `${ pctOf(t, this.d0, this.dayMs) }%`;
    },
    // Runs of equal state merged, so a day of 1440 slots draws a handful of segments.
    segments(line) {
      const out = [];

      (line.slots || []).forEach((s) => {
        const last = out[out.length - 1];

        if (last && last.state === s.state && last.end === s.t) {
          last.end = s.t + this.slotMs;
        } else {
          out.push({
            state: s.state, start: s.t, end: s.t + this.slotMs
          });
        }
      });

      return out;
    },
    bars(line) {
      return barHeights(line.slots);
    },
    barTitle(s) {
      const state = this.T.states[s.state] || this.T.tl.legend[s.state] || '';

      return `${ this.fmt(s.t) }–${ this.fmt(s.t + this.slotMs) } ・ ${ state } ・ ${ this.T.tl.ops(s.ops, s.alerts) }`;
    },
    lineGaps(line) {
      return this.gaps.filter((g) => line.cluster === null || g.cluster === line.cluster);
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
      if (!d) {
        return;
      }
      this.$emit('range', pickRange(d.a, d.b, this.d0, this.slotMs, this.dayMs));
    },
    fmt(ms) {
      return fmtTime(ms, this.tz);
    },
    gapTitle(g) {
      return `${ this.fmt(g.fromMs) }–${ this.fmt(g.toMs) } ${ eventReason(this.T, g) }`;
    },
    shiftDay,
  },
};
</script>

<template>
  <div class="tl">
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
      <span class="muted">{{ T.tl.range }}</span>
      <b
        v-if="range"
        class="num"
      >{{ fmt(range[0]) }}–{{ range[1] >= d0 + dayMs ? '24:00' : fmt(range[1]) }}</b>
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
      <span class="muted small">{{ timeline ? T.tl.slot(timeline.slotMinutes) : '' }}</span>
      <span class="muted small">{{ T.tl.hint }}</span>
      <div class="legend">
        <span><i class="lg look" />{{ T.tl.legend.look }}</span>
        <span><i class="lg blind" />{{ T.tl.legend.blind }}</span>
        <span><i class="lg unknown" />{{ T.tl.legend.unknown }}</span>
        <span><i class="lg op" />{{ T.tl.legend.op }}</span>
      </div>
    </div>
    <div class="tl-rows">
      <div class="tl-labels">
        <div
          v-for="(l, i) in lines"
          :key="i"
          class="tl-label"
        >
          {{ l.cluster === null ? T.tl.merged : clusterName(l.cluster) }} {{ T.tl.state }}
        </div>
      </div>
      <div
        ref="track"
        class="tl-track"
        @pointerdown.prevent="down"
      >
        <div
          v-for="(l, i) in lines"
          :key="i"
          class="tl-line"
        >
          <i
            v-for="(s, j) in segments(l)"
            :key="`s${j}`"
            class="seg"
            :class="s.state"
            :style="{left: pct(s.start), width: `${((s.end - s.start) / dayMs) * 100}%`}"
          />
          <i
            v-for="(g, j) in lineGaps(l)"
            :key="`g${j}`"
            class="gap"
            :class="g.kind"
            :style="{left: pct(g.fromMs), width: `${((Math.min(g.toMs, d0 + dayMs) - Math.max(g.fromMs, d0)) / dayMs) * 100}%`}"
            :title="gapTitle(g)"
          />
          <i
            v-for="(s, j) in bars(l)"
            :key="`m${j}`"
            class="bar"
            :class="s.state"
            :style="{left: pct(s.t), width: `${(slotMs / dayMs) * 100}%`, height: `${s.h}%`}"
            :title="barTitle(s)"
          />
        </div>
        <div
          v-if="sel"
          class="tl-sel"
          :style="sel"
        />
        <div class="tl-axis muted num">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>
      </div>
    </div>
  </div>
</template>
