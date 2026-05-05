export function normalizeDateOnly(dateInput: string): Date {
  const [year, month, day] = dateInput.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error("Invalid date");
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

