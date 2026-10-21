<script>
// Identity → via → cluster → object, four columns of an SVG. Line width = count, bypassing
// Rancher = red dashes. Clicking a node narrows the drawing to what it touched.
const COLS = ['identity', 'via', 'cluster', 'object'];
const W = 900;
const ROW = 46;
const NODE_W = [150, 130, 110, 230];
const X = [10, 250, 450, 660];

export default {
  name:  'AlRelationsGraph',
  props: {
    T:         { type: Object, required: true },
    relations: { type: Object, default: null },
    sel:       { type: String, default: '' },
    loading:   { type: Boolean, default: false },
  },
  emits: ['select'],
  data() {
    return { focus: null };
  },
  computed: {
    nodes() {
      return this.relations?.nodes || [];
    },
    edges() {
      return this.relations?.edges || [];
    },
    // Nodes reachable from the clicked node, both directions.
    kept() {
      if (!this.focus) {
        return null;
      }

      return this.reach(this.focus);
    },
    layout() {
      const byCol = COLS.map((c) => this.nodes.filter((n) => n.type === c && (!this.kept || this.kept.has(n.id))));
      const h = Math.max(...byCol.map((l) => l.length), 1) * ROW + 20;
      const pos = {};

      byCol.forEach((list, ci) => {
        const off = (h - list.length * ROW) / 2;

        list.forEach((n, i) => {
          pos[n.id] = {
            x: X[ci], y: off + i * ROW + 6, w: NODE_W[ci], ci
          };
        });
      });

      return { h, pos, byCol };
    },
    maxCount() {
      return Math.max(1, ...this.edges.map((e) => e.count || 1));
    },
    // Edges on the path from any identity to the selected object.
    selId() {
      return this.sel ? `object:${ this.sel }` : '';
    },
    lit() {
      if (!this.selId || !this.nodes.some((n) => n.id === this.selId)) {
        return null;
      }

      return this.reach(this.selId, true);
    },
    drawn() {
      const { pos } = this.layout;

      return this.edges.filter((e) => pos[e.from] && pos[e.to]).map((e) => {
        const a = pos[e.from];
        const b = pos[e.to];
        const x1 = a.x + a.w;
        const y1 = a.y + 14;
        const x2 = b.x;
        const y2 = b.y + 14;
        const mx = (x1 + x2) / 2;

        return {
          ...e,
          d:  `M${ x1 },${ y1 } C${ mx },${ y1 } ${ mx },${ y2 } ${ x2 },${ y2 }`,
          w:  1 + 5 * Math.sqrt((e.count || 1) / this.maxCount),
          on: !this.lit || (this.lit.has(e.from) && this.lit.has(e.to)),
        };
      });
    },
    focusLabel() {
      return this.nodes.find((n) => n.id === this.focus)?.label || '';
    },
  },
  watch: {
    relations() {
      if (this.focus && !this.nodes.some((n) => n.id === this.focus)) {
        this.focus = null;
      }
    },
  },
  methods: {
    reach(id, upstreamOnly = false) {
      const seen = new Set([id]);
      const walk = (dir) => {
        const stack = [id];

        while (stack.length) {
          const cur = stack.pop();

          this.edges.forEach((e) => {
            const [a, b] = dir ? [e.from, e.to] : [e.to, e.from];

            if (a === cur && !seen.has(b)) {
              seen.add(b);
              stack.push(b);
            }
          });
        }
      };

      walk(false);
      if (!upstreamOnly) {
        walk(true);
      }

      return seen;
    },
    click(n) {
      if (n.type === 'object') {
        this.$emit('select', n.id.replace(/^object:/, ''));
      } else {
        this.focus = this.focus === n.id ? null : n.id;
      }
    },
    label(n) {
      const l = n.type === 'via' ? (this.T.via[n.label] || n.label) : n.label;

      return l.length > 30 ? `${ l.slice(0, 29) }…` : l;
    },
    sub(n) {
      if (n.type === 'identity') {
        return this.T.category[n.category] || n.note || '';
      }

      if (n.type === 'via' && this.edges.some((e) => e.bypass && (e.from === n.id || e.to === n.id))) {
        return this.T.bypass;
      }

      return n.note || '';
    },
  },
  W,
  COLS,
};
</script>

<template>
  <div class="rel">
    <div class="rel-cols muted">
      <span
        v-for="(c, i) in T.relCols"
        :key="i"
        :style="{left: `${[10, 250, 450, 660][i] / 9}%`}"
      >{{ c }}</span>
    </div>
    <div
      v-if="focus"
      class="rel-filter"
    >
      {{ T.filterOn }}<b>{{ focusLabel }}</b>
      <button
        type="button"
        class="link"
        @click="focus = null"
      >
        {{ T.clear }}
      </button>
    </div>
    <p
      v-if="!loading && !nodes.length"
      class="muted"
    >
      {{ T.relEmpty }}
    </p>
    <svg
      v-else
      :viewBox="`0 0 ${$options.W} ${layout.h}`"
      :height="layout.h"
      class="rel-svg"
      role="img"
    >
      <path
        v-for="(e, i) in drawn"
        :key="`e${i}`"
        :d="e.d"
        class="edge"
        :class="{bypass: e.bypass, off: !e.on, on: lit && e.on}"
        :stroke-width="e.w"
      ><title>{{ e.count }}{{ e.bypass ? ` ・ ${T.bypass}` : '' }}</title></path>
      <g
        v-for="n in nodes.filter((x) => layout.pos[x.id])"
        :key="n.id"
        class="node"
        :class="[n.type, n.state, {group: n.group, focus: n.id === focus, sel: n.id === selId, bypass: n.bypass}]"
        :transform="`translate(${layout.pos[n.id].x},${layout.pos[n.id].y})`"
        tabindex="0"
        @click="click(n)"
        @keydown.enter="click(n)"
      >
        <rect
          :width="layout.pos[n.id].w"
          height="28"
          :rx="n.type === 'via' ? 14 : 4"
        />
        <text
          x="10"
          y="18"
        >{{ label(n) }}</text>
        <text
          v-if="n.state"
          :x="layout.pos[n.id].w - 8"
          y="18"
          text-anchor="end"
          class="st"
        >{{ T.states[n.state] }}</text>
        <text
          v-if="sub(n)"
          x="2"
          y="40"
          class="sub"
        >{{ sub(n) }}</text>
        <title>{{ n.label }}{{ n.bypass ? ` ・ ${T.bypass}` : '' }}</title>
      </g>
    </svg>
  </div>
</template>
