import type { Niche } from './constants';
import { normalizeText } from './text';
import type { SiteService } from './types';

export type { Niche } from './constants';

export type ThemeFont = 'poppins' | 'playfair' | 'inter';

/** Nomes dos ícones usados nos serviços (mapeados em `src/components/site/icons.tsx`). */
export type ServiceIconName =
  | 'utensils'
  | 'message'
  | 'map-pin'
  | 'scissors'
  | 'calendar'
  | 'sparkles'
  | 'heart-pulse'
  | 'stethoscope'
  | 'wrench'
  | 'car'
  | 'shield'
  | 'paw'
  | 'heart'
  | 'home'
  | 'hammer'
  | 'clock'
  | 'dumbbell'
  | 'users'
  | 'shopping-bag'
  | 'store'
  | 'star'
  | 'briefcase';

export interface NicheTheme {
  label: string;
  font: ThemeFont;
  /** 'toldo' = faixa listrada de fachada no topo; 'faixa' = linha de cor simples. */
  sign: 'toldo' | 'faixa';
  colors: { primary: string; primaryDark: string; accent: string; soft: string };
  tagline: string;
  /** Complemento do texto "sobre": "A {empresa} atende {cidade} com …" */
  aboutPhrase: string;
  defaultServices: SiteService[];
  defaultHighlights: string[];
  serviceIcons: ServiceIconName[];
}

export const NICHE_THEMES: Record<Niche, NicheTheme> = {
  alimentacao: {
    label: 'Alimentação',
    font: 'poppins',
    sign: 'toldo',
    colors: { primary: '#b42318', primaryDark: '#7a1a12', accent: '#f2b705', soft: '#fff6ed' },
    tagline: 'Sabor de verdade, feito com carinho',
    aboutPhrase: 'sabor, qualidade e um atendimento que faz você querer voltar',
    defaultServices: [
      { title: 'Cardápio da casa', description: 'Pratos e produtos preparados com cuidado para você.' },
      { title: 'Atendimento pelo WhatsApp', description: 'Tire dúvidas e fale com a gente direto pelo WhatsApp.' },
      { title: 'Venha nos visitar', description: 'Confira o endereço e o horário de funcionamento logo abaixo.' },
    ],
    defaultHighlights: ['Feito com carinho', 'Atendimento próximo', 'Fale pelo WhatsApp'],
    serviceIcons: ['utensils', 'message', 'map-pin'],
  },
  beleza: {
    label: 'Beleza',
    font: 'playfair',
    sign: 'faixa',
    colors: { primary: '#9d174d', primaryDark: '#500724', accent: '#d4a373', soft: '#fdf2f8' },
    tagline: 'Cuidado e estilo para você',
    aboutPhrase: 'cuidado, técnica e atenção a cada detalhe do seu visual',
    defaultServices: [
      { title: 'Cuidados e estilo', description: 'Atendimento personalizado para valorizar o seu estilo.' },
      { title: 'Agendamento fácil', description: 'Marque seu horário direto pelo WhatsApp.' },
      { title: 'Ambiente acolhedor', description: 'Um espaço pensado para você relaxar e se cuidar.' },
    ],
    defaultHighlights: ['Atendimento personalizado', 'Agende pelo WhatsApp', 'Profissionais dedicados'],
    serviceIcons: ['scissors', 'calendar', 'sparkles'],
  },
  saude: {
    label: 'Saúde',
    font: 'inter',
    sign: 'faixa',
    colors: { primary: '#0e7490', primaryDark: '#164e63', accent: '#22c55e', soft: '#ecfeff' },
    tagline: 'Cuidado com você em cada atendimento',
    aboutPhrase: 'atenção, responsabilidade e um atendimento humanizado',
    defaultServices: [
      { title: 'Atendimento humanizado', description: 'Cuidado e atenção em cada consulta.' },
      { title: 'Agendamento pelo WhatsApp', description: 'Marque seu horário de forma rápida e prática.' },
      { title: 'Fácil de encontrar', description: 'Veja o endereço e o horário de funcionamento abaixo.' },
    ],
    defaultHighlights: ['Atendimento humanizado', 'Agende pelo WhatsApp', 'Cuidado de perto'],
    serviceIcons: ['heart-pulse', 'calendar', 'stethoscope'],
  },
  automotivo: {
    label: 'Automotivo',
    font: 'poppins',
    sign: 'toldo',
    colors: { primary: '#1d4ed8', primaryDark: '#0f172a', accent: '#f59e0b', soft: '#eff6ff' },
    tagline: 'Seu veículo em boas mãos',
    aboutPhrase: 'serviço caprichado, honestidade e respeito pelo seu tempo',
    defaultServices: [
      { title: 'Manutenção e reparos', description: 'Serviços para manter seu veículo rodando com segurança.' },
      { title: 'Orçamento pelo WhatsApp', description: 'Mande uma mensagem e peça seu orçamento.' },
      { title: 'Atendimento de confiança', description: 'Transparência do diagnóstico à entrega.' },
    ],
    defaultHighlights: ['Atendimento de confiança', 'Orçamento pelo WhatsApp', 'Serviço caprichado'],
    serviceIcons: ['wrench', 'message', 'shield'],
  },
  pet: {
    label: 'Pet',
    font: 'poppins',
    sign: 'toldo',
    colors: { primary: '#7c3aed', primaryDark: '#4c1d95', accent: '#f97316', soft: '#f5f3ff' },
    tagline: 'Carinho e cuidado para o seu pet',
    aboutPhrase: 'carinho, cuidado e muito amor pelos animais',
    defaultServices: [
      { title: 'Cuidado com carinho', description: 'Atenção especial para o seu melhor amigo.' },
      { title: 'Agendamento fácil', description: 'Marque seu horário pelo WhatsApp.' },
      { title: 'Feito por quem ama pets', description: 'Uma equipe que trata cada animal como da família.' },
    ],
    defaultHighlights: ['Carinho com cada pet', 'Agende pelo WhatsApp', 'Atendimento próximo'],
    serviceIcons: ['paw', 'calendar', 'heart'],
  },
  casa: {
    label: 'Casa e serviços',
    font: 'poppins',
    sign: 'toldo',
    colors: { primary: '#15803d', primaryDark: '#14532d', accent: '#eab308', soft: '#f0fdf4' },
    tagline: 'Soluções práticas para sua casa',
    aboutPhrase: 'serviço bem feito, pontualidade e preço justo',
    defaultServices: [
      { title: 'Serviços para sua casa', description: 'Soluções práticas, do pequeno reparo ao serviço completo.' },
      { title: 'Orçamento pelo WhatsApp', description: 'Explique o que precisa e peça seu orçamento.' },
      { title: 'Atendimento rápido', description: 'Fale com a gente e combine o melhor horário.' },
    ],
    defaultHighlights: ['Serviço bem feito', 'Orçamento pelo WhatsApp', 'Atendimento rápido'],
    serviceIcons: ['home', 'message', 'hammer'],
  },
  fitness: {
    label: 'Fitness',
    font: 'poppins',
    sign: 'toldo',
    colors: { primary: '#dc2626', primaryDark: '#111827', accent: '#facc15', soft: '#fef2f2' },
    tagline: 'Treine com motivação e acompanhamento',
    aboutPhrase: 'energia, orientação e um ambiente que motiva você a evoluir',
    defaultServices: [
      { title: 'Treinos para todos', description: 'Atividades para diferentes objetivos e níveis.' },
      { title: 'Acompanhamento', description: 'Orientação para você treinar com segurança.' },
      { title: 'Fale com a gente', description: 'Tire dúvidas e conheça os horários pelo WhatsApp.' },
    ],
    defaultHighlights: ['Treinos para todos', 'Ambiente motivador', 'Fale pelo WhatsApp'],
    serviceIcons: ['dumbbell', 'users', 'clock'],
  },
  varejo: {
    label: 'Loja',
    font: 'inter',
    sign: 'toldo',
    colors: { primary: '#0f766e', primaryDark: '#134e4a', accent: '#f43f5e', soft: '#f0fdfa' },
    tagline: 'Variedade e bom atendimento perto de você',
    aboutPhrase: 'variedade, bom atendimento e preços que cabem no seu bolso',
    defaultServices: [
      { title: 'Variedade de produtos', description: 'Opções para todos os gostos e necessidades.' },
      { title: 'Atendimento pelo WhatsApp', description: 'Consulte produtos e disponibilidade pelo WhatsApp.' },
      { title: 'Visite a loja', description: 'Confira o endereço e o horário de funcionamento abaixo.' },
    ],
    defaultHighlights: ['Variedade de produtos', 'Atendimento atencioso', 'Fale pelo WhatsApp'],
    serviceIcons: ['shopping-bag', 'message', 'store'],
  },
  geral: {
    label: 'Serviços',
    font: 'inter',
    sign: 'faixa',
    colors: { primary: '#334155', primaryDark: '#0f172a', accent: '#0ea5e9', soft: '#f8fafc' },
    tagline: 'Atendimento de qualidade perto de você',
    aboutPhrase: 'compromisso, qualidade e atenção a cada cliente',
    defaultServices: [
      { title: 'Atendimento de qualidade', description: 'Compromisso com cada cliente, do primeiro contato ao resultado.' },
      { title: 'Fale pelo WhatsApp', description: 'Tire suas dúvidas de forma rápida e prática.' },
      { title: 'Fácil de encontrar', description: 'Veja o endereço e o horário de funcionamento abaixo.' },
    ],
    defaultHighlights: ['Atendimento de qualidade', 'Fale pelo WhatsApp', 'Compromisso com você'],
    serviceIcons: ['briefcase', 'message', 'map-pin'],
  },
};

/** Ordem importa: o primeiro ramo que casar vence (ex.: "clínica veterinária" é pet, não saúde). */
const NICHE_RULES: Array<[Niche, RegExp]> = [
  ['pet', /\bpet\b|pet ?shop|veterin|banho e tosa|\btosa\b|aquaris|agropet/],
  [
    'automotivo',
    /automotiv|\bauto\b|autopeca|auto peca|oficina|mecanic|funilaria|borracharia|\bpneus?\b|lava.?jato|lava.?rapido|\bmotos?\b|motopeca|veicul|\bcarros?\b|guincho|retifica|escapamento/,
  ],
  [
    'beleza',
    /barbear|barber|salao|cabeleir|manicure|pedicure|\bunhas?\b|esmalteria|estetica|sobrancelha|maquiag|depila|\bspa\b|beleza|cosmet|micropigment|cilios|tatuag|tattoo|piercing|massag/,
  ],
  [
    'saude',
    /clinica|odonto|dentist|medic|fisioterap|psicolog|nutricion|laborator|consultorio|fonoaudiol|ortodont|farmacia|drogaria|hospital|terapia|terapeut|podolog|quiroprax|acupuntur|exames|pediatr|dermatolog|ortoped|oftalmo/,
  ],
  [
    'alimentacao',
    /restaurante|lanchonete|lanches|pizzaria|padaria|panificadora|confeitaria|doceria|\bdoces\b|bolos|hamburg|burger|\bacai\b|sorvet|gelato|\bcafe\b|cafeteria|\bbar\b|boteco|petiscaria|choperia|cervejaria|churrasc|marmit|sushi|japones|temaker|comida|pastel|pastelaria|salgad|buffet|food|cozinha|bistro|espetinho|tapiocaria|acougue|emporio|rotisseria|self.?service|delivery/,
  ],
  [
    'fitness',
    /academia|crossfit|pilates|\byoga\b|\bioga\b|personal|\bluta\b|jiu|muay|karate|judo|boxe|\bdanca\b|natacao|treinamento|funcional|esporte|fitness/,
  ],
  [
    'casa',
    /eletricista|encanador|chaveiro|marcenaria|serralheria|vidracaria|dedetiz|limpeza|reforma|construcao|construtora|pintor|pintura|pedreiro|jardin|paisag|mudanca|\bfretes?\b|assistencia tecnica|conserto|refrigeracao|ar.condicionado|gesso|piscina|planejados|tapecaria|lavanderia|costura|climatizacao|hidraulic|calhas|telhad/,
  ],
  [
    'varejo',
    /\bloja\b|boutique|\bmoda\b|roupa|calcad|sapat|presente|papelaria|livraria|otica|joalheria|relojoaria|bijuteria|perfumaria|mercado|mercearia|armazem|distribuidora|floricultura|brinquedo|utilidades|magazine|bazar|artesanato|celular|informatica|eletronic|hortifruti|adega|tabacaria|variedades|atacad|\bstore\b|shop/,
  ],
];

export function detectNiche(category: string | null | undefined, categories: string[] = []): Niche {
  const text = normalizeText([category ?? '', ...categories].join(' | '));
  if (!text) return 'geral';
  for (const [niche, rule] of NICHE_RULES) {
    if (rule.test(text)) return niche;
  }
  return 'geral';
}
