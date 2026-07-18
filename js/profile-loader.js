"use strict";

/** Coordinates the first-visit profile animation with real browser resource readiness. */
(() => {
  const SESSION_KEY = "vvcOfficialProfileLoaded";
  const root = document.documentElement;
  const loader = document.getElementById("pageLoader");
  if (!loader) { root.classList.remove("profile-loading"); return; }

  let repeatVisit = false;
  try { repeatVisit = sessionStorage.getItem(SESSION_KEY) === "1"; }
  catch { repeatVisit = false; }

  if (repeatVisit) {
    loader.classList.add("instant-skip", "loaded");
    root.classList.remove("profile-loading");
    loader.setAttribute("aria-hidden", "true");
    return;
  }

  const progress = document.getElementById("profileLoaderProgress");
  const message = document.getElementById("profileLoaderMessage");
  const pageContent = [...document.body.children].filter((node) => node !== loader);
  pageContent.forEach((node) => { node.inert = true; node.setAttribute("aria-hidden", "true"); });

  const messages = [
    "Preparing the official school profile",
    "Connecting students with knowledge",
    "Opening notices and school services",
    "Celebrating learning, discipline and excellence",
    "Welcome to the VVC Digital Campus"
  ];
  let messageIndex = 0;
  const messageTimer = window.setInterval(() => {
    message.classList.add("profile-loader-message-change");
    window.setTimeout(() => { messageIndex = (messageIndex + 1) % messages.length; message.textContent = messages[messageIndex]; message.classList.remove("profile-loader-message-change"); }, 180);
  }, 700);

  const imageTasks = [...new Set([...document.images].map((image) => image.currentSrc || image.src).filter(Boolean))].map((source) => {
    return new Promise((resolve) => { const preload = new Image(); preload.onload = resolve; preload.onerror = resolve; preload.src = source; if (preload.complete) resolve(); });
  });
  const fontsReady = document.fonts?.ready ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
  const windowReady = document.readyState === "complete" ? Promise.resolve() : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  const resourcesReady = Promise.allSettled([...imageTasks, fontsReady, windowReady]);
  const minimumDisplay = new Promise((resolve) => window.setTimeout(resolve, 2500));
  const maximumWait = new Promise((resolve) => window.setTimeout(resolve, 7000));
  let displayedProgress = 8;
  progress.style.width = `${displayedProgress}%`;
  const progressTimer = window.setInterval(() => { displayedProgress = Math.min(88, displayedProgress + Math.max(1, Math.round((90 - displayedProgress) / 7))); progress.style.width = `${displayedProgress}%`; }, 180);

  Promise.race([Promise.all([resourcesReady, minimumDisplay]), maximumWait]).then(() => {
    window.clearInterval(progressTimer); window.clearInterval(messageTimer); progress.style.width = "100%"; message.textContent = messages[messages.length - 1];
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* The loader still works when session storage is unavailable. */ }
    window.setTimeout(() => {
      loader.classList.add("loaded"); root.classList.remove("profile-loading");
      pageContent.forEach((node) => { node.inert = false; node.removeAttribute("aria-hidden"); });
      window.setTimeout(() => loader.remove(), 800);
    }, 420);
  });
})();
