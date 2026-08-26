import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL;
const QUERY_URL = process.env.QUERY_URL;

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
  const t0 = Date.now();
  const id = req.params.id;
  try {
    const product = await collection.findOne({
      $or: [
        { product_id: id },
        { sku: id }
      ]
    });
    const t1 = Date.now();
    if (product) {
      res.set('X-Timing', JSON.stringify({ mongo_lookup_ms: t1 - t0, total_ms: t1 - t0 }));
      res.json(product);
    } else {
      res.set('X-Timing', JSON.stringify({ mongo_lookup_ms: t1 - t0, total_ms: t1 - t0 }));
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Proxy endpoint for getting product ids
app.post('/api/embed', express.json(), async (req, res) => {
  const t_total = Date.now();
  const query = req.query.q;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    // 1. Get ALL relevant product IDs from the embedding service
    const t1 = Date.now();
    const response = await axios.post(`${QUERY_URL}/embed-text`, { query });
    const allProductIds = response.data.products;
    const t2 = Date.now();

    if (!allProductIds || allProductIds.length === 0) {
      const t3 = Date.now();
      console.log(`[TIMING] /api/embed | fastapi_call: ${t2-t1}ms | mongo_lookup: 0ms | total: ${t3-t1}ms | results: 0`);
      return res.json({
        total: 0,
        page,
        limit,
        results: []
      });
    }

    const total = allProductIds.length;

    // 2. Fetch only the documents for the current page in a SINGLE database query
    const t3 = Date.now();
    const results = await collection.find({
      $or: [
        { product_id: { $in: allProductIds } },
        { sku: { $in: allProductIds } }
      ]
    }).toArray();

    // Preserve the order from the embedding service
    const resultsById = new Map(results.map(doc => [doc.product_id || doc.sku, doc]));
    const orderedResults = allProductIds.map(id => resultsById.get(id)).filter(Boolean);
    const t4 = Date.now();

    console.log(
      `[TIMING] /api/embed | fastapi_call: ${t2-t1}ms | mongo_lookup: ${t4-t3}ms | total: ${t4-t_total}ms | results: ${orderedResults.length}`
    );

    res.set('X-Timing', JSON.stringify({
      fastapi_call_ms: t2 - t1,
      mongo_lookup_ms: t4 - t3,
      total_ms: t4 - t_total,
      results: orderedResults.length
    }));

    res.json({
      total,
      results: orderedResults
    });

  } catch (err) {
    const t_err = Date.now();
    console.error(`[TIMING] /api/embed | FAILED after ${t_err - t_total}ms | error: ${err.message}`);
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
  const t_total = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Convert image to base64 for the AI service
    const base64Image = req.file.buffer.toString('base64');
    const t1 = Date.now();
    const image_type = req.file.mimetype;

    // Call the AI service for image search
    const response = await axios.post(`${QUERY_URL}/embed-image`, {
      image: base64Image,
      image_type: image_type
    });
    const t2 = Date.now();

    const allProductIds = response.data.products;

    if (!allProductIds || allProductIds.length === 0) {
      console.log(`[TIMING] /api/image-search | fastapi_call: ${t2-t1}ms | mongo_lookup: 0ms | total: ${t2-t_total}ms | results: 0`);
      return res.json({
        total: 0,
        results: []
      });
    }

    const total = allProductIds.length;

    // Fetch products from database
    const t3 = Date.now();
    const results = await collection.find({
      $or: [
        { product_id: { $in: allProductIds } },
        { sku: { $in: allProductIds } }
      ]
    }).toArray();

    // Preserve order from the embedding service
    const resultsById = new Map(results.map(doc => [doc.product_id || doc.sku, doc]));
    const orderedResults = allProductIds.map(id => resultsById.get(id)).filter(Boolean);
    const t4 = Date.now();

    console.log(
      `[TIMING] /api/image-search | fastapi_call: ${t2-t1}ms | mongo_lookup: ${t4-t3}ms | total: ${t4-t_total}ms | results: ${orderedResults.length}`
    );

    res.set('X-Timing', JSON.stringify({
      fastapi_call_ms: t2 - t1,
      mongo_lookup_ms: t4 - t3,
      total_ms: t4 - t_total,
      results: orderedResults.length
    }));

    res.json({
      total,
      results: orderedResults
    });

  } catch (err) {
    const t_err = Date.now();
    console.error(`[TIMING] /api/image-search | FAILED after ${t_err - t_total}ms | error: ${err.message}`);
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
    await client.connect();
    const db = client.db("walmart");
    collection = db.collection("products");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

startServer();