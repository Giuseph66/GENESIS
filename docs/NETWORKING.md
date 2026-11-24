# Rede e multiplayer

## Autoridade

O cliente envia intenções e renderiza o estado que recebe. O servidor decide custo, disponibilidade, dano, recompensa, desbloqueio, posição de construção e permissões. A identidade vem do jogador entregue pelo Roblox ao handler. Valide também interações acionadas por componentes do mundo, como terminais com `ProximityPrompt`. [Fronteira entre cliente e servidor](https://create.roblox.com/docs/scripting/security/client-server-boundary)

## Contratos propostos

| Solicitação | Dados do cliente | Verificação do servidor |
| --- | --- | --- |
| `RequestBuild` | `requestId`, tipo, célula e rotação | Catálogo, área, distância, ocupação, desbloqueio, custo e permissão |
| `RequestRemove` / `RequestMove` | `requestId`, ID da máquina e destino no caso de mover | Mundo, distância, propriedade, proteção da estrutura e capacidade ou célula de destino |
| `RequestTransfer` | `requestId`, origem, destino, recurso e quantidade inteira | Acesso aos inventários, quantidade disponível e capacidade final |
| `RequestRecipe` / `RequestResearch` | `requestId`, máquina e receita, ou ID de pesquisa | Máquina compatível, custos, permissão e pré-requisitos. Troca de receita requer lote concluído ou devolução íntegra de itens reservados. |
| `RequestAttack` / `RequestDodge` | `requestId`, tipo de ação e direção quando necessária | Equipamento, cooldown, resistência, vida, geometria e tentativa ativa |
| `RequestExpedition` / `RequestExtract` | `requestId`, região ou ID da tentativa | Pesquisa de acesso, participação, proximidade, encontro e estado terminal |
| `RequestUpgrade` / `RequestInteract` | `requestId`, ID de escolha ou interação | Oferta vigente e escolha única, ou alvo permitido e próximo |

Use `RemoteEvent` para comandos e respostas assíncronas. A resposta correlaciona `requestId`, resultado e revisão quando aplicável. Use motivos estáveis como `CELL_OCCUPIED`, `INSUFFICIENT_ITEMS`, `NOT_AUTHORIZED` e `WORLD_UNAVAILABLE` para o cliente exibir texto contextual. [Eventos remotos e callbacks](https://create.roblox.com/docs/scripting/events/remote)

## Validação e sincronização

1. Limitar frequência e tamanho por jogador e ação antes de operações custosas. Aceitar somente tipos, IDs, inteiros finitos e campos previstos com limites de tamanho e faixa.
2. Confirmar sessão, mundo, estado do jogador e permissões antes da regra de domínio. O servidor encontra alvos por IDs conhecidos e calcula alcance e impacto.
3. Serializar comandos que disputam o mesmo estado do mundo. Reter resultados recentes das mutações por jogador, sessão e `requestId`, com janela e tamanho limitados. Uma repetição com payload diferente é rejeitada. Operações que precisam sobreviver à reconexão, como extração, usam o identificador durável do domínio.
4. Enviar snapshot filtrado na entrada e deltas em ordem por assinante. Cada delta leva a revisão anterior e a nova daquela visão. Em lacuna, solicitar novo snapshot com limite de frequência. Tráfego visual transitório pode perder atualizações, desde que o próximo estado visual consiga se recompor.

O membro recebe o próprio inventário e dados públicos do mundo autorizado. O estado visual próximo pode ser filtrado por área. Registrar contagens de rejeição por motivo, IDs de correlação e volume de mensagens, evitando gravar conteúdo bruto de payload.

## Coop planejado

O MVP solo usa a mesma fronteira de rede e inicia com o dono como único membro. Na Fase 8, o mundo terá até quatro participantes, com proprietário, membros autorizados e convites aceitos no servidor.

| Permissão | Proprietário | Membro |
| --- | --- | --- |
| Entrar | Acesso ao próprio mundo | Convite aceito ou regra de acesso do mundo |
| Construir e configurar | Sim | Concessão por ação |
| Remover ou mover | Sim em estruturas editáveis | Concessão própria |
| Transferir no armazém | Sim | Concessão própria |
| Alterar permissões | Sim | Atribuição exclusiva do proprietário |

Fábrica, estoque compartilhado, pesquisa e capítulo pertencem ao mundo. Cada jogador tem inventário e equipamento próprios naquele mundo. Ao revogar permissões, revalide comandos pendentes no momento da aplicação. Para expedições coop, trate resultados por participante e teste simultaneidade. MemoryStore, MessagingService e TeleportService podem ser avaliados quando houver ingresso em partida, roteamento ou coordenação entre servidores.
