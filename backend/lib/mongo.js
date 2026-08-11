const { MongoClient } = require('mongodb');

const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const MONGODB_DB = String(process.env.MONGODB_DB || 'japano').trim();
const MONGO_ENABLED = Boolean(MONGODB_URI);

let client = null;
let connectPromise = null;
let runtimeDisabled = false;
let lastConnectionError = null;

function getClient() {
  if (!MONGO_ENABLED || runtimeDisabled) return null;
  if (!client) client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  if (!connectPromise) {
    connectPromise = client.connect().catch(async (error) => {
      // MongoDB is optional for the demo.  A stale cloud URI or a temporary
      // DNS/network outage must not prevent the API/Admin from starting with
      // its local JSON data source.
      connectPromise = null;
      runtimeDisabled = true;
      lastConnectionError = error;
      const failedClient = client;
      client = null;
      try { await failedClient?.close(); } catch { /* best-effort cleanup */ }
      throw error;
    });
  }
  return connectPromise.then(() => client);
}

async function getDb() {
  const c = await getClient();
  if (!c) return null;
  return c.db(MONGODB_DB);
}

function mongoEnabled() {
  return MONGO_ENABLED && !runtimeDisabled;
}

async function mongoHealth() {
  if (!MONGO_ENABLED) return { configured: false, online: false };
  if (runtimeDisabled) {
    return {
      configured: true,
      online: false,
      fallback: 'json',
      error: lastConnectionError?.message || 'MongoDB không khả dụng; backend đang dùng JSON cục bộ.',
    };
  }
  try {
    const db = await getDb();
    if (!db) return { configured: true, online: false, fallback: 'json' };
    await db.command({ ping: 1 });
    return { configured: true, online: true };
  } catch (error) {
    return { configured: true, online: false, error: error.message || String(error) };
  }
}

module.exports = { getDb, mongoEnabled, mongoHealth };
