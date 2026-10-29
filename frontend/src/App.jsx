import { useEffect, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState({}); // { [productId]: quantity }
  const [msg, setMsg] = useState({}); // { [productId]: { type, text } }
  const [form, setForm] = useState({ name: "", price: "", stock: "" });
  const [adding, setAdding] = useState(false);

  async function loadProducts() {
    try {
      setError("");
      const res = await fetch(`${API}/products`);
      if (!res.ok) throw new Error("Server error");
      setProducts(await res.json());
    } catch {
      setError("Could not load products. The server may be waking up, try again in a minute.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function buy(product) {
    const quantity = Number(qty[product.id] || 1);
    setMsg((m) => ({ ...m, [product.id]: { type: "info", text: "Placing order..." } }));
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, quantity }),
      });
      const data = await res.json().catch(() => ({}));

      let result;
      if (res.status === 201) {
        result = { type: "ok", text: `Order #${data.order_id} placed.` };
      } else if (res.status === 409) {
        result = { type: "error", text: `Not enough stock. ${data.available ?? 0} left.` };
      } else if (res.status === 429) {
        result = { type: "error", text: "Too many orders. Wait a minute and try again." };
      } else {
        result = { type: "error", text: data.error || "Order failed." };
      }
      setMsg((m) => ({ ...m, [product.id]: result }));
      loadProducts(); // refresh stock
    } catch {
      setMsg((m) => ({ ...m, [product.id]: { type: "error", text: "Network error." } }));
    }
  }

  async function addProduct(e) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`${API}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      });
      if (!res.ok) throw new Error();
      setForm({ name: "", price: "", stock: "" });
      loadProducts();
    } catch {
      setError("Could not add the product. Check the name, price and stock.");
    } finally {
      setAdding(false);
    }
  }

  const stockClass = (s) => (s === 0 ? "out" : s <= 5 ? "low" : "ok");
  const stockLabel = (s) => (s === 0 ? "Out of stock" : s <= 5 ? `Only ${s} left` : `${s} in stock`);

  return (
    <main className="page">
      <header className="top">
        <h1>Order &amp; Inventory</h1>
        <p>Open this page in two tabs and buy the last item in both. Only one order goes through.</p>
      </header>

      {error && <p className="banner">{error}</p>}

      <section>
        <div className="section-head">
          <h2>Products</h2>
          <button className="ghost" onClick={loadProducts}>Refresh</button>
        </div>

        {loading ? (
          <p className="muted">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="muted">No products yet. Add one below.</p>
        ) : (
          <ul className="list">
            {products.map((p) => (
              <li key={p.id} className="row">
                <div className="info">
                  <strong>{p.name}</strong>
                  <span className="price">₹{Number(p.price).toFixed(2)}</span>
                </div>
                <span className={`stock ${stockClass(p.stock)}`}>{stockLabel(p.stock)}</span>
                <div className="actions">
                  <input
                    type="number"
                    min="1"
                    aria-label={`Quantity for ${p.name}`}
                    value={qty[p.id] ?? 1}
                    onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })}
                  />
                  <button onClick={() => buy(p)} disabled={p.stock === 0}>
                    Buy
                  </button>
                </div>
                {msg[p.id] && <p className={`note ${msg[p.id].type}`}>{msg[p.id].text}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Add a product</h2>
        <form className="add" onSubmit={addProduct}>
          <input
            placeholder="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Price"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <input
            placeholder="Stock"
            type="number"
            min="0"
            step="1"
            required
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
          <button disabled={adding}>{adding ? "Adding..." : "Add product"}</button>
        </form>
      </section>
    </main>
  );
}