# Séquences immersives — maintenance

Les deux récits canvas sont isolés dans des contrôleurs chargés dès le bundle
principal afin que leurs pins existent avant tout geste :

- `src/scripts/immersive-sequence.js` pour « On élève votre marque » ;
- `src/scripts/method-sequence.js` pour « Les 5 clés » ;
- `src/scripts/frame-sequence.js` pour le chargement, le cache décodé et l’arbitrage mémoire partagé.

Le HTML éditorial reste dans `src/components/ImmersiveSequence.astro` et
`src/components/Methode.astro`. Le rendu responsive est dans
`src/styles/global.css`. Les contrôleurs sont immédiats, mais les posters,
logos de sortie et lots de frames restent différés jusqu'à l'approche.

## Réglages exposés

Les attributs `data-*` des composants permettent de changer sans fouiller le moteur :

- `data-frame-root` : racine locale ou URL CDN versionnée ;
- `data-desktop-frames` et `data-mobile-frames` : nombre de frames de chaque lot ;
- `data-desktop-directory` et `data-mobile-directory` : dossiers WebP ; le moteur ajoute `-avif` pour la variante AVIF ;
- `data-scroll-screens` / `data-desktop-scroll-screens` / `data-mobile-scroll-screens` : longueur du récit ;
- `data-scrub` / `data-desktop-scrub` / `data-mobile-scrub` : amortissement ScrollTrigger.

Les objets `CONFIG` des deux moteurs regroupent les marges d’activation, la concurrence réseau, les plafonds DPR et pixels, les seuils de fondu et le debounce du redimensionnement. Le tableau `steps` de `Methode.astro` contient les textes et positions desktop/tablette des cinq bulles.

## Lots servis

```text
public/frames/immersive/desktop/                 181 WebP · 1080 × 1934
public/frames/immersive/desktop-avif/            181 AVIF · 1080 × 1934
public/frames/immersive/mobile-optimized/         91 WebP ·  720 × 1289
public/frames/immersive/mobile-optimized-avif/    91 AVIF ·  720 × 1289

public/frames/method/desktop/                    181 WebP · 1440 × 810
public/frames/method/desktop-avif/               181 AVIF · 1440 × 810
public/frames/method/mobile-optimized/           121 WebP ·  720 × 405
public/frames/method/mobile-optimized-avif/      121 AVIF ·  720 × 405
```

Poids complet demandé par un navigateur mobile :

| Séquence | AVIF | Repli WebP |
|---|---:|---:|
| Ascension | 2,04 Mio | 2,66 Mio |
| Méthode | 2,28 Mio | 3,70 Mio |

Chaque section dispose aussi d’un poster basse définition de 8 à 19 Kio. Son
URL est conservée dans `data-poster-src` / `data-poster-srcset` et n’est
injectée que lorsque l’observateur de cycle réclame la séquence : aucune frame,
aucun poster ni logo de sortie sous la ligne de flottaison ne part au démarrage
de la page.

## Cycle mémoire

1. Le contrôleur installe immédiatement le ScrollTrigger et son `pin-spacer`.
2. L’`IntersectionObserver` interne réclame le bail mémoire à environ 1,5 écran
   et hydrate le poster.
3. L’arbitre tient compte du sens de lecture lorsque les deux marges de
   préchargement se chevauchent, puis libère l’autre séquence avant toute
   nouvelle allocation.
4. Un premier voisinage de 12 frames mobile ou 15 desktop est téléchargé et
   passe par `img.decode()` ; le canvas devient alors jouable.
5. Le reste du lot chauffe en arrière-plan pendant que le loader continue
   jusqu’à 100 %.
6. Les blobs compressés restent disponibles, mais seul un voisinage décodé
   borné suit la frame cible. Conserver les 181 surfaces RGBA de l’ascension
   dépasserait 1 Gio et reproduirait la purge iOS que le correctif doit éviter.
7. Lorsque la section s’éloigne, requêtes, blobs, URLs objet et images sont
   supprimés ; le canvas est effacé puis réduit à 1 × 1. Le poster reste visible.

Plafonds résidents actuels : 16 images pour l’ascension desktop, 22 mobile, 20 pour la méthode desktop et 32 mobile. Le gestionnaire de scroll ne dessine rien : il ne fait que modifier une cible entière. Le dessin et les demandes de voisinage sont coalescés par `requestAnimationFrame`.

Dans DevTools, l’état se contrôle sans modifier le runtime :

```js
window.__awoneFrameMemory.snapshot()
```

La propriété `active` doit valoir `immersive`, `method` ou `null`, jamais les deux. Une section libérée doit afficher `phase: "idle"`, `decoded: 0`, `compressedMB: 0` et `canvasPixels: 1`.

## Responsive et accessibilité

- Desktop : Lenis avec `lerp: 0.09`, branché au ticker GSAP ; `lagSmoothing(0)`.
- Tactile : scroll natif, aucun Lenis ; DPR canvas plafonné à 1,5, y compris sur tablette à pointeur grossier.
- Mobile : lot optimisé, une seule bulle méthode active en bas et progression en haut ; aucun `backdrop-filter`.
- Les distances de pin valent toujours `section.offsetHeight - stage.offsetHeight`.
- Une variation de hauteur mobile seule ne déclenche aucun refresh ; largeur et
  rotation sont recalculées après 320 ms et seulement hors geste.
- Un reload au milieu d’un des deux pins restaure la position et la frame.
- `prefers-reduced-motion` ou économie de données : aucun pin, aucune séquence chargée, poster fixe et cinq étapes DOM empilées.

## Remplacer une séquence

1. Exporter des images de même ratio et numérotées `frame_0001` à `frame_NNNN` sans trou.
2. Garder au maximum 181 frames desktop. Pour la méthode mobile, échantillonner à environ 120–150 frames et 720–900 px de large.
3. Générer les variantes AVIF et WebP avec des noms strictement identiques dans les dossiers jumeaux (`lot` et `lot-avif`).
4. Déposer le nouvel export dans un dossier versionné, par exemple `/frames/method-v2`, puis modifier `data-frame-root`. Ne pas réutiliser une URL déjà mise en cache avec `immutable`.
5. Sur Cloudinary, Bunny ou un autre CDN, conserver l’arborescence, autoriser le CORS pour `awone.fr` et appliquer `Cache-Control: public, max-age=31536000, immutable`.
6. Lancer `npm run build`, tester les allers-retours entre les deux sections et vérifier le snapshot mémoire ci-dessus.

Le dépôt configure ce cache long pour `/frames/*` sur Vercel dans `vercel.json`. Un CDN externe peut être utilisé en remplaçant uniquement `data-frame-root`.
