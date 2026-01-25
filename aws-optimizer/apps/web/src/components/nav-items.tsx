import {
  IconMessageCircle,
  IconDashboard,
  IconCoin,
  IconServer,
  IconBulb,
  IconTerminal,
  IconPigMoney,
  IconBell,
  IconFileText,
  IconCloud,
  IconSettings,
  IconCreditCard,
  IconUsers,
} from "@tabler/icons-react";

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Chat", path: "/chat", icon: <IconMessageCircle size={20} /> },
  { label: "Dashboard", path: "/dashboard", icon: <IconDashboard size={20} /> },
  { label: "Costs", path: "/costs", icon: <IconCoin size={20} /> },
  { label: "Resources", path: "/resources", icon: <IconServer size={20} /> },
  { label: "Recommendations", path: "/recommendations", icon: <IconBulb size={20} /> },
  { label: "Terminal", path: "/terminal", icon: <IconTerminal size={20} /> },
  { label: "Budgets", path: "/budgets", icon: <IconPigMoney size={20} /> },
  { label: "Alerts", path: "/alerts", icon: <IconBell size={20} /> },
  { label: "Reports", path: "/reports", icon: <IconFileText size={20} /> },
  { label: "Accounts", path: "/accounts", icon: <IconCloud size={20} /> },
  { label: "Settings", path: "/settings", icon: <IconSettings size={20} /> },
  { label: "Billing", path: "/billing", icon: <IconCreditCard size={20} /> },
  { label: "Team", path: "/team", icon: <IconUsers size={20} /> },
];
