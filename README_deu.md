<p align="center">
  <img src="images/EH3D_BANNER.svg" alt="EH3D-STUDIO banner" width="100%">
</p>

# 🧭 EH3D-STUDIO

<p align="center"><a href="README.md">🇺🇸 English</a> | <a href="README_spa.md">🇪🇸 Español</a> | <a href="README_fra.md">🇫🇷 Français</a> | <a href="README_ita.md">🇮🇹 Italiano</a> | 🇩🇪 <b>Deutsch</b> | <a href="README_zho.md">🇨🇳 中文</a> | <a href="README_jpn.md">🇯🇵 日本語</a> | <a href="README_por.md">🇵🇹 Português</a></p>

### Das Konfigurationspanel des EH3D-Servers: die Maschinen und ihre Stationen, die Aufträge, die Benutzer und die Tokens der Programme, alles gegliedert und im Aussehen von BUNGARD-GUI, in acht Sprachen.

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20TypeScript-00599C.svg" alt="React and TypeScript">
  <img src="https://img.shields.io/badge/Languages-8-00E5FF.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Version-0.0.7-0f6cbd.svg" alt="Version">
  <img src="https://img.shields.io/badge/Maturity-scaffolding-FFB020.svg" alt="Maturity">
</p>

---

**Ehrlichkeitscheck - was heute läuft:** eine Webanwendung in React und TypeScript, die sich bei EH3D-SERVER anmeldet und zeigt und ändert, was dieser enthält: die Maschinen mit Station, Knoten und Konfigurationsdateien, die Aufträge, die Benutzer und die Tokens, die Live-Ereignisse. Der Client der API, die Regeln der Formulare, das Menü je Rolle und die acht Sprachen sind durch 73 Tests abgedeckt, und die Seiten wurden in einem Browser gegen einen lokalen Server mit simulierten Maschinen angesehen. **Sie wurde nicht mit Maschinen auf einem Prüfstand benutzt**, und der Server beendet TLS noch nicht.

---

> **Sicherheitsstatus (Safety und IT-Sicherheit):** Dies ist kein Sicherheitssystem. Studio ändert, was ein Server enthält, der Maschinen bewegt: eine falsche Knotenadresse oder ein falsches Token, eine falsche Station oder eine gelöschte Maschine können eine Werkstatt stoppen oder einen Auftrag auf die falsche Maschine lenken, und ein hier erzeugtes Token erlaubt einem Programm, Aufträge zu senden. Der Server prüft die Rolle der Person bei jeder Anfrage; einen Knopf zu verbergen ist nur eine Bequemlichkeit. In einem unverschlüsselten Netz läuft das Token im Klartext (der Server beendet TLS noch nicht): im Heimnetz oder über ein VPN verwenden. Das Projekt ist unabhängig: Es wird nicht von Bungard Elektronik hergestellt, gebilligt oder unterstützt.

## 📋 Auf einen Blick

| | |
|---|---|
| Version | `0.0.7` |
| Reifegrad | Gerüst |
| Tests | 76 Tests (`npm test`) |
| Technologie-Stack | React 19, TypeScript, Vite |
| Auf echter Hardware | Nicht mit Maschinen auf einem Prüfstand: im Browser gegen einen lokalen Server mit simulierten Maschinen angesehen |

**Springe zu:** [Überblick](#-überblick) · [Architektur](#-architektur) · [Schnellstart](#-schnellstart) · [Tests](#-tests) · [Struktur](#-struktur-des-repositorys) · [Verwandte](#-verwandte-projekte)

## 🚦 Projektstatus

Jede Zeile ist ein Teil dieses Repositorys, und die Ampel sagt, wie weit er heute ist. Sie beruht auf dem, was das Repository zeigen kann (Tests, Builds, Läufe), nicht auf dem, was geplant ist.

🟢 Fertig und überprüft · 🟡 Funktioniert, mit bekannten Grenzen · 🟠 Teilweise fertig oder noch nicht überprüft · 🔴 Nicht gemacht oder funktioniert nicht

| Bereich | Stand | Was das hier bedeutet |
|---|---|---|
| Software | 🟡 | Die Anwendung baut ohne Warnungen (Typen, Lint, Build) und wird vom Server an der Wurzel seiner Adresse ausgeliefert; sie lief in einem Browser gegen einen lokalen Server. |
| Tests | 🟡 | 76 Tests bestehen (`npm test`): der Client der API mit seinen Fehlern, die Regeln für Namen, Passwörter und Adressen, das Menü je Rolle, die Flotte je Station, die Aktionen eines Auftrags und die acht Sprachen. |
| Seiten | 🟡 | Übersicht, Maschinen je Station, Aufträge, Live-Ereignisse, Maschinen, Benutzer und Tokens, Server, Konto, Einstellungen und Info sind geschrieben; Aufträge und Maschinen werden gegen die echte API des Servers verwaltet. Keine Seite wurde von jemand anderem als dem Autor erprobt. |
| Sprachen | 🟡 | Acht Sprachen in jedem Text, auch in den Ablehnungen des Servers; die Texte liest ein Test, aber nur Englisch und wenige Sätze der anderen hat ein Mensch gelesen. |
| Echte Maschinen | 🔴 | Auf einem Prüfstand wurde nichts damit gemacht: keine Maschine hinzugefügt, kein Knoten erreicht und kein Auftrag über sie auf einer echten Maschine ausgeführt. |
| Dokumentation | 🟡 | README in acht Sprachen, die Einstellungen des Servers und wie man Studio auf die CM5 bringt. |

## 🎯 Überblick

* **Überwachung:** die Übersicht (Maschinen frei, laufend und wartend, Aufträge bereit, aktiv, fertig und fehlgeschlagen), die Maschinen unter ihren Stationen mit dem Fortschritt jedes Auftrags, die Auftragsliste mit Filtern und Aktionen und die Live-Ereignisse des Servers über sein Websocket.
* **Konfiguration:** die Maschinen (Kennung, Name, Modell, Station, ein Knoten mit Adresse und Token oder der Simulator, der Text der beiden Konfigurationsdateien und die Maschinendatei), die Benutzer mit ihrer Rolle, die Tokens der Programme und die Referenz der Servereinstellungen.
* **Konto:** das Passwort der Person, die Sprache, das Thema und wie oft die Seiten den Server erneut fragen.
* **Das Aussehen von BUNGARD-GUI:** das Thema Forge als Standard (warmes Schwarz, Bernstein, Karten mit zwei abgeschnittenen Ecken, Chips mit Bernsteinrand) und drei weitere: Papier, Neon und Mitternacht.
* **Vom Server ausgeliefert:** mit `studio_dir` in `server.cfg` liefert der Server diese Seiten an der Wurzel seiner eigenen Adresse aus, es ist also nichts weiter zu installieren und keine Cross-Origin-Einstellung nötig.

## 🧩 Rolle in EH3D

EH3D-STUDIO ist für EH3D-SERVER, was ARMOR-STUDIO für den ARMOR-Server ist: der eine Ort, an dem alles, was der Server enthält, konfiguriert und verfolgt wird, gegliedert und klassifiziert. Die Programme (EH3D-DRILLPRO, EH3D-ROUTEPRO, EH3D-BUNGARD-GUI, der Touchscreen der Maschine) nutzen die hier erzeugten Tokens und die hier eingerichteten Maschinen; die Maschinen selbst werden über ihre Knoten erreicht.

## 🏛️ Architektur

<p align="center">
  <img src="images/architecture.svg" alt="Architektur von EH3D-STUDIO: wer es nutzt, was es enthält und wovon es abhängt" width="100%">
</p>

Wie die Teile dieses Repositorys zusammenpassen: wer mit ihm spricht, was es enthält und wovon es abhängt. Das Bild wird aus `docs/architecture.json` gezeichnet und gegen den Code geprüft.

## 🖼️ Screenshots

<p align="center">
  <img src="images/screenshots/overview.png" alt="overview" width="100%">
</p>

<p align="center"><em>Die Übersicht: Maschinen frei, laufend und wartend und die Aufträge nach Zustand.</em></p>

<p align="center">
  <img src="images/screenshots/fleet.png" alt="fleet" width="100%">
</p>

<p align="center"><em>Die Maschinen unter ihren Stationen, mit Zustand und Fortschritt jedes Auftrags.</em></p>

<p align="center">
  <img src="images/screenshots/jobs.png" alt="jobs" width="100%">
</p>

<p align="center"><em>Die Aufträge mit ihren Filtern und den Aktionen, die die Rolle erlaubt.</em></p>

<p align="center">
  <img src="images/screenshots/prepare.png" alt="prepare" width="100%">
</p>

<p align="center"><em>Einen Auftrag vorbereiten: die getippte Arbeit, der Plan und die vom Server berechnete Zeit.</em></p>

<p align="center">
  <img src="images/screenshots/job.png" alt="job" width="100%">
</p>

<p align="center"><em>Ein Auftrag: der Plan mit den schon gebohrten Löchern, der Fortschritt und die Tasten seines Zustands.</em></p>

<p align="center">
  <img src="images/screenshots/machine.png" alt="machine" width="100%">
</p>

<p align="center"><em>Eine Maschine: was sie tut, was auf sie wartet und die zuletzt beendeten Aufträge.</em></p>

<p align="center">
  <img src="images/screenshots/machines.png" alt="machines" width="100%">
</p>

<p align="center"><em>Die Maschinen des Servers: Station, Knoten und Konfigurationsdateien.</em></p>

<p align="center">
  <img src="images/screenshots/access.png" alt="access" width="100%">
</p>

<p align="center"><em>Die Benutzer mit ihrer Rolle und die Tokens der Programme.</em></p>

<p align="center">
  <img src="images/screenshots/server.png" alt="server" width="100%">
</p>

<p align="center"><em>Die Einstellungen des Servers als Referenz.</em></p>

<p align="center">
  <img src="images/screenshots/updates.png" alt="updates" width="100%">
</p>

<p align="center"><em>Die Seite Aktualisierungen: was installiert ist, das neueste Release auf GitHub und was der Helfer des Servers getan hat.</em></p>

<p align="center">
  <img src="images/screenshots/preferences.png" alt="preferences" width="100%">
</p>

<p align="center"><em>Die Einstellungen: Sprache, Thema und Aktualisierung.</em></p>

## ✨ Funktionen

* **Jede Rolle sieht ihr Menü:** ein Betrachter sieht die Seiten der Überwachung, die Serverseite und die Kontoseiten; ein Administrator zusätzlich Maschinen und Benutzer und Tokens.
* **Prüfungen vor dem Senden:** Namen, Passwörter und Knotenadressen werden im Formular geprüft, und die Ablehnung des Servers erscheint als Satz in der Sprache der Person.
* **Tokens nur einmal sichtbar:** das Token eines Programms erscheint beim Erzeugen und nie wieder; das Token eines Knotens wird nach dem Speichern nie angezeigt.
* **Folgt dem Server:** Flotte und Aufträge aktualisieren sich selbst (oder nur auf Anforderung), und die Live-Seite verbindet sich neu, wenn die Verbindung abbricht.
* **Aktualisierungen:** eine Seite für den Administrator vergleicht den installierten Server und Studio mit den neuesten Releases auf GitHub, prüft auf Anfrage und aktualisiert, was neuer ist, und zeigt, was der Helfer des Servers tut, während er arbeitet; startet der Server selbst neu, kommt die Seite von selbst zurück. Die Aktualisierung braucht `updates_dir` in `server.cfg` und den installierten Helfer von EH3D-SERVER; getestet mit Attrappen für GitHub und systemd, nie an einer echten Installation.
* **Einen Auftrag hier vorbereiten:** Maschine wählen und die Arbeit als die Dateien angeben, die die Programme lesen (`.NCD` mit `.DTD`, `.PLT` mit `.RTD`), oder als von Hand getippte Löcher (Werkzeug, x und y, mit Vorschub, Drehzahl und Zusatzhub je Werkzeug); den Plan, die Zeit und den Verfahrweg ansehen, die der Server berechnet, und den Auftrag bereitlegen. Ein Auftrag startet nie von selbst.
* **Eine Seite für jeden Auftrag:** der Plan mit den schon gebohrten Löchern gefüllt und dem nächsten umringt, wie weit er ist, wer ihn gemacht hat und wann, die Werkzeuge und die zum Zustand passenden Tasten (starten, bestätigen, stoppen, löschen). Die Aufträge, die auf den Bediener warten, stehen oben in der Übersicht mit ihrer Taste Bestätigen.
* **Starten fragt noch einmal nach:** Die Schaltfläche Starten auf der Auftragsseite, in der Liste des Monitors und in der Warteschlange einer Maschine braucht eine zweite Berührung (die erste ändert die Schaltfläche in „Sicher?“, und sie zu verlassen bricht ab), damit eine versehentliche Berührung die Maschine nicht in Gang setzt.
* **Eine Liste, mit der man arbeiten kann:** Suche nach Name, Maschine, Person oder Zustand, fünf Sortierungen, ein CSV des Angezeigten und eine Taste, die die beendeten Aufträge entfernt; die Übersicht summiert, was die Maschinen getan haben (Aufträge, Löcher, Stunden).
* **Hinweise:** der Titel des Tabs zählt die Aufträge, die auf den Bediener warten, und, wenn die Person es einschaltet, melden ein Ton und eine Browser-Benachrichtigung, wenn ein neuer zu warten beginnt.
* **Maschinen ziehen zwischen Servern um:** jede Maschine lässt sich kopieren, und die Maschinen eines Servers lassen sich in eine Datei exportieren und in einen anderen importieren (die Zugriffstokens der Knoten werden nie exportiert).
* **Eine Seite für jede Maschine, Kopien und ein ausgefallener Server:** die Seite einer Maschine zeigt, was sie tut, die auf sie wartenden Aufträge mit ihrer Gesamtzeit und die zuletzt beendeten; ein Auftrag kann in mehreren Kopien auf einmal bereitgelegt werden (dieselbe Platine mehrfach); die Zeichnung eines Plans wird als SVG gespeichert; und eine rote Zeile meldet, wenn der Server nicht mehr antwortet, bis er wieder antwortet.
* **Der Knoten am Bohrkopf auf der Seite einer Maschine:** nennt die Konfiguration der Maschine den Knoten (`head_address`), zeigt die Seite die Spindeldrehzahl, die Temperatur mit dem Urteil des Knotens, den Schutzausgang und das Kameramodell, eine Taste, die seine Kamera (MJPEG) zeigt, und für einen Bediener eine Taste, die den Tisch unter dem Kopf misst; alles läuft über EH3D-SERVER, der das Token des Knotens hält. Mit einem Ersatz getestet, nie mit einem echten Knoten.
* **Die Spindel auf der Seite einer Maschine:** alle lesen, welche Spindel die Maschine trägt (die originale oder die mit Umrichter), was mit einem Auftrag geschieht, der mehr verlangt, als sie gibt, die Grenzen der verwendeten Spindel und die Höchstdrehzahl für den Knoten der Maschine; ein Administrator ändert die Spindel und den Sicherheitsschalter (den Auftrag ablehnen, was der Standard ist, oder warnen und die Drehzahl auf das Maximum der Spindel kürzen). Wird ein Auftrag mit dem Schalter auf `warn` vorbereitet, listet der Plan Werkzeug für Werkzeug auf, was über die Spindel hinausgeht; mit `reject` lehnt der Server ihn ab und Studio sagt warum. Nicht an einer echten Maschine erprobt.
* **Freie G-Code-Aufträge und GRBL-Maschinen:** Eine Maschine kann eine GRBL-Steuerung an einer seriellen Schnittstelle des Servers sein (Schnittstelle und Baudrate; der Server muss mit `--features serial` gebaut sein), und ein Administrator legt sie in Konfiguration an oder ändert sie. In Vorbereiten wird ein G-Code-Programm (eingefügt oder aus einer Datei geladen) wie jeder Auftrag in der Vorschau gezeigt und bereitgelegt, mit einem Sicherheitsschalter, der Spindel und Kühlmittel beim Fortsetzen wieder startet, standardmäßig aus. Ein laufender G-Code-Auftrag wird in der Liste, auf seiner Seite und in der Übersicht angehalten und fortgesetzt; sie nennen die erreichte Zeile und worauf er wartet (ein Halt oder das Warten vor der ersten Bewegung eines fortgesetzten Auftrags); ein angehaltener Auftrag bietet an, dort fortzufahren, wo er angehalten hat: der Server hat die Anfrage gespeichert, die Datei muss nicht erneut gewählt werden. Bohr- und Fräsaufträge nehmen abgeschaltete Werkzeuge und bereits erledigte Bohrungen oder Pfade an, und die Referenz der Servereinstellungen nennt `gcode_finish_wait_s` und `updates_dir`. Am Simulator und an einem Ersatz erprobt, nie an einer echten GRBL-Steuerung. Ein Administrator kann je Maschine die `$`-Zeilen von GRBL (etwa `$H`) mit einem Sicherheitsschalter in der Konfiguration erlauben, standardmäßig aus und mit einer Warnung.
* **Der LED-Ring und die letzte Qualitätsprüfung auf der Seite einer Maschine:** Ein Bediener schaltet den Ring ein oder aus und stellt Stufe und Farbton ein, und alle sehen das Urteil der letzten Prüfung der Arbeit. Gegen einen Ersatz getestet, nie an einem echten Knoten.

## 🔒 Sicherheit und Schutz

| Bedrohung | Abwehr |
|---|---|
| Jemand, der nicht angemeldet ist | jede Seite braucht eine Anmeldung; der Server lehnt jede Anfrage ohne gültiges Token ab (`401`), und fünf falsche Passwörter sperren den Namen eine Weile |
| Eine Person, die mehr tut, als ihre Rolle erlaubt | Menü und Knöpfe folgen der Rolle, und der Server prüft die Rolle bei jeder Anfrage erneut |
| Ein von jemand anderem gelesenes Token | das Token eines Programms wird einmal gezeigt, das eines Knotens nie wieder; das Anmelde-Token lebt nur im Browser der Person und geht nur an den Server, von dem die Seite kam |
| Ein falscher Wert an den Server | Namen, Passwörter und Adressen werden vor dem Senden geprüft, und der Server prüft sie erneut und lehnt eine Konfiguration mit einem unbekannten Schlüssel ab |

**Was nicht abgesichert ist:** der Server beendet TLS noch nicht, daher laufen in einem unverschlüsselten Netz Token und Passwörter im Klartext; ein Browser, den jemand anderes benutzen kann, bleibt angemeldet, bis die Person sich abmeldet oder die Anmeldung abläuft (standardmäßig 12 Stunden). Studio hatte keine unabhängige Prüfung, und die Prüfungen eines Formulars sind eine Bequemlichkeit: Vertrauen darf man nur dem Server.

## 🔌 Schnittstellen

| Schnittstelle | Was es ist | Wo |
|---|---|---|
| REST-API | alles, was die Seiten zeigen und ändern, läuft über `/api/v1/` von EH3D-SERVER, mit dem Anmelde-Token als Bearer-Token | `src/api.ts` |
| Websocket | `/api/v1/events?token=...` für die Live-Seite, mit einer Wiederverbindung, die jedes Mal länger wartet | `src/pages/Monitor.tsx` |
| Browser-Speicher | das Anmelde-Token, die Sprache, das Thema und die Aktualisierung unter `eh3d-studio.*` | `src/App.tsx` |

## ⚙️ Konfiguration

Studio hat keine eigene Einstellungsdatei: die Einstellungen des Servers stehen in seiner `server.cfg` (die Seite Server listet sie auf), und was eine Person wählt, wird in ihrem Browser gespeichert.

| Einstellung | Standard | Bereich | Was sie tut |
|---|---|---|---|
| `studio_dir` | none | a folder | in der `server.cfg` des Servers: die Seiten dieses Ordners an seiner Wurzel ausliefern |
| `EH3D_SERVER` | `http://127.0.0.1:18200` | a URL | bei der Entwicklung (`run.sh`): der Server, mit dem die Seiten sprechen |
| `eh3d-studio.lang` | the browser's | `en es it de fr pt zh ja` | die Sprache der Seite |
| `eh3d-studio.theme` | `forge` | `forge paper neon midnight` | das Thema der Seite |
| `eh3d-studio.refresh` | 5 | 0, 2, 5, 10, 30 | Sekunden zwischen zwei Abfragen des Servers (0: nur auf Anforderung) |

## 🚀 Schnellstart

Sie brauchen Node 22 oder neuer. Um Studio auf der CM5 zu nutzen, bauen Sie die Seiten und sagen dem Server, wo sie liegen.

```bash
build.bat            # install and build the pages into dist/  -  ./build.sh on Linux
test.bat             # type check, lint and tests
python -I tools/ci_validate.py
```

Kopieren Sie `dist/` auf die CM5 (zum Beispiel nach `/opt/eh3d-studio`), tragen Sie `studio_dir = /opt/eh3d-studio` in die `server.cfg` des Servers ein und starten Sie ihn neu: Studio öffnet sich unter der Adresse des Servers, zum Beispiel `http://cm5:18200/`. Beim ersten Mal fragt die Seite nach dem Einrichtungscode, den der Server auf seiner Konsole ausgibt, und legt den Administrator an.

## 🧪 Tests

`npm test` führt 76 Tests aus und alle bestehen: der Client der API (das Token, der Rumpf, die Abfrage, die Fehler, ein ausfallendes Netz, die Pfade mit zu maskierenden Namen), die Regeln für Namen, Passwörter und Knotenadressen, was an einer Maschine falsch ist, das Menü jeder Rolle, die nach Station gruppierten Maschinen, die Zählungen und Aktionen eines Auftrags und die acht Sprachen (ein Text in jeder Sprache, Chinesisch und Japanisch in ihrer Schrift, überall dieselben Platzhalter). `npm run typecheck` und `npm run lint` bestehen ebenfalls.

## 🏗️ Build und Veröffentlichung

Die Version steht in `package.json` und in `eh3d.project.json`, und jede Version hat ihren Eintrag in [CHANGELOG.md](CHANGELOG.md). `build.sh` / `build.bat` installieren beim ersten Mal das Nötige und bauen die Seiten nach `dist/`; `test.sh` / `test.bat` führen Typprüfung, Lint und Tests aus; `run.sh` / `run.bat` öffnen Studio in der Entwicklung gegen einen Server (`run.sh http://cm5:18200`).

## 🩺 Fehlerbehebung

| Symptom | Was zu tun ist |
|---|---|
| Die Seite sagt, der Server antworte nicht | Öffnen Sie `http://ADRESSE/api/v1/health` im Browser: es muss `eh3d-server` und eine Version antworten. Wenn der Server Studio ausliefert, ist die Adresse der Seite die des Servers. |
| Die Seite fragt nach einem Einrichtungscode | Der Server hat noch keinen Benutzer: der Code steht auf seiner Konsole (auf der CM5: `journalctl -u eh3d-server`). |
| Eine Seite, die ich brauche, fehlt im Menü | Das Menü folgt der Rolle: Maschinen sowie Benutzer und Tokens sind für Administratoren. |
| Das Speichern einer Maschine wird mit einem Konfigurationsfehler abgelehnt | Die Maschinendatei hat einen unbekannten Schlüssel oder einen Wert außerhalb des Bereichs; der Server lehnt sie ab, statt sie zu ignorieren. |

## 📂 Struktur des Repositorys

<p align="center">
  <img src="images/repository-structure.svg" alt="Struktur des Repositorys EH3D-STUDIO" width="100%">
</p>

<details>
<summary>Textversion des Baums</summary>

```text
EH3D-STUDIO/
├── src/
│   ├── App.tsx context.tsx                      das Gerüst, das Menü in drei Gruppen, was die Seiten teilen
│   ├── api.ts types.ts                          der Client der Server-API
│   ├── model.ts                                 Rollen, Formularregeln, Flotte und Aufträge
│   ├── jobtools.ts attention.ts                 die Auftragswerkzeuge: Löcher, Anfragen, Plan, Suche, CSV
│   ├── i18n.ts texts.ts                         die acht Sprachen
│   ├── pages/                                   Überwachung, Konfiguration, Konto und Anmeldung
│   └── styles.css                               das Thema Forge und drei weitere
├── tools/
│   ├── demo_seed.mjs shots.mjs                  Demodaten und die Bilder des README
│   └── ci_validate.py                           CI- und README-Prüfung
├── docs/                                        die Quellen der beiden Bilder
├── public/                                      das Symbol der Seite
├── images/                                      Banner, Bilder und Screenshots
├── .github/                                     CI-Workflow und Vorlagen
├── index.html                                   die Seite, die die Anwendung lädt
├── package.json                                 das Paket, seine Skripte und Versionen
├── vite.config.ts                               Build- und Lint-Einstellungen
├── eslint.config.js                             Build- und Lint-Einstellungen
├── tsconfig.json                                Typeinstellungen
├── tsconfig.app.json                            Typeinstellungen
├── build.sh build.bat                           Seiten installieren und bauen
├── run.sh run.bat                               Studio in der Entwicklung öffnen
├── eh3d.project.json bump_manifest_version.py   Manifest und Versionswerkzeug
├── CHANGELOG.md                                 was sich in jeder Version geändert hat
├── SECURITY.md SUPPORT.md                       Schwachstellen und Support
└── CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE   Mitwirken und Lizenz
```

</details>

## 🗺️ Roadmap und bekannte Grenzen

**Bekannte Grenzen heute**

* Sie wurde nicht mit Maschinen auf einem Prüfstand benutzt: keine Maschine einer Werkstatt wurde über sie eingerichtet und kein Auftrag lief von ihr aus auf einer echten Maschine.
* Der Server beendet TLS nicht, daher laufen Token und Passwörter in einem unverschlüsselten Netz im Klartext.
* Die Einstellungen des Servers werden als Referenz gezeigt, nicht bearbeitet: die API gibt sie nicht heraus, und sie werden in `server.cfg` auf dem Rechner geändert, der den Server betreibt.
* Nur der Besitzer hat die Seiten angesehen; die Texte der Sprachen außer Englisch wurden nicht von Muttersprachlern gelesen.
* Es gibt noch keine Seite für die Ansicht eines Auftrags (den Plan der Löcher).

**Als Nächstes**

* Mit den Maschinen eines Prüfstands erproben: jede Maschine hinzufügen, ihren Knoten erreichen und von der Auftragsseite einen Auftrag ausführen.
* Eine Seite zum Ansehen eines Auftrags (der Plan der Löcher und wo der Auftrag steht).
* TLS im Server beenden oder einen Reverse-Proxy dokumentieren und den Zustand der Verbindung zeigen.
* Die Einstellungen des Servers aus Studio bearbeiten, sobald der Server sie herausgibt.

## 🌍 Sprachen

README und Texte gibt es auf Englisch, Spanisch, Französisch, Italienisch, Deutsch, Chinesisch, Japanisch und europäischem Portugiesisch.

## 🔗 Verwandte Projekte

* [EH3D-SERVER](https://github.com/JuanenRac/EH3D-SERVER): der Server, den dieses Panel konfiguriert
* [EH3D-DRILLPRO](https://github.com/JuanenRac/EH3D-DRILLPRO): das Bohrprogramm, ein Client des Servers
* [EH3D-ROUTEPRO](https://github.com/JuanenRac/EH3D-ROUTEPRO): das Fräsprogramm, ein Client des Servers
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): die moderne Oberfläche der Bungard-Maschinen mit einem Fenster der Maschinen und Stationen
* [EH3D-NODE-BUNGARD-HMI](https://github.com/JuanenRac/EH3D-NODE-BUNGARD-HMI): der Touchscreen der Maschine, ein weiterer Client des Servers
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): das Aussehen, dem dieses Panel folgt

## 📚 Dokumentation

* Die API des Servers, mit dem Studio spricht: `docs/API.md` von EH3D-SERVER.
* Wie man Server und Studio auf die CM5 bringt: `docs/DEPLOY.md` von EH3D-SERVER.
* [Änderungsprotokoll](CHANGELOG.md)

## 🤝 Mitwirken und Community

* Führen Sie vor einem Pull Request `npm run typecheck`, `npm run lint`, `npm test` und `npm run build` sowie `python -I tools/ci_validate.py` aus: alles muss bestehen. Siehe [CONTRIBUTING.md](CONTRIBUTING.md) und den [Verhaltenskodex](CODE_OF_CONDUCT.md).
* Das README gibt es in acht Sprachen: Eine Textänderung wird in allen acht Dateien gemacht, und die beiden Bilder werden aus `docs/architecture.json` und `docs/structure.json` mit `tools/make_architecture.py` und `tools/make_structure.py` gezeichnet.
* Ein Text der Seite ist eine Zeile mit acht Einträgen in `src/texts.ts`; ein Test liest jede Zeile.
* Eine Schwachstelle bitte privat melden: [SECURITY.md](SECURITY.md). Fragen, Ideen und Meldungen: electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTOR

**JuanenRac (Electro Hobby 3D)** · electrohobby3d@gmail.com

## 📜 LIZENZ

Software: GPL-3.0-or-later. Siehe [LICENSE](LICENSE). Die Hardware-Entwürfe der Suite verwenden die CERN OHL-S.
