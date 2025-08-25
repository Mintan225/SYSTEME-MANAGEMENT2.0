import { Router, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import { insertUserSchema, insertCategorySchema, insertProductSchema, insertTableSchema, insertOrderSchema, insertOrderItemSchema, insertSaleSchema, insertExpenseSchema, insertSuperAdminSchema } from "@shared/schema";
import { DEFAULT_PERMISSIONS, type UserRole } from "@shared/permissions";
import { storage } from "./storage";
import express from "express";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { APP_CONFIG, PaymentConfig, getAvailablePaymentMethods, getPaymentMethodLabel, isPaymentMethodEnabled } from "@shared/config";
import { PaymentService } from "./payment-service";
import fs from 'fs';


// Configure multer pour le stockage en mémoire (plus besoin de dossier)
// Les images seront converties en base64 et stockées en DB
const storage_multer = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Accepte uniquement les images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage_multer,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB
  }
});

// Middleware de gestion d'erreurs pour Multer
function multerErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    // Erreur spécifique à Multer (ex: taille de fichier)
    return res.status(400).json({
      message: `Multer Error: ${err.message}`
    });
  } else if (err) {
    // Erreurs personnalisées (ex: type de fichier non valide)
    return res.status(400).json({
      message: err.message
    });
  }
  next();
}

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log("[AUTH_TOKEN_DEBUG] No token provided.");
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, APP_CONFIG.SECURITY.JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      console.log("[AUTH_TOKEN_DEBUG] Token verification failed:", err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired. Please login again.' });
      }
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    console.log("[AUTH_TOKEN_DEBUG] Token decoded successfully. Decoded payload:", decoded);
    req.user = {
      ...decoded,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : []
    };
    console.log("[AUTH_TOKEN_DEBUG] req.user.permissions after processing:", req.user.permissions);
    next();
  });
}

function authorizePermission(requiredPermissions: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ message: 'Access denied: No permissions found for user.' });
    }

    const userPermissions: string[] = req.user.permissions;

    const hasPermission = requiredPermissions.some(permission =>
      userPermissions.includes(permission)
    );

    if (hasPermission) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied: Insufficient permissions.' });
    }
  };
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint for Railway
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // Endpoint pour récupérer le menu d'une table spécifique (pour les QR codes)
  app.get("/api/menu/:tableNumber", async (req, res) => {
    try {
      const tableNumber = parseInt(req.params.tableNumber);
      if (isNaN(tableNumber)) {
        return res.status(400).json({ message: "Numéro de table invalide" });
      }

      // Vérifier que la table existe
      const table = await storage.getTableByNumber(tableNumber);
      if (!table) {
        return res.status(404).json({ message: "Table non trouvée" });
      }

      // Récupérer les catégories et produits
      const categories = await storage.getCategories();
      const products = await storage.getProducts();

      // Récupérer les commandes actives pour cette table (pour les notifications)
      const activeOrders = await storage.getActiveOrders();
      const tableOrders = activeOrders.filter((order: any) => order.tableId === table.id);

      res.json({
        table,
        categories,
        products: products.filter(p => p.available && !p.archived),
        orders: tableOrders
      });
    } catch (error) {
      console.error("Error fetching menu for table:", error);
      res.status(500).json({ message: "Failed to fetch menu for table" });
    }
  });

  // Servir les fichiers statiques depuis le dossier parent
  app.use(express.static(path.join(process.cwd(), '..', 'public')));

  // Point de terminaison d'upload d'images pour les produits
  // Cette route doit être avant le middleware express.json()
  app.post(
    "/api/products/upload-image",
    authenticateToken,
    authorizePermission(["products.create", "products.edit"]),
    upload.single('image'),
    multerErrorHandler,
    (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No image file provided" });
        }
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        res.json({
          message: "Image uploaded successfully",
          imageData: base64Image
        });
      } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500).json({
          message: "Failed to upload image",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

  // ⚠️ CORRECTION : on ajoute le middleware pour traiter les requêtes JSON
  app.use(express.json());

  // Point de terminaison pour la suppression d'images de produits
  app.delete("/api/products/delete-image", authenticateToken, authorizePermission(["products.edit", "products.delete"]), async (req, res) => {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }
      const filename = path.basename(imageUrl);
      const filepath = path.join(process.cwd(), '..', 'public', 'uploads', 'products', filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        res.json({ message: "Image deleted successfully" });
      } else {
        res.status(404).json({ message: "Image file not found" });
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({
        message: "Failed to delete image",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Gestion des routes utilisateurs
  app.get("/api/users", authenticateToken, authorizePermission(["users.view"]), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", authenticateToken, authorizePermission(["users.create"]), async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const permissions = (userData.permissions && userData.permissions.length > 0)
        ? userData.permissions
        : DEFAULT_PERMISSIONS[userData.role] || [];
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        permissions,
      });
      res.json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/users/:id", authenticateToken, authorizePermission(["users.edit"]), async (req, res) => {
    try {
      const userData = insertUserSchema.partial().parse(req.body);
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }
      const user = await storage.updateUser(Number(req.params.id), userData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/users/:id", authenticateToken, authorizePermission(["users.delete"]), async (req, res) => {
    try {
      const success = await storage.deleteUser(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Routes d'authentification
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const userData = insertUserSchema.parse({
        username,
        password: hashedPassword,
        fullName: username,
        role: 'admin',
        permissions: DEFAULT_PERMISSIONS['admin']
      });
      const user = await storage.createUser(userData);
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, permissions: user.permissions },
        APP_CONFIG.SECURITY.JWT_SECRET,
        { expiresIn: APP_CONFIG.SECURITY.JWT_EXPIRES_IN } as jwt.SignOptions
      );
      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register user", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log(`[LOGIN_DEBUG] Attempting login for username: "${username}"`);
      console.log(`[LOGIN_DEBUG] Request body received:`, req.body);
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log(`[LOGIN_DEBUG] Failure: User "${username}" not found in database.`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      console.log(`[LOGIN_DEBUG] Success: User "${username}" found in database. User ID: ${user.id}, Role: ${user.role}`);
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log(`[LOGIN_DEBUG] Failure: Incorrect password for user "${username}".`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      console.log(`[LOGIN_DEBUG] Success: Password is correct for user "${username}".`);
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, permissions: user.permissions },
        APP_CONFIG.SECURITY.JWT_SECRET,
        { expiresIn: APP_CONFIG.SECURITY.JWT_EXPIRES_IN } as jwt.SignOptions
      );
      console.log(`[LOGIN_DEBUG] Login successful for user "${username}". Token generated.`);
      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions }
      });
    } catch (error) {
      console.error("[LOGIN_DEBUG] Unexpected error during login:", error);
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Routes pour les catégories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", authenticateToken, authorizePermission(["categories.create"]), async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/categories/:id", authenticateToken, authorizePermission(["categories.edit"]), async (req, res) => {
    try {
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(Number(req.params.id), categoryData);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", authenticateToken, authorizePermission(["categories.delete"]), async (req, res) => {
    try {
      const success = await storage.deleteCategory(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Routes pour les produits
  app.get("/api/products", async (req, res) => {
    try {
      const { categoryId } = req.query;
      let products;
      if (categoryId) {
        products = await storage.getProductsByCategory(Number(categoryId));
      } else {
        products = await storage.getProducts();
      }
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(Number(req.params.id));
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", authenticateToken, authorizePermission(["products.create"]), async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/products/:id", authenticateToken, authorizePermission(["products.edit"]), async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(Number(req.params.id), productData);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/products/:id", authenticateToken, authorizePermission(["products.delete"]), async (req, res) => {
    try {
      const success = await storage.deleteProduct(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      if (error instanceof Error && error.message.includes("used in orders")) {
        return res.status(400).json({
          message: "Cannot delete product that is used in orders",
          error: error.message
        });
      }
      res.status(500).json({
        message: "Failed to delete product",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Routes pour les tables
  app.get("/api/tables", authenticateToken, authorizePermission(["tables.view"]), async (req, res) => {
    try {
      const tables = await storage.getTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tables" });
    }
  });

  app.get("/api/tables/:id", authenticateToken, authorizePermission(["tables.view"]), async (req, res) => {
    try {
      const table = await storage.getTable(Number(req.params.id));
      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch table" });
    }
  });

  app.post("/api/tables", authenticateToken, authorizePermission(["tables.create"]), async (req, res) => {
    try {
      console.log("[TABLE_CREATE_DEBUG] Request body received:", req.body);

      // Validate required fields
      if (!req.body.number || !req.body.capacity) {
        console.log("[TABLE_CREATE_DEBUG] Missing required fields. number:", req.body.number, "capacity:", req.body.capacity);
        return res.status(400).json({ 
          message: "Missing required fields", 
          details: "Both 'number' and 'capacity' are required" 
        });
      }

      // Parse and validate the table data
      const rawTableData = {
        number: parseInt(req.body.number),
        capacity: parseInt(req.body.capacity),
        qrCode: req.body.qrCode || `https://${req.headers.host}/table/${req.body.number}`,
        status: "available"
      };

      console.log("[TABLE_CREATE_DEBUG] Raw table data:", rawTableData);

      // Validate with schema
      const tableData = insertTableSchema.parse(rawTableData);
      console.log("[TABLE_CREATE_DEBUG] Validated table data:", tableData);

      const table = await storage.createTable(tableData);
      console.log("[TABLE_CREATE_DEBUG] Table created successfully:", table);

      res.json(table);
    } catch (error) {
      console.error("[TABLE_CREATE_DEBUG] Error creating table:", error);

      if (error instanceof Error) {
        // Check if it's a validation error
        if (error.message.includes('Expected') || error.message.includes('Invalid')) {
          return res.status(400).json({ 
            message: "Validation error", 
            error: error.message,
            details: "Please check that number and capacity are valid integers"
          });
        }

        // Check if it's a duplicate key error
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          return res.status(409).json({ 
            message: "Table number already exists", 
            error: error.message 
          });
        }
      }

      res.status(500).json({ 
        message: "Failed to create table", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.put("/api/tables/:id", authenticateToken, authorizePermission(["tables.edit"]), async (req, res) => {
    try {
      const tableData = insertTableSchema.partial().parse(req.body);
      const table = await storage.updateTable(Number(req.params.id), tableData);
      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ message: "Failed to update table" });
    }
  });

  // Routes pour les commandes
  app.get("/api/orders", authenticateToken, authorizePermission(["orders.view"]), async (req, res) => {
    try {
      const { active } = req.query;
      let orders;
      if (active === 'true') {
        orders = await storage.getActiveOrders();
      } else {
        orders = await storage.getOrders();
      }
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrderWithItems(Number(req.params.id));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { tableId, customerName, customerPhone, orderItems, paymentMethod, notes } = req.body;
      const total = orderItems.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.price) * item.quantity);
      }, 0);
      const orderData = {
        tableId: parseInt(tableId),
        customerName,
        customerPhone,
        paymentMethod: paymentMethod || "cash",
        total: total.toString(),
        notes: notes || null,
        status: "pending",
        paymentStatus: "pending"
      };
      const order = await storage.createOrder(orderData);
      try {
        await storage.updateTable(parseInt(tableId), { status: "occupied" });
      } catch (error) {
        console.error("Error updating table status:", error);
      }
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          await storage.createOrderItem({
            orderId: order.id,
            productId: parseInt(item.productId),
            quantity: parseInt(item.quantity),
            price: item.price.toString(),
            notes: item.notes || null
          });
        }
      }
      const orderWithItems = await storage.getOrderWithItems(order.id);
      res.json(orderWithItems);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/orders/:id", authenticateToken, authorizePermission(["orders.edit", "orders.update_status"]), async (req, res) => {
    try {
      console.log(`[ORDER_UPDATE_DEBUG] Updating order ${req.params.id} with data:`, req.body);

      // Validate order ID
      if (!req.params.id || isNaN(parseInt(req.params.id))) {
        return res.status(400).json({ 
          message: 'ID de commande invalide',
          error: 'INVALID_ORDER_ID'
        });
      }

      // Validate required fields
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ 
          message: 'Données de commande manquantes ou invalides',
          error: 'INVALID_REQUEST_BODY'
        });
      }


      // Validation plus flexible - on accepte les champs individuels
      let orderData: any = {};

      // Validation manuelle des champs autorisés
      const allowedFields = ['status', 'paymentStatus', 'paymentMethod', 'total', 'notes', 'customerName', 'customerPhone'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          orderData[field] = req.body[field];
        }
      }

      // Validation du statut si présent
      if (orderData.status && !['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(orderData.status)) {
        return res.status(400).json({ message: "Statut de commande invalide." });
      }

      // Validation du statut de paiement si présent
      if (orderData.paymentStatus && !['pending', 'paid', 'failed'].includes(orderData.paymentStatus)) {
        return res.status(400).json({ message: "Statut de paiement invalide." });
      }

      // Logique automatique pour les commandes terminées
      if (orderData.status === 'completed') {
        orderData.paymentStatus = 'paid';
        orderData.completedAt = new Date();
      }

      console.log(`[ORDER_UPDATE_DEBUG] Validated order data:`, orderData);

      const order = await storage.updateOrder(Number(req.params.id), orderData);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (orderData.status) {
        try {
          let tableStatus = "available";
          if (orderData.status === 'completed' || orderData.status === 'cancelled') {
            const activeOrders = await storage.getActiveOrders();
            const otherActiveOrders = activeOrders.filter((o: any) =>
              o.tableId === order.tableId &&
              o.id !== order.id &&
              o.status !== 'completed' &&
              o.status !== 'cancelled'
            );
            if (otherActiveOrders.length === 0) {
              tableStatus = "available";
            } else {
              tableStatus = "occupied";
            }
          } else {
            tableStatus = "occupied";
          }
          await storage.updateTable(order.tableId, { status: tableStatus });
        } catch (error) {
          console.error("Error updating table status:", error);
        }
      }
      if (orderData.status === 'completed' && orderData.paymentStatus === 'paid') {
        try {
          const orderWithItems = await storage.getOrderWithItems(order.id);
          if (orderWithItems) {
            const existingSales = await storage.getSales();
            const existingSale = existingSales.find(sale => sale.orderId === order.id);
            if (!existingSale) {
              await storage.createSale({
                orderId: order.id,
                amount: order.total,
                paymentMethod: order.paymentMethod || 'cash',
                description: `Commande #${order.id} - ${orderWithItems.orderItems.map(item => item.product.name).join(', ')}`
              });
              console.log(`Vente automatiquement créée pour la commande #${order.id}`);
            } else {
              console.log(`Vente déjà existante pour la commande #${order.id}`);
            }
          }
        } catch (saleError) {
          console.error('Error creating sale for completed order:', saleError);
        }
      }
      res.json(order);
    } catch (error) {
      console.error("Error updating order:", error);

      // Gestion spécifique des erreurs de validation
      if (error instanceof Error) {
        if (error.message.includes("Invalid") || error.message.includes("Expected")) {
          return res.status(400).json({ 
            message: "Données de commande invalides.", 
            error: error.message,
            details: "Vérifiez que tous les champs ont des valeurs valides."
          });
        }

        if (error.message.includes("not found")) {
          return res.status(404).json({ message: "Commande introuvable." });
        }
      }

      res.status(500).json({ 
        message: "Erreur lors de la mise à jour de la commande",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });


  // Route pour générer et télécharger un reçu
  app.get("/api/orders/:id/receipt", async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const orderWithItems = await storage.getOrderWithItems(orderId);
      if (!orderWithItems) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (orderWithItems.paymentStatus !== 'paid') {
        return res.status(400).json({ message: "Order is not paid yet" });
      }
      const receiptData = {
        orderId: orderWithItems.id,
        customerName: orderWithItems.customerName || 'Client',
        customerPhone: orderWithItems.customerPhone,
        tableNumber: orderWithItems.tableId,
        items: orderWithItems.orderItems.map((item: any) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.price) * item.quantity
        })),
        subtotal: parseFloat(orderWithItems.total),
        total: parseFloat(orderWithItems.total),
        paymentMethod: orderWithItems.paymentMethod || 'Espèces',
        paymentDate: orderWithItems.createdAt,
        restaurantName: 'RESTO BAR MANAGER',
        restaurantAddress: 'Adresse du restaurant',
        restaurantPhone: '+225 07 78 26 560 9'
      };
      res.json(receiptData);
    } catch (error) {
      console.error("Error generating receipt:", error);
      res.status(500).json({ message: "Failed to generate receipt" });
    }
  });

  // Routes pour les articles de commande
  app.post("/api/order-items", authenticateToken, authorizePermission(["orders.create"]), async (req, res) => {
    try {
      const orderItemData = insertOrderItemSchema.parse(req.body);
      const orderItem = await storage.createOrderItem(orderItemData);
      res.json(orderItem);
    } catch (error) {
      console.error("Error creating order item:", error);
      res.status(500).json({ message: "Failed to create order item", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Routes pour les ventes
  app.get("/api/sales", authenticateToken, authorizePermission(["sales.view"]), async (req, res) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.post("/api/sales", authenticateToken, authorizePermission(["sales.create"]), async (req, res) => {
    try {
      const saleData = insertSaleSchema.parse(req.body);
      const sale = await storage.createSale(saleData);
      res.json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: "Failed to create sale", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/sales/:id", authenticateToken, authorizePermission(["sales.delete"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const deleted = await storage.deleteSale(id);
      if (deleted) {
        res.json({ message: "Sale deleted successfully" });
      } else {
        res.status(404).json({ message: "Sale not found" });
      }
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ message: "Failed to delete sale" });
    }
  });

  // Suppression de commande
  app.delete("/api/orders/:id", authenticateToken, authorizePermission(["orders.delete"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const deleted = await storage.deleteOrder(id);
      if (deleted) {
        res.json({ message: "Order deleted successfully" });
      } else {
        res.status(404).json({ message: "Order not found" });
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Routes pour les archives
  app.get("/api/archives/orders", authenticateToken, authorizePermission(["archives.view"]), async (req, res) => {
    try {
      const orders = await storage.getDeletedOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching deleted orders:", error);
      res.status(500).json({ message: "Failed to fetch deleted orders" });
    }
  });

  app.get("/api/archives/products", authenticateToken, authorizePermission(["archives.view"]), async (req, res) => {
    try {
      const products = await storage.getArchivedProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching archived products:", error);
      res.status(500).json({ message: "Failed to fetch archived products" });
    }
  });

  app.put("/api/archives/products/restore/:id", authenticateToken, authorizePermission(["archives.restore"]), async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const product = await storage.restoreArchivedProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Archived product not found" });
      }
      res.json({ message: "Product restored successfully" });
    } catch (error) {
      console.error("Error restoring product:", error);
      res.status(500).json({ message: "Failed to restore product" });
    }
  });

  // Routes pour les dépenses
  app.get("/api/expenses", authenticateToken, authorizePermission(["expenses.view"]), async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", authenticateToken, authorizePermission(["expenses.create"]), async (req, res) => {
    try {
      const expenseData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(expenseData);
      res.json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/expenses/:id", authenticateToken, authorizePermission(["expenses.edit"]), async (req, res) => {
    try {
      const expenseData = insertExpenseSchema.partial().parse(req.body);
      const expense = await storage.updateExpense(Number(req.params.id), expenseData);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/expenses/:id", authenticateToken, authorizePermission(["expenses.delete"]), async (req, res) => {
    try {
      const success = await storage.deleteExpense(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Routes pour le super administrateur (configuration initiale)
  app.post("/api/super-admin/setup", async (req, res) => {
    try {
      const superAdminData = insertSuperAdminSchema.parse(req.body);
      const existingSuperAdmin = await storage.getSuperAdmin();
      if (existingSuperAdmin) {
        return res.status(409).json({ message: "Super Admin already exists. Cannot create another one." });
      }
      const hashedPassword = await bcrypt.hash(superAdminData.password, 10);
      const superAdmin = await storage.createSuperAdmin({
        ...superAdminData,
        password: hashedPassword,
        permissions: DEFAULT_PERMISSIONS['super-admin']
      });
      res.status(201).json({ message: "Super Admin created successfully", superAdmin });
    } catch (error) {
      console.error("Error setting up super admin:", error);
      res.status(500).json({ message: "Failed to set up super admin", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Routes pour les méthodes de paiement
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const methods = getAvailablePaymentMethods();
      res.json(methods.map(method => ({
        id: method,
        label: getPaymentMethodLabel(method),
        enabled: isPaymentMethodEnabled(method)
      })));
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  app.put("/api/payment-methods", authenticateToken, authorizePermission(["config.payment_methods"]), async (req, res) => {
    try {
      const { paymentMethods } = req.body;
      if (!Array.isArray(paymentMethods) || !paymentMethods.every(m => typeof m.id === 'string' && typeof m.enabled === 'boolean')) {
        return res.status(400).json({ message: "Invalid payment methods data" });
      }
      for (const method of paymentMethods) {
        await storage.setSystemSetting(method.id, method.enabled ? "true" : "false");
      }
      res.json({ message: "Payment methods updated successfully" });
    } catch (error) {
      console.error("Error updating payment methods:", error);
      res.status(500).json({ message: "Failed to update payment methods" });
    }
  });

  // Routes pour la configuration système
  app.get("/api/config/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSystemSetting(key);
      if (!setting) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching system setting:", error);
      res.status(500).json({ message: "Failed to fetch system setting" });
    }
  });

  app.put("/api/config/:key", authenticateToken, authorizePermission(["config.edit"]), async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      if (value === undefined) {
        return res.status(400).json({ message: "Value is required" });
      }
      const setting = await storage.updateSystemSetting(key, value);
      if (!setting) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error updating system setting:", error);
      res.status(500).json({ message: "Failed to update system setting" });
    }
  });

  // Routes pour les statistiques et rapports
  app.get("/api/analytics/sales-by-category", authenticateToken, authorizePermission(["analytics.view"]), async (req, res) => {
    try {
      const sales = await storage.getSalesByCategory();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales by category:", error);
      res.status(500).json({ message: "Failed to fetch sales by category" });
    }
  });

  app.get("/api/analytics/top-selling-products", authenticateToken, authorizePermission(["analytics.view"]), async (req, res) => {
    try {
      const topProducts = await storage.getTopSellingProducts();
      res.json(topProducts);
    } catch (error) {
      console.error("Error fetching top selling products:", error);
      res.status(500).json({ message: "Failed to fetch top selling products" });
    }
  });

  app.get("/api/analytics/sales-by-day", authenticateToken, authorizePermission(["analytics.view"]), async (req, res) => {
    try {
      const salesData = await storage.getSalesByDay();
      res.json(salesData);
    } catch (error) {
      console.error("Error fetching sales by day:", error);
      res.status(500).json({ message: "Failed to fetch sales by day" });
    }
  });

  // Middleware de gestion d'erreurs générique
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Global error handler:", err);
    res.status(status).json({ message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  });

  const server = createServer(app);
  return server;
}