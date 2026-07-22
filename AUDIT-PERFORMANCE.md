# Audit performance et stabilité — AWONE

Audit local de production réalisé le 22 juillet 2026 sur le build Astro 7.1.3, avec Lighthouse 13.4.1 et Google Chrome. Les mesures Lighthouse couvrent le premier écran ; les séquences et interactions ont aussi été parcourues jusqu’au footer dans des sessions Chrome séparées.

## Résultat

| Profil | Performance | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS | Transfert initial |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile, 390 × 844 | **100** | **100** | **100** | **100** | 1,3 s | 1,5 s | 10 ms | 0,005 | 167 Kio |
| Desktop, 1440 × 900 | **100** | **100** | **100** | **100** | 0,4 s | 0,5 s | 0 ms | 0,001 | 203 Kio |

Contrôle après correction des deux séquences, le 23 juillet 2026 : deux passes Lighthouse mobile de production donnent **99/100 en performance**, **100/100** en accessibilité, bonnes pratiques et SEO, FCP 1,3 s, LCP 1,9 s, TBT 20–30 ms et CLS 0,005. Aucune frame ni aucun poster sous la ligne de flottaison n’est demandé au démarrage. L’écart d’un point avec la mesure précédente se situe dans la variabilité du chargement des fontes Fontshare ; CLS reste identique et aucune tâche de décodage des séquences ne touche le premier écran.

## Contrôle ciblé — vidéo « Boost AWONE » (23 juillet 2026)

Le défaut d’autoplay venait d’un verrou mémoire encore détenu par la séquence « Les 5 clés » après sa sortie visuelle. Le module vidéo était bien exécuté, mais refusait alors d’attribuer son manifeste : `currentSrc` restait vide, `readyState` à 0 et aucune requête HLS ne partait.

La séquence libère désormais son lot rapidement derrière le sens du scroll tout en conservant 1,5 écran de préchargement devant lui. Le lecteur force `muted`, `defaultMuted` et `playsInline` avant d’attribuer la source, attend les événements média, retente proprement la lecture et ne masque plus les erreurs. Il reste en pause hors écran, reprend au retour et détruit ses buffers lorsqu’une séquence 3D visible réclame la mémoire.

| Profil de production actuel | Performance | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS | Transfert initial |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile Lighthouse | **98** | **100** | **100** | **100** | 1,9 s | 2,1 s | 0 ms | 0,005 | 168 Kio |
| Desktop Lighthouse | **100** | — | — | — | 0,6 s | 0,6 s | 0 ms | 0 | 203 Kio |

Parcours instrumenté en émulation tactile 390 × 844 : **10,003 s** de lecture continue, **301 frames rendues, 0 frame abandonnée**, aucune frame corrompue, **0 tâche longue**, aucune erreur réseau ou JavaScript et 3,49 Mio de média adaptatif transférés. Le HLS natif et le chemin de secours HLS.js ont tous deux été lus sans erreur ; le temps vidéo progresse, en mode muet, sur desktop et mobile. Au premier écran, le module vidéo et le manifeste Cloudflare restent absents du réseau. À hauteur de l’offre, les deux séquences de frames sont à `idle`, sans image décodée ni canvas lourd résident.

Ces contrôles navigateur ne remplacent pas une passe finale sur un iPhone et un Android physiques, indispensable pour valider le décodage matériel, la pression mémoire Safari et les conditions réseau réelles.

Le transfert mesuré inclut désormais les quatre à cinq graisses WOFF2 réellement utilisées au premier écran. Elles sont récupérées de façon fiable directement sur le CDN Fontshare, alors que l’ancienne feuille CSS distante ajoutait une chaîne bloquante et pouvait finir la mesure avant le chargement de toutes les fontes.

Le chemin local initial reste léger :

| Ressource critique | Brut | Gzip |
|---|---:|---:|
| HTML | 53,9 Ko | 11,9 Ko |
| CSS total | 65,2 Ko | 14,5 Ko |
| JS principal | 123,3 Ko | 47,3 Ko |

Le JS principal baisse d’environ 17,5 % en brut et 13,5 % après gzip. Lenis reste séparé et n’est chargé que sur les appareils à pointeur précis.

## Correctifs appliqués

### Chargement initial

- La feuille Fontshare distante bloquante a été supprimée. Les déclarations `@font-face` équivalentes sont intégrées au CSS local, tout en laissant les fichiers de police sur le CDN officiel comme l’exige leur licence.
- Les fontes critiques et le logo LCP de la navigation sont préchargés avec leur priorité explicite. Lighthouse valide maintenant les trois contrôles de découverte du LCP.
- Les deux grands logos disposent de variantes WebP responsive : 600 px pour la sortie immersive et 360 px pour la carte du hero. L’audit « image delivery » ne remonte plus aucun octet évitable.
- Le logo de sortie immersive n’est demandé qu’au chargement du moteur de cette section, au lieu d’être récupéré au premier écran.
- La feuille CSS de Lenis a été consolidée dans le CSS principal, ce qui retire une requête bloquante.

### Découpage JavaScript

Les moteurs sous la ligne de flottaison sont maintenant des modules indépendants, demandés plusieurs écrans avant leur section :

| Module différé | Brut | Gzip |
|---|---:|---:|
| Marques | 2,7 Ko | 1,1 Ko |
| Immersive | 9,2 Ko | 3,6 Ko |
| Gestionnaire de frames partagé | 6,1 Ko | 2,6 Ko |
| Situations | 6,1 Ko | 2,2 Ko |
| Méthode | 9,7 Ko | 3,8 Ko |
| Vidéo | 5,4 Ko | 2,4 Ko |

Le premier écran mobile ne demande que le script principal. Le desktop ajoute Lenis ; aucun des six modules ci-dessus n’est téléchargé avant le scroll. Les lecteurs HLS et DASH restent eux-mêmes différés jusqu’à la visibilité de la vidéo.

### Mémoire des deux séquences

Un arbitre commun empêche désormais « On élève votre marque » et « Les 5 clés » de garder simultanément leurs blobs, images ou canvas alloués. L’entrée d’une section libère d’abord l’autre ; à distance, le tableau est vidé, les URLs objet sont révoquées et le canvas revient à **1 × 1**.

Toutes les frames du lot actif sont téléchargées et passent par `img.decode()` avant que le scrub soit activé. Seul un voisinage décodé borné reste ensuite résident :

| Séquence | Desktop | Mobile |
|---|---:|---:|
| Ascension | 16 images · ~127,5 Mio | 22 images · ~77,9 Mio |
| Méthode | 20 images · ~89 Mio | 32 images · ~35,6 Mio |

Le premier essai qui retenait les 181 surfaces de l’ascension a atteint la limite du navigateur vers la 100e frame. Le cache borné évite donc une allocation théorique supérieure à 1 Gio tout en gardant le décodage hors du gestionnaire de scroll. Un poster basse définition reste sous chaque canvas pendant le chargement et après toute purge.

### Économie de données et mouvement réduit

La séquence « Méthode » respecte maintenant `navigator.connection.saveData`, comme la séquence immersive. En mode économie de données ou `prefers-reduced-motion`, chaque séquence reste lisible en version statique et ne charge qu’une image.

### Robustesse fonctionnelle

- Les CTA de réservation sont de vrais liens de secours. Le popup reste inchangé quand JavaScript et iClosed fonctionnent ; sans JavaScript ou si le widget échoue, la page de réservation reste accessible.
- Les identifiants des dégradés SVG sont maintenant uniques dans les clones du carrousel « Situations », sans modification de leurs couleurs ni de leur rendu.

### Dépendances

- Astro mis à jour de 7.0.7 à **7.1.3**.
- SVGO mis à jour à **4.0.2**.
- `npm audit --omit=dev` : **0 vulnérabilité**.

## Poids des séquences

Le dossier de production complet pèse **46,31 Mio**, principalement parce qu’il contient les variantes mobile et desktop. Un navigateur ne demande que la variante adaptée et seulement à l’approche de la section.

| Séquence | Desktop AVIF / WebP | Mobile AVIF / WebP |
|---|---:|---:|
| Immersive | 181 frames · 6,59 / 11,65 Mio | 91 frames · 2,04 / 2,66 Mio |
| Méthode | 181 frames · 9,98 / 18,21 Mio | 121 frames · 2,28 / 3,70 Mio |
| Total parcouru | **16,57 / 29,86 Mio** | **4,32 / 6,36 Mio** |

Ces fichiers ne font pas partie du chargement initial de 167–203 Kio. Ils doivent néanmoins être servis avec un cache long et, idéalement, depuis un CDN proche des visiteurs.

## Vérifications fonctionnelles

- Build de production et syntaxe JS validés.
- Les 786 variantes AVIF/WebP nouvellement produites ont une numérotation continue et les dimensions attendues ; le build contient 1 424 fichiers de frames et posters en comptant les sources conservées.
- Toutes les références locales du HTML existent dans `dist/`.
- Aucun échec réseau local, erreur console ou exception pendant les parcours mobile et desktop.
- Aucun module sous la ligne de flottaison n’est chargé au premier écran. Chaque module est ensuite disponible avant son interaction cible.
- Scrub desktop instrumenté : 176 changements distincts sur 181 pour l’ascension et 178 sur 181 pour la méthode, sans tâche longue ni intervalle RAF supérieur à 10 ms dans Chrome headless 120 Hz.
- Geste tactile synthétisé en 390 × 844 : 90 changements sur 90 pour l’ascension et 119 sur 120 pour la méthode, sans tâche longue ; les canvas retina mesurent 585 × 1266, soit un DPR effectivement plafonné à 1,5.
- Aller-retour entre les récits validé : une seule séquence active, lot précédent à zéro, canvas précédent 1 × 1 et poster visible pendant le rechargement.
- Matrice 360, 390, 768, 1024, 1440, 1920, 2560 px et paysage 844 × 390 : aucune largeur parasite et hauteurs réservées stables.
- Le mode mouvement réduit ne crée aucun pin, ne charge aucun lot et affiche les cinq étapes dans le DOM.
- Les logos responsive sélectionnent bien la variante 360 px sur mobile et l’original 720 px sur desktop ; aucune largeur horizontale parasite n’est créée.
- Menu mobile, fermeture par Échap, carrousels clavier/souris, bouton son, lecture Cloudflare, CTA iClosed, année dynamique et états de scroll vérifiés.
- Les feuilles Fontshare, le widget iClosed, les manifestes HLS/DASH et le lien Instagram répondaient en HTTP 200 pendant l’audit.
- Canonical, sitemap et robots pointent vers `https://awone.fr/`.

## Points à surveiller au déploiement

1. Activer Brotli ou gzip pour HTML, CSS et JS.
2. Servir `/_astro/`, `/assets/`, `/icons/` et `/frames/` avec un cache immuable versionné. Invalider l’URL du dossier de frames lors d’un nouvel export.
3. Placer les frames sur un CDN si l’audience est géographiquement distribuée.
4. Refaire PageSpeed Insights sur l’URL publique : latence serveur, CDN et cache réel ne peuvent pas être mesurés fidèlement sur localhost.
5. Le build signale deux gros chunks différés : HLS (510 Ko) et DASH (819 Ko). Ils servent uniquement de lecteurs vidéo de secours et ne sont pas téléchargés au premier écran ; les supprimer réduirait la robustesse multi-navigateur.
6. Lighthouse estime encore 20–21 Kio de JS initial inutilisé, principalement dans GSAP utilisé par le hero. Le retirer ou le remplacer modifierait directement les mouvements du premier écran ; le conserver est le compromis retenu avec un score de 100 sur les deux profils.
