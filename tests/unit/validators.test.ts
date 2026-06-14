describe('post validators', () => {
  it('rejects an empty post title', async () => {
    const { createPostSchema } = await import('../../src/validators/post.validator.js');

    const result = createPostSchema.safeParse({
      title: '',
      content: 'Some content'
    });

    expect(result.success).toBe(false);
  });

  it('rejects a whitespace-only post title', async () => {
    const { createPostSchema } = await import('../../src/validators/post.validator.js');

    const result = createPostSchema.safeParse({
      title: '   ',
      content: 'Some content'
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty post content', async () => {
    const { createPostSchema } = await import('../../src/validators/post.validator.js');

    const result = createPostSchema.safeParse({
      title: 'A valid title',
      content: ''
    });

    expect(result.success).toBe(false);
  });

  it('rejects a whitespace-only post content', async () => {
    const { createPostSchema } = await import('../../src/validators/post.validator.js');

    const result = createPostSchema.safeParse({
      title: 'A valid title',
      content: '   '
    });

    expect(result.success).toBe(false);
  });

  it('accepts a valid create post payload', async () => {
    const { createPostSchema } = await import('../../src/validators/post.validator.js');

    const result = createPostSchema.safeParse({
      title: 'Hello World',
      content: 'My first post'
    });

    expect(result.success).toBe(true);
  });

  it('updatePostSchema accepts partial payloads', async () => {
    const { updatePostSchema } = await import('../../src/validators/post.validator.js');

    const titleOnly = updatePostSchema.safeParse({ title: 'New title' });
    const contentOnly = updatePostSchema.safeParse({ content: 'New content' });

    expect(titleOnly.success).toBe(true);
    expect(contentOnly.success).toBe(true);
  });

  it('updatePostSchema rejects empty title', async () => {
    const { updatePostSchema } = await import('../../src/validators/post.validator.js');

    const result = updatePostSchema.safeParse({ title: '' });

    expect(result.success).toBe(false);
  });
});

describe('pagination validator', () => {
  it('coerces string page and limit to numbers', async () => {
    const { paginationSchema } = await import(
      '../../src/validators/pagination.validator.js'
    );

    const result = paginationSchema.safeParse({ page: '2', limit: '5' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(5);
    }
  });

  it('applies default page=1 and limit=10 for empty query', async () => {
    const { paginationSchema } = await import(
      '../../src/validators/pagination.validator.js'
    );

    const result = paginationSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
    }
  });

  it('rejects non-positive page', async () => {
    const { paginationSchema } = await import(
      '../../src/validators/pagination.validator.js'
    );

    const result = paginationSchema.safeParse({ page: '0', limit: '10' });

    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 100', async () => {
    const { paginationSchema } = await import(
      '../../src/validators/pagination.validator.js'
    );

    const result = paginationSchema.safeParse({ page: '1', limit: '101' });

    expect(result.success).toBe(false);
  });
});
