import express from 'express';
import cookieParser from 'cookie-parser';
import { notFound, errorHandler } from './middleware/errors.js';
import auth from './routes/auth.js';
import dashboard from './routes/dashboard.js';
import lookups from './routes/lookups.js';
import machines from './routes/machines.js';
import alerts from './routes/alerts.js';
import workOrders from './routes/workOrders.js';
import parts from './routes/parts.js';
import users from './routes/users.js';
import ml from './routes/ml.js';
import explorer from './routes/explorer.js';
import simulate from './routes/simulate.js';
import ingest from './routes/ingest.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);                                   // behind the Next.js rewrite / a reverse proxy
  app.use(cookieParser());

  // device endpoint first, with its own small body limit (10 kB)
  app.use('/api/ingest', express.json({ limit: '10kb' }), ingest);

  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', auth);
  app.use('/api/dashboard', dashboard);
  app.use('/api/lookups', lookups);
  app.use('/api/machines', machines);
  app.use('/api/alerts', alerts);
  app.use('/api/work-orders', workOrders);
  app.use('/api/parts', parts);
  app.use('/api/users', users);
  app.use('/api/ml', ml);
  app.use('/api/explorer', explorer);
  app.use('/api/simulate', simulate);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
