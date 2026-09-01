export function loc(value: unknown) {
  if (value && typeof value === "object" && "en" in (value as object)) {
    return String((value as { en: string }).en);
  }
  if (value == null) return "";
  return String(value);
}

export function rupees(n: unknown) {
  const v = Number(n ?? 0);
  return `₹${v.toLocaleString("en-IN")}`;
}

export function isoDate(d?: string) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}
