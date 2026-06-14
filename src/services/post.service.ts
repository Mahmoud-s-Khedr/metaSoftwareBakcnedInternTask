import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';

type CreatePostInput = {
  title: string;
  content: string;
  authorId: string;
};

type UpdatePostInput = {
  title?: string;
  content?: string;
};

const safeAuthorSelect = {
  id: true,
  name: true,
  email: true
} as const;

const listPosts = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: safeAuthorSelect
        }
      }
    }),
    prisma.post.count()
  ]);

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const createPost = async (input: CreatePostInput) => {
  const post = await prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      authorId: input.authorId
    },
    include: {
      author: {
        select: safeAuthorSelect
      }
    }
  });

  return { post };
};

const updatePost = async (postId: string, requesterId: string, input: UpdatePostInput) => {
  const existingPost = await prisma.post.findUnique({
    where: { id: postId }
  });

  if (!existingPost) {
    throw new AppError('Post not found', 404);
  }

  if (existingPost.authorId !== requesterId) {
    throw new AppError('You are not authorized to update this post', 403);
  }

  const post = await prisma.post.update({
    where: { id: postId },
    data: input,
    include: {
      author: {
        select: safeAuthorSelect
      }
    }
  });

  return { post };
};

const deletePost = async (postId: string, requesterId: string) => {
  const existingPost = await prisma.post.findUnique({
    where: { id: postId }
  });

  if (!existingPost) {
    throw new AppError('Post not found', 404);
  }

  if (existingPost.authorId !== requesterId) {
    throw new AppError('You are not authorized to delete this post', 403);
  }

  await prisma.post.delete({
    where: { id: postId }
  });
};

export const postService = {
  listPosts,
  createPost,
  updatePost,
  deletePost
} as const;
