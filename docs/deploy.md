# Como colocar o Zap Business Flow no ar

Este guia leva de zero até a primeira mensagem enviada. Reserve uma hora. Você vai criar contas em cinco serviços, copiar algumas chaves para a Vercel e conectar o WhatsApp lendo um QR code.

Ao longo do guia, anote cada valor que aparecer em **negrito com nome de variável** (ex.: `APIFY_TOKEN`). No passo 7 você cola todos de uma vez na Vercel.

## 1. Assinar o Vercel Pro

O app precisa do plano Pro. No plano grátis (Hobby), o deploy falha com a mensagem "Hobby accounts are limited to daily cron jobs", porque o agendador de mensagens roda a cada minuto. Além disso, o Hobby não permite uso comercial.

1. Entre em [vercel.com](https://vercel.com) com a sua conta do GitHub.
2. Crie um time no plano Pro (ou ative o teste grátis do Pro, se aparecer a opção). O Pro custa US$ 20 por mês por pessoa do time.

## 2. Importar o projeto

1. No time Pro, clique em **Add New → Project**.
2. Escolha o repositório **Gabriel-Rios-Haddad** e clique em **Import**.
3. Não mude nada nas configurações de build. Clique em **Deploy**.

O primeiro deploy termina, mas o painel ainda não abre: faltam o banco e as chaves. Isso é esperado.

4. Abra o projeto e vá em **Settings → Domains**. Anote o endereço curto que termina em `.vercel.app` (ex.: `https://zap-business-flow.vercel.app`). Esse é o **`APP_URL`**. Use o endereço curto, não os endereços longos com letras e números que aparecem em cada deploy.

## 3. Banco de dados (Neon)

1. No projeto, abra a aba **Storage** e clique em **Create Database**.
2. Escolha **Neon** e siga as telas (o plano grátis basta para começar). Na última tela, ligue o banco a este projeto.
3. Confira em **Settings → Environment Variables** que apareceu a variável `DATABASE_URL`.

As tabelas são criadas sozinhas a cada deploy.

## 4. Fotos (Vercel Blob)

1. Ainda em **Storage**, clique em **Create** e escolha **Blob**.
2. Se perguntar o tipo de acesso, escolha **Public**: as fotos precisam aparecer nos sites.
3. Ligue o Blob a este projeto. Confira que apareceu a variável `BLOB_READ_WRITE_TOKEN`.

## 5. Chaves dos serviços

### Apify (busca no Google Maps)

1. Crie uma conta em [apify.com](https://apify.com). Dá para começar no plano gratuito, que vem com um crédito mensal pequeno (confira os valores atuais em apify.com/pricing).
2. No console, abra **Settings** e a parte de **API & Integrations**. Copie o **Personal API token**. Esse é o **`APIFY_TOKEN`**.

Cada empresa encontrada custa por volta de US$ 0,01 (com até 6 fotos). Uma busca de 30 empresas fica em torno de US$ 0,30 a 0,40.

### Gemini (textos e respostas)

1. Entre em [aistudio.google.com](https://aistudio.google.com) com uma conta Google.
2. Clique em **Get API key → Create API key**. Esse é o **`GEMINI_API_KEY`**.

O modelo padrão é o `gemini-3.8-flash`. Para usar outro, preencha `GEMINI_MODEL`. Se a IA falhar ou a chave faltar, o site sai com textos-padrão do ramo, e as respostas automáticas ficam paradas.

### Token da Vercel (domínios dos clientes)

O app usa este token para ligar o domínio de cada cliente ao projeto.

1. Abra [vercel.com/account/settings/tokens](https://vercel.com/account/settings/tokens) e clique em **Create Token**.
2. Em **Scope**, escolha o time Pro onde está o projeto. Em validade, escolha a mais longa. Copie o token: esse é o **`VERCEL_API_TOKEN`**.
3. No projeto, em **Settings → General**, copie o **Project ID**: esse é o **`VERCEL_PROJECT_ID`**.
4. Nas configurações do time (**Team Settings → General**), copie o **Team ID**: esse é o **`VERCEL_TEAM_ID`**.

## 6. WhatsApp (Railway + Evolution API)

A Evolution API é o programa que fica ligado ao seu WhatsApp, como o WhatsApp Web. Ela roda no Railway, porque precisa ficar ligada o tempo todo, e a Vercel não faz isso.

Use um número só para a prospecção, não o seu pessoal. Se o WhatsApp banir o número, você não perde o seu.

1. Crie uma conta em [railway.com](https://railway.com) com o GitHub. O plano Hobby é suficiente; este serviço custa em torno de US$ 5 a 10 por mês.
2. Clique em **New Project → Deploy a Template**, procure por **Evolution API** e escolha o template **evolution-api-whatsapp** (Evolution API com Postgres e Redis). Clique em **Deploy**.
3. Quando terminar, cuide do serviço **Evolution API**:
   - Clique com o botão direito nele, escolha **Attach Volume** e use o caminho **`/evolution/instances`**. O volume guarda a sessão do WhatsApp; sem ele, você precisaria ler o QR code de novo a cada reinício.
   - Em **Settings → Networking**, se ainda não houver um endereço público, clique em **Generate Domain**. Copie o endereço com `https://` e sem barra no final: esse é o **`EVOLUTION_API_URL`**.
   - Em **Variables**, copie o valor de `AUTHENTICATION_API_KEY`: esse é o **`EVOLUTION_API_KEY`**.
4. Não atualize a imagem da Evolution API para a versão 2.4 ou mais nova: a partir dela é preciso ativar uma licença. O template usa a 2.3.7, que funciona sem isso.

Você não precisa configurar webhooks na Evolution API. O app faz isso sozinho quando você clica em **Conectar WhatsApp** no painel.

## 7. Variáveis de ambiente na Vercel

No projeto, abra **Settings → Environment Variables** e cadastre as variáveis abaixo, marcando o ambiente **Production**.

Para as senhas e segredos, gere textos aleatórios longos (40 caracteres ou mais), um diferente para cada variável. Pode usar o gerador de senhas do seu navegador ou do seu gerenciador de senhas. Quem tem terminal pode rodar `openssl rand -hex 32`.

| Variável | Valor |
| --- | --- |
| `ADMIN_PASSWORD` | A senha que você vai usar para entrar no painel |
| `SESSION_SECRET` | Texto aleatório com 32 caracteres ou mais |
| `APP_URL` | O endereço curto do passo 2 (ex.: `https://zap-business-flow.vercel.app`), sem barra no final |
| `APIFY_TOKEN` | Do passo 5 |
| `APIFY_WEBHOOK_SECRET` | Texto aleatório |
| `GEMINI_API_KEY` | Do passo 5 |
| `VERCEL_API_TOKEN` | Do passo 5 |
| `VERCEL_PROJECT_ID` | Do passo 5 |
| `VERCEL_TEAM_ID` | Do passo 5 |
| `CRON_SECRET` | Texto aleatório |
| `EVOLUTION_API_URL` | Do passo 6 |
| `EVOLUTION_API_KEY` | Do passo 6 |
| `WHATSAPP_WEBHOOK_SECRET` | Texto aleatório |

`DATABASE_URL` e `BLOB_READ_WRITE_TOKEN` já foram criadas nos passos 3 e 4.

Opcionais:

| Variável | Quando usar |
| --- | --- |
| `GEMINI_MODEL` | Para trocar o modelo do Gemini (padrão: `gemini-3.8-flash`) |
| `EVOLUTION_INSTANCE` | Nome da conexão na Evolution API (padrão: `zapflow`) |
| `APIFY_ACTOR` | Para usar outro coletor do Google Maps na Apify (padrão: `compass~crawler-google-places`) |
| `APP_HOSTS` | Se você abrir o painel por um domínio seu (ex.: `painel.suaagencia.com.br`). Separe vários por vírgula. Nesse caso, ponha esse domínio também em `APP_URL` |

Depois de cadastrar tudo, vá em **Deployments**, abra o menu (⋯) do deploy mais recente e clique em **Redeploy**. Variáveis novas só valem a partir do próximo deploy.

O agendador já vem configurado no projeto (arquivo `vercel.json`): a cada minuto, a Vercel chama o app para enviar a próxima mensagem da fila, responder quem escreveu e conferir domínios. Ele aparece em **Settings → Cron Jobs** e usa o `CRON_SECRET` sozinho; não há nada para configurar.

### Proteção de deploy

Em **Settings → Deployment Protection**, deixe a opção padrão (**Standard Protection**). Não escolha proteger todos os deploys (**All Deployments**): os links das prévias, os avisos da Apify e as mensagens do WhatsApp passariam a cair numa tela de login da Vercel.

## 8. Primeiro acesso

1. Abra o seu `APP_URL` com `/login` no final e entre com a `ADMIN_PASSWORD`.
2. Vá em **Configurações**:
   - Em **Sua agência**, preencha o nome que as empresas vão ver e o seu WhatsApp. Esse número recebe os avisos de interesse e os pedidos do botão "Quero este site" das prévias.
   - Em **Sua oferta**, escreva o preço, o que está incluído, o prazo e a forma de pagamento. A IA só fala de preço com base nesse texto.
   - Revise os modelos de **Primeira mensagem**. Todos precisam ter `{link}`.
   - Clique em **Salvar configurações**. No fim da página, a lista **Integrações** deve estar toda verde. Se algo estiver vermelho, ela mostra qual variável falta.
3. Vá em **WhatsApp** e clique em **Conectar WhatsApp**. No celular do número de prospecção, abra o WhatsApp → **Configurações → Aparelhos conectados → Conectar um aparelho** e leia o QR code.
4. Vá em **Buscas**, preencha **Ramo**, **Cidade** e **Quantidade** e clique em **Buscar empresas**. A busca leva alguns minutos e passa por "Buscando", "Importando" e "Concluída". Se ficar parada em "Buscando" ou "Importando" por mais de 15 minutos, clique em **Atualizar**.
5. Vá em **Empresas**. Abra algumas, confira a prévia em **Abrir prévia** e ajuste os textos se quiser. Depois clique em **Colocar na fila as prévias prontas**.
6. Volte em **Configurações**, marque **Envio automático ligado** e **Respostas da IA ligadas** e salve.

A partir daí, o app manda uma mensagem por vez, dentro dos dias e horários escolhidos (horário de Brasília), até o limite diário. O **Início** mostra quantas saíram hoje, e o **Histórico** registra o que aconteceu.

## 9. Quando uma empresa fechar com você

1. **Fotos.** Fotos do Google só entram no site oficial se a empresa autorizar. Na página da empresa, em **Fotos**, clique em **Marcar autorizada** nas que ela aprovou e remova as outras. Você também pode enviar fotos suas em **Enviar foto**.
2. **Domínio.** O cliente compra o domínio (ex.: no [Registro.br](https://registro.br)). Em **Publicar com domínio próprio**, digite o domínio e clique em **Ligar domínio**.
3. **DNS.** O painel mostra os registros que precisam ser criados no lugar onde o domínio foi comprado. Normalmente são dois: um registro **A** em `@` apontando para `76.76.21.21` e um **CNAME** em `www` apontando para `cname.vercel-dns.com`. Use exatamente o que o painel mostrar.
4. **Verificação.** O DNS leva de alguns minutos a algumas horas para valer. O painel confere sozinho a cada 10 minutos, ou você clica em **Verificar agora**.
5. **Publicação.** Quando o domínio ficar ativo, clique em **Publicar site**. O link da prévia passa a levar para o site oficial, e a empresa vai para a etapa **Cliente**.

## Problemas comuns

**O deploy falha com "Hobby accounts are limited to daily cron jobs".** O projeto está num time Hobby. Mova o projeto para um time Pro (passo 1).

**O painel mostra erro logo ao abrir.** Falta o banco (passo 3) ou alguma variável do passo 7. Depois de corrigir, faça o **Redeploy**.

**A busca não sai de "Buscando" ou "Importando".** Clique em **Atualizar** na busca: o app confere a Apify e termina as prévias que faltarem. Se acontecer em toda busca, o `APP_URL` provavelmente está errado e a Apify não consegue avisar o app que terminou; corrija e faça o Redeploy.

**O QR code não aparece.** Confira o `EVOLUTION_API_URL` (com `https://` e sem barra no final) e o `EVOLUTION_API_KEY`. No Railway, veja se o serviço da Evolution API está ligado e olhe os logs dele.

**As mensagens não saem.** Confira, em ordem: o WhatsApp está conectado; **Envio automático ligado** está marcado; agora está dentro dos dias e horários escolhidos; o limite do dia não foi atingido; há empresas **Na fila**.

**A empresa respondeu e a IA não.** Confira se **Respostas da IA ligadas** está marcado, se a IA não foi pausada naquela conversa e se ela não chegou ao máximo de respostas por conversa. A IA espera cerca de um minuto antes de responder, para juntar mensagens seguidas.

**O domínio não fica ativo.** Confira os registros de DNS no lugar onde o domínio foi comprado. Algumas mudanças levam até 48 horas para valer em todo lugar.
