import {
  AirVent,
  Bath,
  BedDouble,
  Briefcase,
  Car,
  Check,
  Clock,
  Coffee,
  Dumbbell,
  PawPrint,
  Plane,
  ShieldCheck,
  Shirt,
  Sparkles,
  Utensils,
  Waves,
  Wifi,
  Wine,
  type LucideIcon,
} from "lucide-react";

const ICONS: [RegExp, LucideIcon][] = [
  [/wi-?fi|internet/i, Wifi],
  [/café|breakfast/i, Coffee],
  [/cancelamento/i, ShieldCheck],
  [/academia|gym|fitness/i, Dumbbell],
  [/piscina|pool/i, Waves],
  [/pets?/i, PawPrint],
  [/estacionamento|parking/i, Car],
  [/ar-condicionado|air/i, AirVent],
  [/restaurante/i, Utensils],
  [/^bar$/i, Wine],
  [/24h|recep/i, Clock],
  [/spa|hidromassagem/i, Bath],
  [/lavanderia/i, Shirt],
  [/aeroporto|transfer/i, Plane],
  [/business/i, Briefcase],
  [/serviço de quarto/i, Sparkles],
  [/quarto|família/i, BedDouble],
];

export function amenityIcon(label: string): LucideIcon {
  return ICONS.find(([re]) => re.test(label))?.[1] ?? Check;
}

export function AmenityList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((a) => {
        const Icon = amenityIcon(a);
        return (
          <li key={a} className="flex items-center gap-3 text-sm text-slate-700">
            <Icon className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            {a}
          </li>
        );
      })}
    </ul>
  );
}
