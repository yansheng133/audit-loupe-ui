// v5 change map: texts, the one /api/changemap request per user action, and URL <-> view state.
// The backend computes every audit state; this file only formats what it returns.
import { getJson, baseUrl } from './api';
import { pad } from './model';

// ---------- text ----------
const ZH = {
  tabs: {
    overview: '總覽', relations: '關係', events: '事件'
  },
  cluster:   '叢集',
  namespace: 'Namespace',
  state:     '稽核狀態',
  all:       '全部',
  tz:        '時區',
  shown:     (ms) => (ms < 1000 ? `畫面 ${ ms } 毫秒` : `畫面 ${ (ms / 1000).toFixed(1) } 秒`),
  shownHint: '上一次畫面更新花的時間：從進入這一頁（Rancher 本身載入完之後）或點選，到畫面顯示完成，在瀏覽器量，含網路與繪製。目標是 5 秒內。',
  full:      '全螢幕',
  exitFull:  '離開全螢幕（Esc）',
  resize:    '拖曳調整細節欄寬度；雙擊恢復預設',
  tzHint:    (tz, src) => `時區 ${ tz }（來源：${ src }）`,
  tzServer:  '後端設定',
  colon:     '：',
  noActor:   '找不到執行者',
  cascade:   '刪除 namespace 時一併清空',
  groupOf:   (cat) => `${ cat }（群組）`,
  // Reason codes from the backend (API contract v0.2); an unknown code falls back to its text.
  reason:    {
    'alert-high':         '當天有高風險警示',
    'alert-medium':       '當天有中風險警示',
    'no-apiserver-audit': '這座叢集沒有收 apiserver audit log：看得到物件變了，看不到是誰改的',
    'found-on-reconnect': '收集中斷後重新連線比對版本才發現的變更，找不到對應的 audit 紀錄',
    'near-gap':           '有紀錄落在收集中斷前後 10 分鐘內，可能不完整',
  },
  note: {
    'sa-rancher':              'Rancher 安裝的元件所用的 ServiceAccount',
    'sa-kube-system':          '叢集內建元件',
    'sa-workload':             '工作負載的 ServiceAccount',
    'admin-cert':              '節點上的管理者憑證，看不出是哪個人',
    'rancher-unauthenticated': 'Rancher 未通過驗證的請求，看不出是誰',
    'no-actor':                '找不到執行者',
    'system-component':        '叢集內建元件',
    'rancher-provisioning':    'Rancher 內部帳號（叢集佈建）',
    'rancher-local-user':      'Rancher 本機帳號，可能多人共用',
    unclassified:              '看不出是人或程式',
  },
  depends: {
    'suse-security': {
      setting: '是否啟用 SUSE Security 收集',
      text:    '容器裡輸入的指令不在 audit log。有啟用時，這裡會列出 SUSE Security 判定違規的程序。',
    },
    'no-apiserver-audit': {
      setting: '這座叢集是否收 apiserver audit log',
      text:    '沒有收的時候，只能從物件版本知道它變了，看不到是誰改的。',
    },
  },
  evReason: {
    'first-alert':        () => '當天第一次出現中、高風險警示',
    'first-unattributed': () => '當天第一次出現找不到執行者的變更',
    'collector-stopped':  (c) => `收集元件 ${ c } 停止回報`,
    'collector-resumed':  (c) => `收集元件 ${ c } 恢復回報`,
    'collector-silent':   (c) => `收集元件 ${ c } 沒有回報`,
  },
  progress: {
    index:     '正在建立開頁用的索引（升級後第一次啟動），這段期間開頁會比較慢',
    recompute: (d, t) => `正在依新的設定重新判斷：${ d }／${ t } 筆`,
    since:     (t) => `開始於 ${ t }`,
  },
  states: {
    look: '要看', unclear: '看不清', blind: '看不到', clear: '清楚',
  },
  sev:       { high: '高', medium: '中' },
  stateHint: {
    look:    '當天有中、高風險警示',
    unclear: '有變化但找不到執行者',
    blind:   '落在沒有收集的缺口邊緣',
    clear:   '以上都不是',
  },
  summary:    (o, n) => [`${ o } 個物件有變更`, `${ n } 筆操作（不含系統元件）`],
  summarySys: (o, n) => [`${ o } 個物件有變更`, `${ n } 筆操作（含系統元件）`],
  cols:       {
    state: '稽核狀態', object: '物件', where: '叢集／Namespace', ticks: '當天操作（00–24）', ops: '次數', last: '最後一次', who: '誰', via: '管道',
  },
  clusterScope:   '叢集範圍',
  hiddenRows:     (s, u) => `已隱藏：系統元件 ${ s } 列、Rancher 介面自己的維護動作 ${ u } 列`,
  show:           '顯示',
  hide:           '隱藏',
  more:           '載入更多',
  noRows:         '這一天、這個範圍內沒有物件變更。',
  loadFailed:     '讀取失敗',
  backendMissing: '找不到 Audit Loupe 後端（或沒有權限）。',
  busy:           '處理中…',
  category:       {
    human: '人', component: '叢集元件', serviceaccount: 'ServiceAccount', rancher: 'Rancher 內部', unknown: '不明',
  },
  via: {
    rancher: 'Rancher', 'rancher-kubectl': 'Rancher kubectl', apiserver: '直連 apiserver', direct: '直連 apiserver', impersonation: 'Rancher 代理', unknown: '不明',
  },
  collect:    { ok: '正常', blind: '看不到' },
  collectOf:  (c) => `${ c } 收集`,
  relCols:    ['身分', '管道', '叢集', '物件（顏色＝稽核狀態，線越粗操作越多）'],
  bypass:     '繞過 Rancher',
  filterOn:   '只看：',
  clear:      '清除',
  relEmpty:   '這一天沒有可畫的關係。',
  eventsHead: '只列稽核狀態的轉變，不列每一筆操作',
  evSource:   {
    state: '物件狀態', heartbeat: 'Audit Loupe 沒收到心跳', reported: '收集元件回報'
  },
  evEmpty:   '這一天沒有稽核狀態的轉變。',
  heldRows:  (n) => `被擱置 ${ n } 行`,
  batch:     '整批',
  batchHint: (res) => `沒有名稱的寫入（整批刪除 deletecollection，或名稱由系統產生的 create）・ ${ res }`,
  dataUntil: '資料最後一筆',
  detail:    {
    close:      '關閉',
    strip:      '稽核狀態（當天）',
    lastChange: '最後一次變更',
    current:    '目前狀態',
    compare:    '設定差異',
    look:       '看',
    noVersions: '這類資源沒有收物件版本',
    who:        '誰動了它',
    dependsOn:  '取決於設定',
    related:    '相關物件',
    raw:        '原始紀錄',
    export:     '匯出',
    copy:       '複製連結',
    copied:     '已複製',
    hashChain:  '雜湊鏈',
    chain:      {
      ok: '驗證通過', broken: '斷開', pending: '尚未驗證'
    },
    pick:     '選一個物件看細節',
    none:     '這個物件在這一天沒有紀錄。',
    versions: '版本',
    from:     '從',
    to:       '到',
    noDiff:   '兩個版本內容相同。',
    loading:  '讀取中…',
  },
  tl: {
    prev:       '前一天',
    next:       '後一天',
    date:       '日期',
    merged:     '全部叢集',
    state:      '稽核狀態',
    range:      '時間範圍',
    rangeAll:   '整天',
    hint:       '點一格或拖曳時間列選範圍，整頁只算範圍內的紀錄',
    ops:        (n, a) => `${ n } 筆操作${ a ? `（${ a } 筆警示）` : '' }`,
    clearRange: '清除範圍',
    legend:     {
      look: '有要看的物件', blind: '看不到（沒有收集）', unknown: '狀態還無法判斷', op: '長條高度＝操作量'
    },
    slot: (m) => `每 ${ m } 分鐘一格`,
  },
};

const EN = {
  tabs: {
    overview: 'Overview', relations: 'Relations', events: 'Events'
  },
  cluster:   'Cluster',
  namespace: 'Namespace',
  state:     'Audit state',
  all:       'All',
  tz:        'Time zone',
  shown:     (ms) => (ms < 1000 ? `Shown in ${ ms } ms` : `Shown in ${ (ms / 1000).toFixed(1) } s`),
  shownHint: 'How long the last update took: from entering this page (after Rancher itself has loaded) or clicking, to the screen being drawn, measured in the browser with network and drawing. The goal is within 5 seconds.',
  full:      'Full screen',
  exitFull:  'Exit full screen (Esc)',
  resize:    'Drag to resize the detail panel; double-click to reset',
  tzHint:    (tz, src) => `Time zone ${ tz } (source: ${ src })`,
  tzServer:  'backend setting',
  colon:     ': ',
  noActor:   'No author found',
  cascade:   'emptied when the namespace was deleted',
  groupOf:   (cat) => `${ cat } (group)`,
  reason:    {
    'alert-high':         'High-risk alert this day',
    'alert-medium':       'Medium-risk alert this day',
    'no-apiserver-audit': 'This cluster does not collect the apiserver audit log: the change is seen, not who made it',
    'found-on-reconnect': 'Found by comparing versions after collection reconnected; no audit record matches',
    'near-gap':           'Has records within 10 minutes of a collection gap; may be incomplete',
  },
  note: {
    'sa-rancher':              'ServiceAccount of a component Rancher installed',
    'sa-kube-system':          'Built-in cluster component',
    'sa-workload':             'ServiceAccount of a workload',
    'admin-cert':              'Admin certificate on a node; the person cannot be told',
    'rancher-unauthenticated': 'Request Rancher could not authenticate; unknown who',
    'no-actor':                'No author found',
    'system-component':        'Built-in cluster component',
    'rancher-provisioning':    'Rancher internal account (cluster provisioning)',
    'rancher-local-user':      'Rancher local account, possibly shared',
    unclassified:              'Cannot tell person from program',
  },
  depends: {
    'suse-security': {
      setting: 'Whether SUSE Security collection is on',
      text:    'Commands typed inside a container are not in the audit log. When it is on, processes SUSE Security flagged are listed here.',
    },
    'no-apiserver-audit': {
      setting: 'Whether this cluster collects the apiserver audit log',
      text:    'Without it, object versions show that something changed, not who changed it.',
    },
  },
  evReason: {
    'first-alert':        () => 'First medium or high-risk alert this day',
    'first-unattributed': () => 'First change with no author found this day',
    'collector-stopped':  (c) => `Collector ${ c } stopped reporting`,
    'collector-resumed':  (c) => `Collector ${ c } resumed reporting`,
    'collector-silent':   (c) => `Collector ${ c } did not report`,
  },
  progress: {
    index:     'Building the page index (first start after an upgrade); pages are slower until it is done',
    recompute: (d, t) => `Judging records again under the new settings: ${ d } / ${ t }`,
    since:     (t) => `started ${ t }`,
  },
  states: {
    look: 'Look', unclear: 'Unclear', blind: 'Blind', clear: 'Clear',
  },
  sev:       { high: 'high', medium: 'medium' },
  stateHint: {
    look:    'Medium or high risk alerts this day',
    unclear: 'Changed, but nobody can be named',
    blind:   'Next to a gap with no collection',
    clear:   'None of the above',
  },
  summary:    (o, n) => [`${ o } objects changed`, `${ n } operations (system components excluded)`],
  summarySys: (o, n) => [`${ o } objects changed`, `${ n } operations (system components included)`],
  cols:       {
    state: 'Audit state', object: 'Object', where: 'Cluster / Namespace', ticks: 'Operations (00–24)', ops: 'Count', last: 'Last', who: 'Who', via: 'Via',
  },
  clusterScope:   'cluster-scoped',
  hiddenRows:     (s, u) => `Hidden: ${ s } system component rows, ${ u } Rancher UI maintenance rows`,
  show:           'Show',
  hide:           'Hide',
  more:           'Load more',
  noRows:         'No object changed on this day in this scope.',
  loadFailed:     'Load failed',
  backendMissing: 'The Audit Loupe backend was not found (or you lack permission).',
  busy:           'Working…',
  category:       {
    human: 'person', component: 'cluster component', serviceaccount: 'ServiceAccount', rancher: 'Rancher internal', unknown: 'unknown',
  },
  via: {
    rancher: 'Rancher', 'rancher-kubectl': 'Rancher kubectl', apiserver: 'direct apiserver', direct: 'direct apiserver', impersonation: 'Rancher proxy', unknown: 'unknown',
  },
  collect:    { ok: 'normal', blind: 'blind' },
  collectOf:  (c) => `${ c } collection`,
  relCols:    ['Identity', 'Via', 'Cluster', 'Object (colour = audit state, thicker = more operations)'],
  bypass:     'bypasses Rancher',
  filterOn:   'Only: ',
  clear:      'Clear',
  relEmpty:   'Nothing to draw for this day.',
  eventsHead: 'Only changes of audit state, not every operation',
  evSource:   {
    state: 'object state', heartbeat: 'no heartbeat to Audit Loupe', reported: 'reported by collector'
  },
  evEmpty:   'No audit state changed on this day.',
  heldRows:  (n) => `${ n } lines held`,
  batch:     'Batch',
  batchHint: (res) => `Writes without a name (deletecollection, or a create whose name the server generated) ・ ${ res }`,
  dataUntil: 'Newest record',
  detail:    {
    close:      'Close',
    strip:      'Audit state (this day)',
    lastChange: 'Last change',
    current:    'Current state',
    compare:    'Config diff',
    look:       'View',
    noVersions: 'Object versions are not collected for this kind',
    who:        'Who touched it',
    dependsOn:  'Depends on settings',
    related:    'Related objects',
    raw:        'Raw record',
    export:     'Export',
    copy:       'Copy link',
    copied:     'Copied',
    hashChain:  'Hash chain',
    chain:      {
      ok: 'verified', broken: 'broken', pending: 'not verified yet'
    },
    pick:     'Pick an object to see details',
    none:     'This object has no records on this day.',
    versions: 'Versions',
    from:     'From',
    to:       'To',
    noDiff:   'The two versions are identical.',
    loading:  'Loading…',
  },
  tl: {
    prev:       'Previous day',
    next:       'Next day',
    date:       'Date',
    merged:     'All clusters',
    state:      'audit state',
    range:      'Range',
    rangeAll:   'Whole day',
    hint:       'Click a slot or drag the timeline to pick a range; the page then counts only that range',
    ops:        (n, a) => `${ n } operation${ n === 1 ? '' : 's' }${ a ? ` (${ a } alert${ a === 1 ? '' : 's' })` : '' }`,
    clearRange: 'Clear range',
    legend:     {
      look: 'Objects to look at', blind: 'Blind (not collected)', unknown: 'Not decidable yet', op: 'Bar height = operations'
    },
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

// What the backend says, in the page's language: its code when known, else its own text.
export function reasonText(T, code, text) {
  return (code && T.reason[code]) || text || '';
}

export function noteText(T, code, text) {
  return (code && T.note[code]) || text || '';
}

export function eventReason(T, e) {
  const f = e.reasonCode && T.evReason[e.reasonCode];

  return f ? f(e.collector || '') : (e.reason || '');
}

// A ServiceAccount as namespace/name; anything else as it is.
export function shortWho(name) {
  const m = /^system:serviceaccount:([^:]+):(.+)$/.exec(name || '');

  return m ? `${ m[1] }/${ m[2] }` : (name || '');
}

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
  if (v.from !== null && v.from !== undefined && v.to !== null && v.to !== undefined) {
    p.set('from', String(v.from));
    p.set('to', String(v.to));
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

// The right-hand detail of one object (API v0.1): a click on a row asks only for this.
// A 404 whose body says {"error":"no-records"} means the object has no records that day; it
// comes back as { key, none: true }. Any other 404 (an older backend without this call) is
// thrown with its status, and the page falls back to asking for the whole page.
export async function fetchDetail(v, key) {
  const p = new URLSearchParams();

  p.set('day', v.day);
  p.set('key', key);
  if (v.system) {
    p.set('system', '1');
  }
  const res = await fetch(`${ baseUrl() }/api/changemap/detail?${ p }`, {
    credentials: 'same-origin',
    headers:     { Accept: 'application/json' },
  });

  if (res.status === 404) {
    const body = await res.json().catch(() => null);

    if (body?.error === 'no-records') {
      return { key, none: true };
    }
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${ res.status }`);

    err.status = res.status;
    throw err;
  }

  return res.json();
}

// Rows without a name (API v0.1): "*" stands for a deletecollection or a server-named create.
export const BATCH = '*';

// Settings and related objects (API v0.1). An older backend sent related objects as plain
// strings in dependsOn; those are shown as related objects, never as settings.
export function splitDepends(detail) {
  const dep = detail?.dependsOn || [];

  const settings = dep.filter((d) => d && typeof d === 'object');

  // "Unclear because this cluster does not collect the apiserver audit log" depends on that
  // setting; say so like any other setting (requirements: config-dependent subheading).
  if (detail?.stateReasonCode === 'no-apiserver-audit' && !settings.some((d) => d.code === 'no-apiserver-audit')) {
    settings.push({ code: 'no-apiserver-audit' });
  }

  return {
    settings,
    related: [...(detail?.related || []).map((r) => `${ r.rel }: ${ r.kind } ${ r.namespace ? `${ r.namespace }/` : '' }${ r.name }`), ...dep.filter((d) => typeof d === 'string')],
  };
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
