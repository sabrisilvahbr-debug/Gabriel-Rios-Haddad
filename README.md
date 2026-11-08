# Zap Business Flow

Encontra empresas da sua região que não têm site, monta uma prévia de site para cada uma, manda a primeira mensagem pelo seu WhatsApp, responde com IA quem retornar e publica o site no domínio do cliente quando você fecha o negócio.

## Como funciona

1. **Busca.** Você escolhe um ramo e uma cidade (ex.: "barbearia" em "Campinas, SP"). A Apify procura no Google Maps empresas abertas e sem site, e o app fica com as que têm celular.
2. **Prévia.** Para cada empresa encontrada, o app monta uma página com nome, endereço, horários, nota no Google, fotos e textos escritos pelo Gemini. O visual muda conforme o ramo. A prévia fica em `/s/nome-da-empresa`, com a faixa "Prévia" e fora do Google.
3. **WhatsApp.** As empresas que você colocar na fila recebem uma mensagem com o link da prévia. O envio é lento de propósito: uma mensagem por vez, em horário comercial, com intervalo sorteado entre elas e no máximo 20 por dia (você ajusta).
4. **Respostas.** Quando a empresa responde, a IA conversa usando a sua oferta. Se a pessoa pedir para parar, o número é bloqueado para sempre. Se houver interesse em fechar, a IA passa a conversa para você e avisa no seu WhatsApp. Se você responder pelo celular, a IA para naquela conversa.
5. **Site oficial.** Fechou? Você liga o domínio do cliente no painel, ele aponta o DNS, o painel confere sozinho e você clica em "Publicar site". A mesma página vira o site oficial, sem a faixa de prévia.

Tudo é controlado pelo painel em `/painel`, protegido por senha.

## O que você vai precisar

| Serviço | Para quê | Custo aproximado |
| --- | --- | --- |
| Vercel Pro | Hospedar o app e os sites | US$ 20/mês |
| Neon (pela Vercel) | Banco de dados | Plano grátis para começar |
| Vercel Blob | Fotos que você enviar | Incluído no Pro neste volume |
| Apify | Buscar empresas no Google Maps | ~US$ 0,01 por empresa encontrada |
| Gemini (Google AI Studio) | Textos dos sites e respostas | Centavos de dólar por mês neste volume |
| Railway + Evolution API | Ligar o app ao seu WhatsApp | ~US$ 5 a 10/mês |
| Domínio do cliente | Site oficial | Pago pelo cliente (ex.: Registro.br) |

O plano grátis (Hobby) da Vercel não serve: ele proíbe uso comercial e só roda o agendador uma vez por dia, e o app precisa dele a cada minuto para enviar as mensagens.

## Colocar no ar

Siga o passo a passo em [docs/deploy.md](docs/deploy.md).

## Cuidados com o WhatsApp

Mensagem em massa para quem não te conhece pode levar o número a ser banido pelo WhatsApp. Para reduzir o risco:

- Use um número só para isso, não o seu pessoal.
- Comece com poucas mensagens por dia (10 a 20) e aumente devagar.
- Mantenha o intervalo sorteado entre envios (padrão: 4 a 12 minutos).
- Escreva mensagens diferentes nos modelos de primeira mensagem. O app sorteia um para cada empresa.
- Respeite quem pede para parar. O app já faz isso: bloqueia o número e não manda mais nada.

## Rodar no seu computador (opcional)

Precisa de Node.js 20.9 ou mais novo.

```bash
npm install
cp .env.example .env.local   # edite ADMIN_PASSWORD e SESSION_SECRET
DATABASE_URL=pglite:./.data/dev npm run db:migrate
npm run dev
```

No Windows (PowerShell), troque a terceira linha por:

```powershell
$env:DATABASE_URL="pglite:./.data/dev"; npm run db:migrate
```

Abra http://localhost:3000/login. O banco local fica na pasta `.data/` e não precisa de instalação.

Busca, IA, fotos, domínios e WhatsApp só funcionam com as chaves de cada serviço no `.env.local`. Sem elas, o painel mostra o que falta em Configurações.

## Testes

```bash
npm test           # testes automatizados
npm run typecheck  # checagem de tipos
```

## Estrutura

- `src/app/painel` — telas do painel
- `src/app/s/[slug]` — prévias públicas
- `src/app/dominio/[host]` — sites oficiais nos domínios dos clientes
- `src/app/api` — webhooks da Apify e do WhatsApp, e o agendador (`/api/cron/tick`)
- `src/lib` — regras do negócio (busca, sites, domínios, WhatsApp, IA)
- `drizzle/` — migrações do banco, aplicadas sozinhas a cada deploy
- `docs/superpowers` — especificação e plano de implementação
