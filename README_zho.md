<p align="center">
  <img src="images/EH3D_BANNER.svg" alt="EH3D-STUDIO banner" width="100%">
</p>

# 🧭 EH3D-STUDIO

<p align="center"><a href="README.md">🇺🇸 English</a> | <a href="README_spa.md">🇪🇸 Español</a> | <a href="README_fra.md">🇫🇷 Français</a> | <a href="README_ita.md">🇮🇹 Italiano</a> | <a href="README_deu.md">🇩🇪 Deutsch</a> | 🇨🇳 <b>中文</b> | <a href="README_jpn.md">🇯🇵 日本語</a> | <a href="README_por.md">🇵🇹 Português</a></p>

### EH3D 服务器的配置面板：机床及其工位、作业、用户和程序令牌，结构清晰，外观与 BUNGARD-GUI 一致，支持八种语言。

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20TypeScript-00599C.svg" alt="React and TypeScript">
  <img src="https://img.shields.io/badge/Languages-8-00E5FF.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Version-0.0.1-0f6cbd.svg" alt="Version">
  <img src="https://img.shields.io/badge/Maturity-scaffolding-FFB020.svg" alt="Maturity">
</p>

---

**诚实检查 - 今天实际能运行的内容：** 一个用 React 和 TypeScript 编写的网页应用，登录 EH3D-SERVER 并显示和修改其内容：带工位、节点和配置文件的机床、作业、用户和令牌、实时事件。API 客户端、表单规则、按角色划分的菜单和八种语言由 44 个测试覆盖，页面已在浏览器中对接带模拟机床的本地服务器查看过。**尚未在试验台的真实机床上使用过**，服务器也尚未终结 TLS。

---

> **安全状态（safety 与信息安全）：** 这不是安全系统。Studio 会修改一台驱动机床的服务器所保存的内容：错误的节点地址或令牌、错误的工位或被删除的机床，可能使车间停工或把作业发到错误的机床，而在此创建的令牌允许某个程序发送作业。服务器在每次请求时都会检查该人的角色；隐藏按钮只是为了方便。在未加密的网络上令牌以明文传输（服务器尚未终结 TLS）：请在家庭网络内或通过 VPN 使用。本项目是独立的：并非由 Bungard Elektronik 制造、认可或支持。

## 📋 速览

| | |
|---|---|
| 版本 | `0.0.1` |
| 成熟度 | 脚手架 |
| 测试 | 44 个测试（`npm test`） |
| 技术栈 | React 19, TypeScript, Vite |
| 真实硬件 | 未在试验台上用真实机床：已在浏览器中对接带模拟机床的本地服务器查看 |

**跳转到：** [概述](#-概述) · [架构](#-架构) · [快速开始](#-快速开始) · [测试](#-测试) · [结构](#-仓库结构) · [相关项目](#-相关项目)

## 🚦 项目状态

每一行是本仓库的一个部分，灯号表示它今天做到了哪一步。内容依据仓库能够展示的证据（测试、构建、运行），而不是计划。

🟢 已完成并验证 · 🟡 可用，有已知限制 · 🟠 部分完成或尚未验证 · 🔴 未完成或不可用

| 领域 | 状态 | 在这里的含义 |
|---|---|---|
| 软件 | 🟡 | 应用构建无警告（类型检查、lint、构建），由服务器在其地址根路径提供；已在浏览器中对接本地服务器运行过。 |
| 测试 | 🟢 | 44 个测试通过（`npm test`）：带错误处理的 API 客户端、名称/密码/地址规则、按角色划分的菜单、按工位划分的机群、作业的操作和八种语言。 |
| 页面 | 🟡 | 概览、按工位的机床、作业、实时事件、机床、用户和令牌、服务器、账户、偏好设置和关于页面均已编写；作业和机床通过服务器的真实 API 管理。尚无作者以外的人试用过任何页面。 |
| 语言 | 🟢 | 每条文本都有八种语言，包括服务器的拒绝信息；文本由测试读取，但只有英语和其他语言的少数语句被人读过。 |
| 真实机床 | 🔴 | 尚未在试验台上做过任何事：没有添加机床、没有连到节点，也没有通过它在真实机床上运行作业。 |
| 文档 | 🟢 | 八种语言的 README、服务器的设置，以及如何把 Studio 放到 CM5 上。 |

## 🎯 概述

* **监控：** 概览（空闲、运行和等待中的机床，就绪、进行中、已完成和失败的作业）、按工位排列并显示各作业进度的机床、带筛选和操作的作业列表，以及通过服务器 websocket 获得的实时事件。
* **配置：** 机床（标识、名称、型号、工位、带地址和令牌的节点或模拟器、两个配置文件和机床文件的文本）、带角色的用户、程序令牌，以及服务器设置的参考。
* **账户：** 本人的密码、语言、主题，以及页面多久重新询问一次服务器。
* **BUNGARD-GUI 的外观：** 默认 Forge 主题（暖黑、琥珀色、两个切角的卡片、琥珀色轮廓的按钮），另有三个：纸张、霓虹和午夜。
* **由服务器提供：** 在 `server.cfg` 中设置 `studio_dir`，服务器就会在自己地址的根路径提供这些页面，无需再安装任何东西，也无需跨域设置。

## 🧩 在 EH3D 中的角色

EH3D-STUDIO 之于 EH3D-SERVER，就像 ARMOR-STUDIO 之于 ARMOR 服务器：服务器所保存的一切都在这里配置和跟踪，结构清晰、分类明确。程序（EH3D-DRILLPRO、EH3D-ROUTEPRO、EH3D-BUNGARD-GUI、机床的触摸屏）使用在此创建的令牌和在此设置的机床；机床本身则通过各自的节点访问。

## 🏛️ 架构

<p align="center">
  <img src="images/architecture.svg" alt="EH3D-STUDIO 的架构：谁在使用、包含什么、依赖什么" width="100%">
</p>

本仓库各部分如何配合：谁与它通信、它包含什么、依赖什么。图由 `docs/architecture.json` 生成，并与代码核对。

## 🖼️ 屏幕截图

<p align="center">
  <img src="images/screenshots/overview.png" alt="overview" width="100%">
</p>

<p align="center"><em>概览：空闲、运行和等待中的机床，以及按状态统计的作业。</em></p>

<p align="center">
  <img src="images/screenshots/fleet.png" alt="fleet" width="100%">
</p>

<p align="center"><em>按工位排列的机床，显示状态和各作业进度。</em></p>

<p align="center">
  <img src="images/screenshots/jobs.png" alt="jobs" width="100%">
</p>

<p align="center"><em>带筛选的作业，以及角色允许的操作。</em></p>

<p align="center">
  <img src="images/screenshots/prepare.png" alt="prepare" width="100%">
</p>

<p align="center"><em>准备作业：输入的加工内容、图形和服务器算出的用时。</em></p>

<p align="center">
  <img src="images/screenshots/job.png" alt="job" width="100%">
</p>

<p align="center"><em>单个作业：已钻孔的图形、进度以及与其状态相符的按钮。</em></p>

<p align="center">
  <img src="images/screenshots/machines.png" alt="machines" width="100%">
</p>

<p align="center"><em>服务器的机床：工位、节点和配置文件。</em></p>

<p align="center">
  <img src="images/screenshots/access.png" alt="access" width="100%">
</p>

<p align="center"><em>带角色的用户，以及程序令牌。</em></p>

<p align="center">
  <img src="images/screenshots/server.png" alt="server" width="100%">
</p>

<p align="center"><em>服务器设置的参考。</em></p>

<p align="center">
  <img src="images/screenshots/updates.png" alt="updates" width="100%">
</p>

<p align="center"><em>更新页面：已安装的内容、GitHub 上的最新版本，以及服务器辅助程序所做的事。</em></p>

<p align="center">
  <img src="images/screenshots/preferences.png" alt="preferences" width="100%">
</p>

<p align="center"><em>偏好设置：语言、主题和刷新。</em></p>

## ✨ 功能

* **每个角色看到自己的菜单：** 观察者看到监控页面、服务器页面和账户页面；管理员还能看到机床以及用户和令牌。
* **发送前先检查：** 名称、密码和节点地址在表单中检查，服务器的拒绝信息以该人所用语言的句子显示。
* **令牌只显示一次：** 程序令牌在创建时出现，之后不再显示；节点令牌保存后绝不再显示。
* **跟随服务器：** 机群和作业自动刷新（或仅在请求时刷新），实时页面在连接断开时会重新连接。
* **更新：** 管理员页面将已安装的服务器和 Studio 与 GitHub 上最新版本比较，按需检查并更新较新的部分，并显示服务器辅助程序工作时的动作；服务器自身重启时，页面会自动恢复。更新需要在 `server.cfg` 中设置 `updates_dir` 并安装 EH3D-SERVER 的辅助程序；已用 GitHub 和 systemd 的替身测试过，从未在真实安装上运行。
* **在这里准备作业：** 选择机床，用程序读取的文件（`.NCD` 加 `.DTD`，`.PLT` 加 `.RTD`）或手工输入的孔位（刀具、x 和 y，以及每把刀具的进给、转速和额外行程）给出加工内容；查看服务器算出的图形、用时和行程，然后把作业保存为就绪。作业不会自行启动。
* **每个作业一个页面：** 图形中已钻的孔被填充、下一个孔被圈出，显示进度、创建者和时间、刀具，以及与其状态相符的按钮（启动、确认、停止、删除）。等待操作员的作业显示在概览顶部，并带有确认按钮。
* **可以真正用起来的列表：** 按名称、机床、人员或状态搜索，五种排序，导出当前显示内容的 CSV，一个清除已结束作业的按钮；概览汇总机床完成的工作（作业、孔数、小时）。
* **提醒：** 标签页标题会统计等待操作员的作业数；如果用户开启，新的作业开始等待时还会有声音和浏览器通知。
* **机床可在服务器之间迁移：** 每台机床都可以复制，一台服务器的机床可以导出为文件并导入另一台服务器（节点的访问令牌绝不会被导出）。

## 🔒 安全与防护

| 威胁 | 防御 |
|---|---|
| 未登录的人 | 每个页面都需要登录；服务器拒绝所有没有有效令牌的请求（`401`），连续五次密码错误会暂时锁定该名称 |
| 做了超出其角色权限的事 | 菜单和按钮跟随角色，服务器在每次请求时再次检查角色 |
| 令牌被他人读取 | 程序令牌只显示一次，节点令牌之后绝不再显示；登录令牌只保存在本人的浏览器中，只发送给提供该页面的服务器 |
| 向服务器发送错误的值 | 名称、密码和地址在发送前检查，服务器会再次检查，并拒绝含有不存在的键的配置 |

**未设防的部分：** 服务器尚未终结 TLS，所以在未加密的网络上令牌和密码以明文传输；别人也能使用的浏览器会一直保持登录，直到本人退出或登录过期（默认 12 小时）。Studio 没有经过独立审查，表单的检查只是为了方便：只有服务器才值得信任。

## 🔌 接口

| 接口 | 内容 | 位置 |
|---|---|---|
| REST API | 页面显示和修改的一切都经由 EH3D-SERVER 的 `/api/v1/`，以登录令牌作为 bearer 令牌 | `src/api.ts` |
| Websocket | 实时页面使用 `/api/v1/events?token=...`，每次重连等待更久 | `src/pages/Monitor.tsx` |
| 浏览器存储 | 登录令牌、语言、主题和刷新间隔，保存在 `eh3d-studio.*` 下 | `src/App.tsx` |

## ⚙️ 配置

Studio 没有自己的设置文件：服务器的设置在它的 `server.cfg` 中（“服务器”页面会列出），个人的选择保存在其浏览器中。

| 设置 | 默认 | 范围 | 作用 |
|---|---|---|---|
| `studio_dir` | none | a folder | 在服务器的 `server.cfg` 中：在其根路径提供此文件夹中的页面 |
| `EH3D_SERVER` | `http://127.0.0.1:18200` | a URL | 开发时（`run.sh`）：页面所对接的服务器 |
| `eh3d-studio.lang` | the browser's | `en es it de fr pt zh ja` | 页面语言 |
| `eh3d-studio.theme` | `forge` | `forge paper neon midnight` | 页面主题 |
| `eh3d-studio.refresh` | 5 | 0, 2, 5, 10, 30 | 两次读取服务器之间的秒数（0：仅在请求时） |

## 🚀 快速开始

需要 Node 22 或更新版本。要在 CM5 上使用 Studio，请构建页面并告诉服务器它们的位置。

```bash
build.bat            # install and build the pages into dist/  -  ./build.sh on Linux
test.bat             # type check, lint and tests
python -I tools/ci_validate.py
```

把 `dist/` 复制到 CM5（例如 `/opt/eh3d-studio`），在服务器的 `server.cfg` 中加入 `studio_dir = /opt/eh3d-studio` 并重启服务器：Studio 即在服务器的地址打开，例如 `http://cm5:18200/`。第一次打开时，页面会要求输入服务器在控制台打印的设置码，并创建管理员。

## 🧪 测试

`npm test` 运行 44 个测试，全部通过：API 客户端（令牌、请求体、查询、错误、网络失败、需要转义名称的路径）、名称/密码/节点地址规则、机床的问题所在、各角色的菜单、按工位分组的机床、作业的计数和操作，以及八种语言（每种语言都有文本、中文和日文使用各自的文字、各处占位符一致）。`npm run typecheck` 和 `npm run lint` 同样通过。

## 🏗️ 构建与发布

版本保存在 `package.json` 和 `eh3d.project.json` 中，每个版本在 [CHANGELOG.md](CHANGELOG.md) 中都有条目。`build.sh` / `build.bat` 首次安装所需内容并把页面构建到 `dist/`；`test.sh` / `test.bat` 运行类型检查、lint 和测试；`run.sh` / `run.bat` 以开发模式对接服务器打开 Studio（`run.sh http://cm5:18200`）。

## 🩺 故障排除

| 现象 | 处理方法 |
|---|---|
| 页面提示服务器没有响应 | 在浏览器中打开 `http://地址/api/v1/health`：应返回 `eh3d-server` 和版本号。如果 Studio 由服务器提供，页面地址就是服务器地址。 |
| 页面要求输入设置码 | 服务器还没有用户：设置码在它的控制台中（在 CM5 上：`journalctl -u eh3d-server`）。 |
| 菜单里没有我需要的页面 | 菜单跟随角色：机床以及用户和令牌仅限管理员。 |
| 保存机床时因配置错误被拒绝 | 机床文件中有不存在的键或超出范围的值；服务器会拒绝而不是忽略它。 |

## 📂 仓库结构

<p align="center">
  <img src="images/repository-structure.svg" alt="EH3D-STUDIO 的仓库结构" width="100%">
</p>

<details>
<summary>目录树的文本版</summary>

```text
EH3D-STUDIO/
├── src/
│   ├── App.tsx context.tsx                      框架、分三组的菜单、页面共享的内容
│   ├── api.ts types.ts                          服务器 API 的客户端
│   ├── model.ts                                 角色、表单规则、机群和作业
│   ├── jobtools.ts attention.ts                 作业工具：孔位、请求、图形、搜索、CSV
│   ├── i18n.ts texts.ts                         八种语言
│   ├── pages/                                   监控、配置、账户和登录
│   └── styles.css                               Forge 主题及另外三个
├── tools/
│   ├── demo_seed.mjs shots.mjs                  演示数据和 README 的图片
│   └── ci_validate.py                           CI 和 README 检查
├── docs/                                        两幅图的源文件
├── public/                                      页面图标
├── images/                                      横幅、图和截图
├── .github/                                     CI 工作流和模板
├── index.html                                   加载应用的页面
├── package.json                                 包、脚本和版本
├── vite.config.ts                               构建和 lint 设置
├── eslint.config.js                             构建和 lint 设置
├── tsconfig.json                                类型设置
├── tsconfig.app.json                            类型设置
├── build.sh build.bat                           安装并构建页面
├── run.sh run.bat                               以开发模式打开 Studio
├── eh3d.project.json bump_manifest_version.py   清单和版本工具
├── CHANGELOG.md                                 每个版本的变化
├── SECURITY.md SUPPORT.md                       漏洞与支持
└── CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE   如何贡献和许可证
```

</details>

## 🗺️ 路线图与已知限制

**目前已知的限制**

* 尚未在试验台的机床上使用过：没有通过它配置过任何车间机床，也没有从它在真实机床上运行过作业。
* 服务器不终结 TLS，因此在未加密的网络上令牌和密码以明文传输。
* 服务器的设置只作为参考显示，不能编辑：API 不提供这些设置，需要在运行服务器的机器上修改 `server.cfg`。
* 只有所有者看过这些页面；英语以外语言的文本没有经过母语者阅读。
* 还没有作业查看页面（孔位平面图）。

**下一步**

* 用试验台的机床试用：添加每台机床、连到其节点，并从作业页面运行作业。
* 增加查看作业的页面（孔位平面图和作业进度）。
* 在服务器中终结 TLS，或写明反向代理的用法，并显示连接状态。
* 服务器提供设置后，在 Studio 中编辑服务器设置。

## 🌍 语言

README 和文本提供英语、西班牙语、法语、意大利语、德语、汉语、日语和欧洲葡萄牙语版本。

## 🔗 相关项目

* [EH3D-SERVER](https://github.com/JuanenRac/EH3D-SERVER): 本面板所配置的服务器
* [EH3D-DRILLPRO](https://github.com/JuanenRac/EH3D-DRILLPRO): 钻孔程序，服务器的客户端
* [EH3D-ROUTEPRO](https://github.com/JuanenRac/EH3D-ROUTEPRO): 铣切程序，服务器的客户端
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): Bungard 机床的现代界面，带有机床和工位窗口
* [EH3D-NODE-BUNGARD-HMI](https://github.com/JuanenRac/EH3D-NODE-BUNGARD-HMI): 机床的触摸屏，服务器的又一个客户端
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): 本面板所遵循的外观

## 📚 文档

* Studio 所对接服务器的 API：EH3D-SERVER 的 `docs/API.md`。
* 如何把服务器和 Studio 放到 CM5 上：EH3D-SERVER 的 `docs/DEPLOY.md`。
* [更新日志](CHANGELOG.md)

## 🤝 参与贡献与社区

* 提交 pull request 之前请运行 `npm run typecheck`、`npm run lint`、`npm test` 和 `npm run build`，以及 `python -I tools/ci_validate.py`：必须全部通过。参见 [CONTRIBUTING.md](CONTRIBUTING.md) 和[行为准则](CODE_OF_CONDUCT.md)。
* README 有八种语言：文本改动要在八个文件中同时进行，两幅图由 `tools/make_architecture.py` 和 `tools/make_structure.py` 根据 `docs/architecture.json` 和 `docs/structure.json` 绘制。
* 页面上的一条文本就是 `src/texts.ts` 中的一行八项；测试会读取每一行。
* 请私下报告漏洞：[SECURITY.md](SECURITY.md)。问题、想法和报告：electrohobby3d@gmail.com（[SUPPORT.md](SUPPORT.md)）。

## 👤 作者

**JuanenRac (Electro Hobby 3D)** · electrohobby3d@gmail.com

## 📜 许可证

软件：GPL-3.0-or-later。见 [LICENSE](LICENSE)。套件的硬件设计使用 CERN OHL-S。
