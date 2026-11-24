# Sistema industrial

## Grid, instalação e custos

Use coordenadas inteiras relativas à origem do terreno e rotações em passos de 90° no eixo vertical. Cada máquina declara o volume ocupado em células, a altura e as portas em coordenadas locais. O MVP usa o piso industrial e volumes tridimensionais, com empilhamento e esteiras verticais reservados a uma expansão. Proposta inicial de escala: célula de 4 studs, sujeita a teste de leitura e alcance em mobile.

1. O cliente aponta uma célula e desenha a prévia a partir do catálogo compartilhado. Forma e texto indicam bloqueios previstos.
2. O servidor confere mundo, membro, distância, área de construção, piso, ocupação, volume girado, desbloqueio, custo e limite por mundo.
3. Dentro da mutação do mundo, o servidor debita o custo, ocupa as células e cria um ID de máquina. A revisão publicada atualiza a representação de fábrica e o inventário.

**Remoção:** o jogador vê os materiais que serão devolvidos. O servidor verifica se o destino comporta os materiais da máquina, itens sob custódia e reembolso antes de liberar células e portas. Proposta inicial: reembolso integral das estruturas do tutorial. Máquinas fixas do cenário, como o gerador de emergência, podem ser protegidas de remoção.

**Reposicionamento:** preserva ID, receita, buffers e progresso. Valide a área de destino antes de alterar a origem. Recalcule conexões afetadas, mantendo os itens que já estão nos segmentos existentes. A prévia mostra as portas que perderão conexão.

## Linha de partida e economia de referência

**Mineradora → esteira → fornalha → esteira → montadora → esteira → armazém.** A fornalha usa eletricidade. Carvão abastece o gerador. A montadora recebe barras de ferro, o que permite validar o ciclo com um fluxo de insumos por máquina.

| Máquina | Regra inicial proposta | Feedback de inspeção |
| --- | --- | --- |
| Mineradora | Extrai 1 minério em 2 s quando instalada sobre um veio | Quantidade extraída, saída cheia, sem energia |
| Esteira | 1 item por segmento. Move até o próximo destino com espaço a cada 0,4 s | Direção, posição do item e congestionamento |
| Fornalha | 1 minério → 1 barra em 3 s | Insumo, progresso, saída e energia |
| Montadora | 2 barras → 1 componente em 4 s | Receita, entradas faltantes e saída |
| Gerador | 30 unidades de energia/s. 1 carvão sustenta 60 s de operação enquanto ligado | Combustível e capacidade |
| Armazém | Estoque inicial de 32 unidades no total | Itens por tipo, quantidade e espaço disponível |

Referência de consumo inicial: mineradora 5, fornalha 10 e montadora 10 unidades de energia/s. Buffer inicial proposto de 4 unidades por tipo nas entradas e saídas de fabricação.

| Ação inicial | Custo proposto em minério de ferro |
| --- | --- |
| Restaurar o gerador existente | 2 |
| Construir a mineradora | 6 |
| Construir a fornalha | 4 |
| Construir a montadora | 6 |
| Construir o armazém | 2 |
| Construir um segmento de esteira | 1 |

Disponibilize inicialmente 30 minérios e 6 carvões entre coleta e reservas da instalação. Com seis segmentos, a linha usa 26 minérios e deixa quatro para experimentar. Antes de ajustar custos, monte a planta e confirme que a rota de referência cabe nesses seis segmentos. Carvão abastece o gerador durante o tutorial e a produção das pesquisas. Ferro e carvão continuam disponíveis para coleta manual quando a linha estiver parada.

## Catálogos e estado

| Catálogo | Campos mínimos |
| --- | --- |
| Recurso | ID estável, nível, referência de texto e ícone, limite de empilhamento |
| Receita | ID, entradas, saídas, duração, energia por segundo, máquina compatível e pesquisa exigida |
| Máquina | ID de tipo, categoria, custo, volume, portas, buffers, receitas, energia, vida estrutural, nível inicial e pesquisa exigida |
| Tecnologia | ID, descrição, pré-requisitos, custo, duração, novos tipos e receitas |

O estado de uma máquina contém ID de instância, célula de origem, rotação, receita selecionada, buffers, progresso, vida, nível e estado operacional. Motivos de pausa devem distinguir máquina desligada, sem energia, sem insumo e saída cheia. No MVP, vida e nível podem partir de valores fixos do catálogo.

## Esteiras e simulação

- Portas se ligam quando são adjacentes, compatíveis e estão apontadas na direção correta. Uma porta de saída aceita uma conexão. A curva liga uma entrada e uma saída adjacentes. Portas e IDs de máquinas permitem reconstruir o grafo a partir do grid.
- Processe cada passo com uma visão inicial do estoque. Reserve destino e confirme transferências em ordem estável. Um item avança no máximo um segmento por passo e uma transferência ocupa a vaga antes que outra possa usá-la. Se a vaga estiver ocupada no início do passo, o item aguarda.
- A reserva da receita representa os itens em processamento. Progresso pausa na falta de energia. Na conclusão, a saída entra no buffer uma vez. Se estiver cheio, o lote pronto aguarda vaga e continua contado no inventário interno da máquina.
- A posição visual vem da rota e do tempo informado pelo servidor. Use representações locais reutilizáveis dos itens em esteiras.

## Energia e expansão

O MVP tem uma rede lógica por instalação com cabos do cenário representando a infraestrutura. O scheduler calcula geração e concede o consumo por prioridade e ID estável. Conceda o consumo inteiro de cada máquina ou mantenha-a pausada. O HUD mostra geração disponível, demanda, consumo concedido e déficit. Uma alteração no combustível ou na topologia deve aparecer na próxima atualização de energia.

Para redes segmentadas, acrescente arestas elétricas e recalcule componentes conectados quando a topologia mudar. Baterias, prioridades escolhidas pelo jogador e instabilidade podem reutilizar o contrato de concessão de energia. Ver [desempenho](PERFORMANCE.md) para frequência e medição e [modelo de dados](DATA_MODEL.md) para salvamento de lotes e segmentos.
