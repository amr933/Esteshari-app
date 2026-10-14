/**
 * Esteshari Cloud – configuration
 * © All rights reserved. Nexus Solutions
 *
 * ---------------------------------------------------------------
 *  1) Supabase keys (required)
 *  2) Auto-update settings (optional – see notes below)
 * ---------------------------------------------------------------
 */
window.ESTESHARI_CONFIG = {

  // ---------- Supabase ----------
  SUPABASE_URL: "https://iebbaaasdjkmiwmrqsap.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYmJhYWFzZGprbWl3bXJxc2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NDUyMDMsImV4cCI6MjEwNzUyMTIwM30.MpxQPWMhuNCRnnskJGZPtVn7QkSqVDikPojRsEcEFeg",

  // ---------- App ----------
  APP_VERSION: "2.1.0",
  STORAGE_BUCKET: "documents",
  MAX_FILE_MB: 25,

  // ---------- Auto-update ----------
  // The desktop app reads the version from electron/main.js, so you only
  // need this block if you also want the *web* version to check for news.
  // Point UPDATE_MANIFEST_URL at a JSON file you control, e.g.
  //   { "version": "2.2.0", "url": "https://.../Esteshari-Setup-2.2.0.exe", "notes": "..." }
  UPDATE_MANIFEST_URL: "",
  UPDATE_FEED_URL: ""
};