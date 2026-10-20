<script>
import { sevOf } from '../lib/model';

// "All actions" tab: every visible action, newest first, one row each.
export default {
  name:  'AuditLoupeFeedList',
  props: {
    T:        { type: Object, required: true },
    events:   { type: Array, required: true },
    ACTORS:   { type: Object, required: true },
    OBJ:      { type: Object, required: true },
    selEvent: { type: String, default: null },
  },
  emits: ['select'],

  computed: {
    rows() {
      return [...this.events].reverse().map((e) => {
        const o = this.OBJ[e.obj];
        const sev = sevOf(e);

        return {
          id:    e.id,
          obj:   e.obj,
          time:  e.hhmm,
          who:   this.ACTORS[e.actor]?.label || e.actor,
          color: this.ACTORS[e.actor]?.color,
          verb:  e.verb,
          kind:  o?.kind || '',
          name:  o?.name || '',
          where: o ? [o.clusterLabel, o.namespace].filter(Boolean).join(' / ') : '',
          via:   this.T.via[e.via] || e.via,
          sev,
          on:    e.id === this.selEvent,
        };
      });
    },
  },
};
</script>

<template>
  <div class="feed">
    <div
      v-if="!rows.length"
      class="quiet"
    >
      {{ T.layout.feedEmpty }}
    </div>
    <button
      v-for="r in rows"
      :key="r.id"
      type="button"
      class="feed-row"
      :class="{on: r.on}"
      @click="$emit('select', r.obj, r.id)"
    >
      <span class="t num">{{ r.time }}</span>
      <span class="feed-body">
        <span class="feed-line"><span
          class="who"
        ><i :style="{background: r.color}" />{{ r.who }}</span> {{ r.verb }} <span class="kind-txt">{{ r.kind }}</span> <span class="mono">{{ r.name }}</span></span>
        <span class="feed-meta">
          <span class="pill">{{ r.via }}</span>
          <span
            v-if="r.sev"
            class="pill"
            :class="r.sev"
          >{{ T.risk(T.sev[r.sev]) }}</span>
          <span class="muted">{{ r.where }}</span>
        </span>
      </span>
    </button>
  </div>
</template>
