<p align="center">
  <img src="images/EH3D_BANNER.svg" alt="EH3D-STUDIO banner" width="100%">
</p>

# 🧭 EH3D-STUDIO

<p align="center"><a href="README.md">🇺🇸 English</a> | <a href="README_spa.md">🇪🇸 Español</a> | <a href="README_fra.md">🇫🇷 Français</a> | <a href="README_ita.md">🇮🇹 Italiano</a> | <a href="README_deu.md">🇩🇪 Deutsch</a> | <a href="README_zho.md">🇨🇳 中文</a> | <a href="README_jpn.md">🇯🇵 日本語</a> | 🇵🇹 <b>Português</b></p>

### O painel de configuração do servidor EH3D: as máquinas e as suas estações, os trabalhos, os utilizadores e os tokens dos programas, tudo estruturado e com o aspeto do BUNGARD-GUI, em oito idiomas.

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20TypeScript-00599C.svg" alt="React and TypeScript">
  <img src="https://img.shields.io/badge/Languages-8-00E5FF.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Version-0.0.6-0f6cbd.svg" alt="Version">
  <img src="https://img.shields.io/badge/Maturity-scaffolding-FFB020.svg" alt="Maturity">
</p>

---

**Verificação de honestidade - o que corre hoje:** uma aplicação web em React e TypeScript que entra no EH3D-SERVER e mostra e altera o que ele guarda: as máquinas com a sua estação, o seu nó e os ficheiros de configuração, os trabalhos, os utilizadores e os tokens, os eventos em direto. O cliente da API, as regras dos formulários, o menu por perfil e os oito idiomas estão cobertos por 73 testes, e as páginas foram vistas num navegador contra um servidor local com máquinas simuladas. **Não foi usada com máquinas numa bancada**, e o servidor ainda não termina TLS.

---

> **Estado de segurança (safety) e de segurança informática:** isto não é um sistema de segurança (safety). O Studio altera o que guarda um servidor que move máquinas: um endereço ou um token de nó errados, uma estação errada ou uma máquina apagada podem parar uma oficina ou dirigir um trabalho para a máquina errada, e um token criado aqui permite a um programa enviar trabalhos. O servidor verifica o perfil da pessoa em cada pedido; esconder um botão é apenas uma comodidade. Numa rede sem cifra o token viaja em claro (o servidor ainda não termina TLS): use-o na rede de casa ou por VPN. O projeto é independente: não é feito, aprovado nem apoiado pela Bungard Elektronik.

## 📋 Num relance

| | |
|---|---|
| Versão | `0.0.6` |
| Maturidade | Estrutura inicial |
| Testes | 73 testes (`npm test`) |
| Tecnologias | React 19, TypeScript, Vite |
| Em hardware real | Não com máquinas numa bancada: vista num navegador contra um servidor local com máquinas simuladas |

**Ir para:** [Visão geral](#-visão-geral) · [Arquitetura](#-arquitetura) · [Início rápido](#-início-rápido) · [Testes](#-testes) · [Estrutura](#-estrutura-do-repositório) · [Relacionados](#-projetos-relacionados)

## 🚦 Estado do projeto

Cada linha é uma parte deste repositório e a luz diz até onde chega hoje. É escrita com o que o repositório consegue demonstrar (testes, compilações, execuções), não com o que está previsto.

🟢 Feito e verificado · 🟡 Funciona, com limites conhecidos · 🟠 Feito a meio ou ainda por verificar · 🔴 Por fazer ou a não funcionar

| Área | Estado | O que significa aqui |
|---|---|---|
| Software | 🟡 | A aplicação compila sem avisos (tipos, lint, compilação) e é servida pelo servidor na raiz do seu endereço; já correu num navegador contra um servidor local. |
| Testes | 🟢 | Passam 73 testes (`npm test`): o cliente da API com os seus erros, as regras de nomes, palavras-passe e endereços, o menu por perfil, a frota por estação, as ações de um trabalho e os oito idiomas. |
| Páginas | 🟡 | Resumo, máquinas por estação, trabalhos, eventos em direto, máquinas, utilizadores e tokens, servidor, conta, preferências e acerca de estão escritos; os trabalhos e as máquinas gerem-se com a API real do servidor. Nenhuma página foi experimentada por alguém que não seja o autor. |
| Idiomas | 🟢 | Oito idiomas em cada texto, incluindo as recusas do servidor; os textos são lidos por um teste, mas só o inglês e algumas frases dos outros foram lidos por uma pessoa. |
| Máquinas reais | 🔴 | Nada se fez com ela numa bancada: nenhuma máquina adicionada, nenhum nó alcançado e nenhum trabalho executado por ela numa máquina real. |
| Documentação | 🟢 | README em oito idiomas, as definições do servidor e como pôr o Studio na CM5. |

## 🎯 Visão geral

* **Monitorização:** o resumo (máquinas livres, em curso e à espera, trabalhos prontos, ativos, terminados e falhados), as máquinas sob as suas estações com o progresso de cada trabalho, a lista de trabalhos com filtros e ações, e os eventos em direto do servidor pelo seu websocket.
* **Configuração:** as máquinas (identificador, nome, modelo, estação, um nó com o seu endereço e token ou o simulador, o texto dos dois ficheiros de configuração e o ficheiro de máquina), os utilizadores com o seu perfil, os tokens dos programas e a referência das definições do servidor.
* **Conta:** a palavra-passe da pessoa, o idioma, o tema e de quanto em quanto tempo as páginas voltam a perguntar ao servidor.
* **O aspeto do BUNGARD-GUI:** o tema Forge por omissão (preto quente, âmbar, cartões com dois cantos cortados, botões com contorno âmbar) e mais três: Papel, Néon e Meia-noite.
* **Servido pelo servidor:** com `studio_dir` em `server.cfg` o servidor serve estas páginas na raiz do seu próprio endereço, por isso não há mais nada a instalar nem definição de origem cruzada.

## 🧩 Papel no EH3D

O EH3D-STUDIO está para o EH3D-SERVER como o ARMOR-STUDIO está para o servidor do ARMOR: o único sítio onde se configura e acompanha tudo o que o servidor guarda, estruturado e classificado. Os programas (EH3D-DRILLPRO, EH3D-ROUTEPRO, EH3D-BUNGARD-GUI, o ecrã tátil da máquina) usam os tokens criados aqui e as máquinas definidas aqui; as máquinas em si são alcançadas pelos seus nós.

## 🏛️ Arquitetura

<p align="center">
  <img src="images/architecture.svg" alt="Arquitetura de EH3D-STUDIO: quem o usa, o que contém e de que depende" width="100%">
</p>

Como as partes deste repositório se encaixam: quem fala com ele, o que contém e de que depende. O desenho sai de `docs/architecture.json` e é verificado contra o código.

## 🖼️ Capturas de ecrã

<p align="center">
  <img src="images/screenshots/overview.png" alt="overview" width="100%">
</p>

<p align="center"><em>O resumo: máquinas livres, em curso e à espera, e os trabalhos por estado.</em></p>

<p align="center">
  <img src="images/screenshots/fleet.png" alt="fleet" width="100%">
</p>

<p align="center"><em>As máquinas sob as suas estações, com o estado e o progresso de cada trabalho.</em></p>

<p align="center">
  <img src="images/screenshots/jobs.png" alt="jobs" width="100%">
</p>

<p align="center"><em>Os trabalhos com os filtros e as ações que o perfil permite.</em></p>

<p align="center">
  <img src="images/screenshots/prepare.png" alt="prepare" width="100%">
</p>

<p align="center"><em>Preparar um trabalho: o trabalho escrito, o plano e o tempo calculado pelo servidor.</em></p>

<p align="center">
  <img src="images/screenshots/job.png" alt="job" width="100%">
</p>

<p align="center"><em>Um trabalho: o plano com os furos já feitos, quanto já leva e os botões do seu estado.</em></p>

<p align="center">
  <img src="images/screenshots/machine.png" alt="machine" width="100%">
</p>

<p align="center"><em>Uma máquina: o que faz, o que a espera e os últimos trabalhos que terminou.</em></p>

<p align="center">
  <img src="images/screenshots/machines.png" alt="machines" width="100%">
</p>

<p align="center"><em>As máquinas do servidor: estação, nó e ficheiros de configuração.</em></p>

<p align="center">
  <img src="images/screenshots/access.png" alt="access" width="100%">
</p>

<p align="center"><em>Os utilizadores com o seu perfil, e os tokens dos programas.</em></p>

<p align="center">
  <img src="images/screenshots/server.png" alt="server" width="100%">
</p>

<p align="center"><em>As definições do servidor, como referência.</em></p>

<p align="center">
  <img src="images/screenshots/updates.png" alt="updates" width="100%">
</p>

<p align="center"><em>A página Atualizações: o que está instalado, a última versão no GitHub e o que fez o ajudante do servidor.</em></p>

<p align="center">
  <img src="images/screenshots/preferences.png" alt="preferences" width="100%">
</p>

<p align="center"><em>As preferências: idioma, tema e atualização.</em></p>

## ✨ Funcionalidades

* **Cada perfil vê o seu menu:** um observador vê as páginas de Monitorização, a página do Servidor e as de Conta; um administrador vê também Máquinas e Utilizadores e tokens.
* **Verificações antes de enviar:** os nomes, as palavras-passe e os endereços de nó são verificados no formulário, e a recusa do servidor aparece como uma frase no idioma da pessoa.
* **Tokens mostrados uma vez:** o token de um programa aparece ao ser criado e nunca mais; o token de um nó nunca é mostrado depois de guardado.
* **Acompanha o servidor:** a frota e os trabalhos atualizam-se sozinhos (ou só quando se pede), e a página em direto volta a ligar-se quando a ligação cai.
* **Atualizações:** uma página para o administrador compara o servidor e o Studio instalados com as últimas versões do GitHub, verifica quando se pede e atualiza o que é mais novo, mostrando o que o ajudante do servidor faz enquanto trabalha; quando o próprio servidor reinicia, a página volta sozinha. A atualização precisa de `updates_dir` em `server.cfg` e do ajudante do EH3D-SERVER instalado; foi testada com simulações do GitHub e do systemd, nunca numa instalação real.
* **Preparar um trabalho aqui:** escolha a máquina e indique o trabalho como os ficheiros que os programas leem (`.NCD` com o seu `.DTD`, `.PLT` com o seu `.RTD`) ou como furos escritos à mão (ferramenta, x e y, com o avanço, a velocidade e o curso extra de cada ferramenta); veja o plano, o tempo e o percurso que o servidor calcula, e deixe o trabalho pronto. Um trabalho nunca arranca sozinho.
* **Uma página para cada trabalho:** o plano com os furos já feitos preenchidos e o seguinte circundado, quanto já leva, quem o fez e quando, as ferramentas, e os botões que correspondem ao seu estado (iniciar, confirmar, parar, apagar). Os trabalhos que esperam pelo operador estão no topo do resumo com o seu botão Confirmar.
* **Uma lista com que se pode trabalhar:** pesquisa por nome, máquina, pessoa ou estado, cinco ordenações, um CSV do que se vê e um botão que remove os trabalhos terminados; o resumo soma o que as máquinas fizeram (trabalhos, furos, horas).
* **Avisos:** o título do separador conta os trabalhos que esperam pelo operador e, se a pessoa o ativar, um som e uma notificação do navegador avisam quando um novo começa a esperar.
* **As máquinas passam de um servidor para outro:** cada máquina pode ser copiada, e as máquinas de um servidor podem ser exportadas para um ficheiro e importadas noutro (os tokens de acesso dos nós nunca são exportados).
* **Uma página para cada máquina, cópias e servidor em baixo:** a página de uma máquina mostra o que faz, os trabalhos que a esperam com o seu tempo total e os últimos que terminou; um trabalho pode ficar pronto em várias cópias de uma vez (a mesma placa muitas vezes); o desenho de um plano guarda-se como SVG; e uma linha vermelha avisa quando o servidor deixa de responder, até voltar a responder.
* **O nó da cabeça de furação na página de uma máquina:** quando a configuração da máquina indica o nó (`head_address`), a página mostra a velocidade do seu fuso, a sua temperatura com o veredicto do nó, a saída de proteção e o modelo de câmara, um botão que mostra a sua câmara (MJPEG) e, para um operador, um botão que mede a mesa sob a cabeça; tudo passa pelo EH3D-SERVER, que guarda o token do nó. Testado com um simulado, nunca com um nó real.
* **O fuso na página de uma máquina:** todos leem que fuso a máquina leva (o original ou o do variador), o que acontece a um trabalho que pede mais do que ele dá, os limites do fuso em uso e a velocidade máxima a definir no nó da máquina; um administrador muda o fuso e o interruptor de segurança (recusar o trabalho, que é o valor por omissão, ou avisar e cortar as rotações ao máximo do fuso). Ao preparar um trabalho com o interruptor em `warn`, o plano lista o que passa do fuso, ferramenta a ferramenta; com `reject` o servidor recusa-o e o Studio diz porquê. Não testado numa máquina real.
* **Trabalhos G-code livres e máquinas GRBL:** uma máquina pode ser um controlador GRBL numa porta série do servidor (porta e velocidade em baud; o servidor tem de ser compilado com `--features serial`), e um administrador adiciona-a ou altera-a em Configuração. Em Preparar, um programa G-code (colado ou carregado de um ficheiro) é pré-visualizado e deixado pronto como qualquer trabalho, com um interruptor de segurança para voltar a arrancar o fuso e o refrigerante ao continuar, desligado por omissão. Um trabalho G-code em curso é pausado e retomado a partir da lista, da sua página e do resumo, que dizem a linha a que chegou e o que espera (uma pausa, ou a espera antes do primeiro movimento de um trabalho que continua); um trabalho que parou oferece continuar de onde parou: o servidor guardou o pedido, por isso não é preciso escolher o ficheiro outra vez. Os trabalhos de furação e fresagem aceitam as ferramentas desligadas e os furos ou trajetos já feitos, e a referência das definições do servidor lista `gcode_finish_wait_s` e `updates_dir`. Experimentado no simulador e com um substituto, nunca com um controlador GRBL real. Um administrador pode permitir por máquina as linhas `$` do GRBL (como `$H`) com um interruptor de segurança em Configuração, desligado por omissão e com um aviso.
* **O anel de LEDs e a última verificação de qualidade na página de uma máquina:** um operador liga ou desliga o anel e define o seu nível e tom, e todos leem o veredicto da última verificação do trabalho. Testado com um substituto, nunca com um nó real.

## 🔒 Segurança e proteção

| Ameaça | Defesa |
|---|---|
| Alguém que não entrou | toda a página precisa de uma entrada; o servidor recusa todo o pedido sem um token válido (`401`), e cinco palavras-passe erradas bloqueiam o nome durante um tempo |
| Uma pessoa que faz mais do que o seu perfil permite | o menu e os botões seguem o perfil, e o servidor volta a verificar o perfil em cada pedido |
| Um token lido por outra pessoa | o token de um programa é mostrado uma vez, o de um nó nunca mais; o token de sessão vive só no navegador da pessoa e vai só para o servidor de onde a página veio |
| Um valor errado enviado ao servidor | os nomes, palavras-passe e endereços são verificados antes de enviar, e o servidor volta a verificá-los e recusa uma configuração com uma chave que não existe |

**O que não está defendido:** o servidor ainda não termina TLS, por isso numa rede sem cifra o token e as palavras-passe viajam em claro; um navegador que outra pessoa possa usar continua com a sessão aberta até a pessoa sair ou a sessão terminar (12 horas por omissão). O Studio não teve revisão independente, e as verificações de um formulário são uma comodidade: só o servidor merece confiança.

## 🔌 Interfaces

| Interface | O que é | Onde |
|---|---|---|
| API REST | tudo o que as páginas mostram e alteram passa por `/api/v1/` do EH3D-SERVER, com o token de sessão como token portador | `src/api.ts` |
| Websocket | `/api/v1/events?token=...` para a página em direto, com uma religação que espera mais de cada vez | `src/pages/Monitor.tsx` |
| Armazenamento do navegador | o token de sessão, o idioma, o tema e a atualização, sob `eh3d-studio.*` | `src/App.tsx` |

## ⚙️ Configuração

O Studio não tem ficheiro de definições próprio: as definições do servidor estão no seu `server.cfg` (a página Servidor lista-as), e o que uma pessoa escolhe fica guardado no seu navegador.

| Definição | Omissão | Intervalo | O que faz |
|---|---|---|---|
| `studio_dir` | none | a folder | no `server.cfg` do servidor: serve as páginas desta pasta na sua raiz |
| `EH3D_SERVER` | `http://127.0.0.1:18200` | a URL | em desenvolvimento (`run.sh`): o servidor com que as páginas falam |
| `eh3d-studio.lang` | the browser's | `en es it de fr pt zh ja` | o idioma da página |
| `eh3d-studio.theme` | `forge` | `forge paper neon midnight` | o tema da página |
| `eh3d-studio.refresh` | 5 | 0, 2, 5, 10, 30 | segundos entre duas leituras do servidor (0: só quando se pede) |

## 🚀 Início rápido

Precisa de Node 22 ou mais recente. Para usar o Studio na CM5, compile as páginas e diga ao servidor onde estão.

```bash
build.bat            # install and build the pages into dist/  -  ./build.sh on Linux
test.bat             # type check, lint and tests
python -I tools/ci_validate.py
```

Copie `dist/` para a CM5 (por exemplo para `/opt/eh3d-studio`), ponha `studio_dir = /opt/eh3d-studio` no `server.cfg` do servidor e reinicie-o: o Studio abre-se no endereço do servidor, por exemplo `http://cm5:18200/`. Da primeira vez, a página pede o código de configuração que o servidor mostra na consola e cria o administrador.

## 🧪 Testes

`npm test` executa 73 testes e passam todos: o cliente da API (o token, o corpo, a consulta, os erros, uma rede que falha, os caminhos com nomes que precisam de escape), as regras de nomes, palavras-passe e endereços de nó, o que está errado numa máquina, o menu de cada perfil, as máquinas agrupadas por estação, as contagens e as ações de um trabalho, e os oito idiomas (um texto em cada idioma, chinês e japonês na sua escrita, os mesmos marcadores em todo o lado). `npm run typecheck` e `npm run lint` também passam.

## 🏗️ Compilação e publicação

A versão vive em `package.json` e em `eh3d.project.json`, e cada versão tem a sua entrada em [CHANGELOG.md](CHANGELOG.md). `build.sh` / `build.bat` instalam o necessário da primeira vez e compilam as páginas em `dist/`; `test.sh` / `test.bat` executam a verificação de tipos, o lint e os testes; `run.sh` / `run.bat` abrem o Studio em desenvolvimento contra um servidor (`run.sh http://cm5:18200`).

## 🩺 Resolução de problemas

| Sintoma | O que fazer |
|---|---|
| A página diz que o servidor não responde | Abra `http://ENDEREÇO/api/v1/health` no navegador: deve responder `eh3d-server` e uma versão. Se o servidor serve o Studio, o endereço da página é o do servidor. |
| A página pede um código de configuração | O servidor ainda não tem utilizadores: o código está na sua consola (na CM5: `journalctl -u eh3d-server`). |
| Uma página de que preciso não está no menu | O menu segue o perfil: as máquinas e os utilizadores e tokens são para administradores. |
| Guardar uma máquina é recusado com um erro de configuração | O ficheiro de máquina tem uma chave que não existe ou um valor fora do intervalo; o servidor recusa-o em vez de o ignorar. |

## 📂 Estrutura do repositório

<p align="center">
  <img src="images/repository-structure.svg" alt="Estrutura do repositório EH3D-STUDIO" width="100%">
</p>

<details>
<summary>Versão em texto da árvore</summary>

```text
EH3D-STUDIO/
├── src/
│   ├── App.tsx context.tsx                      a estrutura, o menu em três grupos, o que as páginas partilham
│   ├── api.ts types.ts                          o cliente da API do servidor
│   ├── model.ts                                 perfis, regras dos formulários, frota e trabalhos
│   ├── jobtools.ts attention.ts                 as ferramentas dos trabalhos: furos, pedidos, plano, pesquisa, CSV
│   ├── i18n.ts texts.ts                         os oito idiomas
│   ├── pages/                                   Monitorização, Configuração, Conta e entrada
│   └── styles.css                               o tema Forge e mais três
├── tools/
│   ├── demo_seed.mjs shots.mjs                  dados de demonstração e as imagens do README
│   └── ci_validate.py                           verificação de CI e de README
├── docs/                                        as fontes dos dois desenhos
├── public/                                      o ícone da página
├── images/                                      banner, desenhos e capturas
├── .github/                                     fluxo de CI e modelos
├── index.html                                   a página que carrega a aplicação
├── package.json                                 o pacote, os seus scripts e versões
├── vite.config.ts                               definições de compilação e lint
├── eslint.config.js                             definições de compilação e lint
├── tsconfig.json                                definições de tipos
├── tsconfig.app.json                            definições de tipos
├── build.sh build.bat                           instalar e compilar as páginas
├── run.sh run.bat                               abrir o Studio em desenvolvimento
├── eh3d.project.json bump_manifest_version.py   manifesto e utilitário de versão
├── CHANGELOG.md                                 o que mudou em cada versão
├── SECURITY.md SUPPORT.md                       vulnerabilidades e suporte
└── CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE   como contribuir e a licença
```

</details>

## 🗺️ Roteiro e limites conhecidos

**Limites conhecidos hoje**

* Não foi usada com máquinas numa bancada: nenhuma máquina de uma oficina foi configurada por ela e nenhum trabalho correu a partir dela numa máquina real.
* O servidor não termina TLS, por isso o token e as palavras-passe viajam em claro numa rede sem cifra.
* As definições do servidor são mostradas como referência, não editadas: a API não as fornece, e alteram-se em `server.cfg` na máquina que executa o servidor.
* Só o dono olhou para as páginas; os textos dos idiomas que não o inglês não foram lidos por falantes nativos.
* Ainda não há página do visor de um trabalho (a planta dos furos).

**A seguir**

* Experimentá-la com as máquinas de uma bancada: juntar cada máquina, chegar ao seu nó e executar um trabalho a partir da página dos trabalhos.
* Uma página para ver um trabalho (a planta dos furos e onde vai).
* Terminar TLS no servidor, ou documentar um proxy inverso, e mostrar o estado da ligação.
* Editar as definições do servidor a partir do Studio quando o servidor as fornecer.

## 🌍 Idiomas

O README e os textos existem em inglês, espanhol, francês, italiano, alemão, chinês, japonês e português europeu.

## 🔗 Projetos relacionados

* [EH3D-SERVER](https://github.com/JuanenRac/EH3D-SERVER): o servidor que este painel configura
* [EH3D-DRILLPRO](https://github.com/JuanenRac/EH3D-DRILLPRO): o programa de furação, cliente do servidor
* [EH3D-ROUTEPRO](https://github.com/JuanenRac/EH3D-ROUTEPRO): o programa de fresagem, cliente do servidor
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): a interface moderna das máquinas Bungard, com uma janela de máquinas e estações
* [EH3D-NODE-BUNGARD-HMI](https://github.com/JuanenRac/EH3D-NODE-BUNGARD-HMI): o ecrã tátil da máquina, mais um cliente do servidor
* [EH3D-BUNGARD-GUI](https://github.com/JuanenRac/EH3D-BUNGARD-GUI): o aspeto que este painel segue

## 📚 Documentação

* A API do servidor com que o Studio fala: `docs/API.md` do EH3D-SERVER.
* Como pôr o servidor e o Studio na CM5: `docs/DEPLOY.md` do EH3D-SERVER.
* [Registo de alterações](CHANGELOG.md)

## 🤝 Contribuir e comunidade

* Antes de um pull request execute `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`, e `python -I tools/ci_validate.py`: tudo tem de passar. Veja [CONTRIBUTING.md](CONTRIBUTING.md) e o [código de conduta](CODE_OF_CONDUCT.md).
* O README existe em oito idiomas: uma alteração do texto faz-se nos oito ficheiros, e os dois desenhos saem de `docs/architecture.json` e `docs/structure.json` com `tools/make_architecture.py` e `tools/make_structure.py`.
* Um texto da página é uma linha de oito em `src/texts.ts`; um teste lê todas as linhas.
* Comunique uma vulnerabilidade em privado: [SECURITY.md](SECURITY.md). Perguntas, ideias e relatórios: electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTOR

**JuanenRac (Electro Hobby 3D)** · electrohobby3d@gmail.com

## 📜 LICENÇA

Software: GPL-3.0-or-later. Ver [LICENSE](LICENSE). Os projetos de hardware da suite usam a CERN OHL-S.
