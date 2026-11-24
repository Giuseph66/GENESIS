# Desempenho

## Estratégia

Use scheduler central no servidor por mundo ativo. Na proposta inicial, indústria roda a cada 0,2 s, com a esteira avançando a cada dois passos. Controle o trabalho acumulado e registre backlog. Se exceder o orçamento, simule mais devagar até recuperar o ritmo, preservando tempo de receitas e conservação de estoque. Revise a periodicidade com medições.

- **Energia:** recalcule topologia quando conexões mudarem. Atualize fornecimento quando estiver diferente por combustível, liga/desliga ou demanda.
- **Logística:** represente segmentos, vagas e recursos em dados. Percorra linhas ativas e reative trechos quando uma vaga a jusante abrir.
- **Rede:** envie snapshots compactos e deltas agrupados por relevância. Preserve inventário e progressão em atualizações confirmadas. Interpole itens visuais no cliente.
- **Cena:** use pooling para itens, efeitos e objetos reutilizados que apareçam com frequência. Avalie streaming e modelos com poucos elementos. O cliente deve lidar com modelos fora de alcance de streaming. [Instance streaming](https://create.roblox.com/docs/workspace/streaming)
- **Expedição:** distribua cálculos de rota e criação de entidades entre frames. Remova entidades, referências e eventos quando a tentativa acabar.

## Carga reproduzível

Os tamanhos de referência são **50, 100, 250 e 500 máquinas**. Registre segmentos separadamente para evitar comparar fábricas com topologias diferentes. Use a mesma composição de máquinas, densidade de esteiras, receita e seed ao mudar o tamanho. Rode cenário ativo e congestionado, construção em lote e transição entre base e expedição. Faça as primeiras medições com um jogador e repita com quatro ao habilitar o coop.

Protocolo inicial: 30 s de aquecimento e três amostras de 120 s por cenário. Registre plataforma, Studio ou experiência privada, CPU, memória, dispositivo alvo, versão, máquinas, segmentos, jogadores e seed. Na comparação, mantenha constantes cenário e hardware.

| Métrica | Ponto de partida para avaliação |
| --- | --- |
| Tempo do passo industrial no servidor | p95 e máximo por etapa, mais tamanho e duração do backlog. Hipótese inicial: p95 ≤ 4 ms até 100 máquinas, sem backlog sustentado. |
| Frame time no mobile de referência | Hipótese inicial: p95 ≤ 33,3 ms durante carga de fábrica de 100 máquinas. Registre também p99, travamentos e transições. |
| Rede | Bytes/s e mensagens/s por jogador em repouso, produção e combate. Compare com a primeira medição e investigue picos. |
| Memória | Pico, platô e retorno após cinco expedições. Registre cenário, cliente, servidor e quantidade de instâncias. |
| Estado da fábrica | Estoque antes e depois, produção esperada, itens em trânsito e ciclos concluídos. Verifique conservação sob carga. |

Delimite etapas com `debug.profilebegin()` e `debug.profileend()`. Use MicroProfiler e Developer Console para correlacionar tempo de scripts, memória, renderização e rede. [Ferramentas de diagnóstico](https://create.roblox.com/docs/performance-optimization/identify) · [Roteiro do MicroProfiler](https://create.roblox.com/docs/performance-optimization/microprofiler/use-microprofiler)

Os alvos acima são propostas de validação. Defina o limite inicial de construção a partir do maior cenário que sustenta as metas no hardware alvo, com margem para o restante do jogo. Guarde um perfil de referência para comparar regressões.
