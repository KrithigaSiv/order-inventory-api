import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import Redis from "ioredis";
import cors from "cors";


dotenv.config();

const app = express();
app.use(express.json());
app.set("trust proxy", 1);
app.use(cors());

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  message: { error: "Too many requests, try again later" },
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const redis = new Redis(process.env.REDIS_URL);
redis.on("error", (err) => console.log("Redis error:", err.message));

const clearProductsCache = async () => {
  try {
    await redis.del("products:all");
  } catch (err) {
    console.log("Cache clear failed:", err.message);
  }
};

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
    await clearProductsCache();
    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/products", async (req, res) => {
  try {
    const cached = await redis.get("products:all");
    if (cached) return res.json(JSON.parse(cached));
  } catch (err) {
    console.log("Cache read failed:", err.message);
  }

  const result = await pool.query("SELECT * FROM products");

  try {
    await redis.set("products:all", JSON.stringify(result.rows), "EX", 60);
  } catch (err) {
    console.log("Cache write failed:", err.message);
  }

  res.json(result.rows);
});

app.post("/orders", orderLimiter, async (req, res) => {
  const { product_id, quantity } = req.body;

  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "product_id and positive quantity required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const stockResult = await client.query(
      "SELECT id, stock FROM products WHERE id = $1 FOR UPDATE",
      [product_id]
    );

    if (stockResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    const currentStock = stockResult.rows[0].stock;

    if (currentStock < quantity) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Not enough stock", available: currentStock });
    }

    await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [quantity, product_id]);

    const orderResult = await client.query(
      "INSERT INTO orders (status, created_at) VALUES ($1, NOW()) RETURNING id",
      ["pending"]
    );
    const orderId = orderResult.rows[0].id;

    await client.query(
      "INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)",
      [orderId, product_id, quantity]
    );

    await client.query("COMMIT");
    await clearProductsCache(); // only after COMMIT

    res.status(201).json({ order_id: orderId, product_id, quantity, status: "pending" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Order failed" });
  } finally {
    client.release();
  }
});

app.get("/orders/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
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
    res.json({ ...orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(3000, () => console.log("Server running on http://localhost:3000"));
}

export { app, pool, redis };