import express from 'express';

import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { postRouter } from './routes/post.routes.js';
import {
  errorHandler,
  notFoundHandler
} from './middlewares/error.middleware.js';

export const createApp = (): express.Express => {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/posts', postRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
