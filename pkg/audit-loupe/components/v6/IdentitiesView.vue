<script>
import AlLanes from './Lanes.vue';
import AlBehaviourItem from './BehaviourItem.vue';
import {
  identityGroups, identityRows, identityBehaviours, actorLabel, noteOf
} from '../../lib/v6';

// Identities: accounts on the left (by group); on the right, the picked account's lanes, one per
// target namespace, and its behaviours, most serious first.
export default {
  name:       'AlIdentitiesView',
  components: { AlLanes, AlBehaviourItem },
  props:      {
    T:          { type: Object, required: true },
    behaviours: { type: Array, required: true },
    // The server's account list (/api/behaviors actors).
    actors:     { type: Array, required: true },
    overlaps:   { type: Array, default: () => [] },
    names:      { type: Object, default: () => ({}) },
    who:        { type: String, default: null },
    gaps:       { type: Array, default: () => [] },
    d0:         { type: Number, required: true },
    dayMs:      { type: Number, required: true },
    tz:         { type: String, required: true },
    sel:        { type: String, default: '' },
  },
  emits:    ['select', 'who'],
  computed: {
    groups() {
      return identityGroups(this.actors);
    },
    current() {
      return this.groups.flatMap((g) => g.items).find((x) => x.key === this.who) || null;
    },
    rows() {
      return this.current ? identityRows(this.behaviours, this.current.key) : [];
    },
    list() {
      return this.current ? identityBehaviours(this.behaviours, this.current.key) : [];
    },
  },
  methods: {
    actorLabel,
    n(v) {
      return v === null || v === undefined ? this.T.tbc : v;
    },
    note(a) {
      return noteOf(this.T, a);
    },
  },
};
</script>

<template>
  <div class="split">
    <nav
      class="picker"
      :aria-label="T.pickGroups"
    >
      <template
        v-for="g in groups"
        :key="g.group"
      >
        <div class="pgrp">
          {{ T.groups[g.group] }}
        </div>
        <button
          v-for="x in g.items"
          :key="x.key"
          type="button"
          class="pick"
          :class="{sel: current && current.key === x.key}"
          :aria-pressed="String(!!current && current.key === x.key)"
          :title="x.name || null"
          @click="$emit('who', x.key)"
        >
          <span class="n">{{ actorLabel(T, x) }}</span>
          <span class="s">{{ T.actorLine(n(x.behaviors), n(x.ops)) }}<b
            v-if="x.look"
            class="lk"
          > ・ {{ T.lookN(x.look) }}</b></span>
        </button>
      </template>
    </nav>
    <div
      v-if="current"
      class="rcol"
    >
      <div class="rhead">
        <h3>{{ T.identityHead(actorLabel(T, current)) }}</h3>
        <span class="muted small">{{ current.name }}<template v-if="note(current)"> ・ {{ note(current) }}</template></span>
      </div>
      <div class="rlanes">
        <AlLanes
          :T="T"
          :rows="rows"
          :gaps="gaps"
          :d0="d0"
          :day-ms="dayMs"
          :tz="tz"
          :sel="sel"
          :axis-label="T.axis.identities"
          :overlaps="overlaps"
          :names="names"
          @select="(id) => $emit('select', id)"
        />
      </div>
      <div class="rlist">
        <div class="fd-sec">
          <b>{{ T.listHead(list.length) }}</b>
        </div>
        <AlBehaviourItem
          v-for="b in list"
          :key="b.id"
          :T="T"
          :b="b"
          :tz="tz"
          :sel="sel === b.id"
          no-actor
          @select="(id) => $emit('select', id)"
        />
      </div>
    </div>
    <p
      v-else
      class="muted pad"
    >
      {{ T.noBehaviours }}
    </p>
  </div>
</template>
