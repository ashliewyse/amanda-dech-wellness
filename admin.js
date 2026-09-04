(function () {
    "use strict";

    const config = window.AMANDA_SITE_CONFIG;
    if (!config) return;

    const fallbackContent = {
        homepage: {
            kicker: "Medical · Wellness · Aesthetics",
            headline: "Care that feels personal, from the very first hello.",
            intro: "Amanda brings medical care, wellness support, and aesthetic services together in one welcoming practice—so caring for yourself can feel comfortable, clear, and refreshingly human.",
            start_label: "Start Here",
            start_heading: "What brings you in today?",
            start_note: "Choose Medical Care or Spa & Wellness on the next screen.",
            provider_name: "Amanda Dech, FNP-C",
            provider_title: "Family Nurse Practitioner",
            provider_blurb: "Clinical knowledge with a warm, practical approach to the way you want to feel."
        },
        care_paths: {
            spa_label: "The Glow Path",
            spa_title: "Spa Day",
            spa_subtitle: "Aesthetics, Wellness & Glow",
            spa_note: "Botox · Fillers · IV therapy",
            medical_label: "The Care Path",
            medical_title: "Sick Day",
            medical_subtitle: "Primary Care, Wellness & Medical Support",
            medical_note: "Primary care · Labs · Follow-ups"
        },
        staff: {
            primary_name: "Amanda Dech, FNP-C",
            primary_role: "Family Nurse Practitioner",
            primary_bio: "Amanda combines attentive medical care, wellness support, and aesthetic services with a warm, practical approach.",
            members: []
        },
        contact: {
            phone_display: "(219) 728-6562",
            phone_href: "tel:2197286562",
            address: "1531 S Calumet Rd",
            directions_url: "https://www.google.com/maps/search/?api=1&query=1531%20S%20Calumet%20Rd",
            hours_summary: "Appointments are scheduled directly with the office. Call to confirm current availability."
        },
        booking: { square_url: "", square_payment_url: "" },
        launch_checks: {
            services_prices: false,
            office_policies: false,
            contact_details: false,
            staff_details: false,
            photo_permissions: false,
            privacy_notice: false,
            reviewed_at: ""
        },
        images: {
            provider: "",
            spa_path: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=1400",
            medical_path: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=1400",
            office: "",
            staff_banner: "",
            staff_primary: ""
        }
    };

    const state = {
        demo: false,
        accessToken: "",
        refreshToken: "",
        user: null,
        content: clone(fallbackContent),
        testimonials: [],
        galleryItems: []
    };

    const loginView = document.getElementById("login-view");
    const dashboardView = document.getElementById("dashboard-view");
    const loginForm = document.getElementById("login-form");
    const loginMessage = document.getElementById("login-message");
    const demoButton = document.getElementById("demo-button");
    const toast = document.getElementById("admin-toast");
    const isLocalPreview = ["localhost", "127.0.0.1"].includes(location.hostname);
    const photoWarningDialog = document.getElementById("photo-warning-dialog");
    const photoWarningForm = document.getElementById("photo-warning-form");
    const patientPhotoConfirmation = document.getElementById("patient-photo-confirmation");
    const patientPhotoAuthorized = document.getElementById("patient-photo-authorized");
    const photoWarningContinue = document.getElementById("photo-warning-continue");
    const squareUrlInput = document.querySelector('[name="square_url"]');
    const squarePaymentUrlInput = document.querySelector('[name="square_payment_url"]');
    const squareInputs = [squareUrlInput, squarePaymentUrlInput].filter(Boolean);
    const squareLinkDialog = document.getElementById("square-link-dialog");
    let squareHelpShown = false;
    let squareRefocusInput = squareUrlInput;
    let pendingPhoto = null;
    let toastTimer;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function isPublicSquareUrl(value) {
        try {
            const url = new URL(value);
            const hostname = url.hostname.toLowerCase();
            const allowedDomains = ["squareup.com", "square.link", "square.site"];
            return url.protocol === "https:"
                && !url.username
                && !url.password
                && allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
        } catch {
            return false;
        }
    }

    function mergeContent(base, override) {
        if (!override || typeof override !== "object" || Array.isArray(override)) return base;
        Object.entries(override).forEach(([key, value]) => {
            if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object") {
                base[key] = mergeContent(base[key], value);
            } else {
                base[key] = value;
            }
        });
        return base;
    }

    function createTeamMemberId() {
        return `member-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeTeamMembers() {
        const staff = state.content.staff || clone(fallbackContent.staff);
        let members = Array.isArray(staff.members) ? staff.members : [];
        const hasLegacyMember = staff.secondary_name || staff.secondary_role || staff.secondary_bio || staff.secondary_visible;
        if (members.length === 0 && hasLegacyMember) {
            members = [{
                id: "member-legacy",
                name: staff.secondary_name || "",
                role: staff.secondary_role || "",
                bio: staff.secondary_bio || "",
                visible: Boolean(staff.secondary_visible),
                photo_url: state.content.images && state.content.images.staff_secondary || ""
            }];
        }
        const usedIds = new Set();
        staff.members = members.slice(0, 12).map((member) => {
            let id = typeof member.id === "string" && /^member-[a-z0-9-]+$/.test(member.id) ? member.id : createTeamMemberId();
            while (usedIds.has(id)) id = createTeamMemberId();
            usedIds.add(id);
            return {
                id,
                name: typeof member.name === "string" ? member.name.slice(0, 100) : "",
                role: typeof member.role === "string" ? member.role.slice(0, 100) : "",
                bio: typeof member.bio === "string" ? member.bio.slice(0, 500) : "",
                visible: Boolean(member.visible),
                photo_url: typeof member.photo_url === "string" ? member.photo_url : ""
            };
        });
        delete staff.secondary_name;
        delete staff.secondary_role;
        delete staff.secondary_bio;
        delete staff.secondary_visible;
        state.content.staff = staff;
    }

    function showToast(message, isError) {
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.toggle("is-error", Boolean(isError));
        toast.classList.add("is-visible");
        toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3600);
    }

    function headers(authenticated, extras) {
        const result = { apikey: config.publishableKey, Accept: "application/json", ...(extras || {}) };
        if (authenticated && state.accessToken) result.Authorization = `Bearer ${state.accessToken}`;
        return result;
    }

    async function request(path, options) {
        const response = await fetch(`${config.supabaseUrl}${path}`, options);
        let payload = null;
        const text = await response.text();
        if (text) {
            try { payload = JSON.parse(text); } catch { payload = text; }
        }
        if (!response.ok) {
            const message = payload && (payload.message || payload.msg || payload.error_description || payload.error);
            throw new Error(message || `Request failed (${response.status})`);
        }
        return payload;
    }

    function saveSession() {
        if (state.demo) return;
        sessionStorage.setItem("amandaWebsiteSession", JSON.stringify({
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            user: state.user
        }));
    }

    function clearSession() {
        sessionStorage.removeItem("amandaWebsiteSession");
        state.accessToken = "";
        state.refreshToken = "";
        state.user = null;
        state.demo = false;
    }

    async function verifyAdmin(userId) {
        const rows = await request(`/rest/v1/site_admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id`, {
            headers: headers(true)
        });
        return Array.isArray(rows) && rows.length === 1;
    }

    async function signIn(email, password) {
        const session = await request("/auth/v1/token?grant_type=password", {
            method: "POST",
            headers: headers(false, { "Content-Type": "application/json" }),
            body: JSON.stringify({ email, password })
        });
        state.accessToken = session.access_token;
        state.refreshToken = session.refresh_token;
        state.user = session.user;
        if (!await verifyAdmin(state.user.id)) {
            clearSession();
            throw new Error("This account has not been approved as a website manager yet.");
        }
        saveSession();
    }

    async function restoreSession() {
        const saved = sessionStorage.getItem("amandaWebsiteSession");
        if (!saved) return false;
        try {
            const parsed = JSON.parse(saved);
            state.accessToken = parsed.accessToken;
            state.refreshToken = parsed.refreshToken;
            const user = await request("/auth/v1/user", { headers: headers(true) });
            if (!user || !await verifyAdmin(user.id)) throw new Error("Session is not authorized");
            state.user = user;
            return true;
        } catch {
            clearSession();
            return false;
        }
    }

    async function loadContent() {
        if (state.demo) {
            state.content = clone(fallbackContent);
            normalizeTeamMembers();
            return;
        }
        const rows = await request(`/rest/v1/site_content?id=eq.${encodeURIComponent(config.contentRowId)}&select=content`, {
            headers: headers(true)
        });
        state.content = mergeContent(clone(fallbackContent), rows[0] && rows[0].content);
        normalizeTeamMembers();
    }

    async function loadTestimonials() {
        if (state.demo) {
            state.testimonials = [];
            return;
        }
        state.testimonials = await request("/rest/v1/testimonials?select=*&order=sort_order.asc,created_at.desc", {
            headers: headers(true)
        });
    }

    async function loadGallery() {
        if (state.demo) {
            state.galleryItems = [];
            return;
        }
        state.galleryItems = await request("/rest/v1/gallery_items?select=*&order=sort_order.asc,case_number.desc", {
            headers: headers(true)
        });
    }

    function populateForm(form, source) {
        Object.entries(source || {}).forEach(([name, value]) => {
            const field = form.elements.namedItem(name);
            if (field && typeof value === "string") field.value = value;
        });
    }

    function formValues(form) {
        const values = {};
        new FormData(form).forEach((value, key) => values[key] = String(value).trim());
        return values;
    }

    function populateChecks(form, source) {
        form.querySelectorAll('input[type="checkbox"][name]').forEach((field) => {
            field.checked = Boolean(source && source[field.name]);
        });
    }

    function teamPhotoSlot(memberId) {
        return `team-${memberId}`;
    }

    function teamMemberFromSlot(slot) {
        if (!slot.startsWith("team-member-")) return null;
        const memberId = slot.slice(5);
        return state.content.staff.members.find((member) => member.id === memberId) || null;
    }

    function setPhotoUrlForSlot(slot, url) {
        const member = teamMemberFromSlot(slot);
        if (member) member.photo_url = url;
        else state.content.images[slot] = url;
    }

    function readTeamMemberCards() {
        return Array.from(document.querySelectorAll("[data-team-member-id]")).map((card) => {
            const id = card.dataset.teamMemberId;
            const current = state.content.staff.members.find((member) => member.id === id);
            return {
                id,
                name: card.querySelector('[data-team-field="name"]').value.trim(),
                role: card.querySelector('[data-team-field="role"]').value.trim(),
                bio: card.querySelector('[data-team-field="bio"]').value.trim(),
                visible: card.querySelector('[data-team-field="visible"]').checked,
                photo_url: current && current.photo_url || ""
            };
        });
    }

    function captureStaffDraft() {
        const form = document.getElementById("staff-form");
        const values = formValues(form);
        state.content.staff = {
            ...state.content.staff,
            primary_name: values.primary_name,
            primary_role: values.primary_role,
            primary_bio: values.primary_bio,
            members: readTeamMemberCards()
        };
        return state.content.staff;
    }

    function renderTeamMembers() {
        const list = document.getElementById("team-member-list");
        list.replaceChildren();
        state.content.staff.members.forEach((member, index) => {
            const slot = teamPhotoSlot(member.id);
            const item = document.createElement("article");
            item.className = "admin-team-member";
            item.dataset.teamMemberId = member.id;
            item.innerHTML = `<div class="admin-staff-profile"><div><div class="admin-team-member-header"><h2>Team member ${index + 1}</h2><button class="admin-mini-button danger" type="button" data-remove-team-member>Remove</button></div><p class="admin-form-note">Keep this profile hidden until the name, credentials, biography, and photo are ready.</p><div class="admin-field-grid"><label>Name and credentials<input data-team-field="name" maxlength="100"></label><label>Professional role<input data-team-field="role" maxlength="100"></label><label class="admin-span-2">Short public biography<textarea data-team-field="bio" rows="4" maxlength="500"></textarea></label></div><label class="admin-check"><input data-team-field="visible" type="checkbox"><span>Show this person on the public staff page</span></label></div><article class="admin-photo-card admin-staff-photo-card" data-photo-card="${slot}"><div class="admin-photo-preview" data-photo-preview="${slot}"><span>Team member photo</span></div><div><h2>Profile photo</h2><p>Upload this before showing the profile.</p><label class="admin-upload">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input="${slot}"></label></div></article></div>`;
            item.querySelector('[data-team-field="name"]').value = member.name;
            item.querySelector('[data-team-field="role"]').value = member.role;
            item.querySelector('[data-team-field="bio"]').value = member.bio;
            item.querySelector('[data-team-field="visible"]').checked = member.visible;
            const preview = item.querySelector(`[data-photo-preview="${slot}"]`);
            if (member.photo_url) {
                preview.style.backgroundImage = `linear-gradient(rgba(20,16,21,.12), rgba(20,16,21,.28)), url("${String(member.photo_url).replace(/"/g, "%22")}")`;
                preview.querySelector("span").textContent = "Current profile photo";
            }
            list.appendChild(item);
        });
    }

    function renderPhotos() {
        let photoCount = 0;
        ["provider", "spa_path", "medical_path", "office", "staff_banner", "staff_primary"].forEach((slot) => {
            const preview = document.querySelector(`[data-photo-preview="${slot}"]`);
            const url = state.content.images && state.content.images[slot];
            if (url) {
                photoCount += 1;
                preview.style.backgroundImage = `linear-gradient(rgba(20,16,21,.12), rgba(20,16,21,.28)), url("${String(url).replace(/"/g, "%22")}")`;
                preview.querySelector("span").textContent = "Current website photo";
            } else {
                preview.style.backgroundImage = "";
            }
        });
        photoCount += state.content.staff.members.filter((member) => member.photo_url).length;
        document.getElementById("photo-count").textContent = String(photoCount);
    }

    function renderLaunchReview() {
        const form = document.getElementById("launch-form");
        const checks = state.content.launch_checks || {};
        populateChecks(form, checks);
        const completed = form.querySelectorAll('input[type="checkbox"]:checked').length;
        document.getElementById("launch-status").textContent = `${completed} of 6`;
        const note = document.getElementById("launch-reviewed-at");
        note.textContent = checks.reviewed_at && completed === 6
            ? `All items last confirmed ${new Date(checks.reviewed_at).toLocaleDateString()}.`
            : "Complete every confirmation before the website launches.";
    }

    function renderTestimonials() {
        const list = document.getElementById("testimonial-list");
        const empty = document.getElementById("testimonial-empty");
        list.replaceChildren();
        empty.hidden = state.testimonials.length > 0;

        state.testimonials.forEach((testimonial) => {
            const item = document.createElement("article");
            item.className = "admin-testimonial-item";

            const copy = document.createElement("div");
            const quote = document.createElement("blockquote");
            quote.textContent = `“${testimonial.quote}”`;
            const meta = document.createElement("div");
            meta.className = "admin-testimonial-meta";
            const dot = document.createElement("span");
            dot.className = `admin-status-dot${testimonial.published ? " published" : ""}`;
            meta.append(dot, document.createTextNode(`${testimonial.display_name} · ${testimonial.source} · ${testimonial.published ? "Published" : "Draft"}`));
            copy.append(quote, meta);

            const actions = document.createElement("div");
            actions.className = "admin-testimonial-actions";
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "admin-mini-button";
            toggle.textContent = testimonial.published ? "Unpublish" : "Publish";
            toggle.addEventListener("click", () => toggleTestimonial(testimonial));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "admin-mini-button danger";
            remove.textContent = "Delete";
            remove.addEventListener("click", () => deleteTestimonial(testimonial));
            actions.append(toggle, remove);
            item.append(copy, actions);
            list.appendChild(item);
        });

        document.getElementById("testimonial-count").textContent = String(state.testimonials.filter((item) => item.published).length);
    }

    function galleryResultLabel(item) {
        return `${item.service} · Result ${String(item.case_number).padStart(3, "0")}`;
    }

    function renderGallery() {
        const list = document.getElementById("gallery-list");
        const empty = document.getElementById("gallery-empty");
        list.replaceChildren();
        empty.hidden = state.galleryItems.length > 0;

        state.galleryItems.forEach((galleryItem) => {
            const item = document.createElement("article");
            item.className = "admin-gallery-item";

            const images = document.createElement("div");
            images.className = "admin-gallery-item-images";
            [["Before", galleryItem.before_url], ["After", galleryItem.after_url]].forEach(([label, url]) => {
                const image = document.createElement("div");
                image.style.backgroundImage = `url("${String(url).replace(/"/g, "%22")}")`;
                const badge = document.createElement("span");
                badge.textContent = label;
                image.appendChild(badge);
                images.appendChild(image);
            });

            const copy = document.createElement("div");
            copy.className = "admin-gallery-item-copy";
            const status = document.createElement("span");
            status.textContent = galleryItem.published ? "Published" : "Hidden";
            const title = document.createElement("h2");
            title.textContent = galleryResultLabel(galleryItem);
            const note = document.createElement("p");
            note.textContent = "Authorization confirmation recorded · No patient name stored";
            copy.append(status, title, note);

            const actions = document.createElement("div");
            actions.className = "admin-gallery-item-actions";
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "admin-mini-button";
            toggle.textContent = galleryItem.published ? "Hide" : "Publish";
            toggle.addEventListener("click", () => toggleGalleryItem(galleryItem));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "admin-mini-button danger";
            remove.textContent = "Delete";
            remove.addEventListener("click", () => deleteGalleryItem(galleryItem));
            actions.append(toggle, remove);

            item.append(images, copy, actions);
            list.appendChild(item);
        });

        document.getElementById("gallery-count").textContent = String(state.galleryItems.filter((item) => item.published).length);
    }

    function renderDashboard() {
        normalizeTeamMembers();
        populateForm(document.getElementById("homepage-form"), state.content.homepage);
        populateForm(document.getElementById("staff-form"), state.content.staff);
        renderTeamMembers();
        populateForm(document.getElementById("contact-form"), {
            ...(state.content.contact || {}),
            square_url: state.content.booking && state.content.booking.square_url || "",
            square_payment_url: state.content.booking && state.content.booking.square_payment_url || ""
        });
        renderPhotos();
        renderGallery();
        renderTestimonials();
        renderLaunchReview();
        const booking = state.content.booking || {};
        document.getElementById("booking-status").textContent = booking.square_url
            ? booking.square_payment_url ? "Booking + pay" : "Booking ready"
            : "Not linked";
        document.getElementById("mode-pill").textContent = state.demo ? "Preview only" : "Connected";
        document.getElementById("mode-pill").classList.toggle("is-demo", state.demo);
        document.getElementById("admin-identity").textContent = state.demo ? "Local dashboard preview" : state.user.email;
        document.getElementById("signout-button").textContent = state.demo ? "Exit preview" : "Sign out";
    }

    async function openDashboard() {
        await Promise.all([loadContent(), loadTestimonials(), loadGallery()]);
        loginView.hidden = true;
        dashboardView.hidden = false;
        renderDashboard();
    }

    function switchPanel(panelId) {
        document.querySelectorAll(".admin-panel").forEach((panel) => {
            const active = panel.id === panelId;
            panel.hidden = !active;
            panel.classList.toggle("is-active", active);
        });
        document.querySelectorAll("[data-panel-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.panelTarget === panelId));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function persistContent(successMessage) {
        if (state.demo) {
            renderDashboard();
            showToast(`${successMessage} Preview only—nothing was published.`);
            return;
        }
        await request(`/rest/v1/site_content?id=eq.${encodeURIComponent(config.contentRowId)}`, {
            method: "PATCH",
            headers: headers(true, { "Content-Type": "application/json", Prefer: "return=minimal" }),
            body: JSON.stringify({ content: state.content, updated_at: new Date().toISOString(), updated_by: state.user.id })
        });
        renderDashboard();
        showToast(successMessage);
    }

    async function uploadPhoto(slot, file) {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
            showToast("Please choose a JPG, PNG, or WebP image.", true);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast("That photo is larger than 5 MB. Please choose a smaller file.", true);
            return;
        }

        if (slot === "staff_primary" || slot.startsWith("team-member-")) captureStaffDraft();
        const previewUrl = URL.createObjectURL(file);
        document.querySelector(`[data-photo-preview="${slot}"]`).style.backgroundImage = `url("${previewUrl}")`;

        if (state.demo) {
            setPhotoUrlForSlot(slot, previewUrl);
            renderDashboard();
            showToast("Photo previewed. Sign in to save it to the website.");
            return;
        }

        try {
            showToast("Uploading photo…");
            const extension = file.type.split("/")[1].replace("jpeg", "jpg");
            const objectPath = `${slot}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
            const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
            await request(`/storage/v1/object/${encodeURIComponent(config.marketingBucket)}/${encodedPath}`, {
                method: "POST",
                headers: headers(true, { "Content-Type": file.type, "x-upsert": "false" }),
                body: file
            });
            setPhotoUrlForSlot(slot, `${config.supabaseUrl}/storage/v1/object/public/${config.marketingBucket}/${objectPath}`);
            await persistContent("Photo updated on the website.");
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function updatePhotoWarning() {
        const photoType = new FormData(photoWarningForm).get("photo_type");
        const isPatientPhoto = photoType === "patient";
        patientPhotoConfirmation.hidden = !isPatientPhoto;
        patientPhotoAuthorized.checked = false;
        photoWarningContinue.disabled = !photoType || isPatientPhoto;
    }

    function clearPendingPhoto() {
        if (pendingPhoto && pendingPhoto.input) pendingPhoto.input.value = "";
        pendingPhoto = null;
        photoWarningForm.reset();
        patientPhotoConfirmation.hidden = true;
        photoWarningContinue.disabled = true;
    }

    function closePhotoWarning() {
        photoWarningDialog.close();
        clearPendingPhoto();
    }

    function requestPhotoApproval(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        pendingPhoto = { slot: input.dataset.photoInput, file, input };
        photoWarningForm.reset();
        updatePhotoWarning();
        photoWarningDialog.showModal();
    }

    async function sanitizeGalleryImage(file) {
        if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
            throw new Error("Choose a JPG, PNG, or WebP photo for both Before and After.");
        }
        if (file.size > 20 * 1024 * 1024) {
            throw new Error("One of the original photos is larger than 20 MB. Please choose a smaller photo.");
        }

        let source;
        let width;
        let height;
        let cleanup = function () {};
        if (window.createImageBitmap) {
            source = await createImageBitmap(file, { imageOrientation: "from-image" });
            width = source.width;
            height = source.height;
            cleanup = () => source.close();
        } else {
            const sourceUrl = URL.createObjectURL(file);
            source = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error("That photo could not be opened."));
                image.src = sourceUrl;
            });
            width = source.naturalWidth;
            height = source.naturalHeight;
            cleanup = () => URL.revokeObjectURL(sourceUrl);
        }

        const maxDimension = 2200;
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        cleanup();

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .86));
        if (!blob) throw new Error("That photo could not be prepared for the gallery.");
        if (blob.size > 5 * 1024 * 1024) throw new Error("A prepared photo is still larger than 5 MB. Please choose a smaller image.");
        return blob;
    }

    function encodedStoragePath(path) {
        return path.split("/").map(encodeURIComponent).join("/");
    }

    async function uploadGalleryObject(path, blob) {
        await request(`/storage/v1/object/${encodeURIComponent(config.marketingBucket)}/${encodedStoragePath(path)}`, {
            method: "POST",
            headers: headers(true, { "Content-Type": "image/jpeg", "x-upsert": "false" }),
            body: blob
        });
        return `${config.supabaseUrl}/storage/v1/object/public/${config.marketingBucket}/${path}`;
    }

    async function deleteGalleryObject(path) {
        if (!path || state.demo) return;
        try {
            await request(`/storage/v1/object/${encodeURIComponent(config.marketingBucket)}/${encodedStoragePath(path)}`, {
                method: "DELETE",
                headers: headers(true)
            });
        } catch {
            // The public gallery row is already removed, so an orphaned random
            // object is not discoverable through the site. It can be cleaned up later.
        }
    }

    async function toggleGalleryItem(galleryItem) {
        const previous = galleryItem.published;
        galleryItem.published = !previous;
        galleryItem.updated_at = new Date().toISOString();
        if (state.demo) {
            renderGallery();
            showToast(`Gallery result ${galleryItem.published ? "published" : "hidden"} in the preview only.`);
            return;
        }
        try {
            await request(`/rest/v1/gallery_items?id=eq.${encodeURIComponent(galleryItem.id)}`, {
                method: "PATCH",
                headers: headers(true, { "Content-Type": "application/json", Prefer: "return=minimal" }),
                body: JSON.stringify({ published: galleryItem.published, updated_at: galleryItem.updated_at })
            });
            renderGallery();
            showToast(galleryItem.published ? "Gallery result published." : "Gallery result hidden from the website.");
        } catch (error) {
            galleryItem.published = previous;
            renderGallery();
            showToast(error.message, true);
        }
    }

    async function deleteGalleryItem(galleryItem) {
        if (!confirm(`Delete ${galleryResultLabel(galleryItem)}?`)) return;
        if (!state.demo) {
            try {
                await request(`/rest/v1/gallery_items?id=eq.${encodeURIComponent(galleryItem.id)}`, {
                    method: "DELETE",
                    headers: headers(true, { Prefer: "return=minimal" })
                });
                await Promise.all([deleteGalleryObject(galleryItem.before_path), deleteGalleryObject(galleryItem.after_path)]);
            } catch (error) {
                showToast(error.message, true);
                return;
            }
        }
        state.galleryItems = state.galleryItems.filter((item) => item !== galleryItem);
        renderGallery();
        showToast(state.demo ? "Gallery result removed from the preview." : "Gallery result deleted.");
    }

    async function toggleTestimonial(testimonial) {
        if (!testimonial.published && !testimonial.permission_confirmed) {
            showToast("Permission must be confirmed before this testimonial can be published.", true);
            return;
        }
        testimonial.published = !testimonial.published;
        testimonial.updated_at = new Date().toISOString();
        if (state.demo) {
            renderTestimonials();
            showToast("Testimonial status changed in the preview only.");
            return;
        }
        try {
            await request(`/rest/v1/testimonials?id=eq.${testimonial.id}`, {
                method: "PATCH",
                headers: headers(true, { "Content-Type": "application/json", Prefer: "return=minimal" }),
                body: JSON.stringify({ published: testimonial.published, updated_at: testimonial.updated_at })
            });
            renderTestimonials();
            showToast(testimonial.published ? "Testimonial added to the scrolling bar." : "Testimonial removed from the scrolling bar.");
        } catch (error) {
            testimonial.published = !testimonial.published;
            renderTestimonials();
            showToast(error.message, true);
        }
    }

    async function deleteTestimonial(testimonial) {
        if (!confirm(`Delete the testimonial from ${testimonial.display_name}?`)) return;
        if (!state.demo) {
            try {
                await request(`/rest/v1/testimonials?id=eq.${testimonial.id}`, {
                    method: "DELETE",
                    headers: headers(true, { Prefer: "return=minimal" })
                });
            } catch (error) {
                showToast(error.message, true);
                return;
            }
        }
        state.testimonials = state.testimonials.filter((item) => item !== testimonial);
        renderTestimonials();
        showToast(state.demo ? "Testimonial removed from the preview." : "Testimonial deleted.");
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        loginMessage.textContent = "Signing in…";
        const submit = loginForm.querySelector("button[type=submit]");
        submit.disabled = true;
        try {
            await signIn(document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
            loginMessage.textContent = "";
            await openDashboard();
        } catch (error) {
            loginMessage.textContent = error.message;
        } finally {
            submit.disabled = false;
        }
    });

    demoButton.addEventListener("click", async () => {
        state.demo = true;
        await openDashboard();
    });

    document.getElementById("signout-button").addEventListener("click", async () => {
        if (!state.demo && state.accessToken) {
            try { await request("/auth/v1/logout", { method: "POST", headers: headers(true) }); } catch {}
        }
        clearSession();
        dashboardView.hidden = true;
        loginView.hidden = false;
        loginForm.reset();
        loginMessage.textContent = "";
    });

    document.querySelectorAll("[data-panel-target]").forEach((button) => button.addEventListener("click", () => switchPanel(button.dataset.panelTarget)));
    document.querySelectorAll("[data-panel-jump]").forEach((button) => button.addEventListener("click", () => switchPanel(button.dataset.panelJump)));

    function openSquareHelp(input) {
        squareHelpShown = true;
        squareRefocusInput = input || squareUrlInput;
        if (squareRefocusInput) squareRefocusInput.blur();
        squareLinkDialog.showModal();
    }

    function closeSquareHelp(refocus) {
        squareLinkDialog.close();
        if (refocus && squareRefocusInput) window.setTimeout(() => squareRefocusInput.focus(), 0);
    }

    squareInputs.forEach((input) => input.addEventListener("focus", () => {
        if (!squareHelpShown) openSquareHelp(input);
    }));
    document.getElementById("square-link-help").addEventListener("click", () => openSquareHelp(squareUrlInput));
    document.getElementById("square-link-close").addEventListener("click", () => closeSquareHelp(false));
    document.getElementById("square-link-continue").addEventListener("click", () => closeSquareHelp(true));
    squareLinkDialog.addEventListener("cancel", () => { squareHelpShown = true; });

    document.getElementById("homepage-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        state.content.homepage = { ...state.content.homepage, ...formValues(event.currentTarget) };
        try { await persistContent("Homepage wording saved."); } catch (error) { showToast(error.message, true); }
    });

    document.getElementById("staff-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const staff = captureStaffDraft();
        const incompleteMember = staff.members.find((member) => member.visible && (!member.name || !member.role || !member.bio || !member.photo_url));
        if (incompleteMember) {
            showToast("Add each visible team member's name, role, biography, and portrait before showing the profile publicly.", true);
            return;
        }
        try { await persistContent("Staff details saved."); } catch (error) { showToast(error.message, true); }
    });

    document.getElementById("add-team-member").addEventListener("click", () => {
        captureStaffDraft();
        if (state.content.staff.members.length >= 12) {
            showToast("This dashboard supports up to 12 additional team members.", true);
            return;
        }
        state.content.staff.members.push({ id: createTeamMemberId(), name: "", role: "", bio: "", visible: false, photo_url: "" });
        renderTeamMembers();
        const newest = document.querySelector("#team-member-list [data-team-member-id]:last-child");
        if (newest) {
            newest.scrollIntoView({ behavior: "smooth", block: "center" });
            newest.querySelector('[data-team-field="name"]').focus({ preventScroll: true });
        }
        showToast("New team member added. Complete the profile, upload a photo, then save.");
    });

    document.getElementById("team-member-list").addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-remove-team-member]");
        if (!removeButton) return;
        const card = removeButton.closest("[data-team-member-id]");
        const name = card.querySelector('[data-team-field="name"]').value.trim() || "this team member";
        if (!window.confirm(`Remove ${name}'s profile? The change will take effect when you save staff details.`)) return;
        captureStaffDraft();
        state.content.staff.members = state.content.staff.members.filter((member) => member.id !== card.dataset.teamMemberId);
        renderTeamMembers();
        showToast("Team member removed from this draft. Save staff details to confirm.");
    });

    document.getElementById("launch-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const fields = ["services_prices", "office_policies", "contact_details", "staff_details", "photo_permissions", "privacy_notice"];
        const launchChecks = {};
        fields.forEach((name) => { launchChecks[name] = event.currentTarget.elements.namedItem(name).checked; });
        launchChecks.reviewed_at = fields.every((name) => launchChecks[name]) ? new Date().toISOString() : "";
        state.content.launch_checks = launchChecks;
        try { await persistContent(fields.every((name) => launchChecks[name]) ? "Launch review completed." : "Launch review progress saved."); } catch (error) { showToast(error.message, true); }
    });

    document.getElementById("contact-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = formValues(event.currentTarget);
        if (values.square_url && !isPublicSquareUrl(values.square_url)) {
            showToast("Paste an official public Square booking link. Never enter login information, a dashboard address, or a private key.", true);
            return;
        }
        if (values.square_payment_url && !isPublicSquareUrl(values.square_payment_url)) {
            showToast("Paste an official public Square payment link. Never enter login information, a dashboard address, or a private key.", true);
            return;
        }
        state.content.contact = {
            phone_display: values.phone_display,
            phone_href: values.phone_href,
            address: values.address,
            directions_url: values.directions_url,
            hours_summary: values.hours_summary
        };
        state.content.booking = {
            ...(state.content.booking || {}),
            square_url: values.square_url || "",
            square_payment_url: values.square_payment_url || ""
        };
        try { await persistContent("Contact, booking, and payment details saved."); } catch (error) { showToast(error.message, true); }
    });

    document.addEventListener("change", (event) => {
        const input = event.target.closest("[data-photo-input]");
        if (input) requestPhotoApproval(input);
    });

    photoWarningForm.addEventListener("change", updatePhotoWarning);
    patientPhotoAuthorized.addEventListener("input", updatePhotoWarning);
    document.getElementById("photo-warning-cancel").addEventListener("click", closePhotoWarning);
    document.getElementById("photo-warning-close").addEventListener("click", closePhotoWarning);
    photoWarningDialog.addEventListener("cancel", () => clearPendingPhoto());
    photoWarningForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        updatePhotoWarning();
        if (photoWarningContinue.disabled || !pendingPhoto) return;
        const approvedPhoto = pendingPhoto;
        photoWarningDialog.close();
        pendingPhoto = null;
        photoWarningForm.reset();
        patientPhotoConfirmation.hidden = true;
        photoWarningContinue.disabled = true;
        await uploadPhoto(approvedPhoto.slot, approvedPhoto.file);
        approvedPhoto.input.value = "";
    });

    const galleryForm = document.getElementById("gallery-form");
    const galleryPreviewTargets = {
        before_photo: document.getElementById("gallery-before-preview"),
        after_photo: document.getElementById("gallery-after-preview")
    };

    function clearGalleryForm() {
        Object.values(galleryPreviewTargets).forEach((preview) => {
            if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
            preview.dataset.objectUrl = "";
            preview.style.backgroundImage = "";
            preview.querySelector("small").textContent = preview.id.includes("before") ? "Choose the original photo" : "Choose the result photo";
        });
        galleryForm.reset();
        galleryForm.hidden = true;
    }

    function previewGalleryFile(input) {
        const preview = galleryPreviewTargets[input.name];
        const file = input.files && input.files[0];
        if (!preview || !file) return;
        if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
        const objectUrl = URL.createObjectURL(file);
        preview.dataset.objectUrl = objectUrl;
        preview.style.backgroundImage = `linear-gradient(rgba(25,19,28,.08), rgba(25,19,28,.16)), url("${objectUrl}")`;
        preview.querySelector("small").textContent = "Ready to review";
    }

    document.getElementById("show-gallery-form").addEventListener("click", () => {
        galleryForm.hidden = false;
        galleryForm.elements.namedItem("service").focus();
    });
    document.getElementById("cancel-gallery").addEventListener("click", clearGalleryForm);
    galleryForm.querySelectorAll('input[type="file"]').forEach((input) => input.addEventListener("change", () => previewGalleryFile(input)));
    galleryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(galleryForm);
        const beforeFile = galleryForm.elements.namedItem("before_photo").files[0];
        const afterFile = galleryForm.elements.namedItem("after_photo").files[0];
        const authorizationConfirmed = formData.get("authorization_confirmed") === "on";
        const privacyChecked = formData.get("privacy_checked") === "on";
        if (!beforeFile || !afterFile || !authorizationConfirmed || !privacyChecked) {
            showToast("Choose both photos and complete both required confirmations.", true);
            return;
        }

        const submit = galleryForm.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            const service = String(formData.get("service") || "");
            if (!service) throw new Error("Choose a treatment type before saving this result.");
            const published = formData.get("published") === "on";
            const verifiedAt = new Date().toISOString();

            if (state.demo) {
                const nextNumber = state.galleryItems.reduce((largest, item) => Math.max(largest, Number(item.case_number) || 0), 0) + 1;
                state.galleryItems.unshift({
                    id: `demo-gallery-${Date.now()}`,
                    case_number: nextNumber,
                    service,
                    before_url: URL.createObjectURL(beforeFile),
                    after_url: URL.createObjectURL(afterFile),
                    before_path: "",
                    after_path: "",
                    authorization_confirmed: true,
                    privacy_checked: true,
                    authorization_verified_at: verifiedAt,
                    published
                });
                clearGalleryForm();
                renderGallery();
                showToast("Gallery result added to the preview only. Nothing was uploaded.");
                return;
            }

            showToast("Preparing photos and removing hidden location and camera details…");
            const [beforeBlob, afterBlob] = await Promise.all([
                sanitizeGalleryImage(beforeFile),
                sanitizeGalleryImage(afterFile)
            ]);
            const token = window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
            const beforePath = `gallery/${token}/before.jpg`;
            const afterPath = `gallery/${token}/after.jpg`;
            const uploadedPaths = [];
            let beforeUrl;
            let afterUrl;
            try {
                beforeUrl = await uploadGalleryObject(beforePath, beforeBlob);
                uploadedPaths.push(beforePath);
                afterUrl = await uploadGalleryObject(afterPath, afterBlob);
                uploadedPaths.push(afterPath);
                const rows = await request("/rest/v1/gallery_items", {
                    method: "POST",
                    headers: headers(true, { "Content-Type": "application/json", Prefer: "return=representation" }),
                    body: JSON.stringify({
                        service,
                        before_url: beforeUrl,
                        after_url: afterUrl,
                        before_path: beforePath,
                        after_path: afterPath,
                        authorization_confirmed: true,
                        privacy_checked: true,
                        authorization_verified_at: verifiedAt,
                        authorization_verified_by: state.user.id,
                        published,
                        sort_order: state.galleryItems.length
                    })
                });
                state.galleryItems.unshift(rows[0]);
            } catch (error) {
                await Promise.all(uploadedPaths.map(deleteGalleryObject));
                throw error;
            }

            clearGalleryForm();
            renderGallery();
            showToast(published ? "Gallery result published." : "Gallery result saved but hidden.");
        } catch (error) {
            showToast(error.message, true);
        } finally {
            submit.disabled = false;
        }
    });

    const testimonialForm = document.getElementById("testimonial-form");
    document.getElementById("show-testimonial-form").addEventListener("click", () => {
        testimonialForm.hidden = false;
        testimonialForm.querySelector("textarea").focus();
    });
    document.getElementById("cancel-testimonial").addEventListener("click", () => {
        testimonialForm.reset();
        testimonialForm.hidden = true;
    });
    testimonialForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(testimonialForm);
        const testimonial = {
            quote: String(data.get("quote") || "").trim(),
            display_name: String(data.get("display_name") || "").trim(),
            source: String(data.get("source") || "Website testimonial"),
            permission_confirmed: data.get("permission_confirmed") === "on",
            published: data.get("published") === "on",
            sort_order: state.testimonials.length
        };
        if (testimonial.published && !testimonial.permission_confirmed) {
            showToast("Confirm written permission before publishing this testimonial.", true);
            return;
        }
        try {
            if (state.demo) {
                testimonial.id = `demo-${Date.now()}`;
                testimonial.created_at = new Date().toISOString();
                state.testimonials.push(testimonial);
            } else {
                const rows = await request("/rest/v1/testimonials", {
                    method: "POST",
                    headers: headers(true, { "Content-Type": "application/json", Prefer: "return=representation" }),
                    body: JSON.stringify(testimonial)
                });
                state.testimonials.push(rows[0]);
            }
            testimonialForm.reset();
            testimonialForm.hidden = true;
            renderTestimonials();
            showToast(state.demo ? "Testimonial added to the preview only." : "Testimonial saved.");
        } catch (error) {
            showToast(error.message, true);
        }
    });

    async function start() {
        demoButton.hidden = !isLocalPreview;
        if (isLocalPreview) {
            state.demo = true;
            await openDashboard();
            return;
        }
        if (await restoreSession()) {
            try { await openDashboard(); } catch (error) { clearSession(); loginMessage.textContent = error.message; }
        }
    }

    start();
})();
