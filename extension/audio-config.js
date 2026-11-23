(() => {
 const builtins=[{id:'bell',name:'ベル',detail:'明るい3音',file:'bell.wav'},{id:'soft',name:'やわらかい音',detail:'短い2音',file:'soft.wav'},{id:'clear',name:'はっきりした音',detail:'高めの3音',file:'clear.wav'}];
 const maxBytes=1024*1024,maxFiles=3,maxSeconds=30;
 const types={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4'};
 function checkFile(file,count){
  const ext=file.name.split('.').pop().toLowerCase();
  if(!types[ext])throw new Error('MP3・WAV・OGG・M4Aのファイルを選んでください。');
  if(!file.size || file.size>maxBytes)throw new Error('音声は1ファイル1MB以内にしてください。');
  if(count>=maxFiles)throw new Error('追加できる音声は3件までです。不要な音声を削除してください。');
  return types[ext];
 }
 function validCustom(item){return !!item && typeof item.dataUrl==='string' && item.dataUrl.length<maxBytes*1.4+100 && /^data:audio\/(mpeg|wav|ogg|mp4);base64,[A-Za-z0-9+/=]+$/.test(item.dataUrl);}
 globalThis.BattleBellAudio={builtins,maxBytes,maxFiles,maxSeconds,checkFile,validCustom};
})();
