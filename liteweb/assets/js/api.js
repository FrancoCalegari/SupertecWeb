export const API_BASE_URL = "https://supertec-web.vercel.app/api";
export const API_URL = "https://supertec-web.vercel.app";

/**
 * Wrapper for fetch to handle CORS and credentials
 */
export async function apiFetch(endpoint, options = {}) {
	const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

	const defaultOptions = {
		mode: "cors",
		// credentials: 'include', // Important for cookies/session if needed (though dashboard might be tricky cross-site with lax cookies)
	};

	// For cross-site cookies to work, SameSite=None; Secure is required on the server cookie.
	// The current server setup has SameSite='lax', which might block third-party cookies (Lite version on different domain).
	// However, if we just want to fetch data (GET), we don't strictly need cookies.
	// For Admin Dashboard (POST/DELETE), we DO need auth.
	// IF the user runs Lite on localhost and connects to Vercel, cookies might not stick due to SameSite policy.
	// let's try 'include' anyway.

	// override credentials if provided
	const finalOptions = { ...defaultOptions, ...options };
	if (!finalOptions.credentials) finalOptions.credentials = "include";

	const res = await fetch(url, finalOptions);
	return res;
}
