(function () {
    "use strict";
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) return;
    const databaseName = "amanda-website-preview";
    let database;
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(databaseName) : null;

    function openDatabase() {
        if (!database) database = new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore("drafts");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return database;
    }

    async function load() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const request = db.transaction("drafts", "readonly").objectStore("drafts").get("content");
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async function save(content) {
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const transaction = db.transaction("drafts", "readwrite");
            transaction.objectStore("drafts").put(content, "content");
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error("Local preview save was interrupted."));
        });
        if (channel) channel.postMessage("updated");
    }

    function subscribe(listener) {
        if (channel) channel.addEventListener("message", listener);
        window.addEventListener("focus", listener);
    }

    function photoDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    window.AmandaPreviewStore = { load, save, subscribe, photoDataUrl };
})();
