const SPIDER_API_KEY = 'c90d1502ce815ea5d1108662186145d3cefe642586466c769d4c7fae63086ac6';
const SPIDER_API_BASE = 'http://190.220.229.45:7256/api/v1';
const LIVE_API_BASE = 'https://supertec-web.vercel.app';

let spiderProjectId = null;

async function getSpiderProjectId() {
    if (spiderProjectId) return spiderProjectId;
    try {
        const res = await fetch(`${SPIDER_API_BASE}/storage/projects`, {
            headers: { 'X-API-KEY': SPIDER_API_KEY }
        });
        if (res.ok) {
            const data = await res.json();
            const projects = Array.isArray(data) ? data : (data.data || data.projects || []);
            const proj = projects.find(p => p.name === 'SuperTecStorage' || p.nombre === 'SuperTecStorage');
            if (proj && (proj.id || proj._id)) {
                spiderProjectId = proj.id || proj._id;
                console.log(`[Spider] Found project ID for 'SuperTecStorage': ${spiderProjectId}`);
                return spiderProjectId;
            }
        }
    } catch (e) {
        console.error("[Spider] Error fetching projects:", e);
    }
    console.warn("[Spider] Project 'SuperTecStorage' not found, falling back to ID 1");
    return 1;
}

async function uploadToSpider(buffer, filename) {
    const projectId = await getSpiderProjectId();
    const formData = new FormData();
    const blob = new Blob([buffer]);
    formData.append('files', blob, filename);

    const res = await fetch(`${SPIDER_API_BASE}/storage/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'X-API-KEY': SPIDER_API_KEY },
        body: formData
    });

    if (!res.ok) {
        throw new Error(`Spider API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log("[Spider] Upload response:", JSON.stringify(data));

    let spiderUrl = "";
    if (data.url) spiderUrl = data.url;
    else if (data[0] && data[0].url) spiderUrl = data[0].url;
    else if (data.data && data.data.url) spiderUrl = data.data.url;
    else if (data.file && data.file.url) spiderUrl = data.file.url;
    else if (data.files && data.files[0] && data.files[0].url) spiderUrl = data.files[0].url;
    else if (data.id) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data.id}`;
    else if (data[0] && data[0].id) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data[0].id}`;
    else if (data.files && data.files[0] && data.files[0].id) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data.files[0].id}`;
    else if (data.files && data.files[0] && data.files[0].fileId) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data.files[0].fileId}`;
    else {
        throw new Error("Could not extract URL from Spider API response: " + JSON.stringify(data));
    }
    return spiderUrl;
}

async function migrateImages(endpoint, typeName) {
    console.log(`\nMigrando imágenes de ${typeName}...`);
    const listRes = await fetch(`${LIVE_API_BASE}/api/${endpoint}`);
    if (!listRes.ok) {
        throw new Error(`Failed to fetch ${endpoint}`);
    }
    const items = await listRes.json();
    console.log(`Encontrados ${items.length} items de tipo ${typeName}.`);

    for (const item of items) {
        if (!item.img) continue; // no image
        if (item.img.includes('190.220.229.45:7256')) {
            console.log(`Item ${item.id} (${item.name}) ya usa Spider API.`);
            continue;
        }

        console.log(`Procesando item ${item.id} (${item.name}): ${item.img}`);
        let buffer, filename;

        try {
            let downloadUrl = item.img;
            if (!downloadUrl.startsWith('http')) {
                // If it starts with /assets it's relative, otherwise maybe simply assets/...
                if (downloadUrl.startsWith('/')) {
                    downloadUrl = LIVE_API_BASE + downloadUrl;
                } else {
                    downloadUrl = LIVE_API_BASE + '/' + downloadUrl;
                }
            }

            console.log(`Descargando imagen desde: ${downloadUrl}`);
            const res = await fetch(downloadUrl);
            if (!res.ok) throw new Error(`HTTP error ${res.status} para ${downloadUrl}`);

            const arrayBuffer = await res.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            filename = downloadUrl.split('/').pop().split('?')[0] || 'file.jpg';

            // Subir a Spider
            const spiderUrl = await uploadToSpider(buffer, filename);
            console.log(`-> Éxito: Nueva URL Spider: ${spiderUrl}`);

            // Actualizar Vercel API (Guardar en DB)
            const updatedItem = { ...item, img: spiderUrl };
            const updateRes = await fetch(`${LIVE_API_BASE}/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItem)
            });
            if (!updateRes.ok) {
                console.error(`ERROR al actualizar item en Vercel DB: ${updateRes.status} ${updateRes.statusText}`);
            } else {
                console.log(`-> Vercel DB actualizada para item ${item.id}.`);
            }
        } catch (err) {
            console.error(`ERROR con item ${item.id}:`, err.message);
        }
    }
}

async function run() {
    try {
        await migrateImages('productos', 'Productos');
        await migrateImages('ventas', 'Ventas');
        await migrateImages('servicios', 'Servicios');
        console.log("\nMigración completada exitosamente.");
    } catch (e) {
        console.error("Error fatal durante migración:", e);
    }
    process.exit(0);
}

run();
