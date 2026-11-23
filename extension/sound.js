let audio=new Audio();
async function play(source,volume){audio.pause();audio=new Audio(source);audio.volume=volume;await audio.play();}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg.target!=='sound')return;
 if(msg.stop){audio.pause();reply({ok:true});return;}
 (async()=>{
  try{await play(msg.source,msg.volume);reply({ok:true});}
  catch{try{await play(chrome.runtime.getURL('bell.wav'),msg.volume);reply({ok:true,warning:'選んだ音声を再生できないため、標準ベルで通知しました。'});}catch(e){reply({ok:false,error:'音声を再生できませんでした：'+e.message});}}
 })();
 return true;
});
