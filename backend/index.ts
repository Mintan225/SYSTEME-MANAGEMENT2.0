// index.ts

import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createDefaultSuperAdmin } from "./super-admin-init";
import { storage } from "./storage";
import { DEFAULT_PERMISSIONS } from "@shared/permissions";
import path from "path";
import { execSync } from "child_process";

const app = express();

// Middleware pour servir les fichiers statiques (y compris les images uploadées)
// Ceci doit être placé au début car il ne dépend pas du type de corps de la requête.
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

// Middleware de journalisation personnalisé
app.use((req, res, next) => {
  const start = Date.now();
  const pathReq = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathReq.startsWith("/api")) {
      let logLine = `${req.method} ${pathReq} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});


async function createDefaultAdmin() {
  try {
    const existingAdmin = await storage.getUserByUsername("admin");
    if (!existingAdmin) {
      await storage.createUser({
        username: "admin",
        password: "admin123",
        role: "admin",
        permissions: DEFAULT_PERMISSIONS.admin
      });
      log("✓ Default admin user created: admin / admin123");
    }
  } catch (error) {
    log("Error creating default admin: " + (error as Error).message);
  }
}

async function initializeSystemSettings() {
  try {
    const appNameSetting = await storage.getSystemSetting("app_name");
    if (!appNameSetting) {
      await storage.createSystemSetting({
        key: "app_name",
        value: "Restaurant Manager",
        description: "Nom personnalisé de l'application",
        category: "branding"
      });
      log("✓ System setting app_name initialized");
    }
  } catch (error) {
    log("Error initializing system settings: " + (error as Error).message);
  }
}

(async () => {
  // --- Exécuter les migrations de base de données au démarrage ---
  try {
    console.log("🏗️ Running database migrations (push:pg)...");
    execSync("npx drizzle-kit push", { stdio: "inherit" });
    console.log("✅ Migrations applied.");
  } catch (e) {
    console.error("🚨 Migration failed:", e);
  }

  // Créer l'admin par défaut et le super admin
  await createDefaultAdmin();
  await createDefaultSuperAdmin();
  await initializeSystemSettings();

  // Enregistrement des routes
  // La fonction registerRoutes doit contenir la route d'upload d'image qui ne nécessite pas `express.json()`
  const server = await registerRoutes(app);

  // Middleware pour analyser le corps des requêtes JSON
  // Cette ligne a été déplacée ici. Elle doit se trouver APRÈS que la route d'upload de fichier ait été enregistrée.
  app.use(express.json());

  // Middleware de gestion des erreurs global
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();