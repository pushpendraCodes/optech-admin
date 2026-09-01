import { useState, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, Bell } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAuth";
import { clearAuth } from "@/features/auth/authSlice";
import { useListQuery, useLogoutMutation, useGetAdminAlertsQuery, useGetAdminAlertUnreadCountQuery, useMarkAdminAlertReadMutation } from "@/app/api";
import { AuthSessionWatcher } from "@/components/AuthSessionWatcher";
import { AdminPushSetup } from "@/components/AdminPushSetup";
import { Drawer } from "@/components/Drawer";
import { ADMIN_NAV } from "@/constants/nav";
import { useLivePush } from "@/hooks/useLivePush";
import { useLiveAlertPolling } from "@/hooks/useLiveAlertPolling";
import { NotificationToast, showLiveToast } from "@/components/NotificationToast";

function NavMenu({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const { permissions, user } = useAppSelector((s) => s.auth);

  function canAccess(permission?: string | string[]) {
    if (!permission) return true;
    if (user?.roles.includes("SUPER_ADMIN") || permissions.includes("*")) return true;
    const list = Array.isArray(permission) ? permission : [permission];
    return list.some((p) => permissions.includes(p));
  }

  return (
    <>
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((item) => canAccess(item.permission));
        if (!items.length) return null;
        return (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed ? (
              <p className="mb-1 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">{group.label}</p>
            ) : null}
            <nav className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    title={item.label}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] ${
                        isActive ? "bg-accent/15 text-accent" : "text-zinc-400 hover:bg-white/5 hover:text-foreground"
                      } ${collapsed ? "justify-center px-2" : ""}`
                    }
                  >
                    <Icon size={15} />
                    {!collapsed ? item.label : null}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        );
      })}
    </>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [liveUnread, setLiveUnread] = useState(0);
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [logout] = useLogoutMutation();
  const { data: alertsRes, refetch: refetchAlerts } = useGetAdminAlertsQuery(undefined, { pollingInterval: 15000 });
  const { data: unreadRes, refetch: refetchUnread } = useGetAdminAlertUnreadCountQuery(undefined, { pollingInterval: 10000 });
  const [markAlertRead] = useMarkAdminAlertReadMutation();
  const alerts = alertsRes?.data ?? [];
  const serverUnread = Number(unreadRes?.data?.count ?? 0);
  const unreadAlerts = serverUnread + liveUnread;
  const notes = useListQuery({ resource: "notifications", page: 1 }, { skip: !notesOpen });
  const crumb = location.pathname === "/" ? "Dashboard" : location.pathname.replace(/^\//, "").replaceAll("/", " / ");

  const handleLivePush = useCallback((n: { title: string; body: string; link?: string }) => {
    showLiveToast(n.title, n.body, n.link);
    setLiveUnread((c) => c + 1);
    void refetchAlerts();
    void refetchUnread();
  }, [refetchAlerts, refetchUnread]);

  useLivePush(Boolean(user), handleLivePush);
  useLiveAlertPolling(Boolean(user), serverUnread, alerts, refetchAlerts);

  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-background">
      <AuthSessionWatcher />
      <AdminPushSetup active={Boolean(user)} />
      <div className="flex h-full min-h-0">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh flex-col border-r border-white/8 bg-black/70 backdrop-blur-xl transition-all lg:static lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "lg:w-[76px]" : "w-64"}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 p-4">
            {!collapsed ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">Optech / Console</p>
            ) : (
              <p className="font-mono text-[10px] text-accent">OP</p>
            )}
            <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-3 [scrollbar-gutter:stable]">
            <NavMenu collapsed={collapsed} onNavigate={() => setOpen(false)} />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-black/50 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button type="button" className="rounded-full border border-white/10 p-2 lg:hidden" onClick={() => setOpen(true)}>
                <Menu size={16} />
              </button>
              <button
                type="button"
                className="hidden rounded-full border border-white/10 p-2 lg:inline-flex"
                onClick={() => setCollapsed((v) => !v)}
                aria-label="Collapse sidebar"
              >
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Admin / {crumb}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="relative rounded-full border border-white/10 p-2 text-zinc-400 transition-colors hover:text-foreground"
                onClick={() => { setNotesOpen(true); setLiveUnread(0); }}
                aria-label={`Notifications${unreadAlerts > 0 ? ` (${unreadAlerts} unread)` : ""}`}
              >
                <Bell size={16} />
                {unreadAlerts > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] text-black animate-pulse">
                    {unreadAlerts > 99 ? "99+" : unreadAlerts}
                  </span>
                ) : null}
              </button>
              <span className="hidden text-sm text-zinc-400 sm:inline">{user?.name}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400"
                onClick={async () => {
                  try {
                    await logout().unwrap();
                  } catch {
                    /* still clear local session */
                  }
                  dispatch(clearAuth());
                  navigate("/login");
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </header>
          <main className="mx-auto min-h-0 w-full max-w-[1400px] flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8 [scrollbar-gutter:stable]">
            <Outlet />
          </main>
        </div>
      </div>
      {open ? <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Close overlay" /> : null}
      <NotificationToast />
      <Drawer open={notesOpen} title="Alerts & notifications" onClose={() => { setNotesOpen(false); setLiveUnread(0); }}>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Live alerts</p>
        <ul className="space-y-3 text-sm">
          {alerts.slice(0, 20).map((row) => {
            const alert = (row.alert as Record<string, unknown> | undefined) ?? {};
            const unread = !row.readAt;
            return (
              <li key={String(row._id)} className="border-b border-white/8 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {unread ? <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" /> : null}
                      {String(alert.type ?? "") === "enquiry" ? (
                        <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-400">Enquiry</span>
                      ) : null}
                      {String(alert.title ?? "Alert")}
                    </p>
                    <p className="text-zinc-400">{String(alert.body ?? "")}</p>
                    {alert.link ? (
                      <button
                        type="button"
                        className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent"
                        onClick={() => {
                          void markAlertRead(String(row._id));
                          navigate(String(alert.link));
                          setNotesOpen(false);
                        }}
                      >
                        Open
                      </button>
                    ) : null}
                  </div>
                  {unread ? (
                    <button
                      type="button"
                      className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500"
                      onClick={() => {
                        void markAlertRead(String(row._id));
                        void refetchAlerts();
                      }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {alerts.length === 0 ? <li className="text-zinc-500">No alerts yet.</li> : null}
        </ul>
        <p className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Sent broadcasts</p>
        <ul className="space-y-3 text-sm">
          {(notes.data?.data ?? []).slice(0, 8).map((n) => (
            <li key={String(n._id)} className="border-b border-white/8 pb-3">
              <p className="font-medium">{String(n.title ?? "Notice")}</p>
              <p className="text-zinc-400">{String(n.body ?? "")}</p>
            </li>
          ))}
          {(notes.data?.data ?? []).length === 0 ? <li className="text-zinc-500">No broadcasts yet.</li> : null}
        </ul>
      </Drawer>
    </div>
  );
}
