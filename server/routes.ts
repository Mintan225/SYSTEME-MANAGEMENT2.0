import { Router, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import { fileURLToPath } from 'url';
import { insertUserSchema, insertCategorySchema, insertProductSchema, insertTableSchema, insertOrderSchema, insertOrderItemSchema, insertSaleSchema, insertExpenseSchema, insertSuperAdminSchema } from "@shared/schema";
import { DEFAULT_PERMISSIONS, type UserRole } from "@shared/permissions";
import { storage } from "./storage";
import express from "express";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { APP_CONFIG } from "@shared/config";
import fs from 'fs';
import { ZodError } from "zod";
import { diagnosticRouter } from "./diagnostic";

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer pour le stockage en mémoire
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
        return res.status(400).json({
            message: `Multer Error: ${err.message}`
        });
    } else if (err) {
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

    // Add diagnostic routes
    app.use(diagnosticRouter);

    // Servir les fichiers statiques - try multiple possible paths
    const staticPaths = [
        path.join(process.cwd(), 'dist', 'public'),
        path.join(process.cwd(), 'public'),
        path.join(process.cwd(), '..', 'public')
    ];
    
    for (const staticPath of staticPaths) {
        if (fs.existsSync(staticPath)) {
            console.log(`Serving static files from: ${staticPath}`);
            app.use(express.static(staticPath));
            break;
        }
    }
    
    app.use(express.json());

    // Point de terminaison d'upload d'images pour les produits
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

    
    // Route pour récupérer le menu d'une table spécifique (pour les QR codes)
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

            res.json({
                table,
                categories,
                products: products.filter(p => p.available && !p.archived)
            });
        } catch (error) {
            console.error("Error fetching menu for table:", error);
            res.status(500).json({ message: "Failed to fetch menu" });
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
            console.log("[TABLE_CREATE_DEBUG] Request body received:", JSON.stringify(req.body));
            console.log("[TABLE_CREATE_DEBUG] Headers:", req.headers);
            
            // Check for required fields first
            if (!req.body.number || !req.body.capacity) {
                console.log("[TABLE_CREATE_DEBUG] Missing required fields:", {
                    number: req.body.number,
                    capacity: req.body.capacity
                });
                return res.status(400).json({
                    message: "Missing required fields",
                    details: "Both 'number' and 'capacity' are required",
                    received: req.body
                });
            }

            const { number, capacity } = req.body;
            
            // Parse integers with error checking
            const parsedNumber = parseInt(number);
            const parsedCapacity = parseInt(capacity);
            
            if (isNaN(parsedNumber) || isNaN(parsedCapacity)) {
                console.log("[TABLE_CREATE_DEBUG] Invalid number format:", {
                    number: number,
                    capacity: capacity,
                    parsedNumber: parsedNumber,
                    parsedCapacity: parsedCapacity
                });
                return res.status(400).json({
                    message: "Invalid number format",
                    details: "Number and capacity must be valid integers"
                });
            }
            
            const tableData = {
                number: parsedNumber,
                capacity: parsedCapacity,
                qrCode: req.body.qrCode || `https://${req.headers.host}/table/${parsedNumber}`,
                status: "available"
            };
            
            console.log("[TABLE_CREATE_DEBUG] Data to validate:", JSON.stringify(tableData));
            
            // Use safeParse for better error handling
            const parsedData = insertTableSchema.safeParse(tableData);
            if (!parsedData.success) {
                console.log("[TABLE_CREATE_DEBUG] Schema validation failed:", parsedData.error.issues);
                return res.status(400).json({
                    message: "Table data validation failed",
                    errors: parsedData.error.issues,
                    details: "Please check that all fields are properly formatted"
                });
            }
            
            console.log("[TABLE_CREATE_DEBUG] Schema validation passed:", JSON.stringify(parsedData.data));
            
            // Create table with validated data
            const table = await storage.createTable(parsedData.data);
            console.log("[TABLE_CREATE_DEBUG] Table created successfully:", table);
            
            res.json(table);
        } catch (error) {
            console.error("[TABLE_CREATE_DEBUG] Error creating table:", error);
            
            // Handle specific error types
            if (error instanceof Error) {
                // Check for duplicate key constraint
                if (error.message.includes('duplicate') || error.message.includes('unique') || error.message.includes('UNIQUE')) {
                    return res.status(409).json({
                        message: "Table number already exists",
                        error: "A table with this number already exists in the system"
                    });
                }
                
                // Check for database constraint errors
                if (error.message.includes('constraint') || error.message.includes('violates')) {
                    return res.status(400).json({
                        message: "Database constraint violation",
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
                const itemPrice = parseFloat(item.price);
                if (isNaN(itemPrice)) {
                    throw new Error("Invalid price for order item.");
                }
                return sum + (itemPrice * item.quantity);
            }, 0);
            const orderData = {
                tableId: parseInt(tableId),
                customerName,
                customerPhone,
                paymentMethod: paymentMethod || "cash",
                total: total.toFixed(2), // Formatage pour la BDD
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
                        price: parseFloat(item.price).toFixed(2), // Formatage
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
            if (Object.keys(req.body).length === 0) {
                return res.status(400).json({ message: "Aucune donnée de mise à jour fournie." });
            }
            
            console.log("[ORDER_UPDATE_DEBUG] Request body:", JSON.stringify(req.body));
            
            // Parse with error handling
            let orderData;
            try {
                orderData = insertOrderSchema.partial().parse(req.body);
                console.log("[ORDER_UPDATE_DEBUG] Parsed data:", JSON.stringify(orderData));
            } catch (parseError) {
                console.error("[ORDER_UPDATE_DEBUG] Parse error:", parseError);
                if (parseError instanceof ZodError) {
                    return res.status(400).json({
                        message: "Données de commande invalides.",
                        errors: parseError.issues
                    });
                }
                throw parseError;
            }
            if (orderData.status === 'completed') {
                orderData.paymentStatus = 'paid';
                orderData.completedAt = new Date();
            }
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
            if (error instanceof Error && error.message.includes("Invalid")) {
                return res.status(400).json({ message: "Données de commande invalides.", error: error.message });
            }
            res.status(500).json({ message: "Failed to update order" });
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
            console.error("Error creating manual sale:", error);
            if (error instanceof ZodError) {
                return res.status(400).json({
                    message: "Données de vente invalides.",
                    errors: error.issues
                });
            }
            res.status(500).json({ message: "Failed to create manual sale", error: error instanceof Error ? error.message : String(error) });
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
            if (error instanceof ZodError) {
                return res.status(400).json({ message: "Données de dépense invalides.", errors: error.issues });
            }
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
            // Ces deux fonctions sont manquantes, je les ai commentées
            // pour éviter l'erreur de build.
            // const methods = getAvailablePaymentMethods();
            // res.json(methods.map(method => ({
            //     id: method,
            //     label: getPaymentMethodLabel(method),
            //     enabled: isPaymentMethodEnabled(method)
            // })));
            res.status(200).json({ message: "Route de paiement temporairement désactivée pour éviter les erreurs de build." });
        } catch (error) {
            console.error("Error fetching payment methods:", error);
            res.status(500).json({ message: "Failed to fetch payment methods" });
        }
    });

    app.put("/api/payment-methods", authenticateToken, authorizePermission(["config.payment_methods"]), async (req, res) => {
        try {
            const { methods } = req.body;
            if (!Array.isArray(methods)) {
                return res.status(400).json({ message: "Invalid data format. 'methods' should be an array." });
            }
            res.status(200).json({ message: "Route de mise à jour de paiement temporairement désactivée." });
        } catch (error) {
            console.error("Error updating payment methods:", error);
            res.status(500).json({ message: "Failed to update payment methods" });
        }
    });
    
    // Catch-all route for SPA
    app.get("/*", (req, res) => {
        // Try different possible paths for index.html
        const possiblePaths = [
            path.join(process.cwd(), 'dist', 'public', 'index.html'),
            path.join(process.cwd(), 'public', 'index.html'),
            path.join(process.cwd(), '..', 'public', 'index.html'),
            path.join(__dirname, '..', 'public', 'index.html')
        ];
        
        let filePath = null;
        let pathFound = false;
        
        try {
            // Test each path synchronously
            for (const possiblePath of possiblePaths) {
                try {
                    fs.accessSync(possiblePath, fs.constants.F_OK);
                    filePath = possiblePath;
                    pathFound = true;
                    break;
                } catch (error) {
                    // Path doesn't exist, continue to next
                    continue;
                }
            }
        } catch (error) {
            console.error('Error checking file paths:', error);
        }
        
        if (pathFound && filePath) {
            res.sendFile(path.resolve(filePath));
        } else {
            // Fallback: try to serve a basic HTML response
            console.error('index.html not found in any of these paths:', possiblePaths);
            res.setHeader('Content-Type', 'text/html');
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>RestoManager</title></head>
                <body>
                    <h1>Application Loading...</h1>
                    <p>Please wait while the application starts.</p>
                    <script>
                        setTimeout(() => window.location.reload(), 3000);
                    </script>
                </body>
                </html>
            `);
        }
    });

    const server = createServer(app);
    return server;
}