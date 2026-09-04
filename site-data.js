(function () {
    "use strict";

    const config = window.AMANDA_SITE_CONFIG;
    if (!config) return;

    const apiHeaders = {
        apikey: config.publishableKey,
        Accept: "application/json"
    };

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

    function getValue(source, path) {
        return path.split(".").reduce((value, key) => value && value[key], source);
    }

    function applyText(content) {
        document.querySelectorAll("[data-site-text]").forEach((element) => {
            const value = getValue(content, element.dataset.siteText);
            if (typeof value === "string" && value.trim()) element.textContent = value;
        });
    }

    function applyBackgrounds(content) {
        document.querySelectorAll("[data-site-background]").forEach((element) => {
            const value = getValue(content, element.dataset.siteBackground);
            if (!value) return;
            const imageUrl = String(value).replace(/"/g, "%22");
            element.style.backgroundImage = element.dataset.siteOverlay === "dark"
                ? `linear-gradient(rgba(0,0,0,.48), rgba(0,0,0,.48)), url("${imageUrl}")`
                : `url("${imageUrl}")`;
            element.classList.add("ad-managed-photo");
            element.querySelectorAll(".ad-photo-note").forEach((note) => note.hidden = true);
            element.querySelectorAll("[data-photo-placeholder]").forEach((placeholder) => placeholder.hidden = true);
        });
    }

    function applyVisibility(content) {
        document.querySelectorAll("[data-site-toggle]").forEach((element) => {
            element.hidden = !Boolean(getValue(content, element.dataset.siteToggle));
        });
    }

    function renderTeam(content) {
        const list = document.querySelector("[data-team-list]");
        if (!list) return;
        list.querySelectorAll("[data-managed-team-member]").forEach((element) => element.remove());
        const staff = content.staff || {};
        let members = Array.isArray(staff.members) ? staff.members : [];
        if (members.length === 0 && staff.secondary_visible) {
            members = [{
                name: staff.secondary_name,
                role: staff.secondary_role,
                bio: staff.secondary_bio,
                visible: true,
                photo_url: content.images && content.images.staff_secondary
            }];
        }
        members.filter((member) => member && member.visible && member.name && member.role && member.bio && member.photo_url).forEach((member) => {
            const card = document.createElement("article");
            card.className = "ad-team-card";
            card.dataset.managedTeamMember = "";
            const photo = document.createElement("div");
            photo.className = "ad-team-photo";
            const image = document.createElement("img");
            image.src = member.photo_url;
            image.alt = `Portrait of ${member.name}`;
            image.loading = "lazy";
            photo.appendChild(image);
            const name = document.createElement("h3");
            name.textContent = member.name;
            const role = document.createElement("span");
            role.textContent = member.role;
            const bio = document.createElement("p");
            bio.textContent = member.bio;
            card.append(photo, name, role, bio);
            list.appendChild(card);
        });
    }

    function applyContact(content) {
        const contact = content.contact || {};
        if (contact.phone_href) {
            document.querySelectorAll('a[href^="tel:"]').forEach((link) => link.href = contact.phone_href);
        }
        if (contact.phone_display) {
            document.querySelectorAll("[data-site-phone]").forEach((element) => element.textContent = contact.phone_display);
        }
        if (contact.address) {
            document.querySelectorAll("[data-site-address]").forEach((element) => element.textContent = contact.address);
        }
        if (contact.hours_summary) {
            document.querySelectorAll("[data-site-hours]").forEach((element) => element.textContent = contact.hours_summary);
        }
        if (contact.directions_url) {
            document.querySelectorAll("[data-site-directions]").forEach((link) => link.href = contact.directions_url);
        }

        const booking = content.booking || {};
        const squareUrl = booking.square_url;
        if (isPublicSquareUrl(squareUrl)) {
            document.querySelectorAll("[data-square-link]").forEach((link) => {
                link.href = squareUrl;
                link.hidden = false;
            });
            document.querySelectorAll("[data-square-pending]").forEach((element) => element.hidden = true);
        }

        const squarePaymentUrl = booking.square_payment_url;
        if (isPublicSquareUrl(squarePaymentUrl)) {
            document.querySelectorAll("[data-square-payment-link]").forEach((link) => {
                link.href = squarePaymentUrl;
                link.hidden = false;
            });
            document.querySelectorAll("[data-square-payment-pending]").forEach((element) => element.hidden = true);
        }
    }

    function renderTestimonials(testimonials) {
        const track = document.querySelector(".ad-ticker-track");
        if (!track || !Array.isArray(testimonials) || testimonials.length === 0) return;

        track.replaceChildren();
        const doubled = testimonials.concat(testimonials);
        doubled.forEach((testimonial, index) => {
            const item = document.createElement("span");
            item.textContent = `“${testimonial.quote}” — ${testimonial.display_name}`;
            if (index >= testimonials.length) item.setAttribute("aria-hidden", "true");
            track.appendChild(item);
        });
    }

    async function fetchJson(path) {
        const response = await fetch(`${config.supabaseUrl}${path}`, { headers: apiHeaders });
        if (!response.ok) throw new Error(`Website content request failed (${response.status})`);
        return response.json();
    }

    async function loadManagedContent() {
        try {
            const [rows, testimonials] = await Promise.all([
                fetchJson(`/rest/v1/site_content?id=eq.${encodeURIComponent(config.contentRowId)}&select=content`),
                fetchJson("/rest/v1/testimonials?published=eq.true&permission_confirmed=eq.true&select=quote,display_name&order=sort_order.asc,created_at.asc")
            ]);
            const content = rows[0] && rows[0].content;
            if (content) {
                applyText(content);
                applyBackgrounds(content);
                applyVisibility(content);
                renderTeam(content);
                applyContact(content);
            }
            renderTestimonials(testimonials);
        } catch (error) {
            console.info("Using the website's built-in content while the editor service is unavailable.");
        }
    }

    loadManagedContent();
})();
