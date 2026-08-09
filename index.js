import express from "express";
const app = express();
app.use(express.json());
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
db.connect();

app.get("/", (req, res) => res.send("Order Inventory API running"));

app.listen(3000, () => console.log("Server running on http://localhost:3000"));

app.get("/test-db", async (req, res) => {
  const result = await db.query("SELECT NOW()");
  res.json(result.rows[0]);
});

app.post("/products", async (req, res) => {
  const { name, price, stock } = req.body;
  try {
    const result = await db.query(
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
  const result = await db.query("SELECT * FROM products");
  res.json(result.rows);
});

app.post("/orders", async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    const productResult = await db.query("SELECT * FROM products WHERE id=$1", [productId]);
    const product = productResult.rows[0];

    if (!product || product.stock < quantity) {
      return res.status(400).json({ error: "Not enough stock" });
    }

    await db.query("UPDATE products SET stock = stock - $1 WHERE id=$2", [quantity, productId]);
    const orderResult = await db.query("INSERT INTO orders DEFAULT VALUES RETURNING *");
    const order = orderResult.rows[0];
    await db.query(
      "INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1,$2,$3)",
      [order.id, productId, quantity]
    );

    res.json({ order, message: "Order placed" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});