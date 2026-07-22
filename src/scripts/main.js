/* ── Animations GSAP (bundle local : fonctionne aussi hors-ligne) ── */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ignoreMobileResize:true});

/* ── Défilement principal : l'inertie Lenis reste réservée aux appareils
     de bureau précis. Le tactile conserve son scroll natif, plus stable et
     moins coûteux que la synchronisation artificielle de chaque geste. ── */
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var precisePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(reduced || !precisePointer) return;

  var lenis = new Lenis({
    lerp:.09,
    smoothWheel:true,
    syncTouch:false,
    wheelMultiplier:.95,
    anchors:{offset:-72},
    stopInertiaOnNavigate:true,
    prevent:function(node){
      if(!(node instanceof Element)) return false;
      return Boolean(node.closest('.brands-track,.situations-carousel'));
    }
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(500, 33);
  window.__awoneLenis = lenis;
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

/* ── Méthode immersive : 181 images décodées avant activation, puis un
     rendu canvas cadencé indépendamment des événements de scroll. ── */
(function(){
  var section = document.getElementById('methode');
  if(!section) return;

  var stage = section.querySelector('[data-method-stage]');
  var canvas = section.querySelector('[data-method-canvas]');
  var poster = section.querySelector('[data-method-poster]');
  var loaderLabel = section.querySelector('[data-method-loader-label]');
  var loaderValue = section.querySelector('[data-method-loader-value]');
  var loaderTrack = section.querySelector('[data-method-loader-track]');
  var loaderBar = loaderTrack && loaderTrack.querySelector('i');
  var status = section.querySelector('[data-method-status]');
  var nodes = Array.prototype.slice.call(section.querySelectorAll('[data-method-node]'));
  var connectors = Array.prototype.slice.call(section.querySelectorAll('[data-method-connector]'));
  var progressDots = Array.prototype.slice.call(section.querySelectorAll('[data-method-progress-dot]'));

  /* CONFIG — tous les réglages de la séquence sont regroupés ici.
     frameRoot peut devenir une URL CDN sans toucher au moteur. */
  var METHOD_CONFIG = Object.freeze({
    frameRoot:(section.dataset.frameRoot || '/frames/method').replace(/\/$/, ''),
    frameCount:Math.min(181, Math.max(1, parseInt(section.dataset.frameCount, 10) || 181)),
    scrollScreens:Math.max(1, parseFloat(section.dataset.scrollScreens) || 5.8),
    scrub:Math.max(0, parseFloat(section.dataset.scrub) || .6),
    mobileBreakpoint:767,
    preloadMargin:'150% 0px',
    desktopConcurrency:6,
    mobileConcurrency:4,
    maxDpr:2,
    mobileDpr:1.5,
    desktopPixelBudget:3200000,
    mobilePixelBudget:1800000,
    entryEnd:.06,
    exitStart:.88,
    stepsEnd:.88,
    staticFrame:90,
    resizeDelay:180
  });

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobileLayout = window.matchMedia(
    '(max-width:' + METHOD_CONFIG.mobileBreakpoint + 'px), ' +
    '(max-width:932px) and (max-height:560px) and (pointer:coarse)'
  );
  /* Le jeu reste fixe pendant la visite : aucun second téléchargement lors
     d'une rotation. Les téléphones en paysage gardent le lot 900 px. */
  var useMobileFrames = mobileLayout.matches;
  var frameDirectory = useMobileFrames ? 'mobile' : 'desktop';
  var frames = new Array(METHOD_CONFIG.frameCount);
  var decodedCount = 0;
  var preloadStarted = false;
  var preloadObserver = null;
  var visibilityObserver = null;
  var scrollTween = null;
  var resizeTimer = 0;
  var loaderRaf = 0;
  var paintRaf = 0;
  var activeStep = -1;
  var targetFrame = 0;
  var drawnFrame = -1;
  var targetProgress = 0;
  var paintedProgress = -1;
  var lastStageWidth = 0;
  var lastStageHeight = 0;
  var context = null;

  function padFrame(value){
    return String(value).padStart(4, '0');
  }

  function frameUrl(index){
    return METHOD_CONFIG.frameRoot + '/' + frameDirectory + '/frame_' + padFrame(index + 1) + '.webp';
  }

  function setMethodVisible(visible){
    document.body.classList.toggle('method-cinematic-active', Boolean(visible));
  }

  function activateStatic(message){
    if(preloadObserver) preloadObserver.disconnect();
    if(visibilityObserver) visibilityObserver.disconnect();
    if(scrollTween){
      if(scrollTween.scrollTrigger) scrollTween.scrollTrigger.kill();
      scrollTween.kill();
      scrollTween = null;
    }
    if(paintRaf) cancelAnimationFrame(paintRaf);
    if(loaderRaf) cancelAnimationFrame(loaderRaf);
    section.classList.remove('is-booting', 'is-runtime', 'is-ready', 'is-canvas-ready', 'is-scroll-ready', 'has-started');
    section.classList.add('is-static');
    setMethodVisible(false);
    if(poster) poster.src = frameUrl(Math.min(METHOD_CONFIG.staticFrame, METHOD_CONFIG.frameCount - 1));
    if(status) status.textContent = message || 'Les cinq étapes de la méthode AWONE';
  }

  if(
    reducedMotion.matches ||
    !stage ||
    !canvas ||
    nodes.length !== 5 ||
    !('requestAnimationFrame' in window)
  ){
    activateStatic(
      reducedMotion.matches
        ? 'Animation désactivée : les cinq étapes sont affichées.'
        : 'Séquence indisponible : les cinq étapes sont affichées.'
    );
    return;
  }

  try {
    context = canvas.getContext('2d', {alpha:false, desynchronized:true});
  } catch(error) {
    context = null;
  }
  if(!context){
    activateStatic('Canvas indisponible : les cinq étapes sont affichées.');
    return;
  }

  section.classList.remove('is-static', 'is-booting');
  section.classList.add('is-runtime');
  section.style.setProperty('--method-scroll-height', ((METHOD_CONFIG.scrollScreens + 1) * 100) + 'svh');

  if('IntersectionObserver' in window){
    visibilityObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){ setMethodVisible(entry.isIntersecting); });
    }, {threshold:0});
    visibilityObserver.observe(section);
  }

  function updateLoader(){
    loaderRaf = 0;
    var ratio = decodedCount / METHOD_CONFIG.frameCount;
    var percent = Math.round(ratio * 100);
    if(loaderValue) loaderValue.textContent = percent + '%';
    if(loaderBar) loaderBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    if(loaderTrack) loaderTrack.setAttribute('aria-valuenow', String(percent));
  }

  function scheduleLoaderUpdate(){
    if(!loaderRaf) loaderRaf = requestAnimationFrame(updateLoader);
  }

  function loadImage(index){
    return new Promise(function(resolve, reject){
      var image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.onload = function(){
        image.onload = null;
        image.onerror = null;
        if(!image.naturalWidth){
          reject(new Error('Frame vide : ' + frameUrl(index)));
          return;
        }
        if(typeof image.decode === 'function'){
          image.decode().then(function(){ resolve(image); }).catch(reject);
        } else {
          resolve(image);
        }
      };
      image.onerror = function(){
        image.onload = null;
        image.onerror = null;
        reject(new Error('Frame introuvable : ' + frameUrl(index)));
      };
      image.src = frameUrl(index);
    });
  }

  function decodeFrame(index, attempt){
    return loadImage(index).then(function(image){
      frames[index] = image;
      decodedCount += 1;
      scheduleLoaderUpdate();
    }).catch(function(error){
      if(attempt < 1) return decodeFrame(index, attempt + 1);
      throw error;
    });
  }

  function preloadOrder(){
    var order = [];
    var seen = new Set();
    function add(index){
      index = Math.max(0, Math.min(METHOD_CONFIG.frameCount - 1, Math.round(index)));
      if(seen.has(index)) return;
      seen.add(index);
      order.push(index);
    }
    add(0);
    for(var step = 1; step < nodes.length; step++){
      add((METHOD_CONFIG.frameCount - 1) * METHOD_CONFIG.stepsEnd * step / nodes.length);
    }
    add(METHOD_CONFIG.staticFrame);
    add(METHOD_CONFIG.frameCount - 1);
    for(var index = 0; index < METHOD_CONFIG.frameCount; index++) add(index);
    return order;
  }

  function startPreload(){
    if(preloadStarted) return;
    preloadStarted = true;
    if(preloadObserver) preloadObserver.disconnect();
    if(loaderLabel) loaderLabel.textContent = 'Préparation de l’expérience';

    var queue = preloadOrder();
    var cursor = 0;
    var failures = [];
    var concurrency = useMobileFrames
      ? METHOD_CONFIG.mobileConcurrency
      : METHOD_CONFIG.desktopConcurrency;

    function worker(){
      if(cursor >= queue.length) return Promise.resolve();
      var index = queue[cursor++];
      return decodeFrame(index, 0)
        .catch(function(error){ failures.push(error); })
        .then(worker);
    }

    var workers = [];
    for(var i = 0; i < concurrency; i++) workers.push(worker());

    Promise.all(workers).then(function(){
      updateLoader();
      if(failures.length || decodedCount !== METHOD_CONFIG.frameCount){
        activateStatic('La séquence 3D n’a pas pu être chargée. Les cinq étapes restent disponibles.');
        return;
      }
      /* Le 100 % est peint avant la disparition du loader. */
      requestAnimationFrame(function(){ requestAnimationFrame(activateSequence); });
    });
  }

  function layoutConnectors(){
    if(mobileLayout.matches) return;
    connectors.forEach(function(connector, index){
      var first = nodes[index];
      var second = nodes[index + 1];
      if(!first || !second) return;
      var ax = first.offsetLeft;
      var ay = first.offsetTop;
      var bx = second.offsetLeft;
      var by = second.offsetTop;
      var dx = bx - ax;
      var dy = by - ay;
      connector.style.left = ax + 'px';
      connector.style.top = ay + 'px';
      connector.style.width = Math.hypot(dx, dy) + 'px';
      connector.style.setProperty('--connector-angle', (Math.atan2(dy, dx) * 180 / Math.PI) + 'deg');
    });
  }

  function canvasDpr(width, height){
    var deviceDpr = Math.min(window.devicePixelRatio || 1, METHOD_CONFIG.maxDpr);
    var budget = useMobileFrames
      ? METHOD_CONFIG.mobilePixelBudget
      : METHOD_CONFIG.desktopPixelBudget;
    var budgetDpr = Math.sqrt(budget / Math.max(1, width * height));
    var layoutCap = useMobileFrames ? METHOD_CONFIG.mobileDpr : METHOD_CONFIG.maxDpr;
    return Math.max(.75, Math.min(deviceDpr, layoutCap, budgetDpr));
  }

  function resizeCanvas(force){
    var width = Math.max(1, Math.round(stage.clientWidth || window.innerWidth));
    var height = Math.max(1, Math.round(stage.clientHeight || window.innerHeight));
    if(!force && width === lastStageWidth && height === lastStageHeight) return false;
    lastStageWidth = width;
    lastStageHeight = height;
    var dpr = canvasDpr(width, height);
    var pixelWidth = Math.max(1, Math.round(width * dpr));
    var pixelHeight = Math.max(1, Math.round(height * dpr));
    if(canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if(canvas.height !== pixelHeight) canvas.height = pixelHeight;
    drawnFrame = -1;
    layoutConnectors();
    schedulePaint();
    return true;
  }

  function drawFrame(index){
    var image = frames[index];
    if(!image || !image.naturalWidth) return false;
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;
    var scale = Math.max(
      canvasWidth / image.naturalWidth,
      canvasHeight / image.naturalHeight
    );
    var width = image.naturalWidth * scale;
    var height = image.naturalHeight * scale;
    context.fillStyle = '#0A0A0A';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.drawImage(
      image,
      (canvasWidth - width) * .5,
      (canvasHeight - height) * .5,
      width,
      height
    );
    return true;
  }

  function setStep(index){
    index = Math.max(0, Math.min(nodes.length - 1, index));
    if(index === activeStep) return;
    activeStep = index;
    nodes.forEach(function(node, nodeIndex){
      var isActive = nodeIndex === index;
      node.classList.toggle('is-active', isActive);
      node.classList.toggle('is-done', nodeIndex < index);
      node.classList.toggle('is-future', nodeIndex > index);
      if(isActive) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    });
    connectors.forEach(function(connector, connectorIndex){
      connector.classList.toggle('is-grown', connectorIndex < index);
    });
    progressDots.forEach(function(dot, dotIndex){
      dot.classList.toggle('is-active', dotIndex === index);
      dot.classList.toggle('is-done', dotIndex < index);
    });
    if(status){
      status.textContent =
        'Étape ' + (index + 1) + ' sur ' + nodes.length + ' : ' +
        (nodes[index].dataset.title || '');
    }
  }

  function paintStory(progress){
    var clamped = Math.max(0, Math.min(1, progress));
    var stepProgress = Math.min(1, clamped / METHOD_CONFIG.stepsEnd);
    var stepIndex = Math.min(nodes.length - 1, Math.floor(stepProgress * nodes.length));
    var entryOpacity = clamped < METHOD_CONFIG.entryEnd
      ? (METHOD_CONFIG.entryEnd - clamped) / METHOD_CONFIG.entryEnd
      : 0;
    var exitOpacity = clamped > METHOD_CONFIG.exitStart
      ? (clamped - METHOD_CONFIG.exitStart) / (1 - METHOD_CONFIG.exitStart)
      : 0;

    setStep(stepIndex);
    section.classList.toggle('has-started', clamped > .025);
    section.style.setProperty('--method-entry-opacity', entryOpacity.toFixed(4));
    section.style.setProperty('--method-exit-opacity', exitOpacity.toFixed(4));
  }

  function flushPaint(){
    paintRaf = 0;
    if(drawnFrame !== targetFrame && drawFrame(targetFrame)) drawnFrame = targetFrame;
    if(paintedProgress !== targetProgress){
      paintStory(targetProgress);
      paintedProgress = targetProgress;
    }
  }

  function schedulePaint(){
    if(!paintRaf) paintRaf = requestAnimationFrame(flushPaint);
  }

  function setTargetFrame(value){
    var next = Math.max(0, Math.min(METHOD_CONFIG.frameCount - 1, Math.round(value)));
    if(next === targetFrame) return;
    targetFrame = next;
    schedulePaint();
  }

  function scrollDistance(){
    return Math.round(Math.max(stage.clientHeight, window.innerHeight) * METHOD_CONFIG.scrollScreens);
  }

  function initScrollSequence(){
    var playhead = {frame:0};
    section.classList.add('is-scroll-ready');

    scrollTween = gsap.to(playhead, {
      frame:METHOD_CONFIG.frameCount - 1,
      ease:'none',
      snap:{frame:1},
      onUpdate:function(){ setTargetFrame(playhead.frame); },
      scrollTrigger:{
        trigger:section,
        start:'top top',
        end:function(){ return '+=' + scrollDistance(); },
        pin:stage,
        pinSpacing:false,
        pinType:'transform',
        scrub:METHOD_CONFIG.scrub,
        anticipatePin:1,
        invalidateOnRefresh:true,
        onUpdate:function(self){
          targetProgress = self.progress;
          schedulePaint();
        },
        onToggle:function(self){ setMethodVisible(self.isActive); },
        onRefresh:function(self){
          targetProgress = self.progress;
          layoutConnectors();
          schedulePaint();
        }
      }
    });

    ScrollTrigger.refresh();
  }

  function activateSequence(){
    resizeCanvas(true);
    targetFrame = 0;
    drawnFrame = -1;
    targetProgress = 0;
    paintedProgress = -1;
    flushPaint();
    section.classList.add('is-ready', 'is-canvas-ready');
    try {
      initScrollSequence();
    } catch(error) {
      activateStatic('Animation indisponible : les cinq étapes restent affichées.');
      return;
    }

    window.addEventListener('resize', queueResize, {passive:true});
    window.addEventListener('orientationchange', forceResize, {passive:true});
    if(typeof mobileLayout.addEventListener === 'function'){
      mobileLayout.addEventListener('change', forceResize);
    }
  }

  function resizeAfterDelay(force){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      var nextWidth = Math.round(stage.clientWidth || window.innerWidth);
      var nextHeight = Math.round(stage.clientHeight || window.innerHeight);
      /* Les barres d’URL mobiles ne doivent pas réallouer le canvas. */
      if(
        !force &&
        mobileLayout.matches &&
        nextWidth === lastStageWidth &&
        Math.abs(nextHeight - lastStageHeight) < 110
      ) return;

      resizeCanvas(force);
      if(scrollTween && scrollTween.scrollTrigger) ScrollTrigger.refresh();
    }, METHOD_CONFIG.resizeDelay);
  }

  function queueResize(){ resizeAfterDelay(false); }
  function forceResize(){ resizeAfterDelay(true); }

  if(typeof reducedMotion.addEventListener === 'function'){
    reducedMotion.addEventListener('change', function(event){
      if(event.matches) activateStatic('Animation désactivée : les cinq étapes sont affichées.');
    });
  }

  if('IntersectionObserver' in window){
    preloadObserver = new IntersectionObserver(function(entries){
      if(entries.some(function(entry){ return entry.isIntersecting; })) startPreload();
    }, {rootMargin:METHOD_CONFIG.preloadMargin, threshold:0});
    preloadObserver.observe(section);
  } else {
    var afterLoad = function(){
      if('requestIdleCallback' in window){
        requestIdleCallback(startPreload, {timeout:1600});
      } else {
        setTimeout(startPreload, 200);
      }
    };
    if(document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, {once:true});
  }
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

  /* Le grain SVG ne change pas la lecture des visuels mais force un rendu
     feTurbulence sur chacune des cartes originales. On le retire avant la
     première peinture ; les copies périphériques abandonnent aussi leur
     flou SVG, inutile hors du focus central. */
  originals.forEach(function(card){
    card.querySelectorAll('[filter*="grain"]').forEach(function(node){ node.removeAttribute('filter'); });
    card.querySelectorAll('filter[id$="grain"]').forEach(function(node){ node.remove(); });
  });

  function makeClone(card){
    var clone = card.cloneNode(true);

    /* GSAP peut poser un etat d'entree inline avant l'initialisation. */
    clone.removeAttribute('style');
    clone.classList.remove('is-active');
    clone.removeAttribute('aria-current');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.setAttribute('data-carousel-clone', '');

    clone.querySelectorAll('[filter]').forEach(function(node){ node.removeAttribute('filter'); });
    clone.querySelectorAll('filter').forEach(function(node){ node.remove(); });
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
    glow.style.setProperty('--sg-x', gx + 'px');
    glow.style.setProperty('--sg-y', gy + 'px');
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
    trigger.addEventListener('pointerenter', loadIclosed, {once:true, passive:true});
    trigger.addEventListener('focus', loadIclosed, {once:true});
    trigger.addEventListener('click', function(){
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
  }, {threshold:.15});
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
