import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { AD_HOC_REPORT_DEFAULT_MODEL, AdHocReportModel } from 'utils/lib/types/adhoc/generation/generate.types';
import { ADHOC_GENERATE_PARAMS_CODE } from 'utils/lib/types/adhoc/generation/report-task';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';

const { mockRequireUserWithRole, mockCreate } = vi.hoisted(() => ({
  mockRequireUserWithRole: vi.fn(),
  mockCreate: vi.fn(),
}));

// Run the handler directly: wrapHandler only adds Sentry and the top-level catch around it.
vi.mock('../../src/shared/sentry', () => ({
  wrapHandler: (_name: string, fn: (input: ZambdaInput) => Promise<APIGatewayProxyResult>) => fn,
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/auth')>()),
  requireUserWithRole: mockRequireUserWithRole,
  checkOrCreateM2MClientToken: async () => 'm2m-token',
}));

vi.mock('../../src/shared/helpers', () => ({
  createClinicalOystehrClient: () => ({ fhir: { create: mockCreate } }),
}));

import { index } from '../../src/ehr/generate-adhoc-report/index';

const handler = index as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const SCHEMA = { datasetId: 'encounters-comprehensive', label: 'Encounters', description: '', rowCount: 1, fields: [] };

const start = (model?: AdHocReportModel): Promise<APIGatewayProxyResult> =>
  handler({
    headers: { Authorization: 'Bearer user-token' },
    secrets: {},
    body: JSON.stringify({ schema: SCHEMA, request: 'count of encounters', ...(model ? { model } : {}) }),
  } as unknown as ZambdaInput);

// The model the generation Task carries: the subscription runs whatever is stored there.
const persistedModel = (): string | undefined => {
  const task = mockCreate.mock.calls[0][0] as Task;
  const params = task.input?.find((i) => i.type?.coding?.some((c) => c.code === ADHOC_GENERATE_PARAMS_CODE));
  return JSON.parse(params?.valueString ?? '{}').model;
};

const userWithRoles = (...roles: RoleType[]): { roles: { name: RoleType }[] } => ({
  roles: roles.map((name) => ({ name })),
});

describe('generate-adhoc-report: which model the generation Task gets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'task-1' });
  });

  it('keeps the requested model for an administrator who also has Customer Support', async () => {
    mockRequireUserWithRole.mockResolvedValue(userWithRoles(RoleType.Administrator, RoleType.CustomerSupport));

    const result = await start('claudeSonnet_5_5_medium');

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ taskId: 'task-1' });
    expect(persistedModel()).toBe('claudeSonnet_5_5_medium');
  });

  it('stores the default model for an administrator without Customer Support, whatever was requested', async () => {
    mockRequireUserWithRole.mockResolvedValue(userWithRoles(RoleType.Administrator));

    await start('claudeOpus_5_5_high');

    expect(persistedModel()).toBe(AD_HOC_REPORT_DEFAULT_MODEL);
  });

  it('stores the default model when a model picker asks for none', async () => {
    mockRequireUserWithRole.mockResolvedValue(userWithRoles(RoleType.Administrator, RoleType.CustomerSupport));

    await start();

    expect(persistedModel()).toBe(AD_HOC_REPORT_DEFAULT_MODEL);
  });
});
