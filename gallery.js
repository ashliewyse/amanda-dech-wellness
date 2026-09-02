(function () {
    "use strict";

    const config = window.AMANDA_SITE_CONFIG;
    const grid = document.getElementById("gallery-grid");
    const empty = document.getElementById("gallery-empty");
    const filters = document.getElementById("gallery-filters");
    if (!config || !grid || !empty || !filters) return;

    let items = [];
    let activeFilter = "all";

    function resultLabel(item) {
        return `${item.service} · Result ${String(item.case_number).padStart(3, "0")}`;
    }

    function createImage(url, side, item) {
        const wrapper = document.createElement("div");
        wrapper.className = "ad-result-image";
        const image = document.createElement("img");
        image.src = url;
        image.alt = `${side} view for ${resultLabel(item)}`;
        image.loading = "lazy";
        image.decoding = "async";
        const badge = document.createElement("span");
        badge.textContent = side;
        wrapper.append(image, badge);
        return wrapper;
    }

    function createCard(item) {
        const card = document.createElement("article");
        card.className = "ad-result-card";
        card.dataset.service = item.service;

        const images = document.createElement("div");
        images.className = "ad-result-images";
        images.append(createImage(item.before_url, "Before", item), createImage(item.after_url, "After", item));

        const copy = document.createElement("div");
        copy.className = "ad-result-copy";
        const heading = document.createElement("div");
        const eyebrow = document.createElement("span");
        eyebrow.textContent = "Permission-approved result";
        const title = document.createElement("h3");
        title.textContent = resultLabel(item);
        heading.append(eyebrow, title);
        const note = document.createElement("small");
        note.textContent = "Individual results vary";
        copy.append(heading, note);

        card.append(images, copy);
        return card;
    }

    function render() {
        const visible = activeFilter === "all" ? items : items.filter((item) => item.service === activeFilter);
        grid.replaceChildren(...visible.map(createCard));
        grid.hidden = visible.length === 0;
        empty.hidden = visible.length !== 0;
        grid.setAttribute("aria-busy", "false");
    }

    function renderFilters() {
        const services = [...new Set(items.map((item) => item.service))];
        services.forEach((service) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.galleryFilter = service;
            button.textContent = service;
            filters.appendChild(button);
        });

        filters.addEventListener("click", (event) => {
            const button = event.target.closest("[data-gallery-filter]");
            if (!button) return;
            activeFilter = button.dataset.galleryFilter;
            filters.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
            render();
        });
    }

    async function load() {
        try {
            const query = "/rest/v1/gallery_items?published=eq.true&authorization_confirmed=eq.true&privacy_checked=eq.true&authorization_verified_at=not.is.null&select=case_number,service,before_url,after_url&order=sort_order.asc,case_number.desc";
            const response = await fetch(`${config.supabaseUrl}${query}`, {
                headers: { apikey: config.publishableKey, Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`Gallery request failed (${response.status})`);
            items = await response.json();
        } catch {
            items = [];
        }
        renderFilters();
        render();
    }

    load();
})();
