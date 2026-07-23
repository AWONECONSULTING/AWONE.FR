/* L'embed de profil Instagram a une surface officielle fixe de 520 × 505 px.
   On la réduit comme une seule carte sur les petits écrans : les six
   publications restent donc toujours visibles, sans scroll interne. */
(function(){
  var viewports = Array.prototype.slice.call(
    document.querySelectorAll('[data-instagram-viewport]')
  );
  if(!viewports.length) return;

  viewports.forEach(function(viewport){
    var surface = viewport.querySelector('[data-instagram-scale]');
    if(!surface) return;

    function fit(){
      var availableWidth = Math.min(520, viewport.clientWidth);
      var scale = Math.max(.1, availableWidth / 520);
      surface.style.setProperty('--ig-feed-scale', scale.toFixed(4));
      viewport.style.height = Math.ceil(505 * scale) + 'px';
    }

    fit();
    if('ResizeObserver' in window){
      var observer = new ResizeObserver(fit);
      observer.observe(viewport);
    } else {
      window.addEventListener('resize', fit, {passive:true});
    }
  });
})();
