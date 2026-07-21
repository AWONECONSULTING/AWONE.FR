/* ── Animations GSAP (bundle local : fonctionne aussi hors-ligne) ── */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ignoreMobileResize:true});

/* ── Défilement principal : Lenis alimente le même ticker que GSAP.
     Les deux carrousels horizontaux restent gérés nativement. ── */
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return;

  var coarsePointer = window.matchMedia('(pointer:coarse)').matches;
  var isIOS = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var iosVersion = navigator.userAgent.match(/OS (\d+)_/) || navigator.userAgent.match(/Version\/(\d+)/);
  var legacyIOS = Boolean(isIOS && iosVersion && parseInt(iosVersion[1], 10) < 16);

  var lenis = new Lenis({
    lerp:.09,
    smoothWheel:true,
    syncTouch:coarsePointer && !legacyIOS,
    syncTouchLerp:.085,
    touchInertiaExponent:1.6,
    touchMultiplier:1,
    wheelMultiplier:.95,
    anchors:{offset:-72},
    stopInertiaOnNavigate:true,
    prevent:function(node){
      if(!(node instanceof Element)) return false;
      if(node.closest('.brands-track,.situations-carousel')) return true;
      var methodReel = node.closest('.method-steps');
      if(!methodReel) return false;
      var methodOverflow = getComputedStyle(methodReel).overflowY;
      return /auto|scroll/.test(methodOverflow) && methodReel.scrollHeight > methodReel.clientHeight + 1;
    }
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
  window.__awoneLenis = lenis;
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

      if(mob){
        tl.to('.mc-logo', {opacity:1,scale:1.018,duration:.18,ease:'none',force3D:true}, .76);
      } else {
        tl.to('.mc-logo', {filter:'drop-shadow(0 6px 30px rgba(199,177,255,.6))',duration:.18,ease:'none'}, .76);
      }

      return function(){
        tl.scrollTrigger && tl.scrollTrigger.kill();
        tl.kill();
      };
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
  window.addEventListener('load', function(){ ScrollTrigger.refresh(); });
})();

/* ── Immersive / Motion : séquence WebP pilotée au scroll sur canvas.
     Les fichiers sont préchargés sous forme compressée ; seules les frames
     proches de la position courante sont décodées et gardées en mémoire. ── */
(function(){
  var section = document.querySelector('.immersive-sequence');
  if(!section) return;

  var stage = section.querySelector('.immersive-stage');
  var canvas = section.querySelector('.immersive-canvas');
  var copy = section.querySelector('.immersive-copy');
  var hint = section.querySelector('.immersive-hint');
  var loader = section.querySelector('.immersive-loader');
  var loaderLabel = section.querySelector('.immersive-loader-label');
  var loaderBar = section.querySelector('.immersive-loader-track i');
  var loaderValue = section.querySelector('.immersive-loader-value');
  var transitionWash = section.querySelector('.immersive-transition-wash');
  var exitScene = section.querySelector('.immersive-exit');
  var spinnerLogo = section.querySelector('.immersive-spinner-logo');
  var exitLabel = section.querySelector('.immersive-exit-label');
  var context = canvas && canvas.getContext('2d', {alpha:false, desynchronized:true});
  if(!stage || !canvas || !context) return;

  var mobile = window.matchMedia('(max-width:760px), (max-width:932px) and (max-height:560px) and (orientation:landscape)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = Boolean(navigator.connection && navigator.connection.saveData);
  var staticMode = reduced || saveData;
  var frameCount = parseInt(section.dataset[mobile ? 'mobileFrames' : 'desktopFrames'], 10);
  var frameRoot = section.dataset.frameRoot + '/' + (mobile ? 'mobile' : 'desktop');
  var cacheLimit = mobile ? 10 : 12;
  var decodeLimit = mobile ? 2 : 3;

  var blobs = new Array(frameCount);
  var fetches = new Array(frameCount);
  var decoded = new Map();
  var decodePromises = new Map();
  var decodeQueue = [];
  var activeDecodes = 0;
  var completed = 0;
  var desired = staticMode ? Math.round((frameCount - 1) * .5) : 0;
  var rendered = -1;
  var direction = 1;
  var prefetchStarted = false;
  var drawRaf = 0;
  var resizeRaf = 0;

  function clamp(index){ return Math.max(0, Math.min(frameCount - 1, index)); }
  function frameUrl(index){
    return frameRoot + '/frame_' + String(index + 1).padStart(4, '0') + '.webp';
  }

  function setProgress(value){
    var progress = Math.max(0, Math.min(1, value));
    loaderBar.style.transform = 'scaleX(' + progress + ')';
    loaderValue.textContent = Math.round(progress * 100) + '%';
  }

  function finishRequest(){
    completed++;
    setProgress(completed / frameCount);
    if(completed >= frameCount){
      section.classList.add('is-loaded');
      loader.setAttribute('aria-label', 'Expérience immersive chargée');
    }
  }

  function fetchFrame(index){
    index = clamp(index);
    if(blobs[index]) return Promise.resolve(blobs[index]);
    if(fetches[index]) return fetches[index];

    fetches[index] = fetch(frameUrl(index), {cache:'force-cache'})
      .then(function(response){
        if(!response.ok) throw new Error('Frame ' + (index + 1) + ' indisponible');
        return response.blob();
      })
      .then(function(blob){ blobs[index] = blob; return blob; })
      .catch(function(){ return null; })
      .finally(finishRequest);
    return fetches[index];
  }

  function drawableFromBlob(blob){
    if('createImageBitmap' in window) return createImageBitmap(blob);
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(blob);
      var image = new Image();
      image.decoding = 'async';
      image.onload = function(){ URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('Décodage impossible')); };
      image.src = url;
    });
  }

  function closeDrawable(drawable){
    if(drawable && typeof drawable.close === 'function') drawable.close();
  }

  function trimDecoded(){
    while(decoded.size > cacheLimit){
      var victim = -1;
      var farthest = -1;
      decoded.forEach(function(drawable, index){
        var distance = Math.abs(index - desired);
        if(index !== rendered && index !== desired && distance > farthest){
          victim = index;
          farthest = distance;
        }
      });
      if(victim < 0) break;
      closeDrawable(decoded.get(victim));
      decoded.delete(victim);
    }
  }

  function storeDrawable(index, drawable){
    if(!drawable) return;
    if(decoded.has(index)) closeDrawable(decoded.get(index));
    decoded.set(index, drawable);
    trimDecoded();
    section.classList.add('is-ready');
    if(staticMode){
      setProgress(1);
      section.classList.add('is-loaded');
      loader.setAttribute('aria-label', 'Expérience immersive chargée');
    }
    scheduleDraw();
  }

  function pumpDecodeQueue(){
    while(activeDecodes < decodeLimit && decodeQueue.length){
      (function(job){
        activeDecodes++;
        fetchFrame(job.index)
          .then(function(blob){ return blob ? drawableFromBlob(blob) : null; })
          .then(function(drawable){
            if(drawable) storeDrawable(job.index, drawable);
            job.resolve(drawable);
          })
          .catch(function(){ job.resolve(null); })
          .finally(function(){
            activeDecodes--;
            decodePromises.delete(job.index);
            pumpDecodeQueue();
          });
      })(decodeQueue.shift());
    }
  }

  function queueDecode(index, priority){
    index = clamp(index);
    if(decoded.has(index)) return Promise.resolve(decoded.get(index));
    if(decodePromises.has(index)) return decodePromises.get(index);

    var resolveJob;
    var promise = new Promise(function(resolve){ resolveJob = resolve; });
    decodePromises.set(index, promise);
    var job = {index:index, resolve:resolveJob};
    if(priority) decodeQueue.unshift(job); else decodeQueue.push(job);
    pumpDecodeQueue();
    return promise;
  }

  function drawableWidth(drawable){ return drawable.naturalWidth || drawable.width; }
  function drawableHeight(drawable){ return drawable.naturalHeight || drawable.height; }

  function draw(index, drawable){
    if(!drawable || !canvas.width || !canvas.height) return;
    var sourceWidth = drawableWidth(drawable);
    var sourceHeight = drawableHeight(drawable);
    if(!sourceWidth || !sourceHeight) return;

    var scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
    var width = sourceWidth * scale;
    var height = sourceHeight * scale;
    context.fillStyle = '#0A0A0A';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(drawable, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    rendered = index;
    canvas.dataset.frame = String(index + 1);
  }

  function nearestDecoded(){
    if(decoded.has(desired)) return desired;
    var best = -1;
    var distance = Infinity;
    decoded.forEach(function(drawable, index){
      var delta = Math.abs(index - desired);
      if(delta < distance){ distance = delta; best = index; }
    });
    return best;
  }

  function scheduleDraw(){
    if(drawRaf) return;
    drawRaf = requestAnimationFrame(function(){
      drawRaf = 0;
      var index = nearestDecoded();
      if(index >= 0 && (index !== rendered || canvas.dataset.resized === 'true')){
        canvas.dataset.resized = 'false';
        draw(index, decoded.get(index));
      }
    });
  }

  function decodeAround(index){
    queueDecode(index, true);
    var offsets = direction >= 0 ? [1,2,3,-1,-2,4] : [-1,-2,-3,1,2,-4];
    offsets.forEach(function(offset){
      var neighbour = index + offset;
      if(neighbour >= 0 && neighbour < frameCount) queueDecode(neighbour, false);
    });
  }

  function requestFrame(index){
    index = clamp(Math.round(index));
    if(index !== desired) direction = index > desired ? 1 : -1;
    desired = index;
    if(!prefetchStarted) return;
    decodeAround(index);
    scheduleDraw();
  }

  function resize(){
    var width = Math.max(1, stage.clientWidth);
    var height = Math.max(1, stage.clientHeight);
    var dpr = mobile ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    var nextWidth = Math.round(width * dpr);
    var nextHeight = Math.round(height * dpr);
    if(canvas.width !== nextWidth || canvas.height !== nextHeight){
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      canvas.dataset.resized = 'true';
      scheduleDraw();
    }
  }

  function preloadOrder(){
    var order = [];
    var seen = new Set();
    function add(index){
      index = clamp(index);
      if(!seen.has(index)){ seen.add(index); order.push(index); }
    }
    for(var i = 0; i < Math.min(frameCount, mobile ? 16 : 24); i++) add(i);
    add(frameCount - 1);
    add(Math.round((frameCount - 1) * .5));
    add(Math.round((frameCount - 1) * .25));
    add(Math.round((frameCount - 1) * .75));
    for(var j = 0; j < frameCount; j++) add(j);
    return order;
  }

  function startPreload(){
    if(prefetchStarted) return;
    prefetchStarted = true;
    section.classList.add('is-loading');

    if(staticMode){
      queueDecode(desired, true);
      return;
    }

    var order = preloadOrder();
    var cursor = 0;
    var workers = mobile ? 4 : 6;
    function worker(){
      if(cursor >= order.length) return Promise.resolve();
      var index = order[cursor++];
      return fetchFrame(index).then(worker);
    }
    for(var i = 0; i < workers; i++) worker();
    decodeAround(desired);
  }

  resize();
  window.addEventListener('resize', function(){
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resize);
  });

  if(staticMode){
    section.classList.add('is-static');
    loaderLabel.textContent = reduced ? 'Image fixe · mouvement réduit' : 'Image fixe · économie de données';
    startPreload();
    return;
  }

  if('IntersectionObserver' in window){
    var warmup = new IntersectionObserver(function(entries){
      if(entries.some(function(entry){ return entry.isIntersecting; })){
        startPreload();
        warmup.disconnect();
      }
    }, {rootMargin:Math.round(window.innerHeight * 1.75) + 'px 0px'});
    warmup.observe(section);
  } else {
    startPreload();
  }

  var playhead = {frame:0};
  var scrollDistance = function(){ return Math.round(window.innerHeight * (mobile ? 2.4 : 3.2)); };
  function setImmersiveActive(active){
    document.body.classList.toggle('immersive-active', active);
    if(active) startPreload();
  }
  gsap.to(playhead, {
    frame:frameCount - 1,
    ease:'none',
    snap:'frame',
    onUpdate:function(){ requestFrame(playhead.frame); },
    scrollTrigger:{
      trigger:section,
      start:'top top',
      end:function(){ return '+=' + scrollDistance(); },
      pin:true,
      pinSpacing:true,
      scrub:mobile ? .55 : .65,
      anticipatePin:1,
      invalidateOnRefresh:true,
      onToggle:function(self){
        if(self.isActive) startPreload();
      }
    }
  });

  /* Le CTA flottant s'efface dès que la scène entre dans le viewport,
     y compris au pixel exact qui précède le début du pin. */
  ScrollTrigger.create({
    trigger:section,
    start:'top bottom',
    end:function(){ return '+=' + (window.innerHeight + scrollDistance()); },
    invalidateOnRefresh:true,
    onToggle:function(self){ setImmersiveActive(self.isActive); }
  });

  gsap.to([copy, hint], {
    opacity:0,
    y:-34,
    ease:'none',
    scrollTrigger:{
      trigger:section,
      start:'top top',
      end:function(){ return '+=' + Math.round(window.innerHeight * .72); },
      scrub:.45,
      invalidateOnRefresh:true
    }
  });

  if(transitionWash && exitScene && spinnerLogo && exitLabel){
    var exitTimeline = gsap.timeline({
      scrollTrigger:{
        trigger:section,
        start:'top top',
        end:function(){ return '+=' + scrollDistance(); },
        scrub:mobile ? .5 : .65,
        invalidateOnRefresh:true
      }
    });
    exitTimeline
      .fromTo(transitionWash,
        {opacity:0},
        {opacity:1,duration:.31,ease:'power1.inOut'}, .69)
      .fromTo(exitScene,
        {opacity:0,y:mobile?62:86,scale:.78},
        {opacity:1,y:0,scale:1,duration:.25,ease:'power2.out'}, .73)
      .fromTo(spinnerLogo,
        {rotationY:-900,rotationZ:-8,scale:.58},
        {rotationY:0,rotationZ:0,scale:1,duration:.26,ease:'power2.out',force3D:true}, .72)
      .fromTo(exitLabel,
        {opacity:0,y:14,letterSpacing:'.38em'},
        {opacity:1,y:0,letterSpacing:'.24em',duration:.2,ease:'power2.out'}, .8);
  }
})();

/* ── Méthode mobile : rail vertical infini à focus central.
     Le geste reste natif ; les commandes et le clavier utilisent le même
     mouvement amorti. Les copies de boucle sont masquées aux technologies
     d'assistance, qui ne parcourent que les cinq étapes originales. ── */
(function(){
  var section = document.getElementById('methode');
  var reel = document.getElementById('methodReel');
  if(!section || !reel) return;

  var mobileQuery = window.matchMedia('(max-width:900px), (max-width:932px) and (max-height:560px) and (orientation:landscape)');

  var originals = Array.prototype.slice.call(reel.querySelectorAll('.step'));
  var count = originals.length;
  if(!count) return;

  var previous = section.querySelector('.method-reel-prev');
  var next = section.querySelector('.method-reel-next');
  var indexes = Array.prototype.slice.call(section.querySelectorAll('[data-method-index]'));
  var status = section.querySelector('.method-reel-status');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function prepareOriginal(card, index){
    card.dataset.methodLogical = String(index);
  }

  function makeClone(card){
    var clone = card.cloneNode(true);
    clone.classList.remove('reveal', 'visible', 'is-active', 'is-expanded');
    clone.removeAttribute('data-i');
    clone.setAttribute('data-method-clone', '');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.querySelectorAll('[id]').forEach(function(node){ node.removeAttribute('id'); });
    clone.querySelectorAll('[aria-controls]').forEach(function(node){ node.removeAttribute('aria-controls'); });
    clone.querySelectorAll('button').forEach(function(button){ button.setAttribute('tabindex', '-1'); });
    return clone;
  }

  originals.forEach(prepareOriginal);
  var before = document.createDocumentFragment();
  var after = document.createDocumentFragment();
  originals.forEach(function(card){
    before.appendChild(makeClone(card));
    after.appendChild(makeClone(card));
  });
  reel.insertBefore(before, reel.firstChild);
  reel.appendChild(after);

  var cards = Array.prototype.slice.call(reel.querySelectorAll('.step'));
  var cardCenters = [];
  var setHeight = 0;
  var currentPhysical = -1;
  var currentLogical = -1;
  var focusRaf = 0;
  var resizeTimer = 0;
  var idleTimer = 0;
  var controlled = false;

  section.classList.add('method-carousel-ready');

  function center(card){ return card.offsetTop + card.offsetHeight / 2; }
  function targetFor(card){ return center(card) - reel.clientHeight / 2; }

  function closestPhysical(){
    var midpoint = reel.scrollTop + reel.clientHeight / 2;
    var best = 0;
    var distance = Infinity;
    for(var i = 0; i < cards.length; i++){
      var delta = Math.abs(cardCenters[i] - midpoint);
      if(delta < distance){ distance = delta; best = i; }
    }
    return best;
  }

  function measure(){
    cardCenters = cards.map(center);
    setHeight = cardCenters[count] - cardCenters[0];
  }

  function syncControls(card, active){
    if(card.hasAttribute('data-method-clone')) return;
    var expanded = card.classList.contains('is-expanded');
    var more = card.querySelector('.method-more');
    var back = card.querySelector('.method-back');
    if(more) more.tabIndex = mobileQuery.matches && active && !expanded ? 0 : -1;
    if(back) back.tabIndex = mobileQuery.matches && active && expanded ? 0 : -1;
  }

  function collapse(card){
    if(!card || !card.classList.contains('is-expanded')) return;
    card.classList.remove('is-expanded');
    var more = card.querySelector('.method-more');
    var front = card.querySelector('.step-front');
    var detail = card.querySelector('.step-detail');
    if(more) more.setAttribute('aria-expanded', 'false');
    if(front) front.setAttribute('aria-hidden', 'false');
    if(detail) detail.setAttribute('aria-hidden', 'true');
    syncControls(card, card.classList.contains('is-active'));
  }

  function syncAccessibility(){
    originals.forEach(function(card){
      var front = card.querySelector('.step-front');
      var detail = card.querySelector('.step-detail');
      if(mobileQuery.matches){
        if(front) front.setAttribute('aria-hidden', String(card.classList.contains('is-expanded')));
        if(detail) detail.setAttribute('aria-hidden', String(!card.classList.contains('is-expanded')));
      } else {
        card.classList.remove('is-expanded', 'is-active');
        card.removeAttribute('aria-current');
        if(front) front.removeAttribute('aria-hidden');
        if(detail) detail.removeAttribute('aria-hidden');
        var more = card.querySelector('.method-more');
        if(more) more.setAttribute('aria-expanded', 'false');
      }
      syncControls(card, false);
    });
  }

  function updateIndicators(logical){
    if(logical === currentLogical) return;
    currentLogical = logical;
    indexes.forEach(function(button, index){
      var active = index === logical;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    originals.forEach(function(card, index){
      if(index === logical) card.setAttribute('aria-current', 'step');
      else card.removeAttribute('aria-current');
    });
    var title = originals[logical] && originals[logical].dataset.methodTitle;
    if(status) status.textContent = 'Étape ' + (logical + 1) + ' sur ' + count + ' · ' + title;
  }

  function updateFocus(){
    focusRaf = 0;
    if(!mobileQuery.matches) return;
    var midpoint = reel.scrollTop + reel.clientHeight / 2;
    var stride = Math.max(1, cardCenters[count + 1] - cardCenters[count]);
    var nearest = 0;
    var nearestDistance = Infinity;

    cards.forEach(function(card, index){
      var distance = Math.abs(cardCenters[index] - midpoint);
      var ratio = Math.min(1, distance / stride);
      var focus = 1 - ratio;
      card.style.setProperty('--method-scale', (.86 + focus * .14).toFixed(3));
      card.style.setProperty('--method-opacity', (.32 + focus * .68).toFixed(3));
      card.style.setProperty('--method-blur', (ratio * 1.35).toFixed(2) + 'px');
      card.style.setProperty('--method-saturation', (.72 + focus * .28).toFixed(3));
      if(distance < nearestDistance){ nearestDistance = distance; nearest = index; }
    });

    if(nearest !== currentPhysical){
      currentPhysical = nearest;
      cards.forEach(function(card, index){
        var active = index === nearest;
        card.classList.toggle('is-active', active);
        if(!active) collapse(card);
        syncControls(card, active);
      });
      updateIndicators(parseInt(cards[nearest].dataset.methodLogical, 10));
    }
  }

  function scheduleFocus(){
    if(!focusRaf) focusRaf = requestAnimationFrame(updateFocus);
  }

  function loopFix(){
    if(!mobileQuery.matches || controlled || !setHeight) return false;
    var index = closestPhysical();
    var shift = 0;
    if(index < count) shift = setHeight;
    else if(index >= count * 2) shift = -setHeight;
    if(!shift) return false;

    reel.classList.add('is-jumping');
    reel.scrollTop += shift;
    requestAnimationFrame(function(){ reel.classList.remove('is-jumping'); scheduleFocus(); });
    return true;
  }

  function animateToPhysical(index){
    if(!mobileQuery.matches) return;
    index = Math.max(0, Math.min(cards.length - 1, index));
    gsap.killTweensOf(reel);
    controlled = true;
    reel.classList.add('is-controlled');
    if(reduced){
      reel.scrollTop = targetFor(cards[index]);
      controlled = false;
      reel.classList.remove('is-controlled');
      loopFix();
      scheduleFocus();
      return;
    }
    gsap.to(reel, {
      scrollTop:targetFor(cards[index]),
      duration:.68,
      ease:'power3.out',
      overwrite:true,
      onUpdate:scheduleFocus,
      onComplete:function(){
        controlled = false;
        reel.classList.remove('is-controlled');
        loopFix();
        scheduleFocus();
      }
    });
  }

  function goBy(delta){
    if(!mobileQuery.matches || !setHeight) return;
    loopFix();
    var current = closestPhysical();
    animateToPhysical(current + delta);
  }

  function goToLogical(logical){
    if(!mobileQuery.matches) return;
    var forward = (logical - currentLogical + count) % count;
    var delta = forward > count / 2 ? forward - count : forward;
    if(delta) goBy(delta);
  }

  reel.addEventListener('scroll', function(){
    scheduleFocus();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function(){
      if(!controlled){ loopFix(); scheduleFocus(); }
    }, 120);
  }, {passive:true});

  reel.addEventListener('pointerdown', function(){
    if(!mobileQuery.matches) return;
    gsap.killTweensOf(reel);
    controlled = false;
    reel.classList.remove('is-controlled');
  }, {passive:true});

  reel.addEventListener('keydown', function(event){
    if(!mobileQuery.matches) return;
    if(event.key === 'ArrowUp'){
      event.preventDefault();
      goBy(-1);
    } else if(event.key === 'ArrowDown'){
      event.preventDefault();
      goBy(1);
    } else if(event.key === 'Home'){
      event.preventDefault();
      goToLogical(0);
    } else if(event.key === 'End'){
      event.preventDefault();
      goToLogical(count - 1);
    }
  });

  reel.addEventListener('click', function(event){
    if(!mobileQuery.matches) return;
    var more = event.target.closest('.method-more');
    var back = event.target.closest('.method-back');
    var card = event.target.closest('.step');
    if(!card || card.hasAttribute('data-method-clone') || !card.classList.contains('is-active')) return;

    if(more){
      card.classList.add('is-expanded');
      more.setAttribute('aria-expanded', 'true');
      card.querySelector('.step-front').setAttribute('aria-hidden', 'true');
      card.querySelector('.step-detail').setAttribute('aria-hidden', 'false');
      var backButton = card.querySelector('.method-back');
      syncControls(card, true);
      if(backButton) requestAnimationFrame(function(){ backButton.focus({preventScroll:true}); });
    } else if(back){
      collapse(card);
      var moreButton = card.querySelector('.method-more');
      if(moreButton) requestAnimationFrame(function(){ moreButton.focus({preventScroll:true}); });
    }
  });

  if(previous) previous.addEventListener('click', function(){ goBy(-1); });
  if(next) next.addEventListener('click', function(){ goBy(1); });
  indexes.forEach(function(button){
    button.addEventListener('click', function(){ goToLogical(parseInt(button.dataset.methodIndex, 10)); });
  });

  var visibility = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      document.body.classList.toggle('method-carousel-active', mobileQuery.matches && entry.isIntersecting);
    });
  }, {rootMargin:'-12% 0px -12% 0px', threshold:0});
  visibility.observe(section);

  function initialise(){
    syncAccessibility();
    if(!mobileQuery.matches){
      gsap.killTweensOf(reel);
      controlled = false;
      reel.classList.remove('is-controlled', 'is-jumping');
      currentPhysical = -1;
      currentLogical = -1;
      reel.scrollTop = 0;
      document.body.classList.remove('method-carousel-active');
      return;
    }
    var sectionRect = section.getBoundingClientRect();
    document.body.classList.toggle('method-carousel-active', sectionRect.bottom > window.innerHeight * .12 && sectionRect.top < window.innerHeight * .88);
    measure();
    reel.classList.add('is-jumping');
    reel.scrollTop = targetFor(cards[count]);
    requestAnimationFrame(function(){
      reel.classList.remove('is-jumping');
      updateFocus();
    });
  }

  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      if(!mobileQuery.matches){
        initialise();
        return;
      }
      measure();
      reel.classList.add('is-jumping');
      reel.scrollTop = targetFor(cards[count + Math.max(0, currentLogical)]);
      requestAnimationFrame(function(){
        reel.classList.remove('is-jumping');
        scheduleFocus();
      });
    }, 160);
  });

  if(typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', initialise);

  if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ requestAnimationFrame(initialise); });
  else requestAnimationFrame(initialise);
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

/* ── Situations : carrousel infini façon Apple TV — le trackpad et le
     tactile gardent leur inertie native ; la souris utilise un ressort
     amorti, indépendant du taux de rafraîchissement de l'écran. ── */
(function(){
  var c = document.getElementById('situationsCarousel');
  if(!c) return;
  var originals = Array.prototype.slice.call(c.querySelectorAll('.situation-card'));
  var N = originals.length;
  if(!N) return;

  var before = document.createDocumentFragment();
  var after = document.createDocumentFragment();
  function makeClone(card){
    var clone = card.cloneNode(true);

    /* GSAP peut poser un etat d'entree inline avant l'initialisation. */
    clone.removeAttribute('style');
    clone.classList.remove('is-active');
    clone.removeAttribute('aria-current');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.setAttribute('data-carousel-clone', '');
    return clone;
  }
  originals.forEach(function(card){
    before.appendChild(makeClone(card));
    after.appendChild(makeClone(card));
  });
  c.insertBefore(before, c.firstChild);
  c.appendChild(after);

  var cards = Array.prototype.slice.call(c.querySelectorAll('.situation-card'));
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var setW = 0, current = -1, focusRaf = 0, idle = 0, resizeIdle = 0;
  var motionRaf = 0, dragRaf = 0, settling = false;
  var down = false, pointerId = null, moved = false;
  var startX = 0, startScroll = 0, dragTarget = 0;
  var lastX = 0, lastT = 0, pointerVelocity = 0;

  function center(el){ return el.offsetLeft + el.offsetWidth / 2; }
  function targetFor(i){ return center(cards[i]) - c.clientWidth / 2; }
  function measure(){ setW = center(cards[N]) - center(cards[0]); }

  function closestIndex(scrollPosition){
    var mid = scrollPosition + c.clientWidth / 2;
    var best = 0, dist = Infinity;
    for(var i = 0; i < cards.length; i++){
      var d = Math.abs(center(cards[i]) - mid);
      if(d < dist){ dist = d; best = i; }
    }
    return best;
  }

  function focusClosest(){
    var best = closestIndex(c.scrollLeft);
    if(best === current) return best;

    if(current >= 0){
      cards[current].classList.remove('is-active');
      if(!cards[current].hasAttribute('aria-hidden')) cards[current].setAttribute('aria-current', 'false');
    }
    cards[best].classList.add('is-active');
    if(!cards[best].hasAttribute('aria-hidden')) cards[best].setAttribute('aria-current', 'true');
    current = best;
    return best;
  }

  /* Les copies exterieures donnent une grande zone d'elan. Le saut vers la
     copie centrale n'a lieu qu'une fois le geste fini (ou pres d'un bord),
     afin de ne jamais casser l'inertie native. */
  function loopFix(force){
    var best = focusClosest();
    if(!setW) return 0;

    var shift = 0;
    if((force && best < N) || (!force && best <= 1)) shift = setW;
    if((force && best >= 2 * N) || (!force && best >= cards.length - 2)) shift = -setW;
    if(!shift) return 0;

    var controlled = c.classList.contains('is-controlled');
    if(!controlled) c.classList.add('is-jumping');
    c.scrollLeft += shift;

    /* Correctif essentiel : le repere du drag suit lui aussi le saut de
       boucle. Sans cela, l'evenement suivant ramenait le rail en arriere. */
    if(down){
      startScroll += shift;
      dragTarget += shift;
    }
    focusClosest();
    if(!controlled){
      requestAnimationFrame(function(){ c.classList.remove('is-jumping'); });
    }
    return shift;
  }

  function stopMotion(){
    cancelAnimationFrame(motionRaf);
    motionRaf = 0;
    settling = false;
    c.classList.remove('is-controlled');
  }

  /* Ressort critique : même sensation sur un écran 60, 90 ou 120 Hz. */
  function springTo(target, initialVelocity){
    stopMotion();
    clearTimeout(idle);

    if(reduced){
      c.classList.add('is-jumping');
      c.scrollLeft = target;
      loopFix(true);
      focusClosest();
      requestAnimationFrame(function(){ c.classList.remove('is-jumping', 'is-scrolling'); });
      return;
    }

    var position = c.scrollLeft;
    var velocity = Math.max(-2400, Math.min(2400, initialVelocity || 0));
    var previous = performance.now();
    settling = true;
    c.classList.add('is-controlled', 'is-scrolling');

    function tick(now){
      if(!settling) return;
      var elapsed = Math.min((now - previous) / 1000, .034);
      previous = now;

      /* Sous-pas courts : le ressort reste stable même après une image lente. */
      var steps = Math.max(1, Math.ceil(elapsed / .008));
      var dt = elapsed / steps;
      for(var i = 0; i < steps; i++){
        var acceleration = (target - position) * 185 - velocity * 27;
        velocity += acceleration * dt;
        position += velocity * dt;
      }

      c.scrollLeft = position;
      var shift = loopFix(false);
      if(shift){ position += shift; target += shift; }
      focusClosest();

      if(Math.abs(target - position) < .45 && Math.abs(velocity) < 5){
        c.scrollLeft = target;
        settling = false;
        motionRaf = 0;
        loopFix(true);
        focusClosest();
        c.classList.remove('is-controlled', 'is-scrolling');
        return;
      }
      motionRaf = requestAnimationFrame(tick);
    }
    motionRaf = requestAnimationFrame(tick);
  }

  function settle(initialVelocity, projectedPosition){
    if(down || settling) return;
    var position = typeof projectedPosition === 'number' ? projectedPosition : c.scrollLeft;
    var best = closestIndex(position);
    var target = targetFor(best);
    if(Math.abs(c.scrollLeft - target) < .75 && Math.abs(initialVelocity || 0) < 5){
      c.scrollLeft = target;
      loopFix(true);
      focusClosest();
      c.classList.remove('is-scrolling');
      return;
    }
    springTo(target, initialVelocity || 0);
  }

  function step(direction){
    stopMotion();
    loopFix(true);
    var best = focusClosest();
    springTo(targetFor(best + direction), 0);
  }

  function paintDrag(){
    dragRaf = 0;
    if(!down) return;
    c.scrollLeft = dragTarget;
    loopFix(false);
    focusClosest();
  }

  c.addEventListener('scroll', function(){
    c.classList.add('is-scrolling');
    cancelAnimationFrame(focusRaf);
    focusRaf = requestAnimationFrame(focusClosest);
    if(down || settling || c.classList.contains('is-jumping')) return;
    clearTimeout(idle);
    idle = setTimeout(function(){ settle(0); }, 190);
  }, {passive:true});

  /* Ne pas intercepter la molette : macOS, Windows et les trackpads gardent
     ainsi leur courbe d'acceleration et leur inertie natives. */
  c.addEventListener('wheel', function(e){
    if(Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    stopMotion();
    clearTimeout(idle);
  }, {passive:true});

  c.addEventListener('keydown', function(e){
    if(e.key === 'ArrowRight'){ e.preventDefault(); step(1); }
    if(e.key === 'ArrowLeft'){ e.preventDefault(); step(-1); }
  });

  c.addEventListener('pointerdown', function(e){
    stopMotion();
    clearTimeout(idle);

    /* Au doigt et au stylet, le navigateur fournit la meilleure inertie. */
    if(e.pointerType !== 'mouse' || e.button !== 0) return;

    down = true;
    pointerId = e.pointerId;
    moved = false;
    startX = lastX = e.clientX;
    startScroll = dragTarget = c.scrollLeft;
    lastT = performance.now();
    pointerVelocity = 0;
    c.classList.add('dragging', 'is-controlled');
    if(c.setPointerCapture) c.setPointerCapture(pointerId);
  });

  c.addEventListener('pointermove', function(e){
    if(!down || e.pointerId !== pointerId) return;
    var distance = e.clientX - startX;
    if(Math.abs(distance) > 4) moved = true;
    dragTarget = startScroll - distance;

    var now = performance.now();
    var dt = now - lastT;
    if(dt > 0 && dt < 80){
      var instantVelocity = (e.clientX - lastX) / dt;
      pointerVelocity = pointerVelocity * .65 + instantVelocity * .35;
    }
    lastX = e.clientX;
    lastT = now;

    if(!dragRaf) dragRaf = requestAnimationFrame(paintDrag);
    if(moved) e.preventDefault();
  });

  function endDrag(e, cancelled){
    if(!down || (e && e.pointerId !== pointerId)) return;
    if(dragRaf){ cancelAnimationFrame(dragRaf); paintDrag(); }

    down = false;
    c.classList.remove('dragging', 'is-controlled');
    if(c.releasePointerCapture && e && c.hasPointerCapture && c.hasPointerCapture(pointerId)){
      c.releasePointerCapture(pointerId);
    }
    pointerId = null;

    if(!moved){
      c.classList.remove('is-scrolling');
      return;
    }

    if(cancelled || performance.now() - lastT > 90) pointerVelocity = 0;
    var scrollVelocity = Math.max(-2400, Math.min(2400, -pointerVelocity * 1000));
    /* Projection courte : un geste franc avance naturellement d'une ou deux
       cartes, puis le ressort attire la carte la plus proche au centre. */
    settle(scrollVelocity, c.scrollLeft + scrollVelocity * .18);
  }
  c.addEventListener('pointerup', function(e){ endDrag(e, false); });
  c.addEventListener('pointercancel', function(e){ endDrag(e, true); });

  function jumpToLogical(logicalIndex){
    stopMotion();
    measure();
    c.classList.add('is-jumping');
    c.scrollLeft = targetFor(N + logicalIndex);
    focusClosest();
    requestAnimationFrame(function(){ c.classList.remove('is-jumping', 'is-scrolling'); });
  }

  requestAnimationFrame(function(){ jumpToLogical(0); });
  window.addEventListener('resize', function(){
    clearTimeout(resizeIdle);
    resizeIdle = setTimeout(function(){
      var logical = current < 0 ? 0 : ((current % N) + N) % N;
      jumpToLogical(logical);
    }, 160);
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

/* ── CTA iClosed : popup uniquement, sans quitter la landing page ── */
(function(){
  var loading = false;
  var pendingTrigger = null;

  function loadIclosed(){
    if(window.__icwReady) return;
    if(loading) return;
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
      pendingTrigger = null;
    };
    document.head.appendChild(s);
  }

  document.querySelectorAll('[data-iclosed-link][data-embed-type="popup"]').forEach(function(trigger){
    trigger.removeAttribute('href');
    trigger.removeAttribute('target');
    trigger.removeAttribute('rel');
    trigger.addEventListener('click', function(){
      if(window.__icwReady) return;
      pendingTrigger = trigger;
      loadIclosed();
    });
  });

  loadIclosed();
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
