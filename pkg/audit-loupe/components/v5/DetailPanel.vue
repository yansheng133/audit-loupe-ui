<script>
import AlStateTag from './StateTag.vue';
import { KIND_TAG, kindOf } from '../../lib/model';
import {
  fmtTime, getHistory, parseKey, splitDepends, BATCH
} from '../../lib/v5';

// Plain JSON line diff, enough to show what changed between two stored versions.
function lines(body) {
  return JSON.stringify(body ?? null, null, 2).split('\n');
}

function diff(a, b) {
  const x = lines(a);
  const y = lines(b);
  const n = x.length;
  const m = y.length;

  // LCS table; versions are a few hundred lines at most.
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;

  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      i++; j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push({ op: '+', text: y[j++] });
    } else {
      out.push({ op: '-', text: x[i++] });
    }
  }

  return out;
}

export default {
  name:       'AlDetailPanel',
  components: { AlStateTag },
  props:      {
    T:      { type: Object, required: true },
    detail: { type: Object, default: null },
    row:    { type: Object, default: null },
    d0:     { type: Number, required: true },
    tz:     { type: String, required: true },
  },
  emits: ['close', 'copy'],
  data() {
    return {
      view: '', versions: null, vErr: '', a: null, b: null, openRaw: {}, copied: false
    };
  },
  computed: {
    key() {
      return this.detail?.key || '';
    },
    k() {
      return parseKey(this.key);
    },
    kindTag() {
      const kind = this.row?.kind || kindOf(this.k.resource);

      return KIND_TAG[kind] || String(kind || '').toUpperCase();
    },
    batch() {
      return !!this.detail?.batch || this.k.name === BATCH;
    },
    name() {
      return this.batch ? this.T.batch : this.row?.name || this.k.name;
    },
    deps() {
      return splitDepends(this.detail);
    },
    where() {
      return `${ this.k.cluster } / ${ this.k.namespace || this.T.clusterScope }`;
    },
    shownDiff() {
      const v = this.versions || [];

      if (this.view === 'last' && v.length) {
        return diff(v.length > 1 ? v[v.length - 2].body : null, v[v.length - 1].body);
      }
      if (this.view === 'compare' && v[this.a] && v[this.b]) {
        return diff(v[this.a].body, v[this.b].body);
      }

      return null;
    },
    current() {
      const v = this.versions || [];

      return this.view === 'current' && v.length ? JSON.stringify(v[v.length - 1].body, null, 2) : '';
    },
  },
  watch: {
    key() {
      this.view = '';
      this.versions = null;
      this.vErr = '';
      this.openRaw = {};
    },
  },
  methods: {
    pos(t) {
      return `${ Math.min(100, Math.max(0, ((t - this.d0) / 864e5) * 100)) }%`;
    },
    fmt(ms) {
      return fmtTime(ms, this.tz);
    },
    async show(view) {
      this.view = this.view === view ? '' : view;
      if (!this.view || this.versions) {
        return;
      }
      try {
        const key = this.key;
        // /api/history answers newest first; oldest first reads naturally here.
        const v = [...await getHistory(key)].sort((x, y) => Date.parse(x.observed) - Date.parse(y.observed));

        if (key === this.key) {
          this.versions = v;
          this.a = Math.max(0, v.length - 2);
          this.b = v.length - 1;
        }
      } catch (e) {
        this.vErr = `${ this.T.loadFailed }: ${ e.message }`;
      }
    },
    verLabel(v, i) {
      return `#${ i + 1 } ${ v.observed.slice(0, 10) } ${ fmtTime(Date.parse(v.observed), this.tz) } ${ v.change }`;
    },
    exportJson() {
      const blob = new Blob([JSON.stringify({ detail: this.detail, row: this.row }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');

      a.href = URL.createObjectURL(blob);
      a.download = `audit-loupe-${ this.name || 'object' }.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    async copy() {
      try {
        await navigator.clipboard.writeText(window.location.href);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 1500);
      } catch (e) {}
    },
  },
};
</script>

<template>
  <aside
    class="dt"
    aria-live="polite"
  >
    <div
      v-if="!detail"
      class="dt-empty muted"
    >
      {{ T.detail.pick }}
    </div>
    <div
      v-else-if="detail.none"
      class="dt-empty muted"
    >
      <b class="mono">{{ name }}</b> {{ T.detail.none }}
    </div>
    <template v-else>
      <div class="dt-head">
        <div class="dt-title">
          <span class="kind">{{ kindTag }}</span>
          <b
            :class="{mono: !batch}"
            :title="batch ? T.batchHint(k.resource) : ''"
          >{{ name }}</b>
          <button
            type="button"
            class="x"
            :aria-label="T.detail.close"
            :title="T.detail.close"
            @click="$emit('close')"
          >
            ×
          </button>
        </div>
        <div class="muted">
          {{ where }}
        </div>
        <div class="dt-state">
          <AlStateTag
            :T="T"
            :state="detail.state"
            :severity="detail.severity"
            :reason="detail.stateReason"
          />
          <span>{{ detail.stateReason }}</span>
        </div>
      </div>

      <div class="dt-body">
        <h3>{{ T.detail.strip }}</h3>
        <div class="strip">
          <i
            v-for="(s, i) in detail.strip || []"
            :key="i"
            :class="{alert: s.alert}"
            :style="{left: pos(s.t)}"
          />
        </div>
        <div class="strip-axis muted num">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
        </div>

        <div class="acts">
          <button
            v-for="[v, label] in [['last', T.detail.lastChange], ['current', T.detail.current], ['compare', T.detail.compare]]"
            :key="v"
            type="button"
            class="act"
            :class="{on: view === v}"
            :disabled="!detail.hasVersions"
            :title="detail.hasVersions ? '' : T.detail.noVersions"
            @click="show(v)"
          >
            <small>{{ T.detail.look }}</small><span>{{ label }}</span>
          </button>
        </div>
        <p
          v-if="!detail.hasVersions"
          class="muted small"
        >
          {{ T.detail.noVersions }}
        </p>

        <div
          v-if="view"
          class="ver"
        >
          <p
            v-if="vErr"
            class="err"
          >
            {{ vErr }}
          </p>
          <p
            v-else-if="!versions"
            class="muted"
          >
            {{ T.detail.loading }}
          </p>
          <template v-else>
            <div
              v-if="view === 'compare'"
              class="ver-pick"
            >
              <label>{{ T.detail.from }} <select v-model.number="a"><option
                v-for="(v, i) in versions"
                :key="i"
                :value="i"
              >{{ verLabel(v, i) }}</option></select></label>
              <label>{{ T.detail.to }} <select v-model.number="b"><option
                v-for="(v, i) in versions"
                :key="i"
                :value="i"
              >{{ verLabel(v, i) }}</option></select></label>
            </div>
            <pre
              v-if="current"
              class="code"
            >{{ current }}</pre>
            <template v-else-if="shownDiff">
              <p
                v-if="!shownDiff.length"
                class="muted"
              >
                {{ T.detail.noDiff }}
              </p>
              <pre
                v-else
                class="code"
              ><span
                v-for="(l, i) in shownDiff"
                :key="i"
                :class="l.op === '+' ? 'add' : 'del'"
              >{{ l.op }} {{ l.text }}
</span></pre>
            </template>
          </template>
        </div>

        <h3>{{ T.detail.who }}</h3>
        <ul class="ops">
          <li
            v-for="(o, i) in detail.ops || []"
            :key="i"
          >
            <span class="num t">{{ fmt(o.t) }}</span>
            <div>
              <div>
                <b>{{ o.who || T.category.unknown }}</b> {{ o.verb }}
                <small
                  v-if="o.category"
                  class="cat"
                >{{ T.category[o.category] || o.category }}</small>
              </div>
              <div class="muted small">
                {{ T.via[o.via] || o.via }}<template v-if="o.note">
                  ・ {{ o.note }}
                </template>
              </div>
              <button
                v-if="o.raw"
                type="button"
                class="link small"
                :aria-expanded="String(!!openRaw[i])"
                @click="openRaw = {...openRaw, [i]: !openRaw[i]}"
              >
                {{ T.detail.raw }}
              </button>
              <code
                v-if="o.raw && openRaw[i]"
                class="raw"
              >{{ o.raw.verb }} {{ o.raw.resource }} ・ {{ o.raw.user }}</code>
            </div>
          </li>
        </ul>

        <div
          v-for="(d, i) in deps.settings"
          :key="`d${i}`"
          class="depends"
        >
          <span class="badge">{{ T.detail.dependsOn }}：{{ d.setting }}</span>
          <div class="small">
            {{ d.text }}
          </div>
        </div>

        <template v-if="deps.related.length">
          <h3>{{ T.detail.related }}</h3>
          <ul class="related">
            <li
              v-for="(r, i) in deps.related"
              :key="`r${i}`"
              class="mono small"
            >
              {{ r }}
            </li>
          </ul>
        </template>
      </div>

      <div class="dt-foot">
        <button
          type="button"
          class="btn-al"
          @click="exportJson"
        >
          {{ T.detail.export }}
        </button>
        <button
          type="button"
          class="btn-al"
          @click="copy"
        >
          {{ copied ? T.detail.copied : T.detail.copy }}
        </button>
        <span
          class="chain"
          :class="detail.hashChain"
        >{{ T.detail.hashChain }}：{{ T.detail.chain[detail.hashChain] || detail.hashChain || '—' }}</span>
      </div>
    </template>
  </aside>
</template>
