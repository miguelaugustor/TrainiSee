# Eletivas Escolares

App mobile de capacitação de alunos por meio de eletivas, desenvolvido com React Native + Expo.

## Integrantes

| Nome | RA |
|---|---|
| Miguel Augusto | 00000855209 |
| João Emanuel | 00000855705 |

## Sobre o projeto

O aplicativo permite que a escola ofereça eletivas e acompanhe os alunos. Administradores cadastram, editam e excluem eletivas (com descrição, conteúdo, carga horária e link de vídeo). Alunos consultam as eletivas disponíveis e assistem ao vídeo de apresentação.

## Tecnologias

- React Native + Expo (Expo Router)
- Zustand (estado global)
- React Native Paper (UI Kit)
- TanStack Query (cache e requisições)
- Back4App / Parse (back-end)
- TypeScript

## Funcionalidades

- Login, cadastro e logout
- Perfis de acesso (administrador e aluno)
- CRUD de eletivas
- Busca por título e filtro por área
- Telas Home, Sobre e Equipe

## Como rodar

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```
2. Crie um arquivo `.env` na raiz, com as chaves do Back4App:
3. EXPO_PUBLIC_BACK4APP_APP_ID=seu-application-id
EXPO_PUBLIC_BACK4APP_CLIENT_KEY=sua-client-key

3. Inicie o app:
   ```bash
   npx expo start -c
   ```
4. Abra o QR Code no Expo Go.

## Divisão do trabalho

- **Miguel Augusto:** (preencha: telas, conexão com o back-end, estilização)
- **João Emanuel:** (preencha: telas, conexão com o back-end, estilização)

## Entrega

- App publicado no Expo: (link)
- Vídeo no YouTube: (link)
