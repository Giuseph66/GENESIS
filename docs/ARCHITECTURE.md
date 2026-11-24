# Arquitetura

## Fronteiras

| Camada | Responsabilidades | Destino previsto no Roblox |
| --- | --- | --- |
| `src/client` | Input, câmera, HUD, prévia de construção, apresentação de máquina e efeitos | `StarterPlayerScripts` para o bootstrap cliente |
| `src/server` | Mundo, inventários, construção, simulação, combate, expedição, missões e persistência | `ServerScriptService` |
| `src/shared` | Tipos, contratos de rede, IDs e catálogos que o cliente precisa ler | `ReplicatedStorage` |
| `assets` | Modelos, áudio original e referências de importação | Mapeamento Rojo conforme os ativos forem usados |

Valores secretos de recompensas, estado mutável, dados de outros jogadores e infraestrutura de persistência ficam no servidor. Tipos compartilhados descrevem dados em trânsito. Toda entrada que atravessa a rede ainda precisa de validação em runtime.

## Módulos e dependências

| Módulo | Responsabilidade | Integração |
| --- | --- | --- |
| Mundo e jogador | Abrir sessão, carregar mundo e controlar estado de entrada e saída | Coordena permissões e repositório. |
| Inventário | Contar, verificar capacidade, reservar e transferir itens | Usado por construção, indústria, pesquisa e extração. |
| Construção | Grid, geometria, custos e mutações da topologia | Consulta catálogo e inventário. Notifica a simulação da topologia alterada. |
| Fábrica | Máquinas, logística, receitas e energia em passos fixos | Usa estado do mundo e catálogo. Publica progresso e alterações de estoque. |
| Combate e inimigos | Equipamento, dano, resistência, IA e encontros | Consulta contexto da expedição e emite resultados do encontro. |
| Expedição e geração | Layout, tentativa, mochila, melhorias e resultado | Coordena combate, inventário e confirmação persistente de extração. |
| Pesquisa e narrativa | Pré-requisitos, custos, missões e capítulos | Recebe fatos confirmados da fábrica e das expedições. |
| Persistência | Carregar, migrar, validar e confirmar snapshots por mundo | Expõe adaptador em memória e adaptador DataStore com os mesmos contratos. |
| Rede | Traduzir solicitações em comandos, filtrar estado e enviar respostas | Chama módulos com identidade obtida da conexão. |

O bootstrap cria os módulos e injeta suas dependências. Inicie com um módulo por responsabilidade do produto e extraia serviços menores quando houver regra ou teste independente. Domínio recebe dados e relógio por parâmetros quando viável. Adaptadores acessam Roblox, rede e armazenamento. Use eventos de domínio após confirmação, preservando a ordem esperada de revisões.

### Percurso de uma construção

`Input → prévia → BuildRequest → validação → mutação do mundo → delta → interface`.

Grid e inventário mudam juntos no servidor. A alteração de topologia invalida somente as conexões afetadas e marca o mundo como alterado. O snapshot de salvamento é separado do delta de rede. Para uma extração, a confirmação durável antecede o delta que exibe os ganhos.

## Fase 0 — fluxo local

1. Registrar versões disponíveis de Git, Node.js, npm, Rojo, Vinegar e Roblox Studio. Usar `flatpak info org.vinegarhq.Vinegar` se a instalação for via Flatpak. Verificar abertura do Studio antes de avaliar integrações opcionais. [Instalação do Vinegar](https://vinegarhq.org/Vinegar/Installation.html)
2. Inicializar Git e roblox-ts no diretório existente, preservando a documentação. Definir `package.json`, lockfile, `tsconfig.json` e regras de arquivos gerados. Fixar versões de ferramentas depois de confirmar compatibilidade. [Quick Start do roblox-ts](https://roblox-ts.com/docs/quick-start/)
3. Compilar com `npx rbxtsc` após instalar as dependências do projeto. Apontar o `default.project.json` para a saída de compilação. Usar `rojo serve` com o plugin do Studio ou gerar um arquivo local com `rojo build --output GENESIS.rbxlx`. [Sincronização do roblox-ts com Rojo](https://roblox-ts.com/docs/guides/syncing-with-rojo/) · [Instalação do Rojo e do plugin](https://rojo.space/docs/v7/getting-started/installation/)
4. Confirmar que a edição de um marcador TypeScript chega ao Studio após recompilação e sincronização. Em **Test**, observar mensagens de bootstrap distintas para cliente e servidor e registrar as versões e o resultado. [Modos de teste do Studio](https://create.roblox.com/docs/studio/testing-modes)

MCP de Studio e Blender são integrações opcionais. Se indisponíveis, o fluxo local usa Rojo e Studio e pode começar com primitivas. Depois da primeira execução local, automatize compilação e geração do place no CI quando houver remoto GitHub configurado. O projeto deve poder começar sem APIs pagas.
