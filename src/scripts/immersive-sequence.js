import { gsap, ScrollTrigger } from './motion.js';
import { createDecodedFrameStore, registerFrameSequence } from './frame-sequence.js';

/* Ascension immersive : le pin et son poster sont prêts immédiatement, puis
   le lot adapté à l'écran chauffe à distance. L'arbitre partagé garantit que
   cette séquence et la méthode ne gardent jamais leurs images simultanément. */
(function(){
  var section = document.querySelector('.immersive-sequence');
  if(!section) return;

  var stage = section.querySelector('[data-immersive-stage]');
  var canvas = section.querySelector('[data-immersive-canvas]');
  var poster = section.querySelector('[data-immersive-poster]');
  var posterAvif = section.querySelector('[data-immersive-poster-avif]');
  var posterWebp = section.querySelector('[data-immersive-poster-webp]');
  var copy = section.querySelector('.immersive-copy');
  var hint = section.querySelector('.immersive-hint');
  var loader = section.querySelector('.immersive-loader');
  var loaderLabel = section.querySelector('.immersive-loader-label');
  var loaderTrack = section.querySelector('.immersive-loader-track');
  var loaderBar = loaderTrack && loaderTrack.querySelector('i');
  var loaderValue = section.querySelector('.immersive-loader-value');
  var transitionWash = section.querySelector('.immersive-transition-wash');
  var exitScene = section.querySelector('.immersive-exit');
  var spinnerLogo = section.querySelector('.immersive-spinner-logo');
  var exitLabel = section.querySelector('.immersive-exit-label');

  var CONFIG = Object.freeze({
    frameRoot:(section.dataset.frameRoot || '/frames/immersive').replace(/\/$/, ''),
    desktopFrames:Math.min(181, Math.max(1, parseInt(section.dataset.desktopFrames, 10) || 181)),
    mobileFrames:Math.min(150, Math.max(1, parseInt(section.dataset.mobileFrames, 10) || 91)),
    desktopDirectory:section.dataset.desktopDirectory || 'desktop',
    mobileDirectory:section.dataset.mobileDirectory || 'mobile-optimized',
    desktopScrollScreens:Math.max(1, parseFloat(section.dataset.desktopScrollScreens) || 3.2),
    mobileScrollScreens:Math.max(1, parseFloat(section.dataset.mobileScrollScreens) || 2.4),
    desktopScrub:Math.max(0, parseFloat(section.dataset.desktopScrub) || .65),
    mobileScrub:Math.max(0, parseFloat(section.dataset.mobileScrub) || .55),
    lifecycleScreens:1.5,
    desktopConcurrency:6,
    mobileConcurrency:4,
    maxDpr:2,
    mobileDpr:1.5,
    desktopPixelBudget:3200000,
    mobilePixelBudget:1800000,
    resizeDelay:320
  });

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var saveData = Boolean(navigator.connection && navigator.connection.saveData);
  var mobileLayout = window.matchMedia(
    '(max-width:760px), ' +
    '(max-width:932px) and (max-height:560px) and (orientation:landscape)'
  );
  var coarsePointer = window.matchMedia('(pointer:coarse)');
  var useMobileFrames = mobileLayout.matches;
  var frameCount = useMobileFrames ? CONFIG.mobileFrames : CONFIG.desktopFrames;
  var frameDirectory = useMobileFrames ? CONFIG.mobileDirectory : CONFIG.desktopDirectory;
  var scrollScreens = useMobileFrames ? CONFIG.mobileScrollScreens : CONFIG.desktopScrollScreens;
  var scrub = useMobileFrames ? CONFIG.mobileScrub : CONFIG.desktopScrub;
  var sourceWidth = useMobileFrames ? 720 : 1080;
  var sourceHeight = useMobileFrames ? 1289 : 1934;

  var context = null;
  var lifecycleObserver = null;
  var visibilityObserver = null;
  var sequenceTimeline = null;
  var resizeTimer = 0;
  var resizeForce = false;
  var loaderRaf = 0;
  var paintRaf = 0;
  var targetFrame = 0;
  var drawnFrame = -1;
  var queuedFrame = -1;
  var frameDirection = 1;
  var lastRawProgress = 0;
  var lastStageWidth = 0;
  var lastStageHeight = 0;
  var lastRefreshWidth = 0;
  var lastRefreshHeight = 0;
  var sequenceActive = false;
  var disabled = false;
  var listenersReady = false;
  var lifecyclePixels = Math.round(window.innerHeight * CONFIG.lifecycleScreens);

  function padFrame(value){ return String(value).padStart(4, '0'); }

  function frameUrl(index, format){
    var suffix = format === 'avif' ? '-avif' : '';
    return CONFIG.frameRoot + '/' + frameDirectory + suffix +
      '/frame_' + padFrame(index + 1) + '.' + format;
  }

  function hydratePoster(){
    if(posterAvif && posterAvif.dataset.posterSrcset){
      posterAvif.srcset = posterAvif.dataset.posterSrcset;
    }
    if(posterWebp && posterWebp.dataset.posterSrcset){
      posterWebp.srcset = posterWebp.dataset.posterSrcset;
    }
    if(poster && poster.dataset.posterSrc) poster.src = poster.dataset.posterSrc;
  }

  function loadSpinnerLogo(){
    if(!spinnerLogo || !spinnerLogo.dataset.src) return;
    spinnerLogo.src = spinnerLogo.dataset.src;
    if(spinnerLogo.dataset.srcset) spinnerLogo.srcset = spinnerLogo.dataset.srcset;
    delete spinnerLogo.dataset.src;
    delete spinnerLogo.dataset.srcset;
  }

  function setImmersiveVisible(visible){
    document.body.classList.toggle('immersive-active', Boolean(visible));
  }

  function setLoaderProgress(decoded, total){
    var ratio = total ? decoded / total : 0;
    var percent = Math.round(ratio * 100);
    if(loaderValue) loaderValue.textContent = percent + '%';
    if(loaderBar) loaderBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    if(loaderTrack) loaderTrack.setAttribute('aria-valuenow', String(percent));
  }

  function scheduleLoaderProgress(decoded, total){
    if(loaderRaf) cancelAnimationFrame(loaderRaf);
    loaderRaf = requestAnimationFrame(function(){
      loaderRaf = 0;
      setLoaderProgress(decoded, total);
      lease.update();
    });
  }

  var store = createDecodedFrameStore({
    frameCount:frameCount,
    frameWidth:sourceWidth,
    frameHeight:sourceHeight,
    concurrency:useMobileFrames ? CONFIG.mobileConcurrency : CONFIG.desktopConcurrency,
    runtimeConcurrency:useMobileFrames ? 2 : 3,
    maxDecoded:useMobileFrames ? 22 : 16,
    playableCount:useMobileFrames ? 12 : 15,
    formats:['avif', 'webp'],
    frameUrl:frameUrl,
    priority:function(count){
      return [
        count - 1,
        Math.round((count - 1) * .5),
        Math.round((count - 1) * .25),
        Math.round((count - 1) * .75)
      ];
    },
    onProgress:scheduleLoaderProgress,
    onReady:function(){
      setLoaderProgress(frameCount, frameCount);
      section.classList.remove('is-loading');
      section.classList.add('is-loaded');
      if(loader) loader.setAttribute('aria-label', 'Expérience immersive chargée');
      lease.update();
    }
  });

  function sequenceState(){
    var state = store.state();
    state.active = sequenceActive;
    state.canvasPixels = canvas ? canvas.width * canvas.height : 0;
    return state;
  }

  /* Préchargement généreux devant le scroll, libération rapide derrière lui.
     Cela évite qu'une scène déjà passée garde ses blobs et surfaces décodées. */
  function isWithinLifecycle(direction){
    var rect = section.getBoundingClientRect();
    var trailingPixels = Math.round(window.innerHeight * .12);
    if(direction < 0){
      return rect.bottom >= -lifecyclePixels &&
        rect.top <= window.innerHeight + trailingPixels;
    }
    return rect.bottom >= -trailingPixels &&
      rect.top <= window.innerHeight + lifecyclePixels;
  }

  var lease = registerFrameSequence('immersive', {
    release:releaseSequence,
    state:sequenceState,
    order:0,
    consider:function(direction){
      if(disabled) return;
      if(isWithinLifecycle(direction)) loadSequence();
      else releaseSequence('direction');
    }
  });

  hydratePoster();

  function clearCanvas(){
    if(!canvas) return;
    if(context) context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
    canvas.removeAttribute('data-frame');
    drawnFrame = -1;
    queuedFrame = -1;
  }

  function releaseSequence(){
    if(disabled) return;
    sequenceActive = false;
    store.release();
    if(paintRaf){ cancelAnimationFrame(paintRaf); paintRaf = 0; }
    if(loaderRaf){ cancelAnimationFrame(loaderRaf); loaderRaf = 0; }
    clearCanvas();
    section.classList.remove('is-loading', 'is-loaded', 'is-ready', 'is-canvas-ready');
    section.classList.add('is-released');
    setLoaderProgress(0, frameCount);
    lease.relinquish();
    lease.update();
  }

  function activateStatic(message){
    disabled = true;
    sequenceActive = false;
    if(lifecycleObserver) lifecycleObserver.disconnect();
    if(visibilityObserver) visibilityObserver.disconnect();
    if(sequenceTimeline){
      if(sequenceTimeline.scrollTrigger) sequenceTimeline.scrollTrigger.kill();
      sequenceTimeline.kill();
      sequenceTimeline = null;
    }
    store.release();
    clearCanvas();
    section.classList.remove(
      'is-booting', 'is-runtime', 'is-loading', 'is-loaded', 'is-ready',
      'is-canvas-ready', 'is-scroll-ready', 'is-released'
    );
    section.classList.add('is-static');
    setImmersiveVisible(false);
    if(loaderLabel) loaderLabel.textContent = message || 'Image fixe';
    if(loader) loader.setAttribute('aria-label', message || 'Expérience immersive en image fixe');
    loadSpinnerLogo();
    lease.relinquish();
    lease.update();
  }

  if(
    reducedMotion.matches ||
    saveData ||
    !stage ||
    !canvas ||
    !poster ||
    !('requestAnimationFrame' in window)
  ){
    activateStatic(
      reducedMotion.matches
        ? 'Image fixe · mouvement réduit'
        : saveData
          ? 'Image fixe · économie de données'
          : 'Image fixe · séquence indisponible'
    );
    return;
  }

  try {
    context = canvas.getContext('2d', {alpha:false, desynchronized:true});
  } catch(error) {
    context = null;
  }
  if(!context){
    activateStatic('Image fixe · canvas indisponible');
    return;
  }

  section.classList.remove('is-static', 'is-booting');
  section.classList.add('is-runtime');
  section.style.setProperty('--immersive-scroll-height', ((scrollScreens + 1) * 100) + 'svh');
  lastRefreshWidth = Math.round(stage.clientWidth || window.innerWidth);
  lastRefreshHeight = Math.round(stage.clientHeight || window.innerHeight);

  /* Le pin doit exister avant le moindre téléchargement lourd. Le poster
     assure le rendu jusqu'à ce que le premier lot de frames soit disponible,
     sans reprise de contrôle tardive au milieu d'un geste. */
  try { initScrollSequence(); }
  catch(error) {
    activateStatic('Image fixe · animation indisponible');
    return;
  }
  addResizeListeners();

  if('IntersectionObserver' in window){
    visibilityObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){ setImmersiveVisible(entry.isIntersecting); });
    }, {threshold:0});
    visibilityObserver.observe(section);
  }

  function canvasDpr(width, height){
    var deviceDpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    var constrainedCanvas = useMobileFrames || coarsePointer.matches;
    var budget = constrainedCanvas ? CONFIG.mobilePixelBudget : CONFIG.desktopPixelBudget;
    var budgetDpr = Math.sqrt(budget / Math.max(1, width * height));
    var layoutCap = constrainedCanvas ? CONFIG.mobileDpr : CONFIG.maxDpr;
    return Math.max(.75, Math.min(deviceDpr, layoutCap, budgetDpr));
  }

  function resizeCanvas(force){
    if(!sequenceActive) return false;
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
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    drawnFrame = -1;
    schedulePaint();
    return true;
  }

  function drawFrame(index){
    var image = store.get(index);
    if(!image || !canvas.width || !canvas.height) return false;
    var imageWidth = image.naturalWidth;
    var imageHeight = image.naturalHeight;
    if(!imageWidth || !imageHeight) return false;
    var scale = Math.max(canvas.width / imageWidth, canvas.height / imageHeight);
    var width = imageWidth * scale;
    var height = imageHeight * scale;
    context.fillStyle = '#0A0A0A';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      (canvas.width - width) * .5,
      (canvas.height - height) * .5,
      width,
      height
    );
    canvas.dataset.frame = String(index + 1);
    section.classList.add('is-canvas-ready');
    return true;
  }

  function requestFrameWindow(index){
    if(queuedFrame === index) return;
    queuedFrame = index;
    var offsets = frameDirection >= 0
      ? [1,2,3,-1,-2,4]
      : [-1,-2,-3,1,2,-4];
    store.setTarget(index);
    store.request(index, true).then(function(){
      if(queuedFrame === index) queuedFrame = -1;
      schedulePaint();
    });
    store.prefetch(offsets.map(function(offset){ return index + offset; }));
  }

  function flushPaint(){
    paintRaf = 0;
    if(sequenceActive && drawnFrame !== targetFrame){
      if(drawFrame(targetFrame)){
        drawnFrame = targetFrame;
        queuedFrame = -1;
        requestFrameWindow(targetFrame);
      } else {
        requestFrameWindow(targetFrame);
      }
    }
  }

  function schedulePaint(){
    if(!paintRaf) paintRaf = requestAnimationFrame(flushPaint);
  }

  function setTargetFrame(value){
    var nextFrame = Math.max(0, Math.min(frameCount - 1, Math.round(value)));
    if(nextFrame !== targetFrame) frameDirection = nextFrame > targetFrame ? 1 : -1;
    targetFrame = nextFrame;
    store.setTarget(nextFrame);
    schedulePaint();
  }

  function scrollDistance(){
    /* pinSpacing:false s'appuie sur la hauteur déjà réservée par la section.
       La distance doit donc être exactement l'espace restant sous le stage,
       sans mélanger 100svh avec window.innerHeight (variable sur mobile). */
    return Math.max(1, Math.round(section.offsetHeight - stage.offsetHeight));
  }

  function initScrollSequence(){
    var playhead = {frame:targetFrame};
    section.classList.add('is-scroll-ready');
    loadSpinnerLogo();

    sequenceTimeline = gsap.timeline({
      scrollTrigger:{
        trigger:section,
        start:'top top',
        end:function(){ return '+=' + scrollDistance(); },
        pin:stage,
        pinSpacing:false,
        pinType:'transform',
        scrub:scrub,
        anticipatePin:1,
        fastScrollEnd:true,
        invalidateOnRefresh:true,
        onUpdate:function(self){
          if(Math.abs(self.progress - lastRawProgress) > .08){
            setTargetFrame(self.progress * (frameCount - 1));
          }
          lastRawProgress = self.progress;
        },
        onToggle:function(self){ setImmersiveVisible(self.isActive); },
        onRefresh:function(self){
          lastRawProgress = self.progress;
          setTargetFrame(self.progress * (frameCount - 1));
          schedulePaint();
        }
      }
    });

    sequenceTimeline
      .to(playhead, {
        frame:frameCount - 1,
        duration:1,
        ease:'none',
        snap:{frame:1},
        onUpdate:function(){ setTargetFrame(playhead.frame); }
      }, 0)
      .to([copy, hint], {
        opacity:0,
        y:-34,
        duration:.225,
        ease:'none',
        force3D:true
      }, 0);

    if(transitionWash && exitScene && spinnerLogo && exitLabel){
      sequenceTimeline
        .fromTo(transitionWash,
          {opacity:0},
          {opacity:1,duration:.31,ease:'power1.inOut'}, .69)
        .fromTo(exitScene,
          {opacity:0,y:useMobileFrames?62:86,scale:.78},
          {opacity:1,y:0,scale:1,duration:.25,ease:'power2.out',force3D:true}, .73)
        .fromTo(spinnerLogo,
          {rotationY:-900,rotationZ:-8,scale:.58},
          {rotationY:0,rotationZ:0,scale:1,duration:.26,ease:'power2.out',force3D:true}, .72)
        .fromTo(exitLabel,
          {opacity:0,y:14,letterSpacing:'.38em'},
          {opacity:1,y:0,letterSpacing:'.24em',duration:.2,ease:'power2.out'}, .8);
    }
  }

  function addResizeListeners(){
    if(listenersReady) return;
    listenersReady = true;
    window.addEventListener('resize', queueResize, {passive:true});
    window.addEventListener('orientationchange', forceResize, {passive:true});
    if(typeof mobileLayout.addEventListener === 'function'){
      mobileLayout.addEventListener('change', forceResize);
    }
  }

  function activateSequence(){
    if(disabled || !store.isPlayable()) return;
    sequenceActive = true;
    section.classList.remove('is-released');
    section.classList.remove('is-canvas-ready');
    section.classList.add('is-ready');
    resizeCanvas(true);
    drawnFrame = -1;
    flushPaint();

    schedulePaint();
    lease.update();
  }

  function loadSequence(){
    if(disabled) return;
    if(!lease.claim()){
      section.classList.add('is-released');
      return;
    }
    section.classList.remove('is-released');
    section.classList.add('is-loading');
    if(loaderLabel) loaderLabel.textContent = 'Décodage de l’ascension';
    if(store.isPlayable()){
      activateSequence();
      return;
    }
    store.load().then(function(ready){
      if(ready) requestAnimationFrame(function(){
        requestAnimationFrame(activateSequence);
      });
    }).catch(function(){
      activateStatic('Image fixe · séquence indisponible');
    });
  }

  function resizeAfterDelay(force){
    resizeForce = resizeForce || force;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(settleResize, CONFIG.resizeDelay);
  }

  function settleResize(){
    if(typeof ScrollTrigger.isScrolling === 'function' && ScrollTrigger.isScrolling()){
      resizeTimer = setTimeout(settleResize, 120);
      return;
    }

    var force = resizeForce;
    resizeForce = false;
    var nextWidth = Math.round(stage.clientWidth || window.innerWidth);
    var nextHeight = Math.round(stage.clientHeight || window.innerHeight);
    var widthChanged = Math.abs(nextWidth - lastRefreshWidth) > 1;
    var heightChanged = Math.abs(nextHeight - lastRefreshHeight) > 1;

    /* Sur un écran tactile, une variation de hauteur seule correspond presque
       toujours à la barre d'URL. 100svh reste stable : aucun refresh du pin
       ne doit être déclenché pendant ou juste après ce geste. */
    if(!force && coarsePointer.matches && !widthChanged){
      lastRefreshHeight = nextHeight;
      return;
    }
    if(!force && !widthChanged && !heightChanged) return;

    lastRefreshWidth = nextWidth;
    lastRefreshHeight = nextHeight;
    if(sequenceActive) resizeCanvas(force || widthChanged);
    if(sequenceTimeline && sequenceTimeline.scrollTrigger){
      ScrollTrigger.refresh();
    }
  }

  function queueResize(){ resizeAfterDelay(false); }
  function forceResize(){ resizeAfterDelay(true); }

  if(typeof reducedMotion.addEventListener === 'function'){
    reducedMotion.addEventListener('change', function(event){
      if(event.matches) activateStatic('Image fixe · mouvement réduit');
    });
  }

  if('IntersectionObserver' in window){
    lifecycleObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting && isWithinLifecycle(lease.direction())) loadSequence();
        else releaseSequence('distance');
      });
    }, {rootMargin:lifecyclePixels + 'px 0px', threshold:0});
    lifecycleObserver.observe(section);
    if(isWithinLifecycle(lease.direction())) loadSequence();
  } else {
    loadSequence();
  }
})();
