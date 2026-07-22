# cidade fodida — interface HTML de teste

Interface alternativa para testar o jogo sem Rive.

## Como usar

1. Rode o servidor:

```bash
npm start
```

2. Abra no navegador/celular:

```txt
http://localhost:3000/html.html
```

3. Abra uma aba ou celular por jogador.

## Estrutura

- Tela pública: estado da partida, jogadores, POIs, notícia de noite/dia e fim de jogo.
- Tela privada: energia, mensagem privada, mensagem secundária e botões de ação sem descrição.
- Ficha arrastável: papel, objetivo, habilidades e referência dos arquétipos de minigames.
- Primeiro dia: serve apenas para conferir papel, alinhamento, objetivo e habilidades.
- Transições: escondem ações/votos na tela privada e mostram notícia/resultado na tela pública.
- Fim de jogo: mostra vencedor e nomes dos vencedores quando o servidor envia `winnerNames`.

## Minigames HTML

Os minigames não tentam substituir o Rive final. Eles servem para testar fluxo, score e leitura presencial.

- Investigação: movimento lento e atento.
- Violência: toques rápidos e tensão.
- Ritual: ritmo repetitivo e concentração.
- Manipulação: alternância entre manter e esconder.
- Invasão: coleta com risco; pode enviar `theftValue` para o Ladrão no futuro.
- Vigilância: segurar parado, tensão e espera.
- Recuperação: dormir não abre minigame.

Nenhuma categoria pertence a um papel específico. A função delas é produzir sinais visuais, hesitação, tensão e linguagem corporal, sem entregar automaticamente o papel.
