/**
 * HCEC Purchase Order — server.js
 * Lightweight, zero-dependency Express synchronization server.
 * Saves shared orders, vendors, ship-tos, and clerks to db.json.
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

// Dynamic fallback for CORS if needed, but keeping standard CORS
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to read database file securely
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error("Error reading database file:", err);
    return {};
  }
}

// Helper to write database file securely
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Error writing database file:", err);
    return false;
  }
}

// GET API endpoint: returns all shared lists and orders
app.get('/api/data', (req, res) => {
  const db = readDB();
  res.json({
    vendors: db.vendors || null,
    shiptos: db.shiptos || null,
    clerks: db.clerks || null,
    orders: db.orders || null,
  });
});

// POST API endpoint: saves shared collections
app.post('/api/save', (req, res) => {
  const { vendors, shiptos, clerks, orders } = req.body;
  const db = readDB();

  if (vendors !== undefined) db.vendors = vendors;
  if (shiptos !== undefined) db.shiptos = shiptos;
  if (clerks !== undefined) db.clerks = clerks;
  if (orders !== undefined) db.orders = orders;

  if (writeDB(db)) {
    res.json({ success: true, message: "Database updated successfully" });
  } else {
    res.status(500).json({ success: false, message: "Failed to write database file" });
  }
});

// GET API endpoint: serves secure sync configuration from the intranet UNC share or local fallback
app.get('/api/config', (req, res) => {
  const LOCAL_CONFIG = path.join(__dirname, 'sync_config.json');
  const UNC_CONFIG = '\\\\hcdc\\elect\\OfficeFiles\\User Shareable Folders\\Nate\'s Shareable Folder\\PurchaseFormConfig\\sync_config.json';

  console.log(`[CONFIG] /api/config requested.`);
  console.log(`[CONFIG] Checking Windows UNC network path: "${UNC_CONFIG}"`);

  // 1. Try UNC intranet network path first
  try {
    if (fs.existsSync(UNC_CONFIG)) {
      console.log(`[CONFIG] UNC path exists. Reading network config...`);
      const raw = fs.readFileSync(UNC_CONFIG, 'utf8');
      const parsed = JSON.parse(raw);
      console.log(`[CONFIG] UNC config read and parsed successfully!`);
      return res.json(parsed);
    } else {
      console.log(`[CONFIG] UNC path does NOT exist or is unreachable in this environment.`);
    }
  } catch (err) {
    console.error(`[CONFIG] Critical error reading UNC network path:`, err.message);
  }

  // 2. Try local fallback (not committed to Git)
  console.log(`[CONFIG] Checking local project fallback: "${LOCAL_CONFIG}"`);
  if (fs.existsSync(LOCAL_CONFIG)) {
    try {
      console.log(`[CONFIG] Local config exists. Reading local config...`);
      const raw = fs.readFileSync(LOCAL_CONFIG, 'utf8');
      const parsed = JSON.parse(raw);
      console.log(`[CONFIG] Local config read and parsed successfully!`);
      return res.json(parsed);
    } catch (err) {
      console.error(`[CONFIG] Critical error reading local config:`, err.message);
    }
  } else {
    console.log(`[CONFIG] Local fallback config does NOT exist.`);
  }

  // 3. Fallback/Not Found
  console.log(`[CONFIG] Configuration not found anywhere. Returning 404.`);
  res.status(404).json({ success: false, message: "Configuration file not found" });
});

// Serve static assets of the client-side app directly from root directory
app.use(express.static(__dirname));

// Listen on all network interfaces (0.0.0.0) so LAN computers can connect
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`   HCEC Purchase Order Sync Server is Running!`);
  console.log(`   Local Address: http://localhost:${PORT}`);
  console.log(`   LAN Share:     http://<YOUR_PC_IP_ADDRESS>:${PORT}`);
  console.log(`=======================================================`);
});
