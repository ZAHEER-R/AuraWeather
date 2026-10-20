/* ============================================================
   CARTOONFX — simple flat-style cartoon scenes that walk/cycle/drive
   across the home screen background, matched to the current weather:
     rain / storm / hail  -> person walking with a folding umbrella
     clouds                -> cyclist under a cloudy sky
     clear day              -> car driving down a sunny road
   Hidden entirely for fog/snow/night to keep things uncluttered.
   ============================================================ */
const CartoonFX = (() => {
  let layer;

  function build(){
    layer = document.createElement('div');
    layer.id = 'cartoon-layer';
    layer.innerHTML = `
      <div class="cartoon-scene" data-scene="walker">
        <svg class="cartoon-sprite walker-sprite" viewBox="0 0 130 110" width="96" height="82">
          <ellipse cx="45" cy="104" rx="26" ry="5" fill="rgba(0,0,0,0.18)"/>
          <ellipse cx="105" cy="104" rx="14" ry="4" fill="rgba(0,0,0,0.14)"/>
          <g class="umbrella-group">
            <path d="M15 40 Q45 10 75 40 Z" fill="#ff8a8a"/>
            <path d="M15 40 Q22 34 30 40 Q38 34 46 40 Q54 34 62 40 Q68 34 75 40" fill="none" stroke="#e05c5c" stroke-width="1.5"/>
            <line x1="45" y1="40" x2="45" y2="66" stroke="#333" stroke-width="2.5"/>
            <path d="M45 66 q6 0 6 6" fill="none" stroke="#333" stroke-width="2.5"/>
          </g>
          <circle cx="45" cy="52" r="9" fill="#ffd9b3"/>
          <rect x="37" y="60" width="16" height="26" rx="6" fill="#5aa9ff"/>
          <g class="leg leg-left"><rect x="38" y="84" width="6" height="20" rx="3" fill="#2c3e6e"/></g>
          <g class="leg leg-right"><rect x="46" y="84" width="6" height="20" rx="3" fill="#2c3e6e"/></g>
          <rect x="30" y="64" width="8" height="18" rx="4" fill="#5aa9ff"/>
          <!-- pet dog trotting alongside on a lead -->
          <line x1="30" y1="74" x2="98" y2="88" stroke="#c9a8ff" stroke-width="1.5"/>
          <g class="dog">
            <ellipse cx="105" cy="92" rx="16" ry="9" fill="#e8b98a"/>
            <circle cx="118" cy="86" r="7" fill="#e8b98a"/>
            <path d="M120 80 l4 -6 l2 7 Z" fill="#e8b98a"/>
            <g class="dog-leg dog-leg-1"><rect x="96" y="98" width="3.5" height="9" rx="1.5" fill="#c99a68"/></g>
            <g class="dog-leg dog-leg-2"><rect x="108" y="98" width="3.5" height="9" rx="1.5" fill="#c99a68"/></g>
            <path d="M92 90 q-6 2 -8 -3" stroke="#e8b98a" stroke-width="3" fill="none" stroke-linecap="round"/>
          </g>
        </svg>
      </div>

      <div class="cartoon-scene" data-scene="cyclist">
        <svg class="cartoon-sprite cyclist-sprite" viewBox="0 0 140 100" width="120" height="86">
          <ellipse cx="70" cy="94" rx="46" ry="4" fill="rgba(0,0,0,0.18)"/>
          <g class="wheel wheel-back"><circle cx="30" cy="76" r="16" fill="none" stroke="#2c3e6e" stroke-width="4"/><line x1="30" y1="60" x2="30" y2="92" stroke="#2c3e6e" stroke-width="2"/><line x1="14" y1="76" x2="46" y2="76" stroke="#2c3e6e" stroke-width="2"/></g>
          <g class="wheel wheel-front"><circle cx="104" cy="76" r="16" fill="none" stroke="#2c3e6e" stroke-width="4"/><line x1="104" y1="60" x2="104" y2="92" stroke="#2c3e6e" stroke-width="2"/><line x1="88" y1="76" x2="120" y2="76" stroke="#2c3e6e" stroke-width="2"/></g>
          <path d="M30 76 L60 40 L104 76 M60 40 L70 76 M60 40 L52 30" stroke="#7ee8b8" stroke-width="4" fill="none" stroke-linecap="round"/>
          <circle cx="55" cy="20" r="9" fill="#ffd9b3"/>
          <rect x="48" y="28" width="16" height="18" rx="5" fill="#c9a8ff"/>
          <g class="pedal-leg pedal-1"><rect x="55" y="42" width="6" height="18" rx="3" fill="#2c3e6e"/></g>
          <g class="pedal-leg pedal-2"><rect x="63" y="42" width="6" height="18" rx="3" fill="#2c3e6e"/></g>
        </svg>
      </div>

      <div class="cartoon-scene" data-scene="car">
        <svg class="cartoon-sprite car-sprite" viewBox="0 0 160 90" width="130" height="72">
          <ellipse cx="80" cy="80" rx="60" ry="5" fill="rgba(0,0,0,0.18)"/>
          <path d="M20 62 Q30 34 55 32 L100 32 Q118 34 130 56 L138 62 L138 70 L20 70 Z" fill="#ffb37e"/>
          <path d="M58 34 L70 50 L100 50 L96 34 Z" fill="#eaf4ff" opacity="0.8"/>
          <g class="car-wheel car-wheel-l"><circle cx="46" cy="70" r="12" fill="#2c3e6e"/><circle cx="46" cy="70" r="4" fill="#eaf4ff"/></g>
          <g class="car-wheel car-wheel-r"><circle cx="114" cy="70" r="12" fill="#2c3e6e"/><circle cx="114" cy="70" r="4" fill="#eaf4ff"/></g>
        </svg>
      </div>
    `;
    document.body.appendChild(layer);
  }

  function setMode(mode){
    if(!layer) build();
    const map = { rain:'walker', storm:'walker', hail:'walker', clouds:'cyclist', clear:'car' };
    const active = map[mode] || null;
    layer.querySelectorAll('.cartoon-scene').forEach(el => {
      el.classList.toggle('active', el.dataset.scene === active);
    });
  }

  function setVisible(visible){
    if(!layer) build();
    layer.classList.toggle('hidden', !visible);
  }

  return { setMode, setVisible };
})();
