import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SpecFile } from './schema';
import {
  AccessPolicyRule,
  discoverSpecFiles,
  evaluateZambdaAccess,
  serializeSpecFile,
  ZambdaAccessEvaluation,
} from './zambda-access';

const FHIR_RULE: AccessPolicyRule = { resource: ['FHIR:Patient'], action: ['FHIR:Read'], effect: 'Allow' };
const TELEMED_RULE: AccessPolicyRule = {
  resource: ['Telemed:Meeting:*'],
  action: ['Telemed:JoinMeeting'],
  effect: 'Allow',
};

const zambdaRule = (...names: string[]): AccessPolicyRule => ({
  resource: names.map((name) => `Zambda:Function:${name}`),
  action: ['Zambda:InvokeFunction'],
  effect: 'Allow',
});

const rolesFile = (roles: { [key: string]: unknown }): SpecFile => ({
  path: 'oystehr-core/roles.json',
  spec: { 'schema-version': '2025-09-25', roles },
});

const zambdasFile = (zambdas: { [key: string]: unknown }, filePath = 'oystehr-core/zambdas.json'): SpecFile => ({
  path: filePath,
  spec: { 'schema-version': '2025-09-25', zambdas },
});

const httpAuth = (name: string, access?: unknown): { [key: string]: unknown } => ({
  name,
  type: 'http_auth',
  ...(access === undefined ? {} : { access }),
});

/** The role chain the EHR uses: STAFF ⊂ CLINICIAN ⊂ PROVIDER ⊂ ADMINISTRATOR, plus PATIENT and INACTIVE. */
const chainRoles = (): SpecFile =>
  rolesFile({
    PATIENT: { name: 'Patient', accessPolicy: [zambdaRule('get-schedule'), TELEMED_RULE] },
    INACTIVE: { name: 'Inactive', accessPolicy: [{ resource: ['*'], action: ['*'], effect: 'Deny' }] },
    STAFF: { name: 'Staff', accessPolicy: [FHIR_RULE, zambdaRule('*')] },
    CLINICIAN: { name: 'Clinician', zambdaAccess: { inherits: ['STAFF'] }, accessPolicy: [FHIR_RULE, zambdaRule('*')] },
    PROVIDER: {
      name: 'Provider',
      zambdaAccess: { inherits: ['CLINICIAN'] },
      accessPolicy: [zambdaRule('*'), FHIR_RULE],
    },
    ADMINISTRATOR: {
      name: 'Administrator',
      zambdaAccess: { inherits: ['PROVIDER'] },
      accessPolicy: [FHIR_RULE, zambdaRule('*'), TELEMED_RULE, zambdaRule('*')],
    },
  });

const chainZambdas = (): SpecFile =>
  zambdasFile({
    'GET-SCHEDULE': httpAuth('get-schedule', ['PATIENT', 'STAFF']),
    'CHECK-IN': httpAuth('check-in', ['PATIENT']),
    'GET-APPOINTMENTS': httpAuth('get-appointments', ['STAFF']),
    'SIGN-NOTE': httpAuth('sign-note', ['PROVIDER']),
    'CREATE-USER': httpAuth('create-user', ['ADMINISTRATOR']),
    'INTERNAL-ONLY': httpAuth('internal-only', []),
    'PUBLIC-THING': { name: 'public-thing', type: 'http_open' },
    'NIGHTLY-JOB': { name: 'nightly-job', type: 'cron' },
    'ON-TASK': { name: 'on-task', type: 'subscription' },
  });

const policyOf = (evaluation: ZambdaAccessEvaluation, roleKey: string): unknown[] => {
  const roles = evaluation.roleFiles[0].spec.roles as { [key: string]: { accessPolicy: unknown[] } };
  return roles[roleKey].accessPolicy;
};

describe('zambda-access · grants', () => {
  it('grants a zambda to the declared roles and to every role that inherits from them', () => {
    const { failures, grants } = evaluateZambdaAccess([chainRoles(), chainZambdas()]);
    expect(failures).toEqual([]);
    expect(grants).toEqual({
      PATIENT: ['check-in', 'get-schedule'],
      INACTIVE: [],
      STAFF: ['get-appointments', 'get-schedule'],
      CLINICIAN: ['get-appointments', 'get-schedule'],
      PROVIDER: ['get-appointments', 'get-schedule', 'sign-note'],
      ADMINISTRATOR: ['create-user', 'get-appointments', 'get-schedule', 'sign-note'],
    });
  });

  it('never grants an "access": [] zambda to anyone, and ignores non-http_auth zambdas', () => {
    const { grants } = evaluateZambdaAccess([chainRoles(), chainZambdas()]);
    const everyGrant = Object.values(grants).flat();
    expect(everyGrant).not.toContain('internal-only');
    expect(everyGrant).not.toContain('public-thing');
    expect(everyGrant).not.toContain('nightly-job');
    expect(everyGrant).not.toContain('on-task');
  });

  it('follows inheritance transitively through several files and multiple parents', () => {
    const roles = rolesFile({
      STAFF: { name: 'Staff' },
      BILLING_ADMIN: { name: 'BillingAdmin' },
      MANAGER: { name: 'Manager', zambdaAccess: { inherits: ['STAFF'] } },
      ADMINISTRATOR: { name: 'Administrator', zambdaAccess: { inherits: ['MANAGER', 'BILLING_ADMIN'] } },
    });
    const core = zambdasFile({ A: httpAuth('a', ['STAFF']) });
    const billing = zambdasFile({ B: httpAuth('b', ['BILLING_ADMIN']) }, 'billing-app-core/zambdas.json');
    const { failures, grants } = evaluateZambdaAccess([roles, core, billing]);
    expect(failures).toEqual([]);
    expect(grants.ADMINISTRATOR).toEqual(['a', 'b']);
    expect(grants.MANAGER).toEqual(['a']);
    expect(grants.BILLING_ADMIN).toEqual(['b']);
    expect(grants.STAFF).toEqual(['a']);
  });
});

describe('zambda-access · generated access policy', () => {
  it('replaces the zambda rule in place, as one sorted rule, and leaves other rules untouched', () => {
    const evaluation = evaluateZambdaAccess([chainRoles(), chainZambdas()]);
    expect(evaluation.roleFiles).toHaveLength(1);
    expect(evaluation.roleFiles[0].changed).toBe(true);

    // PROVIDER: zambda rule was first → regenerated rule stays first.
    expect(policyOf(evaluation, 'PROVIDER')).toEqual([
      zambdaRule('get-appointments', 'get-schedule', 'sign-note'),
      FHIR_RULE,
    ]);
    // ADMINISTRATOR had the wildcard twice → collapsed into one rule at the first position.
    expect(policyOf(evaluation, 'ADMINISTRATOR')).toEqual([
      FHIR_RULE,
      zambdaRule('create-user', 'get-appointments', 'get-schedule', 'sign-note'),
      TELEMED_RULE,
    ]);
    // PATIENT: explicit list replaced with the declared one, Telemed rule kept.
    expect(policyOf(evaluation, 'PATIENT')).toEqual([zambdaRule('check-in', 'get-schedule'), TELEMED_RULE]);
    // INACTIVE: deny-all is not a zambda rule and gets no grant.
    expect(policyOf(evaluation, 'INACTIVE')).toEqual([{ resource: ['*'], action: ['*'], effect: 'Deny' }]);
  });

  it('appends the rule when a role had none, and adds no rule to a role with no grants', () => {
    const roles = rolesFile({
      STAFF: { name: 'Staff', accessPolicy: [FHIR_RULE] },
      AUDITOR: { name: 'Auditor', accessPolicy: [FHIR_RULE] },
      EMPTY: { name: 'Empty' },
    });
    const evaluation = evaluateZambdaAccess([roles, zambdasFile({ A: httpAuth('a', ['STAFF']) })]);
    expect(evaluation.failures).toEqual([]);
    expect(policyOf(evaluation, 'STAFF')).toEqual([FHIR_RULE, zambdaRule('a')]);
    expect(policyOf(evaluation, 'AUDITOR')).toEqual([FHIR_RULE]);
    const empty = (evaluation.roleFiles[0].spec.roles as { [key: string]: unknown }).EMPTY;
    expect(empty).toEqual({ name: 'Empty' });
  });

  it('reports nothing stale and no change when roles.json already matches', () => {
    const roles = rolesFile({
      STAFF: { name: 'Staff', accessPolicy: [FHIR_RULE, zambdaRule('a', 'b')] },
      PROVIDER: { name: 'Provider', zambdaAccess: { inherits: ['STAFF'] }, accessPolicy: [zambdaRule('a', 'b', 'c')] },
    });
    const zambdas = zambdasFile({
      B: httpAuth('b', ['STAFF']),
      A: httpAuth('a', ['STAFF']),
      C: httpAuth('c', ['PROVIDER']),
    });
    const evaluation = evaluateZambdaAccess([roles, zambdas]);
    expect(evaluation.failures).toEqual([]);
    expect(evaluation.stale).toEqual([]);
    expect(evaluation.roleFiles[0].changed).toBe(false);
    expect(evaluation.roleFiles[0].spec).toEqual(roles.spec);
  });

  it('does not mutate the input spec', () => {
    const roles = chainRoles();
    const before = JSON.stringify(roles.spec);
    evaluateZambdaAccess([roles, chainZambdas()]);
    expect(JSON.stringify(roles.spec)).toBe(before);
  });
});

describe('zambda-access · stale detection', () => {
  it('names the role, the missing zambdas and the extra ones (including wildcards)', () => {
    const roles = rolesFile({
      STAFF: { name: 'Staff', accessPolicy: [zambdaRule('*', 'gone')] },
    });
    const { stale, failures } = evaluateZambdaAccess([roles, zambdasFile({ A: httpAuth('a', ['STAFF']) })]);
    expect(failures).toEqual([]);
    expect(stale).toHaveLength(1);
    expect(stale[0]).toContain('role STAFF');
    expect(stale[0]).toContain('missing 1: a');
    expect(stale[0]).toContain('extra 2');
    expect(stale[0]).toContain('Zambda:Function:* (wildcard)');
    expect(stale[0]).toContain('gone');
  });

  it('flags grants split over several rules even when the set of zambdas is right', () => {
    const roles = rolesFile({
      STAFF: { name: 'Staff', accessPolicy: [zambdaRule('b'), FHIR_RULE, zambdaRule('a')] },
    });
    const zambdas = zambdasFile({ A: httpAuth('a', ['STAFF']), B: httpAuth('b', ['STAFF']) });
    const evaluation = evaluateZambdaAccess([roles, zambdas]);
    expect(evaluation.stale).toHaveLength(1);
    expect(evaluation.stale[0]).toContain('single sorted rule');
    expect(policyOf(evaluation, 'STAFF')).toEqual([zambdaRule('a', 'b'), FHIR_RULE]);
  });

  it('flags a stale grant to a zambda that no longer exists', () => {
    const roles = rolesFile({ STAFF: { name: 'Staff', accessPolicy: [zambdaRule('a', 'deleted-zambda')] } });
    const { stale } = evaluateZambdaAccess([roles, zambdasFile({ A: httpAuth('a', ['STAFF']) })]);
    expect(stale[0]).toContain('extra 1: deleted-zambda');
  });

  it('truncates long lists', () => {
    const names = Array.from({ length: 20 }, (_, i) => `z${String(i).padStart(2, '0')}`);
    const roles = rolesFile({ STAFF: { name: 'Staff' } });
    const zambdas = zambdasFile(
      Object.fromEntries(names.map((name) => [name.toUpperCase(), httpAuth(name, ['STAFF'])]))
    );
    const { stale } = evaluateZambdaAccess([roles, zambdas]);
    expect(stale[0]).toContain('missing 20:');
    expect(stale[0]).toContain('… and 12 more');
  });
});

describe('zambda-access · declaration failures', () => {
  const roles = (): SpecFile =>
    rolesFile({
      STAFF: { name: 'Staff' },
      PROVIDER: { name: 'Provider', zambdaAccess: { inherits: ['STAFF'] } },
    });

  const failuresFor = (zambdas: { [key: string]: unknown }): string[] =>
    evaluateZambdaAccess([roles(), zambdasFile(zambdas)]).failures;

  it('FAILS an http_auth zambda with no access declaration, and says how to fix it', () => {
    const failures = failuresFor({ NEW: httpAuth('new-thing') });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('zambda NEW ("new-thing")');
    expect(failures[0]).toContain('no "access" declaration');
    expect(failures[0]).toContain('Role keys: PROVIDER, STAFF');
  });

  it('FAILS access on a zambda that is not http_auth', () => {
    const failures = failuresFor({
      CRON: { name: 'cron-thing', type: 'cron', access: ['STAFF'] },
      OPEN: { name: 'open-thing', type: 'http_open', access: [] },
      SUB: { name: 'sub-thing', type: 'subscription' },
    });
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain('"cron" and must not declare "access"');
    expect(failures[1]).toContain('"http_open" and must not declare "access"');
  });

  it('FAILS malformed access values', () => {
    expect(failuresFor({ A: httpAuth('a', 'STAFF') })[0]).toContain('must be an array of role keys');
    expect(failuresFor({ A: httpAuth('a', [1]) })[0]).toContain('must be an array of role keys');
    expect(failuresFor({ A: httpAuth('a', null) })[0]).toContain('must be an array of role keys');
    // A malformed value is reported once, not also as "missing".
    expect(failuresFor({ A: httpAuth('a', 'STAFF') })).toHaveLength(1);
  });

  it('FAILS unknown, duplicate and redundant role keys', () => {
    expect(failuresFor({ A: httpAuth('a', ['NURSE']) })[0]).toContain('unknown role "NURSE"');
    expect(failuresFor({ A: httpAuth('a', ['STAFF', 'STAFF']) })[0]).toContain('lists "STAFF" more than once');
    const redundant = failuresFor({ A: httpAuth('a', ['STAFF', 'PROVIDER']) });
    expect(redundant).toHaveLength(1);
    expect(redundant[0]).toContain('"PROVIDER", which already inherits "STAFF"');
  });

  it('allows the same zambda in several env overlays when declared identically, and FAILS when it differs', () => {
    const overlay = (env: string, access?: string[]): SpecFile & { env: string } => ({
      env,
      ...zambdasFile(
        { CLEANUP: { name: 'test-env-cleanup', type: 'cron' }, PROBE: httpAuth('probe', access ?? ['STAFF']) },
        `oystehr/env/${env}/zambdas.json`
      ),
    });
    const same = evaluateZambdaAccess([roles(), overlay('local'), overlay('e2e'), overlay('staging')]);
    expect(same.failures).toEqual([]);
    expect(same.grants.STAFF).toEqual(['probe']);

    const different = evaluateZambdaAccess([roles(), overlay('local'), overlay('e2e', ['PROVIDER'])]);
    expect(different.failures).toHaveLength(1);
    expect(different.failures[0]).toContain('zambda PROBE ("probe")');
    expect(different.failures[0]).toContain('different type or "access"');

    // A shared file and an overlay are deployed together, so the same name there is a real clash.
    const shared = zambdasFile({ CLEANUP: { name: 'test-env-cleanup', type: 'cron' } });
    const clash = evaluateZambdaAccess([roles(), shared, overlay('local')]);
    expect(clash.failures).toHaveLength(1);
    expect(clash.failures[0]).toContain('same name as CLEANUP in oystehr-core/zambdas.json');
  });

  it('FAILS zambdas without a name or type, and duplicate names across files', () => {
    const noName = failuresFor({ A: { type: 'http_auth', access: ['STAFF'] } });
    expect(noName[0]).toContain('must have a non-empty "name"');
    const noType = failuresFor({ A: { name: 'a', access: ['STAFF'] } });
    expect(noType[0]).toContain('must have a "type"');

    const core = zambdasFile({ A: httpAuth('same-name', ['STAFF']) });
    const billing = zambdasFile({ B: httpAuth('same-name', ['STAFF']) }, 'billing-app-core/zambdas.json');
    const { failures } = evaluateZambdaAccess([roles(), core, billing]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('zambda B ("same-name") has the same name as A in oystehr-core/zambdas.json');
  });
});

describe('zambda-access · role declaration failures', () => {
  const zambdas = (): SpecFile => zambdasFile({ A: httpAuth('a', ['STAFF']) });

  it('FAILS unknown, self and duplicate inherits', () => {
    const unknown = evaluateZambdaAccess([
      rolesFile({ STAFF: { name: 'Staff', zambdaAccess: { inherits: ['NOPE'] } } }),
      zambdas(),
    ]);
    expect(unknown.failures[0]).toContain('inherits unknown role "NOPE"');
    const self = evaluateZambdaAccess([
      rolesFile({ STAFF: { name: 'Staff', zambdaAccess: { inherits: ['STAFF'] } } }),
      zambdas(),
    ]);
    expect(self.failures[0]).toContain('cannot inherit from itself');
    const dupe = evaluateZambdaAccess([
      rolesFile({ STAFF: { name: 'Staff' }, X: { name: 'X', zambdaAccess: { inherits: ['STAFF', 'STAFF'] } } }),
      zambdas(),
    ]);
    expect(dupe.failures[0]).toContain('lists "STAFF" in inherits more than once');
  });

  it('FAILS an inheritance cycle, once', () => {
    const roles = rolesFile({
      STAFF: { name: 'Staff', zambdaAccess: { inherits: ['PROVIDER'] } },
      CLINICIAN: { name: 'Clinician', zambdaAccess: { inherits: ['STAFF'] } },
      PROVIDER: { name: 'Provider', zambdaAccess: { inherits: ['CLINICIAN'] } },
    });
    const { failures } = evaluateZambdaAccess([roles, zambdas()]);
    const cycles = failures.filter((failure) => failure.includes('inheritance cycle'));
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('STAFF → PROVIDER → CLINICIAN → STAFF');
  });

  it('FAILS malformed zambdaAccess', () => {
    const notObject = evaluateZambdaAccess([
      rolesFile({ STAFF: { name: 'Staff', zambdaAccess: ['STAFF'] } }),
      zambdas(),
    ]);
    expect(notObject.failures[0]).toContain('"zambdaAccess" must be an object');
    const unknownField = evaluateZambdaAccess([
      rolesFile({ STAFF: { name: 'Staff', zambdaAccess: { inheritsFrom: [] } } }),
      zambdas(),
    ]);
    expect(unknownField.failures[0]).toContain('unknown field "inheritsFrom"');
    const badInherits = evaluateZambdaAccess([
      rolesFile({ STAFF: { name: 'Staff', zambdaAccess: { inherits: 'PROVIDER' } } }),
      zambdas(),
    ]);
    expect(badInherits.failures[0]).toContain('"zambdaAccess.inherits" must be an array of role keys');
  });

  it('FAILS a rule that touches the Zambda service but is not the managed shape, and leaves that role alone', () => {
    const mixed: AccessPolicyRule = {
      resource: ['Zambda:Function:a', 'FHIR:Patient'],
      action: ['Zambda:InvokeFunction', 'FHIR:Read'],
      effect: 'Allow',
    };
    const deny: AccessPolicyRule = {
      resource: ['Zambda:Function:a'],
      action: ['Zambda:InvokeFunction'],
      effect: 'Deny',
    };
    const star: AccessPolicyRule = { resource: ['Zambda:*'], action: ['Zambda:*'], effect: 'Allow' };
    const roles = rolesFile({
      STAFF: { name: 'Staff', accessPolicy: [mixed] },
      X: { name: 'X', accessPolicy: [deny] },
      Y: { name: 'Y', accessPolicy: [star] },
    });
    const evaluation = evaluateZambdaAccess([roles, zambdas()]);
    expect(evaluation.failures).toHaveLength(3);
    for (const failure of evaluation.failures) {
      expect(failure).toContain('cannot be generated');
    }
    expect(evaluation.stale).toEqual([]);
    expect(policyOf(evaluation, 'STAFF')).toEqual([mixed]);
    expect(evaluation.roleFiles[0].changed).toBe(false);
  });

  it('FAILS a non-array accessPolicy and a role declared twice', () => {
    const notArray = evaluateZambdaAccess([rolesFile({ STAFF: { name: 'Staff', accessPolicy: {} } }), zambdas()]);
    expect(notArray.failures[0]).toContain('"accessPolicy" must be an array of rules');

    const other: SpecFile = { path: 'oystehr/more-roles.json', spec: { roles: { STAFF: { name: 'Staff' } } } };
    const twice = evaluateZambdaAccess([rolesFile({ STAFF: { name: 'Staff' } }), other, zambdas()]);
    expect(twice.failures[0]).toContain('role STAFF is also declared in another spec file');
  });
});

describe('zambda-access · discoverSpecFiles', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zambda-access-'));
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  const write = (relativePath: string, content: string): void => {
    const file = path.join(configDir, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  it('loads core, billing, shared and EVERY env overlay spec file, in a stable order', () => {
    write('oystehr-core/zambdas.json', '{"zambdas":{}}\n');
    write('oystehr-core/roles.json', '{"roles":{}}');
    write('oystehr/vaccines.json', '{"fhirResources":{}}\n');
    write('oystehr/env/local/zambdas.json', '{"zambdas":{"L":{"name":"l","type":"cron"}}}\n');
    write('oystehr/env/e2e/zambdas.json', '{"zambdas":{"E":{"name":"e","type":"cron"}}}\n');
    write('billing-app-core/zambdas.json', '{"zambdas":{}}');
    write('oystehr/README.md', 'not json');
    write('.env/local.json', '{"PROJECT_ID":"secret"}');
    write('runtime-seed/x.json', '{"fhirResources":{}}');

    const files = discoverSpecFiles(configDir);
    expect(files.map((file) => path.relative(configDir, file.path))).toEqual([
      'oystehr/vaccines.json',
      'oystehr-core/roles.json',
      'oystehr-core/zambdas.json',
      'billing-app-core/zambdas.json',
      'oystehr/env/e2e/zambdas.json',
      'oystehr/env/local/zambdas.json',
    ]);
    const byName = Object.fromEntries(files.map((file) => [path.relative(configDir, file.path), file]));
    expect(byName['oystehr-core/zambdas.json'].trailingNewline).toBe(true);
    expect(byName['oystehr-core/roles.json'].trailingNewline).toBe(false);
    expect(byName['oystehr/env/e2e/zambdas.json'].spec).toEqual({ zambdas: { E: { name: 'e', type: 'cron' } } });
    expect(byName['oystehr/env/e2e/zambdas.json'].env).toBe('e2e');
    expect(byName['oystehr/env/local/zambdas.json'].env).toBe('local');
    expect(byName['oystehr-core/zambdas.json'].env).toBeUndefined();
  });

  it('tolerates missing directories and rejects unparsable files', () => {
    expect(discoverSpecFiles(configDir)).toEqual([]);
    write('oystehr-core/roles.json', '{ not json');
    expect(() => discoverSpecFiles(configDir)).toThrow('Error parsing JSON file');
    write('oystehr-core/roles.json', '[]');
    expect(() => discoverSpecFiles(configDir)).toThrow('is not a JSON object');
  });

  it('round-trips a spec file through serializeSpecFile', () => {
    const original = '{\n  "roles": {\n    "A": {\n      "name": "a"\n    }\n  }\n}';
    write('oystehr-core/roles.json', original);
    const [file] = discoverSpecFiles(configDir);
    expect(serializeSpecFile(file.spec, file.trailingNewline)).toBe(original);
    expect(serializeSpecFile(file.spec, true)).toBe(`${original}\n`);
  });
});
