/* ── Animations GSAP (bundle local : fonctionne aussi hors-ligne) ── */
import { gsap, ScrollTrigger } from './motion.js';
/* Les deux contrôleurs de pin sont évalués dès le chargement du bundle.
   Seuls leurs moteurs légers arrivent ici : les frames restent chargées
   à distance par leurs IntersectionObserver respectifs. */
import './immersive-sequence.js';
import './method-sequence.js';

/* Chrome peut restaurer la page avant que ScrollTrigger ait fini d'installer
   les spacers. On ne reprend la main que lors d'un rechargement effectué au
   milieu de l'un des deux pins ; toute autre position reste native. */
(function(){
  var STORAGE_KEY = 'awone:pinned-scroll-restore';
  var targets = [
    ['immersion', '[data-immersive-stage]'],
    ['methode', '[data-method-stage]']
  ];

  function sectionRange(id, stageSelector){
    var section = document.getElementById(id);
    var stage = section && section.querySelector(stageSelector);
    if(!section || !stage) return null;
    var start = window.scrollY + section.getBoundingClientRect().top;
    return {
      start:start,
      end:start + Math.max(1, section.offsetHeight - stage.offsetHeight)
    };
  }

  function isInsidePinnedRange(y){
    return targets.some(function(target){
      var range = sectionRange(target[0], target[1]);
      return range && y >= range.start && y <= range.end;
    });
  }

  window.addEventListener('pagehide', function(){
    try {
      var y = Math.round(window.scrollY);
      if(!isInsidePinnedRange(y)){
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        path:location.pathname + location.search,
        y:y,
        savedAt:Date.now()
      }));
    } catch(error){
      /* La restauration native reste disponible si le stockage est bloqué. */
    }
  });

  var navigation = performance.getEntriesByType('navigation')[0];
  if(!navigation || navigation.type !== 'reload') return;

  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); }
  catch(error){ saved = null; }
  if(
    !saved ||
    saved.path !== location.pathname + location.search ||
    !Number.isFinite(saved.y) ||
    !Number.isFinite(saved.savedAt) ||
    Date.now() - saved.savedAt > 30000
  ) return;

  function restorePinnedScroll(){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        if(!isInsidePinnedRange(saved.y)) return;
        if(window.__awoneLenis){
          window.__awoneLenis.scrollTo(saved.y, {immediate:true, force:true});
        } else {
          window.scrollTo({top:saved.y, behavior:'instant'});
        }
        ScrollTrigger.update();
        try { sessionStorage.removeItem(STORAGE_KEY); }
        catch(error){ /* Aucun impact fonctionnel. */ }
      });
    });
  }

  if(document.readyState === 'complete') restorePinnedScroll();
  else window.addEventListener('load', restorePinnedScroll, {once:true});
})();

/* ── Défilement principal : l'inertie Lenis reste réservée aux appareils
     de bureau précis. Le tactile conserve son scroll natif, plus stable et
     moins coûteux que la synchronisation artificielle de chaque geste. ── */
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var precisePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(reduced || !precisePointer) return;

  /* Le scroll inertiel n'entre pas dans le bundle mobile : il est récupéré
     uniquement sur les appareils de bureau qui peuvent réellement l'utiliser. */
  import('lenis').then(function(module){
    var Lenis = module.default || module.Lenis;
    if(!Lenis) return;
    function isCinematicWheel(event){
      if(!event || !event.type || event.type.indexOf('wheel') < 0) return false;
      var path = typeof event.composedPath === 'function'
        ? event.composedPath()
        : [event.target];
      return path.some(function(node){
        return node instanceof Element && Boolean(
          node.closest('[data-immersive-stage],[data-method-stage]')
        );
      });
    }

    var lenis = new Lenis({
      lerp:.09,
      smoothWheel:true,
      syncTouch:false,
      wheelMultiplier:.95,
      virtualScroll:function(data){
        /* Un stage épinglé masque visuellement la distance parcourue et peut
           donner une impression d'enfermement à la molette. Une impulsion
           légèrement renforcée dans ces deux scènes seulement permet de les
           traverser vite, tout en conservant l'amortissement Lenis. */
        if(isCinematicWheel(data.event)) data.deltaY *= 1.25;
      },
      anchors:{offset:-72},
      stopInertiaOnNavigate:true,
      prevent:function(node){
        if(!(node instanceof Element)) return false;
        return Boolean(node.closest('.brands-track,.situations-carousel'));
      }
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__awoneLenis = lenis;
  }).catch(function(){
    /* Le scroll natif reste le fallback fonctionnel si le chunk est indisponible. */
  });
})();

/* Les animations décoratives continues sont mises en pause uniquement
   pendant le déplacement de la page. Les reveals, eux, restent pilotés
   par leurs transitions et ne sont donc jamais interrompus. */
(function(){
  var idle = 0;
  var scrolling = false;
  window.addEventListener('scroll', function(){
    if(!scrolling){
      scrolling = true;
      document.body.classList.add('is-scrolling');
    }
    clearTimeout(idle);
    idle = setTimeout(function(){
      scrolling = false;
      document.body.classList.remove('is-scrolling');
    }, 120);
  }, {passive:true});

  /* Les boucles hors écran restent gelées même lorsque la page ne bouge plus. */
  if('IntersectionObserver' in window){
    var loops = Array.prototype.slice.call(document.querySelectorAll('.marquee'));
    var loopObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
      });
    }, {rootMargin:'120px 0px', threshold:0});
    loops.forEach(function(loop){
      loop.classList.add('is-offscreen');
      loopObserver.observe(loop);
    });
  }
})();

/* Le CTA flottant reste hors champ pendant tout le récit du hero,
   y compris lorsque les animations sont désactivées. */
(function(){
  var hero = document.querySelector('.hero-transition');
  if(!hero) return;
  function setActive(active){ document.body.classList.toggle('hero-cinematic-active', active); }
  function sync(){
    var rect = hero.getBoundingClientRect();
    setActive(rect.bottom > 0 && rect.top < window.innerHeight);
  }
  sync();
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(entries){
      entries.forEach(function(entry){ setActive(entry.isIntersecting); });
    }, {threshold:0}).observe(hero);
  } else {
    window.addEventListener('scroll', sync, {passive:true});
    window.addEventListener('resize', sync);
  }
})();

(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){ document.documentElement.classList.add('no-gsap'); return; }
    var mm = gsap.matchMedia();
    mm.add({
      desktop:'(min-width:901px)',
      mobile:'(max-width:900px), (max-width:932px) and (max-height:560px) and (orientation:landscape)'
    }, function(ctx){
      var mob = ctx.conditions.mobile;
      var hero = document.querySelector('.hero-transition');
      var card = document.querySelector('.morph-card');
      var cardInner = document.querySelector('.mc-inner');
      if(!hero || !card || !cardInner) return;

      var tl = gsap.timeline({
        scrollTrigger:{
          trigger:hero,
          start:'top top',
          end:'bottom bottom',
          scrub:mob ? .62 : .42,
          invalidateOnRefresh:true
        }
      });

      var cardFrom = {
        y:0,
        yPercent:mob ? 80 : 72,
        rotateX:mob ? 12 : 16,
        rotateY:mob ? -14 : -20,
        rotationZ:mob ? -3 : 0,
        skewX:mob ? -2 : -6,
        scale:function(){
          var w0 = mob ? Math.min(330, window.innerWidth * .82)
                       : Math.min(430, window.innerWidth * .34);
          return w0 / window.innerWidth;
        },
        force3D:true,
        immediateRender:true
      };
      var cardTo = {
        y:0,yPercent:0,rotateX:0,rotateY:0,rotationZ:0,skewX:0,scale:1,
        duration:.72,ease:'none',force3D:true
      };
      if(!mob){
        cardFrom.borderRadius = 64;
        cardTo.borderRadius = 0;
      }

      /* Caméra : le texte s'éloigne pendant que la surface AWONE remonte,
         se redresse et absorbe progressivement tout le viewport. */
      tl.to('.ht-inner', {scale:.88,yPercent:mob?-9:-14,opacity:.04,duration:.3,ease:'none',force3D:true}, 0)
        .to('.ht-hint', {opacity:0,duration:.16,ease:'none'}, 0)
        .to('.ht-bg', {scale:1.045,duration:.72,ease:'none',force3D:true}, 0)
        .fromTo(card, cardFrom, cardTo, .04)
        .fromTo(cardInner,
          {scale:mob?1.32:2.3,yPercent:mob?12:0,force3D:true},
          {scale:1,yPercent:0,duration:.72,ease:'none',force3D:true}, .04)
        .to('.ht-dark', {opacity:1,duration:.4,ease:'none'}, .34)
        .fromTo('.mc-cap',
          {opacity:0,y:mob?14:20},
          {opacity:1,y:0,duration:.2,ease:'none',force3D:true}, .76);

      tl.to('.mc-logo', {opacity:1,scale:1.018,duration:.18,ease:'none',force3D:true}, .76);

      return function(){
        tl.scrollTrigger && tl.scrollTrigger.kill();
        tl.kill();
      };
    });

  window.addEventListener('load', function(){ ScrollTrigger.refresh(); });
})();

/* ── Chargement anticipé des fonctionnalités sous la ligne de flottaison.
     Chaque module arrive plusieurs écrans avant sa section : les interactions
     sont prêtes à temps sans alourdir le premier affichage. ── */
(function(){
  function loadNear(selector, importer, screens, fallback){
    var target = document.querySelector(selector);
    if(!target) return;

    var started = false;
    var observer = null;
    function start(){
      if(started) return;
      started = true;
      if(observer) observer.disconnect();
      importer()
        .catch(function(){
          if(typeof fallback === 'function') fallback(target);
        });
    }

    if(!('IntersectionObserver' in window)){
      start();
      return;
    }

    observer = new IntersectionObserver(function(entries){
      if(entries.some(function(entry){ return entry.isIntersecting; })) start();
    }, {
      rootMargin:Math.round(window.innerHeight * screens) + 'px 0px',
      threshold:0
    });
    observer.observe(target);
  }

  loadNear('#brands-track', function(){ return import('./brands-carousel.js'); }, 1.4);
  loadNear('#situationsCarousel', function(){ return import('./situations-carousel.js'); }, 2);
  loadNear('#tv', function(){ return import('./offer-video.js'); }, 1.8);
})();


/* ── Apparition unifiée : un seul mouvement court, sans filtre ni attente
     liée aux effets décoratifs. La classe temporaire est retirée après
     l'entrée afin que les hovers propres à chaque composant reprennent la
     main sans conflit de transform. ── */
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var compact = window.matchMedia('(max-width:768px), (pointer:coarse)').matches;
  var targets = [];
  var seen = new Set();

  function add(target, index, extraDelay){
    if(!target || seen.has(target)) return;
    seen.add(target);

    var explicit = parseInt(target.getAttribute('data-i'), 10);
    var order = Number.isFinite(explicit) ? explicit : (index || 0);
    var step = compact ? 30 : 42;
    var cap = compact ? 105 : 170;
    var delay = Math.min(order * step + (extraDelay || 0), cap);
    target.style.setProperty('--reveal-delay', delay + 'ms');
    target.classList.add('smooth-reveal');
    targets.push(target);
  }

  document.querySelectorAll('.reveal').forEach(function(target){ add(target, 0, 0); });
  document.querySelectorAll('.pole').forEach(function(target, index){ add(target, index, 0); });
  document.querySelectorAll('.why .boom').forEach(function(target, index){ add(target, index, 0); });
  document.querySelectorAll('.marquee').forEach(function(target){ add(target, 0, 0); });
  document.querySelectorAll('.situations-header > *').forEach(function(target, index){ add(target, index, 0); });
  document.querySelectorAll('.situations-carousel-wrapper').forEach(function(target){ add(target, 0, compact ? 60 : 84); });

  function reveal(target){
    target.classList.add('is-visible');
    if(target.classList.contains('reveal')) target.classList.add('visible');

    var cleaned = false;
    function cleanup(){
      if(cleaned) return;
      cleaned = true;
      target.classList.remove('smooth-reveal', 'is-visible');
      target.style.removeProperty('--reveal-delay');
    }
    target.addEventListener('transitionend', function(event){
      if(event.target === target && event.propertyName === 'transform') cleanup();
    }, {once:true});
    setTimeout(cleanup, compact ? 900 : 1050);
  }

  if(reduced || !('IntersectionObserver' in window)){
    targets.forEach(function(target){
      target.classList.add('visible');
      target.classList.remove('smooth-reveal');
      target.style.removeProperty('--reveal-delay');
    });
    return;
  }

  document.documentElement.classList.add('motion-ready');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        reveal(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, {threshold:.06, rootMargin:'0px 0px -8% 0px'});
  targets.forEach(function(target){ io.observe(target); });
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
  resolve();

  if('IntersectionObserver' in window){
    var tintRaf = 0;
    var observer = new IntersectionObserver(function(){
      cancelAnimationFrame(tintRaf);
      tintRaf = requestAnimationFrame(resolve);
    }, {threshold:0, rootMargin:'-47% 0px -47% 0px'});
    sections.forEach(function(section){ observer.observe(section); });
  } else {
    var raf = 0;
    window.addEventListener('scroll', function(){
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(resolve);
    }, {passive:true});
    window.addEventListener('resize', resolve);
  }
})();


/* ── CTA iClosed : popup uniquement, sans quitter la landing page ── */
(function(){
  var loading = false;
  var unavailable = false;
  var pendingTrigger = null;

  function loadIclosed(){
    if(window.__icwReady) return;
    if(loading || unavailable) return;
    loading = true;
    var s = document.createElement('script');
    s.src = 'https://app.iclosed.io/assets/widget.js';
    s.async = true;
    s.onload = function(){
      window.__icwReady = 1;
      if(pendingTrigger){
        var trigger = pendingTrigger;
        pendingTrigger = null;
        requestAnimationFrame(function(){ trigger.click(); });
      }
    };
    s.onerror = function(){
      loading = false;
      unavailable = true;
      if(pendingTrigger){
        var fallback = pendingTrigger.getAttribute('href') || pendingTrigger.dataset.iclosedLink;
        pendingTrigger = null;
        if(fallback) window.location.assign(fallback);
      }
    };
    document.head.appendChild(s);
  }

  document.querySelectorAll('[data-iclosed-link][data-embed-type="popup"]').forEach(function(trigger){
    trigger.addEventListener('pointerenter', loadIclosed, {once:true, passive:true});
    trigger.addEventListener('focus', loadIclosed, {once:true});
    trigger.addEventListener('click', function(event){
      /* Avec JS, le widget garde l'utilisateur sur la page. Sans JS ou si le
         fournisseur est indisponible, le href reste un vrai lien de secours. */
      if(unavailable) return;
      event.preventDefault();
      if(window.__icwReady) return;
      pendingTrigger = trigger;
      loadIclosed();
    });
  });

  /* Le widget injecte plusieurs iframes (paiement, captcha, calendrier).
     Il n'est chargé qu'à l'approche du contact ou à l'intention explicite
     d'ouvrir un CTA, afin qu'il ne concurrence jamais le récit au scroll. */
  var contact = document.getElementById('contact');
  if(contact && 'IntersectionObserver' in window){
    var preload = new IntersectionObserver(function(entries){
      if(entries.some(function(entry){ return entry.isIntersecting; })){
        preload.disconnect();
        loadIclosed();
      }
    }, {rootMargin:'800px 0px', threshold:0});
    preload.observe(contact);
  }
})();



/* ── Menu burger ── */
(function(){
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  if(!burger) return;
  function close(){
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded','false');
    if(window.__awoneLenis) window.__awoneLenis.start();
  }
  burger.addEventListener('click', function(){
    var open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    if(window.__awoneLenis){
      if(open) window.__awoneLenis.stop(); else window.__awoneLenis.start();
    }
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
