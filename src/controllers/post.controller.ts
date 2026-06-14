import type { Request, Response } from 'express';

import { postService } from '../services/post.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const list = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };

  const result = await postService.listPosts(page, limit);

  res.status(200).json({
    success: true,
    message: 'Posts retrieved successfully',
    data: result
  });
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await postService.createPost({
    title: req.body.title as string,
    content: req.body.content as string,
    authorId: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    data: result
  });
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await postService.updatePost(req.params['id'] as string, req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Post updated successfully',
    data: result
  });
});

const remove = asyncHandler(async (req: Request, res: Response) => {
  await postService.deletePost(req.params['id'] as string, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully'
  });
});

export const postController = {
  list,
  create,
  update,
  remove
} as const;
