# Zap Business Flow — Especificação de design

- **Data:** 2026-11-08
- **Status:** aprovado pela dona do projeto ("Faça tudo") — sem revisões intermediárias
- **Repositório:** `sabrisilvahbr-debug/Gabriel-Rios-Haddad`
- **Deploy:** Vercel (plano Pro) + Railway (só para o WhatsApp)

## 1. Objetivo

Vender criação de sites para empresas locais que ainda não têm site. O sistema:

1. encontra empresas sem site numa cidade e num ramo (Google Maps, via Apify);
2. gera uma **prévia de site** pronta para cada empresa, com os dados públicos dela;
3. manda a primeira mensagem pelo WhatsApp da dona do sistema, com o link da prévia, **em ritmo seguro**;
4. responde aos retornos com IA (Gemini) e passa a conversa para a dona quando há interesse real;
5. quando a empresa compra, a **prévia vira o site oficial** no domínio dela, hospedado no mesmo app.

Usuária única: a dona do sistema ("a agência"). Volume alvo: **até 20 empresas novas por dia**.

### Critérios de sucesso

1. Uma busca "ramo + cidade" gera, sem intervenção, empresas **sem site, abertas e com celular**, cada uma com prévia pronta em poucos minutos.
2. A prévia fica bonita no celular, mostra dados reais (nome, endereço, horário, nota, fotos com crédito) e tem uma faixa "Prévia criada por {agência}" com botão para falar com a agência.
3. O envio respeita: limite diário (padrão 20), janela de horário (padrão seg–sáb, 9h–18h, horário de Brasília), intervalo aleatório entre envios (padrão 4–12 min) e **nunca** reenvia para quem pediu para sair.
4. A IA responde em até ~2 minutos, em mensagens curtas, em português, **sem inventar preço**, e passa para a dona quando a empresa quer fechar, negociar ou falar com uma pessoa.
5. Publicar exige domínio verificado e fotos autorizadas; o site publicado não tem faixa de prévia e pode aparecer no Google.

### Fora do escopo (YAGNI)

Multiusuário, cobrança/pagamentos, e-mail, vários números de WhatsApp, editor visual de arrastar, blog nos sites, API oficial do WhatsApp (a camada `src/lib/whatsapp/` isola o provedor para uma troca futura).

## 2. Decisões tomadas com a dona

| Decisão | Escolha |
|---|---|
| Ordem | Fase 1 (prospecção + prévias), Fase 2 (WhatsApp), Fase 3 (IA) — todas entregues agora |
| Prévia depois da venda | Vira o site oficial, no domínio da empresa |
| Volume | Até 20 empresas por dia |
| IA | Gemini |
| Fonte de dados | Apify (Google Maps Scraper) + modelos prontos por ramo (opção A) |

Riscos aceitos e mitigados: termos do Google sobre coleta (quem coleta é o Apify), termos do WhatsApp sobre automação (ritmo lento, mensagens personalizadas, opt-out, número separado recomendado).

## 3. Arquitetura

Um único app **Next.js 16** (App Router, TypeScript, Tailwind CSS 4) na **Vercel Pro**.

| Peça | Papel |
|---|---|
| Painel (`/painel/**`) | Só a dona, com senha. Buscas, empresas, editor do site, WhatsApp, configurações |
| Prévias (`/s/[slug]`) | Site da empresa com faixa de prévia, `noindex` |
| Sites oficiais | Domínio da empresa apontado para o app; o `proxy.ts` reescreve para `/dominio/[host]` |
| Postgres (Neon, pelo Marketplace da Vercel) | Dados. ORM: Drizzle. Driver `neon-http` em produção, **PGlite** em testes e desenvolvimento |
| Vercel Blob | Fotos enviadas pela empresa |
| Apify `compass~crawler-google-places` | Busca no Google Maps, com filtro "só sem site" |
| Gemini (`gemini-3.8-flash`, configurável) | Textos dos sites e respostas no WhatsApp, sempre em JSON estruturado |
| Evolution API v2 (Railway) | Conexão do WhatsApp por QR code, envio e recebimento (webhook) |
| Vercel Cron (a cada minuto) | `/api/cron/tick`: fila de envio, follow-up, respostas da IA, verificação de domínios |

### Roteamento por domínio (`src/proxy.ts`)

- Host do app: qualquer valor em `APP_HOSTS` (lista separada por vírgula), `localhost` ou `*.vercel.app` → app normal.
- Qualquer outro host → reescreve o caminho para `/dominio/{host}{caminho}` (site oficial). Só `/` existe; o resto dá 404 do site. `robots.txt` e `sitemap.xml` são tratados por rotas que leem o host.
- `/painel/**` sem sessão válida → redireciona para `/login?next=…`.

### Autenticação

Senha única em `ADMIN_PASSWORD`. Login cria cookie `zbf_session` (JWT HS256 com `SESSION_SECRET`, 30 dias, `httpOnly`, `secure`, `sameSite=lax`). O proxy protege as páginas; **toda server action e rota do painel confere a sessão de novo**. Comparação de senha e segredos em tempo constante; atraso de 500 ms em falha de login.

## 4. Modelo de dados

Todas as datas em `timestamptz`. IDs `uuid` (`gen_random_uuid()`).

**`settings`** (linha única, `id = 1`)

| Campo | Padrão | Uso |
|---|---|---|
| `agency_name` | `''` | Nome na faixa da prévia e nas mensagens |
| `agency_whatsapp` | `''` | E.164; botão "Quero este site" e avisos de interesse |
| `include_landlines` | `false` | Importar empresas só com telefone fixo |
| `default_max_results` | `30` | Quantidade padrão por busca (máx. 100) |
| `outreach_enabled` | `false` | Liga o envio automático da fila |
| `daily_limit` | `20` | Máximo de primeiros contatos + follow-ups por dia |
| `window_days` | `'1,2,3,4,5,6'` | Dias permitidos (0 = domingo) |
| `window_start_hour` / `window_end_hour` | `9` / `18` | Janela de envio (horário de Brasília) |
| `min_interval_min` / `max_interval_min` | `4` / `12` | Intervalo aleatório entre envios |
| `message_templates` | 3 variações | Primeira mensagem (sorteada) |
| `follow_up_enabled` | `false` | Um único lembrete |
| `follow_up_after_days` | `3` | Dias sem resposta antes do lembrete |
| `follow_up_template` | texto | Lembrete |
| `ai_replies_enabled` | `false` | Liga as respostas da IA |
| `ai_max_replies` | `8` | Respostas da IA por conversa antes de passar para a dona |
| `offer_text` | `''` | Oferta (preço, o que inclui, prazo). Única fonte de preços para a IA |

**`searches`**: `id`, `term`, `location`, `max_results`, `status` (`running` · `succeeded` · `imported` · `failed`), `apify_run_id`, `apify_dataset_id`, `found_count`, `imported_count`, `skipped_count`, `error`, `created_at`, `finished_at`.

**`businesses`**: `id`, `search_id`, `place_id` (único), `name`, `category`, `niche`, `address`, `neighborhood`, `city`, `state`, `phone_display`, `phone_e164`, `phone_is_mobile`, `wa_jid`, `whatsapp_status` (`unknown` · `yes` · `no`), `rating`, `reviews_count`, `maps_url`, `opening_hours` (jsonb `[{day, hours}]`), `image_urls` (jsonb), `description`, `status`, `ai_paused`, `ai_reply_count`, `last_outbound_at`, `last_inbound_at`, `opted_out_at`, `notes`, `created_at`, `updated_at`.

Status da empresa: `nova` → `previa_pronta` → `na_fila` → `contatada` → `respondeu` → `interessada` → `cliente`; saídas: `descartada`, `nao_contatar`, `sem_whatsapp`.

**`sites`**: `id`, `business_id` (único), `slug` (único), `niche`, `content` (jsonb `SiteContent`), `photos` (jsonb `[{url, credit, source: 'google'|'upload', authorized}]`), `status` (`gerando` · `previa` · `publicado`), `custom_domain` (único, opcional), `domain_status` (`nenhum` · `pendente` · `ativo` · `erro`), `domain_error`, `generation_source` (`ia` · `padrao`), `generated_at`, `published_at`, `created_at`, `updated_at`.

**`messages`**: `id`, `business_id`, `direction` (`out` · `in`), `kind` (`primeiro_contato` · `follow_up` · `ia` · `manual` · `sistema` · `recebida` · `auto_resposta`), `body`, `wa_message_id` (único quando existe), `status` (`agendada` · `enviada` · `erro` · `cancelada` · `recebida`), `error`, `sent_at`, `created_at`. **A fila de envio são as mensagens `out` com status `agendada`.**

**`app_state`** (linha única): `tick_locked_until`, `wa_connection_state`, `wa_last_qr`, `wa_last_qr_at`, `sent_day` (AAAA-MM-DD em Brasília), `sent_count`, `next_send_after`, `last_domain_check_at`.

**`blocked_phones`**: `phone_hash` (sha256 do E.164, chave), `created_at`. Quem pediu para sair nunca volta, nem se for apagado e reaparecer numa busca.

**`events`**: `id`, `type`, `business_id`, `message`, `created_at` — histórico mostrado no painel.

### `SiteContent` (validado com zod)

| Campo | Regra |
|---|---|
| `heroTitle` | ≤ 80 caracteres |
| `heroSubtitle` | ≤ 160 |
| `about` | ≤ 700 |
| `services` | 3 a 6 itens `{title ≤ 50, description ≤ 160}` |
| `highlights` | 3 a 4 frases ≤ 60 |
| `ctaText` | ≤ 40 |
| `seoDescription` | ≤ 160 |

## 5. Fluxo 1 — Busca e importação (Fase 1)

1. Painel → Buscas → ramo (ex.: "barbearia"), cidade (ex.: "Campinas, SP") e quantidade.
2. A server action cria a busca (`running`) e inicia o Apify (`POST /v2/acts/{actor}/runs`) com:
   `searchStringsArray: [ramo]`, `locationQuery: "{cidade}, Brasil"`, `maxCrawledPlacesPerSearch`, `language: "pt-BR"`, `countryCode: "br"`, `website: "withoutWebsite"`, `skipClosedPlaces: true`, `scrapePlaceDetailPage: true`, `maxImages: 6`, `maxReviews: 0`, e um webhook avulso (`ACTOR.RUN.SUCCEEDED`, `FAILED`, `ABORTED`, `TIMED_OUT`) para `/api/webhooks/apify?token={APIFY_WEBHOOK_SECRET}`.
3. O webhook (ou o botão "Atualizar", que consulta `GET /v2/actor-runs/{id}`) baixa os itens do dataset e importa, em segundo plano (`after()`), descartando:
   - quem tem site, está fechado ou não tem telefone;
   - telefone fixo (salvo se `include_landlines`);
   - `place_id` já importado;
   - telefone na lista de bloqueio.
4. Para cada empresa nova: detecta o ramo pela categoria, cria o site (`gerando`), pede os textos ao Gemini (3 em paralelo) e marca `previa` / `previa_pronta`. Se o Gemini falhar, usa os textos padrão do ramo (`generation_source = padrao`) — **a prévia sai de qualquer jeito**.
5. A busca termina como `imported`, com as contagens. Repetir o webhook não duplica nada.

### Telefones (Brasil)

Normaliza para E.164 (`+55` + DDD + número). Celular = 11 dígitos nacionais com o terceiro dígito `9`. Ao procurar uma empresa por número vindo do WhatsApp, tenta também a variante sem o nono dígito (alguns JIDs antigos não têm o 9).

### Ramos e temas

`alimentacao`, `beleza`, `saude`, `automotivo`, `pet`, `casa`, `fitness`, `varejo`, `geral`. Cada ramo tem palavras-chave de categoria, paleta, fonte de título (Poppins, Playfair Display ou Inter), ícones de serviço e textos padrão.

## 6. Fluxo 2 — Sites (Fase 1)

- **`SiteView`** (componente de servidor, sem estado) monta: cabeçalho, destaque com foto, sobre, serviços, diferenciais, avaliação (nota, quantidade e link "Ver no Google" — os textos das avaliações não são copiados), fotos com crédito, horário, localização ("Como chegar"), contato (WhatsApp da empresa, ou "Ligar" se for fixo) e rodapé.
- **Prévia** `/s/[slug]`: faixa fixa "Prévia criada por {agência} para {empresa}" + botão "Quero este site" (WhatsApp da agência). `robots: noindex, nofollow` e cabeçalho `X-Robots-Tag`. Se o site já estiver publicado com domínio, redireciona para o domínio.
- **Site oficial** `/dominio/[host]`: procura `custom_domain` (com ou sem `www.`) e `status = publicado`. Sem faixa, indexável, `canonical` no domínio. Se o site foi despublicado, mostra "Site em manutenção".
- **Fotos:** na prévia aparecem as do Google (crédito "Foto: Google Maps") e as enviadas. No site oficial só aparecem as **autorizadas**. Upload: JPG, PNG ou WebP até 5 MB, no Vercel Blob.
- **Editor** (`/painel/empresas/[id]`): textos, ramo/tema, fotos (autorizar, remover, enviar), "Gerar textos de novo com IA", link da prévia.

## 7. Fluxo 3 — Publicação com domínio (Fase 1)

1. A dona digita o domínio. Ele é normalizado (minúsculas, sem `http://`, sem caminho, sem `www.`, convertido para punycode) e validado.
2. Server action: `POST /v10/projects/{VERCEL_PROJECT_ID}/domains` para o domínio e para `www.{domínio}` com redirecionamento para o principal. Status `pendente`.
3. Instruções de DNS: registro **A** `@` → IP recomendado pela Vercel (`GET /v6/domains/{d}/config`, padrão `76.76.21.21`); **CNAME** `www` → CNAME recomendado (padrão `cname.vercel-dns.com`).
4. "Verificar agora" (e o cron a cada 10 min): `misconfigured = false` → `ativo`.
5. **Publicar** só com domínio `ativo` e todas as fotos do Google autorizadas ou removidas. Publicar marca o site `publicado` e a empresa `cliente`. "Despublicar" volta para `previa`. "Remover domínio" apaga na Vercel.
6. `robots.txt`/`sitemap.xml`: no host do app, bloqueia `/s/` e `/painel`; no domínio da empresa, libera tudo e lista `/`.

## 8. Fluxo 4 — WhatsApp (Fase 2)

### Conexão

Evolution API v2 hospedada no Railway. Painel → WhatsApp → "Conectar": cria a instância (`POST /instance/create`, `integration: WHATSAPP-BAILEYS`, ignora "já existe"), configura o webhook (`POST /webhook/set/{instância}` com `MESSAGES_UPSERT`, `CONNECTION_UPDATE`, `QRCODE_UPDATED` e o cabeçalho `x-webhook-secret`) e mostra o QR code (`GET /instance/connect/{instância}`). A página consulta o estado a cada 3 s até `open`. "Desconectar" = `DELETE /instance/logout/{instância}`.

### Fila e ritmo

- "Enviar primeira mensagem" (uma empresa) ou "Colocar na fila todas as prévias prontas". Cria a mensagem `agendada` com uma variação sorteada do modelo; a empresa fica `na_fila`.
- Variáveis dos modelos: `{empresa}`, `{link}`, `{agencia}`, `{cidade}`, `{ramo}`. Todo modelo padrão termina com "é só responder SAIR".
- **Tick (cron a cada minuto, `Authorization: Bearer {CRON_SECRET}`)**, protegido por trava em `app_state.tick_locked_until`:
  1. **Envio:** só se `outreach_enabled`, WhatsApp `open`, dentro da janela, abaixo do limite do dia e depois de `next_send_after`. Pega a mensagem agendada mais antiga, confere se o número tem WhatsApp (`POST /chat/whatsappNumbers`, guarda o `jid`; sem WhatsApp → `sem_whatsapp` e mensagem `cancelada`), envia (`POST /message/sendText`), marca `enviada` e `contatada`, soma no contador do dia e sorteia o próximo intervalo. **No máximo uma mensagem por minuto.**
  2. **Follow-up** (se ligado): empresas `contatada` sem resposta há `follow_up_after_days` e sem lembrete → agenda um único lembrete.
  3. **Respostas da IA** (Fase 3).
  4. **Domínios:** a cada 10 min, verifica os `pendente`.

### Recebimento (`/api/webhooks/whatsapp`, confere `x-webhook-secret`)

- `connection.update` → estado da conexão; `qrcode.updated` → último QR.
- `messages.upsert`: ignora grupos e status. Acha a empresa pelo número (com as variantes do nono dígito). Desconhecido → ignora.
  - `fromMe` que **não** é uma mensagem nossa (id ou mesmo texto nos últimos 5 min) → a dona respondeu pelo celular: grava como `manual` e **pausa a IA** daquela conversa.
  - Mensagem da empresa → grava `recebida`, atualiza `last_inbound_at`, `contatada` → `respondeu`.
  - **Pedido de saída** (SAIR, PARAR, PARE, STOP, CANCELAR, REMOVER, DESCADASTRAR, ou frases como "não tenho interesse", "não quero", "pare de mandar", "me tira da lista") → `nao_contatar`, telefone na lista de bloqueio, cancela as agendadas, manda uma única confirmação educada.
  - **Resposta automática** (chega até 20 s depois do nosso envio e parece saudação automática: "mensagem automática", "obrigado pelo contato", "em breve retornaremos", "horário de atendimento"…) → grava como `auto_resposta` e **não conta como resposta**.

## 9. Fluxo 5 — Respostas com IA (Fase 3)

- No tick: até 3 conversas por minuto com `ai_replies_enabled`, IA não pausada, status `contatada`/`respondeu`/`interessada`, última mensagem recebida mais nova que a última enviada e **com pelo menos 45 s** (junta mensagens em sequência), e abaixo de `ai_max_replies`.
- O Gemini recebe: dados da empresa, link da prévia, `offer_text`, as últimas 20 mensagens e as regras:
  - português do Brasil, no máximo 3 frases, tom simpático e profissional;
  - preços e condições **só** do `offer_text`; se não estiver lá, diz que a {agência} passa os detalhes;
  - se perguntarem se é robô, diz que é a assistente virtual da {agência};
  - sem pressão, sem desconto inventado;
  - interesse em fechar, pedido de pessoa ou negociação → passa para a dona.
- Saída JSON: `{reply, intent: duvida|interessado|quer_humano|sem_interesse|outro, handoff}`.
- Depois de enviar: `interessado`, `quer_humano` ou `handoff` → pausa a IA, empresa `interessada` e **aviso no WhatsApp da agência** com o link do painel. `sem_interesse` → `nao_contatar` + bloqueio. Ao atingir `ai_max_replies` → passa para a dona.
- Painel: conversa completa, "Pausar IA"/"Retomar IA" e caixa para mandar mensagem manual (também pausa a IA).

## 10. Erros, segurança e privacidade

- Chamadas externas com tempo limite (Apify/Evolution/Vercel 30 s, Gemini 60 s) e erros gravados (`searches.error`, `messages.error`, `sites.domain_error`, `events`). Webhooks respondem rápido e processam com `after()`.
- Idempotência: `place_id`, `slug`, `custom_domain` e `wa_message_id` únicos; webhooks repetidos não duplicam.
- Segredos só em variáveis de ambiente, comparados em tempo constante. Server actions sempre conferem a sessão.
- LGPD: só dados públicos de empresas; "Excluir empresa" apaga empresa, site e mensagens; a lista de bloqueio guarda só o hash do telefone.
- Custos: máximo de 100 resultados por busca; Gemini só na importação, no "gerar de novo" e nas respostas.

## 11. Testes

- **Unitários (Vitest):** telefone, ramo, mapeamento do Apify, slug, conteúdo do site e plano B, modelos de mensagem, saída e resposta automática, janela e ritmo (relógio fixo), leitura do webhook da Evolution, domínio e DNS.
- **Integração (Vitest + PGlite com as migrações reais):** importação completa a partir de um dataset de exemplo, tick de envio (limites, janela, sem WhatsApp), webhook de recebimento (saída, a dona assumindo, resposta automática), respostas da IA (Gemini simulado), publicação (API da Vercel simulada).
- **Build e tela:** `next build`, `next start` com PGlite e capturas da prévia no celular e no computador.

## 12. Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Postgres (Neon). `pglite:./.data/dev` em desenvolvimento |
| `ADMIN_PASSWORD`, `SESSION_SECRET` | sim | Login do painel |
| `APP_URL` | sim | URL pública do app (links das prévias e webhooks) |
| `APP_HOSTS` | não | Hosts extras do painel, separados por vírgula |
| `APIFY_TOKEN`, `APIFY_WEBHOOK_SECRET` | Fase 1 | Busca |
| `APIFY_ACTOR` | não | Padrão `compass~crawler-google-places` |
| `GEMINI_API_KEY` | Fase 1 | Textos e respostas |
| `GEMINI_MODEL` | não | Padrão `gemini-3.8-flash` |
| `BLOB_READ_WRITE_TOKEN` | Fase 1 | Upload de fotos (criada pela Vercel ao ligar o Blob) |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Fase 1 | Domínios dos clientes |
| `CRON_SECRET` | Fase 2 | Protege o cron |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WHATSAPP_WEBHOOK_SECRET` | Fase 2 | WhatsApp |

As migrações do banco rodam sozinhas no `build` quando `DATABASE_URL` existe.

## 13. Riscos

| Risco | Mitigação |
|---|---|
| Banimento do número | Ritmo lento, limite diário, mensagens variadas, opt-out imediato, número separado |
| Coletor do Google Maps quebrar | Apify mantém; ator trocável por `APIFY_ACTOR` |
| Termos do Google | Escolha consciente da dona; avaliações não copiadas; fotos com crédito e autorização para publicar |
| Mudanças no WhatsApp afetarem a Evolution API | Manter a imagem atualizada no Railway; camada isolada em `src/lib/whatsapp/` |
| Respostas da IA erradas | Regras rígidas, oferta como única fonte de preços, limite de respostas, pausa automática e manual |
