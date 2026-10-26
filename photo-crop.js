(function () {
    "use strict";
    const { getCropRect, fitOutput } = window.AmandaCropMath;
    const dialog = document.getElementById("photo-crop-dialog");
    const form = document.getElementById("photo-crop-form");
    const canvas = document.getElementById("photo-crop-canvas");
    const stage = document.getElementById("photo-crop-stage");
    const zoom = document.getElementById("photo-crop-zoom");
    const zoomValue = document.getElementById("photo-crop-zoom-value");
    const shape = document.getElementById("photo-crop-shape");
    const status = document.getElementById("photo-crop-status");
    const apply = document.getElementById("photo-crop-apply");
    const presets = { portrait: 4 / 5, square: 1, landscape: 4 / 3, wide: 16 / 9 };
    let active = null;
    let drag = null;

    async function decode(file) {
        if (window.createImageBitmap) {
            const image = await createImageBitmap(file, { imageOrientation: "from-image" });
            return { image, width: image.width, height: image.height, dispose: () => image.close() };
        }
        const url = URL.createObjectURL(file);
        try {
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("That photo could not be opened. Choose another JPG, PNG, or WebP."));
                img.src = url;
            });
            return { image, width: image.naturalWidth, height: image.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
        } catch (error) { URL.revokeObjectURL(url); throw error; }
    }

    function rect(job = active) {
        return getCropRect({ width: job.source.width, height: job.source.height, aspect: job.aspect, zoom: Number(zoom.value), panX: job.panX, panY: job.panY });
    }

    function draw() {
        if (!active || !active.source) return;
        const crop = rect();
        const preview = fitOutput({ width: crop.width, height: crop.height }, 640);
        canvas.width = preview.width;
        canvas.height = preview.height;
        stage.style.setProperty("--crop-aspect", active.aspect);
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(active.source.image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
        zoomValue.textContent = `${Number(zoom.value).toFixed(2)}×`;
        zoom.setAttribute("aria-valuetext", `${Number(zoom.value).toFixed(2)} times`);
    }

    function finish(result, error) {
        const job = active;
        if (!job) return;
        active = null;
        drag = null;
        if (dialog.open) dialog.close();
        if (job.source) job.source.dispose();
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        if (job.previousFocus && job.previousFocus.isConnected) job.previousFocus.focus({ preventScroll: true });
        if (error) job.reject(error);
        else job.resolve(result);
    }

    function reset() {
        if (!active || !active.source || apply.disabled) return;
        active.panX = .5;
        active.panY = .5;
        zoom.value = "1";
        draw();
    }

    function move(dx, dy, start) {
        if (!active || !active.source || apply.disabled) return;
        const crop = start ? start.crop : rect();
        const bounds = canvas.getBoundingClientRect();
        const overflowX = active.source.width - crop.width;
        const overflowY = active.source.height - crop.height;
        active.panX = overflowX > .001 ? Math.min(1, Math.max(0, (crop.x - dx * crop.width / bounds.width) / overflowX)) : .5;
        active.panY = overflowY > .001 ? Math.min(1, Math.max(0, (crop.y - dy * crop.height / bounds.height) / overflowY)) : .5;
        draw();
    }

    canvas.addEventListener("pointerdown", event => {
        if (!active || !active.source || apply.disabled || event.isPrimary === false || event.button !== 0) return;
        drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, crop: rect() };
        canvas.setPointerCapture(event.pointerId);
        canvas.focus({ preventScroll: true });
        event.preventDefault();
    });
    canvas.addEventListener("pointermove", event => {
        if (drag && drag.pointerId === event.pointerId) move(event.clientX - drag.x, event.clientY - drag.y, drag);
    });
    function endDrag(event) { if (drag && drag.pointerId === event.pointerId) drag = null; }
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => canvas.addEventListener(type, endDrag));
    canvas.addEventListener("keydown", event => {
        const directions = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
        if (!directions[event.key]) return;
        event.preventDefault();
        move(...directions[event.key]);
    });
    document.querySelectorAll("[data-crop-move]").forEach(button => button.addEventListener("click", () => {
        move(...button.dataset.cropMove.split(",").map(Number));
    }));
    zoom.addEventListener("input", () => { drag = null; draw(); });
    shape.addEventListener("change", () => {
        if (!active || !active.source) return;
        active.aspect = presets[shape.value] || active.source.width / active.source.height;
        reset();
    });
    document.getElementById("photo-crop-reset").addEventListener("click", reset);
    document.getElementById("photo-crop-cancel").addEventListener("click", () => finish(null));
    document.getElementById("photo-crop-close").addEventListener("click", () => finish(null));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
    dialog.addEventListener("close", () => finish(null));

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const job = active;
        if (!job || !job.source || apply.disabled) return;
        apply.disabled = true;
        zoom.disabled = true;
        shape.disabled = true;
        status.textContent = "Preparing your photo…";
        try {
            const crop = rect(job);
            const size = fitOutput(crop);
            const output = document.createElement("canvas");
            output.width = size.width;
            output.height = size.height;
            const keepAlpha = job.file.type === "image/png";
            const context = output.getContext("2d");
            if (!keepAlpha) { context.fillStyle = "#ffffff"; context.fillRect(0, 0, size.width, size.height); }
            context.drawImage(job.source.image, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height);
            const type = keepAlpha ? "image/png" : "image/jpeg";
            const blob = await new Promise(resolve => output.toBlob(resolve, type, .9));
            if (active !== job) return;
            if (!blob) throw new Error("That photo could not be prepared. Try another image.");
            if (blob.size > 5 * 1024 * 1024) throw new Error("This crop is larger than 5 MB. Choose a smaller photo or zoom in further.");
            const name = job.file.name.replace(/\.[^.]+$/, "") || "photo";
            finish(new File([blob], `${name}-cropped.${keepAlpha ? "png" : "jpg"}`, { type }));
        } catch (error) {
            if (active !== job) return;
            status.textContent = error.message;
            apply.disabled = false;
            zoom.disabled = false;
            shape.disabled = Boolean(job.fixedAspect);
        }
    });

    function open(file, options = {}) {
        if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error("Choose a JPG, PNG, or WebP photo."));
        const maxBytes = options.maxBytes || 5 * 1024 * 1024;
        if (file.size > maxBytes) return Promise.reject(new Error(`Choose an original photo under ${Math.round(maxBytes / 1024 / 1024)} MB.`));
        finish(null);
        return new Promise((resolve, reject) => {
            const job = { file, resolve, reject, source: null, fixedAspect: options.fixedAspect, panX: .5, panY: .5, previousFocus: document.activeElement };
            active = job;
            apply.disabled = true;
            zoom.disabled = true;
            shape.disabled = true;
            status.textContent = "Opening your photo…";
            document.getElementById("photo-crop-label").textContent = options.label || "Website photo";
            dialog.showModal();
            decode(file).then(source => {
                if (active !== job) { source.dispose(); return; }
                job.source = source;
                const preset = Object.keys(presets).find(key => Math.abs(presets[key] - options.aspect) < .001) || "landscape";
                shape.value = preset;
                job.aspect = presets[preset];
                apply.disabled = false;
                zoom.disabled = false;
                shape.disabled = Boolean(job.fixedAspect);
                status.textContent = "Drag the photo to reposition it. Use the zoom slider to get closer.";
                reset();
            }).catch(error => { if (active === job) finish(null, new Error(error.message || "That photo could not be opened.")); });
        });
    }
    window.AmandaPhotoCropper = Object.freeze({ open });
})();
