# Controle de desenvolvimento

## Como registrar

Antes de começar, leia a entrada mais recente e adicione uma nova no início do histórico com a tarefa e o estado **Em andamento**. Atualize a mesma entrada ao concluir uma etapa relevante, tomar uma decisão ou encontrar um bloqueio.

Ao parar, registre o estado atual, os arquivos alterados, o resultado das verificações feitas e a próxima ação concreta. Se uma verificação ficou pendente, indique o motivo. Use os estados **Em andamento**, **Bloqueado** e **Concluído**.

<!-- Modelo
### AAAA-MM-DD — Fase e tarefa

- **Estado:**
- **Em execução:**
- **Feito:**
- **Arquivos alterados:**
- **Verificações:**
- **Bloqueios ou decisões:**
- **Próxima ação:**
-->

## Histórico

### 2026-11-24 — Interface e HUD

- **Estado:** Implementado, sem verificação visual no Studio. O MCP estava desconectado.
- **Feito:** Sistema visual único em `src/client/ui.ts`, com a paleta do GDD, cantos e bordas comuns, Sarpanch em títulos e números e Titillium Web no texto (ambas do cliente Roblox). Na coluna direita, cartão de objetivo com faixa de sinalização, missão, dica e barra de progresso, e cartão de carga com amostras de cor e barra de energia. Menu com selo de tecla em cada botão, cartões de máquina com tecla, cor e custo, seleção por borda laranja, aviso em pílula, fala de ECHO com retrato, painel de máquina com a cor da máquina e nova tela de carregamento. Rótulos em caixa alta trocados por texto normal.
- **Arquivos alterados:** `src/client/` (`ui`, `hud`, `dock`, `builder`, `dialogue`, `inspector`, `journal`, `expedition`, `loading`, `main`).
- **Verificações:** `rbxtsc` e `rojo build` passaram. `npm test`, 97 de 97, sem cobertura de interface.
- **Bloqueios ou decisões:** O proprietário pediu para nunca abrir outra instância do Studio. Verificação visual depende do MCP reconectado na janela já aberta.
- **Próxima ação:** Conferir a interface na janela aberta e ajustar sobreposições.

### 2026-11-24 — Jogabilidade: retorno do proprietário

- **Estado:** Concluído, aguardando novo retorno.
- **Feito:** Câmera de drone com grade na construção. Rotação por scroll ou `R`, placas de entrada e saída que ficam verdes ao ligar, direção por escrito e linha de esteiras ao arrastar. Menu fixo com botões, inclusive Ajuda, e painel de ajuda completo. ECHO ativo desde o início, com companheiro visível e `T` para repetir a orientação. Na primeira pessoa, o cursor some, a mira fica no centro e `Tab` ou qualquer painel solta o mouse. Iluminação, cores do terreno, piso em lajes, contêineres, postes e minério visível.
- **Arquivos alterados:** `src/client/` (`drone`, `ghost`, `dock` e `echo` novos; `builder`, `camera`, `help`, `dialogue`, `journal`, `party`, `hud`, `main`), `src/shared/` (`ports` novo, `grid`, `story`, `protocol`), `src/server/`, `assets/` e `default.project.json`.
- **Verificações:** `npm test`, 97 de 97 em Node. No Studio, solo: drone, rotação por scroll, seis esteiras criadas num arrasto entre mineradora e fornalha, ajuda pelo botão, mouse preso e solto na primeira pessoa, volta da câmera. Toque, mover máquina no drone, zoom e giro com botão direito não exercitados.
- **Bloqueios ou decisões:** Sem ativação de ECHO, por decisão do proprietário. Alcance de construção ampliado para 260 studs por causa do drone. Antes desta correção, abrir um painel na primeira pessoa não soltava o mouse. Texturas próprias exigem enviar imagens à conta do proprietário.
- **Próxima ação:** Ouvir o proprietário sobre drone, rotação e visual.

### 2026-11-24 — Fase 8: grupo e permissões

- **Estado:** Em andamento.
- **Feito:** Grupo de até quatro por mundo, com convite de 60 s, aceite, concessões de construir, remover e usar o armazém, expulsão e saída. Visitantes não alteram o mundo. Progresso coletivo: ECHO, insumos e fatos valem para todos. Painel do grupo em `P`. Snapshot do mundo na versão 4, com migração da 3.
- **Arquivos alterados:** `src/shared/party.ts`, `src/server/permissions.ts`, `src/client/party.ts` e `tests/coop.cjs` novos. `facility`, `network`, `session`, `snapshot`, `commands`, `main`, `protocol`, `builder`, `hud` e `tests/runtime.cjs`.
- **Verificações:** `npm test`, 97 de 97 em Node, com COOP-01 e COOP-02. No Studio com dois clientes, uma execução parcial: papéis, recusa de visitante, convite na tela, aceite, recusa de autopromoção e expulsão. Solo no Studio, sem regressão em terminal, mineração, construir, mover e remover.
- **Não verificado:** No teste com dois clientes o terminal não ativou ECHO e a causa não foi confirmada; por isso disputa de célula e remoção entre membros não foram observadas no motor. O proprietário dispensou novos testes multijogador.
- **Próxima ação:** Expedições cooperativas ficam pendentes. Priorizar a jogabilidade quando o proprietário retomar o assunto.

### 2026-11-23 — Capítulo 1 jogável de ponta a ponta

- **Estado:** Em andamento. Fases 1 a 6 observadas no Studio em mundo solo. Fase 7 depende de DataStore real.
- **Feito:**
  - Mundo: platô de ±80 studs no lugar da clareira de 512, com montanhas, florestas, desertos, lagos, ruínas e jazidas.
  - Jogabilidade: primeira e terceira pessoa (`V`), corrida, balanço e queda de câmera, mineração por golpes com braço e picareta animados, estilhaços, som, ganhos na tela, marcador de objetivo e ajuda (`H`).
  - Máquinas com silhueta própria, luz de estado e animação local.
  - Expedições por seed com melhorias, morte, extração e resumo. Persistência por mundo com trava de sessão e recibo de extração. Segunda pesquisa, missões, falas de ECHO, diário (`J`) e fim do capítulo.
- **Verificado no Studio (build sincronizado pelo Rojo):**
  - Construção por mouse: posição válida debita uma vez, sobreposição recusada. Mover, remover, desligar, religar, retirar, veio exigido e estrutura fixa protegida.
  - Linha de referência entregou 5 a 6 componentes em cerca de 40 s. Duas pesquisas concluídas.
  - Mineração: cadência, alcance, esgotamento da jazida. Braço e picareta observados nas duas câmeras.
  - Expedição: entrada bloqueada antes da pesquisa, combate, melhoria, morte com perda da mochila, vitória sobre o Guardião, extração creditada e setor limpo. Percurso feito por roteiro automatizado no cliente, pela rede real. Descarga e esquiva também por teclado.
  - Capítulo 1 concluído no terminal.
  - Persistência em memória, em Luau: segunda sessão recebe `busy`, extração repetida devolve `already`, recarga restaura fábrica, membro e recibo.
  - Mundo a 1.500, 5.000 e 42.000 studs da origem: passo médio de 16,8 ms, máximo de 66 ms, 2 de cerca de 535 passos acima de 34 ms durante a geração. Água em lago a 380 studs.
  - Simulação industrial isolada, p95: 0,03 ms com 50 máquinas, 0,07 com 100, 0,14 com 250 e 0,35 com 500. Não inclui replicação.
- **Verificado só em Node:** `npm test`, 87 de 87, com APIs simuladas.
- **Não verificado:** DataStore real (o place não está publicado), toque e mobile, dois ou mais jogadores, avisos flutuantes sempre visíveis (a captura do Studio não os desenha), áudio e regeneração da jazida após 120 s.
- **Decisões:** Cura de 40 ao limpar encontro, pois o Guardião venceu o primeiro roteiro. Depósitos rendem 5 ferros ou 1 carvão por golpe. Mundo pertence ao primeiro jogador do servidor. Com dados ilegíveis, o mundo fica indisponível e nada é sobrescrito.
- **Observação técnica:** Avatares atuais usam `AnimationConstraint` no lugar de `Motor6D`. Forçar a câmera durante o Play pela ferramenta de captura deixa a tela preta.
- **Próxima ação:** Playtest humano, publicar o place em modo privado para testar DataStore e revisar a versão para toque.

### 2026-11-23 — Fase 7 (adiantado): primeira pesquisa

- **Estado:** Concluído. Validado no Studio na entrada acima.
- **Feito:** Acesso ao Setor de Manutenção no terminal de ECHO. Exige produção automática, consome 1 componente uma vez e leva 10 s. Objetivo e contagem no HUD. Snapshot na versão 3.
- **Arquivos alterados:** `src/shared/research.ts` e `src/server/research.ts` novos, `facility`, `network`, `session`, `repository`, `main`, HUD e `tests/domain.cjs`.
- **Verificações:** `rbxtsc` e `rojo build` passaram. `npm test`: 42 de 42 em Node, com APIs simuladas, incluindo TECH-01. Nada rodou no Studio.
- **Bloqueios ou decisões:** O MCP do Studio foi iniciado com o Studio fechado e não reconecta sozinho. O custo sai do inventário pessoal. Leitura de Sinal depende do fragmento da Fase 5. A arena de teste ainda não exige a pesquisa.
- **Próxima ação:** Jogar Fases 2 a 4 e a pesquisa no Studio.

### 2026-11-23 — Fase 4: combate

- **Estado:** Concluído. A arena de teste deu lugar às expedições.
- **Feito:** Arco, descarga e esquiva com resistência, recargas e reconciliação. Drone, robô e Guardião com estados, aviso antes de cada golpe e encadeamento abaixo de 50% de vida. Tentativa com resultado único por participante e recompensa única. Arena de teste isolada, criada somente no Studio, com entrada pela porta de manutenção.
- **Arquivos alterados:** `src/shared/combat.ts`, `src/shared/fighter.ts`, `src/server/` (`enemy`, `encounter` e `arena` novos, `session`, `network`, `installation`, `main`), `src/client/` (`combat` novo, `builder`, `main`) e `tests/combat.cjs`.
- **Verificações:** `rbxtsc` e `rojo build` passaram. `npm test`: 40 de 40 em Node, com APIs simuladas. Em COM-01, alcance, recarga e resistência estão cobertos; obstáculo depende de raycast e falta no Studio. COM-02 coberto no domínio. Em simulação, o kit inicial derrota o Guardião entre 10 e 60 s batendo metade do tempo. Nada da Fase 4 rodou no Studio.
- **Bloqueios ou decisões:** Inimigos desviam de obstáculos por sondagem simples; Pathfinding fica para os módulos da Fase 5. A recompensa é um fato do encontro, sem item, até existir extração. Vida usa o Humanoid, com a regeneração padrão do Roblox.
- **Próxima ação:** Reconectar o MCP, jogar Fases 2 a 4 e ajustar.

### 2026-11-23 — Fase 3: automação

- **Estado:** Concluído. Validado no Studio na entrada mais recente.
- **Feito:** Simulação em passos de 0,2 s com mineradora sobre veio, esteira, fornalha, montadora, armazém e gerador fixo restaurável. Receitas declarativas, energia concedida por ordem de ID, combustível, esteiras com curva e entrada única, reposicionamento, inserção e retirada manual, painel da máquina, energia no HUD e itens em trânsito desenhados no cliente. Snapshot na versão 2, com o estado das máquinas.
- **Arquivos alterados:** `src/shared/`, `src/server/` (`factory`, `facility` e `commands` novos), `src/client/` (`inspector`, `belts` e `world` novos), `assets/installation.model.json`, `tests/` e `package.json`.
- **Verificações:** `rbxtsc` e `rojo build` passaram. `npm test`: 25 de 25 em Node, com APIs do Roblox simuladas, cobrindo INV-01, INV-02, GRID-01 a GRID-03, FACT-01 a FACT-03, SAVE-01, SAVE-02 (parte) e NET-01 (formato). A linha de referência coube nos 30 minérios e entregou componente. Nada da Fase 3 rodou no Studio.
- **Bloqueios ou decisões:** Gerador somente o fixo do posto, como em FACTORY_SYSTEM. Coleta manual de carvão mantém o gerador abastecido. Itens em trânsito e buffers replicam por atributos, com custo de rede a medir. Esteira lateral é recusada quando já existe entrada.
- **Próxima ação:** Jogar o percurso completo no Studio e medir 50 e 100 máquinas.

### 2026-11-23 — Fase 2: construção

- **Estado:** Concluído. Validado no Studio na entrada mais recente.
- **Feito:** Catálogo de seis máquinas, grid de 4 studs, prévia com rotação, custo, remoção com reembolso, RemoteEvents validados, limite de frequência, `requestId` idempotente e snapshot em memória. Correções da Fase 1: coleta exige ECHO ativo, inventário por jogador mantido ao sair e voltar, depósitos sem esgotamento e objetivo registrado como fato. HUD movido para a direita, pois cobria o chat.
- **Arquivos alterados:** `src/shared/` (`catalog`, `grid`, `protocol`), `src/server/` (`inventory`, `buildings`, `repository`, `session`, `structures`, `network`, `main`) e `src/client/` (`ui`, `connection`, `hud`, `builder`, `main`).
- **Verificações:** `rbxtsc` e `rojo build` passaram. Onze verificações de domínio passaram em Node com APIs do Roblox simuladas: INV-01, INV-02, GRID-01, NET-01 (formato), sobreposição, área reservada e snapshot. No Studio, com build sincronizado pelo Rojo: cinco verificações de domínio passaram em Luau e a interface de construção apareceu. Construção com mouse interrompida antes de concluir. Toque não testado.
- **Bloqueios ou decisões:** Construção restrita à clareira plana, pois o terreno externo é inclinado e descartado longe dos jogadores. Reposicionamento fica para a Fase 3, como prevê o GDD. Máquinas ainda não produzem.
- **Próxima ação:** Construir → sobrepor → girar → remover com mouse, junto da validação da Fase 3.

### 2026-11-23 — Mundo aberto

- **Estado:** Concluído.
- **Feito:** A pedido do proprietário, a sala fechada deu lugar a um mundo aberto, gerado em blocos de 128 studs ao redor dos jogadores, com semente 7193. Iluminação diurna, atmosfera e streaming ativos.
- **Arquivos alterados:** `src/server/terrain.ts`, `src/server/world.ts`, `assets/installation.model.json` e `default.project.json`.
- **Verificações:** Executado em Play com uma transcrição manual do Luau compilado. Terreno gerado e jogador de pé em 1.500, 5.000, 30.000 e 100.000 studs, com a origem descartada e regenerada. Com um bloco por passo, a 1.500 studs: passo médio de 16,8 ms, máximo de 52,6 ms e 2 de 357 acima de 34 ms. Mobile e multiplayer não medidos.
- **Bloqueios ou decisões:** O relevo é regenerado pela semente e não é salvo. Longe da origem, a precisão numérica do motor é o limite prático. História e GDD ainda descrevem um início subterrâneo.
- **Próxima ação:** Repetir a medição com o build sincronizado.

### 2026-11-23 — Fase 1: mundo e jogador

- **Estado:** Concluído.
- **Feito:** Sala movida de script para `assets/installation.model.json`, visível na edição do Studio. O servidor localiza o terminal e os depósitos por nome. Sala industrial, câmera padrão de terceira pessoa, terminal, depósitos de ferro e carvão e HUD ligados ao estado do servidor.
- **Arquivos alterados:** `src/client/`, `src/server/`, `src/shared/`, `assets/` e `default.project.json`.
- **Verificações:** Compilação e geração de `build/GENESIS-Fase1.rbxlx` passaram. O place abriu no Studio.
- **Verificações da sala estática:** `npm run build` e `rojo build` passaram. Nome, geometria e cor das peças no place conferem com o modelo. O place abriu no Studio. Uma sessão de Play registrou a coleta completa sem ativar o terminal, o que motivou a exigência de ECHO na Fase 2.
- **Bloqueios ou decisões:** O place único do projeto passa a ser `build/GENESIS.rbxlx`, por decisão do proprietário. Regenerado com a Fase 1, com conteúdo idêntico ao de `GENESIS-Fase1.rbxlx`. Nenhum outro place deve ser criado.
- **Percurso observado:** No Studio, com build sincronizado, a coleta antes de ECHO foi recusada com aviso. Depois, terminal ativado, 30 minérios e 6 carvões coletados e refletidos no HUD.
- **Próxima ação:** Fase 2.

### 2026-11-23 — Fase 0: infraestrutura

- **Estado:** Concluído.
- **Feito:** Projeto TypeScript configurado com mapeamento Rojo e pontos de entrada para cliente e servidor. CLI local em `.tools/` e plugin no perfil do Studio via Vinegar.
- **Arquivos alterados:** `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`, `default.project.json`, `src/`, README, changelog e status.
- **Verificações:** Kali Rolling 2026.2, Git 2.53.0, Node.js 24.12.0, npm 11.6.2, Vinegar 1.9.4, Rojo 7.7.1 e Roblox Studio 0.748.0.7481526. `npm run build` e `rojo build` passaram. O plugin conectou em `localhost:34872`. Após editar e recompilar o marcador TypeScript, **Test** registrou `Servidor inicializado (phase-0-ready)` e `Cliente inicializado (phase-0-ready)`.
- **Bloqueios ou decisões:** Place local gerado em `build/GENESIS.rbxlx`. Rojo e Studio foram suficientes para a validação.
- **Próxima ação:** Fase 1. Criar um espaço inicial com piso e spawn, posicionar um terminal interativo e validar o percurso em **Test**.

### 2026-11-23 — Documentação inicial

- **Estado:** Concluído.
- **Feito:** Briefing dividido e ampliado em 14 documentos. Diário de desenvolvimento criado e incluído no índice.
- **Arquivos alterados:** [README](../README.md) e documentos em `docs/`.
- **Verificações:** Lista de documentos e links da documentação inicial conferidos. Verificações de código e Studio aguardam a Fase 0.
- **Próxima ação:** Registrar as versões disponíveis de Git, Node.js, npm, Rojo e Vinegar e confirmar se o Roblox Studio abre, conforme a [Fase 0](ARCHITECTURE.md#fase-0--fluxo-local).
