import request from "supertest";
import { app, pool } from "../index.js";

afterAll(async () => {
  await pool.end(); // close DB connections so Jest can exit
});

test("10 simultaneous orders on stock 5 -> exactly 5 succeed", async () => {
  // 1. create a product with stock 5
  const created = await request(app)
    .post("/products")
    .send({ name: "Concurrency test item", price: 10, stock: 5 });
  const productId = created.body.id;

  // 2. fire 10 orders at the same time
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      request(app).post("/orders").send({ product_id: productId, quantity: 1 })
    )
  );
  const statuses = results.map((r) => r.status);

  // 3. exactly 5 succeed, 5 are rejected
  expect(statuses.filter((s) => s === 201)).toHaveLength(5);
  expect(statuses.filter((s) => s === 409)).toHaveLength(5);

  // 4. final stock is 0, never negative
  const { rows } = await pool.query("SELECT stock FROM products WHERE id = $1", [productId]);
  expect(rows[0].stock).toBe(0);
}, 30000);