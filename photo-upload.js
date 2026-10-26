(function (root) {
    "use strict";
    function galleryUpload(file, caseToken, side) {
        if (!file || !["image/png", "image/jpeg"].includes(file.type)) throw new Error("Choose a prepared PNG or JPEG crop.");
        if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("Prepared gallery photos must be under 5 MB.");
        if (!["before", "after"].includes(side)) throw new Error("Choose a Before or After photo.");
        const extension = file.type === "image/png" ? "png" : "jpg";
        return { path: `gallery/${caseToken}/${side}.${extension}`, contentType: file.type, body: file };
    }
    const api = Object.freeze({ galleryUpload });
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.AmandaPhotoFiles = api;
})(typeof window === "undefined" ? globalThis : window);
