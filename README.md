# Project Genesis

Jogo original para Roblox que conecta construção industrial, expedições roguelite e uma história de ficção científica. Você desperta numa instalação subterrânea, restaura a infraestrutura com a ajuda de ECHO e usa a fábrica para alcançar setores que guardam evidências sobre o projeto GENESIS.

**Estado atual:** Capítulo 1 jogável de ponta a ponta em mundo solo, verificado no Studio. Faltam playtest humano, DataStore real, mobile e coop.

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

### Compilar e abrir localmente

Use Node.js e npm para instalar os pacotes do lockfile. Extraia a CLI para `.tools/rojo` e instale o plugin correspondente no Studio. [Rojo 7.7.1](https://github.com/rojo-rbx/rojo/releases/tag/v7.7.1)

```sh
npm ci
npm run build
npm test
mkdir -p build
./.tools/rojo build --output build/GENESIS.rbxlx
```

O place do projeto é sempre `build/GENESIS.rbxlx`. Regenere esse arquivo em todas as fases, sem criar outros places.

Abra `build/GENESIS.rbxlx` no Roblox Studio e inicie **Test**. A janela **Saída** deve mostrar mensagens de inicialização para cliente e servidor. Para sincronizar alterações, rode `npm run dev` e `./.tools/rojo serve` em terminais separados e conecte o plugin à sessão local.

O [Prompt.txt](docs/Prompt.txt) contém o briefing original. Os documentos detalham o trabalho e identificam os parâmetros de design que ainda precisam de playtest. Publicação pública e compras dependem de autorização explícita do proprietário.
