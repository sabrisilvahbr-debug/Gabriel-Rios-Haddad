# Colocar no ar de graça (modo celular)

Neste modo, nada é pago:

- **Vercel (plano Hobby):** painel, prévias e sites.
- **Neon (plano Free):** banco de dados.
- **Apify e Gemini:** planos gratuitos, para a busca e os textos.
- **WhatsApp:** o seu próprio celular. O painel deixa cada mensagem pronta, você toca em **Enviar no WhatsApp** e manda.

O plano Hobby da Vercel é para uso pessoal e não comercial. Quando a agência começar a faturar, passe para o Pro (veja [deploy.md](deploy.md)).

## 1. Publicar na Vercel

1. Entre em [vercel.com](https://vercel.com) com o GitHub e clique em **Add New → Project**.
2. Escolha o repositório **Gabriel-Rios-Haddad** e clique em **Deploy**. Não mude as configurações de build.

## 2. Banco de dados

1. No projeto, abra a aba **Storage** e clique em **Create Database**.
2. Escolha **Neon** e o plano **Free**, e ligue o banco ao projeto.

As tabelas são criadas sozinhas a cada deploy.

## 3. Variáveis

Em **Settings → Environment Variables**, cadastre:

| Variável | Valor |
| --- | --- |
| `ADMIN_PASSWORD` | A senha do painel |
| `SESSION_SECRET` | Um texto aleatório com 32 caracteres ou mais |
| `APP_URL` | O endereço do projeto, ex.: `https://gabriel-rios-haddad.vercel.app` |
| `APIFY_TOKEN` | Em apify.com, na parte **API & Integrations** das configurações |
| `APIFY_WEBHOOK_SECRET` | Outro texto aleatório |
| `GEMINI_API_KEY` | Em [aistudio.google.com](https://aistudio.google.com), **Get API key** |

Opcionais: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` e `VERCEL_TEAM_ID` para ligar os domínios dos clientes (veja a seção 5 de [deploy.md](deploy.md)). O Vercel Blob, na aba Storage, serve para enviar fotos suas para os sites.

Depois, em **Deployments**, abra o menu (⋯) do último deploy e clique em **Redeploy**.

## 4. No dia a dia

1. **Buscas:** escolha o ramo e a cidade. As empresas sem site aparecem com uma prévia pronta.
2. **Empresas:** confira as prévias e toque em **Colocar na fila as prévias prontas**.
3. **Enviar:** a página mostra as mensagens do dia, até o seu limite diário. Toque em **Enviar no WhatsApp**: o WhatsApp abre com o texto e você só aperta enviar. O painel marca como enviada.
4. **Respostas:** quando a empresa responder no WhatsApp, abra a página dela e cole a mensagem em **A empresa respondeu?** Depois toque em **Sugerir resposta com IA**, ajuste se quiser e envie do mesmo jeito.
5. **Pedido para sair:** se a pessoa pedir para não receber mais mensagens, o painel bloqueia o número quando você cola a resposta dela.

Espere alguns minutos entre um envio e outro. Muitas mensagens seguidas para quem não te conhece fazem o WhatsApp desconfiar do número.

## Depois: envio automático

Para o painel enviar e responder sozinho, é preciso um servidor da Evolution API ligado o tempo todo (cerca de US$ 5 a 10 por mês no Railway). Quando quiser, siga a seção 6 de [deploy.md](deploy.md). As páginas de envio pelo celular continuam funcionando.
