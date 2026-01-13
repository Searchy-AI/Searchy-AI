import express from 'express';
import { MongoClient } from 'mongodb';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json()); // Ensure JSON parsing is enabled
const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const QUERY_URL = process.env.QUERY_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const client = new MongoClient(MONGO_URL);
let collection;

// Postgres Connection Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon
  }
});

// Initialize Database Schema
async function initDb() {
  const client = await pool.connect();
  try {
    // Create Tenants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        plan VARCHAR(50) DEFAULT 'free',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255)
      );
    `);

    // Create API Keys Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        key_hint VARCHAR(10) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Database schema initialized");
  } catch (err) {
    console.error("❌ Schema initialization failed:", err);
  } finally {
    client.release();
  }
}

// Helper: Generate API Key (simple version)
function generateApiKey() {
  return 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Auth Endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' });
    }

    // Verify Google Token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    // Check if tenant exists
    const client = await pool.connect();
    try {
      const tenantRes = await client.query('SELECT * FROM tenants WHERE email = $1', [email]);
      let tenant = tenantRes.rows[0];
      let apiKey = null;
      let isNew = false;

      if (!tenant) {
        isNew = true;
        // Create new tenant
        const insertRes = await client.query(
          `INSERT INTO tenants (name, email, oauth_provider, oauth_id) 
           VALUES ($1, $2, 'google', $3) 
           RETURNING *`,
          [name || email.split('@')[0], email, googleId]
        );
        tenant = insertRes.rows[0];

        // Create API Key
        apiKey = generateApiKey();
        await client.query(
          `INSERT INTO api_keys (tenant_id, key, key_hint) VALUES ($1, $2, $3)`,
          [tenant.id, apiKey, apiKey.slice(-4)]
        );
      } else {
        // Get existing key
        const keyRes = await client.query('SELECT * FROM api_keys WHERE tenant_id = $1 LIMIT 1', [tenant.id]);
        if (keyRes.rows.length > 0) {
          apiKey = keyRes.rows[0].key;
        } else {
          apiKey = generateApiKey();
          await client.query(
            `INSERT INTO api_keys (tenant_id, key, key_hint) VALUES ($1, $2, $3)`,
            [tenant.id, apiKey, apiKey.slice(-4)]
          );
        }
      }

      res.json({
        success: true,
        token: 'session_token_placeholder',
        api_key_hint: isNew ? apiKey : (apiKey ? '...' + apiKey.slice(-4) : null),
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          plan: tenant.plan,
          status: tenant.status
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});


// Helper: normalize string for search
function normalize(str) {
  return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// // Search endpoint
// app.get('/search', async (req, res) => {
//   const q = normalize(req.query.q || '');
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 20;
//   const skip = (page - 1) * limit;

//   const query = q
//     ? {
//         $or: [
//           { product_name: { $regex: q, $options: 'i' } },
//           { description: { $regex: q, $options: 'i' } },
//           { brand: { $regex: q, $options: 'i' } },
//           { category_name: { $regex: q, $options: 'i' } },
//           { breadcrumbs: { $regex: q, $options: 'i' } }
//         ]
//       }
//     : {};

//   try {
//     const total = await collection.countDocuments(query);
//     const results = await collection.find(query).skip(skip).limit(limit).toArray();
//     res.json({ total, page, limit, results });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Database query failed' });
//   }
// });

// Product details endpoint
app.get('/product/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const product = await collection.findOne({
      $or: [
        { product_id: id },
        { sku: id }
      ]
    });
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Proxy endpoint for getting product ids
app.post('/api/embed', express.json(), async (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    // 1. Get ALL relevant product IDs from the embedding service
    const response = await axios.post(`${QUERY_URL}/embed-text`, { query });
    const allProductIds = response.data.products;

    if (!allProductIds || allProductIds.length === 0) {
      return res.json({
        total: 0,
        page,
        limit,
        results: []
      });
    }

    const total = allProductIds.length;

    // 2. Apply pagination to the array of IDs BEFORE hitting the database

    // 3. Fetch only the documents for the current page in a SINGLE database query
    // This uses the $in operator to find all documents where product_id or sku is in our paginated list.
    const results = await collection.find({
      $or: [
        { product_id: { $in: allProductIds } },
        { sku: { $in: allProductIds } }
      ]
    }).toArray();

    // (Optional but Recommended) 4. Preserve the order from the embedding service.
    // The `$in` operator does not guarantee order. We re-sort the results to match the ML service's ranking.
    const resultsById = new Map(results.map(doc => [doc.product_id || doc.sku, doc]));
    const orderedResults = allProductIds.map(id => resultsById.get(id)).filter(Boolean);

    res.json({
      total,
      results: orderedResults // Send the correctly ordered results
    });

  } catch (err) {
    // Check if the error is from Axios or our own logic
    if (err.response) {
      console.error("Error from FastAPI service:", err.response.data);
      res.status(err.response.status || 500).json({ error: "Failed to get embeddings from service" });
    } else {
      console.error("Error processing request:", err.message);
      res.status(500).json({ error: "Failed to process query" });
    }
  }
});

// Image search endpoint
app.post('/api/image-search', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Convert image to base64 for the AI service
    const base64Image = req.file.buffer.toString('base64');

    // Call the AI service for image search
    const response = await axios.post(`${QUERY_URL}/embed-image`, {
      image: base64Image,
      image_type: req.file.mimetype
    });

    const allProductIds = response.data.products;

    if (!allProductIds || allProductIds.length === 0) {
      return res.json({
        total: 0,
        results: []
      });
    }

    const total = allProductIds.length;

    // Fetch products from database
    const results = await collection.find({
      $or: [
        { product_id: { $in: allProductIds } },
        { sku: { $in: allProductIds } }
      ]
    }).toArray();

    // Preserve order from the embedding service
    const resultsById = new Map(results.map(doc => [doc.product_id || doc.sku, doc]));
    const orderedResults = allProductIds.map(id => resultsById.get(id)).filter(Boolean);

    res.json({
      total,
      results: orderedResults
    });

  } catch (err) {
    console.error('Image search error:', err);
    if (err.response) {
      console.error("Error from FastAPI service:", err.response.data);
      res.status(err.response.status || 500).json({ error: "Failed to process image search" });
    } else {
      res.status(500).json({ error: "Failed to process image search" });
    }
  }
});

// Connect to MongoDB and start server
async function startServer() {
  try {
    // Initialize Postgres Schema
    await initDb();

    // Connect to Mongo (still needed for products/search for now)
    await client.connect();
    const db = client.db("walmart");
    collection = db.collection("products");

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();