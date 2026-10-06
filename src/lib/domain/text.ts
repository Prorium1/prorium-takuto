export function normalizeMonthlyNotes(text: string) {
  return text.replace(/\r\n?/g, "\n").trim();
}
