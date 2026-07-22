/* ── Carrousel de marques : boucle infinie, focus central, surbrillance ── */
(function(){
  var track = document.getElementById('brands-track');
  if(!track) return;
  var base = Array.prototype.slice.call(track.children);
  var N = base.length;

  /* Boucle infinie : la liste est triplée, on navigue dans la copie centrale
     et on se recale silencieusement dès qu'on s'approche d'un bord. */
  for(var k = 0; k < 2; k++) base.forEach(function(c){ track.appendChild(c.cloneNode(true)); });
  var cards = Array.prototype.slice.call(track.children);

  var dots = document.getElementById('b-dots');
  for(var i = 0; i < N; i++){ var d = document.createElement('i'); if(i===0) d.className='on'; dots.appendChild(d); }
  var dotEls = dots.children;

  function center(el){ return el.offsetLeft + el.offsetWidth / 2; }
  var setW = 0;
  function measure(){ setW = center(cards[N]) - center(cards[0]); }

  var current = -1;
  function focusClosest(){
    var mid = track.scrollLeft + track.clientWidth / 2;
    var best = 0, dist = Infinity;
    for(var i = 0; i < cards.length; i++){
      var d = Math.abs(center(cards[i]) - mid);
      if(d < dist){ dist = d; best = i; }
    }
    if(best !== current){
      for(var i = 0; i < cards.length; i++) cards[i].classList.toggle('focus', i === best);
      var m = best % N;
      for(var i = 0; i < dotEls.length; i++) dotEls[i].classList.toggle('on', i === m);
      /* surbrillance "rêve" à chaque bascule */
      var f = cards[best];
      f.classList.remove('shine'); void f.offsetWidth; f.classList.add('shine');
      current = best;
    }
    return best;
  }
  function goTo(i){
    track.scrollTo({left: center(cards[i]) - track.clientWidth / 2, behavior: 'smooth'});
  }
  /* recalage silencieux (invisible : les copies sont identiques) */
  function loopFix(){
    var b = focusClosest();
    if(b < N || b >= 2 * N){
      var prev = track.style.scrollBehavior;
      track.style.scrollBehavior = 'auto';
      track.scrollLeft += (b < N ? setW : -setW);
      track.style.scrollBehavior = prev;
      current = -1; focusClosest();
    }
  }
  var raf, idle;
  function settle(){
    if(down || flinging) return;
    var b = focusClosest();
    var target = center(cards[b]) - track.clientWidth / 2;
    if(Math.abs(track.scrollLeft - target) > 2){
      track.scrollTo({left: target, behavior: 'smooth'});
    }
  }
  track.addEventListener('scroll', function(){
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(focusClosest);
    clearTimeout(idle);
    idle = setTimeout(function(){ loopFix(); settle(); }, 140);
  }, {passive:true});

  document.querySelector('.b-arrow.prev').addEventListener('click', function(){ goTo(focusClosest() - 1); });
  document.querySelector('.b-arrow.next').addEventListener('click', function(){ goTo(focusClosest() + 1); });
  track.addEventListener('keydown', function(e){
    if(e.key === 'ArrowLeft'){ e.preventDefault(); goTo(focusClosest() - 1); }
    if(e.key === 'ArrowRight'){ e.preventDefault(); goTo(focusClosest() + 1); }
  });

  /* drag à la souris : rouleau à inertie — on lance, ça déroule, puis
     ça vient se poser en douceur sur la marque la plus proche */
  var down = false, startX = 0, startScroll = 0, moved = false;
  var flinging = false, vel = 0, lastX = 0, lastT = 0, flingRaf;
  function stopFling(){ flinging = false; cancelAnimationFrame(flingRaf); }
  function fling(){
    flinging = true;
    (function roll(){
      if(!flinging) return;
      track.scrollLeft -= vel * 16;
      vel *= 0.94; /* friction : le rouleau ralentit naturellement */
      /* recalage silencieux de la boucle infinie pendant le roulis */
      var b = focusClosest();
      if(b < N || b >= 2 * N){ track.scrollLeft += (b < N ? setW : -setW); }
      if(Math.abs(vel) > 0.04){ flingRaf = requestAnimationFrame(roll); }
      else { flinging = false; settle(); }
    })();
  }
  track.addEventListener('pointerdown', function(e){
    if(e.pointerType !== 'mouse') return;
    stopFling();
    down = true; moved = false;
    startX = e.clientX; startScroll = track.scrollLeft;
    lastX = e.clientX; lastT = performance.now(); vel = 0;
    track.classList.add('dragging');
  });
  window.addEventListener('pointermove', function(e){
    if(!down) return;
    if(Math.abs(e.clientX - startX) > 4) moved = true;
    track.scrollLeft = startScroll - (e.clientX - startX);
    var now = performance.now(), dt = now - lastT;
    if(dt > 0){ vel = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now; }
  });
  window.addEventListener('pointerup', function(){
    if(!down) return;
    down = false; track.classList.remove('dragging');
    if(!moved) return;
    if(Math.abs(vel) > 0.25){ fling(); } /* élan → effet rouleau */
    else { settle(); }
  });

  /* départ : première marque de la copie centrale, parfaitement centrée */
  function init(){
    measure();
    var prev = track.style.scrollBehavior;
    track.style.scrollBehavior = 'auto';
    track.scrollLeft = center(cards[N]) - track.clientWidth / 2;
    track.style.scrollBehavior = prev;
    current = -1; focusClosest();
  }
  requestAnimationFrame(init);
  window.addEventListener('resize', function(){ clearTimeout(idle); idle = setTimeout(init, 180); });
  window.addEventListener('load', init);
})();
