import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Briefcase,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Gauge,
  GraduationCap,
  IdCard,
  Image,
  Keyboard,
  LayoutDashboard,
  Link2,
  Megaphone,
  MessageSquare,
  Shield,
  Users,
  Video,
} from "lucide-react";

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  /** One permission or any of these permissions grants access */
  permission?: string | string[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard", permission: "course:read" }],
  },
  {
    label: "Academic",
    items: [
      { to: "/courses", icon: BookOpen, label: "Courses", permission: "course:read" },
      { to: "/batches", icon: ClipboardList, label: "Batches", permission: "course:read" },
      { to: "/students", icon: Users, label: "Students", permission: "student:read" },
      { to: "/admissions", icon: GraduationCap, label: "Admissions", permission: "admission:read" },
      { to: "/enquiries", icon: MessageSquare, label: "Enquiries", permission: "admission:read" },
      { to: "/enrollments", icon: GraduationCap, label: "Website enrollments", permission: "student:read" },
      { to: "/attendance", icon: CalendarCheck, label: "Attendance", permission: "attendance:read" },
      { to: "/fees", icon: CreditCard, label: "Fees", permission: "payment:read" },
    ],
  },
  {
    label: "Examinations",
    items: [
      { to: "/quizzes", icon: Gauge, label: "Quizzes", permission: "quiz:read" },
      { to: "/typing", icon: Keyboard, label: "Typing tests", permission: "quiz:read" },
      { to: "/scholarships", icon: Shield, label: "Scholarship exams", permission: "scholarship:write" },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/notes", icon: BookOpen, label: "Notes", permission: ["notes:write", "course:read"] },
      { to: "/gallery", icon: Image, label: "Gallery", permission: "gallery:write" },
      { to: "/notices", icon: Bell, label: "Notices", permission: "notice:write" },
      { to: "/live", icon: Video, label: "Live classes", permission: "live:write" },
      { to: "/staff", icon: Users, label: "Staff", permission: ["staff:write", "course:read"] },
      { to: "/alumni", icon: GraduationCap, label: "Alumni", permission: "cms:write" },
      { to: "/jobs", icon: Briefcase, label: "Jobs", permission: "job:write" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { to: "/coupons", icon: CreditCard, label: "Coupons", permission: "coupon:write" },
      { to: "/referrals", icon: Users, label: "Referrals", permission: "payment:read" },
      { to: "/marquee", icon: Megaphone, label: "Marquee", permission: "cms:write" },
      { to: "/ads", icon: Image, label: "Advertisements", permission: "cms:write" },
      { to: "/popups", icon: Megaphone, label: "Popups", permission: "cms:write" },
      { to: "/links", icon: Link2, label: "Useful links", permission: "cms:write" },
      { to: "/id-cards", icon: IdCard, label: "ID cards", permission: "student:read" },
    ],
  },
  {
    label: "Communication",
    items: [{ to: "/notifications", icon: Bell, label: "Notifications", permission: "notification:create" }],
  },
  {
    label: "System",
    items: [
      { to: "/roles", icon: Shield, label: "Roles", permission: "role:manage" },
      { to: "/settings", icon: Gauge, label: "Settings", permission: "admin:manage" },
      { to: "/audit", icon: ClipboardList, label: "Audit logs", permission: "audit:read" },
    ],
  },
];

export const ROUTE_PERMISSIONS: Record<string, string | string[] | undefined> = Object.fromEntries(
  ADMIN_NAV.flatMap((group) => group.items.map((item) => [item.to, item.permission])),
);

ROUTE_PERMISSIONS["/students/:id"] = "student:read";
ROUTE_PERMISSIONS["/whatsapp"] = "notification:create";

export function menuAccessForPermissions(permissions: string[], roleKeys: string[] = []) {
  if (roleKeys.includes("SUPER_ADMIN") || permissions.includes("*")) {
    return ADMIN_NAV.flatMap((g) => g.items.map((i) => i.label));
  }
  const allowed = new Set<string>();
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (!item.permission) {
        allowed.add(item.label);
        continue;
      }
      const needed = Array.isArray(item.permission) ? item.permission : [item.permission];
      if (needed.some((p) => permissions.includes(p))) allowed.add(item.label);
    }
  }
  return [...allowed];
}
