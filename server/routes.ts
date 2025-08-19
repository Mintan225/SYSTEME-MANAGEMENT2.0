import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// Schémas de validation avec Zod pour des données robustes
const userSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});

const categorySchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(3),
  price: z.number().positive(),
  categoryId: z.number().int(),
});

const tableSchema = z.object({
  capacity: z.number().int().positive(),
  status: z.enum(['available', 'occupied', 'cleaning']),
});

const orderItemSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().positive(),
});

const orderSchema = z.object({
  tableId: z.number().int(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  paymentStatus: z.enum(['pending', 'paid', 'unpaid']).default('unpaid'),
  items: z.array(orderItemSchema).min(1),
});

const saleSchema = z.object({
  orderId: z.number().int(),
  totalAmount: z.number().positive(),
});

const expenseSchema = z.object({
  description: z.string().min(5),
  amount: z.number().positive(),
});

// Mock de base de données (pour la démonstration)
let users = [];
let categories = [];
let products = [];
let tables = [];
let orders = [];
let sales = [];
let expenses = [];
let nextId = 1;

// Middleware pour servir les fichiers statiques (exemple)
app.use('/static/*', serveStatic({ root: './' }));

// Middleware de gestion des erreurs
app.onError((err, c) => {
  console.error(`${err}`);
  if (err instanceof z.ZodError) {
    return c.json({ error: 'Validation failed', issues: err.errors }, 400);
  }
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Routes CRUD pour les entités
app.get('/', (c) => c.text('API Restaurant Hono - Fonctionne!'));

// Routes pour les utilisateurs
app.post('/api/users', zValidator('json', userSchema), (c) => {
  const user = c.req.valid('json');
  const newUser = { id: nextId++, ...user };
  users.push(newUser);
  return c.json(newUser, 201);
});

// Routes pour les catégories
app.get('/api/categories', (c) => c.json(categories));
app.post('/api/categories', zValidator('json', categorySchema), (c) => {
  const category = c.req.valid('json');
  const newCategory = { id: nextId++, ...category };
  categories.push(newCategory);
  return c.json(newCategory, 201);
});

// Routes pour les produits
app.get('/api/products', (c) => c.json(products));
app.post('/api/products', zValidator('json', productSchema), (c) => {
  const product = c.req.valid('json');
  const newProduct = { id: nextId++, ...product };
  products.push(newProduct);
  return c.json(newProduct, 201);
});

// Routes pour les tables
app.get('/api/tables', (c) => c.json(tables));
app.post('/api/tables', zValidator('json', tableSchema), (c) => {
  const table = c.req.valid('json');
  const newTable = { id: nextId++, ...table, status: 'available' };
  tables.push(newTable);
  return c.json(newTable, 201);
});
app.put('/api/tables/:id', zValidator('json', tableSchema.partial()), (c) => {
  const { id } = c.req.param();
  const index = tables.findIndex((t) => t.id === parseInt(id));
  if (index === -1) {
    return c.json({ error: 'Table not found' }, 404);
  }
  tables[index] = { ...tables[index], ...c.req.valid('json') };
  return c.json(tables[index]);
});

// Routes pour les commandes
app.get('/api/orders', (c) => c.json(orders));
app.post('/api/orders', zValidator('json', orderSchema), async (c) => {
  const order = c.req.valid('json');
  const newOrder = { id: nextId++, ...order, status: 'pending', paymentStatus: 'unpaid' };
  orders.push(newOrder);

  // Mettre à jour le statut de la table
  const table = tables.find((t) => t.id === order.tableId);
  if (table) {
    table.status = 'occupied';
  }
  return c.json(newOrder, 201);
});
app.put('/api/orders/:id', zValidator('json', orderSchema.partial()), async (c) => {
  const { id } = c.req.param();
  const orderIndex = orders.findIndex((o) => o.id === parseInt(id));
  if (orderIndex === -1) {
    return c.json({ error: 'Order not found' }, 404);
  }
  const updatedOrder = { ...orders[orderIndex], ...c.req.valid('json') };
  orders[orderIndex] = updatedOrder;

  // Logique pour la création de vente et la mise à jour de la table
  if (updatedOrder.status === 'completed' && updatedOrder.paymentStatus === 'paid') {
    const existingSale = sales.find((s) => s.orderId === updatedOrder.id);
    if (!existingSale) {
      const totalAmount = updatedOrder.items.reduce((sum, item) => {
        const product = products.find((p) => p.id === item.productId);
        return sum + (product ? product.price * item.quantity : 0);
      }, 0);
      const newSale = { id: nextId++, orderId: updatedOrder.id, totalAmount, date: new Date().toISOString() };
      sales.push(newSale);
    }

    const table = tables.find((t) => t.id === updatedOrder.tableId);
    if (table) {
      // Vérifier s'il y a d'autres commandes en cours pour cette table
      const hasOtherPendingOrders = orders.some(
        (o) => o.tableId === updatedOrder.tableId && o.status !== 'completed' && o.status !== 'cancelled'
      );
      if (!hasOtherPendingOrders) {
        table.status = 'available';
      }
    }
  }

  return c.json(updatedOrder);
});

// Routes pour les ventes
app.get('/api/sales', (c) => c.json(sales));
app.post('/api/sales', zValidator('json', saleSchema), (c) => {
  const sale = c.req.valid('json');
  const newSale = { id: nextId++, ...sale, date: new Date().toISOString() };
  sales.push(newSale);
  return c.json(newSale, 201);
});

// Routes pour les dépenses
app.get('/api/expenses', (c) => c.json(expenses));
app.post('/api/expenses', zValidator('json', expenseSchema), (c) => {
  const expense = c.req.valid('json');
  const newExpense = { id: nextId++, ...expense, date: new Date().toISOString() };
  expenses.push(newExpense);
  return c.json(newExpense, 201);
});

export default app;