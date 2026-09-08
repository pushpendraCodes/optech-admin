import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { BrandLogo } from "@/components/BrandLogo";
import { useLoginMutation } from "@/app/api";
import { useAppDispatch } from "@/hooks/useAuth";
import { setCredentials } from "@/features/auth/authSlice";
import { toast } from "@/components/Toast";
import { permissionsFromToken } from "@/utils/jwt";
import { pushTokenForLogin } from "@/lib/push-on-login";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Minimum 8 characters"),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div className="login-shell relative flex min-h-dvh items-center justify-center px-4">
      <div
        aria-hidden
        className="brand-gradient pointer-events-none absolute inset-x-0 top-0 h-1.5 opacity-90"
      />
      <form
        className="card relative w-full max-w-md overflow-hidden p-8"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const pushToken = await pushTokenForLogin();
            const res = await login({ ...values, pushToken }).unwrap();
            dispatch(
              setCredentials({
                accessToken: res.data.accessToken,
                refreshToken: res.data.refreshToken,
                user: res.data.user,
                permissions: permissionsFromToken(res.data.accessToken),
              }),
            );
            toast("Welcome back");
            navigate("/");
          } catch (err) {
            toast((err as { data?: { message?: string } })?.data?.message ?? "Login failed", "error");
          }
        })}
      >
        <div
          aria-hidden
          className="brand-gradient pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80"
        />
        <div className="flex flex-col items-center text-center">
          <BrandLogo height={52} />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Optech / Admin
          </p>
          <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-400">Admin access only.</p>
        </div>
        <div className="mt-6 grid gap-4 text-left">
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="username" {...form.register("email")} />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...form.register("password")} />
          </Field>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Checking…" : "Enter console"}
          </Button>
        </div>
      </form>
    </div>
  );
}
