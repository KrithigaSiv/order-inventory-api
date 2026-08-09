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