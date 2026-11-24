# Project Genesis

Jogo original para Roblox que conecta construção industrial, expedições roguelite e uma história de ficção científica. Você desperta numa instalação subterrânea, restaura a infraestrutura com a ajuda de ECHO e usa a fábrica para alcançar setores que guardam evidências sobre o projeto GENESIS.

**Estado atual:** documentação inicial. A infraestrutura, a implementação e os testes do jogo aguardam a Fase 0.

## Documentação

| Para trabalhar em | Abra |
| --- | --- |
| Visão, loops, escopo do MVP, interface e arte | [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) |
| Progressão do Capítulo 1, ECHO e capítulos futuros | [História](docs/STORY.md) |
| Grid, máquinas, esteiras, receitas e energia | [Fábrica](docs/FACTORY_SYSTEM.md) |
| Controles, inimigos, morte e primeiro chefe | [Combate](docs/COMBAT_SYSTEM.md) |
| Seeds, salas, recompensas e extração | [Geração procedural](docs/PROCEDURAL_GENERATION.md) |
| Módulos, integração e infraestrutura | [Arquitetura](docs/ARCHITECTURE.md) |
| Remotes, autoridade do servidor e permissões | [Rede](docs/NETWORKING.md) |
| Inventários, snapshots, migrações e sessões | [Modelo de dados](docs/DATA_MODEL.md) |
| Fases, dependências e aceite do MVP | [Roadmap](docs/ROADMAP.md) |
| Casos de teste e roteiro de ponta a ponta | [Testes](docs/TESTING.md) |
| Medições e limites de construção | [Desempenho](docs/PERFORMANCE.md) |
| Estado, decisões propostas e próxima tarefa | [Status de desenvolvimento](docs/DEVELOPMENT_STATUS.md) |
| Diário que o agente atualiza durante o trabalho | [Controle de desenvolvimento](docs/DEVELOPMENT_LOG.md) |
| Histórico de mudanças | [Changelog](docs/CHANGELOG.md) |

## Ponto de partida

Leia o [roadmap](docs/ROADMAP.md) e siga o plano de infraestrutura em [arquitetura](docs/ARCHITECTURE.md). O fluxo previsto é **TypeScript → roblox-ts → Luau → Rojo → Roblox Studio**. O ambiente alvo é Kali Linux com Vinegar. A primeira validação é abrir uma experiência local no Studio e observar uma confirmação de inicialização distinta no cliente e no servidor.

O [Prompt.txt](docs/Prompt.txt) contém o briefing original. Os documentos detalham o trabalho e identificam os parâmetros de design que ainda precisam de playtest. Publicação pública e compras dependem de autorização explícita do proprietário.
# GENESIS
