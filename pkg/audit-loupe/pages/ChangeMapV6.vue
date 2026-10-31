<script>
import AlLanes from '../components/v6/Lanes.vue';
import AlFindingsList from '../components/v6/FindingsList.vue';
import AlIdentitiesView from '../components/v6/IdentitiesView.vue';
import AlScopesView from '../components/v6/ScopesView.vue';
import AlBehaviourDetail from '../components/v6/BehaviourDetail.vue';
import AlStripBar from '../components/v6/StripBar.vue';
import MultiPick from '../components/v5/MultiPick.vue';
import { fmtTime, todayIso, clusterLabel, dayStartMs } from '../lib/v5';
import { textsV6 } from '../lib/v6text';
import {
  TABS, normalize, viewFromQuery, queryFromView, apiParams, listSig, fetchBehaviours, fetchBehaviourDetail, prefetch, takePrefetched,
  activityRows, actorsOpen, flipActor, behaviourSpan, summaryChips, headline, defaultIdentity, defaultPlace, actorLabel
} from '../lib/v6';
import { backendMessage } from '../lib/api';
import { PRODUCT, BLANK_CLUSTER, routeName } from '../product';

// v6 change map (docs/api/behaviors-v0.md, task book 1101 §4): four tabs over the behaviours
// the server cut the day into. One /api/behaviors request opens the page; picking a behaviour
// asks only for its detail. The URL holds the whole view, so a copied link reopens the screen.

const PANEL_KEY = 'audit-loupe.v6.panel-width';
const PANEL_AUTO = 'clamp(340px, 30%, 480px)';
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
  name:       'AuditLoupeChangeMapV6',
  components: {
    AlLanes, AlFindingsList, AlIdentitiesView, AlScopesView, AlBehaviourDetail, AlStripBar, MultiPick
  },

  // Send the request when the route is entered, not when the page has mounted.
  beforeRouteEnter(to, from, next) {
    prefetch(viewFromQuery(to.query, todayIso()));
    next();
  },

  data() {
    return {
      T:             textsV6(this.$store),
      v:             viewFromQuery(this.$route.query, todayIso()),
      data:          null,
      loading:       false,
      error:         '',
      missing:       false,
      old:           false,
      details:       {},
      detailLoading: false,
      detailError:   '',
      detailOpen:    true,
      seq:           0,
      dseq:          0,
      full:          false,
      panelW:        savedPanelWidth(),
      clusterIds:    [],
    };
  },

  computed: {
    tz() {
      return this.data?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    },
    d0() {
      return this.data?.dayStartMs ?? dayStartMs(this.v.day, this.tz);
    },
    dayMs() {
      const s = this.data?.dayStartMs;
      const e = this.data?.dayEndMs;

      return s !== null && s !== undefined && e ? e - s : 864e5;
    },
    list() {
      return this.data?.behaviours || [];
    },
    building() {
      return (this.data?.meta?.progress || []).some((p) => p.what === 'behaviors');
    },
    selId() {
      return this.v.select || this.data?.selected || '';
    },
    selB() {
      return this.list.find((b) => b.id === this.selId) || null;
    },
    selDetail() {
      return this.details[this.selId] || null;
    },
    mark() {
      return behaviourSpan(this.selB);
    },
    names() {
      const m = {};

      for (const a of this.data?.actors || []) {
        m[a.key] = actorLabel(this.T, a);
      }

      return m;
    },
    lookList() {
      const ids = (this.data?.summary?.look || []).map((x) => String(x.id));

      return ids.map((id) => this.list.find((b) => b.id === id)).filter(Boolean);
    },
    // "This day has N behaviours. X to look at: … The rest is ordinary or routine."
    lead() {
      const s = this.data?.summary;

      if (!s) {
        return '';
      }
      const look = s.look || [];
      const titles = look.map((x) => headline(this.T, {
        title: x.title, scope: '', what: []
      })).join(this.T.zh ? '；' : '; ');
      const n = s.behaviors ?? this.T.tbc;

      return `${ this.T.summary(n) }${ look.length ? this.T.summaryLook(look.length, titles) : this.T.summaryNone }${ this.T.summaryRest }`;
    },
    chips() {
      return summaryChips(this.data?.summary);
    },
    longGaps() {
      return this.data?.summary?.longGaps || [];
    },
    hidden() {
      const h = this.data?.hidden;

      if (!h) {
        return '';
      }
      const n = (x) => x ?? this.T.tbc;

      return this.T.hiddenLine({
        system: n(h.system), uiMaintenance: n(h.uiMaintenance), requestOnly: n(h.requestOnly), failed: n(h.failed), failedSystem: n(h.failedSystem)
      });
    },
    settingsLine() {
      const s = this.data?.settings;

      return s ? this.T.rulesLine(s.cellMinutes ?? this.T.tbc, s.joinMinutes ?? this.T.tbc) : '';
    },
    activity() {
      return activityRows(this.list, { groups: this.v.open, actors: actorsOpen(this.v, this.list) });
    },
    who() {
      return this.v.who ?? defaultIdentity(this.list);
    },
    place() {
      return this.v.place ?? defaultPlace(this.list);
    },
    clusterOptions() {
      const set = new Set([...this.list.map((b) => b.cluster), ...(this.data?.gaps || []).map((g) => g.cluster), ...this.clusterIds, ...this.v.cluster]);

      set.delete('');

      return [...set].map((c) => ({ value: c, label: clusterLabel(this.$store, c) })).sort((a, b) => a.label.localeCompare(b.label));
    },
    notes() {
      const meta = this.data?.meta;
      const lines = [];

      if (!meta) {
        return lines;
      }
      if (meta.dataNote) {
        lines.push(`${ meta.dataNote } ・ ${ this.T.dataUntil } ${ meta.dataUntilMs ? fmtTime(meta.dataUntilMs, this.tz) : this.T.tbc }`);
      }
      for (const p of meta.progress || []) {
        if (p.what === 'behaviors') {
          lines.push(this.T.building);
        } else if (p.what === 'recompute') {
          lines.push(this.T.progress.recompute(p.done ?? this.T.tbc, p.total ?? this.T.tbc));
        } else {
          lines.push(this.T.progress[p.what] || p.what);
        }
      }

      return lines;
    },
  },

  watch: {
    '$route.query'(q) {
      const nv = viewFromQuery(q, todayIso());
      const reload = listSig(nv) !== listSig(this.v);
      const reselect = nv.select !== this.v.select;

      this.v = nv;
      if (reload) {
        this.load();
      } else if (reselect && nv.select) {
        this.loadDetail(nv.select);
      }
    },
  },

  created() {
    this.load();
    this.$store.dispatch('management/findAll', { type: 'management.cattle.io.cluster' })
      .then((list) => {
        this.clusterIds = (list || []).map((c) => c.id);
      })
      .catch(() => {});
  },

  mounted() {
    window.addEventListener('keydown', this.onKey);
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey);
  },

  methods: {
    set(patch) {
      const v = { ...this.v, ...patch };

      this.$router.replace({ query: queryFromView(v) }).catch(() => {});
    },

    async load() {
      const params = apiParams(this.v);
      const my = ++this.seq;

      this.loading = true;
      this.error = '';
      this.missing = false;
      this.old = false;
      try {
        const res = normalize(await (takePrefetched(params) || fetchBehaviours(params)));

        if (my !== this.seq) {
          return;
        }
        this.data = res;
        this.details = res.detail && res.selected ? { [String(res.selected)]: res.detail } : {};
        this.detailOpen = true;
        // A link to a behaviour that is gone (judged again) falls back to the server's pick.
        if (this.v.select && !res.behaviours.some((b) => b.id === this.v.select)) {
          this.set({ select: '' });
        }
      } catch (e) {
        if (my !== this.seq) {
          return;
        }
        console.error('audit-loupe: behaviors failed', e); // eslint-disable-line no-console
        // A 404 from the backend itself (not Kubernetes' "no such service") means an older
        // backend without /api/behaviors.
        this.old = e.status === 404 && e.body?.kind !== 'Status';
        this.missing = this.old ? this.T.oldBackend : (backendMessage(this.T, e) || false);
        if (!this.missing) {
          this.error = `${ this.T.loadFailed }: ${ e.message }`;
        }
      } finally {
        if (my === this.seq) {
          this.loading = false;
        }
      }
    },

    async loadDetail(id) {
      if (this.details[id]) {
        return;
      }
      const my = ++this.dseq;

      this.detailLoading = true;
      this.detailError = '';
      try {
        const d = await fetchBehaviourDetail(this.v, id);

        if (my === this.dseq) {
          this.details = { ...this.details, [id]: d };
        }
      } catch (e) {
        if (my === this.dseq) {
          console.error('audit-loupe: behavior detail failed', e); // eslint-disable-line no-console
          this.detailError = `${ this.T.loadFailed }: ${ e.message }`;
        }
      } finally {
        if (my === this.dseq) {
          this.detailLoading = false;
        }
      }
    },

    select(id) {
      this.detailOpen = true;
      this.set({ select: id });
    },

    tab(t) {
      this.set({ tab: t });
    },

    toggleGroup(g) {
      const open = this.v.open.includes(g) ? this.v.open.filter((x) => x !== g) : [...this.v.open, g];

      this.set({ open });
    },

    toggleActor(key) {
      this.set({ flip: flipActor(this.v, key) });
    },

    toggleSection(t) {
      const show = this.v.show.includes(t) ? this.v.show.filter((x) => x !== t) : [...this.v.show, t];

      this.set({ show });
    },

    // A summary chip opens where that tier is listed: findings for the tiers judged by rules
    // and ordinary work, the activity group for the neutral ones.
    chip(t) {
      if (['unrecorded', 'unauthenticated', 'routine'].includes(t)) {
        this.set({ tab: 'activity', open: this.v.open.includes(t) ? this.v.open : [...this.v.open, t] });
      } else {
        this.set({ tab: 'findings', show: this.v.show.includes(t) ? this.v.show : [...this.v.show, t] });
      }
    },

    gapChipTitle(g) {
      return this.T.gapChipHint((g.collectors || []).map((c) => this.T.collector[c] || c).join(this.T.listSep) || this.T.tbc);
    },

    fmt(ms) {
      return fmtTime(ms, this.tz);
    },

    cl(id) {
      return clusterLabel(this.$store, id);
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
  },
  TABS,
  PANEL_AUTO,
  PRODUCT,
  BLANK_CLUSTER,
  V5_ROUTE: routeName('changes-v5'),
};
</script>

<template>
  <div
    class="al5 al6"
    :class="{'has-detail': !!(selB && detailOpen), full}"
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
          v-for="t in $options.TABS"
          :key="t"
          type="button"
          role="tab"
          :aria-selected="String(v.tab === t)"
          :class="{on: v.tab === t}"
          @click="tab(t)"
        >
          {{ T.tabs[t] }}<span class="q">{{ T.tabSub[t] }}</span>
        </button>
      </nav>
      <div class="filters">
        <MultiPick
          :label="T.cluster"
          :options="clusterOptions"
          :value="v.cluster"
          :all-text="T.all"
          :clear-text="T.clear"
          :find-text="T.find"
          @change="(list) => set({cluster: list, select: '', who: null, place: null})"
        />
        <button
          type="button"
          class="btn-al"
          :aria-pressed="String(v.system)"
          @click="set({system: !v.system, select: ''})"
        >
          {{ v.system ? T.hideSystem : T.showSystem }}
        </button>
        <span class="tz">{{ T.tzLine(tz) }}</span>
        <button
          type="button"
          class="btn-al full-btn"
          :aria-pressed="String(full)"
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
      {{ missing || error }}
      <router-link
        v-if="old"
        :to="{name: $options.V5_ROUTE, params: {product: $options.PRODUCT, cluster: $options.BLANK_CLUSTER}, query: {day: v.day}}"
      >
        {{ T.openV5 }}
      </router-link>
    </div>

    <div
      v-else
      class="al5-main"
    >
      <section class="al5-content">
        <div
          v-if="data"
          class="sum"
        >
          <p class="sum-lead">
            {{ lead }}
          </p>
          <div class="sum-chips">
            <button
              v-for="c in chips"
              :key="c.tier"
              type="button"
              class="chip"
              :class="c.tier"
              :title="T.tierHint[c.tier]"
              @click="chip(c.tier)"
            >
              {{ T.tiers[c.tier] }} <b class="num">{{ c.count ?? T.tbc }}</b>
            </button>
            <button
              v-for="(g, i) in longGaps"
              :key="`g${i}`"
              type="button"
              class="chip gap"
              :title="gapChipTitle(g)"
              @click="set({tab: 'findings'})"
            >
              {{ T.gapChip }} <b class="num">{{ fmt(g.fromMs) }}–{{ fmt(g.toMs) }}</b> {{ T.inCluster(cl(g.cluster)) }}
            </button>
          </div>
          <p
            v-if="settingsLine"
            class="sum-hidden muted small"
          >
            {{ settingsLine }}
          </p>
          <p
            v-if="hidden"
            class="sum-hidden muted small"
          >
            {{ hidden }}
          </p>
        </div>

        <p
          v-if="data && !list.length"
          class="muted pad"
        >
          {{ building ? T.building : T.noBehaviours }}
        </p>
        <template v-else-if="data">
          <div
            v-if="v.tab === 'activity'"
            class="pane"
          >
            <p class="pane-head muted small">
              {{ T.activityHead }}
            </p>
            <div class="pane-scroll">
              <AlLanes
                :T="T"
                :rows="activity"
                :gaps="data.gaps"
                :d0="d0"
                :day-ms="dayMs"
                :tz="tz"
                :sel="selId"
                :axis-label="T.axis.activity"
                :overlaps="data.overlaps"
                :names="names"
                @select="select"
                @group="toggleGroup"
                @actor="toggleActor"
              />
            </div>
          </div>
          <div
            v-else-if="v.tab === 'findings'"
            class="pane"
          >
            <p class="pane-head muted small">
              {{ T.findingsHead }}
            </p>
            <div class="pane-scroll">
              <AlFindingsList
                :T="T"
                :behaviours="list"
                :open="v.show"
                :gaps="data.gaps"
                :tz="tz"
                :sel="selId"
                @select="select"
                @toggle="toggleSection"
              />
            </div>
          </div>
          <AlIdentitiesView
            v-else-if="v.tab === 'identities'"
            class="pane"
            :T="T"
            :behaviours="list"
            :actors="data.actors"
            :overlaps="data.overlaps"
            :names="names"
            :who="who"
            :gaps="data.gaps"
            :d0="d0"
            :day-ms="dayMs"
            :tz="tz"
            :sel="selId"
            @select="select"
            @who="(k) => set({who: k})"
          />
          <AlScopesView
            v-else
            class="pane"
            :T="T"
            :behaviours="list"
            :scopes="data.scopes"
            :place="place"
            :gaps="data.gaps"
            :d0="d0"
            :day-ms="dayMs"
            :tz="tz"
            :sel="selId"
            @select="select"
            @place="(k) => set({place: k})"
          />
        </template>
      </section>
      <div
        v-if="selB && detailOpen"
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
      <AlBehaviourDetail
        v-if="selB && detailOpen"
        :T="T"
        :b="selB"
        :more="selDetail && !selDetail.none ? selDetail : null"
        :gone="!!(selDetail && selDetail.none)"
        :error="detailError"
        :loading="detailLoading"
        :tz="tz"
        @close="detailOpen = false"
      />
    </div>

    <AlStripBar
      :T="T"
      :strip="data && data.strip"
      :gaps="(data && data.gaps) || []"
      :look="lookList"
      :mark="detailOpen ? mark : null"
      :day="v.day"
      :d0="d0"
      :day-ms="dayMs"
      :tz="tz"
      @day="(d) => set({day: d, select: '', who: null, place: null})"
    />
  </div>
</template>

<style lang="scss">
@import '../styles/change-map-v5.scss';
@import '../styles/change-map-v6.scss';
</style>
