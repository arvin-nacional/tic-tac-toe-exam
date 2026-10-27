import express from 'express';
import mongoose from 'mongoose';
import { createRound, getRoundResult, makeMove } from './domain/round.js';
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

app.post('/api/sessions/:id/moves', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    res.status(400).json({ error: 'Invalid session ID.' });
    return;
  }

  const player = req.body?.player;
  const cellIndex = req.body?.cellIndex;
  if (player !== 'X' && player !== 'O') {
    res.status(400).json({ error: 'Player must be X or O.' });
    return;
  }
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) {
    res.status(400).json({ error: 'Cell index must be an integer between 0 and 8.' });
    return;
  }

  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const latestRound = session.rounds.at(-1);
    if (!latestRound) {
      throw new Error('Session has no rounds.');
    }
    if (session.status !== 'active' || latestRound.result !== null) {
      res.status(409).json({ error: 'Session or round has ended.' });
      return;
    }

    const roundState = latestRound.moves.reduce(
      (state, move) => makeMove(state, move.cellIndex),
      createRound(),
    );
    if (player !== roundState.currentPlayer) {
      res.status(409).json({ error: 'It is not this player\'s turn.' });
      return;
    }

    // Validate against the reconstructed board before recording the move.
    let updatedRound;
    try {
      updatedRound = makeMove(roundState, cellIndex);
    } catch {
      res.status(409).json({ error: 'Cell is already occupied.' });
      return;
    }

    latestRound.moves.push({ player, cellIndex });
    latestRound.result = getRoundResult(updatedRound.board);
    await session.save();
    res.status(200).json(session);
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError) {
      res.status(409).json({ error: 'Session changed. Refresh and try again.' });
      return;
    }
    res.status(500).json({ error: 'Unable to save move.' });
  }
});

app.post('/api/sessions/:id/rounds', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    res.status(400).json({ error: 'Invalid session ID.' });
    return;
  }

  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const latestRound = session.rounds.at(-1);
    if (!latestRound) {
      throw new Error('Session has no rounds.');
    }
    if (session.status !== 'active') {
      res.status(409).json({ error: 'Session has ended.' });
      return;
    }
    if (latestRound.result === null) {
      res.status(409).json({ error: 'Current round is still in progress.' });
      return;
    }

    session.rounds.push({ moves: [], result: null });
    await session.save();
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError) {
      res.status(409).json({ error: 'Session changed. Refresh and try again.' });
      return;
    }
    res.status(500).json({ error: 'Unable to start a new round.' });
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
