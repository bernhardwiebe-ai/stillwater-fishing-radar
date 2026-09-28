(function(root){
  const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,value));
  const fitBand=score=>score>=86?'High fit':score>=68?'Moderate fit':'Low fit';
  const grade=score=>score>=82?'Excellent':score>=70?'Good':score>=58?'Fair':'Slow';
  function scoreBassLure(lure,weather){
    let score=45;const traits=lure.traits;
    if(traits.includes('wind'))score+=Math.min(weather.wind,18)*1.7;
    if(traits.includes('calm'))score+=Math.max(0,14-weather.wind)*1.5;
    if(traits.includes('cloud'))score+=weather.cloud*.25;
    if(traits.includes('sun'))score+=(100-weather.cloud)*.2;
    if(traits.includes('rain'))score+=weather.rain>0?25:0;
    if(traits.includes('stained'))score+=(weather.rain>0?18:0)+weather.cloud*.08;
    if(traits.includes('warm'))score+=clamp((weather.temp-60)*.8,0,20);
    if(traits.includes('cold'))score+=clamp((75-weather.temp)*.8,0,20);
    if(traits.includes('dawn'))score+=Math.min(Math.abs(weather.hour-7),Math.abs(weather.hour-19))<=2?22:0;
    if(traits.includes('finesse'))score+=(weather.wind<8?12:0)+(weather.cloud<40?10:0);
    if(traits.includes('moving'))score+=(weather.wind>=7?10:0)+(weather.cloud>=45?8:0);
    return clamp(score);
  }
  root.StillwaterScoring={clamp,fitBand,grade,scoreBassLure};
})(typeof window!=='undefined'?window:globalThis);
