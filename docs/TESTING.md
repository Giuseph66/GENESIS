# Testes

## Níveis de teste

| Nível | Uso |
| --- | --- |
| Domínio | Estoque, grid, produção, energia, combate e gerador de salas com entradas conhecidas, relógio e seed controlados. |
| Integração | Comandos, snapshots, falhas e concorrência com adaptador em memória. |
| Studio | Fluxo jogável em cliente e servidor, múltiplos clientes, simulação de rede e tamanhos de dispositivo. |
| Ambiente privado e hardware | Persistência real isolada, validação de retomada e ergonomia em dispositivo móvel físico. |

Use **Test** para o caminho solo e **Server & Clients** para concorrência e permissões quando o coop entrar. Use o **Device Simulator** para revisar layout e ações de toque. Registre desempenho em hardware real. Se houver integração com Studio disponível, ela pode automatizar a coleta de logs e a reprodução de cenários. [Modos de teste do Studio](https://create.roblox.com/docs/studio/testing-modes) · [Testes em hardware](https://create.roblox.com/docs/performance-optimization/test-on-hardware)

## Casos de domínio e integração

| ID | Situação | Resultado esperado |
| --- | --- | --- |
| INV-01 | Transferir mais do que a origem possui ou estourar o destino | Ambos os estoques preservados. |
| INV-02 | Duas transferências simultâneas tentam consumir o último item | Uma confirmada. Quantidade total permanece igual. |
| GRID-01 | Posicionar uma máquina de várias células após girar 90° junto a um limite ou estrutura | Volume rotacionado e portas corretos. Colisão ou extrapolação recusa o comando sem débito. |
| GRID-02 | Remover máquina cheia com inventário de destino sem espaço | Rejeitar e preservar grid, reserva e itens. |
| GRID-03 | Reposicionar máquina enquanto há item em esteira adjacente | Máquina mantém identidade, itens e progresso. Item em esteira permanece contabilizado. |
| FACT-01 | Ciclo completo de uma receita | Entradas consumidas e saída registrada uma vez. |
| FACT-02 | Saturar esteira e armazém, depois abrir espaço | Fluxo interrompe e retoma sem duplicar, perder ou ultrapassar item. |
| FACT-03 | Cortar e restaurar energia durante processamento | Reserva preservada. Progresso pausa e retoma do mesmo ponto. |
| TECH-01 | Solicitar pesquisa com pré-requisito faltando ou repetir conclusão | Pedido inválido mantém estoque. Conclusão válida libera conteúdo uma vez. |
| RUN-01 | Repetir a mesma seed com catálogos iguais | Mesmo layout, spawns e ofertas. |
| RUN-02 | Rodar 100 seeds fixas como lote inicial de regressão | Toda saída entregue é navegável, tem entrada segura, chefe e saída. Contingência registrada e validada. |
| RUN-03 | Forçar falhas de encaixe e de mapa de contingência | Expedição recusada com o jogador na base. |
| COM-01 | Atacar fora de alcance, através de obstáculo ou antes do cooldown | Nenhum dano nem crédito. Esquiva sem resistência é recusada. |
| COM-02 | Concorrer morte, derrota do chefe e extração | Um único resultado terminal por participante. |
| SAVE-01 | Recarregar snapshot com lote ativo, estoque cheio e item em trânsito | Estado compatível com a revisão persistida e sem diferenças de estoque. |
| SAVE-02 | Migrar versão anterior e carregar dados incompletos, inválidos ou de versão futura | Migração gera estado válido. Dados inválidos ou versão futura resultam em sessão indisponível com registro preservado. |
| SAVE-03 | Simular escrita confirmada no armazenamento com resposta perdida | Reconciliação encontra o recibo de extração. Jogador recebe o saque uma única vez. |
| SAVE-04 | Tentar gravar por duas sessões e renovar token depois de substituído | Apenas a sessão com token atual grava. |
| NET-01 | Enviar campos fora de faixa, payload excedente e repetição de comando | Validação e limite aplicados. Repetição válida preserva resultado da mutação original. |
| COOP-01 | Dois membros disputam uma célula ou o mesmo estoque | Aplicação única. Clientes convergem para a mesma revisão da visão compartilhada. |
| COOP-02 | Remover uma permissão antes da aplicação de ação pendente | Ação rejeitada. Nenhum débito ou alteração de grid. |

## Sessão de aceite

1. Abrir mundo novo em **Test**. Executar `MVP-01` a `MVP-03` de acordo com o [roadmap](ROADMAP.md).
2. Usar seed registrada para `MVP-04`, revisar a transição entre Guardião e extração e executar `MVP-05`.
3. Encerrar e retornar em nova sessão para `MVP-06`. Em teste de DataStore, verificar reconexão também fora do processo original.
4. Rodar `MVP-07` em outra tentativa. Repetir o percurso principal em layout mobile com toque e verificar controles em aparelho físico antes da publicação.
5. Para Fase 8, repetir com dois clientes concorrentes e depois quatro. Cobrir convites, limites, permissões e saída durante expedição.

Registro mínimo por execução: versão, data, ambiente, dispositivo, cenário, seed quando aplicável, resultado, log ou captura e motivo do bloqueio quando houver. Atualize [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) com o resumo.
