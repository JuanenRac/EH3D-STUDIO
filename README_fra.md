<p align="center">
  <img src="images/EH3D_BANNER.svg" alt="EH3D-STUDIO banner" width="100%">
</p>

# 🧭 EH3D-STUDIO

<p align="center"><a href="README.md">🇺🇸 English</a> | <a href="README_spa.md">🇪🇸 Español</a> | 🇫🇷 <b>Français</b> | <a href="README_ita.md">🇮🇹 Italiano</a> | <a href="README_deu.md">🇩🇪 Deutsch</a> | <a href="README_zho.md">🇨🇳 中文</a> | <a href="README_jpn.md">🇯🇵 日本語</a> | <a href="README_por.md">🇵🇹 Português</a></p>

### Le panneau de configuration du serveur EH3D : les machines et leurs stations, les travaux, les utilisateurs et les jetons des programmes, le tout structuré et dans le style de BUNGARD-GUI, en huit langues.

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20TypeScript-00599C.svg" alt="React and TypeScript">
  <img src="https://img.shields.io/badge/Languages-8-00E5FF.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Version-0.0.1-0f6cbd.svg" alt="Version">
  <img src="https://img.shields.io/badge/Maturity-scaffolding-FFB020.svg" alt="Maturity">
</p>

---

**Vérification d'honnêteté - ce qui tourne aujourd'hui :** une application web en React et TypeScript qui se connecte à EH3D-SERVER et montre et modifie ce qu'il contient : les machines avec leur station, leur nœud et leurs fichiers de configuration, les travaux, les utilisateurs et les jetons, les événements en direct. Le client de l'API, les règles des formulaires, le menu par rôle et les huit langues sont couverts par 24 tests, et les pages ont été vues dans un navigateur contre un serveur local avec des machines simulées. **Elle n'a pas été utilisée avec des machines sur un banc**, et le serveur ne termine pas encore TLS.

---

> **État de sécurité (safety) et de sécurité informatique :** ceci n'est pas un système de sécurité (safety). Studio modifie ce que garde un serveur qui déplace des machines : une adresse ou un jeton de nœud erronés, une mauvaise station ou une machine supprimée peuvent arrêter un atelier ou diriger un travail vers la mauvaise machine, et un jeton créé ici permet à un programme d'envoyer des travaux. Le serveur vérifie le rôle de la personne à chaque requête ; cacher un bouton n'est qu'un confort. Sur un réseau non chiffré le jeton circule en clair (le serveur ne termine pas encore TLS) : utilisez-le sur le réseau de la maison ou par VPN. Le projet est indépendant : il n'est ni fabriqué, ni approuvé, ni soutenu par Bungard Elektronik.

## 📋 En un coup d'œil

| | |
|---|---|
| Version | `0.0.1` |
| Maturité | Échafaudage |
| Tests | 24 tests (`npm test`) |
| Pile technique | React 19, TypeScript, Vite |
| Sur du matériel réel | Pas avec des machines sur un banc : vue dans un navigateur contre un serveur local avec des machines simulées |

**Aller à  :** [Présentation](#-présentation) · [Architecture](#-architecture) · [Démarrage rapide](#-démarrage-rapide) · [Tests](#-tests) · [Structure](#-structure-du-dépôt) · [Liés](#-projets-liés)

## 🚦 État du projet

Chaque ligne est une partie de ce dépôt et le feu dit où elle en est aujourd'hui. Elle est écrite d'après ce que le dépôt peut montrer (tests, compilations, exécutions), pas d'après ce qui est prévu.

🟢 Fait et vérifié · 🟡 Fonctionne, avec des limites connues · 🟠 À moitié fait ou pas encore vérifié · 🔴 Pas fait ou ne fonctionne pas

| Domaine | État | Ce que cela veut dire ici |
|---|---|---|
| Logiciel | 🟡 | L'application se construit sans avertissement (types, lint, build) et est servie par le serveur à la racine de son adresse ; elle a tourné dans un navigateur contre un serveur local. |
| Tests | 🟢 | 24 tests réussissent (`npm test`) : le client de l'API avec ses erreurs, les règles des noms, mots de passe et adresses, le menu par rôle, la flotte par station, les actions d'un travail et les huit langues. |
| Pages | 🟡 | Aperçu, machines par station, travaux, événements en direct, machines, utilisateurs et jetons, serveur, compte, préférences et à propos sont écrits ; travaux et machines se gèrent avec la vraie API du serveur. Aucune page n'a été essayée par quelqu'un d'autre que l'auteur. |
| Langues | 🟢 | Huit langues dans chaque texte, refus du serveur compris ; les textes sont lus par un test, mais seuls l'anglais et quelques phrases des autres ont été lus par une personne. |
| Machines réelles | 🔴 | Rien n'a été fait avec elle sur un banc : aucune machine ajoutée, aucun nœud atteint et aucun travail exécuté par elle sur une vraie machine. |
| Documentation | 🟢 | README en huit langues, les réglages du serveur et comment mettre Studio sur la CM5. |

## 🎯 Présentation

* **Supervision :** l'aperçu (machines libres, en marche et en attente, travaux prêts, actifs, terminés et échoués), les machines sous leurs stations avec la progression de chaque travail, la liste des travaux avec filtres et actions, et les événements en direct du serveur par son websocket.
* **Configuration :** les machines (identifiant, nom, modèle, station, un nœud avec son adresse et son jeton ou le simulateur, le texte des deux fichiers de configuration et le fichier de machine), les utilisateurs avec leur rôle, les jetons des programmes et la référence des réglages du serveur.
* **Compte :** le mot de passe de la personne, la langue, le thème et la fréquence à laquelle les pages interrogent à nouveau le serveur.
* **Le style de BUNGARD-GUI :** le thème Forge par défaut (noir chaud, ambre, cartes à deux coins coupés, boutons à contour ambre) et trois autres : Papier, Néon et Minuit.
* **Servi par le serveur :** avec `studio_dir` dans `server.cfg` le serveur sert ces pages à la racine de sa propre adresse : rien d'autre à installer et aucun réglage d'origine croisée.

## 🧩 Rôle dans EH3D

EH3D-STUDIO est à EH3D-SERVER ce qu'ARMOR-STUDIO est au serveur d'ARMOR : l'unique endroit où tout ce que le serveur garde est configuré et suivi, structuré et classé. Les programmes (EH3D-DRILLPRO, EH3D-ROUTEPRO, EH3D-BUNGARD-GUI, l'écran tactile de la machine) utilisent les jetons créés ici et les machines définies ici ; les machines elles-mêmes sont atteintes par leurs nœuds.

## 🏛️ Architecture

<p align="center">
  <img src="images/architecture.svg" alt="Architecture de EH3D-STUDIO : qui l'utilise, ce qu'il contient et de quoi il dépend" width="100%">
</p>

Comment s'assemblent les parties de ce dépôt : qui lui parle, ce qu'il contient et de quoi il dépend. Le dessin est tiré de `docs/architecture.json` et vérifié par rapport au code.

## 🖼️ Captures d'écran

<p align="center">
  <img src="images/screenshots/overview.png" alt="overview" width="100%">
</p>

<p align="center"><em>L'aperçu : machines libres, en marche et en attente, et les travaux par état.</em></p>

<p align="center">
  <img src="images/screenshots/fleet.png" alt="fleet" width="100%">
</p>

<p align="center"><em>Les machines sous leurs stations, avec l'état et la progression de chaque travail.</em></p>

<p align="center">
  <img src="images/screenshots/jobs.png" alt="jobs" width="100%">
</p>

<p align="center"><em>Les travaux avec leurs filtres et les actions que le rôle permet.</em></p>

<p align="center">
  <img src="images/screenshots/machines.png" alt="machines" width="100%">
</p>

<p align="center"><em>Les machines du serveur : station, nœud et fichiers de configuration.</em></p>

<p align="center">
  <img src="images/screenshots/access.png" alt="access" width="100%">
</p>

<p align="center"><em>Les utilisateurs avec leur rôle, et les jetons des programmes.</em></p>

<p align="center">
  <img src="images/screenshots/server.png" alt="server" width="100%">
</p>

<p align="center"><em>Les réglages du serveur, en référence.</em></p>

<p align="center">
  <img src="images/screenshots/updates.png" alt="updates" width="100%">
</p>

<p align="center"><em>La page Mises à jour : ce qui est installé, la dernière version sur GitHub et ce qu'a fait l'assistant du serveur.</em></p>

<p align="center">
  <img src="images/screenshots/preferences.png" alt="preferences" width="100%">
</p>

<p align="center"><em>Les préférences : langue, thème et actualisation.</em></p>

## ✨ Fonctionnalités

* **Chaque rôle voit son menu :** un observateur voit les pages de Supervision, la page du Serveur et celles du Compte ; un administrateur voit aussi Machines et Utilisateurs et jetons.
* **Vérifications avant l'envoi :** noms, mots de passe et adresses de nœud sont vérifiés dans le formulaire, et le refus du serveur s'affiche comme une phrase dans la langue de la personne.
* **Jetons montrés une fois :** le jeton d'un programme apparaît à sa création et plus jamais ; le jeton d'un nœud n'est jamais montré après son enregistrement.
* **Suit le serveur :** la flotte et les travaux se rafraîchissent d'eux-mêmes (ou seulement sur demande), et la page en direct se reconnecte quand la liaison tombe.
* **Mises à jour :** une page pour l'administrateur compare le serveur et Studio installés aux dernières versions sur GitHub, vérifie sur demande et met à jour ce qui est plus récent, en montrant ce que fait l'assistant du serveur pendant qu'il travaille ; quand le serveur lui-même redémarre, la page revient toute seule. La mise à jour demande `updates_dir` dans `server.cfg` et l'assistant d'EH3D-SERVER installé ; testée avec des doublures de GitHub et de systemd, jamais sur une installation réelle.

## 🔒 Sécurité et protection

| Menace | Défense |
|---|---|
| Quelqu'un qui ne s'est pas connecté | chaque page demande une connexion ; le serveur refuse toute requête sans jeton valide (`401`), et cinq mots de passe erronés bloquent le nom un moment |
| Une personne qui fait plus que son rôle ne permet | le menu et les boutons suivent le rôle, et le serveur revérifie le rôle à chaque requête |
| Un jeton lu par quelqu'un d'autre | le jeton d'un programme est montré une fois, celui d'un nœud plus jamais ; le jeton de connexion ne vit que dans le navigateur de la personne et ne va qu'au serveur dont la page est venue |
| Une valeur erronée envoyée au serveur | noms, mots de passe et adresses sont vérifiés avant l'envoi, et le serveur les revérifie et refuse une configuration avec une clé inexistante |

**Ce qui n'est pas défendu :** le serveur ne termine pas encore TLS, donc sur un réseau non chiffré le jeton et les mots de passe circulent en clair ; un navigateur que quelqu'un d'autre peut utiliser reste connecté jusqu'à ce que la personne se déconnecte ou que la session expire (12 heures par défaut). Studio n'a pas eu de revue indépendante, et les vérifications d'un formulaire sont un confort : seul le serveur est digne de confiance.

## 🔌 Interfaces

| Interface | Ce que c'est | Où |
|---|---|---|
| API REST | tout ce que les pages montrent et modifient passe par `/api/v1/` d'EH3D-SERVER, avec le jeton de connexion comme jeton porteur | `src/api.ts` |
| Websocket | `/api/v1/events?token=...` pour la page en direct, avec une reconnexion qui attend plus longtemps à chaque fois | `src/pages/Monitor.tsx` |
| Stockage du navigateur | le jeton de connexion, la langue, le thème et l'actualisation, sous `eh3d-studio.*` | `src/App.tsx` |

## ⚙️ Configuration

Studio n'a pas de fichier de réglages propre : les réglages du serveur sont dans son `server.cfg` (la page Serveur les liste), et ce qu'une personne choisit est gardé dans son navigateur.

| Réglage | Défaut | Plage | Ce que ça fait |
|---|---|---|---|
| `studio_dir` | none | a folder | dans le `server.cfg` du serveur : servir les pages de ce dossier à sa racine |
| `EH3D_SERVER` | `http://127.0.0.1:18200` | a URL | en développement (`run.sh`) : le serveur avec lequel les pages parlent |
| `eh3d-studio.lang` | the browser's | `en es it de fr pt zh ja` | la langue de la page |
| `eh3d-studio.theme` | `forge` | `forge paper neon midnight` | le thème de la page |
| `eh3d-studio.refresh` | 5 | 0, 2, 5, 10, 30 | secondes entre deux lectures du serveur (0 : seulement sur demande) |

## 🚀 Démarrage rapide

Il faut Node 22 ou plus récent. Pour utiliser Studio sur la CM5, construisez les pages et dites au serveur où elles sont.

```bash
build.bat            # install and build the pages into dist/  -  ./build.sh on Linux
test.bat             # type check, lint and tests
python -I tools/ci_validate.py
```

Copiez `dist/` sur la CM5 (par exemple dans `/opt/eh3d-studio`), mettez `studio_dir = /opt/eh3d-studio` dans le `server.cfg` du serveur et redémarrez-le : Studio s'ouvre à l'adresse du serveur, par exemple `http://cm5:18200/`. La première fois, la page demande le code d'installation que le serveur affiche sur sa console et crée l'administrateur.

## 🧪 Tests

`npm test` lance 24 tests et tous réussissent : le client de l'API (le jeton, le corps, la requête, les erreurs, un réseau qui tombe, les chemins avec des noms à échapper), les règles des noms, mots de passe et adresses de nœud, ce qui ne va pas dans une machine, le menu de chaque rôle, les machines groupées par station, les comptes et les actions d'un travail, et les huit langues (un texte dans chaque langue, chinois et japonais dans leur écriture, les mêmes marqueurs partout). `npm run typecheck` et `npm run lint` réussissent aussi.

## 🏗️ Compilation et publication

La version vit dans `package.json` et dans `eh3d.project.json`, et chaque version a son entrée dans [CHANGELOG.md](CHANGELOG.md). `build.sh` / `build.bat` installent le nécessaire la première fois et construisent les pages dans `dist/` ; `test.sh` / `test.bat` lancent la vérification des types, le lint et les tests ; `run.sh` / `run.bat` ouvrent Studio en développement contre un serveur (`run.sh http://cm5:18200`).

## 🩺 Dépannage

| Symptôme | Que faire |
|---|---|
| La page dit que le serveur ne répond pas | Ouvrez `http://ADRESSE/api/v1/health` dans le navigateur : il doit répondre `eh3d-server` et une version. Si le serveur sert Studio, l'adresse de la page est celle du serveur. |
| La page demande un code d'installation | Le serveur n'a pas encore d'utilisateur : le code est sur sa console (sur la CM5 : `journalctl -u eh3d-server`). |
| Une page dont j'ai besoin n'est pas dans le menu | Le menu suit le rôle : machines et utilisateurs et jetons sont réservés aux administrateurs. |
| L'enregistrement d'une machine est refusé avec une erreur de configuration | Le fichier de machine a une clé inexistante ou une valeur hors plage ; le serveur le refuse au lieu de l'ignorer. |

## 📂 Structure du dépôt

<p align="center">
  <img src="images/repository-structure.svg" alt="Structure du dépôt EH3D-STUDIO" width="100%">
</p>

<details>
<summary>Version texte de l'arborescence</summary>

```text
EH3D-STUDIO/
├── src/
│   ├── App.tsx context.tsx                      l'ossature, le menu en trois groupes, ce que les pages partagent
│   ├── api.ts types.ts                          le client de l'API du serveur
│   ├── model.ts                                 rôles, règles des formulaires, flotte et travaux
│   ├── i18n.ts texts.ts                         les huit langues
│   ├── pages/                                   Supervision, Configuration, Compte et connexion
│   └── styles.css                               le thème Forge et trois autres
├── tools/
│   ├── demo_seed.mjs shots.mjs                  données de démonstration et les images du README
│   └── ci_validate.py                           contrôle CI et README
├── docs/                                        les sources des deux images
├── public/                                      l'icône de la page
├── images/                                      bannière, images et captures
├── .github/                                     workflow CI et modèles
├── index.html                                   la page qui charge l'application
├── package.json                                 le paquet, ses scripts et ses versions
├── vite.config.ts                               réglages de build et de lint
├── eslint.config.js                             réglages de build et de lint
├── tsconfig.json                                réglages de types
├── tsconfig.app.json                            réglages de types
├── build.sh build.bat                           installer et construire les pages
├── run.sh run.bat                               ouvrir Studio en développement
├── eh3d.project.json bump_manifest_version.py   manifeste et utilitaire de version
├── CHANGELOG.md                                 ce qui a changé à chaque version
├── SECURITY.md SUPPORT.md                       vulnérabilités et support
└── CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE   contribuer et la licence
```

</details>

## 🗺️ Feuille de route et limites connues

**Limites connues aujourd'hui**

* Elle n'a pas été utilisée avec des machines sur un banc : aucune machine d'un atelier n'a été configurée par elle et aucun travail n'a tourné depuis elle sur une vraie machine.
* Le serveur ne termine pas TLS, donc jeton et mots de passe circulent en clair sur un réseau non chiffré.
* Les réglages du serveur sont montrés comme référence, pas modifiés : l'API ne les donne pas, et ils se changent dans `server.cfg` sur la machine qui exécute le serveur.
* Seul le propriétaire a regardé les pages ; les textes des langues autres que l'anglais n'ont pas été lus par des locuteurs natifs.
* Il n'y a pas encore de page de visualisation d'un travail (le plan des trous).

**La suite**

* L'essayer avec les machines d'un banc : ajouter chaque machine, atteindre son nœud et exécuter un travail depuis la page des travaux.
* Une page pour voir un travail (le plan des trous et où il en est).
* Terminer TLS dans le serveur, ou documenter un proxy inverse, et montrer l'état de la connexion.
* Modifier les réglages du serveur depuis Studio quand le serveur les fournira.

## 🌍 Langues

Le README et les textes existent en anglais, espagnol, français, italien, allemand, chinois, japonais et portugais européen.

## 🔗 Projets liés

* [EH3D-SERVER](https://github.com/JuanenRac/EH3D-SERVER): le serveur que ce panneau configure
* [EH3D-DRILLPRO](https://github.com/JuanenRac/EH3D-DRILLPRO): le programme de perçage, client du serveur
* [EH3D-ROUTEPRO](https://github.com/JuanenRac/EH3D-ROUTEPRO): le programme de défonçage, client du serveur
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): l'interface moderne des machines Bungard, avec une fenêtre des machines et stations
* [EH3D-NODE-BUNGARD-HMI](https://github.com/JuanenRac/EH3D-NODE-BUNGARD-HMI): l'écran tactile de la machine, un client de plus du serveur
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): le style que ce panneau suit

## 📚 Documentation

* L'API du serveur avec lequel Studio parle : `docs/API.md` d'EH3D-SERVER.
* Comment mettre le serveur et Studio sur la CM5 : `docs/DEPLOY.md` d'EH3D-SERVER.
* [Journal des modifications](CHANGELOG.md)

## 🤝 Contribuer et communauté

* Avant une pull request, lancez `npm run typecheck`, `npm run lint`, `npm test` et `npm run build`, et `python -I tools/ci_validate.py` : tout doit passer. Voir [CONTRIBUTING.md](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md).
* Le README existe en huit langues : une modification du texte se fait dans les huit fichiers, et les deux images sont dessinées depuis `docs/architecture.json` et `docs/structure.json` par `tools/make_architecture.py` et `tools/make_structure.py`.
* Un texte de la page est une ligne de huit dans `src/texts.ts` ; un test lit chaque ligne.
* Signalez une vulnérabilité en privé : [SECURITY.md](SECURITY.md). Questions, idées et signalements : electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTEUR

**JuanenRac (Electro Hobby 3D)** · electrohobby3d@gmail.com

## 📜 LICENCE

Logiciel : GPL-3.0-or-later. Voir [LICENSE](LICENSE). Les conceptions matérielles de la suite utilisent la CERN OHL-S.
