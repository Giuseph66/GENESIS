# Roadmap

Cada fase entrega um trecho jogável ou uma validação que habilita o próximo. Para acompanhar a execução atual, veja [Status de desenvolvimento](DEVELOPMENT_STATUS.md).

| Fase | Entrega | Evidência de saída |
| --- | --- | --- |
| 0 — Infraestrutura | Git, roblox-ts, Rojo, estrutura de projeto e ambiente local | Alteração TypeScript sincronizada no Studio. Bootstrap observado no cliente e no servidor. |
| 1 — Mundo e jogador | Instalação, spawn, câmera, interação, coleta, HUD e inventário | Jogador entra, usa um terminal e coleta um recurso que aparece no inventário. |
| 2 — Construção | Grid, prévia, rotação, custos, remoção e snapshot de estruturas | Construção válida desconta o custo uma vez. Uma sobreposição é recusada. O adaptador restaura posição e rotação. |
| 3 — Automação | Seis tipos iniciais, energia, esteiras e receitas | Componente chega ao armazém sem intervenção. Falta de energia e saída cheia pausam a linha, que retoma preservando os itens. Reposicionar uma máquina preserva seus itens e reconfigura portas. |
| 4 — Combate | Ferramenta inicial, ataques, esquiva, dois inimigos e Guardião | Arena de teste permite derrotar o chefe com o kit inicial. Dano e recompensa dependem do servidor. |
| 5 — Expedições | Geração com seed, recompensas, melhorias, morte e extração | Percurso conectado em seed reproduzível. Extração e morte geram resultados distintos, verificados em memória. |
| 6 — Narrativa | ECHO, missões, diário e tutorial contextual | Os objetivos respondem a ações reais da fábrica e da expedição. Jogador avança até o diálogo final. |
| 7 — Progressão e save | Pesquisa integrada, snapshot completo, migração, sessão e recuperação | Fluxo inteiro do Capítulo 1 em mundo solo, com retorno em uma nova sessão e validação de extração durável. |
| 8 — Coop | Convites, permissões, mundo compartilhado e expedições cooperativas | Até quatro membros autorizados operam a mesma fábrica e recebem o resultado correto de ações concorrentes. |
| 9 — Polimento | Arte, áudio, animação, desempenho e ajustes mobile | Sessão completa com mouse e toque. Capacidade validada em carga, com registros por dispositivo. |
| 10 — Publicação | Configuração da experiência, ícone, imagens, descrição e validação de acesso | Checklist com evidências e teste privado. Publicação pública depende de autorização explícita do proprietário. |

O primeiro marco jogável é a linha automática da Fase 3. O aceite do MVP solo acontece na Fase 7 e inclui interação com toque. Para desenvolver a experiência antes da integração completa, faça as duas pesquisas e as missões evoluírem em paralelo ao trecho que as utiliza. Fixtures de dev, como uma arena de combate, ficam acessíveis apenas em cenário de teste.

## Aceite do MVP

| ID | Percurso verificável em uma entrega |
| --- | --- |
| MVP-01 | Entrar, despertar na instalação, falar com ECHO, coletar recursos e restabelecer a energia. |
| MVP-02 | Posicionar mineradora, esteiras, fornalha, montadora e armazém. Ver minério processado e componentes chegarem ao estoque. |
| MVP-03 | Consumir componente na pesquisa de acesso e entrar em uma expedição procedural. |
| MVP-04 | Combater inimigos, escolher melhoria, derrotar Guardião e extrair. Após a volta, verificar que o saque foi creditado e a melhoria expirou. |
| MVP-05 | Consumir fragmento e componente em Leitura de Sinal. Falar com ECHO e verificar conclusão do Capítulo 1. |
| MVP-06 | Fechar a sessão, entrar novamente e verificar fábrica, estoque, pesquisas, progresso e equipamento. |
| MVP-07 | Em tentativa adicional, morrer antes da extração. Voltar à base com equipamento permanente, fábrica e progresso e verificar perda do saque daquela tentativa. |

Execute [os cenários de teste](TESTING.md) e vincule os resultados de cada ID no [status](DEVELOPMENT_STATUS.md). O avanço de fase depende da evidência observada. Use o [plano de desempenho](PERFORMANCE.md) para definir o limite de construção da versão testada.
