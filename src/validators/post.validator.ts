import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty'),
  content: z.string().trim().min(1, 'Content cannot be empty')
});

export const updatePostSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  content: z.string().trim().min(1, 'Content cannot be empty').optional()
});

export const postValidators = {
  createPostSchema,
  updatePostSchema
} as const;
