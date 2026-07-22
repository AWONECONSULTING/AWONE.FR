import { gsap, ScrollTrigger } from './motion.js';
import { createDecodedFrameStore, registerFrameSequence } from './frame-sequence.js';

/* Méthode immersive : toutes les frames du lot actif sont téléchargées et
   décodées avant le scrub. Le lot entier est libéré dès que la section est
   loin ; l'arbitre partagé libère aussi l'autre séquence avant ce chargement. */
(function(){
  var section = document.getElementById('methode');
  if(!section) return;

  var stage = section.querySelector('[data-method-stage]');
  var canvas = section.querySelector('[data-method-canvas]');
  var poster = section.querySelector('[data-method-poster]');
  var posterAvif = section.querySelector('[data-method-poster-avif]');
  var posterWebp = section.querySelector('[data-method-poster-webp]');
  var loaderLabel = section.querySelector('[data-method-loader-label]');
  var loaderValue = section.querySelector('[data-method-loader-value]');
  var loaderTrack = section.querySelector('[data-method-loader-track]');
  var loaderBar = loaderTrack && loaderTrack.querySelector('i');
  var status = section.querySelector('[data-method-status]');
  var nodes = Array.prototype.slice.call(section.querySelectorAll('[data-method-node]'));
  var connectors = Array.prototype.slice.call(section.querySelectorAll('[data-method-connector]'));
  var progressDots = Array.prototype.slice.call(section.querySelectorAll('[data-method-progress-dot]'));

  var CONFIG = Object.freeze({
    frameRoot:(section.dataset.frameRoot || '/frames/method').replace(/\/$/, ''),
    desktopFrames:Math.min(181, Math.max(1, parseInt(section.dataset.desktopFrames, 10) || 181)),
    mobileFrames:Math.min(150, Math.max(1, parseInt(section.dataset.mobileFrames, 10) || 121)),
    desktopDirectory:section.dataset.desktopDirectory || 'desktop',
    mobileDirectory:section.dataset.mobileDirectory || 'mobile-optimized',
    scrollScreens:Math.max(1, parseFloat(section.dataset.scrollScreens) || 5.8),
    scrub:Math.max(0, parseFloat(section.dataset.scrub) || .6),
    mobileBreakpoint:767,
    lifecycleScreens:1.5,
    desktopConcurrency:6,
    mobileConcurrency:4,
    maxDpr:2,
    mobileDpr:1.5,
    desktopPixelBudget:3200000,
    mobilePixelBudget:1800000,
    entryEnd:.06,
    exitStart:.92,
    stepsEnd:.9,
    resizeDelay:180
  });

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var saveData = Boolean(navigator.connection && navigator.connection.saveData);
  var mobileLayout = window.matchMedia(
    '(max-width:' + CONFIG.mobileBreakpoint + 'px), ' +
    '(max-width:932px) and (max-height:560px) and (pointer:coarse)'
  );
  var coarsePointer = window.matchMedia('(pointer:coarse)');
  var useMobileFrames = mobileLayout.matches;
  var frameCount = useMobileFrames ? CONFIG.mobileFrames : CONFIG.desktopFrames;
  var frameDirectory = useMobileFrames ? CONFIG.mobileDirectory : CONFIG.desktopDirectory;
  var sourceWidth = useMobileFrames ? 720 : 1440;
  var sourceHeight = useMobileFrames ? 405 : 810;

  var context = null;
  var lifecycleObserver = null;
  var visibilityObserver = null;
  var scrollTween = null;
  var resizeTimer = 0;
  var loaderRaf = 0;
  var paintRaf = 0;
  var activeStep = -1;
  var targetFrame = 0;
  var drawnFrame = -1;
  var queuedFrame = -1;
  var frameDirection = 1;
  var targetProgress = 0;
  var lastRawProgress = 0;
  var paintedProgress = -1;
  var lastStageWidth = 0;
  var lastStageHeight = 0;
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

  function setMethodVisible(visible){
    document.body.classList.toggle('method-cinematic-active', Boolean(visible));
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
    maxDecoded:useMobileFrames ? 32 : 20,
    formats:['avif', 'webp'],
    frameUrl:frameUrl,
    priority:function(count){
      var list = [count - 1, Math.round((count - 1) * .5)];
      for(var step = 1; step < nodes.length; step++){
        list.push((count - 1) * CONFIG.stepsEnd * step / nodes.length);
      }
      return list;
    },
    onProgress:scheduleLoaderProgress
  });

  function sequenceState(){
    var state = store.state();
    state.active = sequenceActive;
    state.canvasPixels = canvas ? canvas.width * canvas.height : 0;
    return state;
  }

  /* La marge de 1,5 écran sert à précharger dans le sens du déplacement.
     Derrière l'utilisateur, la séquence est libérée presque immédiatement :
     elle ne peut ainsi plus bloquer la vidéo de l'offre située plus bas. */
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

  var lease = registerFrameSequence('method', {
    release:releaseSequence,
    state:sequenceState,
    order:1,
    consider:function(direction){
      if(disabled) return;
      if(isWithinLifecycle(direction)) loadSequence();
      else releaseSequence('direction');
    }
  });

  hydratePoster();

  function clearCanvas(){
    if(!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
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
    section.classList.remove('is-loading', 'is-ready', 'is-canvas-ready');
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
    if(scrollTween){
      if(scrollTween.scrollTrigger) scrollTween.scrollTrigger.kill();
      scrollTween.kill();
      scrollTween = null;
    }
    store.release();
    clearCanvas();
    section.classList.remove(
      'is-booting', 'is-runtime', 'is-loading', 'is-ready',
      'is-canvas-ready', 'is-scroll-ready', 'is-released', 'has-started'
    );
    section.classList.add('is-static');
    setMethodVisible(false);
    if(status) status.textContent = message || 'Les cinq étapes de la méthode AWONE';
    lease.relinquish();
    lease.update();
  }

  if(
    reducedMotion.matches ||
    saveData ||
    !stage ||
    !canvas ||
    nodes.length !== 5 ||
    !('requestAnimationFrame' in window)
  ){
    activateStatic(
      reducedMotion.matches
        ? 'Animation désactivée : les cinq étapes sont affichées.'
        : saveData
          ? 'Image fixe : le mode économie de données est activé.'
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
  section.style.setProperty('--method-scroll-height', ((CONFIG.scrollScreens + 1) * 100) + 'svh');

  if('IntersectionObserver' in window){
    visibilityObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){ setMethodVisible(entry.isIntersecting); });
    }, {threshold:0});
    visibilityObserver.observe(section);
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
      connector.style.setProperty(
        '--connector-angle',
        (Math.atan2(dy, dx) * 180 / Math.PI) + 'deg'
      );
    });
  }

  function canvasDpr(width, height){
    var deviceDpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    var constrainedCanvas = useMobileFrames || coarsePointer.matches;
    var budget = constrainedCanvas
      ? CONFIG.mobilePixelBudget
      : CONFIG.desktopPixelBudget;
    var budgetDpr = Math.sqrt(budget / Math.max(1, width * height));
    var layoutCap = constrainedCanvas ? CONFIG.mobileDpr : CONFIG.maxDpr;
    return Math.max(.75, Math.min(deviceDpr, layoutCap, budgetDpr));
  }

  function resizeCanvas(force){
    if(!sequenceActive){
      layoutConnectors();
      return false;
    }
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
    var stepProgress = Math.min(1, clamped / CONFIG.stepsEnd);
    var stepIndex = Math.min(nodes.length - 1, Math.floor(stepProgress * nodes.length));
    var entryOpacity = clamped < CONFIG.entryEnd
      ? (CONFIG.entryEnd - clamped) / CONFIG.entryEnd
      : 0;
    var exitOpacity = clamped > CONFIG.exitStart
      ? (clamped - CONFIG.exitStart) / (1 - CONFIG.exitStart)
      : 0;

    setStep(stepIndex);
    section.classList.toggle('has-started', clamped > .025);
    section.style.setProperty('--method-entry-opacity', entryOpacity.toFixed(4));
    section.style.setProperty('--method-exit-opacity', exitOpacity.toFixed(4));
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
    if(paintedProgress !== targetProgress){
      paintStory(targetProgress);
      paintedProgress = targetProgress;
    }
  }

  function schedulePaint(){
    if(!paintRaf) paintRaf = requestAnimationFrame(flushPaint);
  }

  function setTargetFrame(value){
    var nextFrame = Math.max(0, Math.min(frameCount - 1, Math.round(value)));
    if(nextFrame !== targetFrame) frameDirection = nextFrame > targetFrame ? 1 : -1;
    targetFrame = nextFrame;
    schedulePaint();
  }

  function scrollDistance(){
    return Math.round(Math.max(stage.clientHeight, window.innerHeight) * CONFIG.scrollScreens);
  }

  function initScrollSequence(){
    var playhead = {frame:0};
    section.classList.add('is-scroll-ready');
    scrollTween = gsap.to(playhead, {
      frame:frameCount - 1,
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
        scrub:CONFIG.scrub,
        anticipatePin:1,
        invalidateOnRefresh:true,
        onUpdate:function(self){
          targetProgress = self.progress;
          if(Math.abs(self.progress - lastRawProgress) > .08){
            setTargetFrame(self.progress * (frameCount - 1));
          }
          lastRawProgress = self.progress;
          schedulePaint();
        },
        onToggle:function(self){ setMethodVisible(self.isActive); },
        onRefresh:function(self){
          targetProgress = self.progress;
          lastRawProgress = self.progress;
          setTargetFrame(self.progress * (frameCount - 1));
          layoutConnectors();
          schedulePaint();
        }
      }
    });
    ScrollTrigger.refresh();
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
    if(disabled || !store.isReady()) return;
    sequenceActive = true;
    section.classList.remove('is-loading', 'is-released');
    section.classList.remove('is-canvas-ready');
    section.classList.add('is-ready');
    resizeCanvas(true);
    drawnFrame = -1;
    paintedProgress = -1;
    flushPaint();

    if(!scrollTween){
      try { initScrollSequence(); }
      catch(error) {
        activateStatic('Animation indisponible : les cinq étapes restent affichées.');
        return;
      }
    }
    addResizeListeners();
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
    if(loaderLabel) loaderLabel.textContent = 'Décodage de l’expérience';
    if(store.isReady()){
      activateSequence();
      return;
    }
    store.load().then(function(ready){
      if(ready) requestAnimationFrame(function(){
        requestAnimationFrame(activateSequence);
      });
    }).catch(function(){
      activateStatic('La séquence 3D n’a pas pu être chargée. Les cinq étapes restent disponibles.');
    });
  }

  function resizeAfterDelay(force){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      var nextWidth = Math.round(stage.clientWidth || window.innerWidth);
      var nextHeight = Math.round(stage.clientHeight || window.innerHeight);
      if(
        !force &&
        mobileLayout.matches &&
        nextWidth === lastStageWidth &&
        Math.abs(nextHeight - lastStageHeight) < 110
      ) return;

      if(sequenceActive) resizeCanvas(force);
      else layoutConnectors();
      if(scrollTween && scrollTween.scrollTrigger) ScrollTrigger.refresh();
    }, CONFIG.resizeDelay);
  }

  function queueResize(){ resizeAfterDelay(false); }
  function forceResize(){ resizeAfterDelay(true); }

  if(typeof reducedMotion.addEventListener === 'function'){
    reducedMotion.addEventListener('change', function(event){
      if(event.matches) activateStatic('Animation désactivée : les cinq étapes sont affichées.');
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
