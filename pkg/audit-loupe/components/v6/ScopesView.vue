<script>
import AlLanes from './Lanes.vue';
import { clusterLabel, fmtTime } from '../../lib/v5';
import {
  scopeGroups, scopeActors, parsePlace, scopeLabel, actorLabel, headline, whatText, noteOf
} from '../../lib/v6';

// Scopes: target namespaces on the left (by cluster); on the right, one lane per account that
// changed the picked namespace, and one summary line per account.
export default {
  name:       'AlScopesView',
  components: { AlLanes },
  props:      {
    T:          { type: Object, required: true },
    behaviours: { type: Array, required: true },
    // The server's namespace list (/api/behaviors scopes).
    scopes:     { type: Array, required: true },
    place:      { type: String, default: null },
    gaps:       { type: Array, default: () => [] },
    d0:         { type: Number, required: true },
    dayMs:      { type: Number, required: true },
    tz:         { type: String, required: true },
    sel:        { type: String, default: '' },
  },
  emits:    ['select', 'place'],
  computed: {
    groups() {
      return scopeGroups(this.scopes);
    },
    current() {
      return this.groups.flatMap((g) => g.items).find((x) => x.key === this.place) || null;
    },
    actors() {
      return this.current ? scopeActors(this.behaviours, this.current.key) : [];
    },
    rows() {
      return this.actors.map((a) => ({
        type: 'who', key: a.key, actor: a.actor, actorKey: a.actorKey, cluster: a.cluster, behaviours: a.behaviours
      }));
    },
    head() {
      const p = parsePlace(this.current?.key);

      return { scope: scopeLabel(this.T, p.scope), cluster: clusterLabel(this.$store, p.cluster) };
    },
  },
  methods: {
    actorLabel,
    cl(id) {
      return clusterLabel(this.$store, id);
    },
    scopeLabel(s) {
      return scopeLabel(this.T, s);
    },
    n(v) {
      return v === null || v === undefined ? this.T.tbc : v;
    },
    fmt(ms) {
      return ms === null || ms === undefined ? this.T.tbc : fmtTime(ms, this.tz);
    },
    title(b) {
      return headline(this.T, b);
    },
    what(a) {
      return whatText(this.T, a.what) || this.T.tbc;
    },
    note(a) {
      return noteOf(this.T, a);
    },
    pick(a) {
      this.$emit('select', (a.head || a.behaviours[0]).id);
    },
  },
};
</script>

<template>
  <div class="split">
    <nav
      class="picker"
      :aria-label="T.namespace"
    >
      <template
        v-for="g in groups"
        :key="g.cluster"
      >
        <div class="pgrp">
          {{ T.inCluster(cl(g.cluster)) }}
        </div>
        <button
          v-for="x in g.items"
          :key="x.key"
          type="button"
          class="pick"
          :class="{sel: current && current.key === x.key}"
          :aria-pressed="String(!!current && current.key === x.key)"
          @click="$emit('place', x.key)"
        >
          <span class="n">{{ scopeLabel(x.scope) }}</span>
          <span class="s">{{ T.scopeMeta(n(x.actors), n(x.behaviors)) }}<b
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
        <h3>{{ T.scopeHead(head.scope) }}</h3>
        <span class="muted small">{{ T.scopeSub(head.cluster) }}</span>
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
          :axis-label="T.axis.scopes"
          @select="(id) => $emit('select', id)"
        />
      </div>
      <div class="rlist">
        <div class="fd-sec">
          <b>{{ T.perActor }}</b>
        </div>
        <div
          v-for="a in actors"
          :key="a.key"
          class="bi"
          :class="[a.head ? 'look' : '', {sel: a.behaviours.some((b) => b.id === sel)}]"
          role="button"
          tabindex="0"
          @click="pick(a)"
          @keydown.enter.prevent="pick(a)"
          @keydown.space.prevent="pick(a)"
        >
          <span class="bi-t num">{{ fmt(a.firstMs) }}–{{ fmt(a.lastMs) }}</span>
          <span class="bi-tt">
            <b :title="a.actor.name || null">{{ actorLabel(T, a.actor) }}</b>{{ T.colon }}<b
              v-if="a.head"
              class="hl"
            >{{ title(a.head) }}</b>
            {{ what(a) }}
          </span>
          <span class="bi-meta">
            <span>{{ T.actorLine(a.behaviours.length, n(a.ops)) }}</span>
            <span v-if="note(a.actor)">{{ note(a.actor) }}</span>
          </span>
        </div>
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
