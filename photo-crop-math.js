(function (root) {
    "use strict";
    const clamp = (value, min, max, fallback) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
    function dimensions(width, height, aspect = 1) {
        if (![width, height, aspect].every(value => Number.isFinite(value) && value > 0)) throw new Error("Invalid photo dimensions.");
    }
    function getCropRect({ width, height, aspect, zoom = 1, panX = .5, panY = .5 }) {
        dimensions(width, height, aspect);
        const scale = clamp(zoom, 1, 4, 1);
        const cropWidth = Math.min(width, height * aspect) / scale;
        const cropHeight = cropWidth / aspect;
        return {
            x: Math.max(0, width - cropWidth) * clamp(panX, 0, 1, .5),
            y: Math.max(0, height - cropHeight) * clamp(panY, 0, 1, .5),
            width: cropWidth,
            height: cropHeight
        };
    }
    function fitOutput({ width, height }, maxDimension = 2200) {
        dimensions(width, height, maxDimension);
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    }
    const api = { getCropRect, fitOutput };
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.AmandaCropMath = api;
})(typeof window === "undefined" ? globalThis : window);
