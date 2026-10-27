import express from 'express';
import mongoose from 'mongoose';
import { createRound, makeMove } from './domain/round.js';
import { Session } from './models/session.js';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/sessions/:id', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    res.status(400).json({ error: 'Invalid session ID.' });
    return;
  }

  try {
    const session = await Session.findById(req.params.id).lean();
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const latestRound = session.rounds.at(-1);
    if (!latestRound) {
      throw new Error('Session has no rounds.');
    }

    const roundState = latestRound.moves.reduce(
      (state, move) => makeMove(state, move.cellIndex),
      createRound(),
    );
    const finished = latestRound.result !== null;
    const xWins = session.rounds.filter((round) => round.result === 'X').length;
    const oWins = session.rounds.filter((round) => round.result === 'O').length;
    const draws = session.rounds.filter((round) => round.result === 'draw').length;

    res.status(200).json({
      _id: session._id,
      status: session.status,
      players: session.players,
      rounds: session.rounds,
      currentRound: {
        number: session.rounds.length,
        board: roundState.board,
        currentPlayer: finished ? null : roundState.currentPlayer,
        status: finished ? 'finished' : 'in_progress',
      },
      statistics: {
        X: { wins: xWins, losses: oWins, draws },
        O: { wins: oWins, losses: xWins, draws },
      },
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    });
  } catch {
    res.status(500).json({ error: 'Unable to retrieve session.' });
  }
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
