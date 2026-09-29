export interface Job {
  id: string;
  name: string;
  status: "pending";
  createdAt: Date;
}

export class InvalidNameError extends Error {}

export function normalizeName(value: unknown): string {
  if (typeof value !== "string")
    throw new InvalidNameError("name must contain 1 to 120 characters");
  const name = value.trim();
  if (Array.from(name).length < 1 || Array.from(name).length > 120) {
    throw new InvalidNameError("name must contain 1 to 120 characters");
  }
  return name;
}
