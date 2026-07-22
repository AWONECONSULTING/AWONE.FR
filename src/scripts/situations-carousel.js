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

  var cloneSerial = 0;
  function namespaceCloneIds(clone){
    var suffix = '-carousel-clone-' + (++cloneSerial);
    var replacements = {};
    clone.querySelectorAll('[id]').forEach(function(node){
      var previous = node.id;
      var unique = previous + suffix;
      replacements[previous] = unique;
      node.id = unique;
    });

    var ids = Object.keys(replacements);
    if(!ids.length) return;
    clone.querySelectorAll('*').forEach(function(node){
      Array.prototype.slice.call(node.attributes).forEach(function(attribute){
        var value = attribute.value;
        var next = value;
        ids.forEach(function(previous){
          next = next.split('url(#' + previous + ')').join('url(#' + replacements[previous] + ')');
          if(next === '#' + previous) next = '#' + replacements[previous];
        });
        if(next !== value) node.setAttribute(attribute.name, next);
      });
    });
  }

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
    /* Les SVG clonés conservent le même rendu tout en évitant les identifiants
       dupliqués, qui peuvent résoudre vers le mauvais dégradé selon le moteur. */
    namespaceCloneIds(clone);
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
