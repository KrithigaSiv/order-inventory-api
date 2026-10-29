# Order Inventory API

A REST API for managing products and orders, built to handle concurrent order
placement safely. It prevents overselling with database transactions and row
locking, and it is verified by an automated concurrency test.

**Live:** https://order-inventory-api-m3cu.onrender.com

> The free hosting tiers sleep after inactivity, so the first request may take
> 30-60 seconds to respond.

## Tech stack
- Node.js / Express
- PostgreSQL (hosted on Neon)
- Redis (hosted on Upstash) for caching
- Jest + Supertest for testing
- Deployed on Render

## Features
- Create and list products
- Place orders with stock checking and deduction in a single transaction
- Fetch an order with its items
- Redis caching on `GET /products` with invalidation when stock changes
- Per-IP rate limiting on `POST /orders` (10 requests per minute)
- Automated concurrency test

## Setup
1. Clone the repo and run `npm install`
2. Create a `.env` file:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
REDIS_URL=rediss://default:PASSWORD@HOST:6379
```

3. Create the tables `products`, `orders`, and `order_items` in your database
4. Start the server: `npm start`
5. Run the tests: `npm test`

## Endpoints
| Method | Route | Description |
|---|---|---|
| POST | `/products` | Create a product (`{ name, price, stock }`) |
| GET | `/products` | List all products (cached for 60 seconds) |
| POST | `/orders` | Place an order (`{ product_id, quantity }`) |
| GET | `/orders/:id` | Get an order and its items |

`POST /orders` responses: `201` created, `400` invalid input, `404` product
not found, `409` not enough stock, `429` rate limit exceeded.

## How overselling is prevented
`POST /orders` runs inside a transaction and uses `SELECT ... FOR UPDATE` to
lock the product row while stock is checked and deducted. If two requests
order the last item at the same time, the second one waits for the first to
finish, then sees the updated stock and receives a `409`.

**Testing:** an automated Jest + Supertest test creates a product with stock 5
and sends 10 simultaneous orders. It asserts that exactly 5 succeed, 5 are
rejected, and the final stock is 0. Removing `FOR UPDATE` makes the test fail,
which shows that the locking is what prevents the bug. The same behavior was
also verified against the live deployment.

## Caching
`GET /products` reads from Redis first and falls back to the database on a
cache miss. The cache expires after 60 seconds and is cleared after every
committed order or new product, so stock stays accurate. If Redis is
unavailable, the API falls back to the database instead of failing.

## Rate limiting
`POST /orders` is limited to 10 requests per IP per minute using
`express-rate-limit`. Requests over the limit receive a `429`.

## Known limitations / future improvements
- No authentication
- Orders support a single product per request (multi-item orders planned)
- No input validation library yet (basic checks only)
- No CI pipeline yet (GitHub Actions planned)
- The test runs against the real database rather than a separate test database