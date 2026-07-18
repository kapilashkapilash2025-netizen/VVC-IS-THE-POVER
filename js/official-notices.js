"use strict";

/** Official notices use Supabase when available, with a device-local fallback. */
const OFFICIAL_NOTICE_KEY = "vvcOfficialPrincipalNoticesV1";
const SCHOOL_LOGO = "./assets/school-logo.png";
const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;
let pendingNotice = null;
let editingNoticeId = null;

const select = (selector, parent = document) => parent.querySelector(selector);
const selectAll = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  Object.entries(options.attributes || {}).forEach(([name, value]) => node.setAttribute(name, String(value)));
  return node;
}

function readNotices() {
  try {
    const value = JSON.parse(localStorage.getItem(OFFICIAL_NOTICE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((notice) => notice && typeof notice === "object") : [];
  } catch {
    return [];
  }
}

function writeNotices(notices) {
  try {
    localStorage.setItem(OFFICIAL_NOTICE_KEY, JSON.stringify(notices));
    if (window.VVCCloud) window.VVCCloud.putCollection("notices", notices);
    return true;
  } catch {
    window.alert("Device storage is full. Remove older image-heavy notices and try again.");
    return false;
  }
}

function clean(value, maxLength = 1000) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLength);
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Not specified" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function noticeStatus(notice) {
  if (notice.status === "archived") return "archived";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = notice.expiryDate ? new Date(`${notice.expiryDate}T23:59:59`) : null;
  return expiry && expiry < today ? "expired" : "published";
}

function categoryLabel(value) {
  return ({ parents: "Parents’ Meeting", examination: "Examination", event: "School Event", emergency: "Emergency Notice", closure: "School Closure", competition: "Competition", general: "General Notice" })[value] || "Official Notice";
}

function readImage(file, label) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(""); return; }
    if (!file.type.startsWith("image/")) { reject(new Error(`${label} must be an image file.`)); return; }
    if (file.size > MAX_UPLOAD_BYTES) { reject(new Error(`${label} must be smaller than 2.5 MB.`)); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${label} could not be read.`));
    reader.readAsDataURL(file);
  });
}

function appendDetail(grid, label, value) {
  if (!value) return;
  const item = element("div");
  item.append(element("span", { text: label }), element("strong", { text: value }));
  grid.append(item);
}

function createOfficialNotice(notice, options = {}) {
  const status = noticeStatus(notice);
  const card = element("article", { className: `official-notice-card${notice.pinned ? " is-pinned" : ""}${notice.priority === "urgent" ? " is-urgent" : ""}` });
  card.dataset.noticeId = notice.id;

  const header = element("header", { className: "official-card-header" });
  header.append(element("img", { attributes: { src: SCHOOL_LOGO, alt: "Vavuniya Vipulanantha College logo" } }));
  const heading = element("div");
  heading.append(element("strong", { text: "Vavuniya Vipulanantha College" }), element("small", { text: "Official Announcement" }));
  header.append(heading);

  const body = element("div", { className: "official-card-body" });
  const badges = element("div", { className: "official-badges" });
  badges.append(element("span", { className: "official-badge category", text: categoryLabel(notice.category) }));
  if (notice.priority === "urgent") badges.append(element("span", { className: "official-badge urgent", text: "Urgent" }));
  else if (notice.priority === "high") badges.append(element("span", { className: "official-badge high", text: "High priority" }));
  if (status !== "published") badges.append(element("span", { className: `official-badge ${status}`, text: status }));
  body.append(badges, element("h3", { text: notice.title }));
  const classTarget = [notice.grade, notice.className].filter(Boolean).join(" · ") || notice.gradeClass || "";
  body.append(element("p", { className: "official-target", text: `Target audience: ${notice.targetAudience}${classTarget ? ` · ${classTarget}` : ""}` }));
  body.append(element("p", { className: "official-message", text: options.compact && notice.message.length > 220 ? `${notice.message.slice(0, 220)}…` : notice.message }));

  const meta = element("div", { className: "official-meta-grid" });
  appendDetail(meta, "Meeting date", notice.meetingDate ? formatDate(notice.meetingDate) : "");
  appendDetail(meta, "Meeting time", notice.meetingTime);
  appendDetail(meta, "Venue", notice.venue);
  appendDetail(meta, "Publication date", formatDate(notice.publicationDate));
  appendDetail(meta, "Expiry date", notice.expiryDate ? formatDate(notice.expiryDate) : "No expiry");
  body.append(meta);

  if (!options.compact) {
    const signatureRow = element("div", { className: "official-signature-row" });
    const signature = element("div", { className: "principal-signature" });
    if (notice.signatureImage) signature.append(element("img", { attributes: { src: notice.signatureImage, alt: `Signature of ${notice.principalName}` } }));
    else signature.append(element("div", { className: "official-image-placeholder", text: "Principal signature" }));
    signature.append(element("strong", { text: notice.principalName }), element("span", { text: notice.designation }));
    const seal = element("div", { className: "official-seal" });
    if (notice.sealImage) seal.append(element("img", { attributes: { src: notice.sealImage, alt: "Official school seal" } }));
    else seal.append(element("div", { className: "official-image-placeholder", text: "Official school seal" }));
    signatureRow.append(signature, seal); body.append(signatureRow);
    if (notice.attachmentImage) {
      const attachment = element("div", { className: "official-attachment" });
      attachment.append(element("img", { attributes: { src: notice.attachmentImage, alt: `Attachment for ${notice.title}` } }));
      body.append(attachment);
    }
    if (notice.scannedDocumentId) {
      const documentActions = element("div", { className: "scanned-document-actions" });
      documentActions.append(element("strong", { text: notice.scannedDocumentTitle || "Attached official document" }));
      [["View Document", "view"], ["Download PDF", "download"], ["Print", "print"], ["Full-screen preview", "view"]].forEach(([label, action]) => {
        documentActions.append(element("button", { text: label, attributes: { type: "button", "data-scanned-document": notice.scannedDocumentId, "data-document-action": action } }));
      });
      body.append(documentActions);
    }
  }

  const footer = element("footer", { className: "official-card-footer" });
  footer.append(actionButton("Print", "print", notice.id), actionButton("WhatsApp", "share", notice.id));
  if (options.compact) footer.prepend(element("a", { className: "notice-action primary", text: "Read official notice", attributes: { href: `notices.html#${notice.id}` } }));
  if (options.admin) {
    footer.append(actionButton("Edit", "edit", notice.id), actionButton(notice.pinned ? "Unpin" : "Pin", "pin", notice.id), actionButton(status === "archived" ? "Restore" : "Archive", "archive", notice.id), actionButton("Delete", "delete", notice.id, "danger"));
  }
  card.append(header, body, footer);
  return card;
}

function actionButton(label, action, id, variant = "") {
  return element("button", { className: `notice-action ${variant}`.trim(), text: label, attributes: { type: "button", "data-official-action": action, "data-notice-id": id } });
}

function sortedNotices(notices) {
  return [...notices].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.publicationDate) - new Date(a.publicationDate));
}

function renderPublicNotices() {
  const home = select("#officialNoticeHome");
  const page = select("#officialNoticesPageList");
  const active = sortedNotices(readNotices().filter((notice) => noticeStatus(notice) === "published"));
  if (home) {
    home.replaceChildren();
    if (!active.length) home.append(element("p", { className: "official-empty", text: "No active official announcements at this time." }));
    active.slice(0, 3).forEach((notice) => home.append(createOfficialNotice(notice, { compact: true })));
  }
  if (page) {
    const filter = select("#officialCategoryFilter")?.value || "all";
    const visible = filter === "all" ? active : active.filter((notice) => notice.category === filter);
    page.replaceChildren();
    if (!visible.length) page.append(element("p", { className: "official-empty", text: "No active notices match this category." }));
    visible.forEach((notice) => page.append(createOfficialNotice(notice)));
    const hashId = location.hash.slice(1);
    if (hashId) requestAnimationFrame(() => select(`[data-notice-id="${CSS.escape(hashId)}"]`, page)?.scrollIntoView({ block: "start" }));
  }
}

function renderAdminNotices() {
  const list = select("#officialAdminNoticeList");
  if (!list) return;
  const notices = sortedNotices(readNotices()); list.replaceChildren();
  if (!notices.length) list.append(element("p", { className: "official-empty", text: "No official notices have been published." }));
  notices.forEach((notice) => {
    const row = element("article", { className: "official-admin-row" });
    const summary = element("div");
    summary.append(element("h4", { text: notice.title }), element("p", { text: `${categoryLabel(notice.category)} · ${noticeStatus(notice)} · ${formatDate(notice.publicationDate)}` }));
    const actions = element("div", { className: "official-admin-actions" });
    actions.append(actionButton("Preview", "preview", notice.id), actionButton("Edit", "edit", notice.id), actionButton(notice.pinned ? "Unpin" : "Pin", "pin", notice.id), actionButton(noticeStatus(notice) === "archived" ? "Restore" : "Archive", "archive", notice.id), actionButton("Delete", "delete", notice.id, "danger"));
    row.append(summary, actions); list.append(row);
  });
  const count = select("#officialNoticeCount"); if (count) count.textContent = String(notices.filter((notice) => noticeStatus(notice) === "published").length);
}

async function collectFormNotice(form) {
  const data = new FormData(form);
  const existing = editingNoticeId ? readNotices().find((notice) => notice.id === editingNoticeId) : null;
  const [signatureImage, sealImage, attachmentImage] = await Promise.all([
    readImage(select("#officialSignature").files[0], "Principal signature"),
    readImage(select("#officialSeal").files[0], "School seal"),
    readImage(select("#officialAttachment").files[0], "Attachment"),
  ]);
  const notice = {
    id: existing?.id || `official-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: clean(data.get("title"), 140), category: clean(data.get("category"), 30), targetAudience: clean(data.get("targetAudience"), 120), grade: clean(data.get("grade"), 40), className: clean(data.get("className"), 40),
    meetingDate: clean(data.get("meetingDate"), 10), meetingTime: clean(data.get("meetingTime"), 10), venue: clean(data.get("venue"), 160), message: clean(data.get("message"), 4000),
    principalName: clean(data.get("principalName"), 120), designation: clean(data.get("designation"), 120), publicationDate: clean(data.get("publicationDate"), 10), expiryDate: clean(data.get("expiryDate"), 10),
    priority: ["normal", "high", "urgent"].includes(data.get("priority")) ? data.get("priority") : "normal", pinned: data.get("pinned") === "on", status: existing?.status === "archived" ? "published" : (existing?.status || "published"),
    signatureImage: signatureImage || existing?.signatureImage || "", sealImage: sealImage || existing?.sealImage || "", attachmentImage: attachmentImage || existing?.attachmentImage || "",
    scannedDocumentId: clean(data.get("scannedDocumentId"), 600) || existing?.scannedDocumentId || "", scannedDocumentTitle: existing?.scannedDocumentTitle || "Scanned official document", updatedAt: new Date().toISOString(),
  };
  if (!notice.title || !notice.category || !notice.targetAudience || !notice.message || !notice.principalName || !notice.designation || !notice.publicationDate) throw new Error("Complete all required notice fields.");
  if (!notice.signatureImage || !notice.sealImage) throw new Error("Principal signature and official school seal are required.");
  if (notice.expiryDate && notice.expiryDate < notice.publicationDate) throw new Error("Expiry date cannot be before publication date.");
  if (notice.scannedDocumentId && window.VVCDocuments?.get) {
    const documentRecord = await window.VVCDocuments.get(notice.scannedDocumentId);
    if (!documentRecord) throw new Error("The attached scanned document is no longer available on this device.");
    notice.scannedDocumentTitle = clean(documentRecord.title, 120);
    notice.scannedDocumentFilename = clean(documentRecord.filename, 100);
    notice.scannedDocumentPageCount = Number(documentRecord.pageCount) || 0;
  }
  return notice;
}

function showPreview(notice, confirmMode) {
  const modal = select("#officialPreviewModal"); const content = select("#officialPreviewContent"); const confirm = select("#confirmOfficialPublish");
  if (!modal || !content) return;
  content.replaceChildren(createOfficialNotice(notice));
  confirm.hidden = !confirmMode; modal.classList.add("active"); document.body.classList.add("modal-open");
}

function closePreview() { select("#officialPreviewModal")?.classList.remove("active"); if (!select(".modal.active")) document.body.classList.remove("modal-open"); }

function fillForm(notice) {
  const form = select("#officialNoticeForm"); if (!form) return;
  ["title", "category", "targetAudience", "grade", "className", "meetingDate", "meetingTime", "venue", "message", "principalName", "designation", "publicationDate", "expiryDate", "priority"].forEach((name) => { const control = form.elements.namedItem(name); if (control) control.value = notice[name] || ""; });
  form.elements.namedItem("pinned").checked = Boolean(notice.pinned); editingNoticeId = notice.id;
  const documentInput = form.elements.namedItem("scannedDocumentId");
  if (documentInput) documentInput.value = notice.scannedDocumentId || "";
  select("#officialFormMode").textContent = "Editing official notice"; select("#cancelOfficialEdit").hidden = false;
  const quickSection = select("#officialNoticeQuickSection"); if (quickSection) quickSection.open = true; form.scrollIntoView({ block: "start" });
}

function resetOfficialForm() {
  const form = select("#officialNoticeForm"); if (!form) return;
  form.reset(); editingNoticeId = null; pendingNotice = null;
  select("#officialPublicationDate").value = new Date().toISOString().slice(0, 10);
  select("#officialFormMode").textContent = "Create an official announcement"; select("#cancelOfficialEdit").hidden = true; select("#officialFormMessage").textContent = "";
  const scanSummary = select("#attachedScanSummary"); if (scanSummary) scanSummary.hidden = true;
}

function printNotice(notice) {
  let area = select("#officialPrintArea"); if (!area) { area = element("div", { attributes: { id: "officialPrintArea" } }); document.body.append(area); }
  area.replaceChildren(createOfficialNotice(notice)); document.body.classList.add("printing-official-notice");
  const cleanup = () => document.body.classList.remove("printing-official-notice"); window.addEventListener("afterprint", cleanup, { once: true }); window.print(); setTimeout(cleanup, 1000);
}

function shareNotice(notice) {
  const details = [`Vavuniya Vipulanantha College`, `OFFICIAL ANNOUNCEMENT`, notice.title, `Target: ${notice.targetAudience}`, notice.meetingDate ? `Date: ${formatDate(notice.meetingDate)}` : "", notice.venue ? `Venue: ${notice.venue}` : "", notice.message].filter(Boolean).join("\n");
  window.open(`https://wa.me/?text=${encodeURIComponent(details)}`, "_blank", "noopener,noreferrer");
}

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "officialNoticeForm") return;
  event.preventDefault(); const message = select("#officialFormMessage"); const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = "Preparing preview…";
  try { pendingNotice = await collectFormNotice(event.target); message.textContent = "Review every detail before publishing."; showPreview(pendingNotice, true); }
  catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; button.textContent = "Preview official notice"; }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("#closeOfficialPreview, [data-close-official-preview]")) { closePreview(); return; }
  if (event.target.closest("#cancelOfficialEdit")) { resetOfficialForm(); return; }
  if (event.target.closest("#confirmOfficialPublish")) {
    if (!pendingNotice || !window.confirm("Final confirmation: publish this official Principal announcement?")) return;
    const notices = readNotices(); const index = notices.findIndex((notice) => notice.id === pendingNotice.id);
    if (index >= 0) notices[index] = pendingNotice; else notices.unshift(pendingNotice);
    if (writeNotices(notices)) { closePreview(); resetOfficialForm(); renderPublicNotices(); renderAdminNotices(); window.alert("Official announcement published successfully."); }
    return;
  }
  const button = event.target.closest("[data-official-action]"); if (!button) return;
  const notices = readNotices(); const notice = notices.find((item) => item.id === button.dataset.noticeId); if (!notice) return;
  const action = button.dataset.officialAction;
  if (action === "preview") showPreview(notice, false);
  if (action === "edit") fillForm(notice);
  if (action === "print") printNotice(notice);
  if (action === "share") shareNotice(notice);
  if (action === "pin") { notice.pinned = !notice.pinned; writeNotices(notices); renderPublicNotices(); renderAdminNotices(); }
  if (action === "archive") { notice.status = noticeStatus(notice) === "archived" ? "published" : "archived"; writeNotices(notices); renderPublicNotices(); renderAdminNotices(); }
  if (action === "delete" && window.confirm(`Delete “${notice.title}” permanently?`)) { writeNotices(notices.filter((item) => item.id !== notice.id)); renderPublicNotices(); renderAdminNotices(); }
});

select("#officialCategoryFilter")?.addEventListener("change", renderPublicNotices);
select("#officialNoticeQuickSection")?.addEventListener("toggle", (event) => { if (event.target.open) renderAdminNotices(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePreview(); });
document.addEventListener("vvc:cloud-sync", (event) => { if (event.detail?.type === "notices") { renderPublicNotices(); renderAdminNotices(); } });

if (select("#officialNoticeForm")) resetOfficialForm();
renderPublicNotices();
renderAdminNotices();
