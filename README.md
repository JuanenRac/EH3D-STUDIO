<p align="center">
  <img src="images/EH3D_BANNER.svg" alt="EH3D-STUDIO banner" width="100%">
</p>

# 🧭 EH3D-STUDIO

<p align="center">🇺🇸 <b>English</b> | <a href="README_spa.md">🇪🇸 Español</a> | <a href="README_fra.md">🇫🇷 Français</a> | <a href="README_ita.md">🇮🇹 Italiano</a> | <a href="README_deu.md">🇩🇪 Deutsch</a> | <a href="README_zho.md">🇨🇳 中文</a> | <a href="README_jpn.md">🇯🇵 日本語</a> | <a href="README_por.md">🇵🇹 Português</a></p>

### The configuration panel of the EH3D server: the machines and their stations, the jobs, the users and the tokens of the programs, all structured and in the look of BUNGARD-GUI, in eight languages.

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20TypeScript-00599C.svg" alt="React and TypeScript">
  <img src="https://img.shields.io/badge/Languages-8-00E5FF.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Version-0.0.7-0f6cbd.svg" alt="Version">
  <img src="https://img.shields.io/badge/Maturity-scaffolding-FFB020.svg" alt="Maturity">
</p>

---

**Honesty check - what actually runs today:** a web application in React and TypeScript that signs in to EH3D-SERVER and shows and changes what it holds: the machines with their station, their node and their configuration files, the jobs, the users and the tokens, the live events. The client of the API, the rules of the forms, the menu by role and the eight languages are covered by 73 tests, and the pages have been looked at in a browser against a local server with simulated machines. **It has not been used against machines on a bench**, and the server does not terminate TLS yet.

---

> **Safety and security status:** this is not a safety system. Studio changes what a server that moves machines holds: a wrong node address or token, a wrong station or a deleted machine can stop a workshop or point a job at the wrong machine, and a token made here lets a program send jobs. The server checks the role of the person on every request; hiding a button is only a convenience. Over a plain network the token travels in clear text (the server does not terminate TLS yet): use it on the house network or through a VPN. The project is independent: it is not made, endorsed or supported by Bungard Elektronik.

## 📋 At a glance

| | |
|---|---|
| Version | `0.0.7` |
| Maturity | Scaffolding |
| Tests | 76 tests (`npm test`) |
| Stack | React 19, TypeScript, Vite |
| On real hardware | Not against machines on a bench: looked at in a browser against a local server with simulated machines |

**Jump to:** [Overview](#-overview) · [Architecture](#-architecture) · [Quick start](#-quick-start) · [Testing](#-testing) · [Structure](#-repository-structure) · [Related](#-related-projects)

## 🚦 Project status

Each line is one part of this repository and the light says how far it is today. It is written from what the repository can show (tests, builds, runs), not from what is planned.

🟢 Done and verified · 🟡 Works, with known limits · 🟠 Partly done or not verified yet · 🔴 Not done or not working

| Area | State | What it means here |
|---|---|---|
| Software | 🟡 | The application builds without warnings (typecheck, lint, build) and is served by the server at the root of its address; it has been run in a browser against a local server. |
| Tests | 🟡 | 76 tests pass (`npm test`): the client of the API with its errors, the rules of names, passwords and addresses, the menu by role, the fleet by station, the actions of a job and the eight languages. |
| Pages | 🟡 | Overview, machines by station, jobs, live events, machines, users and tokens, server, account, preferences and about are written; the jobs and the machines are managed against the real API of the server. No page has been tried by someone who is not the author. |
| Languages | 🟡 | Eight languages in every text, the refusals of the server included; the texts are read by a test, but only English and a few phrases of the others have been read by a person. |
| Real machines | 🔴 | Nothing has been done with it on a bench: no machine has been added, no node reached and no job run through it on a real machine. |
| Documentation | 🟡 | README in eight languages, the settings of the server and how to put Studio on the CM5. |

## 🎯 Overview

* **Monitor:** the overview (machines free, running and waiting, jobs ready, active, done and failed), the machines under their stations with the progress of each job, the list of jobs with filters and their actions, and the live events of the server over its websocket.
* **Configure:** the machines (identifier, name, model, station, a node with its address and token or the simulator, the text of the two configuration files and the machine file), the users with their role, the tokens of the programs and the reference of the settings of the server.
* **Account:** the password of the person, the language, the theme and how often the pages ask the server again.
* **The look of BUNGARD-GUI:** the Forge theme by default (warm black, amber, cards with two cut corners, amber-outlined chips) and three more: Paper, Neon and Midnight.
* **Served by the server:** with `studio_dir` in `server.cfg` the server serves these pages at the root of its own address, so there is nothing else to install and no cross-origin setting.

## 🧩 Role in EH3D

EH3D-STUDIO is to EH3D-SERVER what ARMOR-STUDIO is to the ARMOR server: the one place where everything the server holds is configured and followed, structured and classified. The programs (EH3D-DRILLPRO, EH3D-ROUTEPRO, EH3D-BUNGARD-GUI, the touch screen of the machine) use the tokens made here and the machines set up here; the machines themselves are reached through their nodes.

## 🏛️ Architecture

<p align="center">
  <img src="images/architecture.svg" alt="EH3D-STUDIO architecture: who uses it, what it holds and what it depends on" width="100%">
</p>

How the parts of this repository fit together: who talks to it, what it holds and what it depends on. The picture is drawn from `docs/architecture.json` and checked against the code.

## 🖼️ Screenshots

<p align="center">
  <img src="images/screenshots/overview.png" alt="overview" width="100%">
</p>

<p align="center"><em>The overview: machines free, running and waiting, and the jobs by state.</em></p>

<p align="center">
  <img src="images/screenshots/fleet.png" alt="fleet" width="100%">
</p>

<p align="center"><em>Machines under their stations, with the state and the progress of each job.</em></p>

<p align="center">
  <img src="images/screenshots/jobs.png" alt="jobs" width="100%">
</p>

<p align="center"><em>The jobs with their filters and the actions the role allows.</em></p>

<p align="center">
  <img src="images/screenshots/prepare.png" alt="prepare" width="100%">
</p>

<p align="center"><em>Preparing a job: the work typed in, the plan and the time the server works out.</em></p>

<p align="center">
  <img src="images/screenshots/job.png" alt="job" width="100%">
</p>

<p align="center"><em>One job: the plan with the holes already drilled, how far it has got and the buttons of its state.</em></p>

<p align="center">
  <img src="images/screenshots/machine.png" alt="machine" width="100%">
</p>

<p align="center"><em>One machine: what it is doing, what waits for it and the last jobs it finished.</em></p>

<p align="center">
  <img src="images/screenshots/machines.png" alt="machines" width="100%">
</p>

<p align="center"><em>The machines of the server: station, node and configuration files.</em></p>

<p align="center">
  <img src="images/screenshots/access.png" alt="access" width="100%">
</p>

<p align="center"><em>Users with their role, and the tokens of the programs.</em></p>

<p align="center">
  <img src="images/screenshots/server.png" alt="server" width="100%">
</p>

<p align="center"><em>The settings of the server, as a reference.</em></p>

<p align="center">
  <img src="images/screenshots/updates.png" alt="updates" width="100%">
</p>

<p align="center"><em>The Updates page: what is installed, the latest release on GitHub and what the helper of the server did.</em></p>

<p align="center">
  <img src="images/screenshots/preferences.png" alt="preferences" width="100%">
</p>

<p align="center"><em>The preferences: language, theme and refresh.</em></p>

## ✨ Features

* **Each role sees its own menu:** a viewer sees the pages of Monitor, the Server page and the Account pages; an administrator also sees Machines, Users and tokens and Updates.
* **Checks before it sends:** names, passwords and node addresses are checked in the form, and the refusal of the server is shown as a sentence in the language of the person.
* **Tokens shown once:** the token of a program appears when it is made and never again; the token of a node is never shown after it is saved.
* **Follows the server:** the fleet and the jobs refresh by themselves (or only when asked), and the live page reconnects when the link drops.
* **Updates:** a page for the administrator compares the installed server and Studio with the latest releases on GitHub, checks when asked and updates what is newer, showing what the helper of the server does while it works; when the server itself restarts, the page comes back by itself. The update needs `updates_dir` in `server.cfg` and the helper of EH3D-SERVER installed; it has been tested with stand-ins for GitHub and systemd, never on a real installation.
* **Prepare a job here:** pick the machine and give the work as the files the programs read (`.NCD` with its `.DTD`, `.PLT` with its `.RTD`) or as holes typed by hand (tool, x and y, with the feed, the speed and the extra stroke of each tool); look at the plan, the time and the travel the server works out, and keep the job ready. A job never starts by itself.
* **One page for each job:** the plan with the holes already drilled filled in and the next one ringed, how far it has got, who made it and when, the tools, and the buttons that fit its state (start, confirm, stop, delete). The jobs that wait for the operator are at the top of the overview with their Confirm button.
* **Start asks once more:** the Start button of the job page, of the Monitor list and of the queue of a machine needs a second touch (the first one changes the button to "Sure?" and leaving it cancels), so a touch by mistake does not set the machine going.
* **A list that can be worked with:** search by name, machine, person or state, five orders, a CSV of what is shown, and one button that clears the finished jobs; the overview adds up what the machines have done (jobs, holes, hours).
* **Alerts:** the title of the tab counts the jobs that wait for the operator, and, if the person turns it on, a sound and a notification of the browser say when a new one starts waiting.
* **Machines move between servers:** every machine can be copied, and the machines of a server can be exported to a file and imported into another one (the access tokens of the nodes are never exported).
* **One page for each machine, copies and a lost server:** the page of a machine shows what it is doing, the jobs that wait for it with their total time, and the last ones it finished; a job can be left ready in several copies at once (the same board many times); the drawing of a plan is saved as an SVG; and a red line says when the server stops answering, until it answers again.
* **The node of the drill head on the page of a machine:** when the machine's configuration names the node (`head_address`), the page shows its spindle speed, its temperature with the verdict of the node, the protect output and the camera model, a button that shows its camera (MJPEG) and, for an operator, a button that measures the table under the head; all of it goes through EH3D-SERVER, which holds the token of the node. Tested against a stand-in, never against a real node.
* **The spindle on the page of a machine:** everybody reads which spindle the machine carries (the original or the one with a drive), what happens to a job that asks for more than it gives, the limits of the spindle in use and the top speed to set in the node of the machine; an administrator changes the spindle and the safety switch (refuse the job, which is the default, or warn and cut the turns to the top of the spindle). When a job is prepared with the switch on `warn`, the plan lists what goes beyond the spindle, tool by tool; with `reject` the server refuses it and Studio says why. Not tried against a real machine.
* **Free G-code jobs and GRBL machines:** a machine can be a GRBL controller on a serial port of the server (port and baud rate; the server must be built with `--features serial`), and an administrator adds or changes it in Configure. In Prepare, a G-code program (pasted or loaded from a file) is previewed and kept ready like any job, with a safety switch to start the spindle and the coolant again when it goes on, off by default. A running G-code job is held and resumed from the list, from its own page and from the overview, which say the line it has got to and what it waits for (a hold, or the wait before the first move of a job that goes on); a job that stopped offers to go on from where it stopped: the server kept what was asked, so the file is not picked again. Drilling and routing jobs take the tools that are switched off and the holes or paths already done, and the reference of the settings of the server lists `gcode_finish_wait_s` and `updates_dir`. Tried on the simulator and against a stand-in only, never against a real GRBL controller. An administrator can allow the `$` lines of GRBL (such as `$H`) per machine with a safety switch in Configure, off by default and with a warning.
* **The ring of LEDs and the last quality check on the page of a machine:** an operator turns the ring on or off and sets its level and tone, and everybody reads the verdict of the last check of the work. Tested against a stand-in, never against a real node.

## 🔒 Security & Safety

| Threat | Defense |
|---|---|
| Someone who has not signed in | every page needs a login; the server refuses every request without a valid token (`401`), and five wrong passwords block the name for a while |
| A person doing more than their role allows | the menu and the buttons follow the role, and the server checks the role again on every request |
| A token read by someone else | the token of a program is shown once, the token of a node never again; the login token lives only in the browser of the person and goes only to the server the page came from |
| A wrong value sent to the server | names, passwords and addresses are checked before sending, and the server checks them again and refuses a configuration with a key that does not exist |

**What is not defended:** the server does not terminate TLS yet, so on a plain network the token and the passwords travel in clear text; a browser that someone else can use stays signed in until the person signs out or the login ends (12 hours by default). Studio has had no independent review, and the checks of a form are a convenience: only the server is to be trusted.

## 🔌 Interfaces

| Interface | What it is | Where |
|---|---|---|
| REST API | everything the pages show and change goes through `/api/v1/` of EH3D-SERVER, with the login token as a bearer token | `src/api.ts` |
| Websocket | `/api/v1/events?token=...` for the live page, with a reconnection that waits longer each time | `src/pages/Monitor.tsx` |
| Browser storage | the login token, the language, the theme and the refresh, under `eh3d-studio.*` | `src/App.tsx` |

## ⚙️ Configuration

Studio has no settings file of its own: the server's settings are in its `server.cfg` (the page Server lists them), and what a person chooses is kept in their browser.

| Setting | Default | Range | What it does |
|---|---|---|---|
| `studio_dir` | none | a folder | in `server.cfg` of the server: serve the pages of this folder at its root |
| `EH3D_SERVER` | `http://127.0.0.1:18200` | a URL | while developing (`run.sh`): the server the pages talk to |
| `eh3d-studio.lang` | the browser's | `en es it de fr pt zh ja` | the language of the page |
| `eh3d-studio.theme` | `forge` | `forge paper neon midnight` | the theme of the page |
| `eh3d-studio.refresh` | 5 | 0, 2, 5, 10, 30 | seconds between two readings of the server (0: only when asked) |

## 🚀 Quick start

You need Node 22 or newer. To use Studio on the CM5, build the pages and tell the server where they are.

```bash
build.bat            # install and build the pages into dist/  -  ./build.sh on Linux
test.bat             # type check, lint and tests
python -I tools/ci_validate.py
```

Copy `dist/` to the CM5 (for example to `/opt/eh3d-studio`), put `studio_dir = /opt/eh3d-studio` in the `server.cfg` of the server and restart it: Studio opens at the address of the server, for example `http://cm5:18200/`. The first time, the page asks for the set-up code that the server prints on its console and makes the administrator.

## 🧪 Testing

`npm test` runs 76 tests and all pass: the client of the API (the token, the body, the query, the errors, a network that fails, the paths with names that need escaping), the rules of names, passwords and node addresses, what is wrong with a machine, the menu of each role, the machines grouped by station, the counts and the actions of a job, and the eight languages (a text in every language, Chinese and Japanese in their own scripts, the same placeholders everywhere). `npm run typecheck` and `npm run lint` pass as well.

## 🏗️ Build & Release

The version lives in `package.json` and in `eh3d.project.json`, and each version has its entry in [CHANGELOG.md](CHANGELOG.md). `build.sh` / `build.bat` install what is needed the first time and build the pages into `dist/`; `test.sh` / `test.bat` run the type check, the lint and the tests; `run.sh` / `run.bat` open Studio in development against a server (`run.sh http://cm5:18200`).

## 🩺 Troubleshooting

| Symptom | What to do |
|---|---|
| The page says the server does not answer | Open `http://ADDRESS/api/v1/health` in the browser: it must answer `eh3d-server` and a version. If Studio is served by the server, the address of the page is the address of the server. |
| The page asks for a set-up code | The server has no user yet: the code is in its console (on the CM5: `journalctl -u eh3d-server`). |
| A page I need is not in the menu | The menu follows the role: machines and users and tokens are for administrators. |
| Saving a machine is refused with a configuration error | The machine file has a key that does not exist or a value out of range; the server refuses it instead of ignoring it. |

## 📂 Repository Structure

<p align="center">
  <img src="images/repository-structure.svg" alt="Repository structure of EH3D-STUDIO" width="100%">
</p>

<details>
<summary>Text version of the tree</summary>

```text
EH3D-STUDIO/
├── src/
│   ├── App.tsx context.tsx                      the shell, the menu in three groups, what the pages share
│   ├── api.ts types.ts                          the client of the API of the server
│   ├── model.ts                                 roles, rules of the forms, fleet and jobs
│   ├── jobtools.ts attention.ts                 the job tools: holes, requests, plan, search, CSV
│   ├── i18n.ts texts.ts                         the eight languages
│   ├── pages/                                   Monitor, Configure, Account and the sign-in
│   └── styles.css                               the Forge theme and three more
├── tools/
│   ├── demo_seed.mjs shots.mjs                  demo data and the pictures of the README
│   └── ci_validate.py                           CI check and README check
├── docs/                                        the sources of the two pictures
├── public/                                      the icon of the page
├── images/                                      banner, pictures and screenshots
├── .github/                                     CI workflow, issue and pull-request templates
├── index.html                                   the page that loads the application
├── package.json                                 the package, its scripts and its versions
├── vite.config.ts                               build and lint settings
├── eslint.config.js                             build and lint settings
├── tsconfig.json                                type settings
├── tsconfig.app.json                            type settings
├── build.sh build.bat                           install and build the pages
├── run.sh run.bat                               open Studio in development
├── eh3d.project.json bump_manifest_version.py   manifest and version utility
├── CHANGELOG.md                                 what changed in each version
├── SECURITY.md SUPPORT.md                       vulnerabilities and support
└── CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE   how to contribute and the licence
```

</details>

## 🗺️ Roadmap & Known limits

**Known limits today**

* It has not been used against machines on a bench: no machine of a workshop has been set up through it and no job has run on a real machine from it.
* The server does not terminate TLS, so the token and the passwords travel in clear text on a plain network.
* The settings of the server are shown as a reference, not edited: the API does not give them out, and they are changed in `server.cfg` on the machine that runs the server.
* Only the owner has looked at the pages; the texts of the languages other than English have not been read by native speakers.
* There is no page of the viewer of a job (the plan of the holes) yet.

**Next**

* Try it with the machines of a bench: add each machine, reach its node and run a job from the page of the jobs.
* A page to view a job (the plan of the holes and where the job is).
* Terminate TLS in the server, or document a reverse proxy, and show the state of the connection.
* Edit the settings of the server from Studio when the server gives them out.

## 🌍 Languages

README and texts exist in English, Spanish, French, Italian, German, Chinese, Japanese and European Portuguese.

## 🔗 Related Projects

* [EH3D-SERVER](https://github.com/JuanenRac/EH3D-SERVER): the server this panel configures
* [EH3D-DRILLPRO](https://github.com/JuanenRac/EH3D-DRILLPRO): the drilling program, a client of the server
* [EH3D-ROUTEPRO](https://github.com/JuanenRac/EH3D-ROUTEPRO): the routing program, a client of the server
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): the modern interface of the Bungard machines, with a window of the machines and stations
* [EH3D-NODE-BUNGARD-HMI](https://github.com/JuanenRac/EH3D-NODE-BUNGARD-HMI): the touch screen of the machine, one more client of the server
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): the look this panel follows

## 📚 Documentation

* The API of the server that Studio talks to: `docs/API.md` of EH3D-SERVER.
* How to put the server and Studio on the CM5: `docs/DEPLOY.md` of EH3D-SERVER.
* [Changelog](CHANGELOG.md)

## 🤝 Contributing & Community

* Before a pull request run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, and `python -I tools/ci_validate.py`: all must pass. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).
* The README exists in eight languages: a change to the text is made in all eight files, and the two pictures are drawn from `docs/architecture.json` and `docs/structure.json` by `tools/make_architecture.py` and `tools/make_structure.py`.
* A text of the page is one row of eight in `src/texts.ts`; a test reads every row.
* Report a vulnerability privately: [SECURITY.md](SECURITY.md). Questions, ideas and reports: electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTHOR

**JuanenRac (Electro Hobby 3D)** · electrohobby3d@gmail.com

## 📜 LICENSE

Software: GPL-3.0-or-later. See [LICENSE](LICENSE). Hardware designs of the suite use CERN OHL-S.
