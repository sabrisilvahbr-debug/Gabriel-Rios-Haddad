import { and, eq, ne } from 'drizzle-orm';
import { errorMessage } from '@/lib/async';
import type { DomainStatus } from '@/lib/constants';
import { getDb } from '@/lib/db/client';
import { businesses, sites, type Site } from '@/lib/db/schema';
import { isApexDomain, normalizeDomain } from '@/lib/domains/normalize';
import { addProjectDomain, getDomainStatus, removeDomainHosts, verifyProjectDomain } from '@/lib/domains/vercel';
import { logEvent } from '@/lib/events';

type Result = { ok: boolean; message: string };

async function getSite(siteId: string): Promise<Site> {
  const [site] = await getDb().select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new Error('Site não encontrado.');
  return site;
}

async function updateSite(siteId: string, patch: Partial<typeof sites.$inferInsert>): Promise<void> {
  await getDb()
    .update(sites)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(sites.id, siteId));
}

export async function connectDomain(siteId: string, input: string): Promise<Result> {
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false, message: 'Domínio inválido. Use algo como padariapaoquente.com.br.' };
  const site = await getSite(siteId);
  if (site.customDomain && site.customDomain !== domain) {
    return { ok: false, message: `Remova o domínio ${site.customDomain} antes de ligar outro.` };
  }
  const [other] = await getDb()
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.customDomain, domain), ne(sites.id, siteId)))
    .limit(1);
  if (other) return { ok: false, message: 'Esse domínio já está ligado a outro site.' };

  try {
    await addProjectDomain(domain);
    if (isApexDomain(domain)) await addProjectDomain(`www.${domain}`, domain);
  } catch (error) {
    return { ok: false, message: `A Vercel recusou o domínio: ${errorMessage(error)}` };
  }

  await updateSite(siteId, { customDomain: domain, domainStatus: 'pendente', domainError: null });
  await logEvent('dominio', `Domínio ${domain} ligado; aguardando o DNS.`, site.businessId);
  return { ok: true, message: 'Domínio ligado. Agora crie os registros de DNS abaixo e clique em Verificar.' };
}

export async function checkDomain(siteId: string): Promise<DomainStatus> {
  const site = await getSite(siteId);
  if (!site.customDomain) return 'nenhum';
  try {
    const status = await getDomainStatus(site.customDomain);
    let verified = status.verified;
    if (!verified) {
      try {
        await verifyProjectDomain(site.customDomain);
        verified = (await getDomainStatus(site.customDomain)).verified;
      } catch {
        verified = false;
      }
    }
    const next: DomainStatus = verified && !status.misconfigured ? 'ativo' : 'pendente';
    await updateSite(siteId, { domainStatus: next, domainError: null });
    if (next === 'ativo' && site.domainStatus !== 'ativo') {
      await logEvent('dominio', `Domínio ${site.customDomain} funcionando.`, site.businessId);
    }
    return next;
  } catch (error) {
    await updateSite(siteId, { domainStatus: 'erro', domainError: errorMessage(error) });
    return 'erro';
  }
}

export async function checkPendingDomains(): Promise<void> {
  const pending = await getDb().select({ id: sites.id }).from(sites).where(eq(sites.domainStatus, 'pendente')).limit(20);
  for (const site of pending) await checkDomain(site.id);
}

export async function publishSite(siteId: string): Promise<Result> {
  const site = await getSite(siteId);
  if (!site.customDomain || site.domainStatus !== 'ativo') {
    return { ok: false, message: 'Ligue o domínio e espere ele ficar ativo antes de publicar.' };
  }
  const pendingPhotos = site.photos.filter((p) => p.source === 'google' && !p.authorized).length;
  if (pendingPhotos) {
    return {
      ok: false,
      message: `Autorize ou remova as fotos do Google sem autorização (${pendingPhotos}) antes de publicar.`,
    };
  }
  await updateSite(siteId, { status: 'publicado', publishedAt: new Date() });
  await getDb().update(businesses).set({ status: 'cliente', updatedAt: new Date() }).where(eq(businesses.id, site.businessId));
  await logEvent('publicado', `Site publicado em ${site.customDomain}.`, site.businessId);
  return { ok: true, message: `Site publicado em https://${site.customDomain}.` };
}

export async function unpublishSite(siteId: string): Promise<Result> {
  const site = await getSite(siteId);
  await updateSite(siteId, { status: 'previa' });
  await logEvent('publicado', 'Site despublicado; o domínio mostra "em manutenção".', site.businessId);
  return { ok: true, message: 'Site despublicado. O domínio agora mostra "Site em manutenção".' };
}

export async function disconnectDomain(siteId: string): Promise<Result> {
  const site = await getSite(siteId);
  if (!site.customDomain) return { ok: true, message: 'Nenhum domínio ligado.' };
  try {
    await removeDomainHosts(site.customDomain);
  } catch (error) {
    return { ok: false, message: `Não consegui remover o domínio na Vercel: ${errorMessage(error)}` };
  }
  await updateSite(siteId, {
    customDomain: null,
    domainStatus: 'nenhum',
    domainError: null,
    status: site.status === 'publicado' ? 'previa' : site.status,
  });
  await logEvent('dominio', `Domínio ${site.customDomain} removido.`, site.businessId);
  return { ok: true, message: 'Domínio removido.' };
}
