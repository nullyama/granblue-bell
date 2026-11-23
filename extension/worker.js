importScripts('audio-config.js');
let creating,queue=Promise.resolve();
const defaultDelayMinutes=3;
const validDelayMinutes=n=>Number.isInteger(n)&&n>=1&&n<=1440;
const savedDelayMinutes=n=>validDelayMinutes(n)?n:defaultDelayMinutes;
const resultAlarm=/^result-wait:(\d+):([0-9a-z_-]{1,80}):([0-9a-f-]{36})$/i;
function alarmName(sender,nonce){
  return `result-wait:${sender.tab?.id}:${sender.documentId}:${nonce}`;
}
async function play(){
  const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('sound.html')]});
  if(!contexts.length){
    if(!creating)creating=chrome.offscreen.createDocument({url:'sound.html',reasons:['AUDIO_PLAYBACK'],justification:'有効にした戦闘終了通知の音を再生するため'}).finally(()=>{creating=null;});
    await creating;
  }
  const {volume=0.5,selectedSound='bell',customSounds=[]}=await chrome.storage.local.get({volume:0.5,selectedSound:'bell',customSounds:[]});
  const preset=BattleBellAudio.builtins.find(x=>x.id===selectedSound);
  const custom=customSounds.find(x=>x.id===selectedSound);
  const missing=!preset&&!BattleBellAudio.validCustom(custom);
  const source=preset?chrome.runtime.getURL(preset.file):missing?chrome.runtime.getURL('bell.wav'):custom.dataUrl;
  const r=await chrome.runtime.sendMessage({target:'sound',source,volume:Math.max(0,Math.min(1,Number(volume)||0))});
  if(!r?.ok)throw new Error(r?.error||'音声ページが応答しませんでした');
  return r.warning||(missing?'保存した音声が見つからないため、標準ベルで通知しました。':'');
}
function serial(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task;}
async function stopAudio(){
  const c=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('sound.html')]});
  if(c.length)await chrome.runtime.sendMessage({target:'sound',stop:true});
}
async function handle(msg){
  if(msg.type==='stop-sound'){await stopAudio();return {ok:true};}
  if(msg.type==='test-sound')return {ok:true,warning:await play()};
  if(msg.type==='set-enabled'){
    await chrome.storage.local.set({enabled:!!msg.enabled});return {ok:true};
  }
  if(msg.type==='set-delay'){
    if(!validDelayMinutes(msg.minutes))return {ok:false,error:'1〜1440の整数を指定してください。'};
    await chrome.storage.local.set({resultDelayMinutes:msg.minutes});
    return {ok:true,minutes:msg.minutes};
  }
  const {enabled,resultDelayMinutes}=await chrome.storage.local.get({enabled:false,resultDelayMinutes:defaultDelayMinutes});
  return {ok:true,enabled,minutes:savedDelayMinutes(resultDelayMinutes)};
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(!msg||msg.target==='sound')return;
  const popup=sender.url===chrome.runtime.getURL('popup.html');
  let game=false;
  try{
    const u=new URL(sender.url);
    game=sender.tab?.id!==undefined&&sender.frameId===0&&u.protocol==='https:'&&['game.granbluefantasy.jp','gbf.game.mbga.jp'].includes(u.hostname);
  }catch{}
  let task;
  if(popup&&['test-sound','stop-sound','status','set-enabled','set-delay'].includes(msg.type)){
    task=serial(()=>handle(msg));
  }else if(game){
    const name=alarmName(sender,msg.nonce);
    if(!resultAlarm.test(name))return;
    if(msg.type==='arm-result-alert'){
      task=serial(async()=>{
        const {enabled,resultDelayMinutes}=await chrome.storage.local.get({enabled:false,resultDelayMinutes:defaultDelayMinutes});
        if(enabled)await chrome.alarms.create(name,{when:Date.now()+savedDelayMinutes(resultDelayMinutes)*60_000});
        return {ok:true};
      });
    }else if(msg.type==='cancel-result-alert'){
      task=serial(async()=>{await chrome.alarms.clear(name);return {ok:true};});
    }
  }
  if(task){task.then(reply,e=>reply({ok:false,error:e.message}));return true;}
});
chrome.alarms.onAlarm.addListener(({name})=>{
  const match=resultAlarm.exec(name);
  if(!match)return;
  const [,tabId,documentId,nonce]=match;
  // タブが閉じた、移動した、待機を取り消した場合は鳴らさない。
  void chrome.tabs.sendMessage(Number(tabId),{type:'confirm-result-alert',nonce},{documentId})
    .then(answer=>{
      if(!answer?.ready)return;
      return serial(async()=>{
        const {enabled=false}=await chrome.storage.local.get('enabled');
        if(enabled)await play();
      });
    }).catch(()=>{});
});
chrome.runtime.onInstalled.addListener(()=>{
  // 旧版に限り残り得る検知履歴を外し、音量や選択などは保持する。
  void chrome.storage.session.remove(['state','soundWarning']).catch(()=>{});
  void chrome.storage.local.remove('selector').catch(()=>{});
});
