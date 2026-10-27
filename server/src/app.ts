import express from 'express';
import { Session } from './models/session.js';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/sessions', async (req, res) => {
  const xName = req.body?.players?.X?.name;
  const oName = req.body?.players?.O?.name;

  if (typeof xName !== 'string' || !xName.trim()
    || typeof oName !== 'string' || !oName.trim()) {
    res.status(400).json({ error: 'Both player names are required.' });
    return;
  }

  try {
    const session = await Session.create({
      players: { X: { name: xName }, O: { name: oName } },
    });
    res.status(201).json(session);
  } catch {
    res.status(500).json({ error: 'Unable to create session.' });
  }
});
