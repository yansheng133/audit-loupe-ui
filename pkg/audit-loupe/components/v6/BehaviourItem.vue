<script>
import { clusterLabel } from '../../lib/v5';
import {
  rangeText, titleText, whatText, actorLabel, scopeLabel, tagTexts
} from '../../lib/v6';

// One behaviour in a list (findings, identities): time, title (its most serious operation for
// "look" and "worth knowing"), who and where, what was done, and its labels.
export default {
  name:  'AlBehaviourItem',
  props: {
    T:       { type: Object, required: true },
    b:       { type: Object, required: true },
    tz:      { type: String, required: true },
    sel:     { type: Boolean, default: false },
    noActor: { type: Boolean, default: false },
  },
  emits:    ['select'],
  computed: {
    flagged() {
      return this.b.tier === 'look' || this.b.tier === 'notable';
    },
    head() {
      return this.flagged ? (titleText(this.T, this.b.title) || this.T.tbc) : '';
    },
    time() {
      return rangeText(this.b, this.tz) || this.T.tbc;
    },
    line() {
      const where = scopeLabel(this.T, this.b.scope);
      const who = this.noActor ? where : this.T.inScope(actorLabel(this.T, this.b.actor), where);

      return `${ who }${ this.T.colon }${ whatText(this.T, this.b.what) || this.T.tbc }`;
    },
    meta() {
      const n = (v) => (v === null || v === undefined ? this.T.tbc : v);

      return this.T.itemMeta(n(this.b.ops), n(this.b.objects), this.b.segments.length);
    },
    tags() {
      return tagTexts(this.T, this.b);
    },
  },
  methods: {
    cl(id) {
      return clusterLabel(this.$store, id);
    },
  },
};
</script>

<template>
  <div
    class="bi"
    :class="[flagged ? b.tier : '', {sel}]"
    role="button"
    tabindex="0"
    :aria-pressed="String(sel)"
    @click="$emit('select', b.id)"
    @keydown.enter.prevent="$emit('select', b.id)"
    @keydown.space.prevent="$emit('select', b.id)"
  >
    <span class="bi-t num">{{ time }}</span>
    <span class="bi-tt">
      <b
        v-if="head"
        class="hl"
      >{{ head }}</b>
      {{ line }}
    </span>
    <span class="bi-meta">
      <span
        v-if="flagged"
        class="tg"
        :class="b.tier"
      >{{ T.tiers[b.tier] }}</span>
      <span>{{ T.inCluster(cl(b.cluster)) }}</span>
      <span>{{ meta }}</span>
      <span
        v-if="b.startedBefore"
        class="tg"
      >{{ T.startedBefore }}</span>
      <span
        v-if="b.continuesAfter"
        class="tg"
      >{{ T.continuesAfter }}</span>
      <span
        v-for="t in tags"
        :key="t"
        class="tg"
      >{{ t }}</span>
    </span>
  </div>
</template>
