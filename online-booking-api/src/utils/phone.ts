const PHONE_PATTERN = /^(\+7|7|8)?9\d{9}$/;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return "+7" + digits.slice(1);
  }

  if (digits.length === 10 && digits.startsWith("9")) {
    return "+7" + digits;
  }

  return raw.trim();
}

export function isValidPhone(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return PHONE_PATTERN.test(normalized.replace(/\D/g, ""));
}
