/* ============================================================
   WEATHERFX — canvas-driven dynamic sky animations
   Modes: clear, clouds, rain, fog, hail, storm, snow, night
   Also renders "Aurora Streaks" (Aura Weather's signature falling-light
   effect) on clear nights — a feature not found in mainstream weather apps.
   ============================================================ */
const WeatherFX = (() => {
  const canvas = document.getElementById('fx-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], mode = 'clear', isNight = false, raf = null;

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const BG_IMAGES = {
    clear_day: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop", // mountains, sun
      "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1600&auto=format&fit=crop", // desert dunes
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1600&auto=format&fit=crop"  // sunny hills
    ],
    clear_night: [
      "https://images.unsplash.com/photo-1509233725247-49e657c54213?q=80&w=1600&auto=format&fit=crop"
    ],
    clouds: [
      "https://images.unsplash.com/photo-1499956827185-0d63ee78a910?q=80&w=1600&auto=format&fit=crop", // cloudy mountains
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop"  // overcast hills
    ],
    rain: [
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1428592953211-077101b2021b?q=80&w=1600&auto=format&fit=crop"  // rain over hills
    ],
    storm: [
      "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?q=80&w=1600&auto=format&fit=crop", // storm over rocky peaks
      "https://images.unsplash.com/photo-1500674425229-f692875b0ab3?q=80&w=1600&auto=format&fit=crop"
    ],
    fog: [
      "https://images.unsplash.com/photo-1487621167305-5d248087c724?q=80&w=1600&auto=format&fit=crop", // misty mountains
      "https://images.unsplash.com/photo-1487730116645-74489c95b41b?q=80&w=1600&auto=format&fit=crop"
    ],
    snow: [
      "https://images.unsplash.com/photo-1418985991508-e47386d96a71?q=80&w=1600&auto=format&fit=crop", // snow peaks
      "https://images.unsplash.com/photo-1491002052546-bf38f186af56?q=80&w=1600&auto=format&fit=crop"  // snowy mountain range
    ]
  };
  const chosenBg = {};

  function setBackground(key){
    if(!chosenBg[key]){
      const arr = BG_IMAGES[key] || BG_IMAGES.clear_day;
      chosenBg[key] = arr[Math.floor(Math.random()*arr.length)];
    }
    const _bg = document.getElementById('bg-image'); if (_bg) _bg.style.backgroundImage = `url('${chosenBg[key]}')`;
  }

  // "Life imagery" — real photography of people interacting with the
  // weather (walking with an umbrella in the rain, cycling at sunrise),
  // shown as a faint low-opacity layer behind the glass UI (see CSS:
  // opacity ~0.16 + luminosity blend so it never competes with foreground
  // content). Only set for conditions where a good match exists.
  const LIFE_IMAGES = {
    rain:  "https://images.unsplash.com/photo-1737472794238-fea3f5ef0999?q=80&w=1600&auto=format&fit=crop", // girl walking with umbrella, rain
    storm: "https://images.unsplash.com/photo-1737472794238-fea3f5ef0999?q=80&w=1600&auto=format&fit=crop",
    hail:  "https://images.unsplash.com/photo-1737472794238-fea3f5ef0999?q=80&w=1600&auto=format&fit=crop",
    clouds:"https://images.unsplash.com/photo-1750967991618-7b64a3025381?q=80&w=1600&auto=format&fit=crop", // cyclists at sunrise
    clear: "https://images.unsplash.com/photo-1750967991618-7b64a3025381?q=80&w=1600&auto=format&fit=crop"
  };

  function setLifeImage(key){
    const el = document.getElementById('life-image');
    const url = LIFE_IMAGES[key];
    if(!url){ el.style.opacity = 0; return; }
    el.style.backgroundImage = `url('${url}')`;
    el.style.opacity = '';
  }

  function makeParticles(kind, count){
    particles = [];
    for(let i=0;i<count;i++){
      if(kind==='rain'){
        particles.push({ x:Math.random()*W, y:Math.random()*H, len:14+Math.random()*18, speed:9+Math.random()*7, drift:1.2 });
      } else if(kind==='hail'){
        particles.push({ x:Math.random()*W, y:Math.random()*H, r:2+Math.random()*3, speed:6+Math.random()*5, spin:Math.random()*6 });
      } else if(kind==='snow'){
        particles.push({ x:Math.random()*W, y:Math.random()*H, r:1.5+Math.random()*3, speed:0.6+Math.random()*1.4, drift:Math.random()*1.4-0.7 });
      } else if(kind==='aurora'){
        particles.push({ x:Math.random()*W, y:-Math.random()*H, len:60+Math.random()*80, speed:3+Math.random()*4, hue: Math.random()>0.5? '#7ee8b8':'#c9a8ff', delay:Math.random()*400 });
      } else if(kind==='fogpuff'){
        particles.push({ x:Math.random()*W, y:H*0.5+Math.random()*H*0.5, r:120+Math.random()*180, speed:0.15+Math.random()*0.25, alpha:0.05+Math.random()*0.08 });
      }
    }
  }

  function drawRain(){
    ctx.strokeStyle = 'rgba(180,210,255,0.55)';
    ctx.lineWidth = 1.4;
    particles.forEach(p=>{
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.drift*4, p.y + p.len);
      ctx.stroke();
      p.y += p.speed; p.x -= p.drift;
      if(p.y > H){ p.y = -20; p.x = Math.random()*W; }
    });
  }

  function drawHail(){
    ctx.fillStyle = 'rgba(230,240,255,0.85)';
    particles.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      p.y += p.speed; p.x += Math.sin(p.y*0.05)*0.6;
      if(p.y > H){ p.y = -10; p.x = Math.random()*W; }
    });
  }

  function drawSnow(){
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    particles.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      p.y += p.speed; p.x += p.drift;
      if(p.y > H){ p.y = -6; p.x = Math.random()*W; }
    });
  }

  // Signature feature: "Aurora Streaks" — falling luminous geo-streaks at night
  function drawAurora(t){
    particles.forEach(p=>{
      if(t < p.delay) return;
      const grad = ctx.createLinearGradient(p.x, p.y, p.x-6, p.y+p.len);
      grad.addColorStop(0, p.hue + 'cc');
      grad.addColorStop(1, p.hue + '00');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x-6, p.y+p.len);
      ctx.stroke();
      p.y += p.speed; p.x -= 0.6;
      if(p.y > H+100){ p.y = -Math.random()*H*0.6; p.x = Math.random()*W; p.delay = t + Math.random()*300; }
    });
  }

  function drawFogPuffs(){
    particles.forEach(p=>{
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
      g.addColorStop(0, `rgba(210,220,235,${p.alpha})`);
      g.addColorStop(1, 'rgba(210,220,235,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
      p.x += p.speed;
      if(p.x - p.r > W) p.x = -p.r;
    });
  }

  function drawSunRays(t){
    const cx = W*0.82, cy = H*0.16;
    for(let i=0;i<10;i++){
      const ang = (t*0.0003 + i*(Math.PI*2/10));
      const g = ctx.createLinearGradient(cx,cy, cx+Math.cos(ang)*260, cy+Math.sin(ang)*260);
      g.addColorStop(0,'rgba(255,225,150,0.16)');
      g.addColorStop(1,'rgba(255,225,150,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.lineTo(cx+Math.cos(ang)*260, cy+Math.sin(ang)*260);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(cx,cy,0,cx,cy,120);
    glow.addColorStop(0,'rgba(255,240,190,0.55)');
    glow.addColorStop(1,'rgba(255,240,190,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx,cy,120,0,Math.PI*2); ctx.fill();
  }

  function loop(t){
    ctx.clearRect(0,0,W,H);
    if(mode==='rain' || mode==='storm') drawRain();
    if(mode==='hail') drawHail();
    if(mode==='snow') drawSnow();
    if(mode==='fog') drawFogPuffs();
    if(mode==='clear' && !isNight) drawSunRays(t);
    if(mode==='clear' && isNight) drawAurora(t);
    raf = requestAnimationFrame(loop);
  }

  function setMode(newMode, night){
    mode = newMode; isNight = !!night;
    if(mode==='rain') { makeParticles('rain', 180); setBackground('rain'); setLifeImage('rain'); }
    else if(mode==='storm'){ makeParticles('rain', 240); setBackground('storm'); setLifeImage('storm'); }
    else if(mode==='hail'){ makeParticles('hail', 120); setBackground('storm'); setLifeImage('hail'); }
    else if(mode==='snow'){ makeParticles('snow', 160); setBackground('snow'); setLifeImage(null); }
    else if(mode==='fog'){ makeParticles('fogpuff', 14); setBackground('fog'); setLifeImage(null); }
    else if(mode==='clouds'){ particles=[]; setBackground('clouds'); setLifeImage('clouds'); }
    else { // clear
      if(isNight){ makeParticles('aurora', 10); setBackground('clear_night'); setLifeImage(null); }
      else { particles=[]; setBackground('clear_day'); setLifeImage('clear'); }
    }
    if(window.CartoonFX) CartoonFX.setMode(isNight ? null : mode);
  }

  if(!raf) raf = requestAnimationFrame(loop);

  // Show a real landscape straight away — previously #bg-image stayed
  // empty (plain CSS gradient behind the login screen) until a place's
  // weather loaded after sign-in, since that's the only place setMode()
  // was called from.
  setBackground('clear_day');

  // Map Open-Meteo WMO weather codes -> fx mode
  function modeFromWMO(code, isDayNight){
    let m = 'clear';
    if([0,1].includes(code)) m='clear';
    else if([2,3].includes(code)) m='clouds';
    else if([45,48].includes(code)) m='fog';
    else if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) m='rain';
    else if([71,73,75,77,85,86].includes(code)) m='snow';
    else if([95,96,99].includes(code)) m='storm';
    else if([96,99].includes(code)) m='hail';
    setMode(m, !isDayNight);
    return m;
  }

  return { setMode, modeFromWMO };
})();


async function handleWeatherAlert(userId, weatherData) {
  if (weatherData.temp > 40 || weatherData.uv_index > 9) {
    await NotificationManager.sendWeatherAlertNotification(userId, weatherData);
  }
}

// Then call it when weather updates:
async function handleWeatherAlert(userId, weatherData) {
  if (weatherData.temp > 40 || weatherData.uv_index > 9) {
    try {
      await NotificationManager.sendWeatherAlertNotification(userId, weatherData);
    } catch (err) {
      console.error('Weather alert notification failed:', err);
    }
  }
}