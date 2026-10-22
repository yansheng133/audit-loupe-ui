<script>
import AlStateTag from './StateTag.vue';
import { KIND_TAG, kindOf } from '../../lib/model';
import { STATES, fmtTime, parseKey, eventReason } from '../../lib/v5';

// Audit state transitions only. Collection events keep their two sources apart: what the
// collector reported, and what Audit Loupe concluded from missing heartbeats (spec §5).
export default {
  name:       'AlEventsList',
  components: { AlStateTag },
  props:      {
    T:       { type: Object, required: true },
    events:  { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    tz:      { type: String, required: true },
    range:   { type: Array, default: null },
  },
  emits:    ['select'],
  computed: {
    shown() {
      const evs = [...this.events].sort((a, b) => b.t - a.t);

      return this.range ? evs.filter((e) => e.t >= this.range[0] && e.t < this.range[1]) : evs;
    },
  },
  methods: {
    eventReason,
    fmt(ms) {
      return fmtTime(ms, this.tz);
    },
    isObj(e) {
      return e.source === 'state';
    },
    // Object events name the object key; collection events name the cluster.
    title(e) {
      if (!this.isObj(e)) {
        return this.T.collectOf(e.subject);
      }
      const k = parseKey(e.subject);
      const kind = kindOf(k.resource);

      return `${ KIND_TAG[kind] || kind } ${ k.name }${ k.namespace ? `（${ k.namespace }）` : '' }`;
    },
    // from / to are audit states for objects ("look", "look:high"), collection states
    // ("ok" / "blind") for the collector.
    stateOf(e, s) {
      if (!s) {
        return null;
      }
      const [state, severity] = String(s).split(':');

      if (this.isObj(e)) {
        return STATES.includes(state) ? { value: state, severity } : null;
      }

      return { value: state === 'ok' ? 'clear' : 'blind', label: this.T.collect[state] || state };
    },
    icon(e) {
      const to = this.stateOf(e, e.to);

      return to ? to.value : 'clear';
    },
    pick(e) {
      if (this.isObj(e)) {
        this.$emit('select', e.subject);
      }
    },
  },
};
</script>

<template>
  <div class="ev">
    <p class="ev-head">
      {{ T.eventsHead }}
    </p>
    <p
      v-if="!loading && !shown.length"
      class="muted"
    >
      {{ T.evEmpty }}
    </p>
    <ul>
      <li
        v-for="(e, i) in shown"
        :key="i"
        class="ev-card"
        :class="icon(e)"
        :tabindex="isObj(e) ? 0 : undefined"
        :title="isObj(e) ? e.subject : ''"
        @click="pick(e)"
        @keydown.enter="pick(e)"
      >
        <span
          class="dot"
          aria-hidden="true"
        />
        <div class="ev-main">
          <div>
            <b>{{ title(e) }}</b>
            <span
              class="src"
              :class="e.source"
            >{{ T.evSource[e.source] || e.source }}</span>
          </div>
          <div class="muted small">
            {{ eventReason(T, e) }}<template v-if="e.held">
              ・ <a
                :href="e.heldHref || undefined"
                class="link"
              >{{ T.heldRows(e.held) }}</a>
            </template>
          </div>
        </div>
        <div class="ev-tr">
          <template v-if="stateOf(e, e.from)">
            <AlStateTag
              :T="T"
              v-bind="stateOf(e, e.from)"
            />
            <span aria-hidden="true">→</span>
          </template>
          <AlStateTag
            v-if="stateOf(e, e.to)"
            :T="T"
            v-bind="stateOf(e, e.to)"
          />
        </div>
        <span class="num t">{{ fmt(e.t) }}<template v-if="e.toMs"> – {{ fmt(e.toMs) }}</template></span>
      </li>
    </ul>
  </div>
</template>
