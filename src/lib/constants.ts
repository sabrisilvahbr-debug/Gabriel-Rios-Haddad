export const NICHES = [
  'alimentacao',
  'beleza',
  'saude',
  'automotivo',
  'pet',
  'casa',
  'fitness',
  'varejo',
  'geral',
] as const;
export type Niche = (typeof NICHES)[number];

export const SEARCH_STATUSES = ['running', 'succeeded', 'imported', 'failed'] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const BUSINESS_STATUSES = [
  'nova',
  'previa_pronta',
  'na_fila',
  'contatada',
  'respondeu',
  'interessada',
  'cliente',
  'descartada',
  'nao_contatar',
  'sem_whatsapp',
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  nova: 'Nova',
  previa_pronta: 'Prévia pronta',
  na_fila: 'Na fila',
  contatada: 'Contatada',
  respondeu: 'Respondeu',
  interessada: 'Interessada',
  cliente: 'Cliente',
  descartada: 'Descartada',
  nao_contatar: 'Não contatar',
  sem_whatsapp: 'Sem WhatsApp',
};

export const WHATSAPP_STATUSES = ['unknown', 'yes', 'no'] as const;
export const SITE_STATUSES = ['gerando', 'previa', 'publicado'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];
export const DOMAIN_STATUSES = ['nenhum', 'pendente', 'ativo', 'erro'] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];
export const GENERATION_SOURCES = ['ia', 'padrao'] as const;
export const MESSAGE_DIRECTIONS = ['out', 'in'] as const;
export const MESSAGE_KINDS = [
  'primeiro_contato',
  'follow_up',
  'ia',
  'manual',
  'sistema',
  'recebida',
  'auto_resposta',
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export const MESSAGE_STATUSES = ['agendada', 'enviada', 'erro', 'cancelada', 'recebida'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MAX_RESULTS_LIMIT = 100;
