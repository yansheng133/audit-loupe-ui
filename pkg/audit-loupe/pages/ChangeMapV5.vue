<script>
import AlStateTag from '../components/v5/StateTag.vue';
import AlOverviewTable from '../components/v5/OverviewTable.vue';
import AlDetailPanel from '../components/v5/DetailPanel.vue';
import AlEventsList from '../components/v5/EventsList.vue';
import AlRelationsGraph from '../components/v5/RelationsGraph.vue';
import AlTimelineBar from '../components/v5/TimelineBar.vue';
import {
  STATES, textsV5, viewFromQuery, queryFromView, apiParams, fetchChangemap, fetchDetail, takePrefetched, dayStartMs, prefetch, fmtTime
} from '../lib/v5';

// v5 change map (docs/design/v5/spec.md). One /api/changemap request per user action; the
// URL holds the whole view so a copied link reopens the same screen.

// The detail panel's width once dragged, remembered in this browser (a convenience; it may be
// unavailable). Until then it follows the page width (PANEL_AUTO).
const PANEL_KEY = 'audit-loupe.v5.panel-width';
const PANEL_AUTO = 'clamp(320px, 30%, 480px)';
const PANEL_MIN = 320;

function savedPanelWidth() {
  try {
    const w = parseInt(window.localStorage.getItem(PANEL_KEY), 10);

    return w >= PANEL_MIN ? w : null;
  } catch (e) {
    return null;
  }
}
export default {
  name:       'AuditLoupeChangeMapV5',
  components: {
    AlStateTag, AlOverviewTable, AlDetailPanel, AlEventsList, AlRelationsGraph, AlTimelineBar
  },

  // Send the request when the route is entered, not when the page has mounted (spec §10).
  beforeRouteEnter(to, from, next) {
    prefetch(to.query);
    next();
  },

  data() {
    const v = viewFromQuery(this.$route.query);

    return {
      T:          textsV5(this.$store),
      v,
      data:       null,
      rows:       [],
      next:       null,
      loading:    false,
      error:      '',
      missing:    false,
      detailOpen: true,
      seq:        0,
      full:       false,
      panelW:     savedPanelWidth(),
    };
  },

  computed: {
    tz() {
      return this.data?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    },
    d0() {
      return dayStartMs(this.v.day, this.tz);
    },
    counts() {
      return this.loading && !this.data ? null : this.data?.counts || null;
    },
    range() {
      return this.v.from !== null && this.v.to !== null ? [this.v.from, this.v.to] : null;
    },
    clusterOptions() {
      const set = new Set([...Object.keys(this.data?.asOf || {}), ...this.v.cluster]);

      return [...set].sort();
    },
    nsOptions() {
      const set = new Set(this.rows.map((r) => r.namespace).filter(Boolean));

      if (this.v.namespace) {
        set.add(this.v.namespace);
      }

      return [...set].sort();
    },
    notes() {
      return this.noteLines(this.data && this.data.meta);
    },
    detail() {
      return this.detailOpen ? this.data?.detail || null : null;
    },
    detailRow() {
      return this.detail ? this.rows.find((r) => r.key === this.detail.key) || null : null;
    },
    selKey() {
      return this.v.select || this.data?.detail?.key || '';
    },
    summary() {
      const c = this.counts;
      const f = this.v.system ? this.T.summarySys : this.T.summary;

      return f(c ? c.objects : '—', c ? c.ops : '—');
    },
  },

  watch: {
    '$route.query'(q) {
      const nv = viewFromQuery(q);
      const sig = (v, sel) => apiParams({ ...v, select: sel ? v.select : '' }).toString();
      const same = sig(nv, true) === sig(this.v, true);
      const onlySelect = !same && sig(nv) === sig(this.v);

      this.v = nv;
      if (!same) {
        if (onlySelect && nv.select) {
          this.loadDetail(nv.select);
        } else {
          this.load(null, onlySelect);
        }
      }
    },
  },

  created() {
    this.load();
  },

  mounted() {
    window.addEventListener('keydown', this.onKey);
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey);
  },

  methods: {
    // Change the view: update the URL; the route watcher sends the request when needed.
    set(patch) {
      const v = { ...this.v, ...patch };

      this.$router.replace({ query: queryFromView(v) }).catch(() => {});
    },

    async load(cursor = null, onlySelect = false) {
      const params = apiParams(this.v, cursor);
      const my = ++this.seq;

      this.loading = true;
      this.error = '';
      this.missing = false;
      try {
        const res = await ((!cursor && takePrefetched(params)) || fetchChangemap(params));

        if (my !== this.seq) {
          return;
        }
        // Each tab only returns its own blocks; keep what the other tabs already have. Picking
        // another object keeps the rows already loaded, so later pages stay.
        const keepRows = !cursor && onlySelect && this.rows.length;

        this.data = { ...(this.data || {}), ...res };
        if (!keepRows && res.rows) {
          this.rows = cursor ? [...this.rows, ...res.rows] : res.rows;
          this.next = res.next ?? null;
        }
        this.detailOpen = true;
      } catch (e) {
        if (my !== this.seq) {
          return;
        }
        console.error('audit-loupe: changemap failed', e); // eslint-disable-line no-console
        if ([403, 404, 503].includes(e.status)) {
          this.missing = true;
        } else {
          this.error = `${ this.T.loadFailed }: ${ e.message }`;
        }
      } finally {
        if (my === this.seq) {
          this.loading = false;
        }
      }
    },

    // A click on a row asks only for that object's detail (API v0.1). "No records that day"
    // comes back as { none: true } and is shown in the panel. A backend without the detail
    // call (older v0) answers a bare 404; then the whole page is asked for, as before.
    async loadDetail(key) {
      const my = ++this.seq;

      this.loading = true;
      try {
        const d = await fetchDetail(this.v, key);

        if (my === this.seq) {
          this.data = { ...(this.data || {}), detail: d };
          this.detailOpen = true;
        }
      } catch (e) {
        if (my !== this.seq) {
          return;
        }
        if (e.status === 404) {
          this.load(null, true);

          return;
        }
        console.error('audit-loupe: detail failed', e); // eslint-disable-line no-console
        this.error = `${ this.T.loadFailed }: ${ e.message }`;
      } finally {
        if (my === this.seq) {
          this.loading = false;
        }
      }
    },

    // The note row: the data note (prototype servers) and work in progress (API v0.2).
    noteLines(meta) {
      if (!meta) {
        return [];
      }
      const lines = [];

      if (meta.dataNote) {
        lines.push(`${ meta.dataNote } ・ ${ this.T.dataUntil } ${ meta.dataUntilMs ? `${ this.isoDay(meta.dataUntilMs) } ${ fmtTime(meta.dataUntilMs, this.tz) }` : '—' }`);
      }
      for (const p of meta.progress || []) {
        const what = p.what === 'recompute' ? this.T.progress.recompute(p.done ?? '—', p.total ?? '—') : (this.T.progress[p.what] || p.what);

        lines.push(`${ what }${ p.startedMs ? `（${ this.T.progress.since(fmtTime(p.startedMs, this.tz)) }）` : '' }`);
      }

      return lines;
    },

    isoDay(ms) {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: this.tz, year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date(ms));
      } catch (e) {
        return '';
      }
    },

    onKey(e) {
      if (e.key === 'Escape' && this.full) {
        this.full = false;
      }
    },

    setPanel(w) {
      const main = this.$el.querySelector('.al5-main');
      const max = Math.max(PANEL_MIN, Math.round((main?.clientWidth || 1200) * 0.7));

      this.panelW = Math.min(Math.max(Math.round(w), PANEL_MIN), max);
    },

    savePanel() {
      try {
        if (this.panelW) {
          window.localStorage.setItem(PANEL_KEY, String(this.panelW));
        } else {
          window.localStorage.removeItem(PANEL_KEY);
        }
      } catch (e) {}
    },

    // Drag the line between the list and the detail panel.
    startResize(e) {
      const main = this.$el.querySelector('.al5-main');
      const right = main.getBoundingClientRect().right;

      if (!this.panelW) {
        this.panelW = Math.round(main.lastElementChild.getBoundingClientRect().width);
      }
      const move = (ev) => this.setPanel(right - ev.clientX);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        this.savePanel();
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    },

    resizeKey(e) {
      const step = { ArrowLeft: 40, ArrowRight: -40 }[e.key];

      if (step) {
        this.setPanel((this.panelW || this.$el.querySelector('.al5-main').lastElementChild.getBoundingClientRect().width) + step);
        this.savePanel();
        e.preventDefault();
      }
    },

    resetPanel() {
      this.panelW = null;
      this.savePanel();
    },

    toggleState(s) {
      this.set({ state: this.v.state === s ? '' : s, select: '' });
    },

    setClusters(list) {
      this.set({
        cluster: list, namespace: '', select: '', from: null, to: null
      });
    },

    toggleCluster(c) {
      const cur = this.v.cluster;

      this.setClusters(cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c].sort());
    },

    select(key) {
      this.detailOpen = true;
      this.set({ select: key });
    },

    setRange(r) {
      this.set(r ? { from: r[0], to: r[1] } : { from: null, to: null });
    },
  },
  STATES,
  PANEL_AUTO,
};
</script>

<template>
  <div
    class="al5"
    :class="{'has-detail': !!detail, full}"
    :style="{'--al-panel': panelW ? `${ panelW }px` : $options.PANEL_AUTO}"
  >
    <div
      class="al5-bar"
      role="toolbar"
    >
      <nav
        class="tabs"
        role="tablist"
      >
        <button
          v-for="t in ['overview', 'relations', 'events']"
          :key="t"
          type="button"
          role="tab"
          :aria-selected="String(v.tab === t)"
          :class="{on: v.tab === t}"
          @click="set({tab: t})"
        >
          {{ T.tabs[t] }}
        </button>
      </nav>
      <div class="filters">
        <details class="multi">
          <summary>{{ T.cluster }} <b>{{ v.cluster.length ? v.cluster.join('、') : T.all }}</b></summary>
          <div class="multi-pop">
            <label
              v-for="c in clusterOptions"
              :key="c"
            ><input
              type="checkbox"
              :checked="v.cluster.includes(c)"
              @change="toggleCluster(c)"
            > {{ c }}</label>
            <button
              v-if="v.cluster.length"
              type="button"
              class="link"
              @click="setClusters([])"
            >
              {{ T.clear }}
            </button>
          </div>
        </details>
        <label>{{ T.namespace }}
          <select
            :value="v.namespace"
            @change="set({namespace: $event.target.value, select: ''})"
          >
            <option value="">{{ T.all }}</option>
            <option
              v-for="n in nsOptions"
              :key="n"
              :value="n"
            >{{ n }}</option>
          </select>
        </label>
        <label>{{ T.state }}
          <select
            :value="v.state"
            @change="set({state: $event.target.value, select: ''})"
          >
            <option value="">{{ T.all }}</option>
            <option
              v-for="s in $options.STATES"
              :key="s"
              :value="s"
            >{{ T.states[s] }}</option>
          </select>
        </label>
        <span
          class="tz"
          :title="T.tzHint(tz, data ? T.tzServer : 'browser')"
        >{{ T.tz }} {{ tz }}</span>
        <button
          type="button"
          class="btn-al full-btn"
          :aria-pressed="String(full)"
          :title="full ? T.exitFull : T.full"
          @click="full = !full"
        >
          {{ full ? '⤡' : '⤢' }} {{ full ? T.exitFull : T.full }}
        </button>
      </div>
    </div>
    <div
      class="al5-note"
      :class="{on: notes.length}"
      :role="notes.length ? 'note' : null"
    >
      <div
        v-for="(l, i) in notes"
        :key="i"
      >
        {{ l }}
      </div>
    </div>
    <div
      class="al5-progress"
      :class="{on: loading}"
      role="progressbar"
      :aria-label="T.busy"
      :aria-hidden="String(!loading)"
    />

    <div
      v-if="missing || error"
      class="banner-al"
    >
      {{ missing ? T.backendMissing : error }}
    </div>

    <div
      v-else
      class="al5-main"
    >
      <section class="al5-content">
        <template v-if="v.tab === 'overview'">
          <div class="ov-sum">
            <b class="num">{{ summary[0] }}</b> ・ <span class="num">{{ summary[1] }}</span>
            <AlStateTag
              v-for="s in $options.STATES"
              :key="s"
              :T="T"
              :value="s"
              :count="counts ? counts[s] : '—'"
              :active="v.state === s"
              clickable
              @click="toggleState(s)"
            />
          </div>
          <AlOverviewTable
            :T="T"
            :rows="rows"
            :loading="loading"
            :sel="selKey"
            :d0="d0"
            :tz="tz"
            :hidden="data && data.hidden"
            :system="v.system"
            :has-more="!!next"
            :range="range"
            @select="select"
            @system="(s) => set({system: s})"
            @more="load(next)"
          />
        </template>
        <AlRelationsGraph
          v-else-if="v.tab === 'relations'"
          :T="T"
          :relations="data && data.relations"
          :sel="selKey"
          :detail="data && data.detail"
          :loading="loading"
          @select="select"
        />
        <AlEventsList
          v-else
          :T="T"
          :events="(data && data.events) || []"
          :loading="loading"
          :tz="tz"
          :range="range"
          @select="select"
        />
      </section>
      <div
        v-if="detail"
        class="al5-resize"
        role="separator"
        aria-orientation="vertical"
        :aria-valuenow="panelW || undefined"
        :title="T.resize"
        tabindex="0"
        @pointerdown="startResize"
        @dblclick="resetPanel"
        @keydown="resizeKey"
      />
      <AlDetailPanel
        v-if="detail"
        :T="T"
        :detail="detail"
        :row="detailRow"
        :d0="d0"
        :tz="tz"
        @close="detailOpen = false"
      />
    </div>

    <AlTimelineBar
      :T="T"
      :timeline="data && data.timeline"
      :day="v.day"
      :d0="d0"
      :tz="tz"
      :range="range"
      @day="(d) => set({day: d, select: '', from: null, to: null})"
      @range="setRange"
    />
  </div>
</template>

<style lang="scss">
@import '../styles/change-map-v5.scss';
</style>
