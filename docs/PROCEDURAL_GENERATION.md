# Geração procedural e expedições

## Mundo aberto

O servidor gera blocos de 128 studs ao redor dos jogadores, com a semente 7193, e descarta os distantes. A mesma coordenada produz sempre o mesmo relevo, bioma, cenário e jazidas. O platô do posto acompanha o grid e o relevo começa logo após a borda, com transição irregular.

Cada bloco divide a geração entre quadros, com orçamento de 6 ms. O esgotamento de uma jazida é lembrado enquanto o servidor estiver ativo, mesmo com o bloco descarregado. Longe da origem, a precisão numérica do motor é o limite prático.

## Setor de manutenção

A primeira expedição acontece em módulos de uma infraestrutura externa conectada à base. Proposta inicial: 5–7 salas, incluindo entrada segura, dois encontros, arena do Guardião e extração. Uma ramificação opcional oferece um depósito ou evento. Uma melhoria é oferecida no caminho principal antes do chefe, permitindo demonstrar o sistema em qualquer seed válida.

Cada template contém ID e versão, volume, pontos de entrada e saída, regiões caminháveis, pontos de spawn, pontos de recurso e condições de uso. Entradas usam pares de encaixe com orientação e largura compatíveis. Valide no Studio o deslocamento entre encaixes, incluindo a passagem do personagem e de inimigos relevantes.

## Algoritmo e reprodução

1. Gere no servidor um grafo com início, objetivo, chefe e extração conectados. Marque encontro e ramificação quando aplicável.
2. Atribua módulos por tipo e encaixe em ordem estável. Teste sobreposição de volumes antes do posicionamento.
3. Valide alcançabilidade, alinhamento, entrada segura, arena e pontos úteis. Feche conexões de portas sem vizinho.
4. Preencha inimigos, materiais e recompensas com fluxos aleatórios derivados da seed, um por finalidade. Uma mudança na tabela de saque deixa a sequência de salas reproduzível na mesma versão.
5. Limite tentativas de layout. Proposta inicial: até oito candidatos, depois mapa fixo validado com aviso diagnóstico. Se até o mapa de contingência falhar, recuse a expedição antes de retirar o jogador da base.

Registre `expeditionId`, seed, versão do gerador, versão do catálogo, resultado da validação e tentativas. A garantia de reprodução vale para o mesmo conjunto de versões. A coordenada da fila de spawn vem de um ponto aprovado do módulo. Verifique área livre antes de materializar inimigos ou itens.

## Recompensas iniciais propostas

| Origem | Resultado |
| --- | --- |
| Caminho principal | Uma escolha entre três opções sorteadas de velocidade, dano, escudo temporário ou recarga. |
| Depósito opcional | Materiais comuns extras, com custo de tempo e risco de novo encontro. |
| Guardião | Fragmento de tecnologia antiga e registro narrativo de recuperação garantidos na primeira conclusão válida. |

Melhorias têm ID, raridade, modificador, limite de acúmulo e regras de compatibilidade. Comece com comum, incomum e raro e reserve épico e lendário para ampliar o catálogo. A proposta inicial é permitir combinações de efeitos diferentes e limitar duplicatas a dois acúmulos. Alterações se aplicam apenas à tentativa. O sorteio e a escolha validada acontecem no servidor. O MVP exclui compra com dinheiro real ligada a recompensas aleatórias.

## Início, fim e extração

**Sequência:** `Preparando → Ativa → ConfirmandoExtração → Extraída`. Morte ou desconexão em `Ativa` leva a `EncerradaSemExtração`. Em `ConfirmandoExtração`, siga a resolução de persistência descrita em [modelo de dados](DATA_MODEL.md).

- A entrada exige a pesquisa de acesso e um jogador pronto na base. Proposta de infraestrutura do MVP: setor montado em área isolada no mesmo servidor e place.
- O servidor valida interação no ponto de extração, chefe derrotado, estado de vida e participação ativa. A primeira operação terminal válida trava o resultado. Se a morte foi confirmada primeiro, a solicitação de extração é rejeitada.
- A extração aplica os ganhos permanentes uma vez, registra a missão e então devolve o jogador à base. Limpe inimigos, conexões, partes, objetos de interface e efeitos da tentativa.
- A geometria do mapa e os contratos devem aceitar mais participantes no futuro. Antes do coop, defina regras de extração individual, crédito por encontro e encerramento da instância quando o último jogador sair.
