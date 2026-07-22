# Audit performance et stabilité — AWONE

Audit local de production réalisé le 22 juillet 2026 sur le build Astro 7.1.3, avec Lighthouse 13.4.1 et Google Chrome. Les mesures Lighthouse couvrent le premier écran ; les séquences et interactions ont aussi été parcourues jusqu’au footer dans des sessions Chrome séparées.

## Résultat

| Profil | Performance | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS | Transfert initial |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile, 390 × 844 | **99** | **100** | **100** | **100** | 1,5 s | 1,7 s | 10 ms | 0 | 113 Kio |
| Desktop, 1440 × 900 | **100** | **100** | **100** | **100** | 0,4 s | 0,4 s | 0 ms | 0 | 118 Kio |

Le chemin initial reste léger :

| Ressource critique | Brut | Gzip |
|---|---:|---:|
| HTML | 53,9 Ko | 11,9 Ko |
| CSS total | 64,0 Ko | 13,8 Ko |
| JS principal | 149,4 Ko | 54,7 Ko |

Lenis est désormais séparé du bundle principal et chargé uniquement sur les appareils à pointeur précis. Le mobile évite ainsi ce code et le JS principal transféré baisse d’environ 7 %.

## Correctifs appliqués

### Pic mémoire de la séquence « Méthode »

Le moteur conservait auparavant les 181 frames entièrement décodées avant d’activer l’animation. En RGBA, cela représentait théoriquement environ **805 Mio en desktop** et **314 Mio en mobile**, hors canvas et surcoût navigateur.

Le nouveau moteur :

- précharge les mêmes fichiers WebP sous forme compressée ;
- décode uniquement la frame demandée et ses voisines ;
- borne le cache à 12 images desktop et 10 images mobile ;
- libère les `ImageBitmap` éloignées ;
- conserve les 181 frames, la résolution du canvas, le timing GSAP et les étapes visuelles existantes.

Le plafond théorique de pixels décodés passe ainsi à environ **53 Mio desktop** et **17 Mio mobile**, soit une réduction supérieure à 93 %. Les contrôles automatisés ont retrouvé exactement les frames 1, 46, 91, 136 et 181 aux positions attendues sur desktop, ainsi que 1, 37, 73, 109, 145 et 181 sur mobile.

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

| Séquence | Desktop | Mobile |
|---|---:|---:|
| Immersive | 181 frames · 11,65 Mio | 91 frames · 2,66 Mio |
| Méthode | 181 frames · 18,21 Mio | 181 frames · 11,93 Mio |
| Total parcouru | **29,86 Mio** | **14,59 Mio** |

Ces fichiers ne font pas partie du chargement initial de 113–118 Kio. Ils doivent néanmoins être servis avec un cache long et, idéalement, depuis un CDN proche des visiteurs.

## Vérifications fonctionnelles

- Build de production et syntaxe JS validés.
- 641 images raster décodées sans erreur ; dimensions et numérotation des 634 frames validées.
- Toutes les références locales du HTML existent dans `dist/`.
- Aucun échec réseau local, erreur console ou exception pendant les parcours mobile et desktop.
- Menu mobile, fermeture par Échap, carrousels clavier/souris, bouton son, lecture Cloudflare, CTA iClosed, année dynamique et états de scroll vérifiés.
- Les feuilles Fontshare, le widget iClosed, les manifestes HLS/DASH et le lien Instagram répondaient en HTTP 200 pendant l’audit.
- Canonical, sitemap et robots pointent vers `https://awone.fr/`.

## Points à surveiller au déploiement

1. Activer Brotli ou gzip pour HTML, CSS et JS.
2. Servir `/_astro/`, `/assets/`, `/icons/` et `/frames/` avec un cache immuable versionné. Invalider l’URL du dossier de frames lors d’un nouvel export.
3. Placer les frames sur un CDN si l’audience est géographiquement distribuée.
4. Refaire PageSpeed Insights sur l’URL publique : latence serveur, CDN et cache réel ne peuvent pas être mesurés fidèlement sur localhost.
5. Le build signale deux gros chunks différés : HLS (510 Ko) et DASH (819 Ko). Ils servent uniquement de lecteurs vidéo de secours et ne sont pas téléchargés au premier écran ; les supprimer réduirait la robustesse multi-navigateur.
6. Lighthouse estime encore environ 21 Kio d’images redimensionnables et 23 Kio de JS initial inutilisé. Le gain est faible face aux scores actuels ; toute optimisation supplémentaire des polices ou animations doit être validée visuellement pour éviter un changement de typographie ou de mouvement.
