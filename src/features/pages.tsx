import { ResourcePage } from "@/components/ResourcePage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { TypingAttemptsPanel } from "@/features/typing/TypingAttemptsPanel";

export { EnrollmentsPage } from "@/features/enrollments/EnrollmentsPage";

export function TypingPage() {
  return (
    <div className="grid gap-8">
      <ResourcePage
        title="Typing paragraphs"
        description="English / Hindi banks used by the student portal."
        resource="typing-paragraphs"
        permission="quiz:write"
        columns={[
          { key: "language", label: "Language" },
          {
            key: "text",
            label: "Paragraph",
            render: (row) => {
              const text = String(row.text ?? "");
              return (
                <span className="block max-w-[280px] truncate text-zinc-200" title={text || undefined}>
                  {text || "—"}
                </span>
              );
            },
          },
          { key: "active", label: "Active" },
        ]}
        fields={[
          { name: "language", label: "Language", options: ["en", "hi"] },
          { name: "text", label: "Paragraph", type: "textarea" },
        ]}
      />
      <TypingAttemptsPanel />
    </div>
  );
}

export { NotesPage } from "@/features/notes/NotesPage";

export function NoticesPage() {
  return (
    <ResourcePage
      title="Notices"
      description="Pinned, urgent, and expiring board items."
      resource="notices"
      permission="notice:write"
      allowDelete
      localize={["title", "body"]}
      columns={[
        { key: "title.en", label: "Title" },
        { key: "category", label: "Category" },
        { key: "pinned", label: "Pinned" },
      ]}
      fields={[
        { name: "title", label: "Title" },
        { name: "body", label: "Body", type: "textarea" },
        { name: "category", label: "Category", options: ["general", "exam", "holiday", "urgent"] },
      ]}
    />
  );
}

export { StaffPage } from "@/features/staff/StaffPage";
export { AlumniPage } from "@/features/alumni/AlumniPage";

export function JobsPage() {
  return (
    <ResourcePage
      title="Jobs"
      description="Placement listings — information only on the public site."
      resource="jobs"
      permission="job:write"
      allowDelete
      columns={[
        { key: "title", label: "Title" },
        { key: "employer", label: "Employer" },
        { key: "location", label: "Location" },
      ]}
      fields={[
        { name: "title", label: "Title" },
        { name: "employer", label: "Employer" },
        { name: "location", label: "Location" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "contact", label: "Contact" },
        { name: "type", label: "Type" },
      ]}
    />
  );
}

export { GalleryPage } from "@/features/gallery/GalleryPage";

export function CouponsPage() {
  return (
    <ResourcePage
      title="Coupons"
      description="Percent or fixed discounts used by calculator and checkout."
      resource="coupons"
      permission="coupon:write"
      allowDelete
      columns={[
        { key: "code", label: "Code" },
        { key: "type", label: "Type" },
        { key: "value", label: "Value" },
        { key: "active", label: "Active" },
      ]}
      fields={[
        { name: "code", label: "Code" },
        { name: "label", label: "Label" },
        { name: "type", label: "Type", options: ["percent", "fixed"] },
        { name: "value", label: "Value", type: "number" },
      ]}
    />
  );
}

function CmsKind(kind: string, title: string, description: string) {
  return function Page() {
    return (
      <ResourcePage
        title={title}
        description={description}
        resource="cms"
        permission="cms:write"
        extraQuery={{ kind }}
        allowDelete
        columns={[
          { key: "title", label: "Title" },
          { key: "href", label: "Link" },
          { key: "active", label: "Active" },
        ]}
        fields={[
          { name: "kind", label: "Kind", options: [kind] },
          { name: "title", label: "Title" },
          { name: "body", label: "Body", type: "textarea" },
          { name: "href", label: "URL" },
        ]}
      />
    );
  };
}

export const MarqueePage = CmsKind("marquee", "Marquee", "Homepage ticker items with optional link.");
export { AdsPage } from "@/features/ads/AdsPage";
export { PopupsPage } from "@/features/popups/PopupsPage";
export const LinksPage = CmsKind("link", "Useful links", "Public resource links.");

export function AuditPage() {
  return (
    <ResourcePage
      title="Audit logs"
      description="Admin actions — secrets are stripped server-side."
      resource="audit"
      permission="audit:read"
      columns={[
        { key: "action", label: "Action" },
        { key: "module", label: "Module" },
        { key: "resourceId", label: "Resource" },
        { key: "ip", label: "IP" },
      ]}
      fields={[]}
    />
  );
}

export { ReferralsPage } from "@/features/referrals/ReferralsPage";

export function WhatsAppPage() {
  return <NotificationsPage reminder />;
}
