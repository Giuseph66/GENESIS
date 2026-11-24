# Status de desenvolvimento

**Referência:** 2026-11-23  
**Marco atual:** documentação inicial criada. Fase 0 pendente.

## Andamento

| Estado | Itens |
| --- | --- |
| Concluído | Índice, design, história, especificações de sistemas, arquitetura, roteiro, matriz de teste e plano de desempenho. |
| Em desenvolvimento | Nenhuma implementação iniciada nesta revisão. |
| Pendente | Git, compilação, Rojo, verificação de Vinegar/Studio, primeiro place jogável e todas as fases de gameplay. |

## Decisões propostas

- Validar primeiro um mundo solo com fronteira cliente-servidor e prever coop para até quatro.
- Fechar o ciclo com duas pesquisas, uma linha automática, um setor modular e o Capítulo 1.
- Usar uma rede elétrica por instalação e uma chave de persistência por mundo no MVP. A extração confirma saldo e missão na mesma escrita.
- Fazer a expedição no mesmo place inicialmente. Prototipar modelos com primitivas até a leitura do gameplay estar estável.
- Usar tempos, capacidades e custos provisórios. Validar balanceamento com playtest e capacidade com benchmark.

## Problemas conhecidos e resultados

O diretório inicial continha apenas `docs/Prompt.txt` e ainda estava fora de um repositório Git. Versões das ferramentas e integração com Studio estão abertas para a Fase 0. Testes de gameplay, compilação e medição de carga aguardam código e place.

## Próxima entrega

1. Registrar versões e disponibilidade das ferramentas.
2. Criar o projeto mínimo e mapear cliente, servidor e módulos compartilhados.
3. Executar a primeira sessão local, demonstrar sincronização e registrar se há impedimentos para entrar na Fase 1.

Use [Arquitetura](ARCHITECTURE.md) para o passo a passo e [Roadmap](ROADMAP.md) para critérios de saída.
