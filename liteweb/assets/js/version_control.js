(function () {
	"use strict";

	const CURRENT_VERSION = "v03";
	const STORAGE_KEY = "siteVersion";
	const LOG = "[Supertec Lite]";

	// ─── Helpers ─────────────────────────────────────────────────────────────────

	function log(msg) {
		console.log(`${LOG} ${msg}`);
	}
	function warn(msg) {
		console.warn(`${LOG} ${msg}`);
	}

	/**
	 * Limpia la Cache API (caché de Service Workers y fetch cacheado).
	 * @returns {Promise<void>}
	 */
	async function clearCacheAPI() {
		if (!("caches" in window)) return;
		try {
			const names = await caches.keys();
			await Promise.all(names.map((name) => caches.delete(name)));
			log(`Cache API: ${names.length} entrada(s) eliminada(s).`);
		} catch (e) {
			warn(`Cache API no pudo limpiarse: ${e.message}`);
		}
	}

	/**
	 * Desregistra todos los Service Workers activos.
	 * @returns {Promise<void>}
	 */
	async function unregisterServiceWorkers() {
		if (!("serviceWorker" in navigator)) return;
		try {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((r) => r.unregister()));
			if (registrations.length > 0) {
				log(`Service Workers: ${registrations.length} desregistrado(s).`);
			}
		} catch (e) {
			warn(`Service Workers no pudieron desregistrarse: ${e.message}`);
		}
	}

	/**
	 * Limpia localStorage excepto la clave de versión (ya actualizada).
	 */
	function clearLocalStorage() {
		try {
			const version = localStorage.getItem(STORAGE_KEY);
			localStorage.clear();
			localStorage.setItem(STORAGE_KEY, version);
			log("localStorage limpiado.");
		} catch (e) {
			warn(`localStorage no pudo limpiarse: ${e.message}`);
		}
	}

	/**
	 * Limpia sessionStorage completo.
	 */
	function clearSessionStorage() {
		try {
			sessionStorage.clear();
			log("sessionStorage limpiado.");
		} catch (e) {
			warn(`sessionStorage no pudo limpiarse: ${e.message}`);
		}
	}

	/**
	 * Fuerza recarga con cache-busting en la URL.
	 * Usa ?_v=<version> para que el servidor sirva la versión fresca.
	 */
	function forceReload() {
		const url = new URL(window.location.href);
		// Si ya tiene el parámetro de la versión actual, no recargar de nuevo
		if (url.searchParams.get("_v") === CURRENT_VERSION) {
			log("Ya en versión actual, no se recarga.");
			return;
		}
		url.searchParams.set("_v", CURRENT_VERSION);
		log(`Recargando hacia: ${url.toString()}`);
		window.location.replace(url.toString());
	}

	/**
	 * Limpia el parámetro _v de la URL sin recargar (historial limpio).
	 */
	function cleanUrlParam() {
		try {
			const url = new URL(window.location.href);
			if (url.searchParams.has("_v")) {
				url.searchParams.delete("_v");
				history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
				log("Parámetro _v eliminado de la URL.");
			}
		} catch (e) {
			// No crítico
		}
	}

	// ─── Main ─────────────────────────────────────────────────────────────────────

	async function run() {
		log(`Verificando versión...`);

		let storedVersion;
		try {
			storedVersion = localStorage.getItem(STORAGE_KEY);
		} catch (e) {
			warn("No se pudo leer localStorage.");
			return;
		}

		if (storedVersion === CURRENT_VERSION) {
			log(`Versión coincide (${CURRENT_VERSION}). Sin cambios.`);
			cleanUrlParam();
			return;
		}

		warn(`Versión anterior: ${storedVersion || "ninguna"} → Nueva: ${CURRENT_VERSION}. Limpiando caché...`);

		// 1. Guardar la nueva versión ANTES de limpiar
		try {
			localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
		} catch (e) {
			warn("No se pudo escribir en localStorage.");
		}

		// 2. Limpiar todo en paralelo (esperar a que termine)
		await Promise.all([
			clearCacheAPI(),
			unregisterServiceWorkers(),
		]);

		clearLocalStorage();
		clearSessionStorage();

		// 3. Recargar con cache-busting
		forceReload();
	}

	run();
})();
