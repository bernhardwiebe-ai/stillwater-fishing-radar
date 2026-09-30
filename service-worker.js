const VERSION='stillwater-v6';
const CORE=['./','./FishingRadar.html','./styles.css','./cast-plan.css','./pond-picker.css','./fish-guide.css','./lure-grid.css','./map-search.css','./lure-periods.css','./product.css','./mobile-ui.css','./scoring-core.js','./app.js','./pwa.js','./manifest.webmanifest','./icons/stillwater-icon.svg','./assets/lures/bass-soft-rigs.png','./assets/lures/bass-jigs-cranks.png','./assets/lures/bass-topwater-swimbaits.png','./offline.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.hostname.includes('open-meteo.com')||url.hostname.includes('nominatim.openstreetmap.org')){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
    return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put('./FishingRadar.html',copy));return response}).catch(()=>caches.match('./FishingRadar.html').then(r=>r||caches.match('./offline.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy))}return response})));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
