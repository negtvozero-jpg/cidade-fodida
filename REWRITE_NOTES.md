# Cidade Fodida MVP — reestruturação

## Filosofia preservada

O jogo continua sendo presencial e social: o app organiza fases, ações privadas, pistas imperfeitas e consequências; a dedução deve acontecer entre os jogadores, não pela tela.

## Arquitetura

- `server/src/config.js`: ajustes centrais de tempos, energia, microgames, pistas, efeitos e sabotagens.
- `server/src/constants.js`: enums e protocolo compartilhado.
- `server/src/data/*`: definições de papéis, ações, mapa, efeitos e sabotagens.
- `server/src/game/*`: sala, fases, sorteio de papéis, resolução de ações, votação, vitória, efeitos e snapshots.
- `server/src/clues/*`: contexto, templates, geração e seleção final de pistas.
- `server/src/messages.js`: única fonte de mensagens públicas/privadas.
- `client/src/main.js`: consome snapshot, atualiza Rive e envia comandos.

## Microgame score

O servidor aceita `microgameScore` de 0 a 4:

- 0: falha crítica
- 1: sucesso
- 2: sucesso médio
- 3: sucesso bom
- 4: sucesso crítico

Se o Rive ainda só emitir `pass/fail`, o client converte `pass` em 3 e `fail` em 0.

## Ciclo

`LOBBY → DAY curto inicial → DAY_RESULT → NIGHT → NIGHT_RESULT → DAY → DAY_RESULT...`

A votação abre no dia quando `phaseProgress <= 40` e nunca abre no primeiro dia.

## Novos sistemas

- efeitos no jogador: paranoia, assombrado/maldição;
- indicadores públicos de eventos ativos;
- sabotagens: apagão, microgames difíceis, maldição;
- obsessor;
- caçador de recompensas;
- possuído;
- pistas selecionadas por prioridade e limite por jogador.
