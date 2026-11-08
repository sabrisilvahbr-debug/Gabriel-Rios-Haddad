import {
  Briefcase,
  CalendarCheck,
  Car,
  Clock,
  Dumbbell,
  Hammer,
  Heart,
  HeartPulse,
  House,
  MapPin,
  MessageCircle,
  PawPrint,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ServiceIconName } from '@/lib/niches';

const ICONS: Record<ServiceIconName, LucideIcon> = {
  utensils: UtensilsCrossed,
  message: MessageCircle,
  'map-pin': MapPin,
  scissors: Scissors,
  calendar: CalendarCheck,
  sparkles: Sparkles,
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  wrench: Wrench,
  car: Car,
  shield: ShieldCheck,
  paw: PawPrint,
  heart: Heart,
  home: House,
  hammer: Hammer,
  clock: Clock,
  dumbbell: Dumbbell,
  users: Users,
  'shopping-bag': ShoppingBag,
  store: Store,
  star: Star,
  briefcase: Briefcase,
};

export function ServiceIcon({ name, className }: { name: ServiceIconName; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden strokeWidth={1.75} />;
}
