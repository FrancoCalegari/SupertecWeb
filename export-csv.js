require("dotenv").config();
const { list } = require("@vercel/blob");
const fs = require("fs");
const path = require("path");

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_PREFIX = process.env.BLOB_PREFIX || "db/";

if (!BLOB_TOKEN) {
	console.error("❌ BLOB_READ_WRITE_TOKEN must be set");
	process.exit(1);
}

// Ensure output dir exists
const outputDir = path.join(__dirname, "csv_export");
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir);
}

async function getBlobData(key) {
	const blobPath = `${BLOB_PREFIX}${key}`;
	console.log(`📥 Fetching ${key}...`);

	try {
		const { blobs } = await list({ prefix: blobPath, token: BLOB_TOKEN });
		const exact = blobs?.find((b) => b.pathname === blobPath);
		const url = (exact || blobs?.[0])?.url;

		if (!url) return [];

		const res = await fetch(url);
		if (!res.ok) return [];
		return await res.json();
	} catch (error) {
		console.error(`❌ Error fetching ${key}:`, error.message);
		return [];
	}
}

function toCSV(data, fields) {
	if (!data || !data.length) return "";
	const header = fields.join(",") + "\n";
	const rows = data
		.map((row) => {
			return fields
				.map((fieldName) => {
					let val = row[fieldName] || "";
					if (typeof val === "string") {
						// Escape quotes and wrap in quotes
						val = `"${val.replace(/"/g, '""')}"`;
					}
					return val;
				})
				.join(",");
		})
		.join("\n");
	return header + rows;
}

async function main() {
	console.log("🚀 Starting CSV export...");

	// Productos
	const productos = await getBlobData("productos.json");
	if (productos.length) {
		const csv = toCSV(productos, [
			"id",
			"name",
			"description",
			"precio",
			"categoria",
			"stock",
			"marca",
			"modelo",
			"img",
		]);
		fs.writeFileSync(path.join(outputDir, "productos.csv"), csv);
		console.log(`✅ Exported productos.csv (${productos.length} items)`);
	}

	// Ventas
	const ventas = await getBlobData("ventas.json");
	if (ventas.length) {
		const csv = toCSV(ventas, [
			"id",
			"name",
			"description",
			"precio",
			"categoria",
			"stock",
			"marca",
			"modelo",
			"img",
		]);
		fs.writeFileSync(path.join(outputDir, "ventas.csv"), csv);
		console.log(`✅ Exported ventas.csv (${ventas.length} items)`);
	}

	// Servicios
	const servicios = await getBlobData("servicios.json");
	if (servicios.length) {
		const csv = toCSV(servicios, [
			"id",
			"name",
			"description",
			"precio",
			"categoria",
			"stock",
			"marca",
			"modelo",
			"img",
		]);
		fs.writeFileSync(path.join(outputDir, "servicios.csv"), csv);
		console.log(`✅ Exported servicios.csv (${servicios.length} items)`);
	}

	// Horarios
	const horarios = await getBlobData("horarios.json");
	if (horarios.length) {
		const csv = toCSV(horarios, ["day", "open", "close", "closed"]);
		fs.writeFileSync(path.join(outputDir, "horarios.csv"), csv);
		console.log(`✅ Exported horarios.csv (${horarios.length} items)`);
	}

	console.log(`\n📂 Files saved to: ${outputDir}`);
}

main();
