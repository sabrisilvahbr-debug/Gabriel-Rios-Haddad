# Zap Business Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um app Next.js na Vercel que encontra empresas sem site, gera prévias de site, faz o primeiro contato pelo WhatsApp em ritmo seguro, responde com IA e publica o site oficial no domínio do cliente.

**Architecture:** App único (App Router) com painel protegido por senha, páginas públicas de prévia e site oficial por domínio (roteadas no `src/proxy.ts`), lógica de negócio em `src/lib/**` (funções puras + serviços que usam `getDb()`), integrações HTTP finas (Apify, Gemini, Vercel, Evolution) e um cron por minuto que orquestra a fila.

**Tech Stack:** Next.js 16.4, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM 0.45 (neon-http em produção, PGlite em testes), zod, jose, @vercel/blob, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-zap-business-flow-design.md`

## Global Constraints

- Node ≥ 20.9; Next.js 16 usa `src/proxy.ts` com `export function proxy` (não `middleware.ts`).
- Todo texto de interface e de mensagem em português do Brasil.
- Horários de envio sempre calculados em `America/Sao_Paulo`.
- Padrões: `daily_limit 20`, `window_days '1,2,3,4,5,6'`, `window 9–18`, `interval 4–12 min`, `ai_max_replies 8`, `follow_up_after_days 3`, `default_max_results 30` (máx. 100).
- Gemini: modelo `process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'`, sempre `responseMimeType: 'application/json'` + `responseSchema`.
- Apify: ator `process.env.APIFY_ACTOR ?? 'compass~crawler-google-places'`, `website: 'withoutWebsite'`.
- DNS padrão: A `@` → `76.76.21.21`; CNAME `www` → `cname.vercel-dns.com`.
- Nenhuma server action ou rota do painel roda sem `requireSession()`.
- Sem transações interativas (driver `neon-http`): use comandos únicos e atômicos (`UPDATE … RETURNING`, `ON CONFLICT`).

## Review Focus

1. Telefones estranhos do Google ("+55 (11) 9 8765-4321", "0800 123 4567", ramal) — normaliza o válido, rejeita 0800/0300/curtos. → testes em Task 3.
2. Nomes que geram slug vazio ou repetido (só emoji, duas "Barbearia do Zé" na mesma cidade) — slug `empresa`, sufixo `-2`. → teste em Task 7.
3. Gemini devolvendo texto longo demais (corta) ou não-JSON (usa plano B). → testes em Task 6.
4. Mensagem do WhatsApp vinda de JID sem o nono dígito ou `@lid` sem telefone — casa pela variante ou ignora sem erro. → testes em Task 12.
5. Dois ticks ao mesmo tempo e virada do dia em Brasília (não UTC) — trava impede envio duplo; contador zera à meia-noite de Brasília. → testes em Task 11.

---

### Task 1: Esqueleto do projeto

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/lib/env.ts`, `tests/unit/env.test.ts`

**Interfaces — Produces:**
- `env(name: string): string` (lança `MissingEnvError` com mensagem em português), `optionalEnv(name): string | undefined`, `appUrl(): string` (sem barra final; cai para `https://${VERCEL_PROJECT_PRODUCTION_URL}`), `integrationStatus(): { key; label; ok; missing: string[] }[]` com grupos `banco, login, apify, gemini, fotos, dominios, whatsapp, cron`.

- [ ] Test `integrationStatus marks group missing`: com só `DATABASE_URL` definido, `banco.ok === true`, `apify.ok === false`, `apify.missing` contém `APIFY_TOKEN`.
- [ ] Test `appUrl strips trailing slash`: `APP_URL=https://x.vercel.app/` → `https://x.vercel.app`.
- [ ] Run `npx vitest run tests/unit/env.test.ts` → FAIL; implement; → PASS. `npx tsc --noEmit` limpo.
- [ ] Commit `chore: esqueleto Next.js 16 + Vitest`.

### Task 2: Banco de dados

**Files:** Create `src/lib/db/schema.ts`, `src/lib/db/client.ts`, `src/lib/db/settings.ts`, `drizzle.config.ts`, `drizzle/*` (gerado), `scripts/migrate.mjs`, `tests/helpers/db.ts`, `tests/integration/db.test.ts`

**Interfaces — Produces:**
- Tabelas da spec §4: `settings, searches, businesses, sites, messages, appState, blockedPhones, events` + tipos `Settings, Search, Business, Site, Message, AppState` (`$inferSelect`).
- `getDb(): DB` (`DATABASE_URL` com prefixo `pglite:` → PGlite; senão neon-http), `setDbForTests(db: DB | null)`.
- `getSettings(): Promise<Settings>` (cria a linha 1 com padrões se faltar), `updateSettings(patch)`, `getAppState()`, `updateAppState(patch)`.
- `createTestDb(): Promise<DB>` (PGlite em memória + `migrate` da pasta `drizzle`) e já chama `setDbForTests`.
- `scripts/migrate.mjs`: sem `DATABASE_URL` imprime aviso e sai 0; com `postgres*` roda o migrator neon-http.

- [ ] Test `settings defaults`: `getSettings()` num banco novo → `dailyLimit 20`, `windowStartHour 9`, `windowEndHour 18`, `messageTemplates.length === 3`, `outreachEnabled false`, `aiRepliesEnabled false`.
- [ ] Test `unique place_id`: inserir duas empresas com o mesmo `placeId` e `onConflictDoNothing` → só 1 linha.
- [ ] Gerar migração: `npx drizzle-kit generate` → arquivo SQL em `drizzle/`.
- [ ] Run `npx vitest run tests/integration/db.test.ts` → PASS. Commit `feat: esquema do banco e migrações`.

### Task 3: Telefone e texto

**Files:** Create `src/lib/phone.ts`, `src/lib/text.ts`, `tests/unit/phone.test.ts`, `tests/unit/text.test.ts`

**Interfaces — Produces:** `normalizeBrazilPhone(raw): { e164; national; display; isMobile } | null`, `phoneLookupVariants(digits): string[]`, `hashPhone(e164): string`, `waNumber(e164): string`, `normalizeText(s): string`, `slugify(s): string` (máx. 60).

- [ ] Tests:
  - `"(11) 98765-4321"` → `{ e164: '+5511987654321', display: '(11) 98765-4321', isMobile: true }`
  - `"+55 (11) 9 8765-4321"` → mesmo e164; `"1132654321"` → `isMobile false`, display `(11) 3265-4321`
  - `"0800 123 4567"`, `"123"`, `""`, `null` → `null`; `"(11) 98765-4321 ramal 2"` → e164 `+5511987654321`
  - `phoneLookupVariants('5511987654321')` → `['+5511987654321', '+551187654321']`; `phoneLookupVariants('551187654321')` → `['+551187654321', '+5511987654321']`
  - `slugify('Barbearia do Zé — Centro')` → `'barbearia-do-ze-centro'`; `slugify('🍕🍕')` → `''`; `normalizeText('  Não  QUERO! ')` → `'nao quero!'`
- [ ] Run → FAIL → implement → PASS. Commit `feat: telefones brasileiros e slugs`.

### Task 4: Login, sessão e roteamento por domínio

**Files:** Create `src/lib/auth/session.ts`, `src/lib/routing.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `tests/unit/session.test.ts`, `tests/unit/routing.test.ts`

**Interfaces — Produces:** `SESSION_COOKIE = 'zbf_session'`, `createSessionToken()`, `verifySessionToken(token?)`, `checkPassword(input): boolean` (tempo constante), `safeEqual(a, b)`, `requireSession(): Promise<void>` (redireciona para `/login`), `isAppHost(host, appHosts)`, `resolveRequest({ host, pathname, hasSession, appHosts })` → `{action:'next'} | {action:'redirect', to} | {action:'rewrite', to}`.

- [ ] Tests:
  - token criado verifica `true`; token com outro `SESSION_SECRET` → `false`; `undefined` → `false`
  - `isAppHost('zapflow.vercel.app', [])`, `isAppHost('localhost:3000', [])`, `isAppHost('painel.agencia.com', ['painel.agencia.com'])` → `true`; `isAppHost('padaria.com.br', [])` → `false`
  - app host + `/painel/empresas` sem sessão → redirect `/login?next=%2Fpainel%2Fempresas`
  - `padaria.com.br` + `/` → rewrite `/dominio/padaria.com.br`; + `/robots.txt` → `next`; `www.padaria.com.br` + `/` → rewrite `/dominio/www.padaria.com.br`
- [ ] Run → FAIL → implement (proxy usa `resolveRequest`; login com atraso de 500 ms na falha) → PASS. Commit `feat: login e roteamento por domínio`.

### Task 5: Ramos e conteúdo do site

**Files:** Create `src/lib/niches.ts`, `src/lib/sites/content.ts`, `tests/unit/niches.test.ts`, `tests/unit/content.test.ts`

**Interfaces — Produces:** `NICHES`, `type Niche`, `detectNiche(category, categories?)`, `NICHE_THEMES: Record<Niche, NicheTheme>` (`label, font: 'poppins'|'playfair'|'inter', colors {primary, primaryDark, accent, soft}, tagline, defaultServices, defaultHighlights, serviceIcons`), `siteContentSchema`, `type SiteContent`, `type SiteCopyInput`, `fallbackContent(input): SiteContent`, `clampContent(raw): SiteContent | null`.

- [ ] Tests:
  - `Barbearia→beleza`, `Pizzaria→alimentacao`, `Oficina mecânica→automotivo`, `Clínica veterinária→pet`, `Clínica odontológica→saude`, `Academia→fitness`, `Eletricista→casa`, `Loja de roupas→varejo`, `Escritório de contabilidade→geral`
  - `fallbackContent` de todo ramo passa em `siteContentSchema` e contém o nome da empresa no `heroTitle`
  - `clampContent` com `heroTitle` de 120 caracteres → 80; com `services` de 8 itens → 6; com `services: []` → `null`; com string → `null`
- [ ] Run → FAIL → implement → PASS. Commit `feat: ramos, temas e conteúdo do site`.

### Task 6: Gemini e textos do site

**Files:** Create `src/lib/ai/gemini.ts`, `src/lib/ai/site-copy.ts`, `tests/unit/gemini.test.ts`

**Interfaces — Consumes:** `clampContent`, `fallbackContent` (Task 5). **Produces:** `generateJson({ system, prompt, responseSchema, temperature?, timeoutMs? }): Promise<unknown>` (lança `GeminiError`), `generateSiteContent(input): Promise<{ content: SiteContent; source: 'ia' | 'padrao' }>`.

- [ ] Tests (fetch simulado com `vi.stubGlobal`):
  - chama `…/v1beta/models/gemini-3.8-flash:generateContent` com cabeçalho `x-goog-api-key` e `generationConfig.responseMimeType === 'application/json'`
  - ignora partes `thought: true` e devolve o JSON da parte de texto
  - resposta válida → `source 'ia'`; HTTP 500 → `source 'padrao'`; texto `"oops"` → `source 'padrao'`; `heroTitle` longo → cortado, `source 'ia'`
- [ ] Run → FAIL → implement → PASS. Commit `feat: textos dos sites com Gemini e plano B`.

### Task 7: Apify, importação e criação dos sites

**Files:** Create `src/lib/apify/client.ts`, `src/lib/apify/mapper.ts`, `src/lib/apify/import.ts`, `src/lib/sites/service.ts`, `src/lib/events.ts`, `tests/fixtures/apify-items.json`, `tests/unit/apify-mapper.test.ts`, `tests/integration/import.test.ts`

**Interfaces — Consumes:** Tasks 2, 3, 5, 6. **Produces:**
- `buildActorInput(term, location, maxResults)`, `startGoogleMapsRun({ term, location, maxResults, webhookUrl }) → { runId, datasetId }`, `getRun(runId) → { status, datasetId }`, `getDatasetItems(datasetId) → unknown[]`
- `mapPlace(item, { includeLandlines }) → { ok: true, place: MappedPlace } | { ok: false, reason: 'invalido'|'tem_site'|'fechada'|'sem_telefone'|'telefone_fixo' }`
- `startSearch({ term, location, maxResults }) → Search`, `importSearchResults(searchId) → { found, imported, skipped }`, `refreshSearch(searchId) → Search`
- `createSiteForBusiness(businessId) → Site`, `regenerateSiteContent(siteId) → Site`, `getPreviewBySlug(slug) → SitePageData | null`, `getPublishedByHost(host) → SitePageData | 'manutencao' | null`
- `logEvent(type, message, businessId?)`

- [ ] Tests unitários: `buildActorInput` tem `website: 'withoutWebsite'`, `language: 'pt-BR'`, `countryCode: 'br'`, `skipClosedPlaces: true`, `maxImages: 6`, `locationQuery: 'Campinas, SP, Brasil'`, `maxCrawledPlacesPerSearch` limitado a 100; `mapPlace` → `tem_site`, `fechada` (`permanentlyClosed` ou `temporarilyClosed`), `sem_telefone`, `telefone_fixo`, e `ok` usando `phoneUnformatted` quando `phone` falta.
- [ ] Teste de integração `import`: fixture com 6 itens (2 válidos com o mesmo nome e cidade, 1 com site, 1 fechado, 1 fixo, 1 com telefone bloqueado) → `imported 2`, `skipped 4`; slugs `barbearia-do-ze-campinas` e `barbearia-do-ze-campinas-2`; sites `previa`; empresas `previa_pronta`; rodar de novo → nada duplicado.
- [ ] Run → FAIL → implement → PASS. Commit `feat: busca no Apify e importação`.

### Task 8: Páginas públicas dos sites

**Files:** Create `src/components/site/SiteView.tsx`, `src/components/site/PreviewBanner.tsx`, `src/components/site/icons.tsx`, `src/app/s/[slug]/page.tsx`, `src/app/dominio/[host]/page.tsx`, `src/app/robots.txt/route.ts`, `src/app/sitemap.xml/route.ts`, `tests/unit/site-view.test.tsx`

**Interfaces — Consumes:** `getPreviewBySlug`, `getPublishedByHost`, `NICHE_THEMES`. **Produces:** `SiteView({ data, mode: 'preview' | 'published' })`, `visiblePhotos(site, mode)`.

- [ ] Tests (`renderToStaticMarkup`): prévia contém `Prévia criada por` e o link `https://wa.me/55…` da agência; publicado não contém `Prévia`; foto do Google não autorizada aparece na prévia e some no publicado; celular gera link `wa.me`, fixo gera `tel:`; avaliação mostra nota e "Ver no Google" sem texto de avaliação.
- [ ] Prévia: `generateMetadata` com `robots: { index: false, follow: false }`; publicado: `alternates.canonical = https://{domínio}`.
- [ ] Run → FAIL → implement → PASS. Commit `feat: prévia e site oficial`.

### Task 9: Painel

**Files:** Create `src/app/painel/layout.tsx`, `src/app/painel/page.tsx`, `src/app/painel/buscas/{page,actions}.tsx|ts`, `src/app/painel/empresas/{page,actions}.tsx|ts`, `src/app/painel/empresas/[id]/{page,actions}.tsx|ts`, `src/app/painel/configuracoes/{page,actions}.tsx|ts`, `src/components/painel/*`, `src/lib/sites/photos.ts`, `src/app/api/webhooks/apify/route.ts`, `tests/unit/photos.test.ts`, `tests/integration/apify-webhook.test.ts`

**Interfaces — Consumes:** Tasks 2–8. **Produces:** `validateUpload({ type, size }) → string | null` (aceita `image/jpeg|png|webp` até 5 MB), `setPhotoAuthorized(siteId, url, authorized)`, `removePhoto(siteId, url)`, `addUploadedPhoto(siteId, file)`, `updateSiteContent(siteId, content, niche)`, `updateBusinessStatus(id, status)`, `deleteBusiness(id)`.

- [ ] Tests: `validateUpload` rejeita `image/gif` e 6 MB; webhook Apify com token errado → 401; com token certo e `eventData.actorRunId` de uma busca → 200 e importação agendada (`after` simulado); `deleteBusiness` apaga site e mensagens.
- [ ] Telas: início (contagens por status, WhatsApp, envios do dia, histórico), buscas (formulário + lista + "Atualizar"), empresas (filtro por status, "Colocar na fila as prévias prontas"), empresa (editor, fotos, publicar, conversa, dados, excluir), configurações (agência, envio, modelos, IA, checklist de integrações).
- [ ] Run tests → PASS; `npx tsc --noEmit` limpo. Commit `feat: painel`.

### Task 10: Domínio próprio e publicação

**Files:** Create `src/lib/domains/normalize.ts`, `src/lib/domains/vercel.ts`, `src/lib/sites/publish.ts`, `tests/unit/domains.test.ts`, `tests/integration/publish.test.ts`

**Interfaces — Produces:** `normalizeDomain(input): string | null`, `dnsInstructions(domain, config?) → { type: 'A'|'CNAME'; name; value }[]`, `addProjectDomain(name, redirect?)`, `removeProjectDomain(name)`, `getDomainConfig(name) → { misconfigured, recommendedIPv4?, recommendedCNAME? }`, `connectDomain(siteId, input)`, `checkDomain(siteId)`, `publishSite(siteId)`, `unpublishSite(siteId)`, `disconnectDomain(siteId)`, `checkPendingDomains()`.

- [ ] Tests: `normalizeDomain('https://www.Padaria.com.br/contato') === 'padaria.com.br'`; `'padaria'`, `'x.vercel.app'`, `''` → `null`; `'açaí.com.br'` → começa com `xn--`; `dnsInstructions('padaria.com.br')` → A `@` `76.76.21.21` e CNAME `www` `cname.vercel-dns.com`; `connectDomain` chama `POST /v10/projects/{id}/domains` duas vezes (raiz e `www` com `redirect`); `publishSite` com domínio `pendente` → erro "domínio"; com foto do Google não autorizada → erro "fotos"; tudo certo → site `publicado`, empresa `cliente`.
- [ ] Run → FAIL → implement → PASS. Commit `feat: publicação com domínio próprio`.

### Task 11: WhatsApp — conexão, fila e ritmo

**Files:** Create `src/lib/whatsapp/evolution.ts`, `src/lib/whatsapp/templates.ts`, `src/lib/whatsapp/schedule.ts`, `src/lib/whatsapp/outreach.ts`, `src/lib/cron/tick.ts`, `src/app/api/cron/tick/route.ts`, `src/app/api/whatsapp/status/route.ts`, `src/app/painel/whatsapp/{page,actions,ConnectCard}.tsx|ts`, `vercel.json`, `tests/unit/schedule.test.ts`, `tests/unit/templates.test.ts`, `tests/integration/outreach.test.ts`

**Interfaces — Produces:** `createInstance()`, `setWebhook()`, `connect() → { qrBase64, pairingCode }`, `connectionState()`, `logout()`, `checkWhatsappNumber(digits) → { exists, jid }`, `sendText(number, text) → { id }`; `DEFAULT_FIRST_TEMPLATES` (3), `DEFAULT_FOLLOW_UP`, `OPT_OUT_CONFIRMATION`, `renderTemplate(tpl, vars)`, `pickTemplate(list, rand?)`; `saoPauloParts(date)`, `isWithinWindow(date, settings)`, `nextDelayMs(settings, rand?)`; `enqueueFirstContact(businessId)`, `enqueueAllReady()`, `runOutreachStep(now)`, `scheduleFollowUps(now)`, `sendManualMessage(businessId, text)`; `runTick(now) → { locked: boolean; outreach; followUps; replies; domains }`.

- [ ] Tests unitários: `isWithinWindow` — sábado 10:00 BRT `true`, domingo 10:00 `false`, segunda 18:00 `false`, segunda 08:59 `false`; `saoPauloParts(new Date('2026-11-10T02:30:00Z')).day === '2026-11-09'`; `nextDelayMs({4,12}, () => 0) === 240000`, `() => 0.999…` < `720000`; todo `DEFAULT_FIRST_TEMPLATES` contém `{link}` e `SAIR`; `renderTemplate('Oi {empresa} {x}', {empresa:'Zé'}) === 'Oi Zé {x}'`.
- [ ] Testes de integração (Evolution simulada): fora da janela → nada enviado; limite 1 já atingido → nada; envio ok → mensagem `enviada`, empresa `contatada`, `sentCount 1`, `nextSendAfter` ≥ agora + 4 min; número sem WhatsApp → `sem_whatsapp` e mensagem `cancelada`; dois `runTick` simultâneos → só um envia; `sentDay` de ontem → contador zera; `scheduleFollowUps` cria 1 lembrete após 3 dias e não cria um segundo.
- [ ] `vercel.json`: cron `* * * * *` em `/api/cron/tick`; rota exige `Authorization: Bearer ${CRON_SECRET}` (401 sem).
- [ ] Run → FAIL → implement → PASS. Commit `feat: WhatsApp com fila e ritmo seguro`.

### Task 12: WhatsApp — recebimento

**Files:** Create `src/lib/whatsapp/webhook.ts`, `src/lib/whatsapp/detect.ts`, `src/lib/whatsapp/inbound.ts`, `src/app/api/webhooks/whatsapp/route.ts`, `tests/unit/webhook-parse.test.ts`, `tests/unit/detect.test.ts`, `tests/integration/inbound.test.ts`

**Interfaces — Produces:** `parseEvolutionEvent(payload) → EvolutionEvent` (`connection | qrcode | message {id, fromMe, phoneDigits, text, isGroup, timestamp} | ignored`), `isOptOut(text)`, `looksLikeAutoReply(text)`, `handleEvolutionEvent(event, now?)`, `findBusinessByPhoneDigits(digits)`, `optOutBusiness(businessId, now)`.

- [ ] Tests: evento `MESSAGES_UPSERT` e `messages.upsert` → `message`; texto de `conversation` e de `extendedTextMessage.text`; `@g.us` → `isGroup`; `@lid` sem `senderPn`/`remoteJidAlt` → `phoneDigits null`; `isOptOut('SAIR')`, `isOptOut('Não tenho interesse, obrigado')`, `isOptOut('pare de mandar')` → `true`; `isOptOut('pode sair amanhã?')` → `false`; `looksLikeAutoReply('Olá! Obrigado pelo contato, em breve retornaremos.')` → `true`.
- [ ] Integração: resposta "SAIR" → `nao_contatar`, hash bloqueado, agendadas `cancelada`, 1 confirmação enviada; `fromMe` desconhecido → `manual` e `aiPaused true`; `fromMe` com o id da nossa mensagem → ignorado; auto-resposta 10 s após o envio → `auto_resposta` e `lastInboundAt` intacto; JID sem o nono dígito casa com a empresa; webhook sem `x-webhook-secret` → 401.
- [ ] Run → FAIL → implement → PASS. Commit `feat: recebimento de mensagens e opt-out`.

### Task 13: Respostas com IA

**Files:** Create `src/lib/ai/responder.ts`, `src/lib/whatsapp/replies.ts`, `tests/unit/responder.test.ts`, `tests/integration/replies.test.ts`

**Interfaces — Consumes:** `generateJson`, `sendText`, `logEvent`. **Produces:** `buildResponderSystemPrompt(ctx): string`, `generateReply(ctx) → { reply, intent: 'duvida'|'interessado'|'quer_humano'|'sem_interesse'|'outro', handoff }`, `runRepliesStep(now) → number`.

- [ ] Tests: prompt contém o nome da agência, o `offer_text` e "assistente virtual"; sem `offer_text` contém a instrução de não informar preço; resposta recebida há 30 s → não responde; há 60 s → responde, `aiReplyCount 1`; `intent 'interessado'` → `aiPaused`, `interessada` e aviso enviado para `agencyWhatsapp`; `sem_interesse` → `nao_contatar`; `aiReplyCount === aiMaxReplies` → não chama o Gemini e passa para a dona; `aiRepliesEnabled false` → 0.
- [ ] Run → FAIL → implement → PASS. Commit `feat: respostas com IA e passagem para a dona`.

### Task 14: Verificação, documentação e entrega

**Files:** Create `README.md`, `docs/deploy.md`; Modify `package.json` (`build: node scripts/migrate.mjs && next build`)

- [ ] `npx vitest run` → todos PASS; `npx tsc --noEmit` limpo; `npx next build` → sucesso.
- [ ] `DATABASE_URL=pglite:./.data/smoke npx next start` + dados de exemplo: `/login` 200, `/painel` sem sessão → 307 para `/login`, `/s/{slug}` 200 com `noindex`; capturas no Chrome em 390 px e 1280 px.
- [ ] README/deploy: passo a passo (Vercel Pro, Neon, Blob, variáveis, Apify, Gemini, token da Vercel, Railway + Evolution API, cron, primeira busca, conectar WhatsApp, ligar envio e IA).
- [ ] Commit `docs: instruções de deploy` e `git push origin main`.
