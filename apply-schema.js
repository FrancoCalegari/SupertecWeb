const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const connectionString =
	process.env.POSTGRES_URL ||
	"postgres://postgres.zamlgdktsypamwthufsk:rE5HxpMQuIqUUcyO@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require";

async function runSchema() {
	console.log("🔌 Connecting to Supabase via Postgres...");
	const client = new Client({
		connectionString,
		ssl: {
			rejectUnauthorized: false,
		},
	});

	try {
		await client.connect();

		const schemaPath = path.join(__dirname, "supabase_schema.sql");
		const sql = fs.readFileSync(schemaPath, "utf8");

		console.log("📝 Applying schema...");
		await client.query(sql);
		console.log("✅ Schema applied successfully!");
	} catch (err) {
		console.error("❌ Error applying schema:", err);
	} finally {
		await client.end();
	}
}

runSchema();
