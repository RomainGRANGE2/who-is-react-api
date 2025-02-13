import { Sequelize } from "@sequelize/core";
import { MySqlDialect } from "@sequelize/mysql";
import dotenv from "dotenv";

dotenv.config(); // Charge les variables d'environnement

/**
 * Connexion à la base de données
 */
export const sequelize = new Sequelize({
	dialect: MySqlDialect,
	database: process.env.DB_NAME || "database_name",
	user: process.env.DB_USER || "root",  // ✅ Remplacé "user" par "username"
	password: process.env.DB_PASSWORD || "",
	host: process.env.DB_HOST || "localhost",
	port: parseInt(process.env.DB_PORT) || 3306,
	logging: false, // ✅ Désactive les logs SQL
});

(async () => {
	try {
		await sequelize.authenticate();
		console.log("✅ Connexion réussie à Railway MySQL !");
	} catch (error) {
		console.error("❌ Erreur de connexion à MySQL :", error);
	}
})();
