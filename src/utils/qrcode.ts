import QRCode from "qrcode";

export async function generateQRDataURL(text: string, size = 240): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: {
      dark: "#0f172a",
      light: "#ffffffff",
    },
  });
}

export function buildClientSummaryString(rec: {
  last_name?: string | null;
  first_name?: string | null;
  passport_number?: string | null;
  category?: string;
  phone_number?: string | null;
  dob?: string | null;
  staff_member?: string;
}): string {
  return [
    `Taw3na Client`,
    `Name: ${rec.last_name || ""} ${rec.first_name || ""}`.trim(),
    `Passport: ${rec.passport_number || "—"}`,
    `DOB: ${rec.dob || "—"}`,
    `Category: ${rec.category || "—"}`,
    `Phone: ${rec.phone_number || "—"}`,
    `Staff: ${rec.staff_member || "—"}`,
  ].join("\n");
}
