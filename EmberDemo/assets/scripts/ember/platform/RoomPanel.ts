import { RoomTransport } from './RoomTransport';

/** Browser room controls only; all gameplay still lives in the Cocos scene. */
export class RoomPanel {
  private readonly root:HTMLDivElement;private readonly panel:HTMLDivElement;private readonly status:HTMLParagraphElement;
  private readonly members:HTMLParagraphElement;private readonly code:HTMLInputElement;private readonly endpoint:HTMLInputElement;private readonly name:HTMLInputElement;
  private readonly create:HTMLButtonElement;private readonly join:HTMLButtonElement;private readonly begin:HTMLButtonElement;private readonly skip:HTMLButtonElement;
  private readonly timer:ReturnType<typeof setInterval>;
  constructor(private readonly port:RoomTransport){
    this.root=document.createElement('div');this.root.dataset.emberRoom='true';document.body.appendChild(this.root);
    const style=document.createElement('style');style.textContent=`
      [data-ember-room] {position:fixed;inset:0;pointer-events:none;z-index:100;font:15px/1.5 system-ui,sans-serif;color:#f3e9ce}
      [data-ember-room] button,[data-ember-room] input {font:inherit;border-radius:8px;border:1px solid #628780;padding:9px 12px}
      [data-ember-room] button {background:#365c58;color:#fff4dc;cursor:pointer;pointer-events:auto}
      [data-ember-room] button:disabled {opacity:.45;cursor:default}
      [data-ember-room] input {box-sizing:border-box;background:#203b40;color:#fff4dc;width:100%;margin:4px 0 12px}
      [data-ember-room] .room-toggle {position:absolute;left:10px;top:8px;padding:5px 12px;font-size:13px}
      [data-ember-room] .room-panel {pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,86vw);max-height:86vh;overflow:auto;background:#193438f5;border:1px solid #829e8b;border-radius:16px;padding:24px;box-shadow:0 12px 50px #10262c88}
      [data-ember-room] label {display:block;margin-top:10px}
      [data-ember-room] h2 {margin:0 0 12px;font-size:25px}[data-ember-room] p {white-space:pre-line}
      [data-ember-room] .room-buttons {display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      [data-ember-room] small {color:#b7cfc3}[data-ember-room] details {margin:12px 0;color:#b7cfc3}
    `;this.root.appendChild(style);
    const toggle=document.createElement('button');toggle.textContent='联机房间';toggle.className='room-toggle';this.root.appendChild(toggle);
    this.panel=document.createElement('div');this.panel.className='room-panel';this.panel.hidden=true;this.root.appendChild(this.panel);
    this.panel.innerHTML='<h2>一起探索遗迹</h2><small>最多 4 人 · 房主运行战斗 · 波次进度自动保存</small>';
    this.name=this.field('你的名字',this.panel,port.ui.name,'room-name');
    this.code=this.field('房间码',this.panel,port.ui.code,'room-code');this.code.maxLength=6;this.code.placeholder='例如 K7M4PX';this.code.autocomplete='off';
    const actions=document.createElement('div');actions.className='room-buttons';this.panel.appendChild(actions);
    this.create=this.button('创建房间',actions,()=>this.connect('create'));
    this.join=this.button('加入房间',actions,()=>this.connect('join'));
    this.button('从该房间进度续玩',actions,()=>this.connect('recover'));
    const settings=document.createElement('details'),summary=document.createElement('summary');summary.textContent='连接设置';settings.appendChild(summary);this.panel.appendChild(settings);
    this.endpoint=this.field('中转地址',settings,port.ui.endpoint,'room-endpoint');
    this.status=document.createElement('p');this.status.setAttribute('role','status');this.panel.appendChild(this.status);
    this.members=document.createElement('p');this.panel.appendChild(this.members);
    const controls=document.createElement('div');controls.className='room-buttons';this.panel.appendChild(controls);
    this.begin=this.button('开始 / 继续试炼',controls,()=>{port.begin();this.show(false);});
    this.skip=this.button('跳过离线队友',controls,()=>port.skipOffline());
    this.button('复制房间码',controls,()=>{if(port.ui.code)void navigator.clipboard.writeText(port.ui.code).catch(()=>{this.code.focus();this.code.select();});});
    this.button('下载进度备份',controls,()=>{
      try{const blob=new Blob([port.exportSave()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`ember-${port.ui.code}-save.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){port.ui.status=error instanceof Error?error.message:'暂无存档';}
    });
    this.button('离开房间',controls,()=>{port.leave();this.update();});
    this.button('返回游戏',controls,()=>this.show(false));
    const note=document.createElement('small');note.textContent='掉线后自动重连。房主无法回来时，原队友可用房间码从最近保存点开新房；当前波从头开始。请保留浏览器数据以识别原角色。';this.panel.appendChild(note);
    toggle.onclick=()=>this.show(this.panel.hidden);
    for(const type of ['pointerdown','pointerup','mousedown','mouseup','keydown','keyup'])this.panel.addEventListener(type,event=>event.stopPropagation());
    this.panel.addEventListener('keydown',event=>{if(event.key==='Escape')this.show(false);});
    this.timer=setInterval(()=>this.update(),200);this.update();
  }
  private field(title:string,parent:HTMLElement,value:string,id:string):HTMLInputElement {
    const label=document.createElement('label');label.textContent=title;const field=document.createElement('input');field.value=value;field.id=id;label.htmlFor=id;parent.appendChild(label);parent.appendChild(field);return field;
  }
  private button(title:string,parent:HTMLElement,action:()=>void):HTMLButtonElement {const button=document.createElement('button');button.textContent=title;button.onclick=action;parent.appendChild(button);return button;}
  private show(open:boolean):void {this.panel.hidden=!open;this.port.uiOpen=open;this.port.send({type:'Stop'});if(!open)document.querySelector('canvas')?.focus();}
  private connect(action:'create'|'join'|'recover'):void {this.port.connect(action,this.endpoint.value,this.name.value,this.code.value);}
  private update():void {
    const {room,playerId,connected}=this.port.ui,host=!!room&&room.hostId===playerId;
    this.status.textContent=this.port.statusText();this.members.textContent=room?`房间码：${room.code}\n${room.members.map(m=>`${m.id===room.hostId?'房主 · ':''}${m.name}${m.id===playerId?'（你）':''} · ${m.connected?'在线':m.active?'等待重连':'已离线'}`).join('\n')}\n${this.port.savedLabel}`:'';
    this.begin.disabled=!host||!connected||room!.started;this.skip.disabled=!host||!room?.members.some(m=>!m.connected&&m.active);
    this.create.disabled=!!room;this.join.disabled=!!room;
    if(room&&document.activeElement!==this.code)this.code.value=room.code;
  }
  destroy():void {clearInterval(this.timer);this.root.remove();}
}
