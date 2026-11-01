// Picks the content source: Supabase when its URL and key are set, otherwise
// the Google Sheets listed in content.config.json.
await import(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY ? "./sync-supabase.mjs" : "./sync-sheets.mjs");
