/* ── Animations GSAP (bundle local : fonctionne aussi hors-ligne) ── */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){ document.documentElement.classList.add('no-gsap'); return; }
    gsap.registerPlugin(ScrollTrigger);
    var mm = gsap.matchMedia();
    mm.add({ desktop:'(min-width:761px)', mobile:'(max-width:760px)' }, function(ctx){
      var mob = ctx.conditions.mobile;
      var tl = gsap.timeline({
        scrollTrigger:{
          trigger:'.hero-transition',
          start:'top top',
          end:'bottom bottom',
          scrub:true,
          invalidateOnRefresh:true
        }
      });
      /* 1. la typographie recule et s'efface */
      tl.to('.ht-inner', {scale:.86, y:mob?-80:-140, opacity:.06, ease:'none'}, 0)
        .to('.ht-hint',  {opacity:0, ease:'none'}, 0)
      /* 2→4. la carte remonte du bas, se redresse et occupe l'écran */
        .fromTo('.morph-card',
          {y:function(){ return window.innerHeight * (mob ? .62 : .72); },
           rotateX:16, rotateY:-20, skewX:-6,
           scale:function(){
             var w0 = mob ? Math.min(340, window.innerWidth * .8)
                          : Math.min(430, window.innerWidth * .34);
             return w0 / window.innerWidth;
           },
           borderRadius:64},
          {y:0, rotateX:0, rotateY:0, skewX:0,
           scale:1, /* échelle native : rendu final parfaitement net */
           borderRadius:0, ease:'none', immediateRender:true}, 0)
      /* l'intérieur contre-scale : la composition reste lisible pendant la déformation */
        .fromTo('.mc-inner', {scale:2.3}, {scale:1, ease:'none'}, 0) /* lisible au repos, net en plein écran */
      /* 3. l'univers bascule vers le noir AWONE, en continuité avec la suite */
        .to('.ht-dark', {opacity:1, ease:'none'}, .38)
      /* 5. la signature de la transition se révèle */
        .to('.mc-cap', {opacity:1, ease:'none'}, .74)
        .to('.mc-logo', {filter:'drop-shadow(0 6px 30px rgba(199,177,255,.6))', ease:'none'}, .74);
      return function(){ tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); };
    });

    /* ── Situations : apparitions douces en cascade (réf. UpSunday) ── */
    gsap.from('.situations-header > *', {
      opacity:0, y:50, duration:1, stagger:.12, ease:'power3.out',
      scrollTrigger:{ trigger:'.situations-section', start:'top 75%' }
    });
    gsap.from('.situations-carousel-wrapper', {
      opacity:0, y:50, duration:.9, ease:'power3.out',
      scrollTrigger:{ trigger:'.situations-carousel', start:'top 88%' }
    });
    gsap.from('.situation-card', {
      opacity:0, scale:.94, duration:.9, stagger:.1, ease:'power3.out',
      transformOrigin:'50% 100%',
      scrollTrigger:{ trigger:'.situations-carousel', start:'top 88%' }
    });
  window.addEventListener('load', function(){ ScrollTrigger.refresh(); });
})();

/* ── Reveal au scroll (cascade) ── */
(function(){
  var mobile = window.matchMedia('(max-width:768px)').matches;
  var BOOM = mobile ? 520 : 680; /* durée de vol des météorites (accélérée) */

  /* Les météorites de chaque section partent quand la section entre à l'écran */
  var burstIO = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        en.target.classList.add('play');
        en.target.dataset.t0 = performance.now();
        burstIO.unobserve(en.target);
      }
    });
  }, {threshold:.2});
  document.querySelectorAll('section[data-burst]').forEach(function(s){ burstIO.observe(s); });

  /* Reveals : dans une section à météorites, les éléments n'apparaissent
     qu'au moment des impacts, puis en cascade désynchronisée */
  var els = document.querySelectorAll('.reveal');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        var i = parseInt(en.target.getAttribute('data-i') || 0, 10);
        var delay = i * 80;
        var sec = en.target.closest('section[data-burst]');
        if(sec){
          var t0 = parseFloat(sec.dataset.t0 || 0);
          var since = t0 ? (performance.now() - t0) : 0;
          var wait = Math.max(0, BOOM - since); /* si l'impact a déjà eu lieu, pas d'attente */
          delay = wait + i * 90;
        }
        en.target.style.transitionDelay = delay + 'ms';
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, {threshold:.15});
  els.forEach(function(el){ io.observe(el); });
})();

/* ── Fond voyageant : la teinte est résolue au centre de l'écran.
     Déterministe dans les deux sens (montée comme descente) : c'est
     toujours la section qui occupe le centre du viewport qui donne
     sa couleur — plus aucun ton sur ton possible. ── */
(function(){
  var layers = {};
  document.querySelectorAll('.bg-travel span').forEach(function(s){
    var k = s.className.match(/t-(\w+)/); if(k) layers[k[1]] = s;
  });
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-tint]'));
  var current = null;
  function apply(tint){
    if(tint === current || !layers[tint]) return;
    current = tint;
    Object.keys(layers).forEach(function(k){
      layers[k].classList.toggle('on', k === tint);
    });
  }
  function resolve(){
    var mid = window.innerHeight / 2;
    var best = null, bestDist = Infinity;
    for(var i = 0; i < sections.length; i++){
      var r = sections[i].getBoundingClientRect();
      if(r.top <= mid && r.bottom >= mid){ best = sections[i]; break; } /* le centre est dedans */
      var d = r.top > mid ? r.top - mid : mid - r.bottom;
      if(d < bestDist){ bestDist = d; best = sections[i]; }
    }
    if(best) apply(best.getAttribute('data-tint'));
  }
  var raf;
  window.addEventListener('scroll', function(){
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(resolve);
  }, {passive:true});
  window.addEventListener('resize', resolve);
  resolve();
})();

/* ── Section 2 : météorite + explosion d'arrivée (une seule fois) ── */
(function(){
  var why = document.getElementById('pourquoi');
  if(!why) return;
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        why.classList.add('play');
        io.unobserve(why);
      }
    });
  }, {threshold:.35});
  io.observe(why);
})();

/* ── Pôles : capsules qui arrivent au scroll + icône du ciel ── */
(function(){
  var poles = document.querySelectorAll('.pole');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, {threshold:.2, rootMargin:'0px 0px -8% 0px'});
  poles.forEach(function(p){ io.observe(p); });
})();

/* ── Situations : roue libre façon Netflix — inertie au doigt comme à la
     souris, puis pose douce sur une carte alignée : les cartes visibles
     sont toujours entières. ── */
(function(){
  var c = document.getElementById('situationsCarousel');
  if(!c) return;
  var cards = Array.prototype.slice.call(c.querySelectorAll('.situation-card'));

  function positions(){
    var base = cards[0].offsetLeft;
    return cards.map(function(k){ return k.offsetLeft - base; });
  }
  function maxScroll(){ return c.scrollWidth - c.clientWidth; }
  function nearestIndex(){
    var pos = positions(), x = c.scrollLeft, best = 0, d = Infinity;
    for(var i = 0; i < pos.length; i++){
      var dd = Math.abs(pos[i] - x);
      if(dd < d){ d = dd; best = i; }
    }
    return best;
  }
  function goToIndex(i){
    var pos = positions();
    i = Math.max(0, Math.min(pos.length - 1, i));
    var target = Math.min(pos[i], maxScroll());
    c.scrollTo({left: target, behavior:'smooth'});
  }
  function perView(){
    return window.innerWidth > 1024 ? 3 : (window.innerWidth > 640 ? 2 : 1);
  }

  /* pose douce après l'inertie (tactile ou molette) */
  var down = false, flinging = false, idle;
  function settle(){
    if(down || flinging) return;
    var pos = positions()[nearestIndex()];
    var target = Math.min(pos, maxScroll());
    if(Math.abs(c.scrollLeft - target) > 2 && c.scrollLeft < maxScroll() - 2){
      c.scrollTo({left: target, behavior:'smooth'});
    }
  }
  c.addEventListener('scroll', function(){
    clearTimeout(idle);
    idle = setTimeout(settle, 150);
  }, {passive:true});

  c.addEventListener('keydown', function(e){
    if(e.key === 'ArrowRight'){ e.preventDefault(); goToIndex(nearestIndex() + perView()); }
    if(e.key === 'ArrowLeft'){ e.preventDefault(); goToIndex(nearestIndex() - perView()); }
  });

  /* drag souris : élan + friction, comme le rouleau des grandes marques */
  var sx = 0, ss = 0, moved = false, vel = 0, lastX = 0, lastT = 0, flingRaf;
  function stopFling(){ flinging = false; cancelAnimationFrame(flingRaf); }
  function fling(){
    flinging = true;
    (function roll(){
      if(!flinging) return;
      c.scrollLeft -= vel * 16;
      vel *= 0.94;
      if(c.scrollLeft <= 0 || c.scrollLeft >= maxScroll()) vel *= 0.6; /* bords amortis */
      if(Math.abs(vel) > 0.04){ flingRaf = requestAnimationFrame(roll); }
      else { flinging = false; settle(); }
    })();
  }
  c.addEventListener('pointerdown', function(e){
    if(e.pointerType !== 'mouse') return;
    stopFling();
    down = true; moved = false;
    sx = e.clientX; ss = c.scrollLeft;
    lastX = e.clientX; lastT = performance.now(); vel = 0;
    c.classList.add('dragging');
  });
  window.addEventListener('pointermove', function(e){
    if(!down) return;
    if(Math.abs(e.clientX - sx) > 4) moved = true;
    c.scrollLeft = ss - (e.clientX - sx);
    var now = performance.now(), dt = now - lastT;
    if(dt > 0){ vel = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now; }
  });
  window.addEventListener('pointerup', function(){
    if(!down) return;
    down = false; c.classList.remove('dragging');
    if(!moved) return;
    if(Math.abs(vel) > 0.25){ fling(); }
    else { settle(); }
  });
})();

/* ── Lueur qui suit la souris sur la section situations (réf. UpSunday) ── */
(function(){
  var sec = document.querySelector('.situations-section');
  var glow = sec && sec.querySelector('.s-glow');
  if(!sec || !glow || window.matchMedia('(pointer:coarse)').matches) return;
  var tx = 0, ty = 0, gx = 0, gy = 0, running = false;
  sec.addEventListener('pointermove', function(e){
    var r = sec.getBoundingClientRect();
    tx = e.clientX - r.left; ty = e.clientY - r.top;
    if(!running){ running = true; requestAnimationFrame(follow); }
  });
  function follow(){
    gx += (tx - gx) * .12; gy += (ty - gy) * .12; /* traîne douce, comme une pression */
    glow.style.left = gx + 'px'; glow.style.top = gy + 'px';
    if(Math.abs(tx - gx) > .5 || Math.abs(ty - gy) > .5){ requestAnimationFrame(follow); }
    else { running = false; }
  }
  sec.querySelectorAll('.situation-card').forEach(function(card){
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
})();

/* ── CTA iClosed : chargement tardif, le lien reste le secours ── */
(function(){
  var loading;
  function loadIclosed(){
    if(window.__icwReady) return;
    if(loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = 'https://app.iclosed.io/assets/widget.js';
    s.async = true;
    s.onload = function(){ window.__icwReady = 1; };
    s.onerror = function(){ loading = false; };
    document.head.appendChild(s);
  }

  document.querySelectorAll('a[data-embed-type="popup"]').forEach(function(a){
    a.addEventListener('pointerenter', loadIclosed, {passive:true});
    a.addEventListener('focus', loadIclosed);
    a.addEventListener('click', function(e){
      if(window.__icwReady){ e.preventDefault(); }
      else { loadIclosed(); }
    });
  });

  var contact = document.getElementById('contact');
  if(contact && 'IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      if(entries.some(function(en){ return en.isIntersecting; })){
        loadIclosed();
        io.disconnect();
      }
    }, {rootMargin:'700px 0px'});
    io.observe(contact);
  }
})();

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

/* ── L'offre du moment : vidéo verticale Cloudflare Stream ── */
(function(){
  var tv = document.getElementById('tv');
  var video = document.getElementById('offer-video');
  var btn = document.getElementById('sound-btn');
  if(!tv || !video || !btn) return;
  var hlsSrc = video.dataset.hlsSrc;
  var dashSrc = video.dataset.dashSrc;
  var playerReady = false;
  var initPromise;

  function markReady(){
    playerReady = true;
    if(tv.classList.contains('visible')) video.play().catch(function(){});
  }

  function initDash(){
    if(!dashSrc || !window.MediaSource) return Promise.resolve(false);
    return import('dashjs').then(function(mod){
      var dashjs = mod.default || mod;
      var dashPlayer = dashjs.MediaPlayer().create();
      dashPlayer.initialize(video, dashSrc, false);
      dashPlayer.updateSettings({
        streaming: {
          buffer: { fastSwitchEnabled: true },
          abr: { autoSwitchBitrate: { video: true } }
        }
      });
      markReady();
      return true;
    }).catch(function(err){
      console.warn('Cloudflare DASH player unavailable', err);
      return false;
    });
  }

  function initStream(){
    if(initPromise) return initPromise;
    if(hlsSrc && video.canPlayType('application/vnd.apple.mpegurl')){
      video.src = hlsSrc;
      markReady();
      initPromise = Promise.resolve(true);
      return initPromise;
    }
    if(!hlsSrc){
      initPromise = initDash().then(function(ok){
        if(!ok) btn.style.display = 'none';
        return ok;
      });
      return initPromise;
    }
    initPromise = import('hls.js').then(function(mod){
      var Hls = mod.default || mod;
      if(!Hls.isSupported()) return initDash();
      var hls = new Hls({ capLevelToPlayerSize: true });
      hls.loadSource(hlsSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, markReady);
      hls.on(Hls.Events.ERROR, function(_, data){
        if(!data || !data.fatal) return;
        hls.destroy();
        initDash().then(function(ok){
          if(!ok) btn.style.display = 'none';
        });
      });
      return true;
    }).then(function(ok){
      if(!ok) btn.style.display = 'none';
      return ok;
    }).catch(function(err){
      console.warn('Cloudflare HLS player unavailable', err);
      return initDash().then(function(ok){
        if(!ok) btn.style.display = 'none';
        return ok;
      });
    });
    return initPromise;
  }

  var preloadIO = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting) return;
      initStream();
      preloadIO.unobserve(tv);
    });
  }, {rootMargin:'900px 0px', threshold:0});
  preloadIO.observe(tv);

  /* Apparition de l'écran + lecture uniquement quand visible */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        tv.classList.add('visible');
        initStream();
        if(playerReady || video.readyState > 0) video.play().catch(function(){});
      } else {
        video.pause();
      }
    });
  }, {threshold:.35});
  io.observe(tv);

  /* Son activable / coupable à la main, sans quitter la page */
  btn.addEventListener('click', function(){
    video.muted = !video.muted;
    btn.classList.toggle('unmuted', !video.muted);
    btn.setAttribute('aria-pressed', String(!video.muted));
    btn.setAttribute('aria-label', video.muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo');
    btn.querySelector('.lbl').textContent = video.muted ? 'Activer le son' : 'Couper le son';
    if(!video.muted) video.play().catch(function(){});
  });

  video.addEventListener('loadedmetadata', markReady);
})();

/* ── Menu burger ── */
(function(){
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  if(!burger) return;
  function close(){document.body.classList.remove('menu-open');burger.setAttribute('aria-expanded','false')}
  burger.addEventListener('click', function(){
    var open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
  });
  menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', close); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
})();

/* ── Année dynamique ── */
document.getElementById('year').textContent = new Date().getFullYear();

/* ── CTA flottant : systématiquement présent, sur tous les écrans ── */
(function(){
  var sticky = document.getElementById('sticky-cta');
  if(!sticky) return;
  setTimeout(function(){ sticky.classList.add('show'); }, 900);
})();

