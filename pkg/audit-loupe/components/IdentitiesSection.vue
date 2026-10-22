<script>
import { getJson } from '../lib/api';
import { fmtDate } from '../lib/model';
import { textsV5, noteText, shortWho } from '../lib/v5';

const CLASSES = ['human', 'serviceaccount', 'rancher', 'component', 'unknown'];

const ZH = {
  title:     '身分分類',
  intro:     '每個身分第一次出現時判斷一次：人、ServiceAccount、Rancher 內部、叢集元件或不明。規則只評估「人」的操作；變更地圖預設不顯示叢集元件與 Rancher 內部。',
  config:    '取決於設定',
  wlTitle:   '白名單（server.identities）',
  wlEmpty:   '沒有設定。內建判斷認不出來的身分（例如只能靠憑證名稱認的元件），寫在 Helm values 的 server.identities，重新部署後端才會生效；這裡只能看，不能改。',
  wlHint:    '白名單和規則一樣算進設定代碼：改了之後，之前的紀錄維持原本的判斷，本頁上方會提示重新計算。',
  names:     '名稱',
  cls:       '分類',
  reason:    '理由',
  listTitle: '目前認得的身分',
  search:    '搜尋名稱',
  all:       '全部',
  source:    '依據',
  builtin:   '內建判斷',
  whitelist: '白名單',
  first:     '第一次出現',
  more:      (n) => `還有 ${ n } 個，請用搜尋縮小範圍`,
  missing:   '目前的後端還沒有這項功能，後端升級之後就會顯示。',
};

const EN = {
  title:     'Identity classes',
  intro:     'Each identity is classed once, when first seen: person, ServiceAccount, Rancher internal, cluster component or unknown. Rules only check people; the change map hides cluster components and Rancher internals by default.',
  config:    'Depends on settings',
  wlTitle:   'Whitelist (server.identities)',
  wlEmpty:   'None set. Identities the built-in rules cannot tell (for example components known only by their certificate name) go in the Helm values under server.identities and take effect when the backend is redeployed; this page only shows them.',
  wlHint:    'Like the rules, the whitelist is part of the settings code: after a change, earlier records keep their judgement and the top of this page offers to judge them again.',
  names:     'Names',
  cls:       'Class',
  reason:    'Reason',
  listTitle: 'Identities known so far',
  search:    'Search names',
  all:       'All',
  source:    'Decided by',
  builtin:   'built-in rules',
  whitelist: 'whitelist',
  first:     'First seen',
  more:      (n) => `${ n } more; search to narrow down`,
  missing:   'The backend in use does not have this yet; it shows once the backend is upgraded.',
};

const SHOW = 200;

// Read-only: how every identity is classed, and the administrator's whitelist (layer 1, PR-A).
export default {
  name: 'IdentitiesSection',

  data() {
    const zh = textsV5(this.$store).colon === '：';

    return {
      I: zh ? ZH : EN, T5: textsV5(this.$store), data: null, missing: false, cls: '', q: '',
    };
  },

  computed: {
    counts() {
      const c = Object.fromEntries(CLASSES.map((k) => [k, 0]));

      for (const r of this.data?.identities || []) {
        c[r.class] = (c[r.class] || 0) + 1;
      }

      return c;
    },
    rows() {
      const q = this.q.trim().toLowerCase();

      return (this.data?.identities || []).filter((r) => (!this.cls || r.class === this.cls) && (!q || r.name.toLowerCase().includes(q) || (r.userId || '').toLowerCase().includes(q)));
    },
    shown() {
      return this.rows.slice(0, SHOW);
    },
  },

  mounted() {
    this.load();
  },

  methods: {
    fmtDate,
    shortWho,
    CLASSES: () => CLASSES,
    async load() {
      try {
        this.data = await getJson('/api/identities');
        this.missing = false;
      } catch (e) {
        this.missing = e.status === 404;
      }
    },
    clsLabel(c) {
      return this.T5.category[c] || c;
    },
    note(r) {
      return noteText(this.T5, r.reasonCode, r.reason);
    },
  },
};
</script>

<template>
  <section class="col al-ids">
    <div class="col-head">
      <h2>{{ I.title }}</h2>
    </div>
    <div class="detail">
      <p class="muted">
        {{ I.intro }}
      </p>
      <p
        v-if="missing"
        class="muted"
      >
        {{ I.missing }}
      </p>
      <template v-if="data">
        <h3>{{ I.wlTitle }} <span class="cfg">{{ I.config }}</span></h3>
        <p
          v-if="!data.whitelist.length"
          class="muted"
        >
          {{ I.wlEmpty }}
        </p>
        <template v-else>
          <table class="tbl">
            <thead>
              <tr>
                <th>{{ I.names }}</th><th>{{ I.cls }}</th><th>{{ I.reason }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(e, i) in data.whitelist"
                :key="i"
              >
                <td class="mono">
                  {{ e.names.join(', ') }}
                </td>
                <td>{{ clsLabel(e.class) }}</td>
                <td>{{ e.reason }}</td>
              </tr>
            </tbody>
          </table>
          <p class="muted">
            {{ I.wlHint }}
          </p>
        </template>

        <h3>{{ I.listTitle }}</h3>
        <div class="ids-bar">
          <button
            type="button"
            class="ids-chip"
            :class="{ on: !cls }"
            @click="cls = ''"
          >
            {{ I.all }} {{ data.identities.length }}
          </button>
          <button
            v-for="c in CLASSES()"
            :key="c"
            type="button"
            class="ids-chip"
            :class="{ on: cls === c }"
            :disabled="!counts[c]"
            @click="cls = c"
          >
            {{ clsLabel(c) }} {{ counts[c] }}
          </button>
          <input
            v-model="q"
            class="ids-q"
            type="search"
            :placeholder="I.search"
            :aria-label="I.search"
          >
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>{{ I.names }}</th><th>{{ I.cls }}</th><th>{{ I.reason }}</th><th>{{ I.source }}</th><th>{{ I.first }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in shown"
              :key="`${ r.name }|${ r.userId }`"
            >
              <td
                class="mono"
                :title="r.name"
              >
                {{ shortWho(r.name) }}<div
                  v-if="r.userId && r.userId !== r.name"
                  class="muted"
                >
                  {{ r.userId }}
                </div>
              </td>
              <td>{{ clsLabel(r.class) }}</td>
              <td>{{ note(r) || '—' }}</td>
              <td>{{ r.source === 'whitelist' ? I.whitelist : I.builtin }}</td>
              <td class="num">
                {{ fmtDate(r.firstMs) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="rows.length > shown.length"
          class="muted"
        >
          {{ I.more(rows.length - shown.length) }}
        </p>
      </template>
    </div>
  </section>
</template>

<style lang="scss">
.al-ids h3 { font-size: 14px; margin: 16px 0 6px; }
.al-ids .cfg { font-size: 11px; font-weight: normal; padding: 1px 6px; border-radius: 8px; border: 1px solid var(--warning, #c98a00); color: var(--warning, #c98a00); margin-left: 6px; }
.al-ids .ids-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.al-ids .ids-chip { display: inline-flex; width: auto; flex: none; min-height: 0; line-height: 18px; border: 1px solid var(--border, #d6d9e1); background: none; color: inherit; border-radius: 12px; padding: 2px 10px; font-size: 12px; cursor: pointer; }
.al-ids .ids-chip.on { border-color: var(--primary, #0b7356); color: var(--primary, #0b7356); font-weight: 600; }
.al-ids .ids-chip:disabled { opacity: .4; cursor: default; }
.al-ids .ids-q { margin-left: auto; max-width: 240px; padding: 3px 8px; font-size: 12px; }
</style>
