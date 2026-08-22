# order-inventory-api
REST API for managing orders, products, inventory, and stock operations
# Order Inventory API

A small Express + PostgreSQL API for managing products and orders, built to
handle concurrent order placement safely.

Live: https://order-inventory-api-m3cu.onrender.com

## Stack
- Node.js / Express
- PostgreSQL (hosted on Neon)
- Deployed on Render

## Setup
1. `npm install`
2. Create a `.env` file:

DATABASE_URL=postgresql://neondb_owner:npg_A3jxQznBUga2@ep-wandering-dream-axl36qll-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

3. `npm start`

## Endpoints
- `POST /products` — create a product
- `GET /products` — list all products
- `POST /orders` — place an order (body: `{ product_id, quantity }`)
- `GET /orders/:id` — get an order and its items

## The interesting part: race condition handling
`POST /orders` uses `SELECT ... FOR UPDATE` inside a transaction to lock the
product row while checking and deducting stock. This prevents two concurrent
requests from both succeeding when only one item is left in stock. Verified
with concurrent curl requests both locally and against the live deployment —
one request succeeds, the other correctly receives a 409 with no oversell.

## Known limitations / next steps
- No authentication
- No rate limiting on `/orders` yet
- No caching on `GET /products` yet