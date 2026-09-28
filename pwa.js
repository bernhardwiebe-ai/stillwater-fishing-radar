(()=>{
  const installButton=document.getElementById('install-button');
  const networkStatus=document.getElementById('network-status');
  let installPrompt=null;
  const updateNetwork=()=>{const offline=!navigator.onLine;document.documentElement.classList.toggle('is-offline',offline);networkStatus.textContent=offline?'Offline — showing saved and cached information':'';networkStatus.classList.toggle('visible',offline)};
  window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);updateNetwork();
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton?.classList.remove('hidden')});
  installButton?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installButton.classList.add('hidden')});
  if('serviceWorker'in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./service-worker.js').then(registration=>{
        registration.addEventListener('updatefound',()=>{
          const worker=registration.installing;
          worker?.addEventListener('statechange',()=>{
            if(worker.state==='installed'&&navigator.serviceWorker.controller){
              networkStatus.innerHTML='Update ready. <button id="refresh-app">Refresh</button>';
              networkStatus.classList.add('visible');
              document.getElementById('refresh-app')?.addEventListener('click',()=>{worker.postMessage({type:'SKIP_WAITING'});location.reload()});
            }
          });
        });
      }).catch(()=>{});
    });
  }
})();
