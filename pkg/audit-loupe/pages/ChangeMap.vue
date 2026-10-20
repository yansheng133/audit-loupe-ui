<script>
import SidePanel from '../components/SidePanel.vue';
import TopologyMap from '../components/TopologyMap.vue';
import EvidencePanel from '../components/EvidencePanel.vue';
import TimeAxis from '../components/TimeAxis.vue';
import RecomputeBanner from '../components/RecomputeBanner.vue';
import FeedList from '../components/FeedList.vue';
import { PRODUCT, BLANK_CLUSTER, PAGES, routeName } from '../product';
import {
  getJson, backendCluster, setBackendCluster
} from '../lib/api';
import {
  texts, buildModel, coverageOf, dayStart, fmtMin, isRisky, sevOf, worst, pad
} from '../lib/model';

const LIMIT = 2000;
// Objects get their own column only when the page itself is wide enough (Rancher's menu
// collapsed, full screen, or an external monitor); otherwise they live in a tab. Measured
// on the page, not the window: a 1728px laptop with Rancher's menu open leaves ~1400px.
const WIDE_PX = 1500;
const NAV_CLASS = 'al-nav-collapsed';
const PREFS = 'audit-loupe.layout';

function readPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function writePrefs(p) {
  try {
    window.localStorage.setItem(PREFS, JSON.stringify(p));
  } catch (e) {}
}

function isoDay(d) {
  return `${ d.getFullYear() }-${ pad(d.getMonth() + 1) }-${ pad(d.getDate()) }`;
}

export default {
  name:       'AuditLoupeChangeMap',
  components: {
    RecomputeBanner,
    SidePanel, TopologyMap, EvidencePanel, TimeAxis, FeedList
  },

  data() {
    const q = this.$route.query || {};
    const prefs = readPrefs();

    return {
      navCollapsed: !!prefs.navCollapsed,
      tlOpen:       prefs.tlOpen !== false,
      full:         false,
      wide:         false,
      tab:          'attention',
      tabPicked:    false,
      dayFrom:      dayStart(`${ q.day || isoDay(new Date()) }T00:00:00`).getTime(),
      T:          texts(this.$store),
      day:        q.day || isoDay(new Date()),
      a:          0,
      b:          1440,
      cluster:    q.cluster || '',
      project:    '',
      ns:         '',
      actor:      '',
      lifetime:   '',
      sys:        false,
      sel:        null,
      selEvent:   null,
      related:    [],
      model:      { OBJ: {}, ACTORS: {}, EVENTS: [] },
      stories:    [],
      clusters:   [],
      coverageRows: [],
      work:       [9, 18],
      loading:    false,
      error:      null,
      missing:    false,
      truncated:  false,
      backend:    backendCluster(),
      backendIn:  backendCluster(),
    };
  },

  computed: {
    OBJ() {
      return this.model.OBJ;
    },
    ACTORS() {
      return this.model.ACTORS;
    },
    EVENTS() {
      return this.model.EVENTS;
    },
    lifetimeRange() {
      if (!this.lifetime || !this.actor) {
        return null;
      }
      const l = (this.ACTORS[this.actor]?.lifetimes || []).find((x) => x.uid === this.lifetime);

      return l ? [l.created_ms, l.deleted_ms || Number.MAX_SAFE_INTEGER] : null;
    },
    // Scope: cluster, project, namespace, system components. Not time or person.
    scoped() {
      return this.EVENTS.filter((ev) => {
        const o = this.OBJ[ev.obj];

        if (!this.sys && this.ACTORS[ev.actor].system) {
          return false;
        }
        if (this.cluster && o.cluster !== this.cluster) {
          return false;
        }
        if (this.project && o.project !== this.project) {
          return false;
        }

        return !this.ns || o.ns === this.ns;
      });
    },
    personScoped() {
      return this.scoped.filter((ev) => this.matchesPerson(ev));
    },
    visible() {
      return this.personScoped.filter((ev) => this.inRange(ev));
    },
    inRangeScoped() {
      return this.scoped.filter((ev) => this.inRange(ev));
    },
    clusterOptions() {
      return [...new Set(Object.values(this.OBJ).map((o) => o.cluster))].sort().map((c) => [c, this.clusterName(c) || c]);
    },
    projectOptions() {
      const objs = Object.values(this.OBJ).filter((o) => !this.cluster || o.cluster === this.cluster);

      return [...new Set(objs.map((o) => o.project))].sort();
    },
    nsOptions() {
      const objs = Object.values(this.OBJ).filter((o) => (!this.cluster || o.cluster === this.cluster) && (!this.project || o.project === this.project));

      return [...new Set(objs.map((o) => o.ns))].sort();
    },
    actorOptions() {
      return Object.values(this.ACTORS).filter((a) => this.sys || !a.system).map((a) => [a.key, a.role ? `${ a.label }（${ a.role }）` : a.label]);
    },
    coverage() {
      const out = {};

      this.clusterOptions.forEach(([c]) => {
        out[c] = coverageOf(this.clusters.find((x) => x.cluster === c), this.T, this.coverageRows.find((x) => x.cluster === c));
      });

      return out;
    },
    // Server-side stories, kept when at least one of their events is visible now.
    visibleStories() {
      const vis = new Set(this.visible.map((e) => e.id));
      const byId = new Map(this.EVENTS.map((e) => [e.id, e]));

      return this.stories
        .map((s) => ({ ...s, evs: s.events.map((e) => byId.get(`e${ e.id }`)).filter(Boolean) }))
        .filter((s) => s.evs.some((e) => vis.has(e.id)));
    },
    dayLabel() {
      return this.day;
    },
    tabs() {
      const L = this.T.layout.tabs;
      const t = [['attention', L.attention, this.visibleStories.length], ['feed', L.feed, this.visible.length]];

      if (!this.wide) {
        t.push(['objects', L.objects, this.changedCount]);
      }
      t.push(['people', L.people, null]);

      return t;
    },
    activeTab() {
      return this.wide && this.tab === 'objects' ? 'attention' : this.tab;
    },
    changedCount() {
      return new Set(this.visible.filter((e) => e.change).map((e) => e.obj)).size;
    },
    stats() {
      return [
        [this.visible.length, this.T.ops],
        [this.changedCount, this.T.objChanged],
        [this.visible.filter(isRisky).length, this.T.needAttention],
      ];
    },
    hiddenSystem() {
      if (this.sys) {
        return 0;
      }

      return this.EVENTS.filter((ev) => this.ACTORS[ev.actor].system && this.inRange(ev)).length;
    },
    // One sentence for the day: the most serious stories first.
    summary() {
      const L = this.T.layout;
      const cards = this.visibleStories.map((s) => {
        const sev = worst(s.evs.map(sevOf)) || s.severity;
        const first = s.evs[0];
        const o = this.OBJ[first.obj];
        const who = this.ACTORS[first.actor]?.label || s.actor;

        return { sev, text: `${ who } ${ first.verb } ${ o.kind } ${ o.name }（${ this.T.sev[sev] || sev }）` };
      }).filter((c) => ['high', 'medium'].includes(c.sev)).sort((x, y) => (x.sev === y.sev ? 0 : (x.sev === 'high' ? -1 : 1)));

      if (!cards.length) {
        return L.summaryQuiet;
      }
      const shown = cards.slice(0, 2).map((c) => c.text).join('；');

      return L.summaryAttn(cards.length, cards.length > 2 ? `${ shown } ${ L.summaryMore(cards.length - 2) }` : shown);
    },
    gaps() {
      const L = this.T.layout;
      const out = [];

      this.coverageRows.forEach((row) => {
        (row.gaps || []).forEach((g) => {
          const kind = this.T.cov.kinds[g.collector] || g.collector;
          const at = (ms) => fmtMin(Math.max(0, Math.min(1439, Math.floor((ms - this.dayFrom) / 60000))));
          const cluster = this.clusterName(row.cluster) || row.cluster;

          out.push({
            key:  `${ row.cluster }|${ g.collector }|${ g.instance }|${ g.fromMs }`,
            text: g.toMs ? L.gap(cluster, kind, at(g.fromMs), at(g.toMs)) : L.gapOpen(cluster, kind, at(g.fromMs)),
            // Only logs the collector reads from disk can be lost to rotation.
            cfg:  ['file', 'rancher'].includes(g.collector),
          });
        });
      });

      return out;
    },
    navLinks() {
      const t = this.$store.getters['i18n/t'];

      return PAGES.map((page) => ({
        page,
        label: t ? t(`auditLoupe.nav.${ page }`) : page,
        to:    { name: routeName(page), params: { product: PRODUCT, cluster: BLANK_CLUSTER } },
        on:    page === 'changes',
      }));
    },
  },

  watch: {
    day() {
      this.dayFrom = dayStart(`${ this.day }T00:00:00`).getTime();
      this.sel = null;
      this.selEvent = null;
      this.load();
    },
    cluster() {
      this.project = '';
      this.ns = '';
      this.sel = null;
    },
    project() {
      this.ns = '';
      this.sel = null;
    },
    ns() {
      this.sel = null;
    },
    actor() {
      this.lifetime = '';
    },
    sel(k) {
      this.loadRelated(k);
    },
  },

  mounted() {
    this.applyNav();
    this.ro = new ResizeObserver(([e]) => {
      this.wide = e.contentRect.width >= WIDE_PX;
    });
    this.ro.observe(this.$el);
    this.onKey = (e) => {
      if (e.key === 'Escape' && this.full) {
        this.full = false;
      }
    };
    window.addEventListener('keydown', this.onKey);
    this.load();
  },

  beforeUnmount() {
    // The collapsed menu belongs to this page only; other pages get Rancher's menu back.
    document.documentElement.classList.remove(NAV_CLASS);
    this.ro?.disconnect();
    window.removeEventListener('keydown', this.onKey);
  },

  methods: {
    fmtMin,

    inRange(ev) {
      return ev.t >= this.a && ev.t <= this.b;
    },

    matchesPerson(ev) {
      if (!this.actor) {
        return true;
      }
      if (ev.actor !== this.actor) {
        return false;
      }
      const r = this.lifetimeRange;

      return !r || (ev.ts >= r[0] && ev.ts < r[1]);
    },

    clusterName(id) {
      try {
        const c = this.$store.getters['management/byId']('management.cattle.io.cluster', id);

        return c?.nameDisplay || c?.spec?.displayName || '';
      } catch (e) {
        return '';
      }
    },

    projectName(cluster, pid) {
      try {
        const p = this.$store.getters['management/byId']('management.cattle.io.project', `${ cluster }/${ pid }`);

        return p?.nameDisplay || p?.spec?.displayName || '';
      } catch (e) {
        return '';
      }
    },

    async load() {
      this.loading = true;
      this.error = null;
      this.missing = false;
      const from = dayStart(`${ this.day }T00:00:00`);
      const to = new Date(from.getTime() + 86400000);
      const range = { from: from.toISOString(), to: to.toISOString() };

      try {
        // Cluster and project names come from Rancher itself.
        await Promise.all([
          this.$store.dispatch('management/findAll', { type: 'management.cattle.io.cluster' }).catch(() => {}),
          this.$store.dispatch('management/findAll', { type: 'management.cattle.io.project' }).catch(() => {}),
        ]);
        const [info, rows, unattributed, actors, stories, clusters, nsProjects, coverageRows] = await Promise.all([
          getJson('/api/info'),
          getJson('/api/timeline', { ...range, all: 1, limit: LIMIT }),
          getJson('/api/unattributed', range),
          getJson('/api/actors', range),
          getJson('/api/stories', range),
          getJson('/api/clusters', range),
          getJson('/api/projects'),
          getJson('/api/coverage', range).catch(() => []),
        ]);
        const [ws, we] = String(info.workHours || '9-18').split('-').map(Number);

        this.work = [ws || 9, we || 18];
        this.truncated = rows.length >= LIMIT;
        this.model = buildModel({
          rows, unattributed, actors, nsProjects, day: from, T: this.T, clusterName: this.clusterName, projectName: this.projectName,
        });
        this.stories = stories;
        this.clusters = clusters;
        this.coverageRows = coverageRows;
        // With nothing to look into, open on the full list instead of an empty tab.
        if (!this.tabPicked) {
          this.tab = this.visibleStories.length ? 'attention' : 'feed';
        }
        this.openFirstStory();
      } catch (e) {
        console.error('audit-loupe: load failed', e); // eslint-disable-line no-console
        if ([403, 404, 503].includes(e.status)) {
          this.missing = true;
        } else {
          this.error = `${ this.T.error }: ${ e.message }`;
        }
      } finally {
        this.loading = false;
      }
    },

    async loadRelated(k) {
      this.related = [];
      const o = k && this.OBJ[k];

      if (!o) {
        return;
      }
      try {
        const rows = await getJson('/api/related', {
          cluster: o.cluster, kind: o.kind, namespace: o.namespace, name: o.name
        });

        if (this.sel === k) {
          this.related = rows.map((r) => ({ ...r, key: `${ o.cluster }|${ r.kind }|${ r.namespace }|${ r.name }` }));
        }
      } catch (e) {
        this.related = [];
      }
    },

    // Open on the most serious item so every column has something to show.
    openFirstStory() {
      const s = this.visibleStories[0];
      const recent = [...this.visible].reverse();
      // Most serious first; with nothing risky, the latest change, so the evidence is never empty.
      const ev = s ? s.evs[0] : (recent.find(isRisky) || recent.find((e) => e.change) || recent[0]);

      if (ev) {
        this.select(ev.obj, ev.id);
      }
    },

    select(k, evId) {
      if (!k) {
        this.sel = null;
        this.selEvent = null;

        return;
      }
      const evs = this.scoped.filter((e) => e.obj === k);

      this.sel = k;
      this.selEvent = evId || ([...evs].reverse().find((e) => this.inRange(e) && this.matchesPerson(e)) || evs[evs.length - 1] || {}).id || null;
    },

    setActor(key) {
      this.actor = this.actor === key ? '' : key;
    },

    setLifetime(key, uid) {
      this.actor = key;
      this.$nextTick(() => {
        this.lifetime = this.lifetime === uid ? '' : uid;
      });
    },

    setRange([a, b]) {
      this.a = a;
      this.b = b;
    },

    reset() {
      Object.assign(this, {
        a: 0, b: 1440, cluster: '', project: '', ns: '', actor: '', lifetime: ''
      });
    },

    applyNav() {
      document.documentElement.classList.toggle(NAV_CLASS, this.navCollapsed && !this.full);
    },

    savePrefs() {
      writePrefs({ navCollapsed: this.navCollapsed, tlOpen: this.tlOpen });
    },

    toggleNav() {
      if (this.full) {
        return;
      }
      this.navCollapsed = !this.navCollapsed;
      this.applyNav();
      this.savePrefs();
    },

    toggleFull() {
      this.full = !this.full;
      this.applyNav();
    },

    toggleTimeline() {
      this.tlOpen = !this.tlOpen;
      this.savePrefs();
    },

    applyBackend() {
      setBackendCluster(this.backendIn.trim());
      this.backend = backendCluster();
      this.load();
    },
  },
};
</script>

<template>
  <div
    class="al al-map"
    :class="{'al-full': full, 'al-wide': wide}"
  >
    <div
      class="al-bar"
      role="group"
      :aria-label="T.title"
    >
      <button
        type="button"
        class="al-icon"
        :disabled="full"
        :aria-label="navCollapsed ? T.layout.navExpand : T.layout.navCollapse"
        :title="navCollapsed ? T.layout.navExpand : T.layout.navCollapse"
        @click="toggleNav"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        ><rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
        /><path d="M9 4v16" /></svg>
      </button>
      <h1>{{ T.title }}</h1>
      <div class="al-filters">
        <input
          v-model="day"
          type="date"
          :aria-label="T.layout.date"
          :title="T.layout.date"
        >
        <select
          v-model="cluster"
          :class="{active: cluster}"
          :aria-label="T.cluster"
          :title="T.cluster"
        >
          <option value="">
            {{ T.allClusters }}
          </option>
          <option
            v-for="[id, label] in clusterOptions"
            :key="id"
            :value="id"
          >
            {{ label }}
          </option>
        </select>
        <select
          v-model="project"
          :class="{active: project}"
          :aria-label="T.project"
          :title="T.project"
        >
          <option value="">
            {{ T.allProjects }}
          </option>
          <option
            v-for="p in projectOptions"
            :key="p"
            :value="p"
          >
            {{ p }}
          </option>
        </select>
        <select
          v-model="ns"
          :class="{active: ns}"
          aria-label="Namespace"
          title="Namespace"
        >
          <option value="">
            {{ T.allNs }}
          </option>
          <option
            v-for="n in nsOptions"
            :key="n"
            :value="n"
          >
            {{ n }}
          </option>
        </select>
        <select
          v-model="actor"
          :class="{active: actor}"
          :aria-label="T.whoDid"
          :title="T.whoDid"
        >
          <option value="">
            {{ T.everyone }}
          </option>
          <option
            v-for="[k, label] in actorOptions"
            :key="k"
            :value="k"
          >
            {{ label }}
          </option>
        </select>
        <label class="check"><input
          v-model="sys"
          type="checkbox"
        >{{ T.withSystem }}</label>
        <button
          class="btn-al"
          type="button"
          @click="reset"
        >
          {{ T.reset }}
        </button>
      </div>
      <button
        type="button"
        class="al-icon framed"
        :class="{on: full}"
        :aria-label="full ? T.layout.fullExit : T.layout.fullEnter"
        :title="full ? T.layout.fullExit : T.layout.fullEnter"
        @click="toggleFull"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        ><path :d="full ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'" /></svg>
      </button>
    </div>

    <RecomputeBanner
      v-if="!missing"
      @done="load"
    />

    <div
      v-if="missing || error"
      class="banner-al"
    >
      <span>{{ missing ? T.backendMissing : error }}</span>
      <template v-if="missing">
        <label class="check">{{ T.backendCluster }}
          <input
            v-model="backendIn"
            type="text"
            size="14"
          ></label>
        <button
          class="btn-al"
          type="button"
          @click="applyBackend"
        >
          {{ T.backendSave }}
        </button>
      </template>
    </div>

    <template v-else>
      <section
        class="al-summary"
        :aria-label="T.needAttention"
      >
        <div class="al-sum-text">
          <div class="al-sum-head">
            {{ loading ? T.loading : summary }}
          </div>
          <div
            v-if="truncated || hiddenSystem"
            class="muted"
          >
            <span v-if="truncated">{{ T.truncated(2000) }}</span>
            <span v-if="truncated && hiddenSystem">・</span>
            <span v-if="hiddenSystem">{{ T.layout.sysHidden(hiddenSystem) }}</span>
          </div>
        </div>
        <div class="al-stats">
          <div
            v-for="[v, k] in stats"
            :key="k"
            class="al-stat"
          >
            <b class="num">{{ v }}</b><span>{{ k }}</span>
          </div>
        </div>
        <div
          v-for="g in gaps"
          :key="g.key"
          class="al-gap"
        >
          <span
            v-if="g.cfg"
            class="cfgtag"
          >{{ T.layout.cfgRotation }}</span>
          <span>{{ g.text }}</span>
          <span
            v-if="g.cfg"
            class="muted"
          >{{ T.layout.gapNote }}</span>
        </div>
      </section>

      <div class="al-body">
        <nav
          v-if="navCollapsed && !full"
          class="al-rail"
          aria-label="Audit Loupe"
        >
          <router-link
            v-for="n in navLinks"
            :key="n.page"
            :to="n.to"
            class="al-rail-item"
            :class="{on: n.on}"
            :title="n.label"
            :aria-label="n.label"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <template v-if="n.page === 'changes'"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></template>
              <template v-else-if="n.page === 'access'"><circle
                cx="8"
                cy="15"
                r="4"
              /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></template>
              <template v-else-if="n.page === 'coverage'"><path d="M3 12h4l3-7 4 14 3-7h4" /></template>
              <template v-else><path d="M4 6h10M4 12h16M4 18h7" /><circle
                cx="17"
                cy="6"
                r="2"
              /><circle
                cx="14"
                cy="18"
                r="2"
              /></template>
            </svg>
          </router-link>
        </nav>

        <div class="al-grid">
          <section class="col">
            <div
              class="al-tabs"
              role="tablist"
            >
              <button
                v-for="[k, label, n] in tabs"
                :key="k"
                type="button"
                role="tab"
                class="al-tab"
                :class="{on: activeTab === k}"
                :aria-selected="activeTab === k ? 'true' : 'false'"
                @click="tab = k; tabPicked = true"
              >
                {{ label }}<span
                  v-if="n !== null"
                  class="num al-tab-n"
                >{{ n }}</span>
              </button>
            </div>
            <div class="col-body">
              <SidePanel
                v-if="activeTab === 'attention' || activeTab === 'people'"
                :T="T"
                :show="activeTab"
                :visible="visible"
                :base="inRangeScoped"
                :stories="visibleStories"
                :ACTORS="ACTORS"
                :OBJ="OBJ"
                :actor="actor"
                :lifetime="lifetime"
                :sel-event="selEvent"
                :loading="loading"
                :truncated="truncated"
                @select="select"
                @actor="setActor"
                @lifetime="setLifetime"
              />
              <FeedList
                v-else-if="activeTab === 'feed'"
                :T="T"
                :events="visible"
                :ACTORS="ACTORS"
                :OBJ="OBJ"
                :sel-event="selEvent"
                @select="select"
              />
              <TopologyMap
                v-else
                :T="T"
                :visible="visible"
                :OBJ="OBJ"
                :ACTORS="ACTORS"
                :sel="sel"
                :related="related"
                :coverage="coverage"
                @select="select"
              />
            </div>
          </section>

          <section
            v-if="wide"
            class="col"
          >
            <div class="col-head">
              <h2>{{ T.changedObjects }}</h2>
              <div class="legend">
                <span><i
                  class="lg"
                  style="background:var(--al-added)"
                />{{ T.added }}</span>
                <span><i
                  class="lg"
                  style="background:var(--al-modified)"
                />{{ T.modified }}</span>
                <span><i
                  class="lg"
                  style="background:var(--al-deleted)"
                />{{ T.deleted }}</span>
                <span><i
                  class="lg"
                  style="background:var(--al-none)"
                />{{ T.readOnly }}</span>
              </div>
            </div>
            <div class="col-body">
              <TopologyMap
                :T="T"
                :visible="visible"
                :OBJ="OBJ"
                :ACTORS="ACTORS"
                :sel="sel"
                :related="related"
                :coverage="coverage"
                @select="select"
              />
            </div>
          </section>

          <section
            class="col"
            aria-live="polite"
          >
            <div class="col-head">
              <h2>{{ T.evidence }}</h2><span class="muted">{{ T.evidenceHint }}</span>
            </div>
            <div class="col-body">
              <EvidencePanel
                :T="T"
                :obj="sel ? OBJ[sel] : null"
                :events="sel ? scoped.filter((e) => e.obj === sel) : []"
                :in-range="(e) => inRange(e) && matchesPerson(e)"
                :sel-event="selEvent"
                :ACTORS="ACTORS"
                :OBJ="OBJ"
                :related="related"
                @pick="(id) => selEvent = id"
                @select="select"
              />
            </div>
          </section>
        </div>
      </div>

      <TimeAxis
        :T="T"
        :open="tlOpen"
        :events="personScoped"
        :ACTORS="ACTORS"
        :OBJ="OBJ"
        :a="a"
        :b="b"
        :sel-event="selEvent"
        :work="work"
        :day="dayLabel"
        @range="setRange"
        @select="select"
        @toggle="toggleTimeline"
      />
    </template>
  </div>
</template>

<style lang="scss">
@import '../styles/change-map.scss';
</style>
