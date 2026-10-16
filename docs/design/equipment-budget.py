"""EQ-01 v2: six universal slots, unique item IDs; paper balance, not runtime validation.
Run: python3 docs/design/equipment-budget.py. IDs in a build are in purchase order.
"""
import json
from itertools import combinations
ITEMS = {
'sword':('weapon',100,dict(ad=12,armor=8)),
'staff':('weapon',100,dict(ap=30,haste=10)),
'bow':('weapon',100,dict(ad=4,as_=0.20)),
'bulwark':('weapon',100,dict(hp=60,armor=22)),
'reaver':('weapon',100,dict(ad=8,vamp=0.06)),
'runeblade':('weapon',100,dict(ad=6,ap=18,haste=8)),
'plate':('body',100,dict(hp=75,armor=18)),
'robe':('body',100,dict(hp=30,ap=24)),
'leather':('body',100,dict(ad=3,as_=0.18,ms=0.08)),
'duelistVest':('body',100,dict(ad=3,as_=0.16,crit=0.18)),
'wardMantle':('body',100,dict(hp=55,mr=20)),
'sanguineWrap':('body',100,dict(hp=45,ad=6,vamp=0.06)),
'helm':('head',100,dict(hp=55,armor=12,mr=8)),
'circlet':('head',100,dict(ap=20,haste=12)),
'hood':('head',100,dict(ad=9,ms=0.08)),
'keenVisor':('head',100,dict(ad=8,crit=0.18)),
'sageMask':('head',100,dict(ap=20,mpen=10)),
'aegisCrown':('head',100,dict(hp=55,mr=22)),
}
ATTACK_RANGES={'sword':2.5,'staff':6.5,'bow':7.5,'bulwark':2.5,'reaver':2.5,'runeblade':2.5}
BUILDS={
'裸装':(),
'历史10件六格远程输出':('sword','staff','leather','circlet','hood','bow'),
'历史10件六格防御':('sword','plate','robe','helm','circlet','bulwark'),
'开局近战':('sword',),
'首次店近战':('sword','plate'),
'第三关前近战':('sword','plate','hood'),
'五件攻速暴击':('sword','reaver','leather','duelistVest','bow'),
'六件攻速暴击':('sword','reaver','leather','duelistVest','bow','keenVisor'),
'六件AP远程':('runeblade','robe','circlet','sageMask','reaver','staff'),
'六件混合近战':('staff','robe','circlet','sageMask','keenVisor','runeblade'),
'六件双抗坦克':('plate','helm','wardMantle','aegisCrown','sanguineWrap','bulwark'),
'六件AD施法':('sword','hood','keenVisor','reaver','sanguineWrap','circlet'),
'六件远程均衡':('sword','plate','robe','circlet','helm','bow'),
'六件全武器':('sword','staff','bulwark','reaver','runeblade','bow'),
'六件全身体':('plate','robe','leather','duelistVest','wardMantle','sanguineWrap'),
'六件全头部':('helm','circlet','hood','keenVisor','sageMask','aegisCrown'),
}
def calculate(ids,armor=30,mr=30):
 assert len(ids)<=6 and len(ids)==len(set(ids))
 s=dict(hp=240,ad=20,ap=0,armor=0,mr=0,as_=0,crit=0,haste=0,vamp=0,mpen=0,ms=0)
 for i in ids:
  for k,v in ITEMS[i][2].items():s[k]+=v
 attack_speed=min(3,(1+s['as_'])/0.7)
 basic=s['ad']*attack_speed*(1+min(1,s['crit']))
 fire=(38+0.38*s['ap'])*(1+s['haste']/100)/1.6
 nova=(72+0.72*s['ap'])*(1+s['haste']/100)/13
 physical=basic
 # Deliberately upper bound: successful direct attack after skill every 3 seconds.
 proc=(8+0.20*s['ad']+0.12*s['ap'])/3 if 'runeblade' in ids else 0
 magic=fire+nova+proc
 passive_shield=18+0.05*s['hp'] if 'wardMantle' in ids else 0
 raw_ms=421.25*(1+s['ms'])
 world_ms=(raw_ms*.5+230 if raw_ms>490 else raw_ms*.8+83 if raw_ms>415 else raw_ms*.5+110 if raw_ms<220 else raw_ms)*.01
 current_weapon=next((i for i in reversed(ids) if ITEMS[i][0]=='weapon'),None)
 total=physical*100/(100+max(0,armor))+magic*100/(100+max(0,mr-s['mpen']))
 return dict(items=ids,cost=100*len(ids),attackWeapon=current_weapon or 'unarmed',attackRange=ATTACK_RANGES.get(current_weapon,2.5),AD=s['ad'],AP=s['ap'],HP=s['hp'],armor=s['armor'],MR=s['mr'],AS=round(attack_speed,4),crit=s['crit'],haste=s['haste'],vamp=s['vamp'],worldMoveSpeed=round(world_ms,4),basicRaw=round(basic,2),fireRaw=round(fire,2),novaRaw=round(nova,2),procRaw=round(proc,2),totalVs30=round(total,2),physicalEHP=round(s['hp']*(1+s['armor']/100),2),magicEHP=round(s['hp']*(1+s['mr']/100),2),passiveShield=round(passive_shield,2),skillShieldCooldown=round(9/(1+s['haste']/100),3),vampHealingPerSecond=round(total*s['vamp'],2))
AVAILABLE_IDS=tuple(ITEMS) # All 18 items now registered by EQ-02.
assert len(ITEMS)==18
for category in ('weapon','body','head'):
 assert sum(v[0]==category for v in ITEMS.values())==6
all_six=[calculate(ids) for ids in combinations(ITEMS,6)]
assert len(all_six)==18564
assert all(b['cost']==600 and b['AS']<=3 for b in all_six)
current_six=[calculate(ids) for ids in combinations(AVAILABLE_IDS,6)]
result={'currentImplementedCatalog':{'ids':AVAILABLE_IDS,'combinationCount':len(current_six),'maxTotalDPS':max(current_six,key=lambda b:b['totalVs30']),'maxPhysicalEHP':max(current_six,key=lambda b:b['physicalEHP']),'maxMagicEHP':max(current_six,key=lambda b:b['magicEHP'])},'assumptions':{'targetArmor':30,'targetMR':30,'skillLoadout':['fireball','shield','dash','nova'],'procEverySeconds':3,'allHitsLand':True,'uniqueIDs':True},'economy':{'totalGoldBeforeStage':[160,260,380,520,680],'affordableActiveItems':[1,2,3,5,6],'fullBuildPrice':600,'bossStartGoldAfterBuild':80},'builds':{name:calculate(ids) for name,ids in BUILDS.items()},'extremesNoPerks':{'combinations':len(all_six),'maxTotalDPS':max(all_six,key=lambda b:b['totalVs30']),'maxPhysicalEHP':max(all_six,key=lambda b:b['physicalEHP']),'maxMagicEHP':max(all_six,key=lambda b:b['magicEHP'])}}
print(json.dumps(result,ensure_ascii=False,indent=2))
