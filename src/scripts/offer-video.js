/* L'offre du moment : lecteur adaptatif Cloudflare Stream.
   Le flux reste différé, démarre muet dès que l'écran devient visible et
   cède ses buffers aux séquences 3D lorsqu'il est hors champ. */
(function(){
  var tv = document.getElementById('tv');
  var video = document.getElementById('offer-video');
  var btn = document.getElementById('sound-btn');
  if(!tv || !video || !btn) return;

  var hlsSrc = video.dataset.hlsSrc;
  var dashSrc = video.dataset.dashSrc;
  var hlsPlayer = null;
  var dashPlayer = null;
  var initPromise = null;
  var initGeneration = 0;
  var streamRequested = false;
  var tvVisible = false;
  var playerReady = false;
  var userUnmuted = false;
  var playPromise = null;
  var playFailures = 0;
  var retryTimer = 0;
  var playerMode = 'idle';
  var nativeHlsFailed = false;
  var lastPlayError = '';
  var lastStreamError = '';

  /* iOS exige que ces propriétés soient positionnées avant l'attribution de
     la source. defaultMuted couvre également le tout premier autoplay natif. */
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = false;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  function frameSequenceBusy(){
    return document.body.classList.contains('immersive-active') ||
      document.body.classList.contains('method-cinematic-active');
  }

  function describeError(error){
    if(!error) return 'Erreur inconnue';
    return [error.name, error.message].filter(Boolean).join(': ') || String(error);
  }

  function setVideoState(state){
    tv.dataset.videoState = state;
  }

  function syncSoundControl(){
    var soundEnabled = !video.muted;
    btn.classList.toggle('unmuted', soundEnabled);
    btn.setAttribute('aria-pressed', String(soundEnabled));
    btn.setAttribute(
      'aria-label',
      soundEnabled ? 'Couper le son de la vidéo' : 'Activer le son de la vidéo'
    );
    var label = btn.querySelector('.lbl');
    if(label) label.textContent = soundEnabled ? 'Couper le son' : 'Activer le son';
  }

  function queuePlayRetry(){
    if(retryTimer || !tvVisible || playFailures >= 3) return;
    retryTimer = window.setTimeout(function(){
      retryTimer = 0;
      safePlay('retry');
    }, 320);
  }

  function safePlay(reason){
    if(!tvVisible || !playerReady || !video.currentSrc || document.hidden){
      return Promise.resolve(false);
    }
    if(playPromise) return playPromise;

    video.autoplay = true;
    if(!userUnmuted){
      video.muted = true;
      video.defaultMuted = true;
      syncSoundControl();
    }

    var result;
    try { result = video.play(); }
    catch(error){ result = Promise.reject(error); }

    playPromise = Promise.resolve(result).then(function(){
      playFailures = 0;
      lastPlayError = '';
      setVideoState('playing');
      return true;
    }).catch(function(error){
      lastPlayError = reason + ' — ' + describeError(error);
      playFailures += 1;

      /* Une reprise avec son peut être refusée sans nouveau geste utilisateur.
         Dans ce seul cas, on revient au mode muet garanti par les navigateurs. */
      if(!video.muted && error && error.name === 'NotAllowedError'){
        userUnmuted = false;
        video.muted = true;
        video.defaultMuted = true;
        syncSoundControl();
        playFailures = 0;
        queuePlayRetry();
      } else if(video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA){
        queuePlayRetry();
      }
      setVideoState('paused');
      return false;
    }).finally(function(){
      playPromise = null;
    });
    return playPromise;
  }

  function markReady(){
    playerReady = true;
    setVideoState(tvVisible ? 'ready' : 'buffered');
    if(tvVisible) safePlay('media-ready');
    else video.pause();
  }

  function resetHls(){
    if(!hlsPlayer) return;
    try { hlsPlayer.destroy(); } catch(error) {}
    hlsPlayer = null;
  }

  function resetDash(){
    if(!dashPlayer) return;
    try { dashPlayer.reset(); } catch(error) {}
    dashPlayer = null;
  }

  function initDash(token){
    if(!dashSrc || !window.MediaSource) return Promise.resolve(false);
    return import('dashjs').then(function(mod){
      if(token !== initGeneration) return false;
      var dashjs = mod.default || mod;
      dashPlayer = dashjs.MediaPlayer().create();
      dashPlayer.updateSettings({
        streaming:{
          buffer:{fastSwitchEnabled:true, bufferTimeAtTopQuality:12},
          abr:{autoSwitchBitrate:{video:true}}
        }
      });
      dashPlayer.initialize(video, dashSrc, false);
      playerMode = 'dash';
      setVideoState('loading');
      return true;
    }).catch(function(error){
      if(token === initGeneration) lastStreamError = 'DASH — ' + describeError(error);
      return false;
    });
  }

  function initHlsJs(token){
    return import('hls.js').then(function(mod){
      if(token !== initGeneration) return false;
      var Hls = mod.default || mod;
      if(!Hls.isSupported()) return initDash(token);

      hlsPlayer = new Hls({
        capLevelToPlayerSize:true,
        startLevel:-1,
        maxBufferLength:12,
        maxMaxBufferLength:24,
        backBufferLength:0
      });
      playerMode = 'hls.js';
      setVideoState('loading');

      hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, function(){
        if(token === initGeneration && hlsPlayer) hlsPlayer.loadSource(hlsSrc);
      });
      hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function(){
        if(token === initGeneration) markReady();
      });
      hlsPlayer.on(Hls.Events.ERROR, function(_, data){
        if(token !== initGeneration || !data || !data.fatal) return;
        lastStreamError = 'HLS — ' + (data.details || data.type || 'erreur fatale');
        resetHls();
        playerReady = false;
        initDash(token).then(function(ok){
          if(!ok && token === initGeneration){
            setVideoState('error');
            btn.hidden = true;
          }
        });
      });
      hlsPlayer.attachMedia(video);
      return true;
    });
  }

  function initStream(){
    if(initPromise) return initPromise;
    if(!hlsSrc && !dashSrc) return Promise.resolve(false);

    var token = ++initGeneration;
    playerReady = false;
    lastStreamError = '';
    btn.hidden = false;
    setVideoState('loading');

    if(
      hlsSrc &&
      !nativeHlsFailed &&
      video.canPlayType('application/vnd.apple.mpegurl')
    ){
      playerMode = 'native-hls';
      video.src = hlsSrc;
      video.load();
      initPromise = Promise.resolve(true);
      return initPromise;
    }

    initPromise = (hlsSrc ? initHlsJs(token) : initDash(token)).then(function(ok){
      if(!ok && token === initGeneration){
        setVideoState('error');
        btn.hidden = true;
        initPromise = null;
      }
      return ok;
    }).catch(function(error){
      if(token !== initGeneration) return false;
      lastStreamError = describeError(error);
      resetHls();
      return initDash(token).then(function(ok){
        if(!ok && token === initGeneration){
          setVideoState('error');
          btn.hidden = true;
          initPromise = null;
        }
        return ok;
      });
    });
    return initPromise;
  }

  function destroyStream(){
    if(!initPromise && !hlsPlayer && !dashPlayer && !video.currentSrc) return;
    initGeneration += 1;
    playerReady = false;
    playPromise = null;
    clearTimeout(retryTimer);
    retryTimer = 0;
    resetHls();
    resetDash();
    video.autoplay = false;
    video.pause();
    video.removeAttribute('src');
    video.load();
    initPromise = null;
    playerMode = 'idle';
    setVideoState('idle');
  }

  function requestStream(){
    streamRequested = true;
    /* Une séquence visible reste prioritaire. Si l'écran vidéo est lui-même
       visible, un ancien verrou mémoire ne doit jamais empêcher l'autoplay. */
    if(frameSequenceBusy() && !tvVisible) return Promise.resolve(false);
    return initStream().then(function(ok){
      if(ok && tvVisible && playerReady) safePlay('stream-ready');
      return ok;
    });
  }

  window.addEventListener('awone:frame-memory', function(event){
    var active = event.detail && event.detail.active;
    if(active && !tvVisible){
      destroyStream();
      return;
    }
    if(streamRequested || tvVisible) requestStream();
  });

  var preloadIO = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting) return;
      requestStream();
      preloadIO.unobserve(tv);
    });
  }, {rootMargin:'900px 0px', threshold:0});
  preloadIO.observe(tv);

  var visibilityIO = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      tvVisible = entry.isIntersecting && entry.intersectionRatio > 0;
      if(tvVisible){
        tv.classList.add('visible');
        video.autoplay = true;
        playFailures = 0;
        window.dispatchEvent(new CustomEvent('awone:release-frame-memory', {
          detail:{reason:'offer-video-visible'}
        }));
        requestStream().then(function(){
          if(playerReady) safePlay('visible');
        });
      } else {
        video.autoplay = false;
        video.pause();
        if(playerReady) setVideoState('buffered');
      }
    });
  }, {threshold:[0, .15]});
  visibilityIO.observe(tv);

  btn.addEventListener('click', function(){
    video.muted = !video.muted;
    userUnmuted = !video.muted;
    syncSoundControl();
    if(tvVisible) safePlay('sound-control');
  });

  ['loadedmetadata', 'loadeddata', 'canplay'].forEach(function(eventName){
    video.addEventListener(eventName, markReady);
  });
  video.addEventListener('playing', function(){
    if(!tvVisible){
      video.pause();
      return;
    }
    setVideoState('playing');
  });
  video.addEventListener('waiting', function(){
    if(tvVisible) setVideoState('buffering');
  });
  video.addEventListener('error', function(){
    if(video.error){
      lastStreamError = 'Media ' + video.error.code + ' — ' + (video.error.message || 'lecture impossible');
      setVideoState('error');
      /* Certains Chrome récents annoncent un support HLS natif mais peuvent
         échouer au démultiplexage après une reprise. Le chemin MSE, déjà
         validé et différé, prend alors automatiquement la relève. */
      if(playerMode === 'native-hls' && !nativeHlsFailed && window.MediaSource){
        nativeHlsFailed = true;
        window.setTimeout(function(){
          if(playerMode !== 'native-hls') return;
          destroyStream();
          if(streamRequested && (tvVisible || !frameSequenceBusy())) requestStream();
        }, 0);
      }
    }
  });

  document.addEventListener('visibilitychange', function(){
    if(document.hidden) video.pause();
    else if(tvVisible) requestStream().then(function(){ safePlay('document-visible'); });
  });
  window.addEventListener('pageshow', function(){
    if(tvVisible) requestStream().then(function(){ safePlay('pageshow'); });
  });

  syncSoundControl();
  setVideoState('idle');

  /* Diagnostic en lecture seule pour les contrôles navigateur et DevTools. */
  window.__awoneOfferVideo = Object.freeze({
    snapshot:function(){
      return {
        state:tv.dataset.videoState || 'idle',
        mode:playerMode,
        visible:tvVisible,
        requested:streamRequested,
        ready:playerReady,
        muted:video.muted,
        paused:video.paused,
        readyState:video.readyState,
        networkState:video.networkState,
        currentTime:+video.currentTime.toFixed(3),
        duration:Number.isFinite(video.duration) ? +video.duration.toFixed(3) : null,
        currentSrc:video.currentSrc,
        frameSequenceBusy:frameSequenceBusy(),
        nativeHlsFallback:nativeHlsFailed,
        playError:lastPlayError,
        streamError:lastStreamError
      };
    }
  });
})();
