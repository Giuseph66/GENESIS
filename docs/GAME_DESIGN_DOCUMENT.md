# Game Design Document

## Visão

**Project Genesis** é um jogo de construção industrial e expedições em terceira pessoa. A base é o lugar onde o jogador projeta e prepara. As expedições dão acesso a materiais e evidências indisponíveis na fábrica. As decisões sobre o que produzir e o que trazer de volta abrem novos caminhos na história.

| Pilar | Como o jogador percebe |
| --- | --- |
| Projeto industrial livre | Escolhe posição, rotação e trajeto dentro do terreno autorizado. Consegue ler o fluxo de uma linha e identificar onde ela travou. |
| Risco recuperável | Escolhe explorar uma sala opcional ou seguir para a extração. A morte custa os ganhos ainda em trânsito e as melhorias da expedição. |
| Descoberta ligada à ação | Restaurar a energia muda a instalação. A fábrica habilita o acesso ao setor externo e um registro recuperado muda o próximo objetivo de ECHO. |

## Ciclo do primeiro capítulo

1. Encontrar ECHO e coletar insumos na instalação.
2. Restaurar um gerador e montar uma linha que entrega componentes ao armazém.
3. Usar um componente na pesquisa **Acesso ao Setor de Manutenção**.
4. Entrar na expedição, enfrentar inimigos, pegar uma melhoria temporária e chegar ao Guardião Industrial.
5. Extrair com o fragmento do chefe e o registro do setor.
6. Usar o fragmento e outro componente na pesquisa **Leitura de Sinal**. Conversar com ECHO e concluir o capítulo.

**Hipótese de playtest inicial:** obter o primeiro produto automático em até 12 minutos e concluir uma expedição bem-sucedida em 8–12 minutos. Medir desde o primeiro controle do personagem e desde a entrada na expedição, respectivamente. Registrar desvios por etapa, pedidos de ajuda e motivos de abandono.

## Escopo

| MVP jogável | Expansão planejada |
| --- | --- |
| Instalação inicial, um mundo solo e Capítulo 1 completo | Coop de até quatro pessoas, convites, permissões e mundos compartilhados |
| Mineradora, esteira, fornalha, montadora, gerador e armazém | Baterias, redes segmentadas, divisores, unificadores, laboratório, refinaria, reciclagem, torres e portal construível |
| Ferro, carvão, barras, componentes e um fragmento de tecnologia antiga | Cobre, pedra, madeira, água, circuitos, ligas, cristais e materiais GENESIS |
| Expedição modular, dois inimigos comuns, chefe, recompensas, extração e morte | Biomas, chefes e inimigos adicionais, habilidades, drones, ampliação de raridades e conteúdo |
| Duas pesquisas, tutorial, salvamento e retomada | Árvore tecnológica ampliada, impacto ambiental, eventos e finais múltiplos |

Rotação, remoção e reposicionamento fazem parte da construção. No primeiro corte da Fase 2, o jogador já deve poder construir e remover. O reposicionamento entra antes do aceite do MVP, após os inventários das máquinas integrarem a simulação. Ver [fábrica](FACTORY_SYSTEM.md).

## Progressão e recuperação

| Pesquisa inicial | Requisito e custo propostos | Tempo inicial | Efeito |
| --- | --- | --- | --- |
| Acesso ao Setor de Manutenção | Primeiro componente entregue automaticamente ao armazém. Consome 1 componente. | 10 s | Libera a entrada da expedição. |
| Leitura de Sinal | Retorno confirmado com registro do Guardião. Consome 1 fragmento de tecnologia antiga e 1 componente. | 15 s | Libera o diálogo final com ECHO. |

As pesquisas são iniciadas no terminal da base. Custos saem do estoque designado para a operação e o servidor registra o tempo restante. A missão que libera a primeira pesquisa exige o fato de produção automática, mesmo quando o jogador já tem um componente por outro meio.

- **Base:** construções, pesquisa, estoque e capítulo pertencem ao mundo. Inventário pessoal e equipamento permanente pertencem ao jogador naquele mundo.
- **Expedição:** a mochila da sessão e as melhorias pertencem à tentativa. O menu de extração mostra o que será creditado ao retornar. O saldo permanente só muda depois da confirmação do servidor.
- **Recuperação:** o equipamento inicial volta com o jogador. O setor continua acessível após o desbloqueio e a base mantém os recursos necessários para novas tentativas. Nenhum material de entrada da primeira linha depende de uma expedição bem-sucedida.
- **Expansão:** mineração, logística, energia, automação, produção, defesa, combate, exploração, IA e GENESIS são grupos da árvore futura. Poluição, ruído e emissões podem influenciar ameaças depois que o núcleo industrial estiver validado.

## Interface e controles

| Situação | Apresentação e ação |
| --- | --- |
| Entrada e retomada | Menu com entrada no mundo e estado de carregamento. Em sessão ocupada, oferecer nova tentativa após informar o motivo. |
| Base | Barra de ferramentas, inventário, objetivo atual e estado da energia. Inspeção da máquina mostra receita, entradas, saídas e motivo da pausa. |
| Construção | Prévia holográfica, contorno e mensagem de validade. Computador usa mira e teclas contextuais. Toque usa seleção de célula, rotação e confirmação explícita. |
| Expedição | Vida, resistência, objetivo, melhorias e mochila da tentativa. HUD distingue saída bloqueada, disponível e confirmação em andamento. |
| Retorno | Resumo de recursos assegurados e perdidos, seguido pelo próximo objetivo. |

Reserve estados explícitos para carregando, vazio, concluído e rejeitado. Teste alvos tocáveis, áreas reservadas do dispositivo, textos maiores e conflitos entre câmera e controles. Defina ações como Interagir, Rotacionar, Confirmar, Cancelar e Esquivar em um mapeamento comum de entrada. [Entrada multiplataforma no Roblox](https://create.roblox.com/docs/input)

## Direção visual e sonora

Low poly industrial, volumes legíveis e contraste entre metal, luzes emissivas e vegetação. Use grafite `#15181D` para superfícies de interface, cinza `#303740` para agrupamentos, laranja `#FF9633` para ação e perigo, ciano `#38C9E8` para energia e branco `#E4E8ED` para texto principal. Combine cor com forma, ícone ou texto, especialmente em posicionamento e combate. Use primitivas para os primeiros modelos. Produza arte original no Blender quando houver ganho de leitura ou atmosfera.

O som sinaliza gerador ativo, produção bloqueada, ataques e extração. Cada informação necessária para jogar também deve ter representação visual.
