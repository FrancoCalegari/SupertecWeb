require("dotenv").config();
const { initDb } = require("./db.js");

const SPIDER_API_BASE = process.env.SPIDERWEB_API_BASE || "https://spiderwebargapi.com.ar/api/v1";
const SPIDER_API_KEY = process.env.SPIDERWEB_API_KEY || "c90d1502ce815ea5d1108662186145d3cefe642586466c769d4c7fae63086ac6";
const SPIDER_DB = process.env.SPIDERWEB_DB_NAME || "sw_Franco Calegari_supertec";

async function spiderQuery(sql) {
	const res = await fetch(`${SPIDER_API_BASE}/query`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-API-KEY": SPIDER_API_KEY,
		},
		body: JSON.stringify({ database: SPIDER_DB, query: sql }),
	});
	const data = await res.json();
	if (data.error) {
		throw new Error(`[SpiderDB] ${data.error}: ${data.message || ""}`);
	}
	return data.result;
}

async function run() {
    try {
        console.log("Añadiendo columnas descuento y destacado a tabla productos...");
        try {
            await spiderQuery("ALTER TABLE productos ADD COLUMN descuento INT DEFAULT 0");
            console.log("Columna descuento añadida a productos.");
        } catch (e) {
            console.log("Nota: la columna descuento podría existir ya o hubo un error:", e.message);
        }
        
        try {
            await spiderQuery("ALTER TABLE productos ADD COLUMN destacado BOOLEAN DEFAULT FALSE");
            console.log("Columna destacado añadida a productos.");
        } catch (e) {
            console.log("Nota: la columna destacado podría existir ya o hubo un error:", e.message);
        }

        console.log("Estructura de la base de datos actualizada.");
        process.exit(0);
    } catch (e) {
        console.error("Error al actualizar la base de datos:", e);
        process.exit(1);
    }
}

run();
