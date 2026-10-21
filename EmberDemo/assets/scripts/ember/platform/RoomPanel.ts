import { RoomTransport } from './RoomTransport';
import {HERO_PALETTES,HERO_PALETTE_IDS,DEFAULT_HERO_PALETTE,isHeroPaletteId} from '../content/hero-palettes';

/** Browser room controls only; all gameplay still lives in the Cocos scene. */
export class RoomPanel {
  private readonly root:HTMLDivElement;private readonly panel:HTMLDivElement;private readonly status:HTMLParagraphElement;
  private readonly members:HTMLParagraphElement;private readonly code:HTMLInputElement;private readonly endpoint:HTMLInputElement;private readonly name:HTMLInputElement;
  private readonly create:HTMLButtonElement;private readonly join:HTMLButtonElement;private readonly begin:HTMLButtonElement;private readonly skip:HTMLButtonElement;
  private readonly timer:ReturnType<typeof setInterval>;
  private mode:'create'|'join'|'lobby'='create';private readonly memberCards:HTMLDivElement;
  private readonly palettePanel:HTMLDivElement;private readonly paletteSelect:HTMLSelectElement;
  private readonly openRequest=(event:Event)=>{this.mode=(event as CustomEvent).detail==='join'?'join':'create';this.show(true);this.update();};
  constructor(private readonly port:RoomTransport){
    this.root=document.createElement('div');this.root.dataset.emberRoom='true';document.body.appendChild(this.root);
    const style=document.createElement('style');style.textContent=`
      [data-ember-room] {position:fixed;inset:0;pointer-events:none;z-index:100;font:15px/1.5 system-ui,sans-serif;color:#f3e9ce}
      [data-ember-room] button,[data-ember-room] input {font:inherit;border-radius:0;border:1px solid #80725b;padding:11px 16px}
      [data-ember-room] button {background:#35313b;color:#f1e6d2;cursor:pointer;pointer-events:auto;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
      [data-ember-room] button:disabled {opacity:.45;cursor:default}
      [data-ember-room] input {box-sizing:border-box;background:#111117;color:#fff4dc;width:100%;margin:4px 0 12px;min-height:46px;letter-spacing:.08em}
      [data-ember-room] .room-toggle {position:absolute;left:10px;top:8px;padding:5px 12px;font-size:13px}
      [data-ember-room] .room-panel {pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:min(1100px,94vw);min-height:620px;max-height:96vh;overflow:auto;background:#18191ffa;border:1px solid #c2ab7d;padding:32px 44px;box-shadow:0 0 0 100vmax #111117bf;clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)}
      [data-ember-room] .room-panel:not([data-mode=lobby]) {width:min(650px,94vw)}
      [data-ember-room] label {display:block;margin-top:10px}
      [data-ember-room] h2 {margin:0 0 12px;font-size:25px}[data-ember-room] p {white-space:pre-line}
      [data-ember-room] .room-buttons {display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      [data-ember-room] small {color:#b7cfc3}[data-ember-room] details {margin:12px 0;color:#b7cfc3}
      [data-ember-room] .member-cards {display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0}
      [data-ember-room] .member-card {background:#25242c;border-top:3px solid #907b59;min-height:180px;padding:20px 12px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;text-align:center}
      [data-ember-room] .member-mark {font-size:36px;color:#dfc28a}[data-ember-room] .member-card strong{font-size:19px}
      [data-ember-room] .room-panel[data-mode=lobby] input,[data-ember-room] .room-panel[data-mode=lobby] label,[data-ember-room] .room-panel[data-mode=lobby] details{display:none}
      [data-ember-room] .room-tabs {display:flex;gap:10px;margin:20px 0}
      [data-ember-room] .primary-room {background:#a74936}
      [data-ember-room] .palette-toggle {position:absolute;left:110px;top:8px;padding:5px 12px;font-size:13px}
      [data-ember-room] .palette-panel {pointer-events:auto;position:absolute;left:110px;top:48px;width:290px;padding:20px;background:#24232cf5;border:1px solid #b9a47e}
      [data-ember-room] select {width:100%;padding:10px;background:#18191f;color:#f3e9ce;font:inherit;margin:10px 0}
      @media(max-width:700px){[data-ember-room] .member-cards{grid-template-columns:repeat(2,1fr)}[data-ember-room] .member-card{min-height:110px}[data-ember-room] .room-panel{padding:20px;min-height:unset}}
    `;this.root.appendChild(style);
    const toggle=document.createElement('button');toggle.textContent='联机房间';toggle.className='room-toggle';this.root.appendChild(toggle);
    const paletteToggle=this.button('人物配色',this.root,()=>this.showPalette(this.palettePanel.hidden));paletteToggle.className='palette-toggle';
    this.palettePanel=document.createElement('div');this.palettePanel.className='palette-panel';this.palettePanel.hidden=true;this.root.appendChild(this.palettePanel);
    const paletteLabel=document.createElement('label');paletteLabel.textContent='角色衣料颜色';paletteLabel.htmlFor='hero-palette';this.palettePanel.appendChild(paletteLabel);
    this.paletteSelect=document.createElement('select');this.paletteSelect.id='hero-palette';this.palettePanel.appendChild(this.paletteSelect);
    for(const id of HERO_PALETTE_IDS){const option=document.createElement('option');option.value=id;option.textContent=HERO_PALETTES[id].name;this.paletteSelect.appendChild(option);}
    this.paletteSelect.onchange=()=>{const paletteId=this.paletteSelect.value;if(isHeroPaletteId(paletteId))port.send({type:'SetHeroPalette',paletteId});};
    const paletteNote=document.createElement('small');paletteNote.textContent='配色不影响属性。联机时队友也能看到；脚下圆环跟随配色。';this.palettePanel.appendChild(paletteNote);
    this.button('完成配色',this.palettePanel,()=>this.showPalette(false));
    this.panel=document.createElement('div');this.panel.className='room-panel';this.panel.hidden=true;this.root.appendChild(this.panel);
    this.panel.innerHTML='<h2>一起探索遗迹</h2><small>最多 4 人 · 房主运行战斗 · 波次进度自动保存</small>';
    const tabs=document.createElement('div');tabs.className='room-tabs';this.panel.appendChild(tabs);this.button('创建',tabs,()=>{this.mode='create';this.update();});this.button('加入',tabs,()=>{this.mode='join';this.update();});
    this.name=this.field('你的名字',this.panel,port.ui.name,'room-name');
    this.code=this.field('房间码',this.panel,port.ui.code,'room-code');this.code.maxLength=6;this.code.placeholder='例如 K7M4PX';this.code.autocomplete='off';
    const actions=document.createElement('div');actions.className='room-buttons';this.panel.appendChild(actions);
    this.create=this.button('创建房间',actions,()=>this.connect('create'));
    this.join=this.button('加入房间',actions,()=>this.connect('join'));
    this.button('从该房间进度续玩',actions,()=>this.connect('recover')).dataset.roomRecover='true';
    const settings=document.createElement('details'),summary=document.createElement('summary');summary.textContent='连接设置';settings.appendChild(summary);this.panel.appendChild(settings);
    this.endpoint=this.field('中转地址',settings,port.ui.endpoint,'room-endpoint');
    this.status=document.createElement('p');this.status.setAttribute('role','status');this.panel.appendChild(this.status);
    this.members=document.createElement('p');this.panel.appendChild(this.members);
    this.memberCards=document.createElement('div');this.memberCards.className='member-cards';this.panel.appendChild(this.memberCards);
    const controls=document.createElement('div');controls.className='room-buttons';this.panel.appendChild(controls);
    this.begin=this.button('开始 / 继续试炼',controls,()=>{port.begin();this.show(false);});
    this.skip=this.button('跳过离线队友',controls,()=>port.skipOffline());
    this.button('复制房间码',controls,()=>{if(port.ui.code)void navigator.clipboard.writeText(port.ui.code).catch(()=>{this.code.focus();this.code.select();});});
    this.button('下载进度备份',controls,()=>{
      try{const blob=new Blob([port.exportSave()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`ember-${port.ui.code}-save.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){port.ui.status=error instanceof Error?error.message:'暂无存档';}
    });
    this.button('离开房间',controls,()=>{port.leave();this.update();});
    this.button('返回游戏',controls,()=>this.show(false));
    this.button('返回首页 / 游戏',tabs,()=>this.show(false));
    const note=document.createElement('small');note.textContent='掉线后自动重连。房主无法回来时，原队友可用房间码从最近保存点开新房；当前波从头开始。请保留浏览器数据以识别原角色。';this.panel.appendChild(note);
    toggle.onclick=()=>this.show(this.panel.hidden);
    for(const type of ['pointerdown','pointerup','mousedown','mouseup','keydown','keyup'])this.panel.addEventListener(type,event=>event.stopPropagation());
    for(const type of ['pointerdown','pointerup','mousedown','mouseup','keydown','keyup'])this.palettePanel.addEventListener(type,event=>event.stopPropagation());
    this.palettePanel.addEventListener('keydown',event=>{if(event.key==='Escape')this.showPalette(false);});
    this.panel.addEventListener('keydown',event=>{if(event.key==='Escape')this.show(false);});
    this.timer=setInterval(()=>this.update(),200);this.update();
    window.addEventListener('ember-room-open',this.openRequest);
  }
  private field(title:string,parent:HTMLElement,value:string,id:string):HTMLInputElement {
    const label=document.createElement('label');label.textContent=title;const field=document.createElement('input');field.value=value;field.id=id;label.htmlFor=id;parent.appendChild(label);parent.appendChild(field);return field;
  }
  private button(title:string,parent:HTMLElement,action:()=>void):HTMLButtonElement {const button=document.createElement('button');button.textContent=title;button.onclick=action;parent.appendChild(button);return button;}
  private show(open:boolean):void {this.panel.hidden=!open;this.palettePanel.hidden=true;this.port.uiOpen=open;this.port.send({type:'Stop'});if(!open)document.querySelector('canvas')?.focus();}
  private showPalette(open:boolean):void {
    this.palettePanel.hidden=!open;this.panel.hidden=true;this.port.uiOpen=open;this.port.send({type:'Stop'});this.update();
    if(!open)document.querySelector('canvas')?.focus();
  }
  private connect(action:'create'|'join'|'recover'):void {this.port.connect(action,this.endpoint.value,this.name.value,this.code.value);}
  private update():void {
    const {room,playerId,connected}=this.port.ui,host=!!room&&room.hostId===playerId;
    const snapshot=this.port.snapshot(),palette=snapshot.party?.find(p=>p.id===snapshot.hero.id)?.paletteId??DEFAULT_HERO_PALETTE;
    this.paletteSelect.value=palette;this.paletteSelect.disabled=!this.port.canSetPalette;
    this.palettePanel.style.borderColor=HERO_PALETTES[palette].color;
    if(room)this.mode='lobby';this.panel.dataset.mode=this.mode;this.panel.querySelector('h2')!.textContent=this.mode==='lobby'?'组 队 等 待':this.mode==='create'?'创 建 房 间':'加 入 房 间';
    const codeVisible=this.mode==='join';this.code.style.display=codeVisible?'block':'none';(this.code.previousElementSibling as HTMLElement).style.display=codeVisible?'block':'none';this.create.style.display=this.mode==='create'?'':'none';this.join.style.display=this.mode==='join'?'':'none';
    this.create.className=this.join.className=this.begin.className='primary-room';this.memberCards.style.display=room?'grid':'none';
    (this.begin.parentElement as HTMLElement).style.display=room?'flex':'none';(this.panel.querySelector('[data-room-recover]')as HTMLElement).style.display=this.mode==='join'?'':'none';(this.panel.querySelector('.room-tabs')as HTMLElement).style.display=room?'none':'flex';
    if(room){this.memberCards.replaceChildren();for(let i=0;i<4;i++){const m=room.members[i],card=document.createElement('div');card.className='member-card';const mark=document.createElement('div');mark.className='member-mark';mark.textContent=m?(m.id===room.hostId?'♛':'◇'):'+';const name=document.createElement('strong');name.textContent=m?m.name+(m.id===playerId?'（你）':''):'等待旅人';const state=document.createElement('small');state.textContent=m?`${m.id===room.hostId?'房主 · ':''}${m.connected?'在线':m.active?'等待重连':'已离线'}`:'空位';card.append(mark,name,state);this.memberCards.appendChild(card);}}
    this.status.textContent=this.port.statusText();this.members.textContent=room?`房间码：${room.code}  ·  ${this.port.savedLabel}`:'';
    this.begin.disabled=!host||!connected||room!.started;this.skip.disabled=!host||!room?.members.some(m=>!m.connected&&m.active);
    this.create.disabled=!!room;this.join.disabled=!!room;
    if(room&&document.activeElement!==this.code)this.code.value=room.code;
  }
  destroy():void {clearInterval(this.timer);window.removeEventListener('ember-room-open',this.openRequest);this.root.remove();}
}
