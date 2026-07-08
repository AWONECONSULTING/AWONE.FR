# Audit de performance — Landing AWONE (build Astro)
*Réalisé avant hébergement · build de production `astro build` v4.16*

## 1. Poids mesurés (compression gzip niveau 9)

| Ressource | Brut | Gzip | Chargement |
|---|---|---|---|
| index.html (minifié) | 46,9 K | **10,4 K** | critique |
| CSS (minifié, 1 fichier) | 50,2 K | **11,1 K** | critique |
| JS bundlé (GSAP inclus) | 123,1 K | **47,4 K** | différé (module) |
| Logo nav/footer (webp) | 14 K | 14 K | préchargé |
| Logo morph pleine résolution (png) | 39,6 K | 37,9 K | hero |
| 16 icônes pôles (svg) | 116,5 K | 37,6 K | **lazy** (sous la ligne de flottaison) |
| 3 portraits fondateurs (webp) | 143,2 K | 143,2 K | **lazy** |
| **Première peinture (HTML+CSS+JS+logos)** | 274,7 K | **≈ 122 K** | |
| **Site complet** | 534,4 K | **≈ 303 K** | |

Repères : la médiane web mondiale est ~2 400 K par page. Cette landing complète,
avec toutes ses animations, pèse **8× moins que la médiane** ; le chemin critique
gzippé (~122 K) se charge en < 1 s sur une 4G correcte.

## 2. Ce que la migration Astro apporte concrètement
- **HTML divisé par 12** (576 K monolithique → 47 K) : logos, portraits et icônes
  sortis du HTML vers des fichiers **cachables** (2e visite quasi instantanée,
  hash de version dans les noms `_astro/*` → cache long terme sans risque).
- **CSS et JS minifiés** au build (esbuild), HTML compressé (`compressHTML`).
- **GSAP intégré au bundle npm** (plus de CDN tiers) : les animations
  fonctionnent **hors-ligne et en local**, latence tierce supprimée,
  et plus de scénario "CDN lent = fallback statique".
- **Chargement différé natif** : le JS est un module (non bloquant),
  icônes et portraits en `loading="lazy"`.
- Architecture en **15 composants** (`src/components/`) : chaque section
  est isolée et modifiable sans risque pour les autres.

## 3. Vérifications effectuées sur le build
- ✅ Build de production sans erreur ni avertissement.
- ✅ HTML du dist parsé valide ; **23/23 références locales existantes** (zéro 404 interne).
- ✅ Bundle JS : présence vérifiée de toutes les mécaniques (morph hero, deux
  carrousels roue libre, lueur curseur, résolveur de teintes bidirectionnel,
  popup iClosed + intercepteur, sticky CTA, sections météorites).
- ✅ CSS : tous les keyframes d'effets présents (météorites, comètes portraits,
  capsules, icône du ciel, surbrillance marques, univers soleil).
- ✅ Syntaxe JS validée (`node --check`) avant bundling.
- ✅ Responsive : mêmes effets sur tous les écrans, variantes allégées ≤768px,
  `prefers-reduced-motion` respecté partout.

## 4. ⚠️ Tester en local : OBLIGATOIREMENT via un serveur
Le JS est un module ES : **ouvrir `dist/index.html` en double-clic (`file://`)
ne charge PAS les scripts** (sécurité navigateur). Pour tester en local :

    npm install        # une seule fois
    npm run preview    # sert le build sur http://localhost:4321

(ou `npx serve dist`). Le popup iClosed et les polices Fontshare nécessitent
de toute façon une connexion ; iClosed refuse `file://` (voir échange précédent).

## 5. Reste à faire côté hébergement (recommandations)
1. **Activer gzip/brotli** sur le serveur (Apache/Nginx/o2switch : souvent déjà actif).
   Brotli ferait encore ~-15% sur HTML/CSS/JS.
2. **Cache long** sur `/_astro/*`, `/assets/*`, `/icons/*` (immutable, 1 an).
3. Déposer `offre-awone.mp4` à la racine pour la section vidéo (sinon fallback Drive).
4. Lancer **PageSpeed Insights** une fois en ligne (l'audit Lighthouse complet
   nécessite Chrome, indisponible dans cet environnement de build — les mesures
   ci-dessus sont des poids réels, pas des estimations).
5. Si score LCP à optimiser après mise en ligne : le candidat LCP est le titre
   du hero (texte → excellent) ; vérifier que Fontshare répond vite, sinon
   auto-héberger les 2 polices (je peux le faire).

## 6. Déploiement
Uploadez **le contenu du dossier `dist/`** à la racine de votre hébergement.
Pour modifier le site : éditez `src/`, puis `npm run build` régénère `dist/`.
