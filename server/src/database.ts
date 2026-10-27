import mongoose from 'mongoose';

export async function connectDatabase(uri: string | undefined): Promise<void> {
  if (!uri?.trim()) {
    throw new Error('MONGODB_URI is required.');
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  } catch {
    // Driver errors can contain connection details, so expose a safe message.
    throw new Error('MongoDB connection failed. Check your URI, credentials, and network access.');
  }
}
