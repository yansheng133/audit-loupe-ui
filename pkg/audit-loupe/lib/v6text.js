// Words of the v6 change map, Chinese and English. Shared words (states, collectors, gap
// reasons, error messages) come from the v5 texts; verbs and rule names from the model texts.
import { textsV5 } from './v5.js';
import { texts as modelTexts } from './model.js';

const ZH = {
  tabs: {
    activity: '活動總覽', findings: '稽核發現', identities: '依身分', scopes: '依資源範圍'
  },
  tabSub: {
    activity: '全日變更時間軸', findings: '依風險分級的行為', identities: '單一帳號的操作軌跡', scopes: '單一 namespace 的變更來源'
  },
  tbc:        '待確認',
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
  groupLine:  (a, b, o) => `${ a } 個帳號・${ b } 段・${ o } 筆`,
  groupShort: {
    people: '人與管理帳號', unrecorded: '未記錄執行者', unauthenticated: 'Rancher 未驗證請求', routine: '例行', system: '系統元件'
  },
  merged:       (g) => `${ g }（合併成一列）`,
  mergedHint:   '點分組標題展開成每個帳號一列',
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
    title:    '一天的操作',
    people:   '人與管理帳號',
    other:    '其他（例行、未記錄執行者、Rancher 未驗證請求）',
    otherSys: '其他（例行、未記錄執行者、Rancher 未驗證請求、系統元件）',
    gap:      '沒有收集',
    look:     '要看的行為',
    mark:     '選中的行為',
    cell:     (m) => `每格 ${ m } 分鐘，高度＝操作筆數`,
    bar:      (a, b, p, o) => `${ a }–${ b } ・ 人與管理帳號 ${ p } 筆 ・ 其他 ${ o } 筆`,
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
    segLine:    (a, b, n) => `${ a }–${ b }・${ n } 筆`,
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
  tabs: {
    activity: 'Activity', findings: 'Findings', identities: 'Identities', scopes: 'Scopes'
  },
  tabSub: {
    activity: 'Changes across the day', findings: 'Behaviours by risk', identities: 'One account at a time', scopes: 'One namespace at a time'
  },
  tbc:        'to be confirmed',
  oldBackend: 'This Audit Loupe backend has no behaviours API yet (/api/behaviors). Upgrade the backend, or use the previous change map for now.',
  openV5:     'Open the previous change map',
  tbcHint:    'The server did not send this value',
  listSep:    ', ',
  moreKinds:  (n) => ` and more (${ n } kinds)`,
  tiers:      {
    look: 'Look', notable: 'Worth knowing', normal: 'Ordinary', unrecorded: 'Author not recorded', unauthenticated: 'Unauthenticated Rancher request', routine: 'Routine', system: 'System component'
  },
  tierHint: {
    look:            'Has a high-risk alert',
    notable:         'Has a medium-risk alert ("bypassed Rancher" and "outside working hours" are only labels and do not count)',
    normal:          'Other behaviours of people and admin accounts',
    unrecorded:      'This cluster has no record of who made the change; only the object change is seen',
    unauthenticated: 'Requests the Rancher audit log records as system:cattle:error',
    routine:         'What programs in the cluster (workload ServiceAccounts) do on their own',
    system:          'Built-in cluster components, and Rancher working in its own namespaces',
  },
  groups: {
    people: 'People and admin accounts', unrecorded: 'Author not recorded', unauthenticated: 'Unauthenticated Rancher requests', routine: 'Routine (workload ServiceAccounts)', system: 'System components'
  },
  groupHint: {
    people:          'Accounts people use; shared accounts are marked',
    unrecorded:      'Only object changes were recorded, not who made them',
    unauthenticated: 'Requests Rancher could not tie to an identity (system:cattle:error)',
    routine:         'Programs in the cluster acting on their own; closed by default',
    system:          'Listed only when system components are shown',
  },
  groupLine:  (a, b, o) => `${ a } account${ a === 1 ? '' : 's' } ・ ${ b } behaviour${ b === 1 ? '' : 's' } ・ ${ o } operation${ o === 1 ? '' : 's' }`,
  groupShort: {
    people: 'People and admins', unrecorded: 'Author not recorded', unauthenticated: 'Unauthenticated requests', routine: 'Routine', system: 'System components'
  },
  merged:       (g) => `${ g } (merged into one line)`,
  mergedHint:   'Click the group heading to show one line per account',
  actorLine:    (b, o) => `${ b } behaviour${ b === 1 ? '' : 's' } ・ ${ o } operation${ o === 1 ? '' : 's' }`,
  expand:       'Expand',
  collapse:     'Collapse',
  clusterScope: 'cluster-scoped',
  inCluster:    (c) => `cluster ${ c }`,
  saNs:         (ns) => `ServiceAccount in namespace ${ ns }`,
  dependsAudit: (c) => `Depends on a setting: ${ c } does not send the apiserver audit log`,
  summary:      (n) => `${ n } behaviour${ n === 1 ? '' : 's' } this day. `,
  summaryLook:  (n, list) => `${ n } to look at: ${ list }. `,
  summaryNone:  'Nothing to look at. ',
  summaryRest:  'The rest is ordinary work or routine background.',
  gapChip:      'Not collected',
  gapChipHint:  (c) => `Collector ${ c } did not report; operations in this time are not filled in later`,
  axis:         {
    activity: 'Actor / namespace', identities: 'Namespace', scopes: 'Accounts that changed it'
  },
  activityHead: 'Each line is one actor in one namespace. A solid block is continuous work; a dashed line means more work within an hour; after an hour, or a collection gap, it is a new behaviour. Click a block for details.',
  findingsHead: 'Behaviours by how serious they are. Each behaviour appears once; its title is its most serious operation.',
  identityHead: (a) => `Identity: ${ a }`,
  scopeHead:    (s) => `Scope: ${ s }`,
  scopeSub:     (c) => `Cluster ${ c }. Deleting a namespace counts in the namespace deleted.`,
  pickGroups:   'Accounts',
  listHead:     (n) => `${ n } behaviour${ n === 1 ? '' : 's' }, most serious first`,
  perActor:     'One line per account',
  inScope:      (a, s) => `${ a } in ${ s }`,
  itemMeta:     (o, j, s) => `${ o } operation${ o === 1 ? '' : 's' } ・ ${ j } object${ j === 1 ? '' : 's' } ・ ${ s } part${ s === 1 ? '' : 's' }`,
  scopeMeta:    (a, b) => `${ a } account${ a === 1 ? '' : 's' } ・ ${ b } behaviour${ b === 1 ? '' : 's' }`,
  lookN:        (n) => `look ${ n }`,
  tags:         {
    direct: 'Direct to apiserver', 'via-rancher': 'Through Rancher', 'off-hours': 'Outside working hours', 'bypassed-rancher': 'Direct to apiserver'
  },
  viaWord: {
    direct: 'Direct to apiserver (bypassing Rancher)', rancher: 'Through Rancher', impersonation: 'Through the Rancher proxy', ace: 'Direct to the downstream cluster endpoint', unknown: 'Unknown (no audit record)'
  },
  overlap:        (o, a, b, n) => `Active in the same ${ n } cells as ${ o } between ${ a } and ${ b }; whether it is one person cannot be told`,
  hiddenLine:     (h) => `Not listed as behaviours: ${ h.system } system component operations, ${ h.uiMaintenance } Rancher UI maintenance actions, ${ h.requestOnly } requests that leave no object, ${ h.failed } failed requests (plus ${ h.failedSystem } by system components)`,
  showSystem:     'Show system components',
  hideSystem:     'Hide system components',
  building:       'Sorting this day into behaviours (first start after an upgrade, or the settings changed). Until it is done this stays empty; that does not mean nothing happened.',
  rulesLine:      (cell, join) => `${ cell }-minute cells; a gap of more than ${ join } minutes, or a collection gap, starts a new behaviour`,
  startedBefore:  'started the day before',
  continuesAfter: 'continues the next day',
  strip:          {
    title:    'Operations this day',
    people:   'People and admin accounts',
    other:    'Others (routine, author not recorded, unauthenticated)',
    otherSys: 'Others (routine, author not recorded, unauthenticated, system components)',
    gap:      'Not collected',
    look:     'Behaviour to look at',
    mark:     'Selected behaviour',
    cell:     (m) => `${ m }-minute cells, height = operations`,
    bar:      (a, b, p, o) => `${ a }–${ b } ・ people and admin accounts ${ p } ・ others ${ o }`,
  },
  gapsSection:  'Collection gaps',
  gapsSub:      'Operations in this time were not received and are not filled in later',
  gapSilent:    (list) => `collector ${ list } did not report`,
  gapOpen:      'not reporting yet',
  noBehaviours: 'No behaviours on this day in this scope.',
  emptySection: 'None.',
  detail:       {
    head:       'Behaviour details',
    pick:       'Click a behaviour to see its details.',
    close:      'Close',
    time:       'Time',
    where:      'Where',
    size:       'Size',
    via:        'Route',
    sizeLine:   (o, j) => `${ o } operation${ o === 1 ? '' : 's' } ・ ${ j } object${ j === 1 ? '' : 's' }`,
    rules:      'Rules triggered',
    ruleLine:   (name, sev, c) => `${ name } (${ sev } risk) ×${ c }`,
    tagOnly:    'label only, does not change the tier',
    segments:   'Continuous parts (joined by dashed lines)',
    segLine:    (a, b, n) => `${ a }–${ b } ・ ${ n } operation${ n === 1 ? '' : 's' }`,
    objects:    'Objects touched',
    objCols:    ['Kind', 'Name', 'Operations'],
    opsHead:    'Operations',
    opCols:     ['Time', 'Action', 'Object'],
    moreObj:    (n) => `${ n } more objects not listed`,
    moreOps:    (n) => `${ n } more operations not listed`,
    truncObjs:  (shown, total) => `Showing the first ${ shown } of ${ total } objects.`,
    truncOps:   (shown, total) => `Showing the first ${ shown } of ${ total } operations.`,
    tags:       'Labels',
    loading:    'Loading…',
    none:       'This behaviour was not found (it may have been judged again).',
    whoNote:    'About this identity',
    tbcObjects: 'The server did not send the objects touched',
    tbcOps:     'The server did not send the operations',
  },
};

// Watch-only changes (no author recorded) carry the change itself as the action.
const WATCH = {
  zh: {
    added: '新增', modified: '有變化', deleted: '刪除', deleting: '刪除中', update: '修改', patch: '修改', added_unseen: '新增（重新連線後才發現）', modified_unseen: '有變化（重新連線後才發現）'
  },
  en: {
    added: 'added', modified: 'changed', deleted: 'deleted', deleting: 'being deleted', update: 'updated', patch: 'patched', added_unseen: 'added (found after reconnecting)', modified_unseen: 'changed (found after reconnecting)'
  },
};

export function textsV6(store) {
  const v5 = textsV5(store);
  const m = modelTexts(store);
  const zh = v5 === textsV5({ getters: { 'i18n/current': () => 'zh-hant' } });
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
