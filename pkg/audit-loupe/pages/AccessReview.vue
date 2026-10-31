<script>
import { getJson, baseUrl, backendMessage } from '../lib/api';
import { texts, fmtDate, principalShort, pad } from '../lib/model';

function localInput(d) {
  return `${ d.getFullYear() }-${ pad(d.getMonth() + 1) }-${ pad(d.getDate()) }T${ pad(d.getHours()) }:${ pad(d.getMinutes()) }`;
}

// Who holds which Rancher permission at a time, who granted it, and what changed between
// two dates (quarterly access review).
export default {
  name: 'AuditLoupeAccessReview',

  data() {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    return {
      T:       texts(this.$store),
      at:      localInput(now),
      from:    localInput(qStart),
      snap:    null,
      diff:    null,
      sel:     '',
      search:  '',
      loading: false,
      error:   null,
    };
  },

  computed: {
    A() {
      return this.T.access;
    },
    users() {
      const q = this.search.toLowerCase();

      return (this.snap?.users || [])
        .filter((u) => !q || u.display_name.toLowerCase().includes(q) || u.user_id.includes(q))
        .map((u) => ({
          ...u, admin: u.grants.some((g) => g.admin_like), viaGroup: u.grants.filter((g) => g.via_group).length
        }));
    },
    // A finalizer delete is stored as two steps (deletion started, then gone) linked to the
    // same request; people care that the role was deleted, so the first step is not listed.
    roleChanges() {
      const list = this.diff?.roleChanges || [];

      return list.filter((r) => r.change !== 'deleting' || !list.some((x) => x.change === 'deleted' && x.kind === r.kind && x.name === r.name && x.at_ms >= r.at_ms));
    },
    user() {
      return this.users.find((u) => u.user_id === this.sel) || null;
    },
    csvUrl() {
      return `${ baseUrl() }/api/access/csv?at=${ encodeURIComponent(new Date(this.at).toISOString()) }`;
    },
  },

  mounted() {
    this.load();
  },

  methods: {
    fmtDate,
    principalShort,
    scope(g) {
      if (g.scope === 'global') {
        return this.A.global;
      }

      return g.scope === 'cluster' ? `${ this.A.cluster } ${ this.clusterName(g.cluster) }` : `${ this.A.project } ${ this.clusterName(g.cluster) } / ${ this.projectName(g.cluster, g.project) }`;
    },
    clusterName(id) {
      try {
        return this.$store.getters['management/byId']('management.cattle.io.cluster', id)?.nameDisplay || id;
      } catch (e) {
        return id;
      }
    },
    projectName(c, p) {
      try {
        return this.$store.getters['management/byId']('management.cattle.io.project', `${ c }/${ p }`)?.nameDisplay || p;
      } catch (e) {
        return p;
      }
    },
    who(g) {
      if (g.before_tracking) {
        return this.A.beforeTracking;
      }
      if (g.automatic || g.derived) {
        return g.derived ? this.A.derived : this.A.automatic;
      }
      if (!g.granted_by) {
        return this.A.unknown;
      }

      return g.granted_by_inferred ? `${ g.granted_by }（${ this.A.inferred }）` : g.granted_by;
    },
    // Rancher names the per-cluster system account after the cluster ID; show the cluster name.
    personName(u) {
      const name = u.display_name || u.user_id;
      const m = /^(System account for Cluster )(\S+)$/.exec(name);

      return m ? `${ m[1] }${ this.clusterName(m[2]) }` : name;
    },
    subject(g) {
      if (g.subject_kind === 'group') {
        return `${ this.A.group } ${ principalShort(g.subject) }`;
      }

      return (this.snap?.users || []).find((u) => u.user_id === g.subject)?.display_name || g.subject;
    },
    reason(c) {
      return { rancher_cleanup: this.A.cleanup, rancher_sync: this.A.sync }[c.reason] || '';
    },
    async load() {
      this.loading = true;
      this.error = null;
      try {
        // Rancher's cluster and project lists, so scopes show names instead of IDs. Forced: Rancher
        // may hold only the current cluster's projects, and every cluster's are needed here.
        await Promise.all(['management.cattle.io.cluster', 'management.cattle.io.project']
          .map((type) => this.$store.dispatch('management/findAll', { type, opt: { force: true } }).catch(() => {})));
        const at = new Date(this.at).toISOString();
        const [snap, diff] = await Promise.all([
          getJson('/api/access', { at }),
          getJson('/api/access/diff', { from: new Date(this.from).toISOString(), to: at }),
        ]);

        this.snap = snap;
        this.diff = diff;
        if (!this.users.some((u) => u.user_id === this.sel)) {
          this.sel = this.users[0]?.user_id || '';
        }
      } catch (e) {
        this.error = backendMessage(this.T, e) || `${ this.T.error }: ${ e.message }`;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="al al-page">
    <div class="topbar">
      <span class="crumb">Audit Loupe ／ {{ T.crumb }}</span>
      <h1>{{ A.title }}</h1>
      <div class="filters">
        <label class="check">{{ A.at }} <input
          v-model="at"
          type="datetime-local"
        ></label>
        <label class="check">{{ A.compareFrom }} <input
          v-model="from"
          type="datetime-local"
        ></label>
        <button
          class="btn-al"
          type="button"
          @click="load"
        >
          {{ A.apply }}
        </button>
        <a
          class="btn-al"
          :href="csvUrl"
          download
        >{{ A.csv }}</a>
      </div>
    </div>
    <div
      v-if="error"
      class="banner-al"
    >
      {{ error }}
    </div>
    <p class="hint">
      {{ A.groupNote }}
    </p>

    <div class="work-2">
      <section class="col">
        <div class="col-head">
          <h2>{{ A.people }}</h2><span class="muted num">{{ users.length }}</span>
        </div>
        <div class="col-body side">
          <input
            v-model="search"
            type="text"
            :placeholder="A.search"
          >
          <div class="people">
            <button
              v-for="u in users"
              :key="u.user_id"
              type="button"
              class="person"
              :class="{on: sel === u.user_id}"
              @click="sel = u.user_id"
            >
              <span
                class="who"
                :title="personName(u)"
              >{{ personName(u) }}</span>
              <span>
                <span
                  v-if="u.admin"
                  class="tag warn"
                >{{ A.adminLike }}</span>
              </span>
              <span class="num muted">{{ A.grants(u.grants.length) }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="col">
        <div class="col-head">
          <h2>{{ user ? personName(user) : A.pick }}</h2>
          <span
            v-if="user"
            class="muted"
          >{{ user.user_id }}{{ user.groups.length ? `・${A.groups} ${user.groups.map(principalShort).join('、')}` : '' }}</span>
        </div>
        <div class="col-body detail">
          <div
            v-if="loading"
            class="quiet"
          >
            {{ T.loading }}
          </div>
          <table
            v-if="user && user.grants.length"
            class="tbl"
          >
            <thead>
              <tr>
                <th>{{ A.role }}</th><th>{{ A.scope }}</th><th>{{ A.via }}</th><th>{{ A.grantedBy }}</th><th>{{ A.grantedAt }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="g in user.grants"
                :key="`${g.binding_kind}/${g.binding_namespace}/${g.binding_name}/${g.via_group || ''}`"
              >
                <td>
                  {{ g.role_display }}
                  <span
                    v-if="g.admin_like"
                    class="tag warn"
                  >{{ A.adminLike }}</span>
                </td>
                <td>{{ scope(g) }}</td>
                <td>{{ g.via_group ? `${A.group} ${principalShort(g.via_group)}` : A.direct }}</td>
                <td>{{ who(g) }}</td>
                <td class="num">
                  {{ g.before_tracking ? '—' : fmtDate(g.granted_ms) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-else-if="user"
            class="quiet"
          >
            {{ A.none }}
          </div>

          <template v-if="diff">
            <div class="sub">
              <span>{{ A.changes }}</span><span>{{ fmtDate(diff.from) }} → {{ fmtDate(diff.to) }}</span>
            </div>
            <div
              v-if="diff.trackingSinceMs && diff.trackingSinceMs > diff.from"
              class="quiet"
            >
              {{ A.trackingSince(fmtDate(diff.trackingSinceMs)) }}
            </div>
            <table
              v-if="diff.changes.length"
              class="tbl"
            >
              <thead>
                <tr>
                  <th /><th>{{ A.subject }}</th><th>{{ A.role }}</th><th>{{ A.scope }}</th><th>{{ A.by }}</th><th>{{ A.when }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in diff.changes"
                  :key="`${c.change}${c.grant.binding_kind}${c.grant.binding_namespace}${c.grant.binding_name}`"
                >
                  <td>
                    <span
                      class="pill"
                      :class="c.change === 'added' ? 'added' : 'deleted'"
                    >{{ c.change === 'added' ? A.added : A.removed }}</span>
                  </td>
                  <td>{{ subject(c.grant) }}</td>
                  <td>{{ c.grant.role_display }}</td>
                  <td>{{ scope(c.grant) }}</td>
                  <td>{{ reason(c) || c.by || A.unknown }}</td>
                  <td class="num">
                    {{ c.at_ms ? fmtDate(c.at_ms) : '' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-else
              class="quiet"
            >
              {{ A.noChanges }}
            </div>
            <div
              v-if="diff.roleChanges.length"
              class="sub"
            >
              <span>{{ A.roleChanges }}</span>
            </div>
            <table
              v-if="diff.roleChanges.length"
              class="tbl"
            >
              <thead>
                <tr>
                  <th>{{ A.roleName }}</th><th>{{ A.change }}</th><th>{{ A.by }}</th><th>{{ A.when }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in roleChanges"
                  :key="`${r.kind}${r.name}${r.at_ms}`"
                >
                  <td>{{ r.name }}</td><td>{{ A.changeKind[r.change] || r.change }}</td><td>{{ reason(r) || r.by || A.unknown }}</td><td class="num">
                    {{ fmtDate(r.at_ms) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss">
/* A person's name is shown whole (it may be long, e.g. a cluster's system account). */
.al .people .person { grid-template-columns: minmax(0, 1fr) auto auto; }
.al .people .person .who { white-space: normal; overflow-wrap: anywhere; }
@import '../styles/change-map.scss';
.al.al-page { height: auto; display: flex; flex-direction: column; }
.al .work-2 { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 8px; min-height: 480px; }
.al .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.al .tbl th { text-align: left; font-weight: 700; color: var(--al-muted); border-bottom: 1px solid var(--al-border); padding: 4px 6px; }
.al .tbl td { border-bottom: 1px solid var(--al-border); padding: 4px 6px; vertical-align: top; }
@media (max-width: 900px) { .al .work-2 { grid-template-columns: minmax(0, 1fr); } }
</style>
