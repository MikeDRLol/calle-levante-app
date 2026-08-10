import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CreditCard,
  LayoutDashboard,
  Music2,
  Package,
  Receipt,
  Settings,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Resumen general del negocio",
  },
  {
    title: "Eventos",
    href: "/eventos",
    icon: Music2,
    description: "Gestión de eventos musicales",
  },
  {
    title: "Clientes",
    href: "/clientes",
    icon: Users,
    description: "Base de datos de clientes",
  },
  {
    title: "Personal",
    href: "/personal",
    icon: UserRound,
    description: "Técnicos, músicos y comerciales",
  },
  {
    title: "Calendario",
    href: "/calendario",
    icon: Calendar,
    description: "Agenda y planificación",
  },
  {
    title: "Liquidaciones",
    href: "/liquidaciones",
    icon: Wallet,
    description: "Liquidaciones y pagos a terceros",
  },
  {
    title: "Bizums",
    href: "/bizums",
    icon: CreditCard,
    description: "Registro de pagos Bizum",
  },
  {
    title: "Material",
    href: "/material",
    icon: Package,
    description: "Inventario y equipamiento",
  },
  {
    title: "Facturas",
    href: "/facturas",
    icon: Receipt,
    description: "Facturación y documentos",
  },
  {
    title: "Configuración",
    href: "/configuracion",
    icon: Settings,
    description: "Ajustes de la aplicación",
  },
];

export const appConfig = {
  name: "Calle Levante",
  tagline: "Gestión de eventos musicales",
} as const;
