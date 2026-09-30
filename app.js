const state={point:null,marker:null,weather:null,species:'bass',day:0,map:null,analysisSeq:0};
const $=id=>document.getElementById(id);
const {clamp,fitBand,grade,scoreBassLure}=window.StillwaterScoring;
const STORAGE_VERSION=2;
const defaultPreferences={units:'imperial',theme:matchMedia('(prefers-color-scheme:light)').matches?'light':'dark',language:'en',mode:'shore',experience:'beginner'};
const getPreferences=()=>{try{return{...defaultPreferences,...JSON.parse(localStorage.getItem('stillwater-preferences')||'{}')}}catch{return{...defaultPreferences}}};
let preferences=getPreferences();
const getSavedPonds=()=>{try{const raw=JSON.parse(localStorage.getItem('stillwater-ponds')||'[]');return(Array.isArray(raw)?raw:raw.items||[]).filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))).map((p,i)=>({id:p.id||`pond-${Date.now()}-${i}`,name:String(p.name||'Saved water').slice(0,48),lat:Number(p.lat),lng:Number(p.lng),favorite:Boolean(p.favorite),notes:String(p.notes||'').slice(0,500)}))}catch{return[]}};
const savePonds=ponds=>localStorage.setItem('stillwater-ponds',JSON.stringify({version:STORAGE_VERSION,items:ponds}));
const formatTemp=value=>preferences.units==='metric'?`${Math.round((value-32)*5/9)}°C`:`${Math.round(value)}°F`;
const formatWind=value=>preferences.units==='metric'?`${Math.round(value*1.609)} km/h`:`${Math.round(value)} mph`;
function cacheKey(lat,lng){return`stillwater-forecast:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`}
function cacheForecast(lat,lng,data){try{localStorage.setItem(cacheKey(lat,lng),JSON.stringify({savedAt:Date.now(),data}))}catch{}}
function getCachedForecast(lat,lng){try{return JSON.parse(localStorage.getItem(cacheKey(lat,lng))||'null')}catch{return null}}
async function fetchJson(url,{timeout=9000,retries=1,signal}={}){let last;for(let attempt=0;attempt<=retries;attempt++){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});try{const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`Request failed (${response.status})`);return await response.json()}catch(error){last=error;if(error.name==='AbortError'||signal?.aborted)throw error}finally{clearTimeout(timer)}}throw last}
function validForecast(data){return Boolean(data?.hourly?.time?.length>=24&&data?.hourly?.temperature_2m?.length>=24&&data?.daily?.time?.length>=1)}
function showNotice(message,type='info'){const el=$('network-status');el.textContent=message;el.dataset.type=type;el.classList.add('visible');if(type!=='error')setTimeout(()=>{if(el.textContent===message)el.classList.remove('visible')},5000)}

const speciesMeta={
  bass:{icon:'◒',label:'Bass',base:68},
  carp:{icon:'◇',label:'Carp',base:61},
  catfish:{icon:'〰',label:'Catfish',base:65},
  bluegill:{icon:'◉',label:'Bluegill',base:67}
};

const speciesGuides={
  bass:{method:'Cover water first, then slow down wherever you get a bite. Keep casts tight to shade, vegetation, wood, rock, points and depth changes.',target:'Windblown bank, weed edge, dock shade, isolated cover or the first drop from shore.',tip:'Use moving baits in wind or cloud; switch to a soft plastic when conditions become bright, calm or pressured.'},
  carp:{method:'Approach quietly, watch for bubbles or mud clouds, and pre-bait a small area when permitted. Let the bait rest naturally on bottom.',target:'Warm shallow flats, inflows, soft-bottom coves, reed edges and cruising routes between deep and shallow water.',tip:'Use light line, minimal weight and a hair rig or small hook. Avoid excessive movement after casting.'},
  catfish:{method:'Anchor bait near a travel lane and let scent work. Fresh bait usually beats heavily artificial scents; reposition if there is no activity.',target:'Runoff mouths, creek channels, outside bends, pond drains, deep holes and flats beside deeper water.',tip:'Use a slip-sinker or simple bottom rig. At night, start shallower; during bright midday conditions, probe deeper cover.'},
  bluegill:{method:'Use tiny baits and light tackle. Suspend bait just above cover, then adjust depth until you contact fish.',target:'Shallow vegetation, dock posts, overhanging shade, spawning beds, brush and the outside edge of weed lines.',tip:'Keep hooks small—size 6 to 10—and use only enough float or split shot to present the bait naturally.'}
};

const baitLibraries={
  carp:[
    {name:'Sweet corn on a hair rig',color:'Natural yellow',depth:'Bottom',retrieve:'Still presentation',why:'A dependable pond bait where legal; scatter a small amount nearby rather than overfeeding.'},
    {name:'Bread or dough ball',color:'Natural',depth:'Surface or bottom',retrieve:'Let it sit naturally',why:'Excellent around ponds where carp regularly encounter human food.'},
    {name:'Method feeder with pack bait',color:'Sweet grain mix',depth:'Bottom',retrieve:'Stationary',why:'Concentrates scent and food tightly around the hook bait.'}
  ],
  catfish:[
    {name:'Fresh cut bait',color:'Local forage',depth:'Bottom',retrieve:'Stationary on a slip rig',why:'Strong natural scent is a top choice for larger pond catfish.'},
    {name:'Nightcrawler',color:'Natural',depth:'Bottom or suspended',retrieve:'Slow drift or still',why:'A versatile pond bait for channel catfish and mixed species.'},
    {name:'Chicken liver or punch bait',color:'Natural',depth:'Bottom',retrieve:'Still presentation',why:'High scent helps fish locate the bait in stained water or after dark.'}
  ],
  bluegill:[
    {name:'Worm piece under a float',color:'Natural',depth:'1–5 ft',retrieve:'Pause, then tiny twitches',why:'The highest-confidence bluegill presentation in most small ponds.'},
    {name:'1/32 oz micro jig',color:'Chartreuse or black',depth:'1–6 ft',retrieve:'Slow swim or vertical pulse',why:'Efficient for finding active fish along weeds and dock posts.'},
    {name:'Cricket or small grub',color:'Natural',depth:'1–4 ft',retrieve:'Suspended beside cover',why:'A natural profile for larger bluegill in warm shallow water.'}
  ]
};

const lureLibrary=[
  {name:'Bladed jig / ChatterBait',color:'White/chartreuse or green pumpkin',depth:'2–6 ft',retrieve:'Steady, ticking grass',traits:['wind','cloud','stained','moving'],why:'Vibration and flash excel around grass in wind, clouds, or stained water.'},
  {name:'Weightless stick worm',color:'Green pumpkin or watermelon',depth:'1–5 ft',retrieve:'Let it fall; long pauses',traits:['calm','sun','finesse','warm'],why:'A subtle fall is ideal for calm, bright, pressured pond bass.'},
  {name:'Texas-rigged worm',color:'Junebug or green pumpkin',depth:'2–10 ft',retrieve:'Drag, hop and pause',traits:['sun','bottom','warm'],why:'Weedless bottom contact reaches shade, wood, grass and bank cover.'},
  {name:'Wacky-rigged stick worm',color:'Green pumpkin',depth:'1–6 ft',retrieve:'Skip, sink and barely shake',traits:['calm','finesse','warm'],why:'Slow shimmy draws bites beside docks, shade and isolated cover.'},
  {name:'Carolina rig',color:'Green pumpkin lizard or worm',depth:'6–18 ft',retrieve:'Long, slow bottom sweep',traits:['sun','bottom','warm'],why:'Covers deeper flats and points when fish pull away from shore.'},
  {name:'Drop shot',color:'Morning dawn or natural shad',depth:'6–20 ft',retrieve:'Hold and lightly shake',traits:['calm','sun','finesse','cold'],why:'Precise finesse presentation for inactive or suspended bass.'},
  {name:'Ned rig',color:'Green pumpkin',depth:'3–12 ft',retrieve:'Drag and dead-stick',traits:['calm','sun','finesse','cold'],why:'Compact profile produces in clear, calm, or pressured conditions.'},
  {name:'Shaky head',color:'Green pumpkin worm',depth:'3–15 ft',retrieve:'Bottom crawl with pauses',traits:['sun','finesse','bottom'],why:'Maintains bottom contact along points, rock and sparse cover.'},
  {name:'Neko rig',color:'Natural worm color',depth:'3–12 ft',retrieve:'Controlled fall and small hops',traits:['calm','finesse','bottom'],why:'A vertical fall works efficiently around precise pieces of cover.'},
  {name:'Tokyo rig',color:'Black/blue creature bait',depth:'3–12 ft',retrieve:'Hop or punch through cover',traits:['warm','bottom','stained'],why:'Keeps the bait just off bottom in vegetation and heavy cover.'},
  {name:'Football jig',color:'Brown craw',depth:'8–20 ft',retrieve:'Drag across hard bottom',traits:['sun','bottom','cold'],why:'Best on deeper rock, points and hard-bottom transitions.'},
  {name:'Flipping jig',color:'Black/blue or green pumpkin',depth:'1–8 ft',retrieve:'Pitch tight; hop once or twice',traits:['sun','stained','bottom'],why:'Targets shaded wood, reeds, docks and dense shallow cover.'},
  {name:'Swim jig',color:'Bluegill or white',depth:'1–6 ft',retrieve:'Swim through grass with twitches',traits:['warm','cloud','moving'],why:'A weedless search bait for shallow grass and active fish.'},
  {name:'Colorado-blade spinnerbait',color:'Chartreuse/white',depth:'1–6 ft',retrieve:'Slow roll near cover',traits:['wind','cloud','rain','stained'],why:'Strong thump helps bass locate it in dirty water and low light.'},
  {name:'Willow-blade spinnerbait',color:'White or translucent shad',depth:'1–8 ft',retrieve:'Fast, steady retrieve',traits:['wind','moving','sun'],why:'Extra flash and less lift suit clearer water and active fish.'},
  {name:'Squarebill crankbait',color:'Bluegill, shad or craw',depth:'2–5 ft',retrieve:'Deflect off wood and rock',traits:['wind','cloud','moving'],why:'Deflection triggers reaction bites around shallow hard cover.'},
  {name:'Medium-diving crankbait',color:'Natural shad or craw',depth:'5–10 ft',retrieve:'Contact bottom or cover',traits:['wind','moving','warm'],why:'Reaches the first break when fish sit beyond the bank.'},
  {name:'Deep-diving crankbait',color:'Shad or chartreuse/blue',depth:'10–18 ft',retrieve:'Long cast; grind bottom',traits:['sun','warm','moving'],why:'Useful on deep points and ledges during bright, warm periods.'},
  {name:'Lipless crankbait',color:'Red craw or chrome/blue',depth:'2–10 ft',retrieve:'Yo-yo or rip through grass',traits:['wind','cloud','cold','moving'],why:'Covers flats quickly and snaps cleanly from submerged grass.'},
  {name:'Suspending jerkbait',color:'Natural shad',depth:'3–8 ft',retrieve:'Twitch-twitch-pause',traits:['cold','sun','wind'],why:'Suspends in the strike zone for cool-water or clear-water bass.'},
  {name:'Walking topwater',color:'Bone or chrome',depth:'Surface',retrieve:'Walk steadily with pauses',traits:['cloud','warm','dawn','moving'],why:'Covers flats and open pockets during warm low-light windows.'},
  {name:'Popper',color:'Bluegill or bone',depth:'Surface',retrieve:'Pop, pause, repeat',traits:['calm','warm','dawn'],why:'Stays beside a target longer in calm water around shallow cover.'},
  {name:'Hollow-body frog',color:'Black or natural',depth:'Surface',retrieve:'Walk across vegetation',traits:['warm','cloud','stained'],why:'Crosses mats, pads and bank grass where other lures snag.'},
  {name:'Buzzbait',color:'Black or white',depth:'Surface',retrieve:'Steady wake over shallow cover',traits:['cloud','wind','warm','dawn'],why:'Calls aggressive fish from shallow cover in warm low light.'},
  {name:'Prop bait / plopper',color:'Bone or shad',depth:'Surface',retrieve:'Steady or stop-and-go',traits:['wind','cloud','warm','dawn'],why:'Surface sound locates roaming fish across flats and pond corners.'},
  {name:'Paddle-tail swimbait',color:'Pearl white or bluegill',depth:'2–12 ft',retrieve:'Slow, steady and level',traits:['moving','cold','wind'],why:'Natural forage imitation works at nearly any depth or season.'},
  {name:'Glide bait',color:'Bluegill or trout pattern',depth:'2–10 ft',retrieve:'Wide turns with long pauses',traits:['sun','calm','cold'],why:'Draws larger bass from clear water and isolated cover.'},
  {name:'Umbrella rig',color:'Small natural shad',depth:'5–18 ft',retrieve:'Slow and steady',traits:['cold','wind','moving'],why:'Imitates a bait school when cool-water bass group offshore.'},
  {name:'Soft jerkbait / fluke',color:'Pearl or smoking shad',depth:'1–6 ft',retrieve:'Twitch and let it glide',traits:['calm','sun','warm','moving'],why:'Erratic baitfish action excels around shallow cover and schooling fish.'},
  {name:'Punch rig',color:'Black/blue creature bait',depth:'1–8 ft',retrieve:'Punch mat; shake then lift',traits:['sun','warm','bottom'],why:'Penetrates overhead vegetation where bass hide during heat and sun.'}
];

const lureSheets=['assets/lures/bass-soft-rigs.png','assets/lures/bass-jigs-cranks.png','assets/lures/bass-topwater-swimbaits.png'];
function lureArt(index){
  const sheet=Math.floor(index/10),cell=index%10,col=cell%5,row=Math.floor(cell/5);
  return{url:lureSheets[sheet],position:`${col*25}% ${row*100}%`};
}
function techniqueFor(lure){
  const text=lure.retrieve.toLowerCase();
  if(/walk|wake|surface|pop/.test(text))return{motion:'topwater',seconds:3,cadence:'3 sec rhythm',move:'Work the surface',steps:['Cast beyond the target and let the rings settle.','Keep the rod tip slightly down and add slack between short pulls.','Pause beside shade, grass openings, wood, or any visible disturbance.']};
  if(/fall|sink|dead-stick|pause/.test(text))return{motion:'fall',seconds:5,cadence:'5 sec pause',move:'Let it fall freely',steps:['Cast tight to the target and follow the bait on semi-slack line.','Count it down for about five seconds without pulling it forward.','Lift gently, watch the line, then repeat the controlled fall.']};
  if(/hop|drag|bottom|punch|shake|sweep/.test(text))return{motion:'hop',seconds:4,cadence:'4 sec pause',move:'Contact bottom',steps:['Let the lure reach bottom and keep the line lightly tensioned.','Move it with one short lift or a slow rod sweep.','Reel only the slack, pause, and feel before making the next move.']};
  if(/twitch|jerk|glide|yo-yo|rip/.test(text))return{motion:'twitch',seconds:3,cadence:'2–3 sec pause',move:'Twitch, then glide',steps:['Point the rod toward the lure and begin with controlled slack.','Snap the tip once or twice, then stop completely.','Let the lure glide or suspend before repeating with varied timing.']};
  return{motion:'steady',seconds:3,cadence:'Steady retrieve',move:'Track one depth',steps:['Cast past the target and let the lure reach the listed depth.','Retrieve just fast enough to keep its action working.','Touch cover when possible; pause briefly after every deflection.']};
}
let techniqueInterval=null,techniqueRemaining=0,techniquePaused=false,currentTechnique=null;
function setTechniqueTimer(technique){
  clearInterval(techniqueInterval);currentTechnique=technique;techniqueRemaining=technique.seconds;techniquePaused=false;
  $('technique-timer').textContent=techniqueRemaining;$('timer-toggle').textContent='Pause timer';$('technique-stage').classList.remove('paused');
  techniqueInterval=setInterval(()=>{if(techniquePaused)return;techniqueRemaining=techniqueRemaining<=1?technique.seconds:techniqueRemaining-1;$('technique-timer').textContent=techniqueRemaining},1000);
}
function openLureGuide(index,rankLabel,reason){
  const lure=lureLibrary[index],art=lureArt(index),technique=techniqueFor(lure);if(!lure)return;
  $('lure-detail-art').style.backgroundImage=`url('${art.url}')`;$('lure-detail-art').style.backgroundPosition=art.position;
  $('demo-lure').style.backgroundImage=`url('${art.url}')`;$('demo-lure').style.backgroundPosition=art.position;
  $('lure-detail-name').textContent=lure.name;$('lure-detail-rank').textContent=rankLabel;$('lure-detail-why').textContent=reason||lure.why;
  $('technique-stage').dataset.motion=technique.motion;$('technique-stage').style.setProperty('--cycle',`${technique.seconds}s`);
  $('technique-cadence').textContent=technique.cadence;$('technique-depth').textContent=lure.depth;$('technique-move').textContent=lure.retrieve;
  $('technique-steps').innerHTML=technique.steps.map(step=>`<li>${step}</li>`).join('');
  $('lure-dialog').showModal();setTechniqueTimer(technique);
}

function bassPredictionReason(lure,w){
  const reasons=[];const t=lure.traits;
  if(t.includes('wind')&&w.wind>=7)reasons.push(`${formatWind(w.wind)} wind adds chop and pushes forage toward the active bank`);
  if(t.includes('calm')&&w.wind<7)reasons.push(`light ${formatWind(w.wind)} wind favors a quiet, natural presentation`);
  if(t.includes('cloud')&&w.cloud>=45)reasons.push(`${Math.round(w.cloud)}% cloud cover should let bass roam farther from shade`);
  if(t.includes('sun')&&w.cloud<45)reasons.push(`bright ${Math.round(w.cloud)}% cloud conditions concentrate fish near shade and cover`);
  if(t.includes('rain')&&w.rain>0)reasons.push('forecast rain should add runoff, color and feeding activity');
  if(t.includes('warm')&&w.temp>=70)reasons.push(`${formatTemp(w.temp)} air favors a more active warm-water presentation`);
  if(t.includes('cold')&&w.temp<70)reasons.push(`${formatTemp(w.temp)} air favors a slower or suspending approach`);
  if(t.includes('dawn')&&Math.min(Math.abs(w.hour-7),Math.abs(w.hour-19))<=2)reasons.push(`${fmtHour(w.hour)} falls in a prime low-light feeding window`);
  if(t.includes('finesse')&&(w.wind<8||w.cloud<40))reasons.push('the forecast supports downsizing and longer pauses');
  if(t.includes('moving')&&(w.wind>=7||w.cloud>=45))reasons.push('conditions support covering water for active fish');
  return reasons.length?`${reasons.slice(0,2).join('; ')}. ${lure.why}`:lure.why;
}

function initMap(){
  state.map=L.map('map',{zoomControl:false}).setView([28.6329,-106.0691],10);
  L.control.zoom({position:'bottomright'}).addTo(state.map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'}).addTo(state.map);
  state.map.on('click',e=>selectPoint(e.latlng.lat,e.latlng.lng,true));
}

function selectPoint(lat,lng,move=false){
  state.point={lat:+lat,lng:+lng};
  if(!state.marker){
    state.marker=L.marker([lat,lng],{draggable:true,icon:L.divIcon({className:'pin-icon',iconSize:[30,30]})}).addTo(state.map);
    state.marker.on('dragend',e=>{const p=e.target.getLatLng();selectPoint(p.lat,p.lng)});
  }else state.marker.setLatLng([lat,lng]);
  if(move) state.map.flyTo([lat,lng],Math.max(state.map.getZoom(),15),{duration:.8});
  $('coordinates').textContent=`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  $('grid-label').textContent=`Exact pin · ${state.map.getZoom()>=15?'pond level':'local grid'}`;
  $('data-quality').textContent='Forecast available';
  $('map-hint').textContent='Drag pin to fine-tune the spot';
  $('save-btn').disabled=false;$('analyze-btn').disabled=false;
  $('active-location').textContent='Unsaved pond';
}

function renderSavedPonds(selectedIndex=''){
  const ponds=getSavedPonds();
  $('saved-ponds').innerHTML='<option value="">Select a saved pond</option>'+ponds.map((pond,i)=>`<option value="${i}" ${String(i)===String(selectedIndex)?'selected':''}>${escapeText(pond.name)}</option>`).join('');
}
function escapeText(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function openSavedPond(index){
  const pond=getSavedPonds()[Number(index)];if(!pond)return;
  selectPoint(pond.lat,pond.lng,true);
  $('active-location').textContent=pond.name;
  $('saved-ponds').value=String(index);
  $('map-hint').textContent=`${pond.name} selected`;
}

async function searchPlaces(){
  const query=$('place-input').value.trim();if(!query)return;
  const button=$('place-btn'),results=$('place-results');
  button.disabled=true;button.textContent='Searching…';
  results.classList.remove('hidden');results.innerHTML='<p class="result-status">Searching the map…</p>';
  try{
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
    const places=await fetchJson(url,{timeout:7000,retries:1});
    if(!places.length){results.innerHTML='<p class="result-status">No matching places found. Try a nearby city or a broader name.</p>';return}
    results.innerHTML=places.map((place,index)=>`<button type="button" class="place-result" data-index="${index}" role="option"><strong>${escapeText(place.name||place.display_name.split(',')[0])}</strong><span>${escapeText(place.display_name)}</span></button>`).join('');
    results.querySelectorAll('.place-result').forEach(item=>item.onclick=()=>{
      const place=places[Number(item.dataset.index)],lat=Number(place.lat),lng=Number(place.lon);
      selectPoint(lat,lng,true);$('active-location').textContent=place.name||place.display_name.split(',')[0];
      $('map-hint').textContent=`${place.display_name.split(',').slice(0,2).join(',')} selected`;
      results.classList.add('hidden');
    });
  }catch(error){results.innerHTML='<p class="result-status">Map search could not connect. Check your internet connection and try again.</p>'}
  finally{button.disabled=false;button.textContent='Search'}
}

async function analyze(){
  if(!state.point)return;
  const requestId=++state.analysisSeq;
  const b=$('analyze-btn');b.disabled=true;b.innerHTML='Reading conditions…';
  b.setAttribute('aria-busy','true');$('data-quality').textContent='Loading forecast…';
  const {lat,lng}=state.point;
  const hourly=['temperature_2m','relative_humidity_2m','precipitation','cloud_cover','pressure_msl','wind_speed_10m','wind_direction_10m'];
  const daily=['weather_code','temperature_2m_max','temperature_2m_min','sunrise','sunset','precipitation_sum','wind_speed_10m_max'];
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=${hourly.join(',')}&daily=${daily.join(',')}&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7`;
  try{
    const data=await fetchJson(url,{timeout:10000,retries:1});if(!validForecast(data))throw new Error('Forecast response was incomplete');
    if(requestId!==state.analysisSeq)return;
    state.weather=data;cacheForecast(lat,lng,data);state.day=0;
    // Canvas measurements are zero while the dashboard is display:none.
    $('dashboard').classList.remove('hidden');renderDashboard();
    $('dashboard').scrollIntoView({behavior:'smooth',block:'start'});
    $('data-quality').textContent='Live · hourly';
  }catch(e){
    if(requestId!==state.analysisSeq)return;
    const cached=getCachedForecast(lat,lng);
    if(cached?.data&&validForecast(cached.data)){state.weather=cached.data;state.day=0;$('dashboard').classList.remove('hidden');renderDashboard();$('data-quality').textContent=`Cached · ${new Date(cached.savedAt).toLocaleString()}`;showNotice('Live weather is unavailable. Showing the most recent cached forecast.','error')}
    else{$('data-quality').textContent='Forecast unavailable';showNotice('We could not load weather for this point. Check your connection and try again.','error')}
  }
  finally{if(requestId===state.analysisSeq){b.disabled=false;b.removeAttribute('aria-busy');b.innerHTML='Analyze this spot <span>→</span>';}}
}

function dayHours(day){const start=day*24;return Array.from({length:24},(_,i)=>{const x=start+i,h=state.weather.hourly;return{hour:i,temp:h.temperature_2m[x],humidity:h.relative_humidity_2m[x],rain:h.precipitation[x],cloud:h.cloud_cover[x],pressure:h.pressure_msl[x],wind:h.wind_speed_10m[x],windDir:h.wind_direction_10m[x]}})}
function hourScore(x,species){
  const dawn=Math.max(0,1-Math.min(Math.abs(x.hour-7),Math.abs(x.hour-19))/7)*22;
  const cloud=x.cloud*.12,wind=clamp(14-Math.abs(x.wind-9),0,14),rain=x.rain>0?7:0;
  const tempBass=clamp(22-Math.abs(x.temp-72)*.65,0,22),tempCarp=clamp(22-Math.abs(x.temp-75)*.6,0,22);
  if(species==='catfish')return clamp(35+(x.hour<6||x.hour>19?22:5)+cloud*.5+rain*1.7+clamp(16-Math.abs(x.temp-76)*.4,0,16));
  if(species==='bluegill')return clamp(34+dawn*.7+clamp(22-Math.abs(x.temp-74)*.65,0,22)+wind*.35+cloud*.2);
  if(species==='carp')return clamp(31+dawn*.55+tempCarp+wind*.55+rain+cloud*.25);
  return clamp(29+dawn+tempBass+cloud+wind+rain);
}
function scoresForDay(day,species){return dayHours(day).map(x=>Math.round(hourScore(x,species)))}
function averageTop(scores,n=5){return Math.round([...scores].sort((a,b)=>b-a).slice(0,n).reduce((a,b)=>a+b,0)/n)}
function fmtHour(h){if(h===0)return'12 AM';if(h===12)return'12 PM';return`${h%12} ${h<12?'AM':'PM'}`}

function renderDashboard(){
  const date=new Date(state.weather.daily.time[state.day]+'T12:00:00');
  $('forecast-title').textContent=state.day===0?'Today’s fishing forecast':date.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'});
  $('updated-at').textContent=`Updated ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} · ${state.weather.timezone_abbreviation}`;
  renderSpecies();renderSpeciesGuide();renderTimeline();renderConditions();renderDays();renderLures();renderTodayPlan();
  const s=averageTop(scoresForDay(state.day,'bass'));
  $('hero-score').innerHTML=`<span class="score-label">${state.day?'SELECTED DAY':'TODAY\'S OUTLOOK'}</span><strong>${s}</strong><span>${grade(s)} bass potential</span>`;
}
function renderSpecies(){
  $('species-grid').innerHTML=Object.entries(speciesMeta).map(([key,m])=>{const s=averageTop(scoresForDay(state.day,key));return`<button type="button" class="species-card ${state.species===key?'active':''}" data-species="${key}" aria-pressed="${state.species===key}"><div class="species-top"><span class="species-icon" aria-hidden="true">${m.icon}</span><span class="score-ring">${s}</span></div><h3>${m.label}</h3><p>${grade(s)} computed activity · best 5-hour average</p><div class="meter" aria-hidden="true"><i style="width:${s}%"></i></div></button>`}).join('');
  document.querySelectorAll('.species-card').forEach(el=>el.onclick=()=>{state.species=el.dataset.species;renderSpecies();renderSpeciesGuide();renderTimeline();renderConditions();renderLures()});
}
function renderSpeciesGuide(){
  const meta=speciesMeta[state.species],guide=speciesGuides[state.species];
  $('fish-guide').innerHTML=`<div class="guide-name"><span>${meta.icon}</span><div><p class="eyebrow">HOW TO FISH FOR THEM</p><h3>${meta.label}</h3></div></div><div class="guide-copy"><div><span>APPROACH</span><p>${guide.method}</p></div><div><span>BEST POND SPOTS</span><p>${guide.target}</p></div><div><span>KEY TIP</span><p>${guide.tip}</p></div></div>`;
}
function renderTimeline(){
  const scores=scoresForDay(state.day,state.species),hours=dayHours(state.day);let best=0;
  for(let i=1;i<scores.length;i++)if(scores[i]>scores[best])best=i;
  $('best-window').textContent=`Best window · ${fmtHour(Math.max(0,best-1))}–${fmtHour(Math.min(23,best+2))} · Peak ${scores[best]}`;
  $('chart-labels').innerHTML=[0,4,8,12,16,20,23].map(h=>`<span>${fmtHour(h)}</span>`).join('');
  drawChart(scores,hours);
}
function drawChart(scores,hours){
  const c=$('bite-chart'),dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
  if(!w||!h)return;
  c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const x=c.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,w,h);
  const pad=12,step=(w-pad*2)/(scores.length-1),y=v=>h-pad-(v/100)*(h-pad*2);
  x.strokeStyle='rgba(180,210,197,.10)';x.lineWidth=1;[25,50,75].forEach(v=>{x.beginPath();x.moveTo(0,y(v));x.lineTo(w,y(v));x.stroke()});
  const grad=x.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(199,244,100,.30)');grad.addColorStop(1,'rgba(199,244,100,0)');x.beginPath();scores.forEach((v,i)=>i?x.lineTo(pad+i*step,y(v)):x.moveTo(pad,y(v)));x.lineTo(w-pad,h);x.lineTo(pad,h);x.fillStyle=grad;x.fill();
  x.beginPath();scores.forEach((v,i)=>i?x.lineTo(pad+i*step,y(v)):x.moveTo(pad,y(v)));x.strokeStyle='#c7f464';x.lineWidth=3;x.lineJoin='round';x.stroke();
}
function renderConditions(){
  const hs=dayHours(state.day),mid=hs[12];const pTrend=hs[18].pressure-hs[6].pressure;const rain=state.weather.daily.precipitation_sum[state.day];const items=[['Air temp',formatTemp(mid.temp)],['Pressure',`${Math.round(mid.pressure)} hPa`],['Pressure trend',pTrend>1.5?'Rising':pTrend< -1.5?'Falling':'Steady'],['Cloud cover',`${Math.round(mid.cloud)}%`],['Wind',formatWind(mid.wind)],['Rain',preferences.units==='metric'?`${(rain*25.4).toFixed(1)} mm`:`${rain.toFixed(2)} in`]];
  $('conditions').innerHTML=items.map(i=>`<div class="condition"><span>${i[0]}</span><strong>${i[1]}</strong></div>`).join('');
  const notes=[];if(mid.cloud>55)notes.push('Cloud cover extends the low-light feeding window');else notes.push('Brighter skies favor shade, cover and finesse');if(mid.wind>7)notes.push('wind should activate the bank receiving the chop');else notes.push('calm water calls for quieter presentations');notes.push(`${pTrend< -1.5?'falling':pTrend>1.5?'rising':'steady'} pressure is treated as a supporting signal`);$('why-text').textContent=notes.join('; ')+'. Water temperature is estimated until a pond sensor or manual reading is added.';
}
function renderDays(){
  $('day-strip').innerHTML=state.weather.daily.time.map((d,i)=>{const date=new Date(d+'T12:00:00'),s=averageTop(scoresForDay(i,'bass'));return`<button class="day-card ${i===state.day?'selected':''}" data-day="${i}"><span class="day-name">${i===0?'Today':date.toLocaleDateString([],{weekday:'short'})}</span><span class="day-date">${date.toLocaleDateString([],{month:'short',day:'numeric'})}</span><span class="day-score">${s}</span><small>${grade(s)} · ${Math.round(state.weather.daily.temperature_2m_max[i])}°</small></button>`}).join('');
  document.querySelectorAll('.day-card').forEach(el=>el.onclick=()=>{state.day=+el.dataset.day;renderDashboard();document.querySelector('.section-heading').scrollIntoView({behavior:'smooth'})});
}
function renderLures(){
  const hours=dayHours(state.day),speciesScores=scoresForDay(state.day,state.species);
  const speciesName=speciesMeta[state.species].label;
  $('lure-title').textContent=`${speciesName} baits ${state.day===0?'for today':'for '+new Date(state.weather.daily.time[state.day]+'T12:00').toLocaleDateString([],{weekday:'long'})}`;
  $('tactics-species').textContent=speciesName.toUpperCase();
  const am=bestPeriodContext(hours,speciesScores,0,11),pm=bestPeriodContext(hours,speciesScores,12,23);
  renderLurePeriod('am',am);renderLurePeriod('pm',pm);
  const overall=am.score>=pm.score?am:pm;renderCastPlan(overall.conditions);
}
function bestPeriodContext(hours,scores,start,end){
  let best=start;for(let i=start+1;i<=end;i++)if(scores[i]>scores[best])best=i;
  return{conditions:hours[best],score:scores[best]};
}
function periodWeatherSummary(context){
  const w=context.conditions,weather=w.rain>0?'rain':w.cloud>=65?'cloudy':w.cloud<=25?'mostly clear':'partly cloudy';
  return `Peak ${fmtHour(w.hour)} · ${formatTemp(w.temp)} · ${formatWind(w.wind)} wind · ${Math.round(w.cloud)}% clouds · ${weather}`;
}
function baitPeriodReason(lure,w,period){
  const light=period==='am'?'morning light':'afternoon/evening conditions';
  if(state.species==='catfish')return `${light}, ${formatTemp(w.temp)} temperatures and ${w.rain>0?'runoff scent':'the predicted feeding window'} favor scent-based bottom presentations. ${lure.why}`;
  if(state.species==='carp')return `${light}, ${formatTemp(w.temp)} temperatures and ${formatWind(w.wind)} wind favor a quiet bait placed on a feeding route. ${lure.why}`;
  return `${light}, ${Math.round(w.cloud)}% cloud cover and ${formatWind(w.wind)} wind support a small natural presentation close to cover. ${lure.why}`;
}
function renderLurePeriod(period,context){
  const w=context.conditions;
  const ranked=state.species==='bass'?[...lureLibrary].map(lure=>({...lure,match:Math.round(clamp(scoreBassLure(lure,w),0,100)),predictionWhy:bassPredictionReason(lure,w)})).sort((a,b)=>b.match-a.match).slice(0,6):baitLibraries[state.species].map((bait,i)=>({...bait,match:Math.round(clamp(context.score-i*4,0,100)),predictionWhy:baitPeriodReason(bait,w,period)}));
  $(`${period}-conditions`).textContent=periodWeatherSummary(context);
  $(`${period}-lure-grid`).innerHTML=ranked.map((l,i)=>{const libraryIndex=state.species==='bass'?lureLibrary.findIndex(item=>item.name===l.name):-1,art=libraryIndex>=0?lureArt(libraryIndex):null,rankLabel=`#${i+1} ${i===0?'BEST '+period.toUpperCase()+' FIT':'RANKED PICK'} · ${fitBand(l.match).toUpperCase()}`;return`<article class="lure-card"><div class="lure-card-main">${art?`<div class="lure-visual" role="img" aria-label="Accurate illustration of ${escapeText(l.name)}" style="background-image:url('${art.url}');background-position:${art.position}"></div>`:''}<span class="lure-rank">${rankLabel}</span><h3>${l.name}</h3><p>${l.predictionWhy||l.why}</p><p><strong>Presentation:</strong> ${l.retrieve}</p><div class="lure-meta"><span>${l.color}</span><span>${l.depth}</span><span>Best near ${fmtHour(w.hour)}</span></div>${libraryIndex>=0?`<button class="lure-guide-button" type="button" data-lure-index="${libraryIndex}" data-rank="${escapeText(rankLabel)}">See animated technique →</button>`:''}</div></article>`}).join('');
  $(`${period}-lure-grid`).querySelectorAll('.lure-guide-button').forEach(button=>button.onclick=()=>{const lure=lureLibrary[Number(button.dataset.lureIndex)],rankedLure=ranked.find(item=>item.name===lure.name);openLureGuide(Number(button.dataset.lureIndex),button.dataset.rank,rankedLure?.predictionWhy)});
}
function renderTodayPlan(){
  const scores=scoresForDay(state.day,state.species),hours=dayHours(state.day);let best=0;for(let i=1;i<scores.length;i++)if(scores[i]>scores[best])best=i;
  const w=hours[best],am=bestPeriodContext(hours,scores,0,11),pm=bestPeriodContext(hours,scores,12,23);
  const topLure=state.species==='bass'?[...lureLibrary].sort((a,b)=>scoreBassLure(b,w)-scoreBassLure(a,w))[0]:baitLibraries[state.species][0];
  $('today-plan-grid').innerHTML=`<div class="plan-item"><span>Best window</span><strong>${fmtHour(Math.max(0,best-1))}–${fmtHour(Math.min(23,best+2))}</strong><p>${grade(scores[best])} computed activity for ${speciesMeta[state.species].label.toLowerCase()}.</p><span class="confidence">${fitBand(scores[best])}</span></div><div class="plan-item"><span>Start here</span><strong>${w.wind>=7?'Windblown bank':'Shade or first drop'}</strong><p>${formatWind(w.wind)} wind · ${Math.round(w.cloud)}% clouds.</p></div><div class="plan-item"><span>First presentation</span><strong>${topLure.name}</strong><p>${topLure.retrieve}. If it fails, change depth first, then speed.</p></div>`;
}
function compass(deg){return['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(deg/45)%8]}
function opposite(deg){return compass((deg+180)%360)}
function renderCastPlan(w){
  let title,detail;
  if(state.species==='carp'){title='Watch the shallow flat and reed edge for bubbles';detail='Place bait slightly ahead of cruising fish or beside a muddy feeding patch, then keep the line still.'}
  else if(state.species==='catfish'&&(w.hour>=19||w.hour<6)){title='Set up beside deep water and cast onto the adjacent flat';detail='Catfish often leave deeper cover after dark. Spread baits across two depths to find their travel lane.'}
  else if(state.species==='catfish'){title='Probe the deepest hole, drain or shaded cover';detail='Place fresh bait on the edge of the depth change, not in the softest debris at its center.'}
  else if(state.species==='bluegill'){title='Start beside shade, vegetation or dock posts';detail='Suspend a tiny bait just above the cover. If bites stop, change depth before changing locations.'}
  else if(w.rain>.04){title='Fish the runoff entrance and its first drop';detail='Cast across the color line, then work the nearest cover where fresh water enters the pond.'}
  else if(w.wind>=7){title=`Start on the ${opposite(w.windDir)} bank—the windblown side`;detail=`Wind from the ${compass(w.windDir)} pushes food toward that bank. Cast parallel to shore, especially at a point, corner, or visible cover.`}
  else if(w.cloud<35&&w.temp>72){title='Target the deepest shade and outside weed edge';detail='Cast beside docks, overhanging trees, cattails, or the first depth change; keep the lure tight to the shaded edge.'}
  else if(w.cloud>=60){title='Cover the shallow flat, point, and pond corners';detail='Low light lets bass roam. Fan-cast open feeding water, then hit isolated grass, wood, or rock.'}
  else{title='Start at the first drop beside shallow cover';detail='Cast parallel to the bank and work any point, drain, weed edge, stump, or abrupt depth change.'}
  $('cast-plan').innerHTML=`<div class="cast-plan-icon">⌖</div><div><span>WHERE TO CAST</span><strong>${title}</strong><p>${detail}</p></div>`;
}

$('analyze-btn').onclick=analyze;
$('locate-btn').onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>selectPoint(p.coords.latitude,p.coords.longitude,true),()=>alert('Location access was not available. Click the map instead.'),{enableHighAccuracy:true}):alert('Geolocation is not supported here.');
$('coordinate-btn').onclick=()=>{const parts=$('coordinate-input').value.split(',').map(Number);if(parts.length===2&&parts.every(Number.isFinite)&&Math.abs(parts[0])<=90&&Math.abs(parts[1])<=180)selectPoint(parts[0],parts[1],true);else alert('Enter coordinates as latitude, longitude.');};
$('coordinate-input').addEventListener('keydown',e=>{if(e.key==='Enter')$('coordinate-btn').click()});
$('place-btn').onclick=searchPlaces;
$('place-input').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlaces()});
document.addEventListener('click',e=>{if(!e.target.closest('.map-search'))$('place-results').classList.add('hidden')});
$('save-btn').onclick=()=>{if(!state.point)return;$('save-dialog').showModal();requestAnimationFrame(()=>$('pond-name').focus())};
$('cancel-save').onclick=()=>{$('pond-name').value='';$('save-dialog').close()};
document.querySelector('.save-dialog-close').onclick=()=>{$('pond-name').value='';$('save-dialog').close()};
$('save-dialog').querySelector('form').onsubmit=e=>{
  e.preventDefault();const name=$('pond-name').value.trim();if(!name){$('pond-name').focus();return}
  const ponds=getSavedPonds();
  const existing=ponds.findIndex(p=>p.name.toLowerCase()===name.toLowerCase());
  const saved={name,...state.point};
  if(existing>=0)ponds[existing]=saved;else ponds.push(saved);
  savePonds(ponds);
  const selected=existing>=0?existing:ponds.length-1;
  $('active-location').textContent=name;$('pond-name').value='';renderSavedPonds(selected);$('save-dialog').close();showNotice(`${name} saved on this device.`);
};
$('saved-ponds').onchange=e=>{if(e.target.value!=='')openSavedPond(e.target.value)};
window.addEventListener('resize',()=>state.weather&&renderTimeline());
function applyPreferences(){document.documentElement.dataset.theme=preferences.theme;$('theme-toggle').textContent=preferences.theme==='dark'?'☼':'☾';$('unit-toggle').textContent=preferences.units==='imperial'?'°F / mph':'°C / km/h';localStorage.setItem('stillwater-preferences',JSON.stringify({...preferences,version:STORAGE_VERSION}))}
$('theme-toggle').onclick=()=>{preferences.theme=preferences.theme==='dark'?'light':'dark';applyPreferences()};
$('unit-toggle').onclick=()=>{preferences.units=preferences.units==='imperial'?'metric':'imperial';applyPreferences();if(state.weather)renderDashboard()};
$('lure-dialog').addEventListener('close',()=>clearInterval(techniqueInterval));
document.querySelector('.lure-close').onclick=()=>$('lure-dialog').close();
$('replay-technique').onclick=()=>{const lure=$('demo-lure');lure.style.animation='none';void lure.offsetWidth;lure.style.animation='';setTechniqueTimer(currentTechnique)};
$('timer-toggle').onclick=()=>{techniquePaused=!techniquePaused;$('technique-stage').classList.toggle('paused',techniquePaused);$('timer-toggle').textContent=techniquePaused?'Resume timer':'Pause timer'};
applyPreferences();initMap();renderSavedPonds();
