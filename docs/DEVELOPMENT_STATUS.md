# Status de desenvolvimento

**Referência:** 2026-11-24  
**Marco atual:** Capítulo 1 jogável de ponta a ponta em mundo solo. Fases 0 a 6 observadas no Studio.

## Andamento

| Estado | Itens |
| --- | --- |
| Concluído | Infraestrutura, mundo aberto, coleta, construção, automação, combate, expedições e narrativa do Capítulo 1. |
| Em desenvolvimento | Fase 7: persistência pronta e testada em memória. Falta DataStore real, com o place publicado em modo privado. |
| Em desenvolvimento | Fase 8: grupo e permissões prontos. Faltam expedições cooperativas. |
| Pendente | Polimento mobile, arte e áudio finais, publicação. |

## Aceite do MVP

| ID | Situação |
| --- | --- |
| MVP-01 a MVP-05 | Observados no Studio. Combate conduzido por roteiro automatizado; falta playtest humano. |
| MVP-06 | Recarga comprovada em memória. Falta sessão real com DataStore. |
| MVP-07 | Observado: morte perde a mochila e preserva base e progresso. |

## Decisões em vigor

- Mundo aberto infinito por decisão do proprietário. Relevo regenerado pela semente 7193, sem persistência. História e GDD seguem como escritos, e o início na superfície diverge do despertar subterrâneo.
- ECHO ativo desde o início, sem terminal a ligar, por decisão do proprietário.
- Construção por câmera de drone, somente no platô do posto, ±80 studs, em células de 4 studs.
- Place único em `build/GENESIS.rbxlx`, sincronizado pelo Rojo.
- Mundo solo pertence ao primeiro jogador do servidor. Dados ilegíveis deixam o mundo indisponível, sem sobrescrita.
- Sem assets externos: modelos de primitivas, animação por código e sons que acompanham o cliente Roblox.
- Tempos, custos e dano são provisórios e dependem de playtest.

## Problemas conhecidos

- O progresso não sobrevive ao fim do teste no Studio enquanto o place não estiver publicado com acesso à API.
- Picos de até 66 ms ao gerar blocos novos do mundo.
- Pedras e árvores podem flutuar em encostas muito íngremes.
- Inimigos desviam por sondagem, sem Pathfinding.
- Animação do braço e picareta são locais: outros jogadores não as veem.
- Toque e áudio não testados. Multijogador observado só em parte, e o proprietário dispensou novos testes.

## Não implementado

Registrado em [GDD](GAME_DESIGN_DOCUMENT.md#jogabilidade-planejada) e [Roadmap](ROADMAP.md).

## Próxima entrega

1. Playtest humano do Capítulo 1 e ajuste de ritmo, dano e legibilidade.
2. Publicar em modo privado, com autorização do proprietário, e executar MVP-06 com DataStore.
3. Revisar controles e interface no Device Simulator e em um aparelho.
4. Melhorar a jogabilidade conforme o retorno do proprietário.

As evidências estão no [diário](DEVELOPMENT_LOG.md).
