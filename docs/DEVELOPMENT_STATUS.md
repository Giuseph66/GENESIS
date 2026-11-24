# Status de desenvolvimento

**Referência:** 2026-11-23  
**Marco atual:** Fase 0 concluída. Fase 1 pendente.

## Andamento

| Estado | Itens |
| --- | --- |
| Concluído | Documentação inicial, Git, compilação TypeScript, mapeamento Rojo e bootstrap no Studio via Vinegar. |
| Em desenvolvimento | Nenhuma tarefa em curso. |
| Pendente | Instalação, spawn, interação, HUD, coleta, inventário e demais sistemas de gameplay. |

## Decisões propostas

- Validar primeiro um mundo solo com fronteira cliente-servidor e prever coop para até quatro.
- Fechar o ciclo com duas pesquisas, uma linha automática, um setor modular e o Capítulo 1.
- Usar uma rede elétrica por instalação e uma chave de persistência por mundo no MVP. A extração confirma saldo e missão na mesma escrita.
- Fazer a expedição no mesmo place inicialmente. Prototipar modelos com primitivas até a leitura do gameplay estar estável.
- Usar tempos, capacidades e custos provisórios. Validar balanceamento com playtest e capacidade com benchmark.

## Problemas conhecidos e resultados

A compilação e a geração do place passaram. A sincronização ao vivo propagou uma alteração no código TypeScript e o teste local iniciou cliente e servidor com a revisão atualizada. As versões e a evidência estão no [diário](DEVELOPMENT_LOG.md). Testes de gameplay e carga aguardam os respectivos sistemas.

## Próxima entrega

1. Montar a primeira sala da instalação com piso, spawn e um terminal.
2. Validar o percurso do spawn ao terminal com uma interação controlada pelo servidor.
3. Integrar HUD, coleta e inventário para fechar a Fase 1.

Use [Arquitetura](ARCHITECTURE.md) para o passo a passo e [Roadmap](ROADMAP.md) para critérios de saída.
