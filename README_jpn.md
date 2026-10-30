<p align="center">
  <img src="images/EH3D_BANNER.svg" alt="EH3D-STUDIO banner" width="100%">
</p>

# 🧭 EH3D-STUDIO

<p align="center"><a href="README.md">🇺🇸 English</a> | <a href="README_spa.md">🇪🇸 Español</a> | <a href="README_fra.md">🇫🇷 Français</a> | <a href="README_ita.md">🇮🇹 Italiano</a> | <a href="README_deu.md">🇩🇪 Deutsch</a> | <a href="README_zho.md">🇨🇳 中文</a> | 🇯🇵 <b>日本語</b> | <a href="README_por.md">🇵🇹 Português</a></p>

### EH3D サーバーの設定パネル：マシンとそのステーション、ジョブ、ユーザー、プログラムのトークンを整理して表示します。BUNGARD-GUI と同じ見た目で、8 言語に対応します。

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20TypeScript-00599C.svg" alt="React and TypeScript">
  <img src="https://img.shields.io/badge/Languages-8-00E5FF.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Version-0.0.1-0f6cbd.svg" alt="Version">
  <img src="https://img.shields.io/badge/Maturity-scaffolding-FFB020.svg" alt="Maturity">
</p>

---

**正直なチェック - 今日実際に動くもの：** React と TypeScript の Web アプリで、EH3D-SERVER にサインインし、サーバーが持つ内容（ステーション・ノード・設定ファイル付きのマシン、ジョブ、ユーザーとトークン、ライブイベント）を表示・変更します。API クライアント、フォームの規則、ロール別メニュー、8 言語は 20 件のテストで確認済みで、画面は模擬マシンを持つローカルサーバーに対してブラウザーで確認しました。**試験台の実機では使っておらず**、サーバーはまだ TLS を終端しません。

---

> **安全とセキュリティの状況：** これは安全システムではありません。Studio はマシンを動かすサーバーが保持する内容を変更します。誤ったノードのアドレスやトークン、誤ったステーション、削除されたマシンは、工房を止めたり、ジョブを誤ったマシンに向けたりすることがあり、ここで作ったトークンはプログラムがジョブを送れるようにします。サーバーはリクエストごとにロールを確認し、ボタンを隠すのは便宜にすぎません。暗号化されていないネットワークではトークンが平文で流れます（サーバーはまだ TLS を終端しません）。自宅のネットワークか VPN で使ってください。このプロジェクトは独立しており、Bungard Elektronik が作成・承認・サポートするものではありません。

## 📋 ひと目で

| | |
|---|---|
| バージョン | `0.0.1` |
| 成熟度 | 足場 |
| テスト | 20 件のテスト（`npm test`） |
| 技術スタック | React 19, TypeScript, Vite |
| 実機での動作 | 試験台の実機では未使用：模擬マシンを持つローカルサーバーに対してブラウザーで確認 |

**移動先：** [概要](#-概要) · [アーキテクチャ](#-アーキテクチャ) · [クイックスタート](#-クイックスタート) · [テスト](#-テスト) · [構成](#-リポジトリの構成) · [関連](#-関連プロジェクト)

## 🚦 プロジェクトの状況

各行はこのリポジトリの一部分で、信号は今日どこまで進んでいるかを示します。計画ではなく、リポジトリが示せるもの（テスト、ビルド、実行）に基づいて書かれています。

🟢 完了・検証済み · 🟡 動作する（既知の制限あり） · 🟠 一部のみ、または未検証 · 🔴 未実装または動作しない

| 領域 | 状態 | ここでの意味 |
|---|---|---|
| ソフトウェア | 🟡 | アプリは警告なしでビルドでき（型チェック、lint、ビルド）、サーバーがアドレスのルートで配信します。ローカルサーバーに対してブラウザーで動かしました。 |
| テスト | 🟢 | 20 件のテストが通過（`npm test`）：エラー処理付きの API クライアント、名前・パスワード・アドレスの規則、ロール別メニュー、ステーション別フリート、ジョブの操作、8 言語。 |
| ページ | 🟡 | 概要、ステーション別マシン、ジョブ、ライブイベント、マシン、ユーザーとトークン、サーバー、アカウント、環境設定、バージョン情報が書かれており、ジョブとマシンはサーバーの実 API で管理します。作者以外が試したページはありません。 |
| 言語 | 🟢 | すべての文に 8 言語があり、サーバーの拒否メッセージも含みます。文言はテストが読みますが、人が読んだのは英語と他言語の一部の文だけです。 |
| 実機 | 🔴 | 試験台では何もしていません。マシンの追加、ノードへの接続、実機でのジョブ実行はまだありません。 |
| ドキュメント | 🟢 | 8 言語の README、サーバーの設定、Studio を CM5 に置く方法。 |

## 🎯 概要

* **モニター：** 概要（空き・実行中・待機中のマシン、準備済み・進行中・完了・失敗のジョブ）、ステーション別に各ジョブの進捗を示すマシン、フィルターと操作付きのジョブ一覧、サーバーの websocket によるライブイベント。
* **設定：** マシン（ID、名前、モデル、ステーション、アドレスとトークン付きのノードまたはシミュレーター、2 つの設定ファイルとマシンファイルの本文）、ロール付きのユーザー、プログラムのトークン、サーバー設定のリファレンス。
* **アカウント：** 本人のパスワード、言語、テーマ、画面がサーバーに再問い合わせする間隔。
* **BUNGARD-GUI の見た目：** 既定は Forge テーマ（温かい黒、琥珀色、2 つの角を切ったカード、琥珀色の枠のボタン）で、ほかにペーパー、ネオン、ミッドナイトがあります。
* **サーバーから配信：** `server.cfg` の `studio_dir` を設定すると、サーバーが自分のアドレスのルートでこのページを配信します。ほかに入れるものも、クロスオリジンの設定も不要です。

## 🧩 EH3D での役割

EH3D-STUDIO と EH3D-SERVER の関係は、ARMOR-STUDIO と ARMOR サーバーの関係と同じです。サーバーが保持するすべてを、整理・分類して設定・確認できる唯一の場所です。プログラム（EH3D-DRILLPRO、EH3D-ROUTEPRO、EH3D-BUNGARD-GUI、マシンのタッチスクリーン）はここで作ったトークンとここで設定したマシンを使い、マシン自体はそれぞれのノードを通じて到達します。

## 🏛️ アーキテクチャ

<p align="center">
  <img src="images/architecture.svg" alt="EH3D-STUDIO のアーキテクチャ：誰が使い、何を持ち、何に依存するか" width="100%">
</p>

このリポジトリの各部分のつながり：誰が話しかけ、何を持ち、何に依存するか。図は `docs/architecture.json` から描かれ、コードと照合されます。

## 🖼️ スクリーンショット

<p align="center">
  <img src="images/screenshots/overview.png" alt="overview" width="100%">
</p>

<p align="center"><em>概要：空き・実行中・待機中のマシンと、状態別のジョブ。</em></p>

<p align="center">
  <img src="images/screenshots/fleet.png" alt="fleet" width="100%">
</p>

<p align="center"><em>ステーション別のマシンと、状態・各ジョブの進捗。</em></p>

<p align="center">
  <img src="images/screenshots/jobs.png" alt="jobs" width="100%">
</p>

<p align="center"><em>フィルター付きのジョブ一覧と、ロールが許す操作。</em></p>

<p align="center">
  <img src="images/screenshots/machines.png" alt="machines" width="100%">
</p>

<p align="center"><em>サーバーのマシン：ステーション、ノード、設定ファイル。</em></p>

<p align="center">
  <img src="images/screenshots/access.png" alt="access" width="100%">
</p>

<p align="center"><em>ロール付きのユーザーと、プログラムのトークン。</em></p>

<p align="center">
  <img src="images/screenshots/server.png" alt="server" width="100%">
</p>

<p align="center"><em>サーバーの設定（参照）。</em></p>

<p align="center">
  <img src="images/screenshots/preferences.png" alt="preferences" width="100%">
</p>

<p align="center"><em>環境設定：言語、テーマ、更新。</em></p>

## ✨ 機能

* **ロールごとのメニュー：** 閲覧者はモニターのページ、サーバーのページ、アカウントのページを見られ、管理者はさらにマシンとユーザーとトークンを見られます。
* **送信前のチェック：** 名前、パスワード、ノードのアドレスはフォームで確認され、サーバーの拒否は利用者の言語の文で表示されます。
* **トークンは一度だけ表示：** プログラムのトークンは作成時にだけ表示され、ノードのトークンは保存後は二度と表示されません。
* **サーバーを追う：** フリートとジョブは自動で（または要求時だけ）更新され、ライブのページは接続が切れると再接続します。

## 🔒 セキュリティと安全

| 脅威 | 防御 |
|---|---|
| サインインしていない人 | すべてのページにサインインが必要で、サーバーは有効なトークンのないリクエストをすべて拒否し（`401`）、パスワードを 5 回間違えるとその名前はしばらくロックされます |
| ロールを超えた操作 | メニューとボタンはロールに従い、サーバーはリクエストごとにロールを再確認します |
| 他人に読まれるトークン | プログラムのトークンは一度だけ、ノードのトークンは二度と表示されません。ログイントークンは本人のブラウザーにだけあり、ページの配信元のサーバーにだけ送られます |
| サーバーへの誤った値 | 名前、パスワード、アドレスは送信前に確認され、サーバーも再確認して、存在しないキーを含む設定を拒否します |

**防御していないもの：** サーバーはまだ TLS を終端しないため、暗号化されていないネットワークではトークンとパスワードが平文で流れます。他の人が使えるブラウザーは、本人がサインアウトするかログインの期限が切れる（既定 12 時間）までサインインしたままです。Studio は独立した審査を受けておらず、フォームのチェックは便宜にすぎません。信頼できるのはサーバーだけです。

## 🔌 インターフェース

| インターフェース | 内容 | 場所 |
|---|---|---|
| REST API | ページが表示・変更するものはすべて EH3D-SERVER の `/api/v1/` を通り、ログイントークンを bearer トークンとして使います | `src/api.ts` |
| Websocket | ライブのページは `/api/v1/events?token=...` を使い、再接続のたびに待ち時間が長くなります | `src/pages/Monitor.tsx` |
| ブラウザーのストレージ | ログイントークン、言語、テーマ、更新間隔を `eh3d-studio.*` に保存します | `src/App.tsx` |

## ⚙️ 設定

Studio 自身に設定ファイルはありません。サーバーの設定はサーバーの `server.cfg` にあり（サーバーのページに一覧があります）、個人の選択はブラウザーに保存されます。

| 設定 | 既定 | 範囲 | 内容 |
|---|---|---|---|
| `studio_dir` | none | a folder | サーバーの `server.cfg` で：このフォルダーのページをルートで配信 |
| `EH3D_SERVER` | `http://127.0.0.1:18200` | a URL | 開発中（`run.sh`）：ページが通信するサーバー |
| `eh3d-studio.lang` | the browser's | `en es it de fr pt zh ja` | ページの言語 |
| `eh3d-studio.theme` | `forge` | `forge paper neon midnight` | ページのテーマ |
| `eh3d-studio.refresh` | 5 | 0, 2, 5, 10, 30 | サーバーを読む間隔（秒）（0：要求時だけ） |

## 🚀 クイックスタート

Node 22 以降が必要です。CM5 で Studio を使うには、ページをビルドして、その場所をサーバーに伝えます。

```bash
build.bat            # install and build the pages into dist/  -  ./build.sh on Linux
test.bat             # type check, lint and tests
python -I tools/ci_validate.py
```

`dist/` を CM5 にコピーし（例：`/opt/eh3d-studio`）、サーバーの `server.cfg` に `studio_dir = /opt/eh3d-studio` を書いて再起動すると、サーバーのアドレス（例：`http://cm5:18200/`）で Studio が開きます。初回はサーバーがコンソールに出力するセットアップコードを入力して管理者を作成します。

## 🧪 テスト

`npm test` は 20 件のテストを実行し、すべて通過します：API クライアント（トークン、本文、クエリ、エラー、ネットワーク障害、エスケープが必要な名前のパス）、名前・パスワード・ノードアドレスの規則、マシンの問題点、各ロールのメニュー、ステーション別のマシン、ジョブの集計と操作、8 言語（各言語の文言、中国語と日本語はそれぞれの文字、プレースホルダーが全言語で一致）。`npm run typecheck` と `npm run lint` も通過します。

## 🏗️ ビルドとリリース

バージョンは `package.json` と `eh3d.project.json` にあり、各バージョンは [CHANGELOG.md](CHANGELOG.md) にエントリーがあります。`build.sh` / `build.bat` は初回に必要なものをインストールしてページを `dist/` にビルドし、`test.sh` / `test.bat` は型チェック、lint、テストを実行し、`run.sh` / `run.bat` は開発モードでサーバーに対して Studio を開きます（`run.sh http://cm5:18200`）。

## 🩺 トラブルシューティング

| 症状 | 対処 |
|---|---|
| ページにサーバーが応答しないと出る | ブラウザーで `http://アドレス/api/v1/health` を開いてください。`eh3d-server` とバージョンが返るはずです。サーバーが Studio を配信している場合、ページのアドレスがサーバーのアドレスです。 |
| ページがセットアップコードを求める | サーバーにまだユーザーがいません。コードはサーバーのコンソールにあります（CM5 では `journalctl -u eh3d-server`）。 |
| 必要なページがメニューにない | メニューはロールに従います。マシンとユーザーとトークンは管理者専用です。 |
| マシンの保存が設定エラーで拒否される | マシンファイルに存在しないキーか範囲外の値があります。サーバーは無視せず拒否します。 |

## 📂 リポジトリの構成

<p align="center">
  <img src="images/repository-structure.svg" alt="EH3D-STUDIO のリポジトリ構成" width="100%">
</p>

<details>
<summary>ツリーのテキスト版</summary>

```text
EH3D-STUDIO/
├── src/
│   ├── App.tsx context.tsx                      枠組み、3 グループのメニュー、ページ共通の部分
│   ├── api.ts types.ts                          サーバー API のクライアント
│   ├── model.ts                                 ロール、フォームの規則、フリート、ジョブ
│   ├── i18n.ts texts.ts                         8 言語
│   ├── pages/                                   モニター、設定、アカウント、サインイン
│   └── styles.css                               Forge テーマとほか 3 つ
├── tools/
│   ├── demo_seed.mjs shots.mjs                  デモデータと README の画像
│   └── ci_validate.py                           CI と README のチェック
├── docs/                                        2 つの図のソース
├── public/                                      ページのアイコン
├── images/                                      バナー、図、スクリーンショット
├── .github/                                     CI ワークフローとテンプレート
├── index.html                                   アプリを読み込むページ
├── package.json                                 パッケージ、スクリプト、バージョン
├── vite.config.ts                               ビルドと lint の設定
├── eslint.config.js                             ビルドと lint の設定
├── tsconfig.json                                型の設定
├── tsconfig.app.json                            型の設定
├── build.sh build.bat                           ページのインストールとビルド
├── run.sh run.bat                               開発モードで Studio を開く
├── eh3d.project.json bump_manifest_version.py   マニフェストとバージョンユーティリティ
├── CHANGELOG.md                                 各バージョンの変更点
├── SECURITY.md SUPPORT.md                       脆弱性とサポート
└── CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE   貢献方法とライセンス
```

</details>

## 🗺️ ロードマップと既知の制限

**現時点の既知の制限**

* 試験台のマシンでは使っておらず、これを通して工房のマシンを設定したことも、これから実機でジョブを実行したこともありません。
* サーバーは TLS を終端しないため、暗号化されていないネットワークではトークンとパスワードが平文で流れます。
* サーバーの設定は参照として表示するだけで編集できません。API が提供しないため、サーバーを動かすマシンの `server.cfg` で変更します。
* ページを見たのは所有者だけで、英語以外の言語の文言はネイティブの話者に読んでもらっていません。
* ジョブのビューア（穴の平面図）のページはまだありません。

**次にやること**

* 試験台のマシンで試す：マシンを 1 台ずつ追加し、ノードに接続して、ジョブのページからジョブを実行する。
* ジョブを見るページ（穴の平面図と進行状況）。
* サーバーで TLS を終端するか、リバースプロキシの使い方を文書化し、接続状態を表示する。
* サーバーが提供するようになったら、Studio からサーバーの設定を編集する。

## 🌍 言語

README とテキストは、英語、スペイン語、フランス語、イタリア語、ドイツ語、中国語、日本語、ヨーロッパポルトガル語で提供されています。

## 🔗 関連プロジェクト

* [EH3D-SERVER](https://github.com/JuanenRac/EH3D-SERVER): このパネルが設定するサーバー
* [EH3D-DRILLPRO](https://github.com/JuanenRac/EH3D-DRILLPRO): 穴あけプログラム（サーバーのクライアント）
* [EH3D-ROUTEPRO](https://github.com/JuanenRac/EH3D-ROUTEPRO): ルーティングプログラム（サーバーのクライアント）
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): Bungard マシンのモダンなインターフェース（マシンとステーションのウィンドウ付き）
* [EH3D-NODE-BUNGARD-HMI](https://github.com/JuanenRac/EH3D-NODE-BUNGARD-HMI): マシンのタッチスクリーン（サーバーのもう 1 つのクライアント）
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): このパネルが倣う見た目

## 📚 ドキュメント

* Studio が通信するサーバーの API：EH3D-SERVER の `docs/API.md`。
* サーバーと Studio を CM5 に置く方法：EH3D-SERVER の `docs/DEPLOY.md`。
* [変更履歴](CHANGELOG.md)

## 🤝 コントリビュートとコミュニティ

* プルリクエストの前に `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` と `python -I tools/ci_validate.py` を実行し、すべて通過させてください。[CONTRIBUTING.md](CONTRIBUTING.md) と[行動規範](CODE_OF_CONDUCT.md)を参照してください。
* README は 8 言語あります。文面の変更は 8 ファイルすべてで行い、2 つの図は `tools/make_architecture.py` と `tools/make_structure.py` が `docs/architecture.json` と `docs/structure.json` から描きます。
* ページの文言は `src/texts.ts` の 8 項目 1 行で、テストがすべての行を読みます。
* 脆弱性は非公開で報告してください：[SECURITY.md](SECURITY.md)。質問、アイデア、報告：electrohobby3d@gmail.com（[SUPPORT.md](SUPPORT.md)）。

## 👤 作者

**JuanenRac (Electro Hobby 3D)** · electrohobby3d@gmail.com

## 📜 ライセンス

ソフトウェア：GPL-3.0-or-later。[LICENSE](LICENSE) を参照。スイートのハードウェア設計には CERN OHL-S を使います。
