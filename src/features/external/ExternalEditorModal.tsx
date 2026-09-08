import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useCreateMutation, usePatchMutation } from "@/app/api";
import { toast } from "@/components/Toast";

const schema = z.object({
  serialNo: z.string().optional(),
  studentName: z.string().min(2, "Student name is required"),
  batchTime: z.string().optional(),
  address: z.string().optional(),
  course: z.string().optional(),
  admissionDate: z.string().optional(),
  contactNo: z.string().optional(),
  klic120: z.string().optional(),
  klic60: z.string().optional(),
  klic30: z.string().optional(),
  inst1Amount: z.string().optional(),
  inst1Date: z.string().optional(),
  inst2Amount: z.string().optional(),
  inst2Date: z.string().optional(),
  inst3Amount: z.string().optional(),
  inst3Date: z.string().optional(),
  inst4Amount: z.string().optional(),
  inst4Date: z.string().optional(),
  paidFees: z.string().optional(),
  balanceFees: z.string().optional(),
  totalFees: z.string().optional(),
  sessionLabel: z.string().optional(),
  programLabel: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export type ExternalRow = {
  _id?: string;
  serialNo?: number;
  studentName?: string;
  batchTime?: string;
  address?: string;
  course?: string;
  admissionDate?: string;
  contactNo?: string;
  klic120?: string;
  klic60?: string;
  klic30?: string;
  installments?: { amount?: number; date?: string }[];
  paidFees?: number;
  balanceFees?: number;
  totalFees?: number;
  sessionLabel?: string;
  programLabel?: string;
};

function numStr(v?: number | string | null) {
  if (v == null || v === "") return "";
  return String(v);
}

function toBody(values: FormValues) {
  const installments = [
    { amount: values.inst1Amount ? Number(values.inst1Amount) : undefined, date: values.inst1Date || undefined },
    { amount: values.inst2Amount ? Number(values.inst2Amount) : undefined, date: values.inst2Date || undefined },
    { amount: values.inst3Amount ? Number(values.inst3Amount) : undefined, date: values.inst3Date || undefined },
    { amount: values.inst4Amount ? Number(values.inst4Amount) : undefined, date: values.inst4Date || undefined },
  ];
  return {
    serialNo: values.serialNo ? Number(values.serialNo) : undefined,
    studentName: values.studentName.trim(),
    batchTime: values.batchTime?.trim() || undefined,
    address: values.address?.trim() || undefined,
    course: values.course?.trim() || undefined,
    admissionDate: values.admissionDate?.trim() || undefined,
    contactNo: values.contactNo?.trim() || undefined,
    klic120: values.klic120?.trim() || undefined,
    klic60: values.klic60?.trim() || undefined,
    klic30: values.klic30?.trim() || undefined,
    installments,
    paidFees: values.paidFees ? Number(values.paidFees) : 0,
    balanceFees: values.balanceFees ? Number(values.balanceFees) : undefined,
    totalFees: values.totalFees ? Number(values.totalFees) : 0,
    sessionLabel: values.sessionLabel?.trim() || "ADMISSION-2026",
    programLabel: values.programLabel?.trim() || "MS-CIT + KLiC",
  };
}

export function ExternalEditorModal({
  open,
  row,
  onClose,
  onSaved,
}: {
  open: boolean;
  row: ExternalRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [create, createState] = useCreateMutation();
  const [patch, patchState] = usePatchMutation();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sessionLabel: "ADMISSION-2026",
      programLabel: "MS-CIT + KLiC",
    },
  });

  useEffect(() => {
    if (!open) return;
    const inst = row?.installments ?? [];
    form.reset({
      serialNo: numStr(row?.serialNo),
      studentName: row?.studentName ?? "",
      batchTime: row?.batchTime ?? "",
      address: row?.address ?? "",
      course: row?.course ?? "",
      admissionDate: row?.admissionDate ?? "",
      contactNo: row?.contactNo ?? "",
      klic120: row?.klic120 ?? "",
      klic60: row?.klic60 ?? "",
      klic30: row?.klic30 ?? "",
      inst1Amount: numStr(inst[0]?.amount),
      inst1Date: inst[0]?.date ?? "",
      inst2Amount: numStr(inst[1]?.amount),
      inst2Date: inst[1]?.date ?? "",
      inst3Amount: numStr(inst[2]?.amount),
      inst3Date: inst[2]?.date ?? "",
      inst4Amount: numStr(inst[3]?.amount),
      inst4Date: inst[3]?.date ?? "",
      paidFees: numStr(row?.paidFees),
      balanceFees: numStr(row?.balanceFees),
      totalFees: numStr(row?.totalFees),
      sessionLabel: row?.sessionLabel ?? "ADMISSION-2026",
      programLabel: row?.programLabel ?? "MS-CIT + KLiC",
    });
  }, [open, row, form]);

  async function onSubmit(values: FormValues) {
    const body = toBody(values);
    try {
      if (row?._id) {
        await patch({ resource: "external-admissions", id: String(row._id), body }).unwrap();
        toast("Record updated");
      } else {
        await create({ resource: "external-admissions", body }).unwrap();
        toast("Record added");
      }
      onSaved();
      onClose();
    } catch {
      toast("Save failed", "error");
    }
  }

  const busy = createState.isLoading || patchState.isLoading;

  return (
    <Modal open={open} title={row?._id ? "Edit external record" : "Add external record"} onClose={onClose}>
      <form className="max-h-[75vh] space-y-4 overflow-y-auto pr-1" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Session"><Input {...form.register("sessionLabel")} placeholder="ADMISSION-2026" /></Field>
          <Field label="Program"><Input {...form.register("programLabel")} placeholder="MS-CIT + KLiC" /></Field>
          <Field label="Sr. No."><Input type="number" {...form.register("serialNo")} /></Field>
          <Field label="Student's name" error={form.formState.errors.studentName?.message}>
            <Input {...form.register("studentName")} />
          </Field>
          <Field label="Batch time"><Input {...form.register("batchTime")} placeholder="10.00 AM" /></Field>
          <Field label="Contact no."><Input {...form.register("contactNo")} /></Field>
          <Field label="Address"><Input {...form.register("address")} /></Field>
          <Field label="Course"><Input {...form.register("course")} placeholder="MS-CIT" /></Field>
          <Field label="Admission date"><Input {...form.register("admissionDate")} placeholder="01-09-2026" /></Field>
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">KLiC course (120 / 60 / 30 hr)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="120 Hr"><Input {...form.register("klic120")} placeholder="KLiC Hardware" /></Field>
            <Field label="60 Hr"><Input {...form.register("klic60")} /></Field>
            <Field label="30 Hr"><Input {...form.register("klic30")} /></Field>
          </div>
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Installment fees</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="1st amount"><Input type="number" {...form.register("inst1Amount")} /></Field>
            <Field label="1st date"><Input {...form.register("inst1Date")} placeholder="07/01" /></Field>
            <Field label="2nd amount"><Input type="number" {...form.register("inst2Amount")} /></Field>
            <Field label="2nd date"><Input {...form.register("inst2Date")} /></Field>
            <Field label="3rd amount"><Input type="number" {...form.register("inst3Amount")} /></Field>
            <Field label="3rd date"><Input {...form.register("inst3Date")} /></Field>
            <Field label="4th amount"><Input type="number" {...form.register("inst4Amount")} /></Field>
            <Field label="4th date"><Input {...form.register("inst4Date")} /></Field>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Paid fees"><Input type="number" {...form.register("paidFees")} /></Field>
          <Field label="Balance fees"><Input type="number" {...form.register("balanceFees")} /></Field>
          <Field label="Total fees"><Input type="number" {...form.register("totalFees")} /></Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : row?._id ? "Update" : "Add record"}</Button>
        </div>
      </form>
    </Modal>
  );
}
