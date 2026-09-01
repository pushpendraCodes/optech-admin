import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader, EmptyState, Skeleton } from "@/components/Chrome";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";
import { PhotoUploadField, type PhotoAsset } from "@/components/StudentPhoto";
import { useSaveWebsiteSettingsMutation, useWebsiteSettingsQuery } from "@/app/api";
import { toast } from "@/components/Toast";
import { useCan } from "@/hooks/useAuth";

const schema = z.object({
  name: z.string().min(2, "Website name is required"),
  email: z.string().email("Enter a valid email"),
  mobile: z.string().min(8, "Enter a valid mobile number"),
  address: z.string().min(5, "Enter the full address"),
});

type Form = z.infer<typeof schema>;

export function SettingsPage() {
  const can = useCan("admin:manage");
  const { data, isLoading, isError, refetch } = useWebsiteSettingsQuery();
  const [save, saveState] = useSaveWebsiteSettingsMutation();
  const [logo, setLogo] = useState<PhotoAsset | null>(null);
  const form = useForm<Form>({ resolver: zodResolver(schema) });

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

  if (!can) {
    return (
      <div>
        <PageHeader title="Settings" description="Website name, logo, and contact details." />
        <EmptyState title="Access denied" body="You need admin settings permission to manage the website." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage website name, logo, and contact details shown to visitors." />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <EmptyState title="Could not load settings" body="Retry after the API is up." action={<Button onClick={() => refetch()}>Retry</Button>} />
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
