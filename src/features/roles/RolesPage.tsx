import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton, StatusBadge } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useActionMutation, useCreateMutation, useListQuery, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";
import { PERMISSION_GROUPS } from "@/constants/permissions";
import { menuAccessForPermissions } from "@/constants/nav";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roleKey: z.enum(["ADMIN", "STAFF", "TEACHER"]),
});

type UserForm = z.infer<typeof userSchema>;

function roleKey(row: Record<string, unknown>) {
  const roles = Array.isArray(row.roles) ? row.roles : [];
  const first = roles[0] as { key?: string } | undefined;
  return first?.key ?? "—";
}

function rolePermissions(row: Record<string, unknown>) {
  const roles = Array.isArray(row.roles) ? row.roles : [];
  const first = roles[0] as { permissions?: string[] } | undefined;
  return first?.permissions ?? [];
}

export function RolesPage() {
  const canManage = useCan("role:manage");
  const [tab, setTab] = useState<"roles" | "team">("roles");
  const [createOpen, setCreateOpen] = useState(false);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const { data, isLoading, isError, refetch } = useListQuery({ resource: "roles", page: 1 });
  const usersQuery = useListQuery({ resource: "users", page: 1 }, { skip: !canManage });
  const [patch, state] = usePatchMutation();
  const [createUser, createUserState] = useCreateMutation();
  const [act, resetState] = useActionMutation();
  const [selected, setSelected] = useState<string>("");
  const [perms, setPerms] = useState<string[]>([]);
  const roles = data?.data ?? [];
  const users = usersQuery.data?.data ?? [];
  const role = roles.find((r) => String(r._id) === selected);
  const locked = role?.key === "SUPER_ADMIN";
  const userForm = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { roleKey: "STAFF" },
  });
  const previewRoleKey = userForm.watch("roleKey");
  const previewRole = roles.find((r) => r.key === previewRoleKey);
  const previewMenus = useMemo(
    () => menuAccessForPermissions((previewRole?.permissions as string[]) ?? []),
    [previewRole],
  );

  useEffect(() => {
    if (role) setPerms((role.permissions as string[]) ?? []);
  }, [role]);

  return (
    <div>
      <PageHeader
        title="Roles & team access"
        description="Create admin, staff, or teacher logins. Sidebar tabs match the permissions saved on each role."
        actions={
          canManage ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Add console user
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={tab === "roles" ? "primary" : "ghost"} onClick={() => setTab("roles")}>
          Role permissions
        </Button>
        <Button variant={tab === "team" ? "primary" : "ghost"} onClick={() => setTab("team")}>
          Console users
        </Button>
      </div>

      {tab === "roles" ? (
        isLoading ? (
          <Skeleton className="h-48" />
        ) : isError ? (
          <EmptyState title="Could not load roles" body="Retry after connecting the API." action={<Button onClick={() => refetch()}>Retry</Button>} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <aside className="card p-3">
              {roles.map((r) => (
                <button
                  key={String(r._id)}
                  type="button"
                  className={`mb-1 w-full rounded-xl px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.14em] ${
                    selected === String(r._id) ? "bg-accent/15 text-accent" : "text-zinc-400 hover:bg-white/5"
                  }`}
                  onClick={() => setSelected(String(r._id))}
                >
                  {String(r.key)}
                </button>
              ))}
            </aside>
            <article className="card p-5">
              {!role ? (
                <p className="text-sm text-zinc-400">Select a role to edit which menu tabs and API actions it can use.</p>
              ) : (
                <>
                  <h2 className="font-sans text-lg font-semibold">{String(role.name)}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Menu access: {menuAccessForPermissions((role.permissions as string[]) ?? [], [String(role.key)]).join(" · ") || "—"}
                  </p>
                  {locked ? <p className="mt-1 text-sm text-warning">Super Admin access cannot be reduced here.</p> : null}
                  <div className="mt-4 space-y-5">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.keys.map((key) => {
                            const on = perms.includes(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={!canManage || locked}
                                onClick={() =>
                                  setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]))
                                }
                                className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] disabled:opacity-50 ${
                                  on ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 text-zinc-500"
                                }`}
                              >
                                {key.split(":")[1]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {canManage && !locked ? (
                    <Button
                      className="mt-6"
                      disabled={state.isLoading}
                      onClick={async () => {
                        try {
                          await patch({ resource: "roles", id: String(role._id), body: { permissions: perms } }).unwrap();
                          toast("Permissions saved");
                          refetch();
                        } catch {
                          toast("Save failed", "error");
                        }
                      }}
                    >
                      {state.isLoading ? "Saving…" : "Save matrix"}
                    </Button>
                  ) : null}
                </>
              )}
            </article>
          </div>
        )
      ) : usersQuery.isLoading ? (
        <Skeleton className="h-48" />
      ) : usersQuery.isError ? (
        <EmptyState title="Could not load users" body="You need role:manage access." action={<Button onClick={() => usersQuery.refetch()}>Retry</Button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Menu tabs</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No console users yet. Add admin, staff, or teacher accounts above.
                  </td>
                </tr>
              ) : (
                users.map((row) => {
                  const menus = menuAccessForPermissions(rolePermissions(row), [roleKey(row)]);
                  const isSuper = roleKey(row) === "SUPER_ADMIN";
                  return (
                    <tr key={String(row._id)} className="border-b border-white/5">
                      <td className="px-4 py-3 font-medium">{String(row.name)}</td>
                      <td className="px-4 py-3">{String(row.email ?? "—")}</td>
                      <td className="px-4 py-3 font-mono text-xs text-accent">{roleKey(row)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{menus.slice(0, 6).join(" · ")}{menus.length > 6 ? "…" : ""}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={String(row.status ?? "active")} />
                      </td>
                      <td className="px-4 py-3">
                        {canManage && !isSuper ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="ghost"
                              disabled={resetState.isLoading}
                              onClick={async () => {
                                try {
                                  const res = await act({ path: `users/${String(row._id)}/reset-password` }).unwrap();
                                  const payload = res.data as { email?: string; password?: string };
                                  setIssued({ email: payload.email ?? String(row.email), password: payload.password ?? "" });
                                  toast("New password generated");
                                } catch {
                                  toast("Reset failed", "error");
                                }
                              }}
                            >
                              Reset password
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  await patch({
                                    resource: "users",
                                    id: String(row._id),
                                    body: { status: row.status === "blocked" ? "active" : "blocked" },
                                  }).unwrap();
                                  toast(row.status === "blocked" ? "User unblocked" : "User blocked");
                                  usersQuery.refetch();
                                } catch {
                                  toast("Update failed", "error");
                                }
                              }}
                            >
                              {row.status === "blocked" ? "Unblock" : "Block"}
                            </Button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} title="Add console user" onClose={() => setCreateOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={userForm.handleSubmit(async (values) => {
            try {
              await createUser({ resource: "users", body: values }).unwrap();
              toast("Console user created");
              setCreateOpen(false);
              userForm.reset({ roleKey: "STAFF" });
              usersQuery.refetch();
            } catch (err) {
              toast((err as { data?: { message?: string } })?.data?.message ?? "Create failed", "error");
            }
          })}
        >
          <Field label="Name" error={userForm.formState.errors.name?.message}>
            <Input {...userForm.register("name")} />
          </Field>
          <Field label="Email (login)" error={userForm.formState.errors.email?.message}>
            <Input type="email" {...userForm.register("email")} />
          </Field>
          <Field label="Password" error={userForm.formState.errors.password?.message}>
            <Input type="password" {...userForm.register("password")} />
          </Field>
          <Field label="Role">
            <Select {...userForm.register("roleKey")}>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
              <option value="TEACHER">Teacher</option>
            </Select>
          </Field>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Menu tabs they will see</p>
            <p className="mt-2 text-sm text-zinc-300">
              {previewMenus.length ? previewMenus.join(" · ") : "No menu tabs with current role permissions"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Edit tabs under Role permissions by changing {previewRoleKey} permissions.</p>
          </div>
          <Button type="submit" disabled={createUserState.isLoading}>
            {createUserState.isLoading ? "Creating…" : "Create user"}
          </Button>
        </form>
      </Modal>

      <Modal open={Boolean(issued)} title="New password" onClose={() => setIssued(null)}>
        <p className="text-sm text-zinc-400">Share once. Password is not stored in plain text after this.</p>
        <p className="mt-4 font-mono text-accent">{issued?.email}</p>
        <p className="mt-1 font-mono">{issued?.password}</p>
        <Button className="mt-4" onClick={() => setIssued(null)}>
          Done
        </Button>
      </Modal>
    </div>
  );
}
