import { test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.ts';

test('GET /health returns HTTP 200 and a JSON status without a database connection', async () => {
  await request(app)
    .get('/health')
    .expect('Content-Type', /json/)
    .expect(200, { status: 'ok' });
});
