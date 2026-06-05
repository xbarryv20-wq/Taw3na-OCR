import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

app.post("/api/extract", async (req, res) => {
  try {
    const { image, image_visa } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing 'image' parameter." });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const mistralApiKey = process.env.MISTRAL_API_KEY;

    const prompt = `You are an OCR expert. Extract fields from passport and visa OCR text into a JSON object. Extract ONLY what is clearly readable. Do NOT guess or hallucinate. Do NOT copy one date field into another.

==== PASSPORT FIELDS ====

- last_name: the surname / family name (often in CAPS).
- first_name: the given name(s) (often in CAPS).
- dob: date of birth. Convert to YYYY-MM-DD.
- passport_number: alphanumeric passport number (top right of bio page).
- issue_date: passport ISSUE date (when it was issued). This is a RECENT date (typically within the last 10-20 years). It is NOT the same as dob.
- expiry_date: passport EXPIRY date (when it expires). Usually 5-10 years AFTER issue_date.
- place_of_issue: the CITY or REGION where the passport was issued (e.g. RELIZANE, ALGIERS, ORAN). This is a place name.
  WARNING: on Algerian passports the "Authority / L'Etat / L'ETAT" field means "The State" — that is the issuing government body, NOT a place. IGNORE "L'Etat" / "The State" for this field. Use the actual city shown elsewhere (often under the "Lieu de délivrance" / "Place of Issue" label).

==== VISA STICKER FIELDS ====

- previous_visa_number: the visa number (printed near the label "ESP" or under "VISADO / VISA" on the sticker). This is NOT the passport number.
- visa_from: visa validity START date. The label on the sticker is one of:
    "DEL"   (Spanish "desde")
    "DU"    (French "du")
    "FROM"  (English)
  Convert to YYYY-MM-DD. This date is BEFORE visa_to.
- visa_to: visa validity END date. The label on the sticker is one of:
    "AL"    (Spanish "al")
    "AU"    (French "au")
    "UNTIL" (English)
  Convert to YYYY-MM-DD. This date is AFTER visa_from.

==== HARD RULES ====
1. ALL dates MUST be YYYY-MM-DD. Convert DD/MM/YYYY, DD-MM-YY, DD MMM YYYY as needed.
2. issue_date is NOT dob. issue_date is when the passport was issued (e.g. 2024-11-19). dob is when the holder was born (e.g. 1958-05-12). They are decades apart — if both dates look the same, you misread the label.
3. place_of_issue is a CITY (RELIZANE), NOT the authority (L'Etat / The State). L'Etat is the issuing government, ignore it.
4. visa_from uses DEL/DU/FROM label; visa_to uses AL/AU/UNTIL label. Do not swap them.
5. If a field is not visible, illegible, or absent, return null. Do NOT guess.

==== OUTPUT ====
Return ONLY this JSON object — no prose, no markdown fences:

{
  "document_type": "passport" | "visa" | "both" | "unknown",
  "is_blurry": boolean,
  "confidence_score": number between 0 and 1,
  "error_message": string | null,
  "extracted_data": {
    "last_name": string | null,
    "first_name": string | null,
    "dob": string | null,
    "passport_number": string | null,
    "issue_date": string | null,
    "expiry_date": string | null,
    "place_of_issue": string | null,
    "previous_visa_number": string | null,
    "visa_from": string | null,
    "visa_to": string | null
  }
}`;

    let extractedText = null;
    let usedProvider = "Mistral OCR";

    // 1. Try Mistral OCR (Primary) — purpose-built for passport / document OCR
    if (mistralApiKey) {
      try {
        const ocrImages = image_visa ? [image, image_visa] : [image];
        const ocrResults = await Promise.all(
          ocrImages.map(async (img) => {
            const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${mistralApiKey}`
              },
              body: JSON.stringify({
                model: "mistral-ocr-latest",
                document: { type: "image_url", image_url: img },
                include_image_base64: false
              })
            });
            if (!ocrResponse.ok) {
              const errBody = await ocrResponse.text();
              throw new Error(`Mistral OCR ${ocrResponse.status}: ${errBody}`);
            }
            const ocrData = await ocrResponse.json();
            return ocrData?.pages?.map((p: any) => p.markdown).filter(Boolean).join("\n\n") || "";
          })
        );

        const passportOcr = ocrResults[0] || "";
        const visaOcr = (image_visa && ocrResults[1]) ? ocrResults[1] : "";

        if (passportOcr.trim().length > 0) {
          const passportStructurePrompt = `You are an OCR expert. Extract ONLY passport bio-page fields from the OCR text below. The text below is a passport ONLY — do not invent fields from any other document.

Fields (all dates in YYYY-MM-DD):
- last_name: family name (often in CAPS)
- first_name: given names (often in CAPS)
- dob: date of birth
- passport_number: alphanumeric passport number
- issue_date: passport ISSUE date (RECENT, e.g. 2024-11-19). NOT dob.
- expiry_date: passport EXPIRY date (AFTER issue_date)
- place_of_issue: CITY or REGION of issuance. On Algerian passports this is in the "Authority / Autorité" / "Lieu de délivrance" field. It is a place name (e.g. RELIZANE, ALGIERS, ORAN). "L'Etat" / "L'ETAT" / "The State" is the issuing government, NOT a place — IGNORE it.

HARD RULES:
1. ALL dates YYYY-MM-DD.
2. issue_date is when the passport was issued (RECENT, e.g. 2024-11-19). It is NOT the birth date (DECADES AGO, e.g. 1958-05-12). If they look the same you misread the label.
3. place_of_issue is a CITY (RELIZANE, ALGIERS, ORAN), NOT the authority name (L'Etat / The State).
4. Return null for any field not clearly visible. Do NOT guess.

Output ONLY this JSON object — no prose, no fences:
{"last_name":string|null,"first_name":string|null,"dob":string|null,"passport_number":string|null,"issue_date":string|null,"expiry_date":string|null,"place_of_issue":string|null}

--- PASSPORT OCR TEXT ---
${passportOcr}`;

          const visaStructurePrompt = visaOcr
            ? `You are an OCR expert. Extract ONLY visa sticker fields from the OCR text below. The text below is a visa sticker ONLY — do not invent fields from any other document.

Fields (all dates in YYYY-MM-DD):
- previous_visa_number: visa number (near "ESP" / "VISADO" / "VISA" label). NOT the passport number.
- visa_from: validity START date. Label is one of "DEL" (Spanish), "DU" (French), "FROM" (English).
- visa_to: validity END date. Label is one of "AL" (Spanish), "AU" (French), "UNTIL" (English). AFTER visa_from.

HARD RULES:
1. ALL dates YYYY-MM-DD.
2. visa_from uses DEL/DU/FROM label; visa_to uses AL/AU/UNTIL label. Do not swap.
3. Return null for any field not clearly visible.

Output ONLY this JSON — no prose, no fences:
{"previous_visa_number":string|null,"visa_from":string|null,"visa_to":string|null}

--- VISA STICKER OCR TEXT ---
${visaOcr}`
            : null;

          const makeStructureCall = (userPrompt: string) =>
            fetch("https://api.mistral.ai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${mistralApiKey}`
              },
              body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [
                  { role: "system", content: "You extract structured JSON from OCR text exactly as instructed. Output only the JSON object, no other text or markdown fences." },
                  { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" }
              })
            });

          const calls: Promise<Response>[] = [makeStructureCall(passportStructurePrompt)];
          if (visaStructurePrompt) calls.push(makeStructureCall(visaStructurePrompt));

          const [passportRes, visaRes] = await Promise.all(calls);

          const passportPayload = passportRes.ok ? await passportRes.json() : null;
          const visaPayload = visaRes && visaRes.ok ? await visaRes.json() : null;

          let passportFields: any = null;
          let visaFields: any = null;
          try { passportFields = passportPayload?.choices?.[0]?.message?.content ? JSON.parse(passportPayload.choices[0].message.content) : null; } catch (_) {}
          try { visaFields = visaPayload?.choices?.[0]?.message?.content ? JSON.parse(visaPayload.choices[0].message.content) : null; } catch (_) {}

          if (passportFields) {
            const merged = {
              document_type: visaFields ? "both" : "passport",
              is_blurry: false,
              confidence_score: 0.9,
              error_message: null,
              extracted_data: {
                last_name: passportFields.last_name ?? null,
                first_name: passportFields.first_name ?? null,
                dob: passportFields.dob ?? null,
                passport_number: passportFields.passport_number ?? null,
                issue_date: passportFields.issue_date ?? null,
                expiry_date: passportFields.expiry_date ?? null,
                place_of_issue: passportFields.place_of_issue ?? null,
                previous_visa_number: visaFields?.previous_visa_number ?? null,
                visa_from: visaFields?.visa_from ?? null,
                visa_to: visaFields?.visa_to ?? null
              }
            };
            extractedText = JSON.stringify(merged);
          }
        }
      } catch (ocrErr) {
        console.warn("Mistral OCR pipeline failed, falling back to Gemini:", ocrErr);
      }
    }

    // 2. Fallback to Gemini if Mistral OCR failed
    if (!extractedText && geminiApiKey) {
      usedProvider = "Gemini";
      try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const parts: any[] = [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ];

        if (image_visa) {
          const base64DataVisa = image_visa.replace(/^data:image\/\w+;base64,/, "");
          parts.push({ inlineData: { mimeType: "image/jpeg", data: base64DataVisa } });
        }

        let geminiData;
        for (let attempt = 0; attempt < 2; attempt++) {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: { responseMimeType: "application/json" }
              })
            }
          );

          if (geminiResponse.status === 429 && attempt < 1) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          if (geminiResponse.ok) {
            geminiData = await geminiResponse.json();
            extractedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
            break;
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini OCR extraction failed, falling back to Mistral:", geminiErr);
      }
    }

    // 3. Final fallback to Mistral chat (pixtral) if both above failed
    if (!extractedText && mistralApiKey) {
      usedProvider = "Mistral";
      try {
        const contentParts: any[] = [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } }
        ];

        if (image_visa) {
          contentParts.push({ type: "image_url", image_url: { url: image_visa } });
        }

        const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mistralApiKey}`
          },
          body: JSON.stringify({
            model: "pixtral-large-latest",
            messages: [{ role: "user", content: contentParts }],
            response_format: { type: "json_object" }
          })
        });

        if (mistralResponse.ok) {
          const mistralData = await mistralResponse.json();
          extractedText = mistralData?.choices?.[0]?.message?.content;
        } else {
          const errBody = await mistralResponse.text();
          console.error(`Mistral fallback API error: ${errBody}`);
        }
      } catch (mistralErr) {
        console.error("Mistral fallback OCR extraction failed:", mistralErr);
      }
    }

    if (!extractedText) {
      throw new Error("Both Gemini and Mistral OCR extraction endpoints failed or returned empty results.");
    }

    console.log(`Successfully extracted data using ${usedProvider}`);
    const cleanedJson = extractedText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    res.json(JSON.parse(cleanedJson));

  } catch (err: any) {
    console.error("Extraction Endpoint Error:", err);
    res.status(500).json({ error: err.message || "Internal server error during data extraction." });
  }
});

app.post("/api/ocr-proxy", async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "Missing image" });

  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OCR API Key not configured" });

  const formData = new URLSearchParams();
  formData.append("base64image", image);
  formData.append("apikey", apiKey);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("filetype", "JPG");

  try {
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "OCR provider error: " + err.message });
  }
});

app.post("/api/push-to-supabase", async (req, res) => {
  try {
    const clientData = req.body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase credentials missing in backend environment variables.");
      return res.json({
        success: false,
        simulated: true,
        message: "No live database credentials (SUPABASE_URL and SUPABASE_ANON_KEY) configured in the backend environment. Saved to local state and generated standard code outputs.",
        debug_payload: clientData
      });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    const endpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/clients`
      : `${cleanUrl}/rest/v1/clients`;

    console.log(`Forwarding insert to Supabase: ${endpoint}`);

    const row = {
      last_name: clientData.last_name,
      first_name: clientData.first_name,
      passport_number: clientData.passport_number,
      dob: clientData.dob,
      issue_date: clientData.issue_date,
      expiry_date: clientData.expiry_date,
      place_of_issue: clientData.place_of_issue,
      previous_visa_number: clientData.previous_visa_number,
      visa_from: clientData.visa_from,
      visa_to: clientData.visa_to,
      phone_number: clientData.phone_number,
      category: clientData.category,
      payment: clientData.payment,
      photo_url: clientData.client_pic || null,
      photo_url_1: clientData.visa_pic || null,
      appointment_date: clientData.appointment_date || new Date().toISOString().split("T")[0],
      account_email: clientData.account_email,
      staff_member: clientData.staff_member || '',
      user_id: clientData.user_id || '7a7165b8-716d-4d96-aa64-f8a02d1fbc0f',
    };

    let attempts = 0;
    const maxAttempts = 15;
    let currentRow = { ...row };
    let finalResponseData = null;
    let strippedColumns: string[] = [];

    while (attempts < maxAttempts) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(currentRow)
      });

      if (response.ok) {
        finalResponseData = await response.json().catch(() => ({}));
        break;
      }

      const errText = await response.text();
      let errObj: any = null;
      try {
        errObj = JSON.parse(errText);
      } catch (_) {}

      const errCode = errObj?.code;
      const errMsg = errObj?.message || errText || response.statusText;

      const isMissingColumnError =
        errCode === "42703" ||
        errCode === "PGRST205" ||
        errCode === "PGRST200" ||
        (errMsg && (
          (errMsg.includes("column") && errMsg.includes("does not exist")) ||
          (errMsg.includes("column") && errMsg.includes("schema cache")) ||
          (errMsg.includes("Could not find") && errMsg.includes("column"))
        ));

      if (isMissingColumnError) {
        let missingColumn = "";

        const pgMatch = errMsg.match(/column "([^"]+)"/);
        if (pgMatch && pgMatch[1]) {
          missingColumn = pgMatch[1];
        } else {
          const postgrestMatch = errMsg.match(/Could not find the '([^']+)' column/);
          if (postgrestMatch && postgrestMatch[1]) {
            missingColumn = postgrestMatch[1];
          }
        }

        if (missingColumn) {
          console.warn(`[Supabase Sync] Stripping missing table column "${missingColumn}" and retrying...`);
          delete (currentRow as any)[missingColumn];
          strippedColumns.push(missingColumn);
          attempts++;
          continue;
        }
      }

      if (errCode === "42P01" || (errMsg && errMsg.includes("relation") && errMsg.includes("does not exist"))) {
        throw new Error("Table 'clients' does not exist in your Supabase database. Please create a 'clients' table in your Supabase database first.");
      }

      if (errCode === "23505" || (errMsg && errMsg.includes("duplicate key"))) {
        throw new Error(`Duplicate entry: An applicant with passport number '${currentRow.passport_number}' is already registered in your database.`);
      }

      if (errCode === "23502" || (errMsg && errMsg.includes("violates not-null constraint"))) {
        throw new Error(
          `Supabase Database Constraint: ${errMsg}\n\n` +
          "Run this in your Supabase dashboard SQL Editor to make columns optional:\n\n" +
          "ALTER TABLE public.clients ALTER COLUMN user_id DROP NOT NULL;\n" +
          "ALTER TABLE public.clients ALTER COLUMN appointment_date DROP NOT NULL;"
        );
      }

      if (response.status === 401 || response.status === 403 || errCode === "42501" || (errMsg && errMsg.includes("permission denied"))) {
        throw new Error(
          "Supabase RLS Permissions Blocked: Insert permission denied.\n\n" +
          "Run this in your Supabase dashboard SQL Editor:\n\n" +
          "ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;\n\n" +
          "CREATE POLICY \"Allow public insertions\" ON public.clients FOR INSERT WITH CHECK (true);"
        );
      }

      console.error(`[Supabase Sync Failed] Response status ${response.status}:`, errMsg);
      throw new Error(errMsg);
    }

    if (attempts >= maxAttempts) {
      throw new Error("Maximum database schema resolution attempts exceeded.");
    }

    const prunesMsg = strippedColumns.length > 0
      ? ` (Pruned missing columns: ${strippedColumns.join(", ")})`
      : "";

    return res.json({
      success: true,
      simulated: false,
      message: `Data successfully synchronized and saved directly to your Supabase instances!${prunesMsg}`,
      data: finalResponseData
    });

  } catch (err: any) {
    console.error("Supabase Proxy Sync Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected database exception occurred while pushing to Supabase."
    });
  }
});

app.post("/api/update-in-supabase", async (req, res) => {
  try {
    const { original_passport_number, clientData } = req.body;
    if (!original_passport_number || !clientData) {
      return res.status(400).json({ error: "Missing 'original_passport_number' or 'clientData' parameter in request body." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase credentials missing in backend environment variables for updating.");
      return res.json({
        success: false,
        simulated: true,
        message: "No live database credentials (SUPABASE_URL and SUPABASE_ANON_KEY) configured. Updated in local state only."
      });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    const baseEndpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/clients`
      : `${cleanUrl}/rest/v1/clients`;

    const endpoint = `${baseEndpoint}?passport_number=eq.${encodeURIComponent(original_passport_number)}`;

    console.log(`Forwarding update (PATCH) to Supabase: ${endpoint}`);

    const row = {
      last_name: clientData.last_name,
      first_name: clientData.first_name,
      passport_number: clientData.passport_number,
      dob: clientData.dob,
      issue_date: clientData.issue_date,
      expiry_date: clientData.expiry_date,
      place_of_issue: clientData.place_of_issue,
      previous_visa_number: clientData.previous_visa_number,
      visa_from: clientData.visa_from,
      visa_to: clientData.visa_to,
      phone_number: clientData.phone_number,
      category: clientData.category,
      payment: clientData.payment,
      photo_url: clientData.client_pic || null,
      photo_url_1: clientData.visa_pic || null,
      appointment_date: clientData.appointment_date || new Date().toISOString().split("T")[0],
      account_email: clientData.account_email,
      staff_member: clientData.staff_member || '',
      user_id: clientData.user_id || '7a7165b8-716d-4d96-aa64-f8a02d1fbc0f',
    };

    let attempts = 0;
    const maxAttempts = 15;
    let currentRow = { ...row };
    let finalResponseData = null;
    let strippedColumns: string[] = [];

    while (attempts < maxAttempts) {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(currentRow)
      });

      if (response.ok) {
        finalResponseData = await response.json().catch(() => ({}));
        break;
      }

      const errText = await response.text();
      let errObj: any = null;
      try {
        errObj = JSON.parse(errText);
      } catch (_) {}

      const errCode = errObj?.code;
      const errMsg = errObj?.message || errText || response.statusText;

      const isMissingColumnError =
        errCode === "42703" ||
        errCode === "PGRST205" ||
        errCode === "PGRST200" ||
        (errMsg && (
          (errMsg.includes("column") && errMsg.includes("does not exist")) ||
          (errMsg.includes("column") && errMsg.includes("schema cache")) ||
          (errMsg.includes("Could not find") && errMsg.includes("column"))
        ));

      if (isMissingColumnError) {
        let missingColumn = "";
        const pgMatch = errMsg.match(/column "([^"]+)"/);
        if (pgMatch && pgMatch[1]) {
          missingColumn = pgMatch[1];
        } else {
          const postgrestMatch = errMsg.match(/Could not find the '([^']+)' column/);
          if (postgrestMatch && postgrestMatch[1]) {
            missingColumn = postgrestMatch[1];
          }
        }

        if (missingColumn) {
          console.warn(`[Supabase Update Sync] Stripping missing table column "${missingColumn}" and retrying...`);
          delete (currentRow as any)[missingColumn];
          strippedColumns.push(missingColumn);
          attempts++;
          continue;
        }
      }

      console.error(`[Supabase Update Failed] Response status ${response.status}:`, errMsg);
      throw new Error(errMsg);
    }

    if (attempts >= maxAttempts) {
      throw new Error("Maximum database schema resolution attempts exceeded during update.");
    }

    const prunesMsg = strippedColumns.length > 0
      ? ` (Pruned missing columns: ${strippedColumns.join(", ")})`
      : "";

    return res.json({
      success: true,
      simulated: false,
      message: `Data successfully updated and propagate synced directly to Supabase!${prunesMsg}`,
      data: finalResponseData
    });

  } catch (err: any) {
    console.error("Supabase Proxy Update Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected database exception occurred while updating on Supabase."
    });
  }
});

app.delete("/api/delete-from-supabase", async (req, res) => {
  try {
    const { passport_number } = req.body;
    if (!passport_number) {
      return res.status(400).json({ error: "Missing 'passport_number' parameter in request body." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase credentials missing in backend environment variables for deletion.");
      return res.json({
        success: false,
        simulated: true,
        message: "No live database credentials (SUPABASE_URL and SUPABASE_ANON_KEY) configured to propagate deletion. Removed from local state only."
      });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    const baseEndpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/clients`
      : `${cleanUrl}/rest/v1/clients`;

    const endpoint = `${baseEndpoint}?passport_number=eq.${encodeURIComponent(passport_number)}`;

    console.log(`Forwarding delete to Supabase: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Prefer": "return=representation"
      }
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.json({
        success: true,
        simulated: false,
        message: `Successfully synchronized and deleted client with passport '${passport_number}' from Supabase instances!`,
        data
      });
    } else {
      const errText = await response.text();
      console.error(`[Supabase Delete Failed] Response status ${response.status}:`, errText);
      return res.status(response.status).json({
        success: false,
        error: `Supabase returned status ${response.status}: ${errText}`
      });
    }

  } catch (err: any) {
    console.error("Supabase Proxy Delete Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected database exception occurred while deleting from Supabase."
    });
  }
});

// API endpoint to fetch clients from Supabase for taw3na account
app.get("/api/clients", async (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.json({ success: false, clients: [], message: "No Supabase credentials configured." });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
    const endpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/clients?user_id=eq.7a7165b8-716d-4d96-aa64-f8a02d1fbc0f&order=created_at.desc`
      : `${cleanUrl}/rest/v1/clients?user_id=eq.7a7165b8-716d-4d96-aa64-f8a02d1fbc0f&order=created_at.desc`;

    const response = await fetch(endpoint, {
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
      }
    });

    if (!response.ok) {
      return res.status(500).json({ success: false, clients: [], message: `Supabase returned ${response.status}` });
    }

    const data = await response.json();
    res.json({ success: true, clients: data });
  } catch (err: any) {
    console.error("Error fetching clients:", err);
    res.status(500).json({ success: false, clients: [], message: err.message });
  }
});

// API endpoint to fetch staff directory from Supabase
app.get("/api/staff", async (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.json({ success: false, staff: [], message: "No Supabase credentials configured." });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
    const endpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/agency_staff?order=created_at.asc`
      : `${cleanUrl}/rest/v1/agency_staff?order=created_at.asc`;

    const response = await fetch(endpoint, {
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
      }
    });

    if (!response.ok) {
      return res.status(500).json({ success: false, staff: [], message: `Supabase returned ${response.status}` });
    }

    const data = await response.json();
    res.json({ success: true, staff: data });
  } catch (err: any) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ success: false, staff: [], message: err.message });
  }
});

// API endpoint to add a staff member
app.post("/api/staff", async (req, res) => {
  try {
    const { name, avatar_url } = req.body;
    if (!name) return res.status(400).json({ error: "Missing 'name' parameter." });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase credentials not configured." });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
    const endpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/agency_staff`
      : `${cleanUrl}/rest/v1/agency_staff`;

    const staff_id = "staff_" + Date.now().toString(36);
    const body = { staff_id, name, avatar_url: avatar_url || null };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText);
    }

    const data = await response.json();
    res.json({ success: true, staff: Array.isArray(data) ? data[0] : data });
  } catch (err: any) {
    console.error("Error adding staff:", err);
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to update a staff member
app.put("/api/staff/:staff_id", async (req, res) => {
  try {
    const { staff_id } = req.params;
    const { name, avatar_url } = req.body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase credentials not configured." });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
    const baseEndpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/agency_staff`
      : `${cleanUrl}/rest/v1/agency_staff`;
    const endpoint = `${baseEndpoint}?staff_id=eq.${encodeURIComponent(staff_id)}`;

    const body: any = {};
    if (name !== undefined) body.name = name;
    if (avatar_url !== undefined) body.avatar_url = avatar_url;

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText);
    }

    const data = await response.json();
    res.json({ success: true, staff: Array.isArray(data) ? data[0] : data });
  } catch (err: any) {
    console.error("Error updating staff:", err);
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to delete a staff member
app.delete("/api/staff/:staff_id", async (req, res) => {
  try {
    const { staff_id } = req.params;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase credentials not configured." });
    }

    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
    const baseEndpoint = cleanUrl.includes("/rest/v1")
      ? `${cleanUrl}/agency_staff`
      : `${cleanUrl}/rest/v1/agency_staff`;
    const endpoint = `${baseEndpoint}?staff_id=eq.${encodeURIComponent(staff_id)}`;

    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Prefer": "return=representation"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText);
    }

    const data = await response.json().catch(() => ({}));
    res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error deleting staff:", err);
    res.status(500).json({ error: err.message });
  }
});

// Serve static files in production
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
