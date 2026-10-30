# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [0.0.1] - First release: the pages to set up and watch the machines, with the updates from GitHub

- **Updates:** a page for the administrator compares the installed server and Studio with the latest releases on GitHub, checks on request and updates what is newer, showing what the helper does while it works; it comes back by itself when the server restarts. A workflow builds the archive of the pages that the update takes from the release.
## [0.0.1] - The configuration panel of the EH3D server

- **Three groups of pages:** Monitor (overview, machines by station, jobs, live events), Configure (machines, users and tokens, settings of the server) and Account (my account, preferences, about); each person sees the pages their role allows.
- **Machines:** create, edit and delete the machines of the server with their station, the node they are reached through (address and token, never shown again) and the text of their configuration files, with the checks of the server done first.
- **Jobs:** the list with filters by machine and state, the progress of each job, and start, confirm, stop and delete according to the role and the state of the job.
- **Users and tokens:** create people with a role, change their role, disable or delete them; make a token for each program, shown once.
- **Live:** the events of the server over its websocket, with the reconnection.
- **The look of EH3D-BUNGARD-GUI:** the Forge theme by default (warm black, amber, cards with two cut corners), and Paper, Neon and Midnight.
- **Eight languages:** English, Spanish, Italian, German, French, European Portuguese, Chinese and Japanese, also in the refusals of the server.
- **Served by the server:** `studio_dir` in `server.cfg` makes EH3D-SERVER serve these pages at the root of its address.
- **Tests:** 20 tests of the client of the API, the rules of the forms, the navigation, the fleet and the eight languages.
