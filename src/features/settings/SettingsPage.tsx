import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { PageHeader, EmptyState, Skeleton } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";
import { PhotoUploadField, type PhotoAsset } from "@/components/StudentPhoto";
import {
  useGetMeQuery,
  useSaveWebsiteSettingsMutation,
  useUpdateAccountMutation,
  useWebsiteSettingsQuery,
} from "@/app/api";
import { toast } from "@/components/Toast";
import { useAppDispatch, useAppSelector, useCan } from "@/hooks/useAuth";
import { clearAuth, setCredentials } from "@/features/auth/authSlice";

const siteSchema = z.object({
  name: z.string().min(2, "Website name is required"),
  email: z.string().email("Enter a valid email"),
  mobile: z.string().min(8, "Enter a valid mobile number"),
  address: z.string().min(5, "Enter the full address"),
});

const accountSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    currentPassword: z.string().min(4, "Enter your current password"),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const next = values.newPassword?.trim() ?? "";
    const confirm = values.confirmPassword?.trim() ?? "";
    if (next || confirm) {
      if (next.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "New password must be at least 8 characters",
          path: ["newPassword"],
        });
      }
      if (next !== confirm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match",
          path: ["confirmPassword"],
        });
      }
    }
  });

type SiteForm = z.infer<typeof siteSchema>;
type AccountForm = z.infer<typeof accountSchema>;

export function SettingsPage() {
  const can = useCan("admin:manage");
  const user = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isSuperAdmin = Boolean(user?.roles.includes("SUPER_ADMIN"));

  const { data, isLoading, isError, refetch } = useWebsiteSettingsQuery(undefined, { skip: !can });
  const me = useGetMeQuery(undefined, { skip: !can });
  const [save, saveState] = useSaveWebsiteSettingsMutation();
  const [updateAccount, accountState] = useUpdateAccountMutation();
  const [logo, setLogo] = useState<PhotoAsset | null>(null);

  const form = useForm<SiteForm>({ resolver: zodResolver(siteSchema) });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      email: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const site = data?.data as Record<string, unknown> | undefined;
    if (!site) return;
    form.reset({
      name: String(site.name ?? ""),
      email: String(site.email ?? ""),
      mobile: String(site.mobile ?? ""),
      address: String(site.address ?? ""),
    });
    setLogo((site.logo as PhotoAsset | null | undefined) ?? null);
  }, [data, form]);

  useEffect(() => {
    const email = me.data?.data?.email ?? user?.email ?? "";
    if (!email) return;
    accountForm.reset({
      email,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }, [me.data, user?.email, accountForm]);

  if (!can) {
    return (
      <div>
        <PageHeader title="Settings" description="Website name, logo, and contact details." />
        <EmptyState title="Access denied" body="You need admin settings permission to manage the website." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage website details and your admin login credentials." />

      {isSuperAdmin || user?.roles.includes("ADMIN") ? (
        <section className="card max-w-xl p-5">
          <div className="mb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Account security</p>
            <h2 className="mt-1 font-sans text-lg font-semibold tracking-tight">
              {isSuperAdmin ? "Super admin login" : "Admin login"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Change the email and/or password used to sign in to this console. Current password is required.
            </p>
          </div>
          {me.isLoading ? (
            <Skeleton className="h-48" />
          ) : me.isError ? (
            <EmptyState
              title="Could not load account"
              body="Retry after the API is up."
              action={<Button onClick={() => me.refetch()}>Retry</Button>}
            />
          ) : (
            <form
              className="grid gap-4"
              onSubmit={accountForm.handleSubmit(async (values) => {
                const currentEmail = (me.data?.data?.email ?? user?.email ?? "").toLowerCase();
                const nextEmail = values.email.trim().toLowerCase();
                const nextPassword = values.newPassword?.trim() ?? "";
                const emailChanged = nextEmail !== currentEmail;
                if (!emailChanged && !nextPassword) {
                  toast("Change the email or enter a new password", "error");
                  return;
                }
                try {
                  const res = await updateAccount({
                    currentPassword: values.currentPassword,
                    email: emailChanged ? nextEmail : undefined,
                    newPassword: nextPassword || undefined,
                  }).unwrap();
                  if (res.data.passwordChanged) {
                    toast("Password updated — sign in again with your new credentials");
                    dispatch(clearAuth());
                    navigate("/login");
                    return;
                  }
                  if (accessToken) {
                    dispatch(
                      setCredentials({
                        accessToken,
                        refreshToken: refreshToken ?? undefined,
                        user: {
                          id: res.data.user.id,
                          name: res.data.user.name,
                          email: res.data.user.email,
                          kind: "staff",
                          roles: res.data.user.roles,
                        },
                      }),
                    );
                  }
                  accountForm.reset({
                    email: res.data.user.email,
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                  toast("Login email updated");
                } catch (err) {
                  toast(
                    (err as { data?: { message?: string } })?.data?.message ?? "Could not update account",
                    "error",
                  );
                }
              })}
            >
              <Field label="Login email" error={accountForm.formState.errors.email?.message}>
                <Input type="email" autoComplete="username" {...accountForm.register("email")} />
              </Field>
              <Field label="Current password" error={accountForm.formState.errors.currentPassword?.message}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...accountForm.register("currentPassword")}
                />
              </Field>
              <Field
                label="New password (optional)"
                error={accountForm.formState.errors.newPassword?.message}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  {...accountForm.register("newPassword")}
                />
              </Field>
              <Field
                label="Confirm new password"
                error={accountForm.formState.errors.confirmPassword?.message}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...accountForm.register("confirmPassword")}
                />
              </Field>
              <Button type="submit" disabled={accountState.isLoading}>
                {accountState.isLoading ? "Updating…" : "Update login credentials"}
              </Button>
            </form>
          )}
        </section>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <EmptyState
          title="Could not load settings"
          body="Retry after the API is up."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : (
        <form
          className="card grid max-w-xl gap-4 p-5"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await save({ ...values, logo: logo ?? undefined }).unwrap();
              toast("Website settings saved");
            } catch {
              toast("Save failed", "error");
            }
          })}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Public website</p>
            <h2 className="mt-1 font-sans text-lg font-semibold tracking-tight">Site details</h2>
          </div>
          <PhotoUploadField
            label="Website logo"
            value={logo}
            onChange={setLogo}
            folder="optech/brand"
            hint="PNG or JPG with transparent or light background works best in the header."
            previewAspect="16 / 9"
            buttonLabel="Upload logo"
          />
          <Field label="Website name" error={form.formState.errors.name?.message}>
            <Input placeholder="Optech Computer Institute" {...form.register("name")} />
          </Field>
          <Field label="Contact email" error={form.formState.errors.email?.message}>
            <Input type="email" placeholder="info@optech-deori.edu.in" {...form.register("email")} />
          </Field>
          <Field label="Contact mobile" error={form.formState.errors.mobile?.message}>
            <Input placeholder="+91 0712 253 4587" {...form.register("mobile")} />
          </Field>
          <Field label="Address" error={form.formState.errors.address?.message}>
            <Textarea placeholder="Full campus address" {...form.register("address")} />
          </Field>
          <Button type="submit" disabled={saveState.isLoading}>
            {saveState.isLoading ? "Saving…" : "Save website settings"}
          </Button>
        </form>
      )}
    </div>
  );
}
