(()=>{
  const installButton=document.getElementById('install-button');
  const networkStatus=document.getElementById('network-status');
  let installPrompt=null;
  const updateNetwork=()=>{const offline=!navigator.onLine;document.documentElement.classList.toggle('is-offline',offline);networkStatus.textContent=offline?'Offline — showing saved and cached information':'';networkStatus.classList.toggle('visible',offline)};
  window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);updateNetwork();
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  if(standalone()){installButton.textContent='Installed';installButton.disabled=true}
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton.textContent='Install app'});
  window.addEventListener('appinstalled',()=>{installPrompt=null;installButton.textContent='Installed';installButton.disabled=true});
  installButton?.addEventListener('click',async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}networkStatus.innerHTML='To install on Android: open Chrome’s ⋮ menu, then tap <b>Install app</b> or <b>Add to Home screen</b>. <button id="install-help-close">OK</button>';networkStatus.classList.add('visible');document.getElementById('install-help-close')?.addEventListener('click',()=>networkStatus.classList.remove('visible'))});
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
