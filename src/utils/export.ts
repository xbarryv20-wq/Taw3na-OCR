import { ClientRecord } from "../types";

function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportClientsToCSV(records: ClientRecord[]): string {
  const columns = [
    "last_name",
    "first_name",
    "passport_number",
    "dob",
    "issue_date",
    "expiry_date",
    "place_of_issue",
    "previous_visa_number",
    "visa_from",
    "visa_to",
    "phone_number",
    "category",
    "price",
    "versment",
    "rest",
    "staff_member",
    "account_email",
    "created_at",
  ];

  const lines: string[] = [columns.join(",")];
  for (const r of records) {
    const price = parseFloat(r.payment?.price || "0");
    const vers = parseFloat(r.payment?.versment || "0");
    const rest = Math.max(0, price - vers);
    const values = [
      r.last_name,
      r.first_name,
      r.passport_number,
      r.dob,
      r.issue_date,
      r.expiry_date,
      r.place_of_issue,
      r.previous_visa_number,
      r.visa_from,
      r.visa_to,
      r.phone_number,
      r.category,
      r.payment?.price,
      r.payment?.versment,
      rest,
      r.staff_member,
      r.account_email,
      r.created_at,
    ];
    lines.push(values.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function exportClientsToJSON(records: ClientRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatCurrency(value: number, currency = "M"): string {
  if (Number.isNaN(value)) return `0 ${currency}`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}
