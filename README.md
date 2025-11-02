# Grupo-3-Quiz
Quiz multiplayer estilo Kahoot (Host/Jogadores) com Socket.IO, salas por PIN, avatares, timer, revelação de resultados e telas separadas para Quiz e Resultado.

## Deploy (1 clique)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/cibeleteles011/Grupo-3-Quiz)

Este repositório contém um `render.yaml` pronto. Ao clicar no botão acima e autorizar o Render a acessar seu GitHub, o serviço será criado automaticamente.

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/host`
- Porta: Render define `PORT` e o app já usa `process.env.PORT`.

## Rotas (após deploy)

- Host: `/host` (rota padrão `/` redireciona para aqui)
- Jogador: `/join`
- Tela de Quiz do jogador: `/quiz`
- Tela de Resultado do jogador: `/result`

## Fluxo resumido

- Host cria sala em `/host`, recebe PIN, link e QRCode de entrada.
- Jogadores acessam `/join`, escolhem avatar, informam nome e PIN, e são redirecionados para `/quiz`.
- Jogador responde, e quando o Host revela (ou todos respondem), o jogador é redirecionado para `/result` com sua pontuação e pódio Top 5.
- Próxima pergunta enviada pelo Host leva todos de volta para `/quiz`.

## Scripts

- `npm start`: inicia o servidor em `PORT` ou `3001`.

## Stack

- Node.js, Express, Socket.IO, HTML/CSS/JS.
