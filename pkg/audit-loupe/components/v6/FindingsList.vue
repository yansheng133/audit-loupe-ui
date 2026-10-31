<script>
import AlBehaviourItem from './BehaviourItem.vue';
import { fmtTime, eventReason, clusterLabel } from '../../lib/v5';
import { findingsSections } from '../../lib/v6';

// Findings: behaviours by tier, most serious first. "Look" and "worth knowing" are open; the
// others are closed until asked. The last section is the collection gaps (the collection
// events of the v5 Events tab), each as the server reported it: silent collector or reported gap.
export default {
  name:       'AlFindingsList',
  components: { AlBehaviourItem },
  props:      {
    T:          { type: Object, required: true },
    behaviours: { type: Array, required: true },
    open:       { type: Array, required: true },
    gaps:       { type: Array, default: () => [] },
    tz:         { type: String, required: true },
    sel:        { type: String, default: '' },
  },
  emits:    ['select', 'toggle'],
  computed: {
    sections() {
      return findingsSections(this.behaviours, this.open);
    },
    collection() {
      return [...this.gaps].sort((a, b) => a.fromMs - b.fromMs).map((g) => ({
        from:  g.fromMs,
        to:    g.toMs,
        open:  !!g.open,
        title: clusterLabel(this.$store, g.cluster),
        text:  eventReason(this.T, g) || this.T.tbc,
        kind:  g.kind,
      }));
    },
  },
  methods: {
    fmt(ms) {
      return fmtTime(ms, this.tz);
    },
  },
};
</script>

<template>
  <div class="fd">
    <template
      v-for="s in sections"
      :key="s.tier"
    >
      <div
        class="fd-sec"
        :class="s.tier"
      >
        <b>{{ T.tiers[s.tier] }}</b>
        <span class="num">{{ s.items.length }}</span>
        <span class="muted small">{{ T.tierHint[s.tier] }}</span>
        <button
          v-if="s.items.length"
          type="button"
          class="link"
          :aria-expanded="String(s.open)"
          @click="$emit('toggle', s.tier)"
        >
          {{ s.open ? T.collapse : T.expand }}
        </button>
      </div>
      <template v-if="s.open">
        <p
          v-if="!s.items.length"
          class="fd-empty muted"
        >
          {{ T.emptySection }}
        </p>
        <AlBehaviourItem
          v-for="b in s.items"
          :key="b.id"
          :T="T"
          :b="b"
          :tz="tz"
          :sel="sel === b.id"
          @select="(id) => $emit('select', id)"
        />
      </template>
    </template>
    <div class="fd-sec gaps">
      <b>{{ T.gapsSection }}</b>
      <span class="num">{{ collection.length }}</span>
      <span class="muted small">{{ T.gapsSub }}</span>
    </div>
    <p
      v-if="!collection.length"
      class="fd-empty muted"
    >
      {{ T.emptySection }}
    </p>
    <div
      v-for="(c, i) in collection"
      :key="`c${i}`"
      class="bi static"
    >
      <span class="bi-t num">{{ fmt(c.from) }}–{{ fmt(c.to) }}</span>
      <span class="bi-tt">{{ T.collectOf(c.title) }}{{ T.colon }}{{ c.text }}</span>
      <span class="bi-meta">
        <span
          class="src"
          :class="c.kind"
        >{{ T.evSource[c.kind] || c.kind }}</span>
        <span
          v-if="c.open"
          class="tg cfg"
        >{{ T.gapOpen }}</span>
      </span>
    </div>
  </div>
</template>
