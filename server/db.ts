import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

let MONGODB_URI = process.env.MONGODB_URI?.trim();

if (MONGODB_URI?.includes('=')) {
  const parts = MONGODB_URI.split('=');
  if (parts[0]?.trim() === 'MONGODB_URI') {
    const fullValue = parts.slice(1).join('=').trim();
    const whatsappIndex = fullValue.indexOf('WHATSAPP_API_KEY');
    MONGODB_URI = whatsappIndex > 0 
      ? fullValue.substring(0, whatsappIndex).trim()
      : fullValue;
  }
}

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

let cached: CachedConnection = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      console.log('✅ MongoDB connected successfully');
      return mongoose;
    }).catch((error) => {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

declare global {
  var mongoose: CachedConnection;
}
