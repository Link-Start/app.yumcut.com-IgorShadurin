const jsonSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
            required: ['code', 'message'],
          },
        },
        required: ['error'],
      },
    },
  },
};

const jsonResponse = (description: string, schema: Record<string, unknown> = jsonSchema) => ({
  description,
  content: {
    'application/json': { schema },
  },
});

const requestJson = (schema: Record<string, unknown> = jsonSchema) => ({
  required: true,
  content: {
    'application/json': { schema },
  },
});

const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: { type: 'string', minLength: 1, maxLength: 191 },
  description: 'Required for job-creating and token-costly writes. Reusing the same key replays the first successful response.',
};

const projectIdParam = {
  name: 'projectId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const characterSlugParam = {
  name: 'slug',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const userCharacterIdParam = {
  name: 'userCharacterId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const variationIdParam = {
  name: 'variationId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const channelIdParam = {
  name: 'channelId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const taskIdParam = {
  name: 'taskId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const templateIdParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const responses = {
  ok: jsonResponse('Success'),
  created: jsonResponse('Created'),
  accepted: jsonResponse('Accepted'),
  unauthorized: errorResponse,
  forbidden: errorResponse,
  notFound: errorResponse,
  validation: errorResponse,
  conflict: errorResponse,
};

function operation(input: {
  summary: string;
  description?: string;
  tags: string[];
  read?: boolean;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
}) {
  return {
    summary: input.summary,
    ...(input.description ? { description: input.description } : {}),
    tags: input.tags,
    security: [{ BearerAuth: [] }],
    'x-yumcut-scope': input.read === false ? 'write' : 'read',
    ...(input.parameters ? { parameters: input.parameters } : {}),
    ...(input.requestBody ? { requestBody: input.requestBody } : {}),
    responses: {
      200: responses.ok,
      400: responses.validation,
      401: responses.unauthorized,
      403: responses.forbidden,
      404: responses.notFound,
      ...(input.responses ?? {}),
    },
  };
}

function writeOperation(input: Omit<Parameters<typeof operation>[0], 'read'>) {
  return operation({ ...input, read: false });
}

function idempotentWriteOperation(input: Omit<Parameters<typeof operation>[0], 'read' | 'parameters'> & { parameters?: unknown[] }) {
  return writeOperation({
    ...input,
    parameters: [idempotencyHeader, ...(input.parameters ?? [])],
    responses: {
      409: responses.conflict,
      ...(input.responses ?? {}),
    },
  });
}

const settingsPatchSchema = {
  type: 'object',
  properties: {
    key: {
      type: 'string',
      enum: [
        'includeDefaultMusic',
        'addOverlay',
        'includeCallToAction',
        'projectEmailsEnabled',
        'autoApproveScript',
        'autoApproveAudio',
        'watermarkEnabled',
        'captionsEnabled',
        'characterCreationSettings',
        'defaultDurationSeconds',
        'sidebarOpen',
        'defaultUseScript',
        'characterContentTone',
        'targetLanguages',
        'scriptCreationGuidance',
        'scriptCreationGuidanceEnabled',
        'scriptAvoidanceGuidance',
        'scriptAvoidanceGuidanceEnabled',
        'audioStyleGuidance',
        'audioStyleGuidanceEnabled',
        'characterSelection',
        'preferredVoiceId',
        'languageVoicePreferences',
        'preferredTemplateId',
        'schedulerDefaultTimes',
        'schedulerCadence',
      ],
    },
    value: {},
  },
  required: ['key', 'value'],
  additionalProperties: false,
};

const projectCreateSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    rawScript: { type: 'string' },
    durationSeconds: { type: 'integer', minimum: 30 },
    languages: { type: 'array', items: { type: 'string' } },
    voiceId: { type: 'string' },
    projectExperience: { type: 'string', enum: ['story', 'character', 'image-generation'] },
    characterSlug: { type: 'string' },
    characterSelection: jsonSchema,
    imagePrank: jsonSchema,
    templateId: { type: 'string' },
    includeDefaultMusic: { type: 'boolean' },
    addOverlay: { type: 'boolean' },
    includeCallToAction: { type: 'boolean' },
    watermarkEnabled: { type: 'boolean' },
    captionsEnabled: { type: 'boolean' },
  },
  additionalProperties: true,
};

export const userApiOpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'YumCut User API',
    version: '1.0.0',
    description: 'Bearer-key API for account data, user settings, project creation, project status polling, and final media URLs. API keys are managed from the web account page.',
  },
  servers: [
    { url: '/api/user/v1', description: 'Current YumCut deployment' },
  ],
  tags: [
    { name: 'Account' },
    { name: 'Tokens' },
    { name: 'Settings' },
    { name: 'Projects' },
    { name: 'Media' },
    { name: 'Characters' },
    { name: 'Catalog' },
    { name: 'Publishing' },
    { name: 'Telegram' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'YumCut User API key',
        description: 'Use a key created from Account API keys. User API keys start with ycu_.',
      },
    },
    schemas: {
      Error: (errorResponse.content['application/json'] as any).schema,
      ProjectCreate: projectCreateSchema,
      SettingsPatch: settingsPatchSchema,
    },
  },
  paths: {
    '/account': {
      get: operation({
        summary: 'Get account',
        tags: ['Account'],
        responses: {
          200: jsonResponse('Account', {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: ['string', 'null'] },
              name: { type: ['string', 'null'] },
              image: { type: ['string', 'null'] },
              preferredLanguage: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              tokenBalance: { type: 'integer' },
              isGuest: { type: 'boolean' },
            },
          }),
        },
      }),
    },
    '/account/language': {
      get: operation({ summary: 'Get account language', tags: ['Account'] }),
      patch: writeOperation({
        summary: 'Update account language',
        tags: ['Account'],
        requestBody: requestJson({
          type: 'object',
          properties: { language: { type: 'string', enum: ['en', 'ru'] } },
          required: ['language'],
        }),
      }),
    },
    '/tokens': {
      get: operation({
        summary: 'Get token balance and cost table',
        tags: ['Tokens'],
      }),
    },
    '/tokens/history': {
      get: operation({
        summary: 'List token transactions',
        tags: ['Tokens'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1 } },
        ],
      }),
    },
    '/settings': {
      get: operation({
        summary: 'Get user settings',
        tags: ['Settings'],
      }),
      patch: writeOperation({
        summary: 'Update one user setting',
        tags: ['Settings'],
        requestBody: requestJson(settingsPatchSchema),
      }),
    },
    '/project-cost': {
      post: operation({
        summary: 'Quote project token cost',
        tags: ['Projects', 'Tokens'],
        requestBody: requestJson(projectCreateSchema),
      }),
    },
    '/projects': {
      get: operation({
        summary: 'List own projects',
        tags: ['Projects'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
      }),
      post: idempotentWriteOperation({
        summary: 'Create project',
        tags: ['Projects'],
        requestBody: requestJson(projectCreateSchema),
      }),
    },
    '/projects/{projectId}': {
      get: operation({
        summary: 'Get project detail',
        tags: ['Projects'],
        parameters: [projectIdParam],
      }),
      delete: writeOperation({
        summary: 'Cancel or delete own project',
        tags: ['Projects'],
        parameters: [projectIdParam],
      }),
    },
    '/projects/{projectId}/status': {
      get: operation({
        summary: 'Poll project status',
        tags: ['Projects'],
        parameters: [projectIdParam],
      }),
    },
    '/projects/{projectId}/stop': {
      post: writeOperation({
        summary: 'Stop own project',
        tags: ['Projects'],
        parameters: [projectIdParam],
      }),
    },
    '/projects/{projectId}/downloads/video': {
      get: operation({
        summary: 'Get final video download URL',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
      }),
    },
    '/projects/{projectId}/downloads/image': {
      get: operation({
        summary: 'Get final image download URL',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
      }),
    },
    '/projects/{projectId}/script/request': {
      post: idempotentWriteOperation({
        summary: 'Request script revision',
        tags: ['Projects'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/script/approve': {
      post: writeOperation({
        summary: 'Approve project script',
        tags: ['Projects'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/script/final': {
      post: writeOperation({
        summary: 'Update final script text',
        tags: ['Projects'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/audios': {
      get: operation({
        summary: 'List generated audios',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
      }),
    },
    '/projects/{projectId}/audios/request': {
      post: writeOperation({
        summary: 'Request voiceover generation',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/audios/approve': {
      post: writeOperation({
        summary: 'Approve voiceover',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/audios/regenerate': {
      post: idempotentWriteOperation({
        summary: 'Regenerate voiceover',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/images/regenerate': {
      post: idempotentWriteOperation({
        summary: 'Regenerate project image',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/images/replace': {
      post: writeOperation({
        summary: 'Replace project image',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/video/recreate': {
      post: idempotentWriteOperation({
        summary: 'Recreate final video',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/projects/{projectId}/image-prank-reuse': {
      get: operation({
        summary: 'Get reusable Image Prank source data',
        tags: ['Projects', 'Media'],
        parameters: [projectIdParam],
      }),
    },
    '/storage/upload-token': {
      post: writeOperation({
        summary: 'Create signed upload token',
        tags: ['Media'],
        requestBody: requestJson({
          type: 'object',
          properties: {
            ttlMs: { type: 'integer', minimum: 1000, maximum: 1800000 },
            maxBytes: { type: 'integer', minimum: 1, maximum: 10485760 },
          },
        }),
      }),
    },
    '/media/grant': {
      post: writeOperation({
        summary: 'Grant access to uploaded media',
        tags: ['Media'],
        requestBody: requestJson(),
      }),
    },
    '/voices': {
      get: operation({ summary: 'List voices', tags: ['Catalog'] }),
    },
    '/templates': {
      get: operation({
        summary: 'List public and own templates',
        tags: ['Catalog'],
        parameters: [
          { name: 'public', in: 'query', schema: { type: 'string', enum: ['1'] } },
          { name: 'mine', in: 'query', schema: { type: 'string', enum: ['1'] } },
        ],
      }),
    },
    '/templates/{id}': {
      get: operation({
        summary: 'Get template',
        tags: ['Catalog'],
        parameters: [templateIdParam],
      }),
    },
    '/image-pranks': {
      get: operation({ summary: 'List Image Prank catalog', tags: ['Catalog'] }),
    },
    '/groups': {
      post: idempotentWriteOperation({
        summary: 'Create project group',
        tags: ['Projects'],
        requestBody: requestJson(),
      }),
    },
    '/characters': {
      get: operation({ summary: 'List catalog and own characters', tags: ['Characters'] }),
    },
    '/characters/{slug}': {
      get: operation({
        summary: 'Get catalog character profile',
        tags: ['Characters'],
        parameters: [characterSlugParam],
      }),
    },
    '/characters/{slug}/favorite': {
      post: writeOperation({
        summary: 'Favorite catalog character',
        tags: ['Characters'],
        parameters: [characterSlugParam],
      }),
      delete: writeOperation({
        summary: 'Remove catalog character favorite',
        tags: ['Characters'],
        parameters: [characterSlugParam],
      }),
    },
    '/characters/custom/upload': {
      post: writeOperation({
        summary: 'Upload custom character image',
        tags: ['Characters', 'Media'],
        requestBody: requestJson(),
      }),
    },
    '/characters/custom/generate': {
      post: idempotentWriteOperation({
        summary: 'Generate custom character image',
        tags: ['Characters', 'Media'],
        requestBody: requestJson(),
      }),
    },
    '/characters/mine': {
      post: writeOperation({
        summary: 'Create own character',
        tags: ['Characters'],
        requestBody: requestJson(),
      }),
    },
    '/characters/mine/{userCharacterId}/variations': {
      post: writeOperation({
        summary: 'Create own character variation',
        tags: ['Characters'],
        parameters: [userCharacterIdParam],
        requestBody: requestJson(),
      }),
    },
    '/characters/mine/{userCharacterId}/variations/{variationId}': {
      delete: writeOperation({
        summary: 'Delete own character variation',
        tags: ['Characters'],
        parameters: [userCharacterIdParam, variationIdParam],
      }),
    },
    '/scheduler/settings': {
      get: operation({ summary: 'Get publishing scheduler settings', tags: ['Publishing'] }),
      post: writeOperation({
        summary: 'Update publishing scheduler settings',
        tags: ['Publishing'],
        requestBody: requestJson(),
      }),
      patch: writeOperation({
        summary: 'Update publishing scheduler settings',
        tags: ['Publishing'],
        requestBody: requestJson(),
      }),
    },
    '/scheduler/channels': {
      post: writeOperation({
        summary: 'Connect publishing channel',
        tags: ['Publishing'],
        requestBody: requestJson(),
      }),
    },
    '/scheduler/channels/{channelId}': {
      delete: writeOperation({
        summary: 'Delete publishing channel',
        tags: ['Publishing'],
        parameters: [channelIdParam],
      }),
    },
    '/scheduler/channels/{channelId}/revoke': {
      post: writeOperation({
        summary: 'Revoke publishing channel credentials',
        tags: ['Publishing'],
        parameters: [channelIdParam],
      }),
    },
    '/scheduler/projects/{projectId}': {
      post: idempotentWriteOperation({
        summary: 'Schedule project publishing',
        tags: ['Publishing'],
        parameters: [projectIdParam],
        requestBody: requestJson(),
      }),
    },
    '/scheduler/tasks/{taskId}/cleanup-request': {
      post: writeOperation({
        summary: 'Request scheduled task cleanup',
        tags: ['Publishing'],
        parameters: [taskIdParam],
      }),
    },
    '/telegram/account': {
      get: operation({ summary: 'Get linked Telegram account', tags: ['Telegram'] }),
      delete: writeOperation({ summary: 'Unlink Telegram account', tags: ['Telegram'] }),
    },
    '/telegram/link-token': {
      post: writeOperation({
        summary: 'Create Telegram link token',
        tags: ['Telegram'],
      }),
    },
  },
} as const;
