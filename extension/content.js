(() => {
  if(globalThis.__battleBell)return;
  globalThis.__battleBell=true;
  let poll=null,enabled=false,suspended=false,seen=null,pending=null;
  function send(type,nonce){
    void chrome.runtime.sendMessage({type,nonce}).catch(()=>{});
  }
  function cancel(){
    if(!pending)return;
    const {nonce}=pending;
    pending=null;
    send('cancel-result-alert',nonce);
  }
  function stop(){
    clearInterval(poll);
    poll=null;
    seen=null;
    cancel();
  }
  function tick(){
    if(!enabled||suspended)return;
    const here=location.href;
    if(here===seen)return;
    seen=here;
    cancel();
    if((location.pathname+location.hash).startsWith('/#result_multi/')){
      const nonce=crypto.randomUUID();
      pending={nonce,here}; // 比較用のURLはタブ内だけ。保存・送信しない。
      send('arm-result-alert',nonce);
    }
  }
  function start(){
    stop();
    if(enabled&&!suspended){poll=setInterval(tick,500);tick();}
  }
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(msg?.type!=='confirm-result-alert'||sender.id!==chrome.runtime.id)return;
    const ready=Boolean(enabled&&!suspended&&pending&&
      pending.nonce===msg.nonce&&pending.here===location.href);
    if(ready)pending=null;
    reply({ready});
  });
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes.enabled){
      enabled=!!changes.enabled.newValue;
      start();
    }
  });
  window.addEventListener('pagehide',()=>{suspended=true;stop();});
  window.addEventListener('pageshow',()=>{if(suspended){suspended=false;start();}else tick();});
  window.addEventListener('hashchange',tick);
  window.addEventListener('popstate',tick);
  window.navigation?.addEventListener('currententrychange',tick);
  chrome.storage.local.get({enabled:false}).then(s=>{enabled=!!s.enabled;start();}).catch(()=>{});
})();
