export type InstallmentRow = { sequence: number; amount: number; dueDate: string };

export function buildInstallmentPreview(
  fee: number,
  parts = 3,
  minFeeForEmi = 8000,
  start = new Date(),
): { allowed: boolean; parts: number; perInstallment: number; schedule: InstallmentRow[] } {
  if (parts <= 1 || fee < minFeeForEmi) {
    return { allowed: false, parts: 1, perInstallment: fee, schedule: [] };
  }
  const perInstallment = Math.ceil(fee / parts);
  const schedule = Array.from({ length: parts }, (_, i) => {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    return {
      sequence: i + 1,
      amount: perInstallment,
      dueDate: due.toISOString().slice(0, 10),
    };
  });
  return { allowed: true, parts, perInstallment, schedule };
}

export function courseFee(row: Record<string, unknown> | undefined) {
  return Number(row?.fee ?? 0);
}
