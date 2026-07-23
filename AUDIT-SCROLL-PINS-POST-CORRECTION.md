# Re-audit des séquences épinglées — AWONE

Audit final réalisé le 23 juillet 2026 sur le build statique servi par
`astro preview`. Référence avant correction : commit `4e8d35d`. Référence
finale testée : `217b936`.

## Verdict

Le cran à l'entrée et à la sortie des deux sections n'est plus reproduit.
Les causes démontrées par le premier audit ont été corrigées sans changer le
design, les textes, les CTA ni les autres sections :

1. le pin existe désormais avant le téléchargement des images ;
2. sa distance correspond exactement à la hauteur réellement réservée ;
3. un premier lot décodé rend le canvas jouable sans attendre tout le lot ;
4. aucun `refresh()` n'est lancé pendant un geste ou après le chargement des
   frames ;
5. les variations de hauteur dues à la barre d'URL mobile sont ignorées ;
6. une sortie rapide finalise immédiatement le scrub ;
7. le rechargement à mi-pin retrouve exactement la position et la frame.

## Environnement réellement audité

- Astro `7.1.3`, sortie statique ;
- GSAP / ScrollTrigger `3.15.0` installés localement ;
- Lenis `1.3.25`, importé uniquement sur pointeur précis ;
- Chrome headless, Lighthouse `13.4.1` ;
- preview : `http://127.0.0.1:4330/`.

## 1. Inventaire final des ScrollTrigger

Trois ScrollTrigger seulement sont instanciés.

| Déclencheur | Localisation | Options constatées |
|---|---|---|
| Hero morph | `src/scripts/main.js:191-199` | `pin`: absent ; `pinSpacing`: absent ; `pinType`: absent ; `anticipatePin`: absent ; `scrub`: `0.42` desktop / `0.62` mobile ; `snap`: absent ; `start: "top top"` ; `end: "bottom bottom"` ; `invalidateOnRefresh: true` ; `fastScrollEnd`: absent ; `preventOverlaps`: absent |
| Ascension | `src/scripts/immersive-sequence.js:394-418` | `pin: stage` ; `pinSpacing: false` ; `pinType: "transform"` ; `anticipatePin: 1` ; `scrub: 0.65` desktop / `0.55` mobile ; `snap`: absent du ScrollTrigger ; `start: "top top"` ; `end: "+=" + (section.offsetHeight - stage.offsetHeight)` ; `invalidateOnRefresh: true` ; `fastScrollEnd: true` ; `preventOverlaps`: absent |
| Méthode | `src/scripts/method-sequence.js:459-486` | `pin: stage` ; `pinSpacing: false` ; `pinType: "transform"` ; `anticipatePin: 1` ; `scrub: 0.6` ; `snap`: absent du ScrollTrigger ; `start: "top top"` ; `end: "+=" + (section.offsetHeight - stage.offsetHeight)` ; `invalidateOnRefresh: true` ; `fastScrollEnd: true` ; `preventOverlaps`: absent |

Les valeurs éditables sont conservées dans
`src/components/ImmersiveSequence.astro:14-22` et
`src/components/Methode.astro:48-54`.

Impact final : aucun chevauchement entre les deux pins. `preventOverlaps`
n'apporterait donc rien et pourrait au contraire terminer un trigger sans
raison.

## 2. Snap

Constat :

- aucun `snap`, `snapTo`, `directional`, `duration` de snap ou `inertia` dans
  les trois ScrollTrigger ;
- `snap: {frame: 1}` existe sur les tweens des playheads
  (`immersive-sequence.js:425` et `method-sequence.js:457`) ;
- ce snap arrondit seulement un numéro de frame. Il ne déplace jamais la page ;
- le `scroll-snap-type: x proximity` de `global.css:1213` appartient au
  carrousel horizontal « Situations » et n'agit pas sur l'axe vertical.

Impact : neutre. Aucun scroll vertical ne peut être recapturé par un snap.

## 3. Smooth scroll et cohabitation GSAP

Constat :

- un seul smooth scroll : Lenis, `main.js:91-121` ;
- Lenis est désactivé sur tactile et en mouvement réduit ;
- `lerp: 0.09`, `smoothWheel: true`, `syncTouch: false`,
  `wheelMultiplier: 0.95` ;
- synchronisation correcte :
  `lenis.on("scroll", ScrollTrigger.update)` et
  `gsap.ticker.add(time => lenis.raf(time * 1000))` ;
- aucun ScrollSmoother, Locomotive ou second Lenis ;
- aucun `scrollerProxy`, inutile ici car Lenis pilote le scroll natif du
  document.

Impact : neutre après correction. Le tactile reste entièrement natif.

## 4. CSS susceptible d'influencer le scroll

Constat :

- `html { scroll-behavior: smooth }` est conservé pour les ancres ;
- `html.lenis { scroll-behavior: auto }` neutralise cette règle sous Lenis ;
- aucun `scroll-snap-type` vertical ;
- aucun `overflow: hidden` permanent sur `html` ou `body` ;
- `body.menu-open { overflow: hidden }` ne concerne que le menu ouvert ;
- stages : fallback `100vh`, valeur finale `100svh`
  (`global.css:274-278` et `881-888`) ;
- sections : hauteurs en `svh`, sans wrapper `height: 100%` ;
- `pinSpacing: false` est cohérent avec la hauteur déjà réservée ;
- `contain: layout paint style` sur les stages et `contain: strict` sur les
  canvas.

Impact : la géométrie est stable. Le `scroll-behavior` des ancres n'intervient
pas dans les gestes molette ou tactiles testés.

## 5. Initialisation et préchargement

Avant correction, les ScrollTrigger étaient créés après le chargement et le
décodage du lot entier. L'insertion tardive du `pin-spacer`, suivie d'un
`ScrollTrigger.refresh()`, pouvait donc modifier la position pendant le geste.

État final :

- les deux contrôleurs sont importés dès `main.js:6-7` ;
- chaque `initScrollSequence()` est exécuté avant toute requête de frame
  (`immersive-sequence.js:274-282`, `method-sequence.js:263-271`) ;
- premier lot jouable : 12 frames mobile ou 15 desktop ;
- le reste chauffe en arrière-plan ;
- le premier lot est centré sur la position réelle du playhead, y compris
  après restauration à mi-page ;
- le loader continue de 0 à 100 % pendant le chargement de fond ;
- aucun `ScrollTrigger.refresh()` après `onPlayable` ou `onReady` ;
- les posters et le logo de sortie restent différés jusqu'à l'approche de la
  section.

Test réseau lent : à l'activation mobile, le canvas est devenu jouable à
`12/91` frames, puis le lot a continué jusqu'à `91/91` sans exception et sans
insertion tardive de spacer.

Impact : bloquant avant correction, corrigé.

## 6. Rendu des frames

Constat final :

- rendu `canvas.drawImage`, jamais un swap de `<img src>` ni une vidéo seekée ;
- `img.decode()` est exécuté en amont dans les workers asynchrones ;
- aucun décodage synchrone dans `ScrollTrigger.onUpdate` ;
- `onUpdate` modifie seulement une cible ;
- le dessin est coalescé par `requestAnimationFrame` ;
- un index déjà dessiné n'est pas redessiné ;
- le cache décodé est borné et suit la frame cible ;
- DPR limité à `2`, et à `1.5` sur mobile/pointeur grossier ;
- budgets canvas : 3,2 Mpx desktop, 1,8 Mpx mobile ;
- `createImageBitmap()` n'a pas été ajouté : les mesures CPU ×4 ne montrent
  aucune tâche longue pendant les scrubs, donc sa complexité et ses différences
  Safari ne sont pas justifiées.

Impact : aucune tâche longue de scroll mesurée.

## 7. Nombre et poids des frames réellement servies

| Séquence | Desktop AVIF / WebP | Mobile AVIF / WebP |
|---|---:|---:|
| Ascension | 181 · 6,59 / 11,65 Mio | 91 · 2,04 / 2,66 Mio |
| Méthode | 181 · 9,98 / 18,21 Mio | 121 · 2,28 / 3,70 Mio |

Le navigateur choisit AVIF puis WebP en repli. Aucune frame, aucun poster de
séquence et aucun logo de sortie n'est demandé au premier écran.

## 8. Compositing et mémoire

Constat :

- `contain` est limité aux deux stages et aux deux canvas ;
- les `force3D` existants concernent les éléments animés du récit ;
- le cache maximum reste à 16/22 images pour l'ascension desktop/mobile et
  20/32 pour la méthode desktop/mobile ;
- une seule séquence détient ses blobs et images à la fois ;
- après libération : canvas `1 × 1`, cache décodé à zéro ;
- LayerTree Chrome : 74 couches au premier écran, 74 dans l'ascension et 74
  dans la méthode. L'entrée dans une séquence n'ajoute donc aucune explosion
  de couches.

Impact : neutre après correction.

## 9. Barre d'URL et resize mobile

Constat :

- `ScrollTrigger.config({ignoreMobileResize: true})` dans
  `src/scripts/motion.js:5` ;
- stages en `100svh` ;
- debounce resize porté à 320 ms ;
- si ScrollTrigger signale un scroll en cours, le recalcul attend ;
- sur pointeur grossier, une variation de hauteur seule ne lance aucun refresh ;
- un changement de largeur ou une rotation force le recalcul ;
- aucun refresh pendant le chargement des images.

Test ciblé :

- hauteur seule `844 → 744` : `delta scrollY = 0`, zéro mutation du spacer ;
- largeur `390 → 430` : canvas et spacer recalculés après le délai ;
- rotation `430 × 744 → 844 × 390` : recalcul forcé, aucun retour arrière.

Impact : aggravant avant correction, corrigé.

## Diff appliqué, fichier par fichier

| Fichier | Modification | Justification |
|---|---|---|
| `src/scripts/frame-sequence.js` | Premier lot jouable, chargement de fond, cible prioritaire, décodage async et cache borné | Retirer l'attente bloquante de tout le lot et le décodage du chemin critique |
| `src/scripts/immersive-sequence.js` | Pin immédiat, distance réelle, scrub amorti conservé, `anticipatePin`, `fastScrollEnd`, rendu dédupliqué, resize différé, visuels différés | Supprimer le spacer tardif, le décalage `svh/innerHeight`, le rattrapage de sortie et les refresh mobiles |
| `src/scripts/method-sequence.js` | Même stratégie, sans changer les cinq étapes ni leur label | Garantir le même comportement sur la seconde séquence |
| `src/scripts/main.js` | Contrôleurs importés immédiatement ; restauration limitée aux deux plages pinned | Créer les pins avant les frames et préserver un reload à mi-page |
| `src/styles/global.css` | Le loader méthode reste visible jusqu'à `is-loaded` | Conserver la progression 0 → 100 % pendant le chargement de fond |

## Commits isolés

1. `6a94350` — `fix(scroll): aligner la fin des pins sur la hauteur reservee`
2. `62aa26f` — `fix(scroll): initialiser les pins avant les frames`
3. `8857dae` — `perf(frames): demarrer apres un premier lot decode`
4. `eae2d87` — `fix(scroll): ignorer les resizes mobiles pendant le geste`
5. `2843461` — `fix(scroll): finaliser les sequences lors des sorties rapides`
6. `f886542` — `fix(scroll): restaurer la position au milieu des pins`
7. `217b936` — `perf(frames): differer les visuels jusqu a l approche`

Chaque changement conceptuel peut être testé ou annulé séparément.

## Critères d'acceptation

| # | Résultat | Mesure |
|---|---|---|
| 1. Trois crans rapides, ascension desktop | **OK** | Entrée/sortie dans les deux sens, 4 scénarios, zéro inversion et frontière toujours traversée |
| 2. Swipe rapide iOS/Android | **OK automatisé** | Profils Safari iOS 390 × 844 et Chrome Android 412 × 915, 16 traversées entrée/sortie, zéro inversion, zéro overflow horizontal |
| 3. Méthode et transition suivante | **OK** | 4 frontières desktop + 8 tactiles ; sortie vers `#transformation`, aucun palier ni shift |
| 4. Aucune long task > 50 ms pendant le scroll CPU ×4 | **OK** | Zéro entrée `longtask` sur les deux séquences desktop et mobile ; RAF max 16,8 ms |
| 5. CLS = 0 aux frontières | **OK** | Zéro `layout-shift` aux entrées et sorties ; Lighthouse global : 0,005 mobile, 0 desktop |
| 6. Performance mobile et INP | **OK local / production à confirmer** | Lighthouse mobile 98, identique à la dernière référence de production, TBT 0 ms ; événements tactiles max 40 ms, délai max 2,9 ms |
| 7. Reload à mi-page | **OK** | Desktop méthode et mobile ascension : `deltaY = 0`, même frame avant/après |

La passe PageSpeed Insights publique reste à refaire après déploiement, car
localhost ne mesure ni CDN ni cache Vercel. L'INP de terrain nécessite des
données réelles ; la mesure locale Event Timing reste très inférieure à
200 ms.

## Vérifications complémentaires

- `npm run build` : OK ;
- `npm run preview` : OK ;
- Lighthouse mobile : 98/100 performance, 100 accessibilité, 100 bonnes
  pratiques, 100 SEO, FCP 1,9 s, LCP 2,1 s, TBT 0 ms, CLS 0,005, 175 Kio ;
- Lighthouse desktop : 100/100 sur les quatre catégories, FCP/LCP 0,7 s,
  TBT 0 ms, CLS 0, 210,3 Kio ;
- matrice 320, 360, 390, 430, 768, 844 paysage, 1024, 1440 et 1920 px :
  zéro overflow horizontal, spacer présent dès le chargement ;
- mode mouvement réduit : aucun pin, zéro frame, cinq étapes visibles ;
- parcours intégral mobile et desktop : zéro HTTP ≥ 400, zéro échec réseau,
  zéro exception, zéro erreur ou avertissement console ;
- dernière frame atteinte environ 12 ms après une sortie rapide ;
- scroll rapide desktop et tactile : aucune valeur de scroll ne repart en
  arrière.

Le build garde deux avertissements déjà présents sur les chunks différés HLS
et DASH ; aucun nouvel avertissement n'a été introduit.

## Risques résiduels et éléments non touchés

Risques résiduels :

1. les profils iOS/Android sont des émulations Chrome ; une passe sur appareils
   physiques reste nécessaire pour la pression mémoire et le décodage Safari ;
2. PageSpeed Insights public et l'INP de terrain doivent être contrôlés après
   déploiement ;
3. la fluidité sous réseau très instable dépendra toujours du CDN, mais le
   poster et le premier lot empêchent désormais le pin de s'initialiser tard.

Choix volontairement non appliqués :

- pas de `snap` ScrollTrigger ;
- pas de `preventOverlaps`, car les triggers ne se chevauchent pas ;
- pas de `pinType: fixed` : `transform` est stable sur les profils testés et
  évite les particularités de `position: fixed` mobile ;
- pas de `createImageBitmap`, faute de gain démontré ;
- pas de nouvelle librairie ni de CDN.

Sections non modifiées : hero morph, roue libre des marques, carrousel
Situations, équipe, offre/vidéo, footer, popup iClosed. Aucun texte, couleur,
typographie, CTA ou nombre d'étapes n'a été changé.
