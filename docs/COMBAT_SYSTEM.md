# Sistema de combate

## Kit inicial

Combate em terceira pessoa com uma ferramenta de arco elétrico reaproveitada da instalação. O ataque principal é um arco curto de energia. O secundário, uma descarga concentrada com recarga. A esquiva desloca o personagem e consome resistência. Use animação, forma e som para sinalizar preparação, impacto e recuperação dos ataques.

| Parâmetro inicial para playtest | Proposta |
| --- | --- |
| Vida e resistência | 100 de cada |
| Esquiva | 25 de resistência, 1 s entre usos. Regeneração após 0,75 s sem gastar resistência. |
| Ataque principal | 20 de dano, 0,55 s entre ataques, alcance inicial de 8 studs |
| Ataque secundário | 35 de dano, 4 s entre usos, linha de visão exigida |

Escolha alcance e janela de esquiva em teste com mouse e toque. Se um ataque for rejeitado pelo servidor, o cliente reconcilia o efeito e atualiza o indicador de recarga. O ataque principal precisa permitir terminar a primeira expedição com o equipamento inicial.

## Inimigos e comportamento

| Inimigo | Ação e leitura | Uso no Capítulo 1 |
| --- | --- | --- |
| Drone de reconhecimento | Marca uma linha antes de disparar e muda de posição após o tiro | Ensina deslocamento e linha de visão. |
| Robô industrial corrompido | Recolhe o braço antes de um golpe em arco, seguido de recuperação | Ensina esquiva e contra-ataque. |
| Guardião Industrial | Alterna golpe frontal e ataque de área telegrafado. Abaixo de 50% de vida, encadeia golpes mantendo a janela de reação testada. | Arena própria. Material e registro ficam disponíveis após derrota. |

Estados propostos: `Idle → Patrol → Search → Chase → Attack`, com `Retreat` ao ultrapassar o limite de perseguição e `Dead` como terminal. Se perder o alvo, o inimigo busca a última posição conhecida. Encerrada a busca, retorna à área de patrulha. Atualize rotas por necessidade e escalone recálculos em vez de resolver todos os inimigos a cada frame. [Pathfinding no Roblox](https://create.roblox.com/docs/characters/pathfinding)

O Guardião inicia o encontro quando o jogador cruza a entrada da arena. Ao derrotá-lo, o servidor libera a extração. Ataque de área deve marcar o chão com tempo suficiente em um dispositivo de referência. Espere a última janela de dano terminar antes de confirmar a conclusão do encontro. Criatura mutante, sentinela pesada, armaduras, escudos e drones entram após o recorte inicial.

## Autoridade e resultado da tentativa

O cliente comunica ataque ou esquiva e apresenta feedback imediato. O servidor verifica que o jogador está ativo na expedição, que o equipamento está disponível, que o cooldown e a resistência permitem a ação e que a geometria do golpe é válida. O servidor calcula alvos, dano, estado de vida e crédito de derrota. Especifique as regras do ataque e da troca de estado junto dos casos de teste.

A morte fecha a tentativa para o jogador, limpa melhorias e remove a mochila não extraída. O retorno preserva equipamentos permanentes, pesquisas, missões e fábrica. A desconexão sem confirmação de extração encerra a tentativa no MVP. Se a confirmação já estiver em andamento, a persistência resolve a operação pelo ID antes de decidir o estado. Ver [geração e extração](PROCEDURAL_GENERATION.md), [rede](NETWORKING.md) e [modelo de dados](DATA_MODEL.md).
