import { createRequire } from 'node:module';
import { describe, it } from 'vitest';
import rule from '../rules/billing-fhir-client-only';

// ESLint 8 ships no types, and its RuleTester is the one that runs the repo's lint.
const require = createRequire(import.meta.url);
const { RuleTester } = require('eslint');

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const lines = (...code: string[]): string => code.join('\n');
const clinical = (line: number, column: number, name = 'createClinicalOystehrClient'): object => ({
  messageId: 'clinicalClient',
  data: { name },
  line,
  column,
});

ruleTester.run('billing-fhir-client-only', rule, {
  valid: [
    {
      name: 'the billing client',
      code: lines(
        "import { createBillingClient } from '../shared';",
        'const oystehr = createBillingClient(m2mToken, secrets);'
      ),
    },
    {
      name: 'a disabled call',
      code: lines(
        "import { createClinicalOystehrClient } from '../../shared/helpers';",
        '// eslint-disable-next-line billing-fhir-client-only -- reads the clinical encounter',
        'const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);'
      ),
    },
    {
      name: 'a factory named in a type',
      code: lines(
        "import { createClinicalOystehrClient } from '../../shared/helpers';",
        "import type { createEraReadClient } from '../shared';",
        'type MakeClient = typeof createClinicalOystehrClient | typeof createEraReadClient;'
      ),
    },
    {
      name: 'the SDK class as a type and for its error class',
      code: lines(
        "import Oystehr from '@oystehr/sdk';",
        'export const read = (oystehr: Oystehr): Promise<unknown> => oystehr.fhir.search({ resourceType: "Claim" });',
        "export const conflict = new Oystehr.OystehrSdkError({ message: 'precondition failed', code: 412 });"
      ),
    },
    {
      name: 'a class that is not the SDK client',
      code: lines("import Oystehr from './fake-sdk';", 'const client = new Oystehr();'),
    },
    {
      name: 'a parameter that happens to share a factory name',
      code: 'export const make = (createEraReadClient: () => unknown): unknown => createEraReadClient();',
    },
    {
      name: 'wrapTaskHandler choosing the billing client',
      code: lines(
        "import { wrapTaskHandler } from '../helpers';",
        "import { createBillingClient } from '../../../billing/shared';",
        "export const index = wrapTaskHandler('sub-x', handler, { retry: true, createClient: createBillingClient });"
      ),
    },
  ],
  invalid: [
    {
      name: 'each call of a clinical factory, not the import',
      code: lines(
        "import { createClinicalOystehrClient } from '../../shared/helpers';",
        'const encounterReader = createClinicalOystehrClient(m2mToken, secrets);',
        'const noticeReader = createClinicalOystehrClient(m2mToken, secrets);'
      ),
      errors: [clinical(2, 25), clinical(3, 22)],
    },
    {
      name: 'a disable comment covers only the call under it',
      code: lines(
        "import { createClinicalOystehrClient } from '../../shared/helpers';",
        '// eslint-disable-next-line billing-fhir-client-only -- reads the clinical encounter',
        'const encounterReader = createClinicalOystehrClient(m2mToken, secrets);',
        'const noticeReader = createClinicalOystehrClient(m2mToken, secrets);'
      ),
      errors: [clinical(4, 22)],
    },
    {
      name: 'a call inside a multi-line call, on its own line',
      code: lines(
        "import { createBillingClient } from '../shared';",
        "import { createClinicalOystehrClient } from '../../shared/helpers';",
        'const owners = await listWorkQueueOwners(',
        '  createBillingClient(m2mToken, secrets),',
        '  createClinicalOystehrClient(m2mToken, secrets)',
        ');'
      ),
      errors: [clinical(5, 3)],
    },
    {
      name: 'an aliased import',
      code: lines(
        "import { createClinicalOystehrClient as makeClient } from '../../shared/helpers';",
        'const oystehr = makeClient(m2mToken, secrets);'
      ),
      errors: [clinical(2, 17)],
    },
    {
      name: 'a namespace import',
      code: lines(
        "import * as helpers from '../../shared/helpers';",
        'const oystehr = helpers.createClinicalOystehrClient(m2mToken, secrets);',
        "const other = helpers['createClinicalOystehrClient'](m2mToken, secrets);"
      ),
      errors: [clinical(2, 17), clinical(3, 15)],
    },
    {
      name: 'a factory passed on rather than called',
      code: lines(
        "import { wrapTaskHandler } from '../helpers';",
        "import { createClinicalOystehrClient } from '../../../shared/helpers';",
        "export const index = wrapTaskHandler('sub-x', handler, { createClient: createClinicalOystehrClient });"
      ),
      errors: [clinical(3, 72)],
    },
    {
      name: "utils' clinical factory",
      code: lines(
        "import { createOystehrClient } from 'utils/lib/helpers/helpers';",
        'const oystehr = createOystehrClient(token, fhirApi, projectApi);'
      ),
      errors: [clinical(2, 17, 'createOystehrClient')],
    },
    {
      name: 'the unscoped factory',
      code: lines(
        "import { createBillingClient, createEraReadClient } from '../shared';",
        'const eraReadClient = createEraReadClient(m2mToken, secrets);'
      ),
      errors: [{ messageId: 'unscopedClient', data: { name: 'createEraReadClient' }, line: 2, column: 23 }],
    },
    {
      name: 'a factory called in the module that declares it',
      code: lines(
        'export function createEraReadClient(token: string): unknown {',
        '  return token;',
        '}',
        "export const sweeper = createEraReadClient('token');"
      ),
      errors: [{ messageId: 'unscopedClient', line: 4, column: 24 }],
    },
    {
      name: 'constructing the SDK client, under any name',
      code: lines(
        "import Oystehr from '@oystehr/sdk';",
        "import { default as Sdk } from '@oystehr/sdk';",
        'const first = new Oystehr({ accessToken: token });',
        'const second = new Sdk({ accessToken: token });'
      ),
      errors: [
        { messageId: 'sdkClient', data: { name: 'Oystehr' }, line: 3, column: 15 },
        { messageId: 'sdkClient', data: { name: 'Sdk' }, line: 4, column: 16 },
      ],
    },
    {
      name: 'wrapTaskHandler left on its clinical default',
      code: lines(
        "import { wrapTaskHandler } from '../helpers';",
        "import * as task from '../helpers';",
        "export const first = wrapTaskHandler('sub-a', handler);",
        "export const second = wrapTaskHandler('sub-b', handler, { retry: true });",
        "export const third = wrapTaskHandler('sub-c', handler, options);",
        "export const fourth = task.wrapTaskHandler('sub-d', handler);"
      ),
      errors: [
        { messageId: 'taskHandlerClient', line: 3, column: 22 },
        { messageId: 'taskHandlerClient', line: 4, column: 23 },
        { messageId: 'taskHandlerClient', line: 5, column: 22 },
        { messageId: 'taskHandlerClient', line: 6, column: 23 },
      ],
    },
  ],
});
