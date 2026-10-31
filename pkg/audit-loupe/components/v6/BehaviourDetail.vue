<script>
import { fmtTime, clusterLabel } from '../../lib/v5';
import {
  rangeText, headline, scopeLabel, settingNote, verbText, noteOf, tagTexts
} from '../../lib/v6';

// The right-hand detail of one behaviour: title, who (and what that identity is), time, place,
// size, route, the rules it triggered (label-only ones marked), its parts, the objects touched
// and the operations. Lists the server cut short say so, with the server's totals.
export default {
  name:  'AlBehaviourDetail',
  props: {
    T:       { type: Object, required: true },
    b:       { type: Object, required: true },
    // The server's detail of this behaviour (/api/behaviors/detail); null while loading.
    more:    { type: Object, default: null },
    loading: { type: Boolean, default: false },
    // The server no longer has this behaviour (404 no-records), or the detail request failed.
    gone:    { type: Boolean, default: false },
    error:   { type: String, default: '' },
    tz:      { type: String, required: true },
  },
  emits:    ['close'],
  computed: {
    flagged() {
      return this.b.tier === 'look' || this.b.tier === 'notable';
    },
    title() {
      return headline(this.T, this.b);
    },
    note() {
      return noteOf(this.T, this.b.actor);
    },
    setting() {
      const s = settingNote(this.b.actor);

      return s ? this.T.dependsAudit(clusterLabel(this.$store, s.cluster)) : '';
    },
    via() {
      const list = this.b.via.map((v) => this.T.viaWord[v] || v);

      return list.length ? list.join(this.T.listSep) : this.T.tbc;
    },
    tags() {
      return tagTexts(this.T, this.b);
    },
    rules() {
      return this.b.rules.map((r) => ({
        ...r,
        name: this.T.rules[r.rule] || r.rule,
        // The rule's description, unless it only repeats the name.
        what: (this.T.ruleWhat[r.rule] || '').toLowerCase() === String(this.T.rules[r.rule] || '').toLowerCase() ? '' : (this.T.ruleWhat[r.rule] || ''),
        sev:  (r.severity && this.T.sevWord[r.severity]) || this.T.tbc,
      }));
    },
    // Before the detail arrives, the behaviour's own top objects (up to 20).
    objects() {
      return this.more?.objects || this.b.objectsTop || null;
    },
    objectsTotal() {
      return this.more?.objectsTotal ?? this.b.objects;
    },
    ops() {
      return this.more?.ops || null;
    },
    opsTotal() {
      return this.more?.opsTotal ?? this.b.ops;
    },
  },
  methods: {
    n(v) {
      return v === null || v === undefined ? this.T.tbc : v;
    },
    fmt(ms) {
      return ms === null || ms === undefined ? this.T.tbc : fmtTime(ms, this.tz);
    },
    cl(id) {
      return clusterLabel(this.$store, id);
    },
    scopeLabel(s) {
      return scopeLabel(this.T, s);
    },
    // The action, and whether the server refused or failed it (a failed request is listed
    // only when it carries an alert).
    verb(o) {
      const v = verbText(this.T, o);

      if (o.code === 403) {
        return `${ v }${ this.T.refused }`;
      }

      return o.code >= 400 ? `${ v }${ this.T.failed(o.code) }` : v;
    },
    rangeText,
  },
};
</script>

<template>
  <aside
    class="dt bd"
    :aria-label="T.detail.head"
  >
    <div class="dt-head">
      <div class="dt-title">
        <b>{{ T.detail.head }}</b>
        <span
          class="tg"
          :class="flagged ? b.tier : ''"
        >{{ T.tiers[b.tier] || T.tbc }}</span>
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
    </div>
    <div class="dt-body">
      <p
        v-if="gone || error"
        class="banner-al"
      >
        {{ gone ? T.detail.none : error }}
      </p>
      <h3
        class="bd-title"
        :class="{hl: flagged, [b.tier]: flagged}"
      >
        {{ title }}
      </h3>
      <div class="bd-who">
        <b>{{ b.actor.name || T.groups.unrecorded }}</b>
        <span
          v-if="note"
          class="muted small"
        >{{ note }}</span>
        <span
          v-if="setting"
          class="tg cfg"
        >{{ setting }}</span>
      </div>
      <dl class="kv">
        <dt>{{ T.detail.time }}</dt>
        <dd class="num">
          {{ rangeText(b, tz) || T.tbc }}
          <span
            v-if="b.startedBefore"
            class="tg"
          >{{ T.startedBefore }}</span>
          <span
            v-if="b.continuesAfter"
            class="tg"
          >{{ T.continuesAfter }}</span>
        </dd>
        <dt>{{ T.detail.where }}</dt>
        <dd>{{ T.inCluster(cl(b.cluster)) }} / {{ scopeLabel(b.scope) }}</dd>
        <dt>{{ T.detail.size }}</dt>
        <dd>{{ T.detail.sizeLine(n(b.ops), n(b.objects)) }}</dd>
        <dt>{{ T.detail.via }}</dt>
        <dd>{{ via }}</dd>
        <template v-if="tags.length">
          <dt>{{ T.detail.tags }}</dt>
          <dd>
            <span
              v-for="t in tags"
              :key="t"
              class="tg"
            >{{ t }}</span>
          </dd>
        </template>
      </dl>
      <div
        v-if="rules.length"
        class="bd-why"
      >
        <b>{{ T.detail.rules }}</b>
        <ul>
          <li
            v-for="r in rules"
            :key="r.rule"
          >
            {{ T.detail.ruleLine(r.name, r.sev, n(r.count)) }}
            <span
              v-if="r.tagOnly"
              class="tg"
            >{{ T.detail.tagOnly }}</span>
            <div
              v-if="r.what"
              class="muted small"
            >
              {{ r.what }}
            </div>
          </li>
        </ul>
      </div>
      <h4>{{ T.detail.segments }}</h4>
      <div class="bd-segs">
        <span
          v-for="(s, i) in b.segments"
          :key="i"
          class="tg num"
        >{{ T.detail.segLine(fmt(s.fromMs), fmt(s.toMs), n(s.ops)) }}</span>
      </div>
      <h4>{{ T.detail.objects }}</h4>
      <p
        v-if="!objects"
        class="muted"
      >
        {{ loading ? T.detail.loading : `${ T.tbc }${ T.colon }${ T.detail.tbcObjects }` }}
      </p>
      <table
        v-else
        class="bd-tbl"
      >
        <thead>
          <tr>
            <th>{{ T.detail.objCols[0] }}</th>
            <th>{{ T.detail.objCols[1] }}</th>
            <th class="r">
              {{ T.detail.objCols[2] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(o, i) in objects"
            :key="i"
          >
            <td class="muted">
              {{ o.kind }}
            </td>
            <td class="nm">
              {{ o.name || T.batch }}<span
                v-if="o.namespace && o.namespace !== b.scope"
                class="muted"
              > ・ {{ T.namespace }} {{ o.namespace }}</span>
            </td>
            <td class="r num">
              {{ n(o.ops) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="objects && objectsTotal !== null && objectsTotal > objects.length"
        class="bd-foot"
      >
        {{ T.detail.truncObjs(objects.length, objectsTotal) }}
      </p>
      <h4>{{ T.detail.opsHead }}</h4>
      <p
        v-if="!ops"
        class="muted"
      >
        {{ loading ? T.detail.loading : `${ T.tbc }${ T.colon }${ T.detail.tbcOps }` }}
      </p>
      <div
        v-else
        class="bd-ops"
      >
        <table class="bd-tbl">
          <thead>
            <tr>
              <th>{{ T.detail.opCols[0] }}</th>
              <th>{{ T.detail.opCols[1] }}</th>
              <th>{{ T.detail.opCols[2] }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(o, i) in ops"
              :key="i"
              :class="{hi: o.severity === 'high'}"
            >
              <td class="num">
                {{ fmt(o.t) }}
              </td>
              <td>
                {{ verb(o) }}<span
                  v-if="o.cascade"
                  class="muted"
                > ・ {{ T.cascade }}</span>
              </td>
              <td class="nm">
                <span class="muted">{{ o.kind }}</span> {{ o.name || T.batch }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="ops && (more.truncated || (opsTotal !== null && opsTotal > ops.length))"
        class="bd-foot"
      >
        {{ T.detail.truncOps(ops.length, n(opsTotal)) }}
      </p>
    </div>
  </aside>
</template>
