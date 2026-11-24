# Modelo de dados e persistência

## Snapshot de mundo

Proposta de MVP: manter a unidade de consistência em uma chave por mundo, por exemplo `world:<worldId>`. Inventários dos membros ficam no mesmo documento que fábrica e progresso. Isso permite aplicar o débito de um jogador e o crédito no armazém na mesma mutação, sem depender de uma escrita coordenada em chaves diferentes.

| Bloco | Campos principais |
| --- | --- |
| Metadados | `schemaVersion`, `worldId`, `revision`, `updatedAt`, proprietário e sessão de escrita |
| Permissões e membros | IDs de usuário representados como strings no snapshot e concessões por ação |
| Membro | Inventário, equipamento permanente, preferências do mundo e estatísticas |
| Progresso | Pesquisas concluídas ou em andamento, missões, registros, capítulo e fatos narrativos únicos |
| Fábrica | Origem, máquinas com IDs e células, rotações, receitas, buffers, lotes, progresso e estado do combustível |
| Logística | Tipo, célula e rotação de cada segmento, conexões configuradas quando houver e itens em trânsito |
| Operações duráveis | Identificador e resultado das extrações confirmadas durante a janela de recuperação |

Tipos e templates usam IDs estáveis. Salve quantidades e rotações como números, referências por ID e posições como coordenadas simples. Reconstrua índices, conexões inferidas pelo grid e representações 3D ao carregar. Lotes figuram nos buffers ou em produção conforme a etapa. Inventário temporário, inimigos e melhorias de uma tentativa ativa terminam com a sessão. A fábrica retoma a partir do snapshot, com simulação offline reservada para outra fase.

## Carregamento e gravação

1. Adquirir exclusividade de escrita com um token de sessão e um prazo renovável no registro. Use `UpdateAsync` para disputar, renovar e gravar verificando o token. Se a renovação não puder ser confirmada antes do vencimento, suspenda mutações e tente recuperar ou encerrar a sessão. Uma sessão antiga perde o direito de escrever quando o token é substituído.
2. Migrar da versão lida em passos `N → N+1` e validar estrutura, tipos, limites, referências e integridade do estoque. Abrir mundo novo apenas quando a ausência do registro estiver confirmada. Em erro de leitura, dados inválidos ou versão superior à suportada, apresente indisponibilidade sem substituir os dados.
3. Gerar snapshot de uma revisão estável, com gravações serializadas por mundo. Salvar periodicamente apenas mundos alterados e tentar gravar na saída final e no encerramento. Proposta inicial: checkpoint de 60 s, ajustado com base em orçamento, frequência de mudança e tamanho dos dados. Se o mundo mudou durante a gravação, mantenha pendente a revisão mais nova.
4. Use retentativas limitadas, backoff com jitter e observação do orçamento. Um erro de escrita pode deixar resultado incerto. Para operações duráveis, confirme por revisão e identificador com leitura sem cache quando for necessário resolver ambiguidade. Reserve tempo para encerramento, que deve ser tratado como uma tentativa de gravação.

O callback de `UpdateAsync` deve poder reexecutar sem efeitos externos e sem suspender a execução. Publique eventos e efeitos somente após resolver o resultado da escrita quando a operação exigir confirmação durável. Use um adaptador em memória para testes, com erros e conflitos injetáveis, e uma experiência de teste isolada para verificar DataStore. Controle tamanho e taxa de escrita conforme os limites oficiais. [Data stores](https://create.roblox.com/docs/cloud-services/data-stores) · [Erros e limites](https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits)

## Extração durável

O servidor define um ID de extração por tentativa e participante. Na mesma atualização de mundo, verifique sessão e ID, aplique os itens e os fatos narrativos e grave o recibo. Serialize a atualização com os checkpoints e aplique a revisão confirmada antes de liberar novas mutações do mundo. Reserve espaço para o saque antes da operação. Uma mochila de recuperação vinculada ao membro pode receber o excedente quando o inventário pessoal estiver cheio. Esse estoque persistente fica acessível a partir da base e segue as regras de transferência. Limite o volume de saque por tentativa e oriente o jogador a esvaziar a mochila de recuperação antes de iniciar outra.

Na confirmação, renderize os ganhos, finalize a tentativa e direcione o jogador à base. Caso o processo pare após gravar, retome com o inventário e progresso já creditados. Em resposta incerta, mantenha o resultado pendente até resolver o ID. Defina a retenção dos recibos para cobrir a janela de reconciliação e rejeite tentativas de sessões encerradas fora desse intervalo. Uma sessão com resultado pendente e sem confirmação de escrita pode encerrar após expirar o prazo de recuperação. Na próxima leitura, o snapshot durável é a referência.

## Critérios de integridade

- Quantidades inteiras e dentro da capacidade. Pesquisa em andamento tem custo debitado uma vez.
- IDs de máquinas são únicos. Células, ocupação e conexões precisam ser reconstruíveis. Catálogos alterados exigem migração para IDs removidos.
- Toda transferência muda origem e destino de forma indivisível. Remoção devolve itens em buffers e reservas uma única vez.
- Snapshot tem limite de construção configurável e medição de tamanho serializado. Se o mundo se aproximar do orçamento, aplique o limite antes de estudar particionamento.
