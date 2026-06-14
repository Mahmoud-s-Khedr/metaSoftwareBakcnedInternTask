import { Router } from 'express';

import { postController } from '../controllers/post.controller.js';
import { documentedAuthMiddleware } from '../middlewares/auth.middleware.js';
import { documentedValidateMiddleware } from '../middlewares/validate.middleware.js';
import { createPostSchema, updatePostSchema } from '../validators/post.validator.js';
import { paginationSchema } from '../validators/pagination.validator.js';

const router = Router();

router.get(
  '/',
  documentedValidateMiddleware(paginationSchema, 'query'),
  postController.list
);

router.post(
  '/',
  documentedAuthMiddleware,
  documentedValidateMiddleware(createPostSchema),
  postController.create
);

router.put(
  '/:id',
  documentedAuthMiddleware,
  documentedValidateMiddleware(updatePostSchema),
  postController.update
);

router.delete('/:id', documentedAuthMiddleware, postController.remove);

export const postRouter = router;
