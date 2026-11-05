// Words of the v6 change map, Chinese and English. Shared words (states, collectors, gap
// reasons, error messages) come from the v5 texts; verbs and rule names from the model texts.
import { textsV5 } from './v5.js';
import {
  texts as modelTexts, isZh, plural, num, savedLang, saveLang
} from './model.js';

const acts = (n) => (n === 1 ? '1 activity' : `${ n } activities`);

const ZH = {
  dot:    ' ・ ',
  unseen: '（重新連線後才發現）',
  tabs:   {
    activity: '活動總覽', findings: '稽核發現', identities: '依身分', scopes: '依資源範圍'
  },
  tabSub: {
    activity: '全日變更時間軸', findings: '依風險分級的行為', identities: '單一帳號的操作軌跡', scopes: '單一 namespace 的變更來源'
  },
  tbc:       '待確認',
  rangeLine: (a, b, n, sys) => `只列出和 ${ a }–${ b } 重疊的 ${ n } 段行為${ sys ? `（另有系統元件 ${ sys } 段）` : '' }；上面的件數仍是整天。`,
  lang:      {
    label: '語言', auto: '跟隨 Rancher', zh: '中文', en: 'English'
  },
  oldBackend: '這個 Audit Loupe 後端還沒有「行為」的 API（/api/behaviors）。請升級後端，或先看舊版的變更地圖。',
  openV5:     '開啟舊版變更地圖',
  tbcHint:    '伺服器沒有回傳這個值',
  listSep:    '、',
  moreKinds:  (n) => ` 等 ${ n } 種`,
  tiers:      {
    look: '要看', notable: '值得知道', normal: '一般操作', unrecorded: '未記錄執行者', unauthenticated: 'Rancher 未驗證請求', routine: '例行', system: '系統元件'
  },
  tierHint: {
    look:            '段內有高風險警示',
    notable:         '段內有中風險警示（「繞過 Rancher」「非上班時間」只當標籤，不算）',
    normal:          '人與管理帳號的其他行為',
    unrecorded:      '這座叢集沒有可對應執行者的紀錄，只看到物件變化',
    unauthenticated: 'Rancher audit log 記為 system:cattle:error 的請求',
    routine:         '叢集裡的程式（工作負載的 ServiceAccount）自己在做的事',
    system:          '叢集內建元件與 Rancher 在自己 namespace 裡的動作',
  },
  groups: {
    people: '人與管理帳號', unrecorded: '未記錄執行者', unauthenticated: 'Rancher 未驗證請求', routine: '例行（工作負載的 ServiceAccount）', system: '系統元件'
  },
  groupHint: {
    people:          '人用的帳號；共用帳號另有標示',
    unrecorded:      '只記錄到物件變化，看不到是誰改的',
    unauthenticated: 'Rancher 沒有驗證出身分的請求（system:cattle:error）',
    routine:         '叢集裡的程式自己在做的事，預設收合',
    system:          '只有選了「顯示系統元件」才列出',
  },
  groupLine:  (a, b, o, g) => `${ a } ${ g === 'unrecorded' ? '座叢集' : '個帳號' }・${ b } 段・${ o } 筆`,
  groupShort: {
    people: '人與管理帳號', unrecorded: '未記錄執行者', unauthenticated: 'Rancher 未驗證請求', routine: '例行', system: '系統元件'
  },
  merged:       (g) => `${ g }（合併成一列）`,
  mergedHint:   (g) => (g === 'unrecorded' ? '點分組標題展開成每座叢集一列' : '點分組標題展開成每個帳號一列'),
  actorLine:    (b, o) => `${ b } 段・${ o } 筆`,
  expand:       '展開',
  collapse:     '收合',
  clusterScope: '叢集範圍',
  inCluster:    (c) => `叢集 ${ c }`,
  saNs:         (ns) => `ServiceAccount 所在 namespace：${ ns }`,
  dependsAudit: (c) => `取決於設定：${ c } 未啟用 apiserver audit log`,
  summary:      (n) => `這天有 ${ n } 段行為。`,
  summaryLook:  (n, list) => `${ n } 段要看：${ list }。`,
  summaryNone:  '沒有要看的。',
  summaryRest:  '其餘是一般操作或例行背景。',
  gapChip:      '沒有收集',
  gapChipHint:  (c) => `收集元件 ${ c } 沒有回報；這段時間的操作不會補上`,
  axis:         {
    activity: '執行者／namespace', identities: 'namespace', scopes: '動過這裡的帳號'
  },
  activityHead: '每列是一個執行者在一個 namespace 的行為。實心塊是連續操作，虛線是一小時內又接著做，超過一小時或遇到收集中斷就斷開。點色塊看明細。',
  findingsHead: '以行為為單位，依嚴重程度分區。一段行為只出現一次，標題是段內最嚴重的那一筆。',
  identityHead: (a) => `依身分：${ a }`,
  scopeHead:    (s) => `依資源範圍：${ s }`,
  scopeSub:     (c) => `叢集 ${ c }。刪除 namespace 算在被刪的那個 namespace。`,
  pickGroups:   '帳號',
  listHead:     (n) => `${ n } 段行為，依嚴重程度排列`,
  perActor:     '每個帳號一行摘要',
  inScope:      (a, s) => `${ a } 在 ${ s }`,
  itemMeta:     (o, j, s) => `${ o } 筆・${ j } 個物件・${ s } 小段`,
  scopeMeta:    (a, b) => `${ a } 個帳號・${ b } 段`,
  lookN:        (n) => `要看 ${ n }`,
  tags:         {
    direct: '直連 apiserver', 'via-rancher': '經 Rancher', 'off-hours': '非上班時間', 'bypassed-rancher': '直連 apiserver'
  },
  viaWord: {
    direct: '直連 apiserver（繞過 Rancher）', rancher: '經 Rancher', impersonation: '經 Rancher 代理', ace: '直連下游叢集的授權端點', unknown: '不明（沒有 audit 紀錄）'
  },
  overlap:        (o, a, b, n) => `與 ${ o } 在 ${ a }–${ b } 有 ${ n } 格同時在操作，無法確認是否同一人`,
  hiddenLine:     (h) => `沒有列成行為：系統元件 ${ h.system } 筆、Rancher 介面的維護動作 ${ h.uiMaintenance } 筆、不留下物件的請求 ${ h.requestOnly } 筆、失敗的請求 ${ h.failed } 筆（系統元件另有 ${ h.failedSystem } 筆）`,
  showSystem:     '顯示系統元件',
  hideSystem:     '隱藏系統元件',
  building:       '正在整理這天的行為（升級後第一次啟動，或切段設定改了）。整理完之前這裡是空的，不代表這天沒有操作。',
  rulesLine:      (cell, join) => `每格 ${ cell } 分鐘；相隔超過 ${ join } 分鐘或遇到收集中斷就斷開`,
  startedBefore:  '前一天就開始',
  continuesAfter: '延續到後一天',
  strip:          {
    title:     '一天的操作',
    people:    '人與管理帳號',
    other:     '其他（例行、未記錄執行者、Rancher 未驗證請求）',
    otherSys:  '其他（例行、未記錄執行者、Rancher 未驗證請求、系統元件）',
    rangeHint: '點一格或拖曳可選範圍',
    gap:       '沒有收集',
    look:      '要看的行為',
    mark:      '選中的行為',
    cell:      (m) => `每格 ${ m } 分鐘，長條高度＝操作筆數`,
    bar:       (a, b, p, o) => `${ a }–${ b } ・ 人與管理帳號 ${ p } 筆 ・ 其他 ${ o } 筆`,
  },
  gapsSection:  '收集中斷',
  gapsSub:      '這段時間的操作沒有收到，不會補上',
  gapSilent:    (list) => `收集元件 ${ list } 沒有回報`,
  gapOpen:      '還沒恢復回報',
  noBehaviours: '這一天、這個範圍內沒有行為。',
  emptySection: '沒有。',
  detail:       {
    head:       '行為明細',
    pick:       '點一段行為看明細。',
    close:      '關閉',
    time:       '時間',
    where:      '地方',
    size:       '規模',
    via:        '管道',
    sizeLine:   (o, j) => `${ o } 筆・${ j } 個物件`,
    rules:      '觸發的規則',
    ruleLine:   (name, sev, c) => `${ name }（${ sev }風險）×${ c }`,
    tagOnly:    '只當標籤，不影響分級',
    segments:   '連續的小段（虛線相連）',
    segLine:    (a, b, n) => `${ a === b ? a : `${ a }–${ b }` }・${ n } 筆`,
    objects:    '動到的物件',
    objCols:    ['種類', '名稱', '筆數'],
    opsHead:    '操作紀錄',
    opCols:     ['時間', '動作', '物件'],
    moreObj:    (n) => `還有 ${ n } 個物件沒有列出`,
    moreOps:    (n) => `還有 ${ n } 筆沒有列出`,
    truncObjs:  (shown, total) => `只列出前 ${ shown } 個物件，共 ${ total } 個。`,
    truncOps:   (shown, total) => `只列出前 ${ shown } 筆，共 ${ total } 筆。`,
    tags:       '標籤',
    loading:    '讀取中…',
    none:       '找不到這段行為（可能已重新判斷過）。',
    whoNote:    '身分說明',
    tbcObjects: '伺服器沒有回傳動到的物件清單',
    tbcOps:     '伺服器沒有回傳操作紀錄',
  },
};

const EN = {
  dot:    ' · ',
  unseen: ' (found after reconnecting)',
  tabs:   {
    activity: 'Activity', findings: 'Findings', identities: 'Identities', scopes: 'Scopes'
  },
  tabSub: {
    activity: 'Changes across the day', findings: 'Activities by risk', identities: 'One account at a time', scopes: 'One namespace at a time'
  },
  tbc:       'unknown',
  rangeLine: (a, b, n, sys) => `Listing the ${ n === 1 ? 'activity' : `${ n } activities` } that overlap ${ a }–${ b }${ sys ? ` (plus ${ sys } from system components)` : '' }; the counts above cover the whole day.`,
  lang:      {
    label: 'Language', auto: 'Same as Rancher', zh: '中文', en: 'English'
  },
  oldBackend: 'This Audit Loupe backend does not have the activity API yet (/api/behaviors). Upgrade the backend, or use the previous change map for now.',
  openV5:     'Open the previous change map',
  tbcHint:    'The server did not send this value',
  listSep:    ', ',
  moreKinds:  (total, rest) => ` and ${ rest } more`,
  tiers:      {
    look: 'Needs review', notable: 'Worth knowing', normal: 'Ordinary', unrecorded: 'Actor not recorded', unauthenticated: 'Unauthenticated Rancher requests', routine: 'Routine', system: 'System components'
  },
  tierHint: {
    look:            'Has a high-risk alert',
    notable:         'Has a medium-risk alert ("Bypassed Rancher" and "Outside working hours" are only labels and do not count)',
    normal:          'Other activity by people and admin accounts',
    unrecorded:      'This cluster has no record of who made the change; only the change to the object is seen',
    unauthenticated: 'Requests the Rancher audit log records as system:cattle:error',
    routine:         'What programs in the cluster (workload ServiceAccounts) do on their own',
    system:          'Built-in cluster components, and Rancher working in its own namespaces',
  },
  groups: {
    people: 'People and admin accounts', unrecorded: 'Actor not recorded', unauthenticated: 'Unauthenticated Rancher requests', routine: 'Routine (workload ServiceAccounts)', system: 'System components'
  },
  groupHint: {
    people:          'Accounts people use; shared accounts are marked',
    unrecorded:      'Only object changes were recorded, not who made them',
    unauthenticated: 'Requests Rancher could not tie to an identity (system:cattle:error)',
    routine:         'Programs in the cluster acting on their own; collapsed by default',
    system:          'Listed only when system components are shown',
  },
  groupLine:  (a, b, o, g) => `${ plural(a, g === 'unrecorded' ? 'cluster' : 'account') } · ${ acts(b) } · ${ plural(o, 'operation') }`,
  groupShort: {
    people: 'People and admins', unrecorded: 'Actor not recorded', unauthenticated: 'Unauthenticated requests', routine: 'Routine', system: 'System components'
  },
  merged:       (g) => `${ g } (merged into one line)`,
  mergedHint:   (g) => `Click the group heading to show one line per ${ g === 'unrecorded' ? 'cluster' : 'account' }`,
  actorLine:    (b, o) => `${ acts(b) } · ${ plural(o, 'operation') }`,
  expand:       'Expand',
  collapse:     'Collapse',
  clusterScope: 'Cluster scope',
  inCluster:    (c) => `cluster ${ c }`,
  saNs:         (ns) => `ServiceAccount in namespace ${ ns }`,
  dependsAudit: (c) => `Depends on a setting: ${ c } does not send the API server audit log`,
  summary:      (n) => `${ acts(n) } this day. `,
  summaryLook:  (n, list) => `${ n } need${ n === 1 ? 's' : '' } review: ${ list }. `,
  summaryNone:  'Nothing needs review. ',
  summaryRest:  'The rest is ordinary work or routine background.',
  gapChip:      'Not collected',
  gapChipHint:  (c) => `Not reported by: ${ c }. Operations during this gap are lost and will not be backfilled.`,
  axis:         {
    activity: 'Actor / namespace', identities: 'Namespace', scopes: 'Accounts that changed it'
  },
  activityHead: 'Each line is one actor in one namespace. A solid block is continuous work; a dashed line joins work resumed within an hour. After an hour, or a collection gap, a new activity starts. Click a block for details.',
  findingsHead: 'Activities grouped by how serious they are. Each activity appears once, titled by its most serious operation.',
  identityHead: (a) => `Identity: ${ a }`,
  scopeHead:    (s) => `Scope: ${ s }`,
  scopeSub:     (c) => `Cluster ${ c }. A namespace deletion counts toward the deleted namespace.`,
  pickGroups:   'Accounts',
  listHead:     (n) => `${ acts(n) }, most serious first`,
  perActor:     'One line per account',
  inScope:      (a, s) => (s === 'Cluster scope' ? `${ a } at cluster scope` : `${ a } in ${ s }`),
  itemMeta:     (o, j, s) => `${ plural(o, 'operation') } · ${ plural(j, 'object') } · ${ plural(s, 'segment') }`,
  scopeMeta:    (a, b) => `${ plural(a, 'account') } · ${ acts(b) }`,
  lookN:        (n) => `${ n } to review`,
  tags:         {
    direct: 'Direct to API server', 'via-rancher': 'Through Rancher', 'off-hours': 'Outside working hours', 'bypassed-rancher': 'Direct to API server'
  },
  viaWord: {
    direct: 'Direct to the API server (bypassing Rancher)', rancher: 'Through Rancher', impersonation: 'Through the Rancher proxy', ace: 'Through the Authorized Cluster Endpoint', unknown: 'Unknown (no audit record)'
  },
  overlap:        (o, a, b, n) => `Active at the same time as ${ o } between ${ a } and ${ b } (${ plural(n, 'time cell') }); it may be the same person`,
  hiddenLine:     (h) => `Not listed as activities: ${ plural(h.system, 'system component operation') }, ${ plural(h.uiMaintenance, 'Rancher UI maintenance action') }, ${ plural(h.requestOnly, 'request') } that leave${ h.requestOnly === 1 ? 's' : '' } no object, ${ plural(h.failed, 'failed request') } (plus ${ num(h.failedSystem) } from system components).`,
  showSystem:     'Show system components',
  hideSystem:     'Hide system components',
  building:       'Grouping this day into activities (first start after an upgrade, or the settings changed). Until this is done the page stays empty; that does not mean nothing happened.',
  rulesLine:      (cell, join) => `${ cell }-minute cells; a pause of more than ${ join } minutes, or a collection gap, starts a new activity.`,
  startedBefore:  'started the day before',
  continuesAfter: 'continues the next day',
  strip:          {
    title:     'Operations this day',
    people:    'People and admin accounts',
    other:     'Others (routine, actor not recorded, unauthenticated)',
    otherSys:  'Others (routine, actor not recorded, unauthenticated, system components)',
    rangeHint: 'Click a cell or drag to pick a range',
    gap:       'Not collected',
    look:      'Activity that needs review',
    mark:      'Selected activity',
    cell:      (m) => `${ m }-minute cells, height = operations`,
    bar:       (a, b, p, o) => `${ a }–${ b } · people and admin accounts: ${ p } · others: ${ o }`,
  },
  gapsSection:  'Collection gaps',
  gapsSub:      'Operations during these gaps were not received and will not be backfilled',
  gapSilent:    (list) => `not reported by: ${ list }`,
  gapOpen:      'still not reporting',
  noBehaviours: 'No activity on this day in this scope.',
  emptySection: 'None.',
  detail:       {
    head:       'Activity details',
    pick:       'Click an activity to see its details.',
    close:      'Close',
    time:       'Time',
    where:      'Where',
    size:       'Size',
    via:        'Via',
    sizeLine:   (o, j) => `${ plural(o, 'operation') } · ${ plural(j, 'object') }`,
    rules:      'Rules triggered',
    ruleLine:   (name, sev, c) => `${ name } (${ String(sev).toLowerCase() } risk) ×${ c }`,
    tagOnly:    'label only, does not change the tier',
    segments:   'Segments (joined by dashed lines)',
    segLine:    (a, b, n) => `${ a === b ? a : `${ a }–${ b }` } · ${ plural(n, 'operation') }`,
    objects:    'Objects touched',
    objCols:    ['Kind', 'Name', 'Operations'],
    opsHead:    'Operations',
    opCols:     ['Time', 'Action', 'Object'],
    moreObj:    (n) => `${ n } more ${ n === 1 ? 'object' : 'objects' } not listed`,
    moreOps:    (n) => `${ n } more ${ n === 1 ? 'operation' : 'operations' } not listed`,
    truncObjs:  (shown, total) => `Showing the first ${ shown } of ${ total } objects.`,
    truncOps:   (shown, total) => `Showing the first ${ shown } of ${ total } operations.`,
    tags:       'Labels',
    loading:    'Loading…',
    none:       'This activity was not found (it may have been re-evaluated).',
    whoNote:    'About this identity',
    tbcObjects: 'The server did not send the objects touched',
    tbcOps:     'The server did not send the operations',
  },
};

// Watch-only changes (no author recorded) carry the change itself as the action.
const WATCH = {
  zh: {
    added: '新增', modified: '有變化', deleted: '刪除', deleting: '刪除中', update: '修改', patch: '修改', added_unseen: '新增', modified_unseen: '有變化'
  },
  en: {
    added: 'added', modified: 'changed', deleted: 'deleted', deleting: 'started deleting', update: 'updated', patch: 'patched', added_unseen: 'added', modified_unseen: 'changed'
  },
};

export { savedLang, saveLang };

export function textsV6(store, lang = '') {
  const v5 = textsV5(store, lang);
  const m = modelTexts(store, lang);
  const zh = isZh(store, lang);
  const own = zh ? ZH : EN;

  return {
    ...v5,
    ...own,
    zh,
    // The v5 wording for a missing author is retired: the actor is either not recorded or an
    // unauthenticated request.
    note:     { ...v5.note, 'no-actor': own.tiers.unrecorded },
    noActor:  own.tiers.unrecorded,
    evReason: { ...v5.evReason, 'first-unattributed': () => own.tiers.unrecorded },
    verbs:    { ...m.verbs, ...(zh ? WATCH.zh : WATCH.en) },
    rules:    m.rules,
    ruleWhat: m.rulesPage?.what_ || {},
    sevWord:  m.sev,
    refused:  m.refused,
    failed:   m.failed,
    detail:   { ...v5.detail, ...own.detail },
  };
}
