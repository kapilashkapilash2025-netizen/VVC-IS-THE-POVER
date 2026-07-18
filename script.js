"use strict";

const STORAGE_KEYS = {
  updates: "vvcSchoolUpdates",
  gallery: "vvcSchoolGallery",
  likes: "vvcLikedUpdates"
};

const DEFAULT_SCHOOL_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const SCHOOL_LOGO_IMAGE = "./assets/school-logo.png";

const defaultUpdates = [
  {
    id: "vvc-update-1",
    type: "notice",
    title: "Welcome to the VVC Digital Information Portal",
    description:
      "Students, parents, teachers, alumni and visitors can use this portal to view school notices, events, competitions, invitations and gallery updates.",
    date: "2026-07-18",
    image: DEFAULT_SCHOOL_IMAGE,
    likes: 18
  },
  {
    id: "vvc-update-2",
    type: "event",
    title: "School Community Development Programme",
    description:
      "Students and parents are invited to participate in the upcoming school community development programme. Additional programme details will be published by the school administration.",
    date: "2026-07-25",
    image: DEFAULT_SCHOOL_IMAGE,
    likes: 27
  },
  {
    id: "vvc-update-3",
    type: "competition",
    title: "Inter-School Academic Competition",
    description:
      "Eligible students may register through their class teachers. Competition categories, rules and final dates will be announced through the school office.",
    date: "2026-08-05",
    image: DEFAULT_SCHOOL_IMAGE,
    likes: 31
  },
  {
    id: "vvc-update-4",
    type: "invitation",
    title: "Parents and Teachers Meeting",
    description:
      "Parents are invited to attend the school progress meeting. Teachers will provide information about academic development, attendance and student participation.",
    date: "2026-08-12",
    image: DEFAULT_SCHOOL_IMAGE,
    likes: 22
  }
];

const defaultGallery = [
  {
    id: "vvc-gallery-1",
    title: "Vavuniya Vipulanantha College",
    category: "School Campus",
    image: DEFAULT_SCHOOL_IMAGE
  },
  {
    id: "vvc-gallery-2",
    title: "Official College Crest",
    category: "School Identity",
    image: SCHOOL_LOGO_IMAGE
  },
  {
    id: "vvc-gallery-3",
    title: "Learning and Leadership",
    category: "Academic",
    image: DEFAULT_SCHOOL_IMAGE
  },
  {
    id: "vvc-gallery-4",
    title: "School Community",
    category: "Community",
    image: DEFAULT_SCHOOL_IMAGE
  }
];

let schoolUpdates = loadArray(
  STORAGE_KEYS.updates,
  defaultUpdates
);

let schoolGallery = loadArray(
  STORAGE_KEYS.gallery,
  defaultGallery
);

schoolGallery = schoolGallery.map((item) =>
  item.id === "vvc-gallery-2" && item.image === DEFAULT_SCHOOL_IMAGE
    ? { ...item, image: SCHOOL_LOGO_IMAGE }
    : item
);

let likedUpdates = loadArray(
  STORAGE_KEYS.likes,
  []
);

let activeFilter = "all";
let adminLoggedIn = false;
let passwordRecoveryMode = false;
let toastTimer = null;

const updatesGrid = document.getElementById("updatesGrid");
const galleryGrid = document.getElementById("galleryGrid");

const updatesEmptyState =
  document.getElementById("updatesEmptyState");

const galleryEmptyState =
  document.getElementById("galleryEmptyState");

const loginModal = document.getElementById("loginModal");
const adminModal = document.getElementById("adminModal");

const updateDetailModal =
  document.getElementById("updateDetailModal");

const galleryPreviewModal =
  document.getElementById("galleryPreviewModal");

const loginForm = document.getElementById("loginForm");
const updateForm = document.getElementById("updateForm");
const galleryForm = document.getElementById("galleryForm");

const loginMessage = document.getElementById("loginMessage");

const updateFormMessage =
  document.getElementById("updateFormMessage");

const galleryFormMessage =
  document.getElementById("galleryFormMessage");

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function loadArray(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key);

    if (!storedValue) {
      localStorage.setItem(
        key,
        JSON.stringify(fallback)
      );

      return cloneData(fallback);
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return cloneData(fallback);
    }

    return parsedValue;
  } catch (error) {
    console.error(`Unable to load ${key}:`, error);
    return cloneData(fallback);
  }
}

function saveArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    const cloudTypes = {
      [STORAGE_KEYS.updates]: "updates",
      [STORAGE_KEYS.gallery]: "gallery"
    };
    if (cloudTypes[key] && window.VVCCloud) {
      window.VVCCloud.putCollection(cloudTypes[key], value);
    }
    return true;
  } catch (error) {
    console.error(`Unable to save ${key}:`, error);
    showToast("Not enough device storage. Remove older photos and try again.");
    return false;
  }
}

async function optimizeImageFile(file) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  if (!file || !allowedTypes.includes(file.type)) {
    throw new Error("Choose a JPG, PNG, WebP or HEIC image.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("The selected image is larger than 20 MB.");
  }

  let bitmap;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image format is not supported by this browser. Try JPG, PNG or WebP.");
  }

  const landscape = bitmap.width >= bitmap.height;
  const maxWidth = landscape ? 2560 : 1440;
  const maxHeight = landscape ? 1440 : 2560;
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    bitmap.close();
    throw new Error("Photo processing is unavailable in this browser.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );

  if (!blob) {
    throw new Error("The photo could not be optimized.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(blob);
  });
}

function showUploadPreview(input, preview) {
  const file = input.files?.[0];
  const image = preview.querySelector("img");

  if (!file) {
    preview.hidden = true;
    image.removeAttribute("src");
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  image.onload = () => URL.revokeObjectURL(previewUrl);
  image.src = previewUrl;
  preview.hidden = false;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function escapeHTML(value) {
  const temporaryElement = document.createElement("div");
  temporaryElement.textContent = String(value);
  return temporaryElement.innerHTML;
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function getCategoryName(type) {
  const categories = {
    notice: "Notice",
    event: "Event",
    competition: "Competition",
    invitation: "Invitation"
  };

  return categories[type] || "School Update";
}

function renderUpdates() {
  const visibleUpdates =
    activeFilter === "all"
      ? schoolUpdates
      : schoolUpdates.filter(
          (update) => update.type === activeFilter
        );

  const sortedUpdates = [...visibleUpdates].sort(
    (firstUpdate, secondUpdate) =>
      new Date(secondUpdate.date).getTime() -
      new Date(firstUpdate.date).getTime()
  );

  updatesGrid.innerHTML = "";

  if (sortedUpdates.length === 0) {
    updatesEmptyState.classList.remove("hidden");
    return;
  }

  updatesEmptyState.classList.add("hidden");

  sortedUpdates.forEach((update) => {
    const liked = likedUpdates.includes(update.id);

    const card = document.createElement("article");
    card.className = "update-card";

    card.innerHTML = `
      <div class="update-card-image">
        <img
          src="${escapeHTML(
            update.image || DEFAULT_SCHOOL_IMAGE
          )}"
          alt="${escapeHTML(update.title)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${DEFAULT_SCHOOL_IMAGE}'"
        />

        <span
          class="update-category category-${escapeHTML(
            update.type
          )}"
        >
          ${escapeHTML(getCategoryName(update.type))}
        </span>
      </div>

      <div class="update-card-body">
        <div class="update-date">
          <span>📅</span>
          <span>${escapeHTML(formatDate(update.date))}</span>
        </div>

        <h3>${escapeHTML(update.title)}</h3>

        <p>${escapeHTML(update.description)}</p>

        <div class="update-card-footer">
          <button
            type="button"
            class="read-more-button"
            data-read-update="${escapeHTML(update.id)}"
          >
            Read full details →
          </button>

          <button
            type="button"
            class="like-button ${liked ? "liked" : ""}"
            data-like-update="${escapeHTML(update.id)}"
            aria-label="Like this update"
          >
            <span class="heart-icon">
              ${liked ? "♥" : "♡"}
            </span>

            <span>${Number(update.likes) || 0}</span>
          </button>
        </div>
      </div>
    `;

    updatesGrid.appendChild(card);
  });
}

function renderGallery() {
  galleryGrid.innerHTML = "";

  if (schoolGallery.length === 0) {
    galleryEmptyState.classList.remove("hidden");
    return;
  }

  galleryEmptyState.classList.add("hidden");

  schoolGallery.forEach((galleryItem) => {
    const card = document.createElement("article");

    card.className = "gallery-card";
    card.tabIndex = 0;
    card.dataset.galleryId = galleryItem.id;

    card.innerHTML = `
      <img
        src="${escapeHTML(galleryItem.image)}"
        alt="${escapeHTML(galleryItem.title)}"
        loading="lazy"
        onerror="this.onerror=null;this.src='${DEFAULT_SCHOOL_IMAGE}'"
      />

      <div class="gallery-card-overlay">
        <span>${escapeHTML(galleryItem.category)}</span>
        <h3>${escapeHTML(galleryItem.title)}</h3>
      </div>
    `;

    const image = card.querySelector("img");

    const applyAutomaticLayout = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        return;
      }

      const ratio = image.naturalWidth / image.naturalHeight;
      card.classList.remove("is-landscape", "is-portrait", "is-square");

      if (ratio >= 1.28) {
        card.classList.add("is-landscape");
      } else if (ratio <= 0.82) {
        card.classList.add("is-portrait");
      } else {
        card.classList.add("is-square");
      }

      card.style.setProperty("--photo-ratio", String(ratio));
    };

    image.addEventListener("load", applyAutomaticLayout, { once: true });

    galleryGrid.appendChild(card);

    if (image.complete) {
      applyAutomaticLayout();
    }
  });
}

function renderAdminContent() {
  const updateList =
    document.getElementById("adminUpdatesList");

  const galleryList =
    document.getElementById("adminGalleryList");

  document.getElementById("adminUpdateCount").textContent =
    schoolUpdates.length;

  document.getElementById("adminGalleryCount").textContent =
    schoolGallery.length;

  const totalLikes = schoolUpdates.reduce(
    (total, update) =>
      total + Number(update.likes || 0),
    0
  );

  document.getElementById("adminLikeCount").textContent =
    totalLikes;

  if (schoolUpdates.length === 0) {
    updateList.innerHTML = `
      <div class="empty-state">
        <p>No published updates.</p>
      </div>
    `;
  } else {
    updateList.innerHTML = schoolUpdates
      .map(
        (update) => `
          <div class="management-item">
            <div class="management-item-info">
              <strong>${escapeHTML(update.title)}</strong>

              <span>
                ${escapeHTML(getCategoryName(update.type))}
                ·
                ${escapeHTML(formatDate(update.date))}
              </span>
            </div>

            <button
              type="button"
              class="delete-button"
              data-delete-update="${escapeHTML(update.id)}"
            >
              Delete
            </button>
          </div>
        `
      )
      .join("");
  }

  if (schoolGallery.length === 0) {
    galleryList.innerHTML = `
      <div class="empty-state">
        <p>No gallery photos.</p>
      </div>
    `;
  } else {
    galleryList.innerHTML = schoolGallery
      .map(
        (galleryItem) => `
          <div class="management-item">
            <div class="management-item-info">
              <strong>${escapeHTML(galleryItem.title)}</strong>
              <span>${escapeHTML(galleryItem.category)}</span>
            </div>

            <button
              type="button"
              class="delete-button"
              data-delete-gallery="${escapeHTML(
                galleryItem.id
              )}"
            >
              Delete
            </button>
          </div>
        `
      )
      .join("");
  }
}

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.add("active");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("active");

  if (!document.querySelector(".modal.active")) {
    document.body.classList.remove("modal-open");
  }
}

function showToast(message) {
  const toast = document.getElementById("toastMessage");

  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(toastTimer);

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function toggleUpdateLike(updateId) {
  const update = schoolUpdates.find(
    (item) => item.id === updateId
  );

  if (!update) {
    return;
  }

  const previouslyLiked =
    likedUpdates.includes(updateId);

  if (previouslyLiked) {
    likedUpdates = likedUpdates.filter(
      (id) => id !== updateId
    );

    update.likes = Math.max(
      0,
      Number(update.likes || 0) - 1
    );

    showToast("Like removed.");
  } else {
    likedUpdates.push(updateId);
    update.likes = Number(update.likes || 0) + 1;

    showToast("Thank you for supporting the school update.");
  }

  saveArray(STORAGE_KEYS.updates, schoolUpdates);
  saveArray(STORAGE_KEYS.likes, likedUpdates);

  renderUpdates();
  renderAdminContent();
}

function showUpdateDetails(updateId) {
  const update = schoolUpdates.find(
    (item) => item.id === updateId
  );

  if (!update) {
    return;
  }

  const detailImage =
    document.getElementById("detailImage");

  detailImage.src =
    update.image || DEFAULT_SCHOOL_IMAGE;

  detailImage.alt = update.title;

  detailImage.onerror = () => {
    detailImage.onerror = null;
    detailImage.src = DEFAULT_SCHOOL_IMAGE;
  };

  document.getElementById("detailBadge").textContent =
    getCategoryName(update.type);

  document.getElementById("detailDate").textContent =
    formatDate(update.date);

  document.getElementById("detailTitle").textContent =
    update.title;

  document.getElementById("detailDescription").textContent =
    update.description;

  openModal(updateDetailModal);
}

function showGalleryPreview(galleryId) {
  const galleryItem = schoolGallery.find(
    (item) => item.id === galleryId
  );

  if (!galleryItem) {
    return;
  }

  const previewImage =
    document.getElementById("galleryPreviewImage");

  previewImage.src = galleryItem.image;
  previewImage.alt = galleryItem.title;

  previewImage.onerror = () => {
    previewImage.onerror = null;
    previewImage.src = DEFAULT_SCHOOL_IMAGE;
  };

  document.getElementById(
    "galleryPreviewCategory"
  ).textContent = galleryItem.category;

  document.getElementById(
    "galleryPreviewTitle"
  ).textContent = galleryItem.title;

  openModal(galleryPreviewModal);
}

function activateAdminTab(button) {
  document
    .querySelectorAll(".admin-tab")
    .forEach((tab) => tab.classList.remove("active"));

  document
    .querySelectorAll(".admin-panel")
    .forEach((panel) => panel.classList.remove("active"));

  button.classList.add("active");

  const panel =
    document.getElementById(button.dataset.adminTab);

  if (panel) {
    panel.classList.add("active");
  }

  if (button.dataset.adminTab === "manageContentPanel") {
    renderAdminContent();
  }
}

function setDefaultDate() {
  const dateInput =
    document.getElementById("updateDate");

  if (dateInput) {
    dateInput.value =
      new Date().toISOString().split("T")[0];
  }
}

function updateLiveDate() {
  const liveDate = document.getElementById("liveDate");

  liveDate.textContent =
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date());
}

function updateSchoolYears() {
  const currentYear = new Date().getFullYear();
  const years = currentYear - 1958;

  document.getElementById("schoolYears").textContent =
    years;
}

function setupCounters() {
  const counterElements =
    document.querySelectorAll("[data-counter]");

  const counterObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const element = entry.target;
        const target = Number(element.dataset.counter);
        const duration = 1200;
        const startTime = performance.now();

        function updateCounter(currentTime) {
          const progress = Math.min(
            (currentTime - startTime) / duration,
            1
          );

          const value = Math.floor(
            target * (1 - Math.pow(1 - progress, 3))
          );

          element.textContent = value.toLocaleString();

          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          }
        }

        requestAnimationFrame(updateCounter);
        observer.unobserve(element);
      });
    },
    {
      threshold: 0.4
    }
  );

  counterElements.forEach((element) => {
    counterObserver.observe(element);
  });
}

function updateActiveNavigation() {
  const sections = document.querySelectorAll(
    "main section[id]"
  );

  const navigationLinks =
    document.querySelectorAll(".navigation-link");

  let currentSection = "home";

  sections.forEach((section) => {
    const sectionTop = section.offsetTop - 180;

    if (window.scrollY >= sectionTop) {
      currentSection = section.id;
    }
  });

  navigationLinks.forEach((link) => {
    link.classList.toggle(
      "active",
      link.getAttribute("href") === `#${currentSection}`
    );
  });
}

/* Navigation */

const mainNavigation =
  document.getElementById("mainNavigation");

const mobileNavigationButton =
  document.getElementById("mobileNavigationButton");

mobileNavigationButton.addEventListener("click", () => {
  const isOpen =
    mainNavigation.classList.toggle("active");

  mobileNavigationButton.setAttribute(
    "aria-expanded",
    String(isOpen)
  );
});

mainNavigation
  .querySelectorAll('a[href^="#"]')
  .forEach((link) => {
    link.addEventListener("click", () => {
      mainNavigation.classList.remove("active");

      mobileNavigationButton.setAttribute(
        "aria-expanded",
        "false"
      );
    });
  });

/* Admin login */

document
  .getElementById("adminLoginButton")
  .addEventListener("click", () => {
    mainNavigation.classList.remove("active");

    if (adminLoggedIn) {
      renderAdminContent();
      openModal(adminModal);
      return;
    }

    loginMessage.textContent = "";
    openModal(loginModal);
  });

document
  .getElementById("togglePasswordButton")
  ?.addEventListener("click", () => {
    const passwordInput =
      document.getElementById("adminPassword");

    passwordInput.type =
      passwordInput.type === "password"
        ? "text"
        : "password";
  });

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document
    .getElementById("adminUsername")
    .value.trim();
  const password = document
    .getElementById("adminPassword")
    .value;
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = passwordRecoveryMode ? "Saving password…" : "Signing in…";
  try {
    if (!window.VVCCloud) throw new Error("Cloud sign-in is temporarily unavailable.");
    if (passwordRecoveryMode) {
      await window.VVCCloud.updatePassword(password);
      passwordRecoveryMode = false;
      loginMessage.textContent = "New password saved successfully.";
    } else {
      await window.VVCCloud.signInWithPassword(email, password);
      loginMessage.textContent = "Signed in successfully.";
    }
    closeModal(loginModal);
    renderAdminContent();
    openModal(adminModal);
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = passwordRecoveryMode ? "Save New Password" : "Sign In";
  }
});

document
  .getElementById("resetAdminPasswordButton")
  ?.addEventListener("click", async () => {
    const email = document.getElementById("adminUsername").value.trim();
    const resetButton = document.getElementById("resetAdminPasswordButton");
    resetButton.disabled = true;
    resetButton.textContent = "Sending reset email…";
    loginMessage.textContent = "";
    try {
      if (!window.VVCCloud) throw new Error("Cloud sign-in is temporarily unavailable.");
      await window.VVCCloud.sendPasswordReset(email);
      loginMessage.textContent = "Password setup email sent. Open it from the authorized inbox.";
    } catch (error) {
      loginMessage.textContent = error.message;
    } finally {
      resetButton.disabled = false;
      resetButton.textContent = "Set / Reset Password";
    }
  });

document
  .getElementById("logoutButton")
  .addEventListener("click", async () => {
    adminLoggedIn = false;
    if (window.VVCCloud) await window.VVCCloud.signOut();
    closeModal(adminModal);
    showToast("Administrator signed out.");
  });

document.addEventListener("vvc:auth", (event) => {
  const email = event.detail?.session?.user?.email?.toLowerCase();
  adminLoggedIn = email === window.VVCCloud?.adminEmail;
  if (event.detail?.authEvent === "PASSWORD_RECOVERY") {
    passwordRecoveryMode = true;
    document.getElementById("adminUsername").value = window.VVCCloud.adminEmail;
    loginForm.querySelector('button[type="submit"]').textContent = "Save New Password";
    loginMessage.textContent = "Enter and save your new password.";
    openModal(loginModal);
    return;
  }
  if (adminLoggedIn) {
    closeModal(loginModal);
    renderAdminContent();
    showToast("Secure cloud administration is active.");
  }
});

document.addEventListener("vvc:cloud-sync", (event) => {
  if (event.detail?.type === "updates") { schoolUpdates = event.detail.records; renderUpdates(); renderAdminContent(); }
  if (event.detail?.type === "gallery") { schoolGallery = event.detail.records; renderGallery(); renderAdminContent(); }
});

document.addEventListener("vvc:cloud-status", (event) => showToast(event.detail?.message || "Cloud status updated."));

/* Add update */

updateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!adminLoggedIn) {
    closeModal(adminModal);
    openModal(loginModal);
    return;
  }

  const type =
    document.getElementById("updateType").value;

  const date =
    document.getElementById("updateDate").value;

  const title = document
    .getElementById("updateTitle")
    .value.trim();

  const description = document
    .getElementById("updateDescription")
    .value.trim();

  if (!type || !date || !title || !description) {
    updateFormMessage.textContent =
      "Complete all required fields.";
    return;
  }

  const submitButton = updateForm.querySelector('button[type="submit"]');
  const imageFile = document.getElementById("updateImage").files?.[0];
  let image = DEFAULT_SCHOOL_IMAGE;

  submitButton.disabled = true;
  submitButton.textContent = imageFile ? "Optimizing photo…" : "Publishing…";

  try {
    if (imageFile) {
      image = await optimizeImageFile(imageFile);
    }
  } catch (error) {
    updateFormMessage.textContent = error.message;
    submitButton.disabled = false;
    submitButton.textContent = "Publish Now";
    return;
  }

  const newUpdate = {
    id: createId("vvc-update"),
    type,
    title,
    description,
    date,
    image,
    likes: 0
  };

  schoolUpdates.unshift(newUpdate);

  if (!saveArray(STORAGE_KEYS.updates, schoolUpdates)) {
    schoolUpdates = schoolUpdates.filter((item) => item.id !== newUpdate.id);
    updateFormMessage.textContent = "Not enough device storage. Remove older photos and try again.";
    submitButton.disabled = false;
    submitButton.textContent = "Publish Now";
    return;
  }

  updateForm.reset();
  setDefaultDate();
  document.getElementById("updateImagePreview").hidden = true;
  submitButton.disabled = false;
  submitButton.textContent = "Publish Now";

  updateFormMessage.textContent =
    "School update published successfully.";

  renderUpdates();
  renderAdminContent();

  showToast("New school update published.");

  window.setTimeout(() => {
    updateFormMessage.textContent = "";
  }, 3000);
});

/* Add gallery */

galleryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!adminLoggedIn) {
    closeModal(adminModal);
    openModal(loginModal);
    return;
  }

  const title = document
    .getElementById("galleryTitle")
    .value.trim();

  const category =
    document.getElementById("galleryCategory").value;

  const galleryImageInput = document.getElementById("galleryImage");
  const imageFile = galleryImageInput.files?.[0];

  if (!title || !category || !imageFile) {
    galleryFormMessage.textContent =
      "Complete all gallery fields.";
    return;
  }

  const submitButton = galleryForm.querySelector('button[type="submit"]');
  let image;

  submitButton.disabled = true;
  submitButton.textContent = "Optimizing QHD photo…";

  try {
    image = await optimizeImageFile(imageFile);
  } catch (error) {
    galleryFormMessage.textContent = error.message;
    submitButton.disabled = false;
    submitButton.textContent = "Add Photo";
    return;
  }

  const galleryItem = {
    id: createId("vvc-gallery"),
    title,
    category,
    image
  };

  schoolGallery.unshift(galleryItem);

  if (!saveArray(STORAGE_KEYS.gallery, schoolGallery)) {
    schoolGallery = schoolGallery.filter((item) => item.id !== galleryItem.id);
    galleryFormMessage.textContent = "Not enough device storage. Delete older gallery photos and try again.";
    submitButton.disabled = false;
    submitButton.textContent = "Add Photo";
    return;
  }

  galleryForm.reset();
  document.getElementById("galleryImagePreview").hidden = true;
  submitButton.disabled = false;
  submitButton.textContent = "Add Photo";

  galleryFormMessage.textContent =
    "Gallery photo published successfully.";

  renderGallery();
  renderAdminContent();

  showToast("New gallery photo added.");

  window.setTimeout(() => {
    galleryFormMessage.textContent = "";
  }, 3000);
});

document.getElementById("updateImage").addEventListener("change", (event) => {
  showUploadPreview(event.currentTarget, document.getElementById("updateImagePreview"));
});

document.getElementById("galleryImage").addEventListener("change", (event) => {
  showUploadPreview(event.currentTarget, document.getElementById("galleryImagePreview"));
});

/* Global click handling */

document.addEventListener("click", (event) => {
  const clearUploadButton = event.target.closest("[data-clear-upload]");

  if (clearUploadButton) {
    const input = document.getElementById(clearUploadButton.dataset.clearUpload);
    const preview = clearUploadButton.closest(".upload-preview");
    input.value = "";
    preview.hidden = true;
    preview.querySelector("img").removeAttribute("src");
  }

  const closeElement =
    event.target.closest("[data-close-modal]");

  if (closeElement) {
    closeModal(
      document.getElementById(
        closeElement.dataset.closeModal
      )
    );
  }

  const filterButton =
    event.target.closest("[data-filter]");

  if (filterButton) {
    document
      .querySelectorAll(".filter-button")
      .forEach((button) => {
        button.classList.remove("active");
      });

    filterButton.classList.add("active");
    activeFilter = filterButton.dataset.filter;

    renderUpdates();
  }

  const likeButton =
    event.target.closest("[data-like-update]");

  if (likeButton) {
    toggleUpdateLike(
      likeButton.dataset.likeUpdate
    );
  }

  const readButton =
    event.target.closest("[data-read-update]");

  if (readButton) {
    showUpdateDetails(
      readButton.dataset.readUpdate
    );
  }

  const galleryCard =
    event.target.closest("[data-gallery-id]");

  if (galleryCard) {
    showGalleryPreview(
      galleryCard.dataset.galleryId
    );
  }

  const adminTab =
    event.target.closest("[data-admin-tab]");

  if (adminTab) {
    activateAdminTab(adminTab);
  }

  const deleteUpdateButton =
    event.target.closest("[data-delete-update]");

  if (deleteUpdateButton) {
    const updateId =
      deleteUpdateButton.dataset.deleteUpdate;

    const confirmed = window.confirm(
      "Delete this school update permanently?"
    );

    if (confirmed) {
      schoolUpdates = schoolUpdates.filter(
        (update) => update.id !== updateId
      );

      likedUpdates = likedUpdates.filter(
        (id) => id !== updateId
      );

      saveArray(
        STORAGE_KEYS.updates,
        schoolUpdates
      );

      saveArray(
        STORAGE_KEYS.likes,
        likedUpdates
      );

      renderUpdates();
      renderAdminContent();

      showToast("School update deleted.");
    }
  }

  const deleteGalleryButton =
    event.target.closest("[data-delete-gallery]");

  if (deleteGalleryButton) {
    const galleryId =
      deleteGalleryButton.dataset.deleteGallery;

    const confirmed = window.confirm(
      "Delete this gallery photo permanently?"
    );

    if (confirmed) {
      schoolGallery = schoolGallery.filter(
        (item) => item.id !== galleryId
      );

      saveArray(
        STORAGE_KEYS.gallery,
        schoolGallery
      );

      renderGallery();
      renderAdminContent();

      showToast("Gallery photo deleted.");
    }
  }
});

/* Keyboard accessibility */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document
      .querySelectorAll(".modal.active")
      .forEach((modal) => closeModal(modal));
  }

  if (
    event.key === "Enter" &&
    document.activeElement?.matches(
      "[data-gallery-id]"
    )
  ) {
    showGalleryPreview(
      document.activeElement.dataset.galleryId
    );
  }
});

/* Scroll behaviours */

const backToTop =
  document.getElementById("backToTop");

let scrollUpdateScheduled = false;

window.addEventListener("scroll", () => {
  if (scrollUpdateScheduled) return;
  scrollUpdateScheduled = true;

  window.requestAnimationFrame(() => {
    const siteHeader = document.getElementById("siteHeader");
    siteHeader.classList.toggle("scrolled", window.scrollY > 20);
    backToTop.classList.toggle("visible", window.scrollY > 500);
    updateActiveNavigation();
    scrollUpdateScheduled = false;
  });
}, { passive: true });

backToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

document
  .getElementById("viewAllGalleryButton")
  .addEventListener("click", () => {
    if (schoolGallery.length > 0) {
      showGalleryPreview(schoolGallery[0].id);
    }
  });

function initializeWebsite() {
  const currentYear = new Date().getFullYear();

  document.getElementById(
    "currentYear"
  ).textContent = currentYear;

  setDefaultDate();
  updateLiveDate();
  updateSchoolYears();

  renderUpdates();
  renderGallery();
  renderAdminContent();

  document.querySelectorAll("img").forEach((image, index) => {
    image.decoding = "async";
    if (index > 4 && !image.closest(".hero-section")) image.loading = "lazy";
  });

  setupCounters();
  updateActiveNavigation();

  document.querySelectorAll('img[src^="data:image/gif"]')
    .forEach((image) => {
    image.parentElement?.classList.add("asset-placeholder");
  });
}

initializeWebsite();
