"use strict";

/** Device-local Achievement Wall. A shared production wall requires a backend database. */
const ACHIEVEMENT_STORAGE_KEY = "vvcAchievementWallV1";
const ACHIEVEMENT_REACTION_KEY = "vvcAchievementReactionsV1";
const ACHIEVEMENT_REACTIONS = [
  ["like", "Like", "♥"], ["congratulations", "Congratulations", "🎉"],
  ["proud", "Proud", "★"], ["excellent", "Excellent", "✦"], ["champion", "Champion", "🏆"]
];
const ACHIEVEMENT_FILTERS = ["All", "Academic", "Sports", "Arts", "Technology", "Language", "School Level", "Zonal Level", "Provincial Level", "National Level"];
let achievementPosts = achievementRead(ACHIEVEMENT_STORAGE_KEY, []);
let achievementBrowserReactions = achievementRead(ACHIEVEMENT_REACTION_KEY, {});
let activeAchievementFilter = "All";

function achievementRead(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value ?? fallback; }
  catch { return fallback; }
}

function achievementSave() {
  try {
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(achievementPosts));
    localStorage.setItem(ACHIEVEMENT_REACTION_KEY, JSON.stringify(achievementBrowserReactions));
    return true;
  } catch {
    achievementNotify("Device storage is full. Remove large images or older posts and try again.");
    return false;
  }
}

function achievementClean(value, maximum = 300) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function achievementNode(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  Object.entries(options.attributes || {}).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}

function achievementDate(value) {
  if (!value) return "Date not specified";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function achievementNotify(message) {
  const toast = document.getElementById("achievementToast") || document.getElementById("toastMessage");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function achievementReactionTotal(post) {
  return Object.values(post.reactions || {}).reduce((sum, count) => sum + Number(count || 0), 0);
}

function approvedAchievementMessages(post) {
  return (post.messages || []).filter((message) => message.status === "approved");
}

function achievementEmpty(message) {
  return achievementNode("div", { className: "achievement-empty", text: message });
}

function achievementBadge(text, gold = false) {
  return achievementNode("span", { className: `achievement-badge${gold ? " gold" : ""}`, text });
}

function renderAchievementMedia(post, body) {
  const images = [];
  if (post.certificate) images.push({ source: post.certificate, label: `${post.studentName} certificate` });
  (post.gallery || []).forEach((source, index) => images.push({ source, label: `${post.competition} event photo ${index + 1}` }));
  if (!images.length) return;
  body.append(achievementNode("span", { className: "achievement-media-label", text: "Certificate and event gallery" }));
  const strip = achievementNode("div", { className: "achievement-media" });
  images.forEach((item) => {
    const button = achievementNode("button", { attributes: { type: "button", "data-achievement-image": item.source, "data-image-caption": item.label, "aria-label": `View ${item.label}` } });
    const image = achievementNode("img", { attributes: { src: item.source, alt: "", loading: "lazy" } });
    button.append(image); strip.append(button);
  });
  body.append(strip);
}

function renderAchievementReactions(post, body) {
  const area = achievementNode("div", { className: "achievement-reactions" });
  if (post.reactionsDisabled) {
    area.append(achievementNode("p", { className: "achievement-reactions-disabled", text: "Reactions are closed for this achievement." }));
    body.append(area); return;
  }
  const list = achievementNode("div", { className: "achievement-reaction-list", attributes: { role: "group", "aria-label": `React to ${post.studentName}'s achievement` } });
  ACHIEVEMENT_REACTIONS.forEach(([key, label, icon]) => {
    const selected = achievementBrowserReactions[post.id] === key;
    const button = achievementNode("button", { className: "achievement-reaction", attributes: { type: "button", "data-achievement-reaction": key, "data-achievement-id": post.id, "aria-pressed": String(selected), "aria-label": `${label}, ${Number(post.reactions?.[key] || 0)} reactions` } });
    button.append(achievementNode("span", { text: icon, attributes: { "aria-hidden": "true" } }), achievementNode("span", { text: label }), achievementNode("strong", { text: String(Number(post.reactions?.[key] || 0)) }));
    list.append(button);
  });
  area.append(list); body.append(area);
}

function renderAchievementMessages(post, body) {
  const section = achievementNode("div", { className: "achievement-congratulations" });
  const details = achievementNode("details");
  const approved = approvedAchievementMessages(post);
  details.append(achievementNode("summary", { text: `Congratulations messages (${approved.length})` }));
  const messages = achievementNode("div", { className: "approved-messages" });
  approved.forEach((message) => {
    const item = achievementNode("div", { className: "approved-message" });
    item.append(achievementNode("strong", { text: message.name }), achievementNode("span", { text: message.message }));
    messages.append(item);
  });
  if (!approved.length) messages.append(achievementNode("p", { className: "achievement-reactions-disabled", text: "Be the first to send a congratulation message." }));
  const form = achievementNode("form", { className: "achievement-message-form", attributes: { "data-achievement-message-form": post.id } });
  form.append(
    achievementNode("input", { attributes: { name: "displayName", maxlength: "60", required: "", placeholder: "Display name", "aria-label": "Display name" } }),
    achievementNode("input", { attributes: { name: "message", maxlength: "180", required: "", placeholder: "Write a short congratulation message", "aria-label": "Congratulation message" } }),
    achievementNode("button", { text: "Send for approval", attributes: { type: "submit" } })
  );
  details.append(messages, form); section.append(details); body.append(section);
}

function buildAchievementCard(post) {
  const card = achievementNode("article", { className: `achievement-card${post.pinned ? " pinned" : ""}` });
  const visual = achievementNode("div", { className: "achievement-card-visual" });
  visual.append(achievementNode("img", { attributes: { src: post.studentPhoto, alt: `${post.studentName}, ${post.gradeClass}`, loading: "lazy" } }));
  const badges = achievementNode("div", { className: "achievement-badges" });
  if (post.pinned) badges.append(achievementBadge("Pinned", true));
  badges.append(achievementBadge(post.level), achievementBadge(post.category, true)); visual.append(badges);
  const body = achievementNode("div", { className: "achievement-card-body" });
  const student = achievementNode("div", { className: "achievement-student" });
  const identity = achievementNode("div"); identity.append(achievementNode("h3", { text: post.studentName }), achievementNode("span", { text: post.gradeClass }));
  student.append(identity, achievementNode("span", { text: achievementDate(post.date) }));
  body.append(student, achievementNode("h4", { className: "achievement-award", text: post.award }), achievementNode("p", { className: "achievement-competition", text: post.competition }), achievementNode("p", { className: "achievement-description", text: post.description }));
  renderAchievementMedia(post, body); renderAchievementReactions(post, body); renderAchievementMessages(post, body);
  card.append(visual, body); return card;
}

function renderAchievementFeatured() {
  const targets = [document.getElementById("achievementFeatured"), document.getElementById("achievementHomeFeature")].filter(Boolean);
  if (!targets.length) return;
  const active = achievementPosts.filter((post) => !post.archived);
  const featured = active.find((post) => post.featured) || active.find((post) => post.pinned) || active.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  targets.forEach((target) => {
    target.replaceChildren();
    if (!featured) { target.append(achievementEmpty("Achievement celebrations published by the school will appear here.")); return; }
    const card = achievementNode("article", { className: "achievement-feature-card" });
    card.append(achievementNode("img", { attributes: { src: featured.studentPhoto, alt: `${featured.studentName}, ${featured.gradeClass}` } }));
    const content = achievementNode("div", { className: "achievement-feature-content" });
    content.append(achievementNode("span", { className: "achievement-kicker", text: featured.level }), achievementNode("h3", { text: featured.studentName }), achievementNode("strong", { text: featured.award }), achievementNode("p", { text: featured.competition }), achievementNode("p", { text: featured.description }));
    const link = achievementNode("a", { className: "primary-button", text: "Celebrate this achievement", attributes: { href: "achievements.html" } }); content.append(link); card.append(content); target.append(card);
  });
}

function filteredAchievementPosts() {
  let posts = achievementPosts.filter((post) => !post.archived && (activeAchievementFilter === "All" || post.category === activeAchievementFilter || post.level === activeAchievementFilter));
  const sort = document.getElementById("achievementSort")?.value || "latest";
  posts = posts.slice().sort((a, b) => {
    if (sort === "reacted") return achievementReactionTotal(b) - achievementReactionTotal(a);
    if (sort === "congratulated") return approvedAchievementMessages(b).length - approvedAchievementMessages(a).length;
    if (sort === "pinned") return Number(b.pinned) - Number(a.pinned) || String(b.date).localeCompare(String(a.date));
    return Number(b.pinned) - Number(a.pinned) || String(b.date).localeCompare(String(a.date));
  });
  return posts;
}

function renderAchievementWall() {
  const wall = document.getElementById("achievementWall");
  if (!wall) return;
  wall.replaceChildren();
  const posts = filteredAchievementPosts();
  if (!posts.length) wall.append(achievementEmpty("No achievements match this filter yet."));
  else posts.forEach((post) => wall.append(buildAchievementCard(post)));
}

function renderAchievementFilters() {
  const filters = document.getElementById("achievementFilters");
  if (!filters) return;
  filters.replaceChildren();
  ACHIEVEMENT_FILTERS.forEach((filter) => filters.append(achievementNode("button", { className: `achievement-filter${filter === activeAchievementFilter ? " active" : ""}`, text: filter, attributes: { type: "button", "data-achievement-filter": filter, "aria-pressed": String(filter === activeAchievementFilter) } })));
}

function renderAchievementAdmin() {
  const count = document.getElementById("adminAchievementCount");
  if (count) count.textContent = String(achievementPosts.filter((post) => !post.archived).length);
  const list = document.getElementById("achievementAdminList");
  if (list) {
    list.replaceChildren();
    if (!achievementPosts.length) list.append(achievementEmpty("No achievement posts have been created."));
    achievementPosts.forEach((post) => {
      const item = achievementNode("div", { className: "achievement-admin-item" });
      const info = achievementNode("div", { className: "achievement-admin-item-info" });
      info.append(achievementNode("strong", { text: `${post.studentName} — ${post.award}` }), achievementNode("span", { text: `${post.category} · ${post.level}${post.archived ? " · Archived" : ""}${post.pinned ? " · Pinned" : ""}` }));
      const actions = achievementNode("div", { className: "achievement-admin-actions" });
      [["edit", "Edit"], ["pin", post.pinned ? "Unpin" : "Pin"], ["archive", post.archived ? "Restore" : "Archive"], ["reactions", post.reactionsDisabled ? "Enable reactions" : "Disable reactions"], ["delete", "Delete"]].forEach(([action, label]) => actions.append(achievementNode("button", { className: action === "delete" ? "danger" : "", text: label, attributes: { type: "button", "data-achievement-admin-action": action, "data-achievement-id": post.id } })));
      item.append(info, actions); list.append(item);
    });
  }
  const moderation = document.getElementById("achievementModerationList");
  if (moderation) {
    moderation.replaceChildren();
    const pending = achievementPosts.flatMap((post) => (post.messages || []).filter((message) => message.status === "pending").map((message) => ({ post, message })));
    if (!pending.length) moderation.append(achievementEmpty("No messages are waiting for approval."));
    pending.forEach(({ post, message }) => {
      const item = achievementNode("div", { className: "achievement-moderation-item" });
      const info = achievementNode("div"); info.append(achievementNode("strong", { text: `${message.name} · for ${post.studentName}` }), achievementNode("span", { text: message.message }));
      const actions = achievementNode("div", { className: "achievement-admin-actions" });
      actions.append(achievementNode("button", { text: "Approve", attributes: { type: "button", "data-message-action": "approve", "data-achievement-id": post.id, "data-message-id": message.id } }), achievementNode("button", { className: "danger", text: "Reject", attributes: { type: "button", "data-message-action": "reject", "data-achievement-id": post.id, "data-message-id": message.id } }));
      item.append(info, actions); moderation.append(item);
    });
  }
}

async function achievementImageData(file, width = 1600, height = 1600, quality = .82) {
  if (!file) return "";
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Use a JPG, PNG or WebP image smaller than 8 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const scale = Math.min(1, width / image.naturalWidth, height / image.naturalHeight);
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally { URL.revokeObjectURL(url); }
}

function resetAchievementForm() {
  const form = document.getElementById("achievementForm"); if (!form) return;
  form.reset(); document.getElementById("achievementEditId").value = ""; document.getElementById("achievementFormHeading").textContent = "Publish a student achievement"; document.getElementById("achievementCancelEdit").hidden = true;
  const date = document.getElementById("achievementDate"); if (date) date.value = new Date().toISOString().slice(0, 10);
}

function editAchievement(post) {
  const values = { achievementEditId: post.id, achievementStudentName: post.studentName, achievementGradeClass: post.gradeClass, achievementCompetition: post.competition, achievementCategory: post.category, achievementLevel: post.level, achievementAward: post.award, achievementDate: post.date, achievementDescription: post.description };
  Object.entries(values).forEach(([id, value]) => { const input = document.getElementById(id); if (input) input.value = value; });
  document.getElementById("achievementPinned").checked = Boolean(post.pinned); document.getElementById("achievementFeatured").checked = Boolean(post.featured); document.getElementById("achievementReactionsDisabled").checked = Boolean(post.reactionsDisabled);
  document.getElementById("achievementFormHeading").textContent = "Edit student achievement"; document.getElementById("achievementCancelEdit").hidden = false; document.getElementById("achievementStudentName").focus();
}

async function saveAchievementForm(form) {
  const id = document.getElementById("achievementEditId").value;
  const existing = achievementPosts.find((post) => post.id === id);
  const photoFile = document.getElementById("achievementStudentPhoto").files[0];
  if (!existing && !photoFile) throw new Error("Choose a student photograph.");
  const studentPhoto = photoFile ? await achievementImageData(photoFile, 1600, 1600, .84) : existing.studentPhoto;
  const certificateFile = document.getElementById("achievementCertificate").files[0];
  const certificate = certificateFile ? await achievementImageData(certificateFile, 1600, 1600, .84) : existing?.certificate || "";
  const galleryFiles = [...document.getElementById("achievementGallery").files].slice(0, 6);
  const gallery = galleryFiles.length ? await Promise.all(galleryFiles.map((file) => achievementImageData(file, 1400, 1400, .78))) : existing?.gallery || [];
  const post = {
    id: existing?.id || `achievement-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    studentName: achievementClean(document.getElementById("achievementStudentName").value, 100), gradeClass: achievementClean(document.getElementById("achievementGradeClass").value, 60), studentPhoto,
    competition: achievementClean(document.getElementById("achievementCompetition").value, 140), category: achievementClean(document.getElementById("achievementCategory").value, 40), level: achievementClean(document.getElementById("achievementLevel").value, 40), award: achievementClean(document.getElementById("achievementAward").value, 100), date: document.getElementById("achievementDate").value,
    description: achievementClean(document.getElementById("achievementDescription").value, 600), certificate, gallery,
    pinned: document.getElementById("achievementPinned").checked, featured: document.getElementById("achievementFeatured").checked, reactionsDisabled: document.getElementById("achievementReactionsDisabled").checked,
    archived: existing?.archived || false, reactions: existing?.reactions || Object.fromEntries(ACHIEVEMENT_REACTIONS.map(([key]) => [key, 0])), messages: existing?.messages || [], createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  if (!post.studentName || !post.competition || !post.award || !post.description) throw new Error("Complete all required achievement details.");
  if (post.featured) achievementPosts.forEach((item) => { if (item.id !== post.id) item.featured = false; });
  if (existing) achievementPosts[achievementPosts.indexOf(existing)] = post; else achievementPosts.unshift(post);
  if (!achievementSave()) throw new Error("The post could not be saved because device storage is full.");
  resetAchievementForm(); renderAllAchievements(); achievementNotify(existing ? "Achievement updated." : "Achievement published."); form.querySelector("button[type=submit]").disabled = false;
}

function reactToAchievement(postId, reaction) {
  const post = achievementPosts.find((item) => item.id === postId); if (!post || post.reactionsDisabled) return;
  post.reactions ||= {}; const previous = achievementBrowserReactions[postId];
  if (previous) post.reactions[previous] = Math.max(0, Number(post.reactions[previous] || 0) - 1);
  if (previous === reaction) delete achievementBrowserReactions[postId];
  else { post.reactions[reaction] = Number(post.reactions[reaction] || 0) + 1; achievementBrowserReactions[postId] = reaction; }
  achievementSave(); renderAllAchievements();
}

function moderateAchievementMessage(postId, messageId, action) {
  const post = achievementPosts.find((item) => item.id === postId); const message = post?.messages?.find((item) => item.id === messageId); if (!message) return;
  if (action === "approve") message.status = "approved"; else post.messages = post.messages.filter((item) => item.id !== messageId);
  achievementSave(); renderAllAchievements(); achievementNotify(action === "approve" ? "Message approved." : "Message rejected.");
}

function renderAllAchievements() { renderAchievementFilters(); renderAchievementFeatured(); renderAchievementWall(); renderAchievementAdmin(); }

document.addEventListener("submit", async (event) => {
  if (event.target.id === "achievementForm") {
    event.preventDefault(); const button = event.target.querySelector("button[type=submit]"); button.disabled = true;
    try { await saveAchievementForm(event.target); }
    catch (error) { document.getElementById("achievementFormMessage").textContent = error.message; button.disabled = false; }
    return;
  }
  const messageForm = event.target.closest("[data-achievement-message-form]");
  if (messageForm) {
    event.preventDefault(); const post = achievementPosts.find((item) => item.id === messageForm.dataset.achievementMessageForm); if (!post) return;
    const data = new FormData(messageForm), name = achievementClean(data.get("displayName"), 60), message = achievementClean(data.get("message"), 180);
    if (name.length < 2 || message.length < 3) { achievementNotify("Enter a display name and a short message."); return; }
    post.messages ||= []; post.messages.push({ id: `message-${Date.now()}-${Math.random().toString(16).slice(2)}`, name, message, status: "pending", createdAt: new Date().toISOString() });
    achievementSave(); messageForm.reset(); achievementNotify("Thank you. Your message is waiting for administrator approval.");
  }
});

document.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-achievement-filter]"); if (filter) { activeAchievementFilter = filter.dataset.achievementFilter; renderAchievementFilters(); renderAchievementWall(); return; }
  const reaction = event.target.closest("[data-achievement-reaction]"); if (reaction) { reactToAchievement(reaction.dataset.achievementId, reaction.dataset.achievementReaction); return; }
  const imageButton = event.target.closest("[data-achievement-image]"); if (imageButton) { const modal = document.getElementById("achievementImageModal"); document.getElementById("achievementModalImage").src = imageButton.dataset.achievementImage; document.getElementById("achievementModalImage").alt = imageButton.dataset.imageCaption; document.getElementById("achievementModalCaption").textContent = imageButton.dataset.imageCaption; modal.classList.add("active"); document.body.classList.add("modal-open"); return; }
  if (event.target.closest("[data-close-achievement-image]")) { const modal = document.getElementById("achievementImageModal"); modal?.classList.remove("active"); const image = document.getElementById("achievementModalImage"); if (image) image.removeAttribute("src"); if (!document.querySelector(".modal.active")) document.body.classList.remove("modal-open"); return; }
  const admin = event.target.closest("[data-achievement-admin-action]");
  if (admin) {
    const post = achievementPosts.find((item) => item.id === admin.dataset.achievementId); if (!post) return; const action = admin.dataset.achievementAdminAction;
    if (action === "edit") editAchievement(post);
    if (action === "pin") { post.pinned = !post.pinned; achievementSave(); renderAllAchievements(); }
    if (action === "archive") { post.archived = !post.archived; achievementSave(); renderAllAchievements(); }
    if (action === "reactions") { post.reactionsDisabled = !post.reactionsDisabled; achievementSave(); renderAllAchievements(); }
    if (action === "delete" && window.confirm(`Delete the achievement for ${post.studentName}?`)) { achievementPosts = achievementPosts.filter((item) => item.id !== post.id); delete achievementBrowserReactions[post.id]; achievementSave(); renderAllAchievements(); }
    return;
  }
  const moderation = event.target.closest("[data-message-action]"); if (moderation) moderateAchievementMessage(moderation.dataset.achievementId, moderation.dataset.messageId, moderation.dataset.messageAction);
  if (event.target.closest("#achievementCancelEdit")) resetAchievementForm();
});

document.getElementById("achievementSort")?.addEventListener("change", renderAchievementWall);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.getElementById("achievementImageModal")?.classList.contains("active")) document.querySelector("[data-close-achievement-image]")?.click(); });
resetAchievementForm();
renderAllAchievements();
