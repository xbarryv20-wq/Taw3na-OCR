import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limit to handle base64 image submissions
app.use(express.json({ limit: "50mb" }));

// API endpoint for intelligent passport/visa data extraction using Gemini REST API
app.post("/api/extract", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing 'image' parameter." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing." });
    }

    const prompt = `You are an OCR expert. Extract fields from the document image into JSON. Do NOT make up values — only extract what you can clearly read.

Field mapping — use these exact labels on the document:
- last_name: the surname / family name (e.g. "SMITH")
- first_name: the given name(s) (e.g. "John")
- dob: date of birth — label says "Date of Birth" or "DOB"
- passport_number: passport number — label says "Passport No." or "Passport Number"
- issue_date: date of issue — label says "Date of Issue" or "Issued"
- expiry_date: date of expiry — label says "Date of Expiry" or "Expires"
- place_of_issue: place of issue — label says "Place of Issue" or "Issuing Authority"
- previous_visa_number: visa number — found next to the label "ESP" (NOT passport number)
- visa_from: visa valid from date — label says "Du" or "Del" (French "from")
- visa_to: visa valid until date — label says "Au" or "Al" (French "until")

CRITICAL:
- ALL dates MUST be YYYY-MM-DD format. Convert DD/MM/YYYY if needed.
- DO NOT mix up dates. Each date field has a specific label on the document. Read the label carefully.
- If a field is not visible on the document, set it to null. Do NOT guess.

Output JSON schema:
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
}`;

    // Strip data URL prefix to get raw base64 for Gemini
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    let geminiData;
    for (let attempt = 0; attempt < 3; attempt++) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Data } }
              ]
            }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (geminiResponse.status === 429 && attempt < 2) {
        // Rate limited — wait 2s then retry
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!geminiResponse.ok) {
        const errBody = await geminiResponse.text();
        throw new Error(`Gemini API error (${geminiResponse.status}): ${errBody}`);
      }
      geminiData = await geminiResponse.json();
      break;
    }
    const outputText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!outputText) {
      const blockReason = geminiData?.promptFeedback?.blockReason;
      throw new Error(blockReason ? `Prompt blocked: ${blockReason}` : "Empty response from Gemini.");
    }

    const cleanedJson = outputText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    res.json(JSON.parse(cleanedJson));

  } catch (err: any) {
    console.error("Gemini Extraction Error:", err);
    res.status(500).json({ error: err.message || "Internal server error." });
  }
});

// API endpoint for OCR.space proxy
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

// API endpoint to push applicant data directly to the Supabase database
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

    // Clean up base URL and ensure correct rest endpoint without double pathing
    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    
    // If user URL already contains /rest/v1 (e.g. from postgrest config copy-pastes), don't double-append it
    const endpoint = cleanUrl.includes("/rest/v1") 
      ? `${cleanUrl}/clients` 
      : `${cleanUrl}/rest/v1/clients`;

    console.log(`Forwarding insert to Supabase: ${endpoint}`);

    // Map the payload keys cleanly to match the database schema
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
      payment: clientData.payment, // Matches jsonb type in schema
      photo_url: clientData.client_pic || null, // Maps to main applicant face photo in DB
      photo_url_1: clientData.visa_pic || null, // Maps to second uploaded image in DB (visa sticker if uploaded)
      appointment_date: clientData.appointment_date || new Date().toISOString().split("T")[0], // Matches NOT NULL field in schema, auto-stripped if missing in DB
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

      // Handle undefined column error: Postgres error code "42703" or PGRST200/PGRST204/PGRST205 for missing column
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
        
        // Pattern A: column "xxx" of relation "yyy" does not exist
        const pgMatch = errMsg.match(/column "([^"]+)"/);
        if (pgMatch && pgMatch[1]) {
          missingColumn = pgMatch[1];
        } else {
          // Pattern B: Could not find the 'xxx' column of 'yyy' in the schema cache
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

      // Handle table not found error: Postgres error code "42P01"
      if (errCode === "42P01" || (errMsg && errMsg.includes("relation") && errMsg.includes("does not exist"))) {
        throw new Error("Table 'clients' does not exist in your Supabase database. Please create a 'clients' table in your Supabase database first.");
      }

      // Handle unique violation / duplicate key: Postgres error code "23505"
      if (errCode === "23505" || (errMsg && errMsg.includes("duplicate key"))) {
        throw new Error(`Duplicate entry: An applicant with passport number '${currentRow.passport_number}' is already registered in your database.`);
      }

      // Handle NOT NULL constraint violations (e.g. null value in column "user_id" violates not-null constraint)
      if (errCode === "23502" || (errMsg && errMsg.includes("violates not-null constraint"))) {
        throw new Error(
          `Supabase Database Constraint: ${errMsg}\n\n` +
          "🔧 QUICK FIX SQL SCRIPT:\n" +
          "Run this in your Supabase dashboard SQL Editor to make columns optional for offline registry submissions:\n\n" +
          "ALTER TABLE public.clients ALTER COLUMN user_id DROP NOT NULL;\n" +
          "ALTER TABLE public.clients ALTER COLUMN appointment_date DROP NOT NULL;"
        );
      }

      // Handle row-level policy (RLP) or permission blocks: Oracle/Postgres API blocks
      if (response.status === 401 || response.status === 403 || errCode === "42501" || (errMsg && errMsg.includes("permission denied"))) {
        throw new Error(
          "Supabase RLS Permissions Blocked: Insert permission denied.\n\n" +
          "🔧 QUICK FIX SQL SCRIPT:\n" +
          "Run this in your Supabase dashboard SQL Editor to disable Row Level Security (RLS) or authorize insert submissions:\n\n" +
          "ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;\n\n" +
          "-- OR keep RLS enabled but add public insert authorization policy:\n" +
          "CREATE POLICY \"Allow public insertions\" ON public.clients FOR INSERT WITH CHECK (true);"
        );
      }

      // For any other kind of error, throw it
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

// API endpoint to update existing applicant data in Supabase of the clients table
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

    // Clean up base URL
    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    // Determine correct endpoint
    const baseEndpoint = cleanUrl.includes("/rest/v1") 
      ? `${cleanUrl}/clients` 
      : `${cleanUrl}/rest/v1/clients`;

    const endpoint = `${baseEndpoint}?passport_number=eq.${encodeURIComponent(original_passport_number)}`;

    console.log(`Forwarding update (PATCH) to Supabase: ${endpoint}`);

    // Map updated fields to match database schema
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

      // Check if it's an undefined column error
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

// API endpoint to delete applicant data from Supabase
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

    // Clean up base URL
    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    // Determine correct endpoint
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

// Configure Vite or production static server
async function bootServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Taw3na server running on http://localhost:${PORT}`);
  });
}

// Export app for Vercel serverless
export default app;

// Only boot the server when run directly (not imported as a module)
const isVercel = process.env.VERCEL === "1";
if (!isVercel) {
  bootServer().catch((e) => {
    console.error("Error launching server:", e);
  });
}
