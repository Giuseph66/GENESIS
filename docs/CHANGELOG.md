# Changelog

## Em desenvolvimento

### 2026-11-24

- Nova interface: cartões de objetivo, carga e energia, menu com teclas, cartões de máquina e tela de carregamento.
- Construção com câmera de drone, rotação por scroll, portas visíveis e esteiras por arrasto.
- Menu de botões, ajuda completa e ECHO ativo desde o início.
- Mouse livre na primeira pessoa com painéis abertos ou `Tab`.
- Nova iluminação, cores e cenário do posto.
- Grupo do mundo com convites, permissões por ação e progresso coletivo.

### 2026-11-23

- Organizado o briefing em 14 documentos, incluindo o README como índice.
- Detalhados o ciclo do primeiro capítulo, a fábrica inicial, a expedição e suas condições de morte e extração.
- Registradas propostas de arquitetura, contratos de rede, persistência, cronograma e critérios de validação.
- Configurados roblox-ts e Rojo. Cliente e servidor executaram a revisão sincronizada em um place local no Roblox Studio.
- Posto inicial definido em `assets/installation.model.json` e salvo no place, visível no Studio sem iniciar o jogo.
- Mundo aberto gerado por semente em volta dos jogadores, com iluminação diurna, no lugar da sala fechada.
- Coleta condicionada a ECHO, com inventário por jogador e depósitos que não esgotam.
- Construção no grid com prévia, rotação, custo, reposicionamento e remoção.
- Automação: gerador restaurável, veios, receitas, esteiras, energia, armazém e painel de máquina.
- Combate e expedições por seed: três inimigos, Guardião, melhorias, morte e extração.
- Duas pesquisas, missões, falas de ECHO, diário e conclusão do Capítulo 1.
- Mundo com biomas, montanhas, lagos e jazidas, no lugar da planície inicial.
- Primeira pessoa, corrida, mineração animada, efeitos, marcador de objetivo e ajuda.
- Persistência por mundo com trava de sessão, migração e recibo de extração. DataStore real ainda não testado.
- Testes de domínio em `tests/`, executados com `npm test`.
