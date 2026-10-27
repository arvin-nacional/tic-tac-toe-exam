import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
}, { _id: false });

const moveSchema = new mongoose.Schema({
  player: { type: String, enum: ['X', 'O'], required: true },
  cellIndex: { type: Number, required: true, min: 0, max: 8, validate: Number.isInteger },
}, { _id: false });

const roundSchema = new mongoose.Schema({
  moves: { type: [moveSchema], default: [] },
  result: { type: String, enum: ['X', 'O', 'draw', null], default: null },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  players: {
    X: { type: playerSchema, required: true },
    O: { type: playerSchema, required: true },
  },
  status: { type: String, enum: ['active', 'completed'], default: 'active', required: true },
  rounds: { type: [roundSchema], default: () => [{ moves: [], result: null }] },
  createdAt: { type: Date, default: Date.now, required: true },
  completedAt: { type: Date, default: null },
}, { optimisticConcurrency: true });

export const Session = mongoose.model('Session', sessionSchema);
