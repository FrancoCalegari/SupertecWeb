(function () {
	const CURRENT_VERSION = "v02";
	const STORAGE_KEY = "siteVersion";

	console.log("[Supertec Lite] Checking version...");

	try {
		const storedVersion = localStorage.getItem(STORAGE_KEY);

		if (storedVersion !== CURRENT_VERSION) {
			console.warn(
				`[Supertec Lite] Version mismatch! Stored: ${storedVersion}, Current: ${CURRENT_VERSION}. Clearing cache...`
			);

			// Update version in localStorage
			localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);

			// Clear all caches if supported
			if ("caches" in window) {
				caches.keys().then((names) => {
					for (let name of names) {
						caches.delete(name);
					}
				});
			}

			// Force reload from server, ignoring cache
			console.log("[Supertec Lite] Reloading page to apply changes...");
			window.location.reload(true);
		} else {
			console.log(`[Supertec Lite] Version matched: ${CURRENT_VERSION}`);
		}
	} catch (e) {
		console.error("[Supertec Lite] Error checking version:", e);
	}
})();
