# Order & Inventory API — My Notes

## Day 1: Setup (8-8-26)

- Created GitHub repo: `order-inventory-api`
- Cloned the repo to my Mac and opened it in VS Code.
- Initialized Node.js project:
  `npm init -y`
- Installed:
  - `express` → create server/API
  - `pg` → connect Node.js with PostgreSQL
  - `dotenv` → manage environment variables/secrets
- Created:
  - `index.js` → main server file
  - `routes/` → API routes (will use later)
  - `.env` → private configuration
  - `.gitignore` → prevents `node_modules` and `.env` from being pushed

## Express Basics

- `express()` → creates Express app
- `express.json()` → parses JSON request body
- `app.get()` → creates GET endpoint
- `req` → request
- `res` → response
- `app.listen()` → starts the server

## What I Built Today

Created a basic Express server on port `3000`.

`GET /` → returns:

"Order Inventory API running"

Tested successfully using:

`node index.js`

## Remember

Node.js = runtime  
Express = framework for building APIs  
PostgreSQL = database  
`pg` = Node.js ↔ PostgreSQL connection

## Day 2: Database Setup + Core Routes (9-8-26)

- Tried Render for the new DB — hit free tier limit (travel tracker already using the one free slot)
- Switched to Neon instead — same `pg` library, no code changes needed
- Created Neon project, copied connection string into `.env`
- Connected via psql — had to wrap the URL in quotes again (zsh breaks on `&` otherwise)
- Created 3 tables: `products`, `orders`, `order_items`
- Connected Express to Postgres in `index.js`, tested with a temporary `/test-db` route — got back a timestamp, confirmed connection works

## Routes Built Today

- `POST /products` — adds a product, tested in Postman, works
- `GET /products` — lists all products, tested in Postman, works
- `POST /orders` — first pass, checks stock and places an order

**Known issue, not fixed yet:** `/orders` has a race condition — two people ordering the last item at the same time could both succeed and oversell. This is expected for now. Fixing it properly (DB transaction + row locking) is next weekend's task and the most important part of this project.

## Next Weekend
- Fix `/orders` race condition properly
- Test it on purpose (two rapid orders on low stock)
- Add `GET /orders/:id`
- Add Redis caching on `GET /products`
- Add rate limiting on `POST /orders`
- Write README
- Deploy to Render

# 4th Weekend — Race Condition Fix & Deployment

## Race Condition Fix
- Changed `pg.Client` → `pg.Pool` in `index.js`
- Used transactions for `POST /orders`
- Used `SELECT ... FOR UPDATE` to lock the product row
- Stock is checked and deducted inside the transaction
- Prevents two users from buying the same last item

## Testing
- Created a product with stock = `1`
- Sent 2 order requests at the same time
- One request → `201 Created`
- Other request → `409 Not Enough Stock`
- Final stock → `0`
- No overselling

## New API
- Added `GET /orders/:id`
- Returns order details using:
  - `orders`
  - `order_items`
  - `products`

## Render Deployment

### Error 1
- Render tried to run `yarn start`
- No `start` script existed
- Fixed Start Command to:
  `node index.js`

### Error 2
- `/test-db` returned `500`
- `DATABASE_URL` was missing in Render
- Added Neon `DATABASE_URL` in Render Environment
- `/test-db` then returned a valid timestamp

## Live Testing
- Reset stock to `1`
- Ran the same concurrent order test on the live Render URL
- One → `201`
- One → `409`
- No overselling

## Completed
- Race condition fixed
- Tested locally
- `GET /orders/:id`
- Deployed to Render
- Connected Neon in production
- Tested live deployment
- README completed

## Deferred
- Rate limiting
- Redis caching