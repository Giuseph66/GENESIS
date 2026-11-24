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

### 2026-11-23 — Fase 0: infraestrutura

- **Estado:** Em andamento.
- **Em execução:** Preparar Git, roblox-ts, mapeamento Rojo e scripts de inicialização no cliente e no servidor.
- **Verificações:** Kali Rolling 2026.2, Git 2.53.0, Node.js 24.12.0, npm 11.6.2 e Vinegar 1.9.4 via Flatpak. Rojo ausente do PATH.
- **Próxima ação:** Configurar o projeto mínimo com as versões das ferramentas registradas.

### 2026-11-23 — Documentação inicial

- **Estado:** Concluído.
- **Feito:** Briefing dividido e ampliado em 14 documentos. Diário de desenvolvimento criado e incluído no índice.
- **Arquivos alterados:** [README](../README.md) e documentos em `docs/`.
- **Verificações:** Lista de documentos e links da documentação inicial conferidos. Verificações de código e Studio aguardam a Fase 0.
- **Próxima ação:** Registrar as versões disponíveis de Git, Node.js, npm, Rojo e Vinegar e confirmar se o Roblox Studio abre, conforme a [Fase 0](ARCHITECTURE.md#fase-0--fluxo-local).
