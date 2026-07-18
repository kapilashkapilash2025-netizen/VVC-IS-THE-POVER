"use strict";

/** Opt-in browser notifications for new Supabase-synchronized school content. */
(() => {
  const SUBSCRIPTION_KEY = "vvcBrowserNotificationsEnabled";
  const SEEN_PREFIX = "vvcNotificationSeen:";
  const CONTENT_PATHS = {
    updates: "#updates",
    notices: "#official-notices-title",
    achievements: "achievements.html",
    gallery: "#gallery"
  };
  const CONTENT_LABELS = {
    updates: "New school update",
    notices: "New official announcement",
    achievements: "New student achievement",
    gallery: "New gallery highlight"
  };
  const LOCAL_CONTENT_KEYS = {
    updates: "vvcSchoolUpdates",
    notices: "vvcOfficialPrincipalNoticesV1",
    achievements: "vvcAchievementWallV1",
    gallery: "vvcSchoolGallery"
  };

  const button = document.getElementById("notificationSubscribeButton");
  const label = document.getElementById("notificationButtonLabel");
  const status = document.getElementById("notificationSubscriptionStatus");
  if (!button || !label || !status) return;

  let enabled = localStorage.getItem(SUBSCRIPTION_KEY) === "true";
  let serviceWorkerRegistration = null;

  function updateButton(message) {
    const active = enabled && window.Notification?.permission === "granted";
    button.classList.toggle("is-subscribed", active);
    button.setAttribute("aria-pressed", String(active));
    label.textContent = active ? "Notifications On" : "Subscribe";
    status.textContent = message || (active ? "Browser notifications are active." : "Notifications are not subscribed.");
  }

  function recordIds(type, records) {
    const ids = Array.isArray(records) ? records.map((record) => String(record.id || "")).filter(Boolean) : [];
    localStorage.setItem(`${SEEN_PREFIX}${type}`, JSON.stringify(ids));
    return ids;
  }

  function previousIds(type) {
    try { return JSON.parse(localStorage.getItem(`${SEEN_PREFIX}${type}`) || "[]"); }
    catch { return []; }
  }

  function captureCurrentContent() {
    Object.entries(LOCAL_CONTENT_KEYS).forEach(([type, key]) => {
      try { recordIds(type, JSON.parse(localStorage.getItem(key) || "[]")); }
      catch { recordIds(type, []); }
    });
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    serviceWorkerRegistration ||= await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    return serviceWorkerRegistration;
  }

  async function displayNotification(type, record, additionalCount) {
    const title = CONTENT_LABELS[type] || "VVC update";
    const recordTitle = String(record?.title || record?.studentName || "New information is available.").slice(0, 160);
    const body = additionalCount > 0 ? `${recordTitle} — and ${additionalCount} more.` : recordTitle;
    const options = {
      body,
      icon: "assets/school-logo-optimized.jpg",
      badge: "assets/school-logo-optimized.jpg",
      tag: `vvc-${type}-${record?.id || Date.now()}`,
      data: { url: CONTENT_PATHS[type] || "./" }
    };
    const registration = await ensureServiceWorker();
    if (registration) await registration.showNotification(title, options);
    else if (window.Notification?.permission === "granted") new Notification(title, options);
  }

  async function subscribe() {
    if (!("Notification" in window)) throw new Error("This browser does not support notifications.");
    if (!window.isSecureContext) throw new Error("Notifications require the secure public website.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(permission === "denied" ? "Notification permission was blocked in browser settings." : "Notification permission was not granted.");
    await ensureServiceWorker();
    captureCurrentContent();
    enabled = true;
    localStorage.setItem(SUBSCRIPTION_KEY, "true");
    updateButton("Subscribed. New VVC updates will appear as browser notifications.");
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (enabled) {
        enabled = false;
        localStorage.setItem(SUBSCRIPTION_KEY, "false");
        updateButton("VVC browser notifications are paused on this device.");
      } else {
        await subscribe();
      }
    } catch (error) {
      enabled = false;
      localStorage.setItem(SUBSCRIPTION_KEY, "false");
      updateButton(error.message);
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener("vvc:cloud-sync", (event) => {
    const type = event.detail?.type;
    const records = event.detail?.records;
    if (!CONTENT_PATHS[type] || !Array.isArray(records)) return;
    const seen = new Set(previousIds(type));
    const newRecords = records.filter((record) => record?.id && !seen.has(String(record.id)));
    recordIds(type, records);
    if (!enabled || Notification.permission !== "granted" || !newRecords.length) return;
    displayNotification(type, newRecords[0], newRecords.length - 1).catch(() => updateButton("A notification could not be displayed."));
  });

  if (window.Notification?.permission !== "granted") {
    enabled = false;
    localStorage.setItem(SUBSCRIPTION_KEY, "false");
  }
  updateButton();
})();
