import type {RoomTransport} from './RoomTransport';
import {MAX_SAVE_BYTES} from './RunSaveStorage';

/** Browser file access only. All imported gameplay data passes through LocalTransport validation. */
export class RunSaveFiles {
  private readonly input:HTMLInputElement;
  private readonly importFile=()=>{if(!this.port.ui.room){this.input.value='';this.input.click();}};
  private readonly exportFile=()=>{
    if(this.port.ui.room)return;
    try{
      const text=this.port.local.exportRun(),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
      link.href=url;link.download='ember-solo-save.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      this.port.local.runNotice('已导出单人存档文件。');
    }catch(error){this.port.local.runNotice(error instanceof Error?error.message:'存档导出失败。');}
  };
  private readonly onPageHide=()=>{if(!this.port.ui.room)this.port.send({type:'SaveRun'});};
  constructor(private readonly port:RoomTransport){
    this.input=document.createElement('input');this.input.type='file';this.input.accept='.json,application/json';this.input.hidden=true;this.input.dataset.emberRunFile='true';document.body.appendChild(this.input);
    this.input.onchange=()=>{void this.readFile();};
    window.addEventListener('ember-run-import',this.importFile);window.addEventListener('ember-run-export',this.exportFile);window.addEventListener('pagehide',this.onPageHide);
  }
  private async readFile():Promise<void> {
    const file=this.input.files?.[0];if(!file)return;
    try{
      if(file.size>MAX_SAVE_BYTES)throw Error('存档文件超过 2 MB。');
      const data=await file.text();if(!this.port.ui.room)this.port.send({type:'LoadRun',data});
    }catch(error){this.port.local.runNotice(error instanceof Error?error.message:'存档文件读取失败。');}
  }
  destroy():void {
    window.removeEventListener('ember-run-import',this.importFile);window.removeEventListener('ember-run-export',this.exportFile);window.removeEventListener('pagehide',this.onPageHide);this.input.remove();
  }
}
