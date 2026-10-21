// v5 change map: texts, the one /api/changemap request per user action, and URL <-> view state.
// The backend computes every audit state; this file only formats what it returns.
import { getJson } from './api';
import { pad } from './model';

// ---------- text ----------
const ZH = {
  tabs: { overview: '總覽', relations: '關係', events: '事件' },
  cluster: '叢集', namespace: 'Namespace', state: '稽核狀態', all: '全部', tz: '時區',
  tzHint: (tz, src) => `時區 ${ tz }（來源：${ src }）`, tzServer: '後端設定',
  states: {
    look: '要看', unclear: '看不清', blind: '看不到', clear: '清楚',
  },
  sev: { high: '高', medium: '中' },
  stateHint: {
    look:    '當天有中、高風險警示',
    unclear: '有變化但找不到執行者',
    blind:   '落在沒有收集的缺口邊緣',
    clear:   '以上都不是',
  },
  summary: (o, n) => [`${ o } 個物件有變更`, `${ n } 筆操作（不含系統元件）`],
  summarySys: (o, n) => [`${ o } 個物件有變更`, `${ n } 筆操作（含系統元件）`],
  cols: {
    state: '稽核狀態', object: '物件', where: '叢集／Namespace', ticks: '當天操作（00–24）', ops: '次數', last: '最後一次', who: '誰', via: '管道',
  },
  clusterScope: '叢集範圍',
  hiddenRows: (s, u) => `已隱藏：系統元件 ${ s } 列、Rancher 介面自己的維護動作 ${ u } 列`,
  show: '顯示', hide: '隱藏',
  more: '載入更多',
  noRows: '這一天、這個範圍內沒有物件變更。',
  loadFailed: '讀取失敗',
  backendMissing: '找不到 Audit Loupe 後端（或沒有權限）。',
  busy: '處理中…',
  category: {
    human: '人', component: '叢集元件', serviceaccount: 'ServiceAccount', rancher: 'Rancher 內部', unknown: '不明',
  },
  via: {
    rancher: 'Rancher', 'rancher-kubectl': 'Rancher kubectl', apiserver: '直連 apiserver', direct: '直連 apiserver', impersonation: 'Rancher 代理', unknown: '不明',
  },
  collect: { ok: '正常', blind: '看不到' },
  collectOf: (c) => `${ c } 收集`,
  relCols: ['身分', '管道', '叢集', '物件（顏色＝稽核狀態，線越粗操作越多）'],
  bypass: '繞過 Rancher',
  filterOn: '只看：', clear: '清除',
  relEmpty: '這一天沒有可畫的關係。',
  eventsHead: '只列稽核狀態的轉變，不列每一筆操作',
  evSource: { state: '物件狀態', heartbeat: 'Audit Loupe 沒收到心跳', reported: '收集元件回報' },
  evEmpty: '這一天沒有稽核狀態的轉變。',
  heldRows: (n) => `被擱置 ${ n } 行`,
  detail: {
    close: '關閉', strip: '稽核狀態（當天）', lastChange: '最後一次變更', current: '目前狀態', compare: '設定差異', look: '看',
    noVersions: '這類資源沒有收物件版本', who: '誰動了它', dependsOn: '取決於設定', raw: '原始紀錄',
    export: '匯出', copy: '複製連結', copied: '已複製', hashChain: '雜湊鏈',
    chain: { ok: '驗證通過', broken: '斷開', pending: '尚未驗證' },
    pick: '選一個物件看細節', versions: '版本', from: '從', to: '到', noDiff: '兩個版本內容相同。', loading: '讀取中…',
  },
  tl: {
    prev: '前一天', next: '後一天', date: '日期', merged: '全部叢集', state: '稽核狀態', range: '時間範圍', rangeAll: '整天（拖曳時間列可選範圍）', clearRange: '清除範圍',
    legend: { look: '有要看的物件', blind: '看不到（沒有收集）', unknown: '狀態還無法判斷', op: '操作' },
    slot: (m) => `每 ${ m } 分鐘一格`,
  },
};

const EN = {
  tabs: { overview: 'Overview', relations: 'Relations', events: 'Events' },
  cluster: 'Cluster', namespace: 'Namespace', state: 'Audit state', all: 'All', tz: 'Time zone',
  tzHint: (tz, src) => `Time zone ${ tz } (source: ${ src })`, tzServer: 'backend setting',
  states: {
    look: 'Look', unclear: 'Unclear', blind: 'Blind', clear: 'Clear',
  },
  sev: { high: 'high', medium: 'medium' },
  stateHint: {
    look:    'Medium or high risk alerts this day',
    unclear: 'Changed, but nobody can be named',
    blind:   'Next to a gap with no collection',
    clear:   'None of the above',
  },
  summary: (o, n) => [`${ o } objects changed`, `${ n } operations (system components excluded)`],
  summarySys: (o, n) => [`${ o } objects changed`, `${ n } operations (system components included)`],
  cols: {
    state: 'Audit state', object: 'Object', where: 'Cluster / Namespace', ticks: 'Operations (00–24)', ops: 'Count', last: 'Last', who: 'Who', via: 'Via',
  },
  clusterScope: 'cluster-scoped',
  hiddenRows: (s, u) => `Hidden: ${ s } system component rows, ${ u } Rancher UI maintenance rows`,
  show: 'Show', hide: 'Hide',
  more: 'Load more',
  noRows: 'No object changed on this day in this scope.',
  loadFailed: 'Load failed',
  backendMissing: 'The Audit Loupe backend was not found (or you lack permission).',
  busy: 'Working…',
  category: {
    human: 'person', component: 'cluster component', serviceaccount: 'ServiceAccount', rancher: 'Rancher internal', unknown: 'unknown',
  },
  via: {
    rancher: 'Rancher', 'rancher-kubectl': 'Rancher kubectl', apiserver: 'direct apiserver', direct: 'direct apiserver', impersonation: 'Rancher proxy', unknown: 'unknown',
  },
  collect: { ok: 'normal', blind: 'blind' },
  collectOf: (c) => `${ c } collection`,
  relCols: ['Identity', 'Via', 'Cluster', 'Object (colour = audit state, thicker = more operations)'],
  bypass: 'bypasses Rancher',
  filterOn: 'Only: ', clear: 'Clear',
  relEmpty: 'Nothing to draw for this day.',
  eventsHead: 'Only changes of audit state, not every operation',
  evSource: { state: 'object state', heartbeat: 'no heartbeat to Audit Loupe', reported: 'reported by collector' },
  evEmpty: 'No audit state changed on this day.',
  heldRows: (n) => `${ n } lines held`,
  detail: {
    close: 'Close', strip: 'Audit state (this day)', lastChange: 'Last change', current: 'Current state', compare: 'Config diff', look: 'View',
    noVersions: 'Object versions are not collected for this kind', who: 'Who touched it', dependsOn: 'Depends on settings', raw: 'Raw record',
    export: 'Export', copy: 'Copy link', copied: 'Copied', hashChain: 'Hash chain',
    chain: { ok: 'verified', broken: 'broken', pending: 'not verified yet' },
    pick: 'Pick an object to see details', versions: 'Versions', from: 'From', to: 'To', noDiff: 'The two versions are identical.', loading: 'Loading…',
  },
  tl: {
    prev: 'Previous day', next: 'Next day', date: 'Date', merged: 'All clusters', state: 'audit state', range: 'Range', rangeAll: 'Whole day (drag the timeline to pick a range)', clearRange: 'Clear range',
    legend: { look: 'Objects to look at', blind: 'Blind (not collected)', unknown: 'Not decidable yet', op: 'Operation' },
    slot: (m) => `${ m }-minute slots`,
  },
};

export function textsV5(store) {
  let locale = 'en-us';

  try {
    locale = store.getters['i18n/current']() || locale;
  } catch (e) {}

  return locale.startsWith('zh') ? ZH : EN;
}

// ---------- states ----------
export const STATES = ['look', 'unclear', 'blind', 'clear'];

export function stateLabel(T, state, severity) {
  const base = T.states[state] || state || '—';

  return state === 'look' && T.sev[severity] ? `${ base }・${ T.sev[severity] }` : base;
}

// ---------- time (shown in the backend's time zone) ----------
// Offset of `tz` from UTC at `ms`, in minutes.
function offsetAt(ms, tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);

    return Math.round((asUtc - ms) / 60000);
  } catch (e) {
    return -new Date(ms).getTimezoneOffset();
  }
}

// UTC ms of 00:00 on `day` (YYYY-MM-DD) in `tz`.
export function dayStartMs(day, tz) {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);

  return guess - offsetAt(guess - offsetAt(guess, tz) * 60000, tz) * 60000;
}

export function fmtTime(ms, tz) {
  if (ms === null || ms === undefined) {
    return '—';
  }
  const local = new Date(ms + offsetAt(ms, tz) * 60000);

  return `${ pad(local.getUTCHours()) }:${ pad(local.getUTCMinutes()) }`;
}

export function shiftDay(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));

  return `${ t.getUTCFullYear() }-${ pad(t.getUTCMonth() + 1) }-${ pad(t.getUTCDate()) }`;
}

export function todayIso() {
  const d = new Date();

  return `${ d.getFullYear() }-${ pad(d.getMonth() + 1) }-${ pad(d.getDate()) }`;
}

// ---------- URL <-> view state ----------
// Everything that makes up the screen lives in the query string, so a copied link reopens it.
const arr = (v) => (v === undefined || v === null || v === '' ? [] : [].concat(v));

export function viewFromQuery(q = {}) {
  return {
    day:       q.day || todayIso(),
    tab:       ['overview', 'relations', 'events'].includes(q.tab) ? q.tab : 'overview',
    cluster:   arr(q.cluster),
    namespace: q.namespace || '',
    state:     STATES.includes(q.state) ? q.state : '',
    system:    q.system === '1',
    select:    q.select || '',
    from:      q.from ? Number(q.from) : null,
    to:        q.to ? Number(q.to) : null,
  };
}

export function queryFromView(v) {
  const q = { day: v.day, tab: v.tab };

  if (v.cluster.length) {
    q.cluster = v.cluster;
  }
  if (v.namespace) {
    q.namespace = v.namespace;
  }
  if (v.state) {
    q.state = v.state;
  }
  if (v.system) {
    q.system = '1';
  }
  if (v.select) {
    q.select = v.select;
  }
  if (v.from !== null && v.to !== null) {
    q.from = String(v.from);
    q.to = String(v.to);
  }

  return q;
}

export function apiParams(v, cursor) {
  const p = new URLSearchParams();

  p.set('day', v.day);
  p.set('tab', v.tab);
  v.cluster.forEach((c) => p.append('cluster', c));
  if (v.namespace) {
    p.set('namespace', v.namespace);
  }
  if (v.state) {
    p.set('state', v.state);
  }
  if (v.system) {
    p.set('system', '1');
  }
  if (v.select) {
    p.set('select', v.select);
  }
  if (cursor) {
    p.set('cursor', cursor);
  }

  return p;
}

// ---------- the one request ----------
// Started from the route guard so it is on the wire before the page mounts (spec §10). The
// page picks it up by its parameters; anything else is fetched fresh.
let early = null;

export function fetchChangemap(params) {
  return getJson('/api/changemap', params);
}

export function prefetch(query) {
  const params = apiParams(viewFromQuery(query));

  early = { key: params.toString(), promise: fetchChangemap(params) };
  early.promise.catch(() => {});
}

export function takePrefetched(params) {
  const e = early;

  early = null;

  return e && e.key === params.toString() ? e.promise : null;
}

// Object key: cluster/apiGroup/resource/namespace/name. The name may not contain '/', the
// group may be empty.
export function parseKey(key) {
  const [cluster, group, resource, namespace, ...rest] = String(key || '').split('/');

  return {
    cluster, group, resource, namespace, name: rest.join('/')
  };
}

export function getHistory(key) {
  const k = parseKey(key);

  return getJson('/api/history', {
    cluster: k.cluster, group: k.group, resource: k.resource, namespace: k.namespace, name: k.name
  });
}
