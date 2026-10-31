// v6 change map: behaviours (API docs/api/behaviors-v0.md in the backend repo; task book
// docs/lab/task-1101-behaviors.md §4). The server cuts the day into behaviours, judges their
// tier and counts everything; this file only lays out what it returns (groups, lanes, lists,
// positions) and words it. Nothing here segments operations or judges a tier.
import { fmtTime } from './v5.js';
import { baseUrl } from './api.js';

// GET a JSON answer; a failure keeps its status and its JSON body (if any).
async function getJsonV6(path, params) {
  const res = await fetch(`${ baseUrl() }${ path }?${ params }`, {
    credentials: 'same-origin',
    headers:     { Accept: 'application/json' },
  });

  if (!res.ok) {
    const err = new Error(`HTTP ${ res.status }`);

    err.status = res.status;
    err.body = await res.json().catch(() => null);
    throw err;
  }

  return res.json();
}

// ---------- the four tabs ----------
export const TABS = ['activity', 'findings', 'identities', 'scopes'];

// Tiers, most serious first (the server's order). "look" is the only one drawn in red.
export const TIERS = ['look', 'notable', 'normal', 'unrecorded', 'unauthenticated', 'routine', 'system'];
export const TIER_RANK = Object.fromEntries(TIERS.map((t, i) => [t, i]));

// Actor groups in the activity lanes, in this order; people open by default. "system" only
// comes back when the page asks for system components.
export const GROUPS = ['people', 'unrecorded', 'unauthenticated', 'routine', 'system'];

// ---------- reading the response ----------
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// The lane group: the server's, else people (an unknown group is never hidden).
export const actorGroup = (a) => (a && GROUPS.includes(a.group) ? a.group : 'people');

// An identity as the page tells them apart: the server's key, except the actor nobody recorded,
// which the server lists once per cluster (the reason differs per cluster).
export const identityId = (key, group, cluster) => (group === 'unrecorded' ? `~${ cluster || '' }` : key);

export function normActor(a = {}, cluster = '') {
  const key = a.key ?? a.name ?? '';
  const group = actorGroup(a);

  return {
    // The server's id (contract v0.1); built the same way when an older server sends none.
    id:        a.id ?? identityId(key, group, cluster || (a.clusters || [])[0]),
    key,
    name:      a.name || '',
    category:  a.category || null,
    noteCode:  a.noteCode || null,
    note:      a.note || '',
    group,
    dependsOn: a.dependsOn || null,
  };
}

// One behaviour as the views use it. Missing values stay null (shown as "to be confirmed"),
// never guessed.
export function normBehaviour(b) {
  const segments = (b.segments || []).map((s) => ({
    fromMs: s.fromMs, toMs: s.toMs, firstMs: num(s.firstMs), lastMs: num(s.lastMs), ops: num(s.ops)
  })).sort((x, y) => x.fromMs - y.fromMs);
  const first = segments[0];
  const last = segments[segments.length - 1];

  return {
    id:             String(b.id),
    cluster:        b.cluster || '',
    scope:          b.scope || '',
    actor:          normActor(b.actor, b.cluster),
    tier:           TIERS.includes(b.tier) ? b.tier : null,
    title:          b.title || null,
    what:           b.what || [],
    segments,
    fromMs:         num(b.fromMs) ?? (first ? first.fromMs : null),
    toMs:           num(b.toMs) ?? (last ? last.toMs : null),
    // The first and last operation's own time (for "08:05–08:47").
    firstMs:        first ? first.firstMs : null,
    lastMs:         last ? last.lastMs : null,
    startedBefore:  !!b.startedBefore,
    continuesAfter: !!b.continuesAfter,
    ops:            num(b.ops),
    objects:        num(b.objects),
    objectsTop:     b.objectsTop || null,
    via:            b.via || [],
    tags:           b.tags || [],
    rules:          (b.rules || []).map((r) => ({
      rule: r.rule, severity: r.severity || null, count: num(r.count), tagOnly: !!r.tagOnly
    })),
    truncated: !!b.truncated,
  };
}

export function normalize(res) {
  const behaviours = (res?.behaviors || []).map(normBehaviour);

  return {
    day:        res?.day || '',
    tz:         res?.tz || '',
    dayStartMs: num(res?.dayStartMs),
    dayEndMs:   num(res?.dayEndMs),
    settings:   res?.settings || null,
    summary:    res?.summary || null,
    hidden:     res?.hidden || null,
    gaps:       res?.gaps || [],
    behaviours,
    actors:     (res?.actors || []).map((a) => ({
      ...normActor(a, (a.clusters || [])[0]), clusters: a.clusters || [], behaviors: num(a.behaviors), ops: num(a.ops), look: num(a.look)
    })),
    scopes: (res?.scopes || []).map((s) => ({
      cluster: s.cluster || '', scope: s.scope || '', actors: num(s.actors), behaviors: num(s.behaviors), ops: num(s.ops), look: num(s.look), tier: s.tier || null
    })),
    strip:    res?.strip || null,
    overlaps: res?.overlaps || [],
    selected: res?.selected ?? null,
    detail:   res?.detail || null,
    meta:     res?.meta || null,
  };
}

// ---------- ordering ----------
export const tierRank = (t) => (t in TIER_RANK ? TIER_RANK[t] : TIERS.length);
export const worstTier = (list) => list.reduce((m, b) => (tierRank(b.tier) < tierRank(m) ? b.tier : m), null);
const byTime = (x, y) => (x.fromMs ?? 0) - (y.fromMs ?? 0) || String(x.id).localeCompare(String(y.id));
const byTier = (x, y) => tierRank(x.tier) - tierRank(y.tier) || byTime(x, y);
const sumOps = (list) => (list.some((b) => b.ops === null) ? null : list.reduce((s, b) => s + b.ops, 0));

function groupBy(list, keyOf) {
  const m = new Map();

  list.forEach((x) => {
    const k = keyOf(x);

    if (!m.has(k)) {
      m.set(k, []);
    }
    m.get(k).push(x);
  });

  return m;
}

// ---------- the summary line (the server's numbers) ----------
export function summaryChips(summary) {
  const by = summary?.byTier || {};

  return TIERS.filter((t) => t !== 'system').map((t) => ({ tier: t, count: num(by[t]) }));
}

// ---------- collection gaps ----------
// Overlapping gaps of one cluster merged for drawing; the collectors that were silent are kept.
export function mergedGaps(gaps, cluster) {
  const g = (gaps || []).filter((x) => cluster === undefined || x.cluster === cluster).slice().sort((a, b) => a.fromMs - b.fromMs);
  const out = [];

  for (const x of g) {
    const l = out[out.length - 1];

    if (l && l.cluster === x.cluster && x.fromMs <= l.toMs) {
      l.toMs = Math.max(l.toMs, x.toMs);
      if (x.collector && !l.collectors.includes(x.collector)) {
        l.collectors.push(x.collector);
      }
    } else {
      out.push({
        cluster: x.cluster, fromMs: x.fromMs, toMs: x.toMs, collectors: x.collector ? [x.collector] : []
      });
    }
  }

  return out;
}

// ---------- lanes: shared by activity, identities and scopes ----------
const pctOf = (t, d0, dayMs) => Math.min(100, Math.max(0, ((t - d0) / dayMs) * 100));

// Blocks and dashed links of one behaviour, as percentages of the day.
export function trackMarks(b, d0, dayMs) {
  const blocks = b.segments.map((s) => ({
    left: pctOf(s.fromMs, d0, dayMs), width: Math.max(0, pctOf(s.toMs, d0, dayMs) - pctOf(s.fromMs, d0, dayMs)), seg: s
  }));
  const dashes = b.segments.slice(1).map((s, i) => {
    const p = b.segments[i];

    return { left: pctOf(p.toMs, d0, dayMs), width: Math.max(0, pctOf(s.fromMs, d0, dayMs) - pctOf(p.toMs, d0, dayMs)) };
  }).filter((d) => d.width > 0);

  return { blocks, dashes };
}

// The time a behaviour covers on the time bar: its first cell to the end of its last, the
// same span its blocks are drawn over (the server's fromMs/toMs are the operations' own times).
export function behaviourSpan(b) {
  if (!b || !b.segments.length) {
    return null;
  }

  return [b.segments[0].fromMs, b.segments[b.segments.length - 1].toMs];
}

// The rows of one actor in one cluster: one per target namespace, worst first, then earliest.
export function scopeRowsOf(list) {
  const by = groupBy(list, (b) => b.scope);

  return [...by.entries()].map(([scope, bs]) => ({
    type: 'sub', key: `s|${ bs[0].cluster }|${ bs[0].actor.id }|${ scope }`, scope, cluster: bs[0].cluster, behaviours: bs.sort(byTime), ops: sumOps(bs), worst: worstTier(bs)
  })).sort((x, y) => tierRank(x.worst) - tierRank(y.worst) || byTime(x.behaviours[0], y.behaviours[0]));
}

// Activity tab: groups → actors (one row per cluster) → target namespaces. A closed group is
// one merged line per cluster; a closed actor is one line with all its behaviours.
// open: { groups: [names open], actors: { [key]: true|false } }
export function activityRows(list, open = {}) {
  const groupsOpen = open.groups || ['people'];
  const actorsOpen = open.actors || {};
  const rows = [];

  for (const g of GROUPS) {
    const inG = list.filter((b) => b.actor.group === g);

    if (!inG.length) {
      continue;
    }
    const isOpen = groupsOpen.includes(g);
    const actors = groupBy(inG, (b) => b.actor.id);

    rows.push({
      type: 'group', key: `g|${ g }`, group: g, open: isOpen, actors: actors.size, behaviours: inG.length, ops: sumOps(inG)
    });
    if (!isOpen) {
      for (const [cluster, bs] of groupBy(inG, (b) => b.cluster)) {
        rows.push({
          type: 'merged', key: `m|${ g }|${ cluster }`, group: g, cluster, actor: bs[0].actor, behaviours: bs.sort(byTime), worst: worstTier(bs)
        });
      }
      continue;
    }
    const order = [...actors.entries()].sort((x, y) => tierRank(worstTier(x[1])) - tierRank(worstTier(y[1])) || x[0].localeCompare(y[0]));

    for (const [key, bs] of order) {
      const byCluster = groupBy(bs, (b) => b.cluster);
      const aOpen = actorsOpen[key] ?? (g === 'people');

      for (const [cluster, cbs] of byCluster) {
        cbs.sort(byTime);
        rows.push({
          type: 'actor', key: `a|${ key }|${ cluster }`, actorKey: key, actor: cbs[0].actor, cluster, multiCluster: byCluster.size > 1, open: aOpen, behaviours: aOpen ? [] : cbs, count: cbs.length, ops: sumOps(cbs), worst: worstTier(cbs)
        });
        if (aOpen) {
          rows.push(...scopeRowsOf(cbs));
        }
      }
    }
  }

  return rows;
}

// "Worked in the same cells as …" hints of one actor (people only; never "the same person").
export function overlapsOf(overlaps, key) {
  return (overlaps || []).filter((o) => (o.actors || []).includes(key)).map((o) => ({
    other: o.actors.find((a) => a !== key) ?? '', cells: num(o.cells), fromMs: o.fromMs, toMs: o.toMs
  }));
}

// ---------- findings tab ----------
// Sections by tier; look and notable open, the rest closed unless asked.
export const FINDINGS_OPEN = ['look', 'notable'];

export function findingsSections(list, open = FINDINGS_OPEN) {
  const present = new Set(list.map((b) => b.tier));

  return TIERS.filter((t) => t !== 'system' || present.has('system')).map((t) => ({
    tier: t, open: open.includes(t), items: list.filter((b) => b.tier === t).sort(byTime)
  }));
}

// ---------- identities tab (the server's account list) ----------
export function identityGroups(actors) {
  return GROUPS.map((g) => ({ group: g, items: actors.filter((a) => a.group === g) })).filter((x) => x.items.length);
}

// The first identity to show: the actor of the most serious behaviour.
export function defaultIdentity(list) {
  const b = [...list].sort(byTier)[0];

  return b ? b.actor.id : null;
}

export function identityRows(list, key) {
  const mine = list.filter((b) => b.actor.id === key);
  const rows = [];
  const clusters = groupBy(mine, (b) => b.cluster);

  for (const [, bs] of clusters) {
    rows.push(...scopeRowsOf(bs).map((r) => ({ ...r, showCluster: clusters.size > 1 })));
  }

  return rows;
}

export function identityBehaviours(list, key) {
  return list.filter((b) => b.actor.id === key).sort(byTier);
}

// ---------- scopes tab (the server's namespace list) ----------
export const placeKey = (cluster, scope) => `${ cluster }/${ scope || '' }`;
export function parsePlace(k) {
  const s = String(k || '');
  const i = s.indexOf('/');

  return i < 0 ? { cluster: s, scope: '' } : { cluster: s.slice(0, i), scope: s.slice(i + 1) };
}

export function scopeGroups(scopes) {
  return [...groupBy(scopes, (s) => s.cluster).entries()].map(([cluster, items]) => ({ cluster, items: items.map((s) => ({ ...s, key: placeKey(s.cluster, s.scope) })) }));
}

export function defaultPlace(list) {
  const b = [...list].sort(byTier)[0];

  return b ? placeKey(b.cluster, b.scope) : null;
}

// Who touched one namespace: one lane per actor, worst first, then the busiest; with a one-line
// summary each (the server's counts added up per actor).
export function scopeActors(list, key) {
  const { cluster, scope } = parsePlace(key);
  const here = list.filter((b) => b.cluster === cluster && b.scope === scope);

  return [...groupBy(here, (b) => b.actor.id).entries()].map(([k, bs]) => {
    const what = new Map();

    bs.forEach((b) => b.what.forEach((w) => {
      const wk = `${ w.verb }|${ w.kind }`;
      const cur = what.get(wk);

      if (cur) {
        cur.count = cur.count === null || num(w.count) === null ? null : cur.count + w.count;
      } else {
        what.set(wk, { ...w, count: num(w.count) });
      }
    }));
    bs.sort(byTime);
    const firsts = bs.map((b) => b.firstMs).filter((t) => t !== null);
    const lasts = bs.map((b) => b.lastMs).filter((t) => t !== null);

    return {
      key:        `w|${ cluster }|${ k }|${ scope }`,
      actorKey:   k,
      actor:      bs[0].actor,
      cluster,
      behaviours: bs,
      ops:        sumOps(bs),
      worst:      worstTier(bs),
      head:       bs.find((b) => b.tier === 'look') || bs.find((b) => b.tier === 'notable') || null,
      what:       [...what.values()].sort((x, y) => (y.count ?? 0) - (x.count ?? 0)),
      firstMs:    firsts.length ? Math.min(...firsts) : null,
      lastMs:     lasts.length ? Math.max(...lasts) : null,
    };
  }).sort((x, y) => tierRank(x.worst) - tierRank(y.worst) || y.behaviours.length - x.behaviours.length || x.actorKey.localeCompare(y.actorKey));
}

// ---------- the bottom strip ----------
// One bar per cell with operations: people dark, everyone else light; heights by square root
// so one busy cell does not flatten the rest.
export function stripBars(strip) {
  const cells = (strip?.cells || []).map((c) => {
    const people = num(c.people) || 0;
    const other = (num(c.routine) || 0) + (num(c.unrecorded) || 0) + (num(c.unauthenticated) || 0) + (num(c.system) || 0);

    return {
      t: c.t, people, other, total: people + other, cell: c
    };
  }).filter((c) => c.total > 0);
  const max = Math.max(1, ...cells.map((c) => c.total));
  const h = (v) => (v > 0 ? Math.max(8, Math.round((Math.sqrt(v) / Math.sqrt(max)) * 100)) : 0);

  return cells.map((c) => ({
    ...c, hTotal: h(c.total), hPeople: h(c.people)
  }));
}

// ---------- words ----------
export function verbText(T, w) {
  const v = w?.verb;

  return (v && T.verbs[v]) || v || T.tbc;
}

export function titleText(T, t) {
  if (!t) {
    return null;
  }

  return [verbText(T, t), t.kind, t.name].filter(Boolean).join(' ');
}

export function whatText(T, what, n = 3) {
  const list = what || [];
  const shown = list.slice(0, n).map((w) => `${ verbText(T, w) } ${ w.kind || '' } ×${ w.count ?? T.tbc }`);

  return shown.join(T.listSep) + (list.length > n ? T.moreKinds(list.length) : '');
}

// The title of a behaviour: its most serious operation, or "where: what" when it has none.
export function headline(T, b, n = 2) {
  return titleText(T, b.title) || `${ scopeLabel(T, b.scope) }${ T.colon }${ whatText(T, b.what, n) || T.tbc }`;
}

// HH:MM, or HH:MM–HH:MM, from the first and last operation's own time.
export function rangeText(b, tz) {
  if (b.firstMs === null || b.lastMs === null) {
    return null;
  }
  const a = fmtTime(b.firstMs, tz);
  const z = fmtTime(b.lastMs, tz);

  return a === z ? a : `${ a }–${ z }`;
}

export const scopeLabel = (T, scope) => scope || T.clusterScope;

// A ServiceAccount by its own name (its namespace is said next to it); an actor nobody recorded
// by its group's name; anything else as it is.
export function actorLabel(T, a) {
  if (!a || !a.name) {
    return a && a.group === 'unrecorded' ? T.groups.unrecorded : T.tbc;
  }
  const m = /^system:serviceaccount:([^:]+):(.+)$/.exec(a.name);

  return m ? m[2] : a.name;
}

export function saNamespace(a) {
  const m = /^system:serviceaccount:([^:]+):/.exec(a?.name || '');

  return m ? m[1] : '';
}

// What an identity is, in the page's language: the identity codes, then the reason codes an
// unrecorded actor carries (no-apiserver-audit, found-on-reconnect); the server's own text last.
export function noteOf(T, a) {
  const c = a?.noteCode;

  return (c && (T.note[c] || T.reason?.[c])) || a?.note || '';
}

// Labels of a behaviour, from the server's tag codes. "direct" (a fact: an operation went
// straight to the apiserver) is the one "direct to apiserver" label; "bypassed-rancher" is the
// rule of the same name and is listed under the rules instead (contract v0.1 §4).
export function tagTexts(T, b) {
  const out = [];

  for (const t of b.tags) {
    if (t === 'bypassed-rancher') {
      continue;
    }
    const s = T.tags[t] || t;

    if (!out.includes(s)) {
      out.push(s);
    }
  }

  return out;
}

// ---------- requests ----------
// Every request carries the day, the clusters and whether system components are listed; a
// different selection alone only asks for that behaviour's detail.
export function apiParams(v) {
  const p = new URLSearchParams();

  p.set('day', v.day);
  v.cluster.forEach((c) => p.append('cluster', c));
  if (v.system) {
    p.set('system', '1');
  }
  if (v.select) {
    p.set('select', v.select);
  }

  return p;
}

export const listSig = (v) => apiParams({ ...v, select: '' }).toString();

export function fetchBehaviours(params) {
  return getJsonV6('/api/behaviors', params);
}

// The detail of one behaviour. A 404 with {"error":"no-records"} means it is gone (judged again,
// or another day): { id, none: true }.
export async function fetchBehaviourDetail(v, id) {
  const p = new URLSearchParams();

  p.set('day', v.day);
  p.set('id', id);
  if (v.system) {
    p.set('system', '1');
  }
  try {
    return await getJsonV6('/api/behaviors/detail', p);
  } catch (e) {
    if (e.status === 404 && e.body?.error === 'no-records') {
      return { id, none: true };
    }
    throw e;
  }
}

// Sent from the route guard so it is on the wire before the page mounts (one request).
let early = null;

export function prefetch(v) {
  const params = apiParams(v);

  early = { key: params.toString(), promise: fetchBehaviours(params) };
  early.promise.catch(() => {});
}

export function takePrefetched(params) {
  const e = early;

  early = null;

  return e && e.key === params.toString() ? e.promise : null;
}

// ---------- URL <-> view state ----------
const arr = (v) => (v === undefined || v === null || v === '' ? [] : [].concat(v));
const csv = (v) => (v ? String(v).split(',').filter(Boolean) : []);

export function viewFromQuery(q = {}, today = '') {
  return {
    day:     q.day || today,
    tab:     TABS.includes(q.tab) ? q.tab : 'activity',
    cluster: arr(q.cluster),
    system:  q.system === '1',
    select:  q.select || '',
    who:     q.who ?? null,
    place:   q.place ?? null,
    open:    q.open !== undefined ? csv(q.open).filter((g) => GROUPS.includes(g)) : ['people'],
    flip:    csv(q.flip).map((k) => (k === NOKEY ? '' : k)),
    show:    q.show !== undefined ? csv(q.show).filter((t) => TIERS.includes(t)) : FINDINGS_OPEN,
    from:    q.from ? Number(q.from) : null,
    to:      q.to ? Number(q.to) : null,
  };
}

export function queryFromView(v) {
  const q = { day: v.day, tab: v.tab };

  if (v.cluster.length) {
    q.cluster = v.cluster;
  }
  if (v.system) {
    q.system = '1';
  }
  if (v.select) {
    q.select = v.select;
  }
  if (v.who !== null && v.who !== undefined) {
    q.who = v.who;
  }
  if (v.place) {
    q.place = v.place;
  }
  if (v.open.join(',') !== 'people') {
    q.open = v.open.join(',');
  }
  if (v.flip.length) {
    q.flip = v.flip.map((k) => (k === '' ? NOKEY : k)).join(',');
  }
  if (v.show.join(',') !== FINDINGS_OPEN.join(',')) {
    q.show = v.show.join(',');
  }
  if (v.from !== null && v.from !== undefined && v.to !== null && v.to !== undefined) {
    q.from = String(v.from);
    q.to = String(v.to);
  }

  return q;
}

// Which actors are open: people open, everyone else closed, except the actors in `flip` (the
// URL keeps only those exceptions). The actor nobody recorded (key "") is written as NOKEY.
export const NOKEY = '~';

export function actorsOpen(v, behaviours) {
  const out = {};

  for (const b of behaviours) {
    const k = b.actor.id;

    if (!(k in out)) {
      out[k] = (b.actor.group === 'people') !== v.flip.includes(k);
    }
  }

  return out;
}

export function flipActor(v, key) {
  return v.flip.includes(key) ? v.flip.filter((k) => k !== key) : [...v.flip, key];
}

// "Depends on a setting": the cluster that does not send the apiserver audit log, as the server
// says it (actor.dependsOn); nothing when it did not say so.
export function settingNote(a) {
  const d = a?.dependsOn;

  return d && d.code === 'no-apiserver-audit' ? {
    code: d.code, cluster: d.cluster || '', collectors: d.collectors || []
  } : null;
}

// A time range picked on the strip: the server cuts whole days only (contract v0.1 §1), so the
// page keeps the behaviours with any part overlapping [from, to) and changes no count.
export function inRange(list, from, to) {
  if (from === null || from === undefined || to === null || to === undefined) {
    return list;
  }

  return list.filter((b) => b.segments.some((s) => s.fromMs < to && s.toMs > from));
}
