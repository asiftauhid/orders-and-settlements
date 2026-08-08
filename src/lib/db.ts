import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Next.js reuses modules across requests in dev (hot reload) and across
 * serverless function invocations on Vercel can reuse the same container.
 * Without caching the connection on `global`, every request could open a
 * new MongoDB connection and eventually exhaust Atlas's connection limit.
 */
declare global {
  var mongooseConnection: Promise<typeof mongoose> | undefined;
}

export function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!global.mongooseConnection) {
    global.mongooseConnection = mongoose.connect(MONGODB_URI);
  }

  return global.mongooseConnection;
}
