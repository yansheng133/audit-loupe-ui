import json,collections,datetime,sys
import os; src=os.environ.get('AL_EXPORT','./export/')
TZ=datetime.timezone(datetime.timedelta(hours=8))
DAY0=int(datetime.datetime(2026,10,30,tzinfo=TZ).timestamp()*1000)
D=json.load(open(src+'changemap-details.json')); R={r['key']:r for r in json.load(open(src+'changemap-rows.json'))}
E=json.load(open(src+'changemap-events.json')); S=json.load(open(src+'stories.json'))
CL={'c-m-26kbxk5f':'rke2','local':'local'}
ops={}; trunc=[]; seq=0
for d in D:
  k=d['key']; p=k.split('/'); r=R[k]
  if len(d['detail']['ops'])<r['ops']: trunc.append([CL[p[0]],r['namespace'] or '',r['kind'],r['name'],len(d['detail']['ops']),r['ops']])
  for o in d['detail']['ops']:
    who=o['who'] or ''; seq+=1
    ops[(o['t'],k,who,o['verb'],seq)]=dict(t=o['t'],cl=CL[p[0]],ns=p[3],res=p[2],kind=r['kind'],name=p[4],verb=o['verb'],via=o['via'],who=who,cat=o['category'],nc=o['noteCode'],note=o['note'],rules=[],sev=None,state=r['state'],key=k)
# attach alerts from stories (and add missing alerted ops lost to truncation)
added=0
for s in S:
  for e in s['events']:
    t=int(datetime.datetime.fromisoformat(e['ts']).timestamp()*1000)
    cand=[v for kk,v in ops.items() if abs(kk[0]-t)<=1 and v['who']==s['actor'] and v['name']==e['name'] and v['res']==e['resource']]
    rules=[[a,e['alert_severity'][a]] for a in e['alerts']]
    sev='high' if any(x[1]=='high' for x in rules) else ('medium' if any(x[1]=='medium' for x in rules) else 'low')
    if cand:
      for v in cand: v['rules']=rules; v['sev']=sev
    else:
      k=[kk for kk in R if kk.startswith(s['cluster']+'/') and kk.endswith('/'+(e['namespace'] or '')+'/'+e['name']) and ('/'+e['resource']+'/') in kk]
      r=R[k[0]] if k else None
      ops[(t,'story',e['id'])]=dict(t=t,cl=CL[s['cluster']],ns=e['namespace'],res=e['resource'],kind=r['kind'] if r else e['resource'],name=e['name'],verb=e['verb'],via=s['via'],who=s['actor'],cat='human',nc='admin-cert',note=None,rules=rules,sev=sev,state=r['state'] if r else 'look',key=k[0] if k else None,fromStory=True); added+=1
O=sorted(ops.values(),key=lambda o:o['t'])
notes={}
for o in O:
  if o['note'] and o['who'] not in notes: notes[o['who']]=(o['cat'],o['nc'],o['note'])
for o in O:
  if o['note'] is None: o['cat'],o['nc'],o['note']=notes.get(o['who'],('human','admin-cert',''))
# unattributed reason per cluster
unr={}
for r in R.values():
  if r['stateReasonCode']=='no-apiserver-audit': unr[CL[r['cluster']]]=r['stateReason']
actors=sorted({o['who'] for o in O}); AI={a:i for i,a in enumerate(actors)}
ACT=[dict(id=a,cat=notes.get(a,('human','admin-cert',''))[0],nc=notes.get(a,('human','admin-cert',''))[1],note=notes.get(a,('','',''))[2] or '管理者憑證，對不到個人') for a in actors]
out=dict(day='2026-10-30',tz='Asia/Taipei',day0=DAY0,actors=ACT,cols=['t','a','cl','ns','kind','name','verb','via','rules','sev','state','fromStory'],
  ops=[[o['t']-DAY0,AI[o['who']],o['cl'],o['ns'],o['kind'],o['name'],o['verb'],o['via'],o['rules'],o['sev'],o['state'],1 if o.get('fromStory') else 0] for o in O],
  gaps=[dict(cl=CL[g['cluster']],c=g['collector'],f=g['fromMs'],t=g['toMs']) for g in E['timeline']['gaps']],
  trunc=trunc,unattributedReason=unr,counts=E['counts'],hidden=E['hidden'])
json.dump(out,open('data.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(O),'ops; added from stories',added,'; trunc',len(trunc)); print(unr); print(notes)
print(collections.Counter((o['who'],o['sev']) for o in O if o['sev']))
