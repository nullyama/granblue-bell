const $=id=>document.getElementById(id),A=BattleBellAudio;
let customSounds=[],selected='bell',previewing=false,previewTimer;
function resetPreview(){previewing=false;clearTimeout(previewTimer);$('test').textContent='▶ 試聴する';}
function feedback(text,error=false){$('feedback').textContent=text;$('feedback').dataset.error=String(error);}
async function refresh(){
 const r=await chrome.runtime.sendMessage({type:'status'});
 if(r?.ok===false)throw new Error(r.error);
 $('enabled').checked=!!r.enabled;
 $('statusTitle').textContent=r.enabled?'通知はオン':'通知はオフ';
 return r;
}
function delayFeedback(text,error=false){$('delayFeedback').textContent=text;$('delayFeedback').dataset.error=String(error);}
$('delayForm').onsubmit=async e=>{
 e.preventDefault();
 const input=$('delayMinutes'),button=$('saveDelay');
 if(!input.reportValidity())return;
 input.disabled=true;button.disabled=true;
 try{
  const r=await chrome.runtime.sendMessage({type:'set-delay',minutes:input.valueAsNumber});
  if(!r?.ok)throw new Error(r?.error || '変更できませんでした');
  input.value=r.minutes;
  delayFeedback(`${r.minutes}分で保存しました。`);
 }catch(e){delayFeedback('保存できませんでした：'+e.message,true);}
 finally{input.disabled=false;button.disabled=false;}
};
function renderSounds(){
 $('deleteConfirm').hidden=true;
 const el=$('sound');el.replaceChildren();
 for(const item of [...A.builtins,...customSounds]){
  const opt=document.createElement('option');opt.value=item.id;
  opt.textContent=item.detail?`${item.name} — ${item.detail}`:item.name;el.append(opt);
 }
 if(![...el.options].some(o=>o.value===selected))selected='bell';
 el.value=selected;$('remove').hidden=!customSounds.some(x=>x.id===selected);
}
$('enabled').onchange=async()=>{
 $('enabled').disabled=true;
 try{const r=await chrome.runtime.sendMessage({type:'set-enabled',enabled:$('enabled').checked});if(!r?.ok)throw new Error(r?.error || '変更できませんでした');await refresh();}
 catch(e){feedback(e.message,true);await refresh().catch(()=>{});}finally{$('enabled').disabled=false;}
};
$('sound').onchange=async()=>{const before=selected;selected=$('sound').value;try{await chrome.storage.local.set({selectedSound:selected});renderSounds();feedback('通知音を保存しました。');}catch(e){selected=before;renderSounds();feedback('保存できませんでした：'+e.message,true);}};
$('volume').oninput=()=>{$('volumeLabel').value=`${$('volume').value}%`;};
$('volume').onchange=async()=>{try{await chrome.storage.local.set({volume:Number($('volume').value)/100});}catch(e){feedback('音量を保存できませんでした。',true);}};
$('test').onclick=async()=>{
 $('test').disabled=true;
 try{
  if(previewing){await chrome.runtime.sendMessage({type:'stop-sound'});resetPreview();feedback('試聴を停止しました。');return;}
  const r=await chrome.runtime.sendMessage({type:'test-sound'});
  feedback(r?.ok?(r.warning || '試聴中です。'):'再生失敗：'+r?.error,!r?.ok || !!r.warning);
  if(r?.ok){previewing=true;$('test').textContent='■ 止める';previewTimer=setTimeout(()=>{resetPreview();feedback('試聴が終わりました。');},(([...(A.builtins),...customSounds].find(x=>x.id===selected)?.duration||1.2)+.15)*1000);}
 }catch(e){resetPreview();feedback(e.message,true);}finally{$('test').disabled=false;}
};
function duration(file){return new Promise((resolve,reject)=>{
 const audio=new Audio(),url=URL.createObjectURL(file);
 const cleanup=()=>{clearTimeout(timeout);audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);};
 const timeout=setTimeout(()=>{cleanup();reject(new Error('音声を読み込めませんでした。別のファイルをお試しください。'));},6000);
 audio.onloadedmetadata=()=>{const n=audio.duration;cleanup();Number.isFinite(n)&&n>0&&n<=A.maxSeconds?resolve(n):reject(new Error('音声は30秒以内にしてください。'));};
 audio.onerror=()=>{cleanup();reject(new Error('再生できない音声です。ファイル形式をご確認ください。'));};audio.src=url;
});}
function dataUrl(file,mime){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('ファイルを読み込めませんでした。'));r.readAsDataURL(new Blob([file],{type:mime}));});}
$('add').onclick=()=>$('file').click();
$('file').onchange=async()=>{
 const file=$('file').files[0];$('file').value='';if(!file)return;
 $('add').disabled=true;feedback('音声を確認しています…');
 try{
  const mime=A.checkFile(file,customSounds.length),seconds=await duration(file),data=await dataUrl(file,mime);
  if(customSounds.some(x=>x.dataUrl===data))throw new Error('同じ音声は追加済みです。通知音の一覧から選んでください。');
  let name=file.name.slice(0,90),suffix=2;while(customSounds.some(x=>x.name===name))name=file.name.slice(0,85)+' ('+(suffix++)+')';
  const item={id:'custom-'+crypto.randomUUID(),name,duration:seconds,dataUrl:data};
  const next=[...customSounds,item];await chrome.storage.local.set({customSounds:next,selectedSound:item.id});
  customSounds=next;selected=item.id;renderSounds();feedback('追加して通知音に設定しました。「試聴する」で確認できます。');
 }catch(e){feedback(e.message,true);}finally{$('add').disabled=false;}
};
$('remove').onclick=()=>{$('deleteConfirm').hidden=false;$('cancelRemove').focus();};
$('cancelRemove').onclick=()=>{$('deleteConfirm').hidden=true;$('remove').focus();};
$('confirmRemove').onclick=async()=>{
 const item=customSounds.find(x=>x.id===selected);if(!item)return;
 try{const next=customSounds.filter(x=>x.id!==selected);await chrome.storage.local.set({customSounds:next,selectedSound:'bell'});customSounds=next;selected='bell';renderSounds();$('sound').focus();feedback('削除しました。標準ベルに戻しました。');}catch(e){feedback('削除できませんでした：'+e.message,true);}
};
(async()=>{try{const s=await chrome.storage.local.get({volume:0.5,selectedSound:'bell',customSounds:[]});customSounds=s.customSounds;selected=s.selectedSound;renderSounds();$('volume').value=s.volume*100;$('volumeLabel').value=`${Math.round(s.volume*100)}%`;const r=await refresh();$('delayMinutes').value=r.minutes;$('delayMinutes').disabled=false;$('saveDelay').disabled=false;}catch(e){feedback('設定を読み込めませんでした：'+e.message,true);}})();
