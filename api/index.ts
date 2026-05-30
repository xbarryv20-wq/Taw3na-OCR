import express from "express";
import path from "path";
import { Mistral } from "@mistralai/mistralai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

let mistralClient: Mistral | null = null;
function getMistralClient(): Mistral {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY environment variable is missing.");
    }
    mistralClient = new Mistral({
      apiKey: apiKey,
    });
  }
  return mistralClient;
}

app.post("/api/extract", async (req, res) => {
  try {
    const { image, category } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing 'image' parameter." });
    }

    const mistral = getMistralClient();

    const prompt = `
You are an expert OCR and visa processing agent. Examine the uploaded image and extract passport or visa details into a valid JSON object.

CRITICAL INSTRUCTIONS:
- last_name: Extract the family name/surname. DO NOT SWAP with given names.
- first_name: Extract the given names.
- Date fields (dob, issue_date, expiry_date, visa_from, visa_to): YOU MUST FORMAT ALL DATES STRICTLY AS YYYY-MM-DD. If the input is DD/MM/YYYY, convert it to YYYY-MM-DD.

Follow this schema:
{
  "document_type": "passport" | "visa" | "unknown",
  "is_blurry": boolean,
  "confidence_score": number,
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
}
`;

    let response;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        response = await mistral.chat.complete({
          model: "pixtral-12b-2409",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", imageUrl: image }
            ]
          }],
          responseFormat: { type: "json_object" }
        });
        break;
      } catch (err: any) {
        attempt++;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, attempt * 5000));
          continue;
        }
        throw err;
      }
    }

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error("Failed to get response from Mistral.");
    }

    const outputText = response.choices[0].message.content as string;
    const cleanedJson = outputText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    res.json(JSON.parse(cleanedJson));

  } catch (err: any) {
    console.error("Mistral Extraction Error:", err);
    res.status(500).json({ error: err.message || "Internal server error." });
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

// Serve static files in production
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
