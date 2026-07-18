"use strict";

/** Supabase-backed shared state. Only the publishable key is present in browser code. */
(() => {
  const PROJECT_URL = "https://vdzyqwigzehfqrwysqrl.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_pLcvyeWTsBY12HPLrBWcng_H3potGl3";
  const ADMIN_EMAIL = "kapilashkapilash2025@gmail.com";
  const STORAGE_KEYS = { updates: "vvcSchoolUpdates", gallery: "vvcSchoolGallery", notices: "vvcOfficialPrincipalNoticesV1", achievements: "vvcAchievementWallV1" };
  const sdk = window.supabase;
  if (!sdk?.createClient) { console.warn("VVC Cloud is unavailable; device-local fallback remains active."); return; }
  const client = sdk.createClient(PROJECT_URL, PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const pendingWrites = new Map();
  const migrationBackupKey = "vvcCloudMigrationBackupV1";
  const browserId = localStorage.getItem("vvcSharedBrowserId") || (crypto.randomUUID?.() || `browser-${Date.now()}-${Math.random()}`);
  localStorage.setItem("vvcSharedBrowserId", browserId);

  const cleanPath = (value) => String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
  const dataUrlBlob = async (value) => fetch(value).then((response) => response.blob());
  const emit = (type, records) => document.dispatchEvent(new CustomEvent("vvc:cloud-sync", { detail: { type, records } }));
  const notify = (message) => document.dispatchEvent(new CustomEvent("vvc:cloud-status", { detail: { message } }));
  function preserveForMigration(type, records) {
    let backup = {};
    try { backup = JSON.parse(localStorage.getItem(migrationBackupKey) || "{}"); } catch { backup = {}; }
    backup[type] = records;
    try { localStorage.setItem(migrationBackupKey, JSON.stringify(backup)); } catch { /* The regular local cache still remains available. */ }
  }

  async function session() { return (await client.auth.getSession()).data.session; }
  async function isAdmin() { return (await session())?.user?.email?.toLowerCase() === ADMIN_EMAIL; }
  function assertAdminEmail(email) {
    if (String(email).trim().toLowerCase() !== ADMIN_EMAIL) throw new Error("This email is not authorized for VVC administration.");
  }
  async function signInWithPassword(email, password) {
    assertAdminEmail(email);
    if (String(password).length < 8) throw new Error("Enter your admin password (minimum 8 characters).");
    const { error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: String(password) });
    if (error) throw error;
  }
  async function sendPasswordReset(email) {
    assertAdminEmail(email);
    const { error } = await client.auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: `${location.origin}${location.pathname}` });
    if (error) throw error;
  }
  async function updatePassword(password) {
    if (String(password).length < 8) throw new Error("Use at least 8 characters for the new password.");
    const { error } = await client.auth.updateUser({ password: String(password) });
    if (error) throw error;
  }
  async function signOut() { const { error } = await client.auth.signOut(); if (error) throw error; }

  async function uploadBlob(blob, path, contentType = blob.type || "application/octet-stream") {
    if (!(await isAdmin())) throw new Error("Administrator authentication is required for uploads.");
    const safePath = `${new Date().toISOString().slice(0, 10)}/${cleanPath(path)}`;
    const { error } = await client.storage.from("vvc-media").upload(safePath, blob, { contentType, upsert: true, cacheControl: "3600" });
    if (error) throw error;
    return client.storage.from("vvc-media").getPublicUrl(safePath).data.publicUrl;
  }

  async function cloudify(value, type, recordId, trail = "asset") {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      const blob = await dataUrlBlob(value); const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      return uploadBlob(blob, `${type}-${recordId}-${trail}.${extension}`, blob.type);
    }
    if (Array.isArray(value)) return Promise.all(value.map((item, index) => cloudify(item, type, recordId, `${trail}-${index}`)));
    if (value && typeof value === "object") {
      const result = {};
      for (const [key, item] of Object.entries(value)) result[key] = await cloudify(item, type, recordId, `${trail}-${key}`);
      return result;
    }
    return value;
  }

  async function hydrateAchievements(records) {
    if (!records.length) return records;
    const ids = records.map((record) => record.id);
    const [{ data: reactions }, { data: messages }] = await Promise.all([
      client.from("vvc_reactions").select("post_id,reaction").in("post_id", ids),
      client.from("vvc_messages").select("id,post_id,display_name,message,status,created_at").in("post_id", ids).order("created_at", { ascending: true })
    ]);
    return records.map((record) => {
      const counts = { like: 0, congratulations: 0, proud: 0, excellent: 0, champion: 0 };
      (reactions || []).filter((item) => item.post_id === record.id).forEach((item) => { if (item.reaction in counts) counts[item.reaction] += 1; });
      const hydratedMessages = (messages || []).filter((item) => item.post_id === record.id).map((item) => ({ id: item.id, name: item.display_name, message: item.message, status: item.status, createdAt: item.created_at }));
      return { ...record, reactions: counts, messages: hydratedMessages };
    });
  }

  async function syncType(type) {
    const { data, error } = await client.from("vvc_content").select("payload,updated_at").eq("content_type", type).order("updated_at", { ascending: false });
    if (error) { notify(`Cloud connection: ${error.message}`); return []; }
    let records = (data || []).map((row) => row.payload);
    if (type === "achievements") records = await hydrateAchievements(records);
    localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(records)); emit(type, records); return records;
  }

  async function migrateLegacyContent() {
    if (!(await isAdmin())) return;
    let backup = {};
    try { backup = JSON.parse(localStorage.getItem(migrationBackupKey) || "{}"); } catch { backup = {}; }
    for (const type of Object.keys(STORAGE_KEYS)) {
      const { count } = await client.from("vvc_content").select("record_id", { count: "exact", head: true }).eq("content_type", type);
      if (!count && Array.isArray(backup[type]) && backup[type].length) await putCollectionNow(type, backup[type]);
    }
    localStorage.removeItem(migrationBackupKey);
  }

  async function putCollectionNow(type, records) {
    if (!(await isAdmin())) { preserveForMigration(type, records); notify("Saved on this device. Complete secure admin sign-in to synchronize it to every phone."); return; }
    const cloudRecords = [];
    for (const record of records) cloudRecords.push(await cloudify(record, type, record.id));
    if (cloudRecords.length) {
      const rows = cloudRecords.map((record) => ({ content_type: type, record_id: record.id, payload: record, updated_at: new Date().toISOString() }));
      const { error } = await client.from("vvc_content").upsert(rows, { onConflict: "content_type,record_id" }); if (error) throw error;
    }
    const { data: remote } = await client.from("vvc_content").select("record_id").eq("content_type", type);
    const keep = new Set(cloudRecords.map((record) => record.id)); const remove = (remote || []).map((item) => item.record_id).filter((id) => !keep.has(id));
    if (remove.length) { const { error } = await client.from("vvc_content").delete().eq("content_type", type).in("record_id", remove); if (error) throw error; }
    localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(cloudRecords)); emit(type, cloudRecords);
  }

  function putCollection(type, records) {
    const previous = pendingWrites.get(type) || Promise.resolve();
    const next = previous.then(() => putCollectionNow(type, records)).catch((error) => notify(`Cloud save failed: ${error.message}`));
    pendingWrites.set(type, next); return next;
  }

  async function react(postId, reaction) {
    if (reaction) {
      const { error } = await client.from("vvc_reactions").upsert({ post_id: postId, browser_id: browserId, reaction, updated_at: new Date().toISOString() }, { onConflict: "post_id,browser_id" }); if (error) throw error;
    } else { const { error } = await client.from("vvc_reactions").delete().eq("post_id", postId).eq("browser_id", browserId); if (error) throw error; }
    await syncType("achievements");
  }
  async function submitMessage(postId, name, message) { const { error } = await client.from("vvc_messages").insert({ post_id: postId, display_name: name, message, status: "pending" }); if (error) throw error; }
  async function moderateMessage(id, action) {
    if (!(await isAdmin())) throw new Error("Administrator authentication required.");
    const operation = action === "approve" ? client.from("vvc_messages").update({ status: "approved" }).eq("id", id) : client.from("vvc_messages").delete().eq("id", id);
    const { error } = await operation; if (error) throw error; await syncType("achievements");
  }

  async function initialize() {
    if (!localStorage.getItem(migrationBackupKey)) {
      const backup = {};
      for (const [type, key] of Object.entries(STORAGE_KEYS)) { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); if (Array.isArray(value) && value.length) backup[type] = value; } catch { /* Ignore malformed legacy data. */ } }
      if (Object.keys(backup).length) localStorage.setItem(migrationBackupKey, JSON.stringify(backup));
    }
    const currentSession = await session(); document.dispatchEvent(new CustomEvent("vvc:auth", { detail: { session: currentSession } }));
    if (currentSession?.user?.email?.toLowerCase() === ADMIN_EMAIL) await migrateLegacyContent();
    await Promise.all(Object.keys(STORAGE_KEYS).map(syncType));
    client.channel("vvc-shared-content").on("postgres_changes", { event: "*", schema: "public", table: "vvc_content" }, (change) => syncType(change.new?.content_type || change.old?.content_type)).on("postgres_changes", { event: "*", schema: "public", table: "vvc_reactions" }, () => syncType("achievements")).on("postgres_changes", { event: "*", schema: "public", table: "vvc_messages" }, () => syncType("achievements")).subscribe();
    client.auth.onAuthStateChange((authEvent, changedSession) => { document.dispatchEvent(new CustomEvent("vvc:auth", { detail: { session: changedSession, authEvent } })); if (changedSession?.user?.email?.toLowerCase() === ADMIN_EMAIL) window.setTimeout(() => migrateLegacyContent().then(() => Promise.all(Object.keys(STORAGE_KEYS).map(syncType))), 0); });
  }

  window.VVCCloud = { client, initialize, session, isAdmin, signInWithPassword, sendPasswordReset, updatePassword, signOut, syncType, putCollection, uploadBlob, react, submitMessage, moderateMessage, adminEmail: ADMIN_EMAIL };
  initialize().catch((error) => notify(`Cloud initialization failed: ${error.message}`));
})();
