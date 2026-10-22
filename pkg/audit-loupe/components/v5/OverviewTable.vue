<script>
import AlStateTag from './StateTag.vue';
import { KIND_TAG } from '../../lib/model';
import { fmtTime, reasonText, noteText, shortWho } from '../../lib/v5';

const ROW_H = 34;
const OVERSCAN = 8;

// Objects with changes on the day, in the backend's order. Only the rows in view are drawn.
export default {
  name:       'AlOverviewTable',
  components: { AlStateTag },
  props:      {
    T:       { type: Object, required: true },
    rows:    { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    sel:     { type: String, default: '' },
    d0:      { type: Number, required: true },
    tz:      { type: String, required: true },
    hidden:  { type: Object, default: null },
    system:  { type: Boolean, default: false },
    hasMore: { type: Boolean, default: false },
    range:   { type: Array, default: null },
  },
  emits: ['select', 'system', 'more'],
  data() {
    return { top: 0, height: 600 };
  },
  computed: {
    first() {
      return Math.max(0, Math.floor(this.top / ROW_H) - OVERSCAN);
    },
    shown() {
      const n = Math.ceil(this.height / ROW_H) + OVERSCAN * 2;

      return this.rows.slice(this.first, this.first + n);
    },
    padTop() {
      return this.first * ROW_H;
    },
    padBottom() {
      return Math.max(0, (this.rows.length - this.first - this.shown.length) * ROW_H);
    },
  },
  mounted() {
    this.measure();
    window.addEventListener('resize', this.measure);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.measure);
  },
  methods: {
    measure() {
      this.height = this.$refs.scroll?.clientHeight || 600;
    },
    onScroll(e) {
      this.top = e.target.scrollTop;
    },
    tag(kind) {
      return KIND_TAG[kind] || String(kind || '').toUpperCase();
    },
    pos(t) {
      return `${ Math.min(100, Math.max(0, ((t - this.d0) / 864e5) * 100)) }%`;
    },
    fmt(ms) {
      return fmtTime(ms, this.tz);
    },
    viaLabel(v) {
      return v === 'unknown' ? '—' : (this.T.via[v] || v || '—');
    },
    reasonText,
    whoName(r) {
      return r.who && r.who.name ? shortWho(r.who.name) : this.T.noActor;
    },
    whoTitle(r) {
      const w = r.who || {};

      return [w.name, noteText(this.T, w.noteCode, w.note)].filter(Boolean).join(' ・ ');
    },
    dimmed(r) {
      if (!this.range) {
        return false;
      }

      return !(r.ticks || []).some((k) => k.t >= this.range[0] && k.t < this.range[1]);
    },
  },
};
</script>

<template>
  <div
    ref="scroll"
    class="ov-scroll"
    @scroll.passive="onScroll"
  >
    <table class="ov">
      <thead>
        <tr>
          <th>{{ T.cols.state }}</th>
          <th>{{ T.cols.object }}</th>
          <th>{{ T.cols.where }}</th>
          <th class="ticks-h">
            {{ T.cols.ticks }}
          </th>
          <th class="r">
            {{ T.cols.ops }}
          </th>
          <th>{{ T.cols.last }}</th>
          <th>{{ T.cols.who }}</th>
          <th>{{ T.cols.via }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-if="padTop"
          :style="{height: `${padTop}px`}"
          aria-hidden="true"
        />
        <tr
          v-for="r in shown"
          :key="r.key"
          :class="{sel: r.key === sel, dim: dimmed(r)}"
          tabindex="0"
          @click="$emit('select', r.key)"
          @keydown.enter="$emit('select', r.key)"
        >
          <td>
            <AlStateTag
              :T="T"
              :value="r.state"
              :severity="r.severity"
              :reason="reasonText(T, r.stateReasonCode, r.stateReason)"
            />
          </td>
          <td class="obj">
            <span class="kind">{{ tag(r.kind) }}</span><span
              v-if="r.batch || r.name === '*'"
              class="name batch"
              :title="T.batchHint(r.key.split('/')[2] || r.kind)"
            >{{ T.batch }}</span><span
              v-else
              class="name mono"
              :title="r.key"
            >{{ r.name }}</span>
          </td>
          <td
            class="where"
            :title="`${r.cluster} / ${r.namespace || T.clusterScope}`"
          >
            {{ r.cluster }} / {{ r.namespace || T.clusterScope }}
          </td>
          <td>
            <div class="mini">
              <i
                v-for="(k, i) in r.ticks || []"
                :key="i"
                :class="{alert: k.alert}"
                :style="{left: pos(k.t)}"
              />
            </div>
          </td>
          <td class="r num">
            {{ r.ops }}
          </td>
          <td class="num">
            {{ fmt(r.lastMs) }}
          </td>
          <td
            class="who"
            :title="whoTitle(r)"
          >
            <span :class="{muted: !(r.who && r.who.name)}">{{ whoName(r) }}</span>
            <small
              v-if="r.who && r.who.name && r.who.category"
              class="cat"
            >{{ T.category[r.who.category] || r.who.category }}</small>
          </td>
          <td class="via">
            {{ viaLabel(r.via) }}
          </td>
        </tr>
        <tr
          v-if="padBottom"
          :style="{height: `${padBottom}px`}"
          aria-hidden="true"
        />
        <tr v-if="!loading && !rows.length">
          <td
            colspan="8"
            class="muted empty"
          >
            {{ T.noRows }}
          </td>
        </tr>
      </tbody>
    </table>
    <div class="ov-foot muted">
      <button
        v-if="hasMore"
        type="button"
        class="btn-al"
        @click="$emit('more')"
      >
        {{ T.more }}
      </button>
      <span v-if="hidden">{{ T.hiddenRows(hidden.system, hidden.uiMaintenance) }} ・ </span>
      <button
        type="button"
        class="link"
        @click="$emit('system', !system)"
      >
        {{ system ? T.hide : T.show }}
      </button>
    </div>
  </div>
</template>
