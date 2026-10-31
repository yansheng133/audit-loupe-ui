<script>
import { fmtTime, clusterLabel } from '../../lib/v5';
import {
  trackMarks, mergedGaps, actorLabel, saNamespace, scopeLabel, headline, settingNote, noteOf, overlapsOf
} from '../../lib/v6';

// Swim lanes over the day (00–24), shared by the activity, identity and scope tabs. Each row is
// one of: a group heading (click to open or close), an actor, a merged line of a closed group,
// one target namespace of an actor, or (scopes tab) one actor in a namespace. Blocks are the
// behaviour's parts as the server cut them; dashed lines join parts of one behaviour.
export default {
  name:  'AlLanes',
  props: {
    T:         { type: Object, required: true },
    rows:      { type: Array, required: true },
    gaps:      { type: Array, default: () => [] },
    d0:        { type: Number, required: true },
    dayMs:     { type: Number, required: true },
    tz:        { type: String, required: true },
    sel:       { type: String, default: '' },
    axisLabel: { type: String, required: true },
    overlaps:  { type: Array, default: () => [] },
    // Actor key -> name shown, for the other account in an overlap hint.
    names:     { type: Object, default: () => ({}) },
  },
  emits:    ['select', 'group', 'actor'],
  computed: {
    hours() {
      const out = [];

      for (let h = 0; h <= 24; h += 2) {
        out.push(h);
      }

      return out;
    },
    gapsBy() {
      const m = {};

      for (const c of new Set(this.gaps.map((g) => g.cluster))) {
        m[c] = mergedGaps(this.gaps, c);
      }

      return m;
    },
  },
  methods: {
    actorLabel,
    scopeLabel(s) {
      return scopeLabel(this.T, s);
    },
    cl(id) {
      return clusterLabel(this.$store, id);
    },
    fmt(ms) {
      return ms === null || ms === undefined ? this.T.tbc : fmtTime(ms, this.tz);
    },
    n(v) {
      return v === null || v === undefined ? this.T.tbc : v;
    },
    pct(t) {
      return Math.min(100, Math.max(0, ((t - this.d0) / this.dayMs) * 100));
    },
    hourLeft(h) {
      return `${ (h / 24) * 100 }%`;
    },
    marks(b) {
      return trackMarks(b, this.d0, this.dayMs);
    },
    cls(b) {
      return {
        look: 'look', notable: 'notable', routine: 'routine', unrecorded: 'unknown', unauthenticated: 'unknown', system: 'routine'
      }[b.tier] || 'plain';
    },
    blockLabel(b, s) {
      return `${ this.fmt(s.fromMs) }–${ this.fmt(s.toMs) } ・ ${ actorLabel(this.T, b.actor) } ・ ${ this.scopeLabel(b.scope) } ・ ${ this.T.tiers[b.tier] || this.T.tbc } ・ ${ this.n(s.ops) } ${ this.T.zh ? '筆' : 'operations' }`;
    },
    pin(b) {
      if (b.tier !== 'look' || !b.segments.length) {
        return null;
      }

      return { left: `${ this.pct(b.segments[b.segments.length - 1].toMs) }%`, text: headline(this.T, b) };
    },
    gapStyle(g) {
      return { left: `${ this.pct(g.fromMs) }%`, width: `${ Math.max(0.1, this.pct(g.toMs) - this.pct(g.fromMs)) }%` };
    },
    gapTitle(g) {
      const c = g.collectors.map((x) => this.T.collector[x] || x).join(this.T.listSep) || this.T.tbc;

      return `${ this.T.gapChip } ${ this.fmt(g.fromMs) }–${ this.fmt(g.toMs) } ・ ${ this.cl(g.cluster) } ・ ${ c }`;
    },
    // Rows with blocks: every type but the group heading.
    rowGaps(r) {
      return this.gapsBy[r.cluster] || [];
    },
    // Sub-lines of an actor: what the identity is, which setting a missing author depends on
    // (from the server), the ServiceAccount's namespace, and accounts active in the same cells.
    actorSub(a, withOverlap = true) {
      const out = [];
      const note = noteOf(this.T, a);

      if (note) {
        out.push({ text: note });
      }
      const s = settingNote(a);

      if (s) {
        out.push({ text: this.T.dependsAudit(this.cl(s.cluster)), cfg: true });
      }
      if (saNamespace(a)) {
        out.push({ text: this.T.saNs(saNamespace(a)) });
      }
      if (withOverlap && a.group === 'people') {
        for (const o of overlapsOf(this.overlaps, a.key)) {
          out.push({ text: this.T.overlap(this.otherName(o.other), this.fmt(o.fromMs), this.fmt(o.toMs), this.n(o.cells)), overlap: true });
        }
      }

      return out;
    },
    otherName(key) {
      return this.names[key] || key || this.T.tbc;
    },
  },
};
</script>

<template>
  <div class="ln">
    <div class="ln-axis">
      <div class="ln-l muted small">
        {{ axisLabel }}
      </div>
      <div class="ln-ticks">
        <span
          v-for="h in hours"
          :key="h"
          :class="{first: h === 0, last: h === 24}"
          :style="{left: hourLeft(h)}"
        >{{ String(h).padStart(2, '0') }}</span>
      </div>
    </div>
    <template
      v-for="r in rows"
      :key="r.key"
    >
      <button
        v-if="r.type === 'group'"
        type="button"
        class="ln-group"
        :aria-expanded="String(r.open)"
        @click="$emit('group', r.group)"
      >
        <span class="ln-l">
          <span
            class="tw"
            aria-hidden="true"
          >{{ r.open ? '▾' : '▸' }}</span>
          <b>{{ T.groups[r.group] }}</b>
        </span>
        <span class="ln-gsub">
          {{ T.groupLine(r.actors, r.behaviours, n(r.ops), r.group) }}
          <span class="muted">{{ T.groupHint[r.group] }}</span>
          <span class="ln-act">{{ r.open ? T.collapse : T.expand }}</span>
        </span>
      </button>
      <div
        v-else
        class="ln-row"
        :class="r.type"
      >
        <div
          v-if="r.type === 'actor'"
          class="ln-l"
        >
          <button
            type="button"
            class="ln-name"
            :aria-expanded="String(r.open)"
            :title="r.actor.name || null"
            @click="$emit('actor', r.actorKey)"
          >
            <span aria-hidden="true">{{ r.open ? '▾' : '▸' }}</span>
            <b>{{ actorLabel(T, r.actor) }}</b>
            <span
              v-if="r.multiCluster || r.actor.group === 'unrecorded'"
              class="muted"
            >・ {{ cl(r.cluster) }}</span>
          </button>
          <span
            v-for="(s, i) in actorSub(r.actor)"
            :key="i"
            class="s"
            :class="{cfg: s.cfg, ov: s.overlap}"
          >{{ s.text }}</span>
          <span class="s">{{ T.actorLine(r.count, n(r.ops)) }}</span>
        </div>
        <div
          v-else-if="r.type === 'merged'"
          class="ln-l"
        >
          <span
            class="n"
            :title="T.merged(T.groupShort[r.group])"
          >{{ T.merged(T.groupShort[r.group]) }}</span>
          <span class="s">{{ T.inCluster(cl(r.cluster)) }} ・ {{ T.mergedHint(r.group) }}</span>
          <span
            v-for="(s, i) in actorSub(r.actor, false).filter((x) => x.cfg)"
            :key="i"
            class="s cfg"
          >{{ s.text }}</span>
        </div>
        <div
          v-else-if="r.type === 'who'"
          class="ln-l"
        >
          <b
            class="n"
            :title="r.actor.name || null"
          >{{ actorLabel(T, r.actor) }}</b>
          <span
            v-for="(s, i) in actorSub(r.actor, false)"
            :key="i"
            class="s"
            :class="{cfg: s.cfg}"
          >{{ s.text }}</span>
        </div>
        <div
          v-else
          class="ln-l"
        >
          <span
            class="n"
            :title="scopeLabel(r.scope)"
          >{{ scopeLabel(r.scope) }}</span>
          <span class="s">{{ T.actorLine(r.behaviours.length, n(r.ops)) }}<template v-if="r.showCluster"> ・ {{ cl(r.cluster) }}</template></span>
        </div>
        <div class="ln-track">
          <i
            v-for="(g, i) in rowGaps(r)"
            :key="`g${i}`"
            class="ln-gap"
            :style="gapStyle(g)"
            :title="gapTitle(g)"
          />
          <template
            v-for="b in r.behaviours"
            :key="b.id"
          >
            <i
              v-for="(d, i) in marks(b).dashes"
              :key="`d${i}`"
              class="ln-dash"
              :class="cls(b)"
              :style="{left: `${d.left}%`, width: `${d.width}%`}"
            />
            <button
              v-for="(k, i) in marks(b).blocks"
              :key="`b${i}`"
              type="button"
              class="ln-blk"
              :class="[cls(b), {sel: sel === b.id}]"
              :style="{left: `${k.left}%`, width: `max(3px, calc(${k.width}% - 1px))`}"
              :title="blockLabel(b, k.seg)"
              :aria-label="blockLabel(b, k.seg)"
              :aria-pressed="String(sel === b.id)"
              @click="$emit('select', b.id)"
            />
            <span
              v-if="pin(b)"
              class="ln-pin"
              :style="{left: pin(b).left}"
            >{{ pin(b).text }}</span>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
