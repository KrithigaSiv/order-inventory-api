import express from "express";
const app = express();
app.use(express.json());
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => res.send("Order Inventory API running"));


app.get("/test-db", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows[0]);
});

app.post("/products", async (req, res) => {
  const { name, price, stock } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING *",
      [name, price, stock]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/products", async (req, res) => {
  const result = await pool.query("SELECT * FROM products");
  res.json(result.rows);
});

app.post('/orders', async (req, res) => {
  const { product_id, quantity } = req.body;

  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'product_id and positive quantity required' });
  }

  const client = await pool.connect(); // use the pool, not a one-off query
  try {
    await client.query('BEGIN');

    // SELECT ... FOR UPDATE locks this row until COMMIT/ROLLBACK.
    // A second concurrent request on the same product_id will block here
    // until the first transaction finishes — that's what kills the race.
    const stockResult = await client.query(
      'SELECT id, stock FROM products WHERE id = $1 FOR UPDATE',
      [product_id]
    );

    if (stockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentStock = stockResult.rows[0].stock;

    if (currentStock < quantity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Not enough stock', available: currentStock });
    }

    // Deduct stock
    await client.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [quantity, product_id]
    );

    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (status, created_at) VALUES ($1, NOW()) RETURNING id',
      ['pending']
    );
    const orderId = orderResult.rows[0].id;

    // Create order_items
    await client.query(
      'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
      [orderId, product_id, quantity]
    );

    await client.query('COMMIT');
    res.status(201).json({ order_id: orderId, product_id, quantity, status: 'pending' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Order failed' });
  } finally {
    client.release(); // always release back to the pool
  }
});

app.get("/orders/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE id = $1",
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const itemsResult = await pool.query(
      `SELECT oi.product_id, oi.quantity, p.name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id]
    );

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));