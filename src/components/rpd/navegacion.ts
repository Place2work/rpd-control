import {
  Banknote,
  CalendarDays,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  type LucideIcon,
  BarChart3,
  Settings,
  UserPlus,
} from "lucide-react";
import type { Rol } from "@/generated/prisma/enums";

export type Modulo = { href: string; titulo: string; icono: LucideIcon; roles: Rol[]; movil?: boolean };

const TODOS: Rol[] = ["director", "asesor", "vendedor", "socio"];

// Sección 10. En celular, la barra inferior lleva Hoy, Prospectos, Casos, Calendario y "Más".
export const MODULOS: Modulo[] = [
  { href: "/hoy", titulo: "Hoy", icono: LayoutDashboard, roles: TODOS, movil: true },
  { href: "/prospectos", titulo: "Prospectos", icono: UserPlus, roles: TODOS, movil: true },
  { href: "/casos", titulo: "Casos", icono: FolderKanban, roles: TODOS, movil: true },
  { href: "/calendario", titulo: "Calendario", icono: CalendarDays, roles: TODOS, movil: true },
  { href: "/dinero", titulo: "Dinero", icono: Banknote, roles: ["director", "asesor", "socio"] },
  { href: "/comisiones", titulo: "Comisiones", icono: HandCoins, roles: TODOS },
  { href: "/reportes", titulo: "Reportes", icono: BarChart3, roles: ["director", "asesor"] },
  { href: "/configuracion", titulo: "Configuración", icono: Settings, roles: ["director"] },
];

export const ETIQUETA_ROL: Record<Rol, string> = {
  director: "Director",
  asesor: "Asesor",
  vendedor: "Vendedor",
  socio: "Socio licenciatario",
};
