/* Gestion partagée des séquences de frames.
   Une seule séquence peut posséder ses blobs et son cache décodé à la fois. */
var registry = new Map();
var activeSequence = null;
var scrollDirection = 1;
var lastScrollY = window.scrollY;
var directionRaf = 0;
var directionDelta = 0;

window.addEventListener('scroll', function(){
  var nextY = window.scrollY;
  var delta = nextY - lastScrollY;
  lastScrollY = nextY;
  if(Math.abs(delta) < 2) return;
  if(directionDelta && Math.sign(directionDelta) !== Math.sign(delta)) directionDelta = delta;
  else directionDelta += delta;
  if(Math.abs(directionDelta) < 12) return;
  var nextDirection = directionDelta > 0 ? 1 : -1;
  directionDelta = 0;
  if(nextDirection === scrollDirection) return;
  scrollDirection = nextDirection;
  if(directionRaf) cancelAnimationFrame(directionRaf);
  directionRaf = requestAnimationFrame(function(){
    directionRaf = 0;
    registry.forEach(function(entry){
      if(typeof entry.consider === 'function') entry.consider(scrollDirection);
    });
  });
}, {passive:true});

function memorySnapshot(){
  var sequences = {};
  registry.forEach(function(entry, id){
    try { sequences[id] = entry.state(); }
    catch(error) { sequences[id] = {phase:'unknown'}; }
  });
  return {active:activeSequence, sequences:sequences};
}

function publishMemoryState(){
  window.dispatchEvent(new CustomEvent('awone:frame-memory', {detail:memorySnapshot()}));
}

/* Les médias lourds placés après les récits peuvent réclamer explicitement
   le budget. Seul le propriétaire courant est libéré ; les autres lots sont
   déjà vides par construction. */
window.addEventListener('awone:release-frame-memory', function(event){
  if(!activeSequence) return;
  var currentId = activeSequence;
  var current = registry.get(currentId);
  activeSequence = null;
  if(current && typeof current.release === 'function'){
    try {
      current.release(
        event.detail && event.detail.reason
          ? event.detail.reason
          : 'external-memory-request'
      );
    } catch(error) {
      console.warn('Frame sequence release failed', currentId, error);
    }
  }
  publishMemoryState();
});

export function registerFrameSequence(id, callbacks){
  registry.set(id, callbacks);
  publishMemoryState();

  return {
    claim:function(){
      if(activeSequence && activeSequence !== id){
        var current = registry.get(activeSequence);
        var currentOrder = current && Number.isFinite(current.order) ? current.order : 0;
        var candidateOrder = Number.isFinite(callbacks.order) ? callbacks.order : 0;
        if(
          (scrollDirection > 0 && candidateOrder < currentOrder) ||
          (scrollDirection < 0 && candidateOrder > currentOrder)
        ){
          return false;
        }
      }
      /* Le nouveau propriétaire est marqué avant la libération de l'ancien :
         aucun événement transitoire `active:null` ne peut réveiller la vidéo. */
      activeSequence = id;
      registry.forEach(function(entry, otherId){
        if(otherId === id) return;
        try { entry.release('handoff:' + id); }
        catch(error) { console.warn('Frame sequence release failed', otherId, error); }
      });
      publishMemoryState();
      return true;
    },
    relinquish:function(){
      if(activeSequence === id) activeSequence = null;
      publishMemoryState();
    },
    direction:function(){ return scrollDirection; },
    update:publishMemoryState,
    unregister:function(){
      registry.delete(id);
      if(activeSequence === id) activeSequence = null;
      publishMemoryState();
    }
  };
}

/* Surface de diagnostic volontairement en lecture seule pour DevTools. */
window.__awoneFrameMemory = Object.freeze({snapshot:memorySnapshot});

function staleError(){
  var error = new Error('Chargement remplacé par un nouveau cycle');
  error.name = 'StaleFrameLoad';
  return error;
}

function isCancelled(error){
  return error && (error.name === 'AbortError' || error.name === 'StaleFrameLoad');
}

/* Un premier voisinage est téléchargé et décodé pour rendre le canvas jouable,
   puis le reste du lot chauffe en arrière-plan. Les blobs restent disponibles,
   mais seul un cache décodé borné est conservé : retenir 181 surfaces RGBA
   ferait dépasser 1 Go et reproduirait les purges de canvas iOS. */
export function createDecodedFrameStore(options){
  var frameCount = options.frameCount;
  var sources = new Array(frameCount);
  var phase = 'idle';
  var warmedCount = 0;
  var transferredBytes = 0;
  var selectedFormat = 'webp';
  var generation = 0;
  var controller = null;
  var loadPromise = null;
  var backgroundPromise = null;
  var desiredIndex = 0;
  var touchCounter = 0;
  var maxDecoded = Math.max(4, Math.min(frameCount, options.maxDecoded || 18));
  var playableCount = Math.max(1, Math.min(frameCount, options.playableCount || 12));
  var runtimeConcurrency = Math.max(1, options.runtimeConcurrency || 2);
  var runtimeActive = 0;
  var runtimeQueue = [];
  var runtimePromises = new Map();

  function disposeImage(source){
    if(!source || !source.image) return;
    source.image.onload = null;
    source.image.onerror = null;
    source.image.src = '';
    source.image = null;
    if(source.objectUrl) URL.revokeObjectURL(source.objectUrl);
    source.objectUrl = '';
  }

  function disposeSource(source){
    if(!source) return;
    disposeImage(source);
    source.blob = null;
  }

  function disposeAll(){
    sources.forEach(disposeSource);
    sources = new Array(frameCount);
  }

  function residentCount(){
    var count = 0;
    sources.forEach(function(source){ if(source && source.image) count += 1; });
    return count;
  }

  function trimDecoded(){
    var count = residentCount();
    while(count > maxDecoded){
      var victim = -1;
      var victimScore = -Infinity;
      sources.forEach(function(source, index){
        if(!source || !source.image || index === desiredIndex) return;
        var distance = Math.abs(index - desiredIndex);
        var score = distance * 1000000 - (source.touched || 0);
        if(score > victimScore){ victim = index; victimScore = score; }
      });
      if(victim < 0) break;
      disposeImage(sources[victim]);
      count -= 1;
    }
  }

  function decodeBlob(blob, token){
    return new Promise(function(resolve, reject){
      var objectUrl = URL.createObjectURL(blob);
      var image = new Image();
      image.decoding = 'async';
      image.onload = function(){
        image.onload = null;
        image.onerror = null;
        var decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
        decoded.then(function(){
          if(token !== generation){
            image.src = '';
            URL.revokeObjectURL(objectUrl);
            reject(staleError());
            return;
          }
          resolve({image:image, objectUrl:objectUrl});
        }).catch(function(error){
          image.src = '';
          URL.revokeObjectURL(objectUrl);
          reject(error);
        });
      };
      image.onerror = function(){
        image.onload = null;
        image.onerror = null;
        image.src = '';
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Décodage de frame impossible'));
      };
      image.src = objectUrl;
    });
  }

  function fetchBlob(index, format, signal, attempt){
    return fetch(options.frameUrl(index, format), {cache:'force-cache', signal:signal})
      .then(function(response){
        if(!response.ok) throw new Error('Frame ' + (index + 1) + ' indisponible');
        return response.blob();
      })
      .catch(function(error){
        if(isCancelled(error) || signal.aborted) throw error;
        if(attempt < 1) return fetchBlob(index, format, signal, attempt + 1);
        throw error;
      });
  }

  function commitWarm(index, blob, decoded, token){
    if(token !== generation){
      if(decoded){
        decoded.image.src = '';
        URL.revokeObjectURL(decoded.objectUrl);
      }
      throw staleError();
    }
    if(sources[index]) disposeSource(sources[index]);
    sources[index] = {
      blob:blob,
      bytes:blob.size,
      image:decoded ? decoded.image : null,
      objectUrl:decoded ? decoded.objectUrl : '',
      touched:++touchCounter
    };
    warmedCount += 1;
    transferredBytes += blob.size || 0;
    trimDecoded();
    if(typeof options.onProgress === 'function'){
      options.onProgress(warmedCount, frameCount, selectedFormat);
    }
  }

  function orderedIndexes(){
    var indexes = [];
    var seen = new Set([0]);
    var center = Math.max(0, Math.min(frameCount - 1, Math.round(desiredIndex)));
    var initialSlots = Math.max(0, playableCount - 1);
    function add(index){
      index = Math.max(0, Math.min(frameCount - 1, Math.round(index)));
      if(!seen.has(index)){ seen.add(index); indexes.push(index); }
    }

    /* Le premier lot suit la position réelle du playhead. Au chargement
       normal il contient donc les premières frames ; après restauration à
       mi-page il se centre directement autour de la frame visible. */
    for(var radius = 0; indexes.length < initialSlots && radius < frameCount; radius++){
      add(center + radius);
      if(radius) add(center - radius);
    }

    var priority = typeof options.priority === 'function'
      ? options.priority(frameCount)
      : [frameCount - 1, Math.round((frameCount - 1) * .5)];
    priority.forEach(add);

    for(var distance = 0; distance < frameCount; distance++){
      add(center + distance);
      if(distance) add(center - distance);
    }
    return indexes;
  }

  function cancelRuntimeQueue(){
    runtimeQueue.splice(0).forEach(function(job){ job.resolve(null); });
    runtimePromises.clear();
  }

  function load(){
    if(phase === 'playable' || phase === 'ready' || phase === 'partial'){
      return Promise.resolve(true);
    }
    if(phase === 'loading' && loadPromise) return loadPromise;

    generation += 1;
    var token = generation;
    controller = new AbortController();
    var signal = controller.signal;
    phase = 'loading';
    warmedCount = 0;
    transferredBytes = 0;
    selectedFormat = 'webp';
    touchCounter = 0;
    cancelRuntimeQueue();
    disposeAll();

    async function runWorkers(queue, tolerateFailures, decodeImages){
      var cursor = 0;
      var failures = 0;
      var workerCount = Math.min(
        queue.length,
        Math.max(1, options.concurrency || 4)
      );
      async function worker(){
        while(cursor < queue.length){
          var index = queue[cursor++];
          try {
            var blob = await fetchBlob(index, selectedFormat, signal, 0);
            var decoded = decodeImages ? await decodeBlob(blob, token) : null;
            commitWarm(index, blob, decoded, token);
          } catch(error) {
            if(isCancelled(error) || token !== generation) throw error;
            if(!tolerateFailures) throw error;
            failures += 1;
          }
        }
      }

      var workers = [];
      for(var workerIndex = 0; workerIndex < workerCount; workerIndex++){
        workers.push(worker());
      }
      await Promise.all(workers);
      return failures;
    }

    function loadRemaining(queue){
      /* Les frames restantes sont gardées compressées. Les décoder ici ne
         ferait que créer puis évincer des surfaces RGBA avant leur affichage,
         au détriment des animations qui précèdent la section. */
      backgroundPromise = runWorkers(queue, true, false)
        .then(function(failures){
          if(token !== generation) throw staleError();
          phase = failures ? 'partial' : 'ready';
          trimDecoded();
          if(!failures && typeof options.onReady === 'function'){
            options.onReady(selectedFormat);
          }
          if(failures && typeof options.onBackgroundError === 'function'){
            options.onBackgroundError(failures);
          }
          return !failures;
        })
        .catch(function(error){
          if(isCancelled(error) || token !== generation) return false;
          phase = 'partial';
          if(typeof options.onBackgroundError === 'function'){
            options.onBackgroundError(1);
          }
          return false;
        })
        .finally(function(){
          if(token === generation){
            controller = null;
            backgroundPromise = null;
          }
        });
    }

    loadPromise = (async function(){
      var formats = options.formats && options.formats.length ? options.formats : ['webp'];
      var firstBlob = null;
      var firstDecoded = null;
      var firstError = null;

      for(var formatIndex = 0; formatIndex < formats.length; formatIndex++){
        var candidate = formats[formatIndex];
        try {
          firstBlob = await fetchBlob(0, candidate, signal, 0);
          firstDecoded = await decodeBlob(firstBlob, token);
          selectedFormat = candidate;
          break;
        } catch(error) {
          if(isCancelled(error) || token !== generation) throw error;
          firstError = error;
        }
      }
      if(!firstBlob || !firstDecoded){
        throw firstError || new Error('Aucun format de frame disponible');
      }
      commitWarm(0, firstBlob, firstDecoded, token);

      var queue = orderedIndexes();
      var initialNeeded = Math.max(0, playableCount - warmedCount);
      var initialQueue = queue.splice(0, initialNeeded);
      await runWorkers(initialQueue, false, true);
      if(token !== generation) throw staleError();

      phase = 'playable';
      trimDecoded();
      if(typeof options.onPlayable === 'function'){
        options.onPlayable(selectedFormat);
      }

      loadRemaining(queue);
      return true;
    })().catch(function(error){
      if(isCancelled(error) || token !== generation) return false;
      phase = 'error';
      if(controller) controller.abort();
      controller = null;
      backgroundPromise = null;
      cancelRuntimeQueue();
      disposeAll();
      warmedCount = 0;
      transferredBytes = 0;
      if(typeof options.onError === 'function') options.onError(error);
      throw error;
    }).finally(function(){
      if(token === generation) loadPromise = null;
    });

    return loadPromise;
  }

  function pumpRuntimeQueue(){
    while(runtimeActive < runtimeConcurrency && runtimeQueue.length){
      (function(job){
        runtimeActive += 1;
        var source = sources[job.index];
        var token = generation;
        if(!source || !source.blob || !isPlayable()){
          runtimeActive -= 1;
          runtimePromises.delete(job.index);
          job.resolve(null);
          pumpRuntimeQueue();
          return;
        }
        decodeBlob(source.blob, token).then(function(decoded){
          if(token !== generation || !isPlayable()){
            decoded.image.src = '';
            URL.revokeObjectURL(decoded.objectUrl);
            return null;
          }
          disposeImage(source);
          source.image = decoded.image;
          source.objectUrl = decoded.objectUrl;
          source.touched = ++touchCounter;
          trimDecoded();
          return source.image;
        }).catch(function(){
          return null;
        }).then(job.resolve).finally(function(){
          runtimeActive -= 1;
          if(runtimePromises.get(job.index) === job.promise){
            runtimePromises.delete(job.index);
          }
          pumpRuntimeQueue();
        });
      })(runtimeQueue.shift());
    }
  }

  function request(index, priority){
    index = Math.max(0, Math.min(frameCount - 1, Math.round(index)));
    var source = sources[index];
    if(source && source.image){
      source.touched = ++touchCounter;
      return Promise.resolve(source.image);
    }
    if(!isPlayable() || !source || !source.blob) return Promise.resolve(null);
    if(runtimePromises.has(index)) return runtimePromises.get(index);

    var resolveJob;
    var promise = new Promise(function(resolve){ resolveJob = resolve; });
    runtimePromises.set(index, promise);
    var job = {index:index, resolve:resolveJob, promise:promise};
    if(priority) runtimeQueue.unshift(job); else runtimeQueue.push(job);
    pumpRuntimeQueue();
    return promise;
  }

  function release(){
    generation += 1;
    if(controller) controller.abort();
    controller = null;
    loadPromise = null;
    backgroundPromise = null;
    phase = 'idle';
    warmedCount = 0;
    transferredBytes = 0;
    cancelRuntimeQueue();
    disposeAll();
    if(typeof options.onRelease === 'function') options.onRelease();
  }

  function state(){
    var width = options.frameWidth || 0;
    var height = options.frameHeight || 0;
    var resident = residentCount();
    return {
      phase:phase,
      warmed:warmedCount,
      decoded:resident,
      maxDecoded:maxDecoded,
      count:frameCount,
      format:selectedFormat,
      compressedMB:+(transferredBytes / 1048576).toFixed(2),
      estimatedDecodedMB:+(resident * width * height * 4 / 1048576).toFixed(1)
    };
  }

  function isPlayable(){
    return phase === 'playable' || phase === 'ready' || phase === 'partial';
  }

  return {
    load:load,
    release:release,
    request:request,
    prefetch:function(indexes){
      indexes.forEach(function(index){ request(index, false); });
    },
    setTarget:function(index){
      desiredIndex = Math.max(0, Math.min(frameCount - 1, Math.round(index)));
      runtimeQueue = runtimeQueue.filter(function(job){
        if(Math.abs(job.index - desiredIndex) <= maxDecoded) return true;
        if(runtimePromises.get(job.index) === job.promise){
          runtimePromises.delete(job.index);
        }
        job.resolve(null);
        return false;
      });
      trimDecoded();
    },
    get:function(index){
      var source = sources[index];
      if(source && source.image){ source.touched = ++touchCounter; return source.image; }
      return null;
    },
    isPlayable:isPlayable,
    isReady:function(){ return phase === 'ready'; },
    state:state
  };
}
