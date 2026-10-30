import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import rule from '../rules/billing-fhir-client-only';

// ESLint 8 ships no types, and its RuleTester is the one that runs the repo's lint.
const require = createRequire(import.meta.url);
const { RuleTester } = require('eslint');

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// A small TypeScript project the cases are linted inside: the real SDK, the billing and clinical client
// modules and a wrapTaskHandler, standing in for packages/zambdas.
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: './tsconfig.json', tsconfigRootDir: fixtures },
});

const options = [
  {
    billingClient: { type: 'BillingOystehr', file: path.join(fixtures, 'billing.ts') },
    otherScopedClients: [
      { type: 'ClinicalOystehr', file: path.join(fixtures, 'clinical.ts') },
      { type: 'UnscopedOystehr', file: path.join(fixtures, 'billing.ts') },
    ],
  },
];
const remedy =
  'Use the billing client, typed BillingOystehr; if this really needs another, get one typed ClinicalOystehr or UnscopedOystehr from the function that makes it, and justify that.';

const lines = (...code: string[]): string => code.join('\n');
const valid = (name: string, code: string): object => ({
  name,
  code,
  options,
  filename: path.join(fixtures, 'file.ts'),
});
const invalid = (name: string, code: string, errors: object[]): object => ({
  ...(valid(name, code) as object),
  errors,
});
const error = (messageId: string, line: number, data: object = {}): object => ({ messageId, data, line });
const fhirUse = (line: number, client = 'Oystehr'): object => error('fhirUse', line, { client, remedy });
const handOff = (line: number, client = 'Oystehr'): object => error('clientHandOff', line, { client, remedy });
const acquired = (line: number, client: string): object => error('clientAcquired', line, { client });
const forged = (line: number, client: string): object => error('forgedClient', line, { client });
const taskHandler = (line: number, client: string): object => error('taskHandlerClient', line, { client });

ruleTester.run('billing-fhir-client-only', rule, {
  valid: [
    valid(
      'FHIR through the billing client',
      lines(
        "import { createBillingClient } from './billing';",
        'const oystehr = createBillingClient();',
        "export const claims = oystehr.fhir.search({ resourceType: 'Claim' });"
      )
    ),
    valid(
      'a helper that takes the billing client',
      lines(
        "import { BillingOystehr } from './billing';",
        'export const claims = (oystehr: BillingOystehr): Promise<unknown> =>',
        "  oystehr.fhir.search({ resourceType: 'Claim' });"
      )
    ),
    valid(
      'the billing client handed to other code',
      lines(
        "import { createBillingClient } from './billing';",
        'declare function readAll(oystehr: unknown): void;',
        'readAll(createBillingClient());'
      )
    ),
    valid(
      'a clinical client got under a justified exception, then used and handed on freely',
      lines(
        "import { createClinicalClient } from './clinical';",
        'declare function readAll(oystehr: unknown): void;',
        '// eslint-disable-next-line billing-fhir-client-only -- reads the clinical encounter',
        'const clinical = createClinicalClient();',
        "export const encounter = clinical.fhir.get({ resourceType: 'Encounter', id: 'e1' });",
        'readAll({ clinical });'
      )
    ),
    valid(
      'a helper that takes any branded client',
      lines(
        "import { BillingOystehr, UnscopedOystehr } from './billing';",
        "import { ClinicalOystehr } from './clinical';",
        'export const read = (oystehr: BillingOystehr | ClinicalOystehr | UnscopedOystehr): Promise<unknown> =>',
        "  oystehr.fhir.search({ resourceType: 'Claim' });"
      )
    ),
    valid(
      "an unbranded client's other services",
      lines(
        "import { createClient } from './billing';",
        "export const payer = createClient().rcm.getPayerByUrl({ url: 'payer' });"
      )
    ),
    valid(
      'the SDK class as a type and for its error class',
      lines(
        "import Oystehr from '@oystehr/sdk';",
        'export type Search = Oystehr["fhir"]["search"];',
        "export const conflict = new Oystehr.OystehrSdkError({ message: 'precondition failed', code: 412 });"
      )
    ),
    valid(
      'an assertion that only widens a branded client',
      lines(
        "import { BillingOystehr, createBillingClient } from './billing';",
        "import { ClinicalOystehr } from './clinical';",
        'export const either = createBillingClient() as BillingOystehr | ClinicalOystehr;'
      )
    ),
    valid(
      'wrapTaskHandler handing its handler the billing client',
      lines(
        "import { createBillingClient } from './billing';",
        "import { wrapTaskHandler } from './task-helpers';",
        'export const index = wrapTaskHandler(',
        "  'sub-x',",
        "  async (_input, oystehr) => void (await oystehr.fhir.search({ resourceType: 'Claim' })),",
        '  { createClient: createBillingClient }',
        ');'
      )
    ),
    valid(
      'wrapTaskHandler handing its handler the clinical client under a justified exception',
      lines(
        "import { wrapTaskHandler } from './task-helpers';",
        '// eslint-disable-next-line billing-fhir-client-only -- reads the clinical encounter',
        "export const index = wrapTaskHandler('sub-x', async (_input, oystehr) => {",
        "  await oystehr.fhir.search({ resourceType: 'Encounter' });",
        '});'
      )
    ),
  ],
  invalid: [
    invalid(
      'getting a branded client that is not the billing one',
      lines(
        "import { createUnscopedClient } from './billing';",
        "import { createClinicalClient } from './clinical';",
        'export const clinical = createClinicalClient();',
        'export const unscoped = createUnscopedClient();'
      ),
      [acquired(3, 'ClinicalOystehr'), acquired(4, 'UnscopedOystehr')]
    ),
    invalid(
      'a function that returns a branded client hands it to its callers, which get it',
      lines(
        "import { ClinicalOystehr, createClinicalClient } from './clinical';",
        'declare function fetchClinicalClient(): Promise<ClinicalOystehr>;',
        'export async function clinicalClientFor(_encounterId: string): Promise<ClinicalOystehr> {',
        '  return await fetchClinicalClient();',
        '}',
        'export const makeClinicalClient = (): ClinicalOystehr => createClinicalClient();',
        "export const later = clinicalClientFor('e1');",
        'export const made = makeClinicalClient();'
      ),
      [acquired(7, 'ClinicalOystehr'), acquired(8, 'ClinicalOystehr')]
    ),
    invalid(
      "FHIR through a client from a helper whose type doesn't say what it can see",
      lines(
        "import { createClient } from './billing';",
        'const client = createClient();',
        "export const encounters = client.fhir.search({ resourceType: 'Encounter' });"
      ),
      [fhirUse(3)]
    ),
    invalid(
      'FHIR through a freshly made client, under any import name',
      lines(
        "import Sdk from '@oystehr/sdk';",
        "export const patients = new Sdk({ accessToken: 'token' }).fhir.search({ resourceType: 'Patient' });"
      ),
      [fhirUse(2)]
    ),
    invalid(
      'a helper that takes any client',
      lines(
        "import Oystehr from '@oystehr/sdk';",
        'export const patients = (oystehr: Oystehr): Promise<unknown> =>',
        "  oystehr.fhir.search({ resourceType: 'Patient' });"
      ),
      [fhirUse(3)]
    ),
    invalid(
      'a helper that takes the billing client or any other',
      lines(
        "import Oystehr from '@oystehr/sdk';",
        "import { BillingOystehr } from './billing';",
        'export const patients = (oystehr: BillingOystehr | Oystehr): Promise<unknown> =>',
        "  oystehr.fhir.search({ resourceType: 'Patient' });"
      ),
      [fhirUse(4, 'BillingOystehr | Oystehr')]
    ),
    invalid(
      'a look-alike of the billing client type, declared outside its module',
      lines(
        "import Oystehr from '@oystehr/sdk';",
        'interface BillingOystehr extends Oystehr {',
        '  readonly billing: true;',
        '}',
        'export const claims = (oystehr: BillingOystehr): Promise<unknown> =>',
        "  oystehr.fhir.search({ resourceType: 'Claim' });"
      ),
      [fhirUse(6, 'BillingOystehr')]
    ),
    invalid(
      'the FHIR service destructured, or reached by a computed key',
      lines(
        "import { createClient } from './billing';",
        'const { fhir } = createClient();',
        "export const encounters = createClient()['fhir'];"
      ),
      [fhirUse(2), fhirUse(3)]
    ),
    invalid(
      'FHIR through a client typed any',
      lines('declare const client: any;', "export const patients = client.fhir.search({ resourceType: 'Patient' });"),
      [error('untypedFhirUse', 2, { remedy })]
    ),
    invalid(
      "a client whose type doesn't say what it can see, handed to other code",
      lines(
        "import { createClient } from './billing';",
        'declare function readAll(oystehr: unknown): void;',
        'declare function compute(context: object): void;',
        'const client = createClient();',
        'readAll(client);',
        'compute({ client, clients: [client] });',
        'export const make = (): unknown => createClient();',
        'export function remake(): unknown {',
        '  return createClient();',
        '}'
      ),
      [handOff(5), handOff(6), handOff(6), handOff(7), handOff(9)]
    ),
    invalid(
      'a value typed any where a client is expected',
      lines(
        "import Oystehr from '@oystehr/sdk';",
        "import { BillingOystehr } from './billing';",
        'declare const loose: any;',
        'declare function claimsFor(oystehr: BillingOystehr): void;',
        'declare function patientsFor(oystehr: Oystehr): void;',
        'claimsFor(loose);',
        'patientsFor(loose);',
        'export const typed: BillingOystehr = loose;'
      ),
      [
        error('untypedClient', 6, { client: 'BillingOystehr' }),
        error('untypedClient', 7, { client: 'Oystehr' }),
        error('untypedClient', 8, { client: 'BillingOystehr' }),
      ]
    ),
    invalid(
      'forging a branded client type',
      lines(
        "import Oystehr from '@oystehr/sdk';",
        "import { BillingOystehr } from './billing';",
        "import { ClinicalOystehr } from './clinical';",
        'declare const loose: any;',
        'export const forged = new Oystehr({}) as BillingOystehr;',
        'export const laundered = new Oystehr({}) as unknown as ClinicalOystehr;',
        'export const untyped = loose as BillingOystehr;',
        'export const isBilling = (oystehr: Oystehr): oystehr is BillingOystehr => !!oystehr;'
      ),
      [
        forged(5, 'BillingOystehr'),
        forged(6, 'ClinicalOystehr'),
        forged(7, 'BillingOystehr'),
        forged(8, 'BillingOystehr'),
      ]
    ),
    invalid(
      'a disable comment covers only the line under it',
      lines(
        "import { createClient } from './billing';",
        'const client = createClient();',
        '// eslint-disable-next-line billing-fhir-client-only -- reads the clinical encounter',
        "export const encounter = client.fhir.get({ resourceType: 'Encounter', id: 'e1' });",
        "export const patients = client.fhir.search({ resourceType: 'Patient' });"
      ),
      [fhirUse(5)]
    ),
    invalid(
      'wrapTaskHandler left on its clinical default, or given another client',
      lines(
        "import { createClient } from './billing';",
        "import { createClinicalClient } from './clinical';",
        "import { wrapTaskHandler } from './task-helpers';",
        "export const first = wrapTaskHandler('sub-a', async (_input, oystehr) => {",
        "  await oystehr.fhir.search({ resourceType: 'Encounter' });",
        '});',
        "export const second = wrapTaskHandler('sub-b', async () => undefined, { retry: true });",
        "export const third = wrapTaskHandler('sub-c', async () => undefined, { createClient: createClinicalClient });",
        'export const fourth = wrapTaskHandler(',
        "  'sub-d',",
        "  async (_input, oystehr) => void (await oystehr.fhir.search({ resourceType: 'Claim' })),",
        '  { createClient }',
        ');'
      ),
      [
        taskHandler(4, 'ClinicalOystehr'),
        taskHandler(7, 'ClinicalOystehr'),
        taskHandler(8, 'ClinicalOystehr'),
        taskHandler(9, 'Oystehr'),
        fhirUse(11),
      ]
    ),
  ],
});
