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

### 2026-11-23 — Fase 1: mundo e jogador

- **Estado:** Em andamento.
- **Em execução:** Validar o percurso spawn → terminal → depósitos no Studio.
- **Feito:** Sala movida de script para `assets/installation.model.json`, visível na edição do Studio. O servidor localiza o terminal e os depósitos por nome. Sala industrial, câmera padrão de terceira pessoa, terminal, depósitos de ferro e carvão e HUD ligados ao estado do servidor.
- **Arquivos alterados:** `src/client/`, `src/server/`, `src/shared/`, `assets/` e `default.project.json`.
- **Verificações:** Compilação e geração de `build/GENESIS-Fase1.rbxlx` passaram. O place abriu no Studio.
- **Verificações da sala estática:** `npm run build` e `rojo build` passaram. Nome, geometria e cor das peças no place conferem com o modelo. Abertura no Studio e percurso em **Test** ainda pendentes.
- **Bloqueios ou decisões:** O place único do projeto passa a ser `build/GENESIS.rbxlx`, por decisão do proprietário. Regenerado com a Fase 1, com conteúdo idêntico ao de `GENESIS-Fase1.rbxlx`. Nenhum outro place deve ser criado.
- **Próxima ação:** Jogar da entrada até o inventário completo e corrigir falhas observadas.

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
