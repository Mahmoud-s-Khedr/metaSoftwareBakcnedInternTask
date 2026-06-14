import type express from 'express';
import type { AnyZodObject } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  AUTH_METADATA,
  documentedAuthMiddleware
} from '../middlewares/auth.middleware.js';
import {
  documentedValidateMiddleware,
  VALIDATION_METADATA,
  type ValidationMetadata
} from '../middlewares/validate.middleware.js';

type DocumentableMiddleware = express.RequestHandler & {
  [AUTH_METADATA]?: {
    securityScheme: 'bearerAuth';
  };
  [VALIDATION_METADATA]?: ValidationMetadata;
};

type RouteDefinition = {
  method: string;
  path: string;
  handlers: DocumentableMiddleware[];
  tag: string;
};

type RouterLayer = {
  handle?: express.Router | DocumentableMiddleware;
  name?: string;
  regexp?: RegExp;
  route?: {
    path: string;
    stack: Array<{
      handle: DocumentableMiddleware;
      method?: string;
    }>;
    methods: Record<string, boolean>;
  };
};

type RouterLike = {
  stack?: RouterLayer[];
};

type SchemaObject = Record<string, unknown>;
type ParameterObject = Record<string, unknown>;
type RequestBodyObject = Record<string, unknown>;
type ResponsesObject = Record<string, unknown>;
type PathsObject = Record<string, Record<string, unknown>>;
type DocumentObject = Record<string, unknown>;


const successEnvelopeSchema = {
  type: 'object',
  required: ['success', 'message'],
  properties: {
    success: {
      type: 'boolean',
      enum: [true]
    },
    message: {
      type: 'string'
    },
    data: {
      type: 'object',
      additionalProperties: true
    }
  }
} satisfies SchemaObject;

const errorEnvelopeSchema = {
  type: 'object',
  required: ['success', 'message', 'errors'],
  properties: {
    success: {
      type: 'boolean',
      enum: [false]
    },
    message: {
      type: 'string'
    },
    errors: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  }
} satisfies SchemaObject;

const safeUserSchema = {
  type: 'object',
  required: ['id', 'name', 'email', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
} satisfies SchemaObject;

const authTokensSchema = {
  type: 'object',
  required: ['user', 'accessToken', 'refreshToken'],
  properties: {
    user: safeUserSchema,
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' }
  }
} satisfies SchemaObject;

const registerResponseSchema = {
  allOf: [
    successEnvelopeSchema,
    {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          required: ['user'],
          properties: {
            user: safeUserSchema
          }
        }
      }
    }
  ]
} satisfies SchemaObject;

const authResponseSchema = {
  allOf: [
    successEnvelopeSchema,
    {
      type: 'object',
      properties: {
        data: authTokensSchema
      }
    }
  ]
} satisfies SchemaObject;

const messageOnlyResponseSchema = {
  allOf: [
    successEnvelopeSchema,
    {
      type: 'object',
      properties: {
        data: {
          nullable: true
        }
      }
    }
  ]
} satisfies SchemaObject;

const healthResponseSchema = {
  type: 'object',
  required: ['success', 'message'],
  properties: {
    success: {
      type: 'boolean',
      enum: [true]
    },
    message: {
      type: 'string',
      example: 'API is healthy'
    }
  }
} satisfies SchemaObject;

const defaultExamples: Record<string, Record<string, unknown>> = {
  'post:/auth/register': {
    request: {
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123'
    },
    response: {
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: 'usr_123',
          name: 'Test User',
          email: 'user@example.com',
          createdAt: '2026-06-14T00:00:00.000Z',
          updatedAt: '2026-06-14T00:00:00.000Z'
        }
      }
    }
  },
  'post:/auth/login': {
    request: {
      email: 'user@example.com',
      password: 'password123'
    },
    response: {
      success: true,
      message: 'User logged in successfully',
      data: {
        user: {
          id: 'usr_123',
          name: 'Test User',
          email: 'user@example.com',
          createdAt: '2026-06-14T00:00:00.000Z',
          updatedAt: '2026-06-14T00:00:00.000Z'
        },
        accessToken: 'jwt-access-token',
        refreshToken: 'opaque-refresh-token'
      }
    }
  },
  'post:/auth/refresh': {
    request: {
      refreshToken: 'opaque-refresh-token'
    },
    response: {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: {
          id: 'usr_123',
          name: 'Test User',
          email: 'user@example.com',
          createdAt: '2026-06-14T00:00:00.000Z',
          updatedAt: '2026-06-14T00:00:00.000Z'
        },
        accessToken: 'new-jwt-access-token',
        refreshToken: 'new-opaque-refresh-token'
      }
    }
  },
  'post:/auth/logout': {
    request: {
      refreshToken: 'opaque-refresh-token'
    },
    response: {
      success: true,
      message: 'User logged out successfully'
    }
  },
  'post:/auth/logout-all': {
    response: {
      success: true,
      message: 'All sessions revoked successfully'
    }
  },
  'get:/health': {
    response: {
      success: true,
      message: 'API is healthy'
    }
  }
};

const defaultErrorExamples = {
  400: {
    success: false,
    message: 'Validation failed',
    errors: ['email: Invalid email']
  },
  401: {
    success: false,
    message: 'Authorization token is invalid or expired',
    errors: []
  },
  404: {
    success: false,
    message: 'Route GET /missing-route not found',
    errors: []
  },
  409: {
    success: false,
    message: 'Email is already in use',
    errors: []
  }
} satisfies Record<number, unknown>;

const normalizePath = (path: string): string => {
  if (!path) {
    return '/';
  }

  const normalized = path.replace(/\/+/g, '/');
  if (normalized === '' || normalized === '/') {
    return '/';
  }

  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
};

const combinePaths = (prefix: string, path: string): string => {
  const combined = `${prefix}/${path}`.replace(/\/+/g, '/');
  return normalizePath(combined.startsWith('/') ? combined : `/${combined}`);
};

const getOperationKey = (method: string, path: string): string => {
  return `${method.toLowerCase()}:${path}`;
};

const buildSummary = (method: string, path: string): string => {
  return `${method.toUpperCase()} ${path}`;
};

const buildOperationId = (method: string, path: string): string => {
  const normalized = path
    .replace(/^\/+/, '')
    .replace(/[:/]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized === ''
    ? method.toLowerCase()
    : `${method.toLowerCase()}_${normalized}`;
};

const extractMountPath = (layer: RouterLayer): string => {
  if (!layer.regexp) {
    return '';
  }

  const source = layer.regexp.source
    .replace('\\/?(?=\\/|$)', '')
    .replace('(?=\\/|$)', '')
    .replace(/^\^\\\//, '/')
    .replace(/\$$/, '')
    .replace(/\\\//g, '/')
    .replace(/\\\./g, '.')
    .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ':param')
    .replace(/\(\?:\[\^\\\/]\+\?\)/g, ':param');

  if (source === '^' || source === '') {
    return '';
  }

  return source.startsWith('/') ? source : `/${source}`;
};

const toOpenApiSchema = (schema: AnyZodObject): SchemaObject => {
  const converted = zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none'
  });

  return ('$ref' in converted ? { allOf: [converted] } : converted) as SchemaObject;
};

const collectRoutes = (
  router: RouterLike,
  prefix = '',
  tag = 'default'
): RouteDefinition[] => {
  const stack = router.stack ?? [];
  const routes: RouteDefinition[] = [];

  for (const layer of stack) {
    if (layer.route) {
      const routePath = combinePaths(prefix, layer.route.path);
      const handlers = layer.route.stack.map((entry) => entry.handle);

      for (const method of Object.keys(layer.route.methods)) {
        routes.push({
          method,
          path: routePath,
          handlers,
          tag
        });
      }

      continue;
    }

    if (layer.name === 'router' && layer.handle) {
      const mountPath = extractMountPath(layer);
      const nextPrefix = combinePaths(prefix, mountPath);
      const nextTag = mountPath.replace(/^\/+/, '') || tag;
      routes.push(...collectRoutes(layer.handle as RouterLike, nextPrefix, nextTag));
    }
  }

  return routes;
};

const buildParameters = (
  route: RouteDefinition
): ParameterObject[] => {
  const parameters: ParameterObject[] = [];
  const seenNames = new Set<string>();

  const pathParameters = route.path.match(/:([A-Za-z0-9_]+)/g) ?? [];
  for (const parameter of pathParameters) {
    const name = parameter.slice(1);
    if (seenNames.has(name)) {
      continue;
    }

    seenNames.add(name);
    parameters.push({
      in: 'path',
      name,
      required: true,
      schema: {
        type: 'string'
      }
    });
  }

  for (const handler of route.handlers) {
    const metadata = handler[VALIDATION_METADATA];
    if (!metadata || metadata.target === 'body') {
      continue;
    }

    const schema = toOpenApiSchema(metadata.schema);
    const schemaProperties = schema.properties ?? {};
    const requiredProperties = new Set(
      Array.isArray(schema.required) ? schema.required : []
    );

    for (const [name, propertySchema] of Object.entries(schemaProperties)) {
      if (seenNames.has(name)) {
        continue;
      }

      seenNames.add(name);
      parameters.push({
        in: metadata.target,
        name,
        required:
          metadata.target === 'params' ? true : requiredProperties.has(name),
        schema: propertySchema as SchemaObject
      });
    }
  }

  return parameters;
};

const buildRequestBody = (
  route: RouteDefinition
): RequestBodyObject | undefined => {
  const validationMiddleware = route.handlers.find(
    (handler) => handler[VALIDATION_METADATA]?.target === 'body'
  );

  const metadata = validationMiddleware?.[VALIDATION_METADATA];
  if (!metadata) {
    return undefined;
  }

  const example = defaultExamples[getOperationKey(route.method, route.path)]?.request;

  return {
    required: true,
    content: {
      'application/json': {
        schema: toOpenApiSchema(metadata.schema),
        ...(example ? { example } : {})
      }
    }
  };
};

const buildResponseSchema = (route: RouteDefinition): SchemaObject => {
  const key = getOperationKey(route.method, route.path);

  switch (key) {
    case 'get:/health':
      return healthResponseSchema;
    case 'post:/auth/register':
      return registerResponseSchema;
    case 'post:/auth/login':
    case 'post:/auth/refresh':
      return authResponseSchema;
    case 'post:/auth/logout':
    case 'post:/auth/logout-all':
      return messageOnlyResponseSchema;
    default:
      return successEnvelopeSchema;
  }
};

const buildSuccessStatus = (route: RouteDefinition): `${number}` => {
  if (route.method.toLowerCase() === 'post' && route.path === '/auth/register') {
    return '201';
  }

  return '200';
};

const buildResponses = (
  route: RouteDefinition
): ResponsesObject => {
  const successStatus = buildSuccessStatus(route);
  const successExample = defaultExamples[getOperationKey(route.method, route.path)]?.response;

  const responses: ResponsesObject = {
    [successStatus]: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: buildResponseSchema(route),
          ...(successExample ? { example: successExample } : {})
        }
      }
    }
  };

  if (route.handlers.some((handler) => handler[VALIDATION_METADATA])) {
    responses['400'] = {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: errorEnvelopeSchema,
          example: defaultErrorExamples[400]
        }
      }
    };
  }

  if (route.handlers.some((handler) => handler[AUTH_METADATA])) {
    responses['401'] = {
      description: 'Authentication error',
      content: {
        'application/json': {
          schema: errorEnvelopeSchema,
          example: defaultErrorExamples[401]
        }
      }
    };
  }

  if (route.path.startsWith('/auth/')) {
    responses['409'] = {
      description: 'Conflict',
      content: {
        'application/json': {
          schema: errorEnvelopeSchema,
          example: defaultErrorExamples[409]
        }
      }
    };
  }

  return responses;
};

export const createSwaggerSpec = (
  app: express.Express
): DocumentObject => {
  const routes = collectRoutes((app as unknown as { _router?: RouterLike })._router ?? {});
  const paths: PathsObject = {};

  for (const route of routes) {
    if (route.path === '/docs' || route.path === '/docs.json') {
      continue;
    }

    const openApiPath = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    const pathItem = (paths[openApiPath] ??= {});
    const parameters = buildParameters(route);
    const requestBody = buildRequestBody(route);
    const protectedRoute = route.handlers.some((handler) => handler[AUTH_METADATA]);

    pathItem[route.method] = {
      tags: [route.tag],
      summary: buildSummary(route.method, openApiPath),
      operationId: buildOperationId(route.method, openApiPath),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      ...(protectedRoute ? { security: [{ bearerAuth: [] }] } : {}),
      responses: buildResponses(route)
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Personal Blogging Platform API',
      version: '1.0.0',
      description:
        'Auto-generated OpenAPI documentation derived from Express routes and Zod validators.'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        SuccessEnvelope: successEnvelopeSchema,
        ErrorEnvelope: errorEnvelopeSchema,
        SafeUser: safeUserSchema,
        AuthTokens: authTokensSchema
      }
    },
    paths
  };
};

export const swaggerInference = {
  documentedAuthMiddleware,
  documentedValidateMiddleware,
  collectRoutes
} as const;
