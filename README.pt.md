# Field Observer

[English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Español](README.es.md) · **Português** · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Versão:** 1.2.0 · **Última atualização:** 2026-10-19

Observador de campo no telemóvel: GPS, bússola, movimento, luz, som, câmara, NFC e relatórios guardados localmente.

**Aplicação online:** https://chiuta.github.io/FieldObserver/

![Captura de ecrã](screenshot.png)

## O que é

O ASFAN Field Observer (v1.2.0) é uma aplicação de um único ficheiro, pensada para o telemóvel, que apresenta em tempo real os dados dos sensores do dispositivo e permite guardar «relatórios» de campo (dados dos sensores, nota, fotografia, gravação de áudio). A interface está em romeno.

## Funcionalidades

- Barra de estado: relógio, luz (lux), rede, nível da bateria, coordenadas GPS.
- Botão «▶ ACTIVARE COMPLETĂ» que pede as permissões necessárias com um único gesto; «RESET PERMISIUNI» para recomeçar; «CONTINUĂ FĂRĂ CAMERĂ» abre a aplicação mesmo quando a câmara/o microfone não estão disponíveis (computador, file://).
- Visor com câmara (traseira/frontal; o toque duplo muda de câmara), com uma sobreposição gráfica.
- Painéis: **BUSOLĂ** (azimute e direção), **MIȘCARE** (aceleração m/s², velocidade angular °/s), **AUDIO** (nível em dB), **LUMINĂ** (lux, se o sensor existir), **BATERIE**, **REȚEA**.
- Botões: START (câmara), **FOTO**, **AUDIO** (gravação), **TORȚĂ** (se o dispositivo o permitir), **NFC**, **SALVARE**, **ARHIVĂ**.
- Deteção de códigos QR / EAN-13 / Code 128 / Data Matrix / Aztec na imagem da câmara, onde o navegador suportar `BarcodeDetector`.
- Campo de nota com ditado por voz (`ro-RO`, se o navegador oferecer reconhecimento de voz), confirmações por voz («Raport salvat») e vibrações.
- Wake Lock para manter o ecrã ligado, onde estiver disponível.
- Arquivo de relatórios: visualização de fotografias, reprodução de áudio, partilha (Web Share ou cópia para a área de transferência), descarregamento em JSON, eliminação; pesquisa por nota/data, exportação de todo o arquivo (JSON com fotografia/áudio) ou da tabela (CSV, sem multimédia), importação de um JSON exportado anteriormente (campos verificados), coordenadas com N/S e E/O (V em romeno) e ligação «mapa» (`geo:`, abre a aplicação de mapas do telemóvel), Esc fecha o painel.

## Novidades (1.1.0)

- **Percurso GPS** (botão 🥾 TRASEU da barra inferior): regista as posições enquanto a página permanece aberta e ativa. É acrescentado um ponto a pelo menos 5 m do anterior e são ignoradas as posições com precisão pior que 100 m; o limite é de 50 000 pontos por percurso. O percurso é guardado progressivamente no IndexedDB (o armazém `tracks`). **Limitação:** os navegadores não fornecem GPS a uma página em segundo plano ou com o ecrã apagado; nesse caso faltam pontos nesse intervalo (nada é interpolado).
- **Exportação GPX 1.1** (arquivo → ⬇ GPX): as posições dos relatórios tornam-se pontos (`wpt`, com altitude, hora, nota, azimute e precisão na descrição), e os percursos tornam-se `trk`/`trkseg`. Abre-se em qualquer programa de mapas ou GPS que leia GPX. Os relatórios sem GPS são omitidos (não se inventam coordenadas).
- **Pacote `.fff.json`** (arquivo → ⬇ .fff.json): todo o arquivo (relatórios, com fotografia/áudio, e percursos) num ficheiro de formato `fff-bundle`, importável também a partir do arquivo (⬆ IMPORT, que passa a aceitar também este formato; verifica-se `app`). **Nota:** a cópia de segurança da janela «Transparência» do kit só funciona com `localStorage`, e a aplicação não o utiliza; para o arquivo, use os botões do painel Arquivo.
- **Código QR no relatório** (▦ QR em cada relatório): o código contém a posição (`geo:lat,lon`, que o telemóvel abre na aplicação de mapas) ou um texto curto com a data, a posição, o azimute e a nota (os primeiros 300 carateres). Gerado localmente.
- **Impressão** (arquivo → 🖨 TIPĂREȘTE): lista limpa, fundo branco, sem botões e sem fotografias.
- **Transparência** (arquivo → ℹ TRANSPARENȚĂ): a janela padrão «sem fronteiras» com a rede (0 pedidos externos), o armazenamento, as permissões e a verificação do ficheiro por SHA-256.

A interface continua a estar **apenas em romeno** (a aplicação não tem sistema de línguas); os textos novos também estão em romeno.

## Kit «fff-kit»

Módulos integrados em `index.html`: `core`, `label`, `bundle`, `qr` (gerador de códigos QR, sem rede). Sem eles a aplicação funciona da mesma forma, mas sem o botão QR e sem a janela Transparência (testado). O ficheiro `app.json` descreve a rede, as permissões e o SHA-256 do ficheiro.

## Testes

`node tests/fff-r8.test.mjs` (Playwright, rede bloqueada): percurso com posições simuladas através do contexto de teste (a API real de geolocalização do navegador), GPX (XML bem formado, carateres especiais), pacote `.fff.json` (exportação, importação, rejeição de um pacote estranho), código QR descodificado de volta com o descodificador do kit, impressão, axe-core 0 violações (incluindo os diálogos), 360 px, sem o kit.

## Guia de utilização

1. Abra a página no telemóvel, através de **HTTPS** ou `localhost` (a câmara não funciona em HTTP não seguro; a aplicação mostra um aviso).
2. Prima «▶ ACTIVARE COMPLETĂ» e conceda as permissões (localização, câmara, microfone, sensores de movimento/orientação).
3. Acompanhe os painéis BUSOLĂ, MIȘCARE, AUDIO, LUMINĂ, BATERIE, REȚEA.
4. Prima «START» para a câmara; o toque duplo na imagem muda de câmara. Use «FOTO», «AUDIO» (início/paragem da gravação) e «TORȚĂ».
5. Escreva uma nota no campo de texto (ou dite-a com o botão do microfone).
6. Prima «SALVARE»: o relatório (hora, GPS, orientação, movimento, luz, bateria, rede, nota, última fotografia / gravação de áudio) é guardado localmente. Se a base de dados não estiver disponível ou a gravação falhar, é descarregado um ficheiro JSON.
7. «ARHIVĂ» lista os relatórios; a partir daí pode pesquisá-los, visualizá-los, partilhá-los, descarregá-los (JSON), eliminá-los, exportar tudo (JSON/CSV) ou importar um JSON exportado anteriormente.
8. «◈ NFC» inicia a leitura de etiquetas NFC (onde o navegador suportar Web NFC).

## Privacidade e rede

- **Armazenamento local:** IndexedDB, base de dados `ASFAN_FO` (versão 3), armazéns `recs` (os relatórios, incluindo fotografia e áudio) e `tracks` (os percursos GPS, desde a 1.1.0; a base antiga é atualizada automaticamente, os relatórios mantêm-se). Não se usa `localStorage`.
- **Rede:** a aplicação não contém chamadas `fetch` e tem uma política CSP com `connect-src 'self'`; não contacta anfitriões de terceiros. A ligação «Coffee» só se abre ao clicar.
- Nota: o ditado por voz usa a funcionalidade de reconhecimento de voz do navegador, que em alguns navegadores (p. ex., Chrome) pode enviar áudio para o serviço do fornecedor do navegador; a aplicação não controla este aspeto.
- **Dados sensíveis:** os relatórios contêm a localização GPS, fotografias, gravações de áudio e notas, armazenados sem cifragem no IndexedDB do dispositivo; o botão «SHARE» e o descarregamento em JSON podem tirá-los da aplicação. Apagar os dados do site elimina o arquivo; exporte o JSON como cópia de segurança. Num telemóvel partilhado ou perdido, os relatórios podem ser lidos por qualquer pessoa com acesso ao perfil do navegador.
- Sem analítica.

## Execução local / offline

Descarregue `index.html` e abra-o através de `localhost` (p. ex., `python3 -m http.server 8080`) ou a partir de um anfitrião HTTPS; os sensores e a câmara exigem um contexto seguro. Não requer internet. A disponibilidade dos sensores depende do dispositivo e do navegador.

## Histórico / Changelog

### 18 de outubro de 2026 — versão 1.2.0
- Novo: «↗ Bolta» (o céu na posição GPS: em direto na barra GPS; no arquivo, para os relatórios novos, no local e no momento do relatório). Os relatórios novos guardam o instante UTC (`t`), usado também no GPX. A posição na ligação é arredondada a ~1 km.

### 14 de outubro de 2026 — versão 1.1.0
- Novo: percurso GPS, exportação GPX 1.1, pacote `.fff.json` (exportação/importação), código QR no relatório (posição ou texto), impressão do arquivo, janela «Transparência» (fff-kit: core, label, bundle, qr). A base IndexedDB passa à versão 3 (novo armazém `tracks`). Testes novos: `tests/fff-r8.test.mjs`. CSP: hash do script recalculado.

### 12 de outubro de 2026 — versão 1.0.4
- 1.0.4 — 2026-10-12: a versão e a data da última atualização são apresentadas na aplicação

### 11 de outubro de 2026 (terceira passagem) — versão 1.0.3
- Exportação CSV: a coluna `baterie_pct` escrevia a fração 0–1 (1 para 100%); agora escreve a percentagem (100).
- O ecrã de ativação deixa de bloquear a aplicação quando a câmara não está disponível (file://, computador): botão «CONTINUĂ FĂRĂ CAMERĂ». CSP: hash recalculado.

### 11 de outubro de 2026 (segunda passagem) — versão 1.0.2
- Arquivo: pesquisa, exportação completa em JSON e CSV (células protegidas contra a interpretação como fórmulas), importação JSON com validação dos campos, coordenadas com os hemisférios corretos (N/S, E/O (V em romeno); antes «°N/°E» fixo, mesmo para valores negativos) e ligação «mapa», mensagem de arquivo vazio com orientação, `aria-label` nos botões com emoji, diálogo com foco e Esc, toast como região `status`. CSP: hash recalculado. Captura de ecrã atualizada.

### 11 de outubro de 2026
- Versão 1.0.1 (no título, no ecrã inicial e no comentário do código).
- Acessibilidade: cabeçalho (`<header>` com `<h1>`), `<main>` e o widget de apoio como ponto de referência; o axe-core indica 0 violações a 1280 e 360 px.
- A pílula Buy Me a Coffee deixa de tapar a barra de botões (AUDIO, TORȚĂ, NFC, ARHIVĂ): fica à direita, a meio do visor, e em ecrã estreito começa recolhida.
- O botão «ACTIVARE COMPLETĂ» ficava em «⏳...» após a ativação: agora mostra «✓ ACTIV».
- Segurança: os 15 manipuladores `onclick` inline foram substituídos por um manipulador delegado; a CSP usa um hash SHA-256 para o script, sem `'unsafe-inline'` em `script-src`.

## Licença

MIT — ver o ficheiro LICENSE

## Auditoria

2026-10-10: verificou-se que o código não contém `fetch`/XHR/WebSocket nem recursos externos (com permissões simuladas, sem pedidos de rede). O nome da aplicação na interface e o da base de dados (`ASFAN_FO`) contêm «ASFAN»; não foi alterado. Corrigidos o zoom bloqueado (viewport), o contraste e um elemento oculto focável.

## Autor

Alexio — Alexandru-Ionuț Chiuță. Contacto: alexio@trom.tf

## English summary

Field Observer is a single-file, Romanian-language mobile field tool: live GPS, compass, motion, ambient light, audio level, camera with QR/barcode detection, torch and NFC, plus saved field reports (IndexedDB database `ASFAN_FO`) with notes, photo and audio, JSON export and sharing. No network requests (CSP connect-src 'self'). MIT licence.

New in 1.1.0: GPS track recording (foreground only), GPX 1.1 export of reports and tracks, `.fff.json` archive bundle (export/import), QR code per report (geo: position or short text), print view of the archive, and the "Transparency" dialog. The UI remains Romanian-only. The kit adds no network requests.
