export function whatsappDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function whatsappLink(phone: string, text: string) {
  const digits = whatsappDigits(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function feeReminderText(opts: {
  name: string;
  studentCode: string;
  totalDue: number;
  nextDueAmount?: number;
  nextDueDate?: string;
}) {
  const lines = [
    `Dear Parent/Guardian,`,
    ``,
    `This is a fee reminder from Optech Computer Institute for ${opts.name} (Student ID: ${opts.studentCode}).`,
    ``,
    `Outstanding fees: ₹${opts.totalDue.toLocaleString("en-IN")}`,
  ];
  if (opts.nextDueAmount && opts.nextDueDate) {
    lines.push(
      `Next due: ₹${Number(opts.nextDueAmount).toLocaleString("en-IN")} on ${new Date(opts.nextDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    );
  }
  lines.push(
    ``,
    `Please visit the institute or contact us to clear the pending amount at the earliest.`,
    ``,
    `Thank you,`,
    `Optech Computer Institute`,
  );
  return lines.join("\n");
}
