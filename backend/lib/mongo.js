const { MongoClient } = require('mongodb');

const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const MONGODB_DB = String(process.env.MONGODB_DB || 'japano').trim();
const MONGO_ENABLED = Boolean(MONGODB_URI);

let client = null;
let connectPromise = null;

function getClient() {
  if (!MONGO_ENABLED) return null;
  if (!client) client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  if (!connectPromise) connectPromise = client.connect().catch((error) => { connectPromise = null; throw error; });
  return connectPromise.then(() => client);
}

async function getDb() {
  const c = await getClient();
  if (!c) return null;
  return c.db(MONGODB_DB);
}

function mongoEnabled() {
  return MONGO_ENABLED;
}

async function mongoHealth() {
  if (!MONGO_ENABLED) return { configured: false, online: false };
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { configured: true, online: true };
  } catch (error) {
    return { configured: true, online: false, error: error.message || String(error) };
  }
}

module.exports = { getDb, mongoEnabled, mongoHealth };
