import { Router } from "express";
import { db } from "./db";
import { users, categories, products, tables, orders } from "@shared/schema";
import { eq } from "drizzle-orm";

export const diagnosticRouter = Router();

// Endpoint de diagnostic pour vérifier l'état de la base de données
diagnosticRouter.get("/api/diagnostic", async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: {
        connected: false,
        tables: {},
        errors: []
      }
    };

    try {
      // Test de connexion DB
      const result = await db.execute("SELECT NOW() as current_time");
      diagnostics.database.connected = true;

      // Compter les enregistrements dans chaque table
      const userCount = await db.select().from(users);
      diagnostics.database.tables.users = userCount.length;

      const categoryCount = await db.select().from(categories);
      diagnostics.database.tables.categories = categoryCount.length;

      const productCount = await db.select().from(products);
      diagnostics.database.tables.products = productCount.length;

      const tableCount = await db.select().from(tables);
      diagnostics.database.tables.tables = tableCount.length;

      const orderCount = await db.select().from(orders);
      diagnostics.database.tables.orders = orderCount.length;

    } catch (dbError) {
      diagnostics.database.errors.push({
        type: "database_connection",
        message: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }

    // Vérifier les variables d'environnement critiques
    const envVars = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      SESSION_SECRET: !!process.env.SESSION_SECRET,
      NODE_ENV: process.env.NODE_ENV
    };

    res.json({
      status: "diagnostic_complete",
      ...diagnostics,
      environment_variables: envVars
    });

  } catch (error) {
    res.status(500).json({
      status: "diagnostic_failed", 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour tester l'authentification
diagnosticRouter.post("/api/diagnostic/auth", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: "Username and password required for auth test" 
      });
    }

    // Simuler un test de login (sans vraiment se connecter)
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    
    if (user.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ 
      status: "auth_test_complete", 
      user_exists: true,
      user_active: user[0].isActive 
    });

  } catch (error) {
    res.status(500).json({
      status: "auth_test_failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
