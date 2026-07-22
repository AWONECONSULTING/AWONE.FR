# Méthode immersive — maintenance

La section `#methode` remplace l’ancienne présentation « Les 5 clés ». Son HTML éditorial et les positions desktop sont dans `src/components/Methode.astro`, son rendu dans `src/styles/global.css`, et son moteur dans `src/scripts/main.js` sous le bloc `Méthode immersive`.

## Réglages exposés

- `data-frame-root` : racine locale ou CDN des deux jeux d’images.
- `data-frame-count` : nombre de frames, plafonné à 181 dans le moteur.
- `data-scroll-screens` : longueur du scrub, actuellement `5.8` écrans.
- `data-scrub` : amortissement ScrollTrigger, actuellement `0.6`.
- `METHOD_CONFIG` : concurrence de préchargement, plafonds DPR/pixels, seuils de fondu, frame statique et debounce du resize.
- tableau `steps` : textes, positions en pourcentage et côté d’ancrage des bulles.

Les fichiers actuels sont servis depuis :

```text
public/frames/method/desktop/frame_0001.webp … frame_0181.webp
public/frames/method/mobile/frame_0001.webp  … frame_0181.webp
```

Le poster initial est la première frame mobile, légère. Le lot complet ne part qu’à l’approche de la section (`IntersectionObserver`, marge de 1,5 écran), puis chaque image doit terminer `decode()` avant l’activation du scrub.

## Remplacer la séquence

1. Exporter au maximum 181 frames, toutes au même ratio et avec une numérotation continue sur quatre chiffres.
2. Produire un lot desktop (1440 px actuellement) et un lot mobile (900 px actuellement).
3. Remplacer le contenu des deux dossiers sans mélanger les dimensions.
4. Si le nombre change, modifier `data-frame-count`; ne pas dépasser 181.
5. Lancer `npm run build`, puis contrôler au minimum 360, 768, 1024, 1440, 1920 et 2560 px, ainsi que le paysage mobile et `prefers-reduced-motion`.

Pour passer sur Cloudinary ou Bunny, déposer les deux dossiers avec la même arborescence, remplacer `data-frame-root` par l’URL CDN et activer un cache immuable versionné. Les sources livrées sont uniquement en WebP : générer les variantes AVIF côté CDN avant d’activer une négociation AVIF/WebP.
