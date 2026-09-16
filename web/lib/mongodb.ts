// lib/mongodb.ts
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

// In dev, Next.js hot-reloads modules on every request, which would
// otherwise open a fresh MongoDB connection each time. Caching the
// connection promise on the global object lets it survive those reloads.
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // No HMR concerns in production — one client per server instance is fine.
  const client = new MongoClient(uri);
  clientPromise = client.connect();
}

export default clientPromise;
