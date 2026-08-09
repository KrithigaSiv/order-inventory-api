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