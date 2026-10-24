/**
 * Zambda access — derives every role's `Zambda:InvokeFunction` grants from the `access` declaration on
 * each `http_auth` zambda, and checks that the committed roles spec matches what those declarations imply.
 *
 * Declarations live next to the resources they describe:
 *
 *   zambdas.json → "MY-ZAMBDA": { "name": "my-zambda", "type": "http_auth", "access": ["STAFF"], ... }
 *   roles.json   → "CLINICIAN": { "name": "Clinician", "zambdaAccess": { "inherits": ["STAFF"] }, ... }
 *
 * `access` lists the LOWEST roles (role keys from roles.json) that may invoke the zambda. A role that
 * inherits from one of them — directly or transitively through `zambdaAccess.inherits` — is granted it
 * too, so a zambda is declared once at the tier where access starts. `"access": []` means no user role
 * may invoke it (only M2M clients, whose access policies are managed separately).
 *
 * Only `http_auth` zambdas take `access`: `http_open` needs no token, and `cron` / `subscription`
 * zambdas are invoked by the platform, so a role grant would be meaningless (and misleading) on them.
 *
 * Generation rewrites, for every role, the single access-policy rule of the exact shape
 *   { resource: ['Zambda:Function:<name>', ...], action: ['Zambda:InvokeFunction'], effect: 'Allow' }
 * and leaves every other rule (FHIR, Telemed, Z3, ...) untouched, in place. Wildcards such as
 * `Zambda:Function:*` are never generated and are reported as stale, because they would make the
 * "every zambda is explicitly granted" invariant vacuous.
 *
 * `evaluateZambdaAccess` is pure (no I/O) so it can be unit tested; `discoverSpecFiles` reads the spec
 * files the way deploy/generate-oystehr-resources.ts does, except that it loads EVERY env overlay so the
 * generated grants cover every environment. The CLI lives in scripts/config/zambda-access.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SpecFile } from './schema';

export const ZAMBDA_ACCESS_FIELD = 'access';
export const ROLE_ZAMBDA_ACCESS_FIELD = 'zambdaAccess';
export const USER_INVOKABLE_ZAMBDA_TYPE = 'http_auth';
export const ZAMBDA_INVOKE_ACTION = 'Zambda:InvokeFunction';
export const ZAMBDA_FUNCTION_RESOURCE_PREFIX = 'Zambda:Function:';

type JsonObject = { [key: string]: unknown };

export interface AccessPolicyRule extends JsonObject {
  resource?: unknown;
  action?: unknown;
  effect?: unknown;
}

export interface RoleSpecFileResult {
  path: string;
  /** The spec with every role's zambda rule regenerated; equal to the input when `changed` is false. */
  spec: JsonObject;
  changed: boolean;
}

export interface ZambdaAccessEvaluation {
  /** Problems with the declarations themselves. Nothing can be generated until these are fixed. */
  failures: string[];
  /** Roles whose committed grants differ from what the declarations imply. Fixed by regenerating. */
  stale: string[];
  /** Role key → sorted names of the zambdas that role must be allowed to invoke. */
  grants: { [roleKey: string]: string[] };
  /** Every spec file that declares roles, with its zambda rules regenerated. */
  roleFiles: RoleSpecFileResult[];
}

/**
 * A spec file plus, for a file under config/oystehr/env/<env>/, the environment it belongs to. Files from
 * different environments are never deployed together, so the same zambda may appear in each of them.
 */
export interface EnvAwareSpecFile extends SpecFile {
  env?: string;
}

export interface DiscoveredSpecFile extends EnvAwareSpecFile {
  /** Whether the file on disk ends with a newline, so a rewrite can preserve it. */
  trailingNewline: boolean;
}

interface ZambdaEntry {
  file: string;
  env?: string;
  key: string;
  name: string;
  type: string;
  /** Parsed `access`, when present and well-formed. */
  access?: string[];
  /** `access` was present but malformed (already reported). */
  accessMalformed: boolean;
}

interface RoleEntry {
  file: string;
  key: string;
  inherits: string[];
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Access-policy fields accept a string or an array of strings. Anything else reads as empty. */
const toList = (value: unknown): string[] => (typeof value === 'string' ? [value] : isStringArray(value) ? value : []);

const sortUnique = (values: Iterable<string>): string[] => [...new Set(values)].sort();

const describeList = (values: string[], limit = 8): string =>
  values.length <= limit
    ? values.join(', ')
    : `${values.slice(0, limit).join(', ')} … and ${values.length - limit} more`;

const collectRoles = (specFiles: SpecFile[], failures: string[]): RoleEntry[] => {
  const roles: RoleEntry[] = [];
  for (const specFile of specFiles) {
    const rolesSpec = specFile.spec.roles;
    if (rolesSpec === undefined) {
      continue;
    }
    if (!isObject(rolesSpec)) {
      failures.push(`${specFile.path}: "roles" must be an object`);
      continue;
    }
    for (const [key, role] of Object.entries(rolesSpec)) {
      if (!isObject(role)) {
        failures.push(`${specFile.path}: role ${key} must be an object`);
        continue;
      }
      if (roles.some((existing) => existing.key === key)) {
        failures.push(`${specFile.path}: role ${key} is also declared in another spec file`);
        continue;
      }
      const inherits: string[] = [];
      const zambdaAccess = role[ROLE_ZAMBDA_ACCESS_FIELD];
      if (zambdaAccess !== undefined) {
        if (!isObject(zambdaAccess)) {
          failures.push(`${specFile.path}: role ${key} "${ROLE_ZAMBDA_ACCESS_FIELD}" must be an object`);
        } else {
          for (const field of Object.keys(zambdaAccess)) {
            if (field !== 'inherits') {
              failures.push(
                `${specFile.path}: role ${key} "${ROLE_ZAMBDA_ACCESS_FIELD}" has unknown field "${field}" (only "inherits" is supported)`
              );
            }
          }
          if (zambdaAccess.inherits !== undefined) {
            if (!isStringArray(zambdaAccess.inherits)) {
              failures.push(
                `${specFile.path}: role ${key} "${ROLE_ZAMBDA_ACCESS_FIELD}.inherits" must be an array of role keys`
              );
            } else {
              inherits.push(...zambdaAccess.inherits);
            }
          }
        }
      }
      roles.push({ file: specFile.path, key, inherits });
    }
  }
  return roles;
};

/**
 * Resolves `zambdaAccess.inherits` into, for every role, the set of roles it transitively inherits from
 * (not including itself). Unknown, self and duplicate references and cycles are reported as failures.
 */
const resolveInheritance = (roles: RoleEntry[], failures: string[]): Map<string, Set<string>> => {
  const byKey = new Map(roles.map((role) => [role.key, role]));
  const directParents = new Map<string, string[]>();
  for (const role of roles) {
    const parents: string[] = [];
    for (const parent of role.inherits) {
      if (!byKey.has(parent)) {
        failures.push(`${role.file}: role ${role.key} inherits unknown role "${parent}"`);
      } else if (parent === role.key) {
        failures.push(`${role.file}: role ${role.key} cannot inherit from itself`);
      } else if (parents.includes(parent)) {
        failures.push(`${role.file}: role ${role.key} lists "${parent}" in inherits more than once`);
      } else {
        parents.push(parent);
      }
    }
    directParents.set(role.key, parents);
  }

  const ancestors = new Map<string, Set<string>>();
  const reportedCycles = new Set<string>();
  const visit = (key: string, trail: string[]): Set<string> => {
    const cached = ancestors.get(key);
    if (cached) {
      return cached;
    }
    const cycleStart = trail.indexOf(key);
    if (cycleStart !== -1) {
      const cycle = [...trail.slice(cycleStart), key];
      const signature = sortUnique(cycle).join('>');
      if (!reportedCycles.has(signature)) {
        reportedCycles.add(signature);
        failures.push(`${byKey.get(key)?.file}: role inheritance cycle: ${cycle.join(' → ')}`);
      }
      return new Set();
    }
    const result = new Set<string>();
    for (const parent of directParents.get(key) ?? []) {
      result.add(parent);
      for (const grandparent of visit(parent, [...trail, key])) {
        result.add(grandparent);
      }
    }
    // Only cache a complete answer: a node visited while unwinding a cycle has a partial set.
    if (!trail.some((ancestor) => result.has(ancestor))) {
      ancestors.set(key, result);
    }
    return result;
  };
  for (const role of roles) {
    visit(role.key, []);
  }
  return ancestors;
};

const parseAccess = (
  zambda: JsonObject,
  label: string,
  failures: string[]
): { access?: string[]; accessMalformed: boolean } => {
  const access = zambda[ZAMBDA_ACCESS_FIELD];
  if (access === undefined) {
    return { accessMalformed: false };
  }
  if (isStringArray(access)) {
    return { access, accessMalformed: false };
  }
  failures.push(`${label} "${ZAMBDA_ACCESS_FIELD}" must be an array of role keys, e.g. ["STAFF"], or [] for M2M-only`);
  return { accessMalformed: true };
};

const collectZambdas = (specFiles: EnvAwareSpecFile[], failures: string[]): ZambdaEntry[] => {
  const zambdas: ZambdaEntry[] = [];
  for (const specFile of specFiles) {
    const zambdasSpec = specFile.spec.zambdas;
    if (zambdasSpec === undefined) {
      continue;
    }
    if (!isObject(zambdasSpec)) {
      failures.push(`${specFile.path}: "zambdas" must be an object`);
      continue;
    }
    for (const [key, zambda] of Object.entries(zambdasSpec)) {
      if (!isObject(zambda)) {
        failures.push(`${specFile.path}: zambda ${key} must be an object`);
        continue;
      }
      const { name, type } = zambda;
      if (typeof name !== 'string' || name.length === 0) {
        failures.push(`${specFile.path}: zambda ${key} must have a non-empty "name"`);
        continue;
      }
      if (typeof type !== 'string') {
        failures.push(`${specFile.path}: zambda ${key} ("${name}") must have a "type"`);
        continue;
      }
      const label = `${specFile.path}: zambda ${key} ("${name}")`;
      const parsed = parseAccess(zambda, label, failures);
      const duplicate = zambdas.find((existing) => existing.name === name);
      if (duplicate) {
        const separateEnvironments =
          specFile.env !== undefined && duplicate.env !== undefined && specFile.env !== duplicate.env;
        if (!separateEnvironments) {
          failures.push(
            `${label} has the same name as ${duplicate.key} in ${duplicate.file}; role grants are by name, so names must be unique`
          );
        } else if (
          duplicate.type !== type ||
          JSON.stringify(duplicate.access) !== JSON.stringify(parsed.access) ||
          duplicate.accessMalformed !== parsed.accessMalformed
        ) {
          failures.push(
            `${label} is also declared in ${duplicate.file} with a different type or "${ZAMBDA_ACCESS_FIELD}"; a zambda must be declared the same way in every environment`
          );
        }
        continue;
      }
      zambdas.push({ file: specFile.path, env: specFile.env, key, name, type, ...parsed });
    }
  }
  return zambdas;
};

const validateAccessDeclarations = (
  zambdas: ZambdaEntry[],
  roles: RoleEntry[],
  ancestors: Map<string, Set<string>>,
  failures: string[]
): void => {
  const roleKeys = new Set(roles.map((role) => role.key));
  const roleKeyList = sortUnique(roleKeys).join(', ');
  for (const zambda of zambdas) {
    const label = `${zambda.file}: zambda ${zambda.key} ("${zambda.name}")`;
    if (zambda.type !== USER_INVOKABLE_ZAMBDA_TYPE) {
      if (zambda.access !== undefined || zambda.accessMalformed) {
        failures.push(
          `${label} is "${zambda.type}" and must not declare "${ZAMBDA_ACCESS_FIELD}": only ${USER_INVOKABLE_ZAMBDA_TYPE} zambdas are invoked with a user token`
        );
      }
      continue;
    }
    if (zambda.access === undefined) {
      if (!zambda.accessMalformed) {
        failures.push(
          `${label} is ${USER_INVOKABLE_ZAMBDA_TYPE} but has no "${ZAMBDA_ACCESS_FIELD}" declaration. Add "${ZAMBDA_ACCESS_FIELD}": [<role keys>] with the lowest roles that may invoke it (roles inheriting from them are included), or "${ZAMBDA_ACCESS_FIELD}": [] if only M2M clients call it. Role keys: ${roleKeyList}`
        );
      }
      continue;
    }
    for (const [index, roleKey] of zambda.access.entries()) {
      if (!roleKeys.has(roleKey)) {
        failures.push(`${label} "${ZAMBDA_ACCESS_FIELD}" names unknown role "${roleKey}". Role keys: ${roleKeyList}`);
      } else if (zambda.access.indexOf(roleKey) !== index) {
        failures.push(`${label} "${ZAMBDA_ACCESS_FIELD}" lists "${roleKey}" more than once`);
      } else {
        const impliedBy = zambda.access.find((other) => other !== roleKey && ancestors.get(roleKey)?.has(other));
        if (impliedBy) {
          failures.push(
            `${label} "${ZAMBDA_ACCESS_FIELD}" lists "${roleKey}", which already inherits "${impliedBy}"; list only the lowest roles`
          );
        }
      }
    }
  }
};

const computeGrants = (
  zambdas: ZambdaEntry[],
  roles: RoleEntry[],
  ancestors: Map<string, Set<string>>
): { [roleKey: string]: string[] } => {
  const grants: { [roleKey: string]: string[] } = {};
  for (const role of roles) {
    const reachable = new Set([role.key, ...(ancestors.get(role.key) ?? [])]);
    grants[role.key] = sortUnique(
      zambdas
        .filter(
          (zambda) =>
            zambda.type === USER_INVOKABLE_ZAMBDA_TYPE &&
            zambda.access !== undefined &&
            zambda.access.some((declared) => reachable.has(declared))
        )
        .map((zambda) => zambda.name)
    );
  }
  return grants;
};

/** A rule mentions the Zambda service at all, whether or not the generator can manage it. */
const touchesZambdaService = (rule: AccessPolicyRule): boolean =>
  toList(rule.resource).some((resource) => resource.startsWith('Zambda:')) ||
  toList(rule.action).some((action) => action.startsWith('Zambda:'));

/** The exact rule shape the generator owns. Anything else touching the Zambda service is an error. */
const isManagedRule = (rule: AccessPolicyRule): boolean => {
  const actions = toList(rule.action);
  const resources = toList(rule.resource);
  return (
    rule.effect === 'Allow' &&
    actions.length === 1 &&
    actions[0] === ZAMBDA_INVOKE_ACTION &&
    resources.length > 0 &&
    resources.every((resource) => resource.startsWith(ZAMBDA_FUNCTION_RESOURCE_PREFIX)) &&
    Object.keys(rule).every((field) => ['resource', 'action', 'effect'].includes(field))
  );
};

const buildManagedRule = (names: string[]): AccessPolicyRule => ({
  resource: names.map((name) => `${ZAMBDA_FUNCTION_RESOURCE_PREFIX}${name}`),
  action: [ZAMBDA_INVOKE_ACTION],
  effect: 'Allow',
});

const regenerateRoleFiles = (
  specFiles: SpecFile[],
  grants: { [roleKey: string]: string[] },
  failures: string[],
  stale: string[]
): RoleSpecFileResult[] => {
  const results: RoleSpecFileResult[] = [];
  for (const specFile of specFiles) {
    if (!isObject(specFile.spec.roles)) {
      continue;
    }
    const spec = JSON.parse(JSON.stringify(specFile.spec)) as JsonObject;
    const roles = spec.roles as JsonObject;
    let changed = false;
    for (const [key, role] of Object.entries(roles)) {
      if (!isObject(role)) {
        continue;
      }
      const expected = grants[key] ?? [];
      const currentPolicy = role.accessPolicy;
      if (currentPolicy !== undefined && !Array.isArray(currentPolicy)) {
        failures.push(`${specFile.path}: role ${key} "accessPolicy" must be an array of rules`);
        continue;
      }
      const rules = (currentPolicy ?? []) as unknown[];
      const managedIndexes: number[] = [];
      let unmanageable = false;
      for (const [index, rule] of rules.entries()) {
        if (!isObject(rule) || !touchesZambdaService(rule)) {
          continue;
        }
        if (isManagedRule(rule)) {
          managedIndexes.push(index);
        } else {
          unmanageable = true;
          failures.push(
            `${
              specFile.path
            }: role ${key} has an access-policy rule touching the Zambda service that cannot be generated. Zambda grants must be exactly {"resource": ["${ZAMBDA_FUNCTION_RESOURCE_PREFIX}<name>", ...], "action": ["${ZAMBDA_INVOKE_ACTION}"], "effect": "Allow"} and are derived from "${ZAMBDA_ACCESS_FIELD}" on zambdas; move anything else to its own rule. Offending rule: ${JSON.stringify(
              rule
            )}`
          );
        }
      }
      if (unmanageable) {
        continue;
      }

      const currentNames = sortUnique(
        managedIndexes.flatMap((index) =>
          toList((rules[index] as AccessPolicyRule).resource).map((resource) =>
            resource.slice(ZAMBDA_FUNCTION_RESOURCE_PREFIX.length)
          )
        )
      );
      const kept = rules.filter((_, index) => !managedIndexes.includes(index));
      const insertAt = managedIndexes.length > 0 ? managedIndexes[0] : kept.length;
      const regenerated = [...kept];
      if (expected.length > 0) {
        regenerated.splice(insertAt, 0, buildManagedRule(expected));
      }

      if (JSON.stringify(regenerated) === JSON.stringify(rules)) {
        continue;
      }
      changed = true;
      role.accessPolicy = regenerated;

      const missing = expected.filter((name) => !currentNames.includes(name));
      const extra = currentNames
        .filter((name) => !expected.includes(name))
        .map((name) => (name.includes('*') ? `${ZAMBDA_FUNCTION_RESOURCE_PREFIX}${name} (wildcard)` : name));
      const details: string[] = [];
      if (missing.length > 0) {
        details.push(`missing ${missing.length}: ${describeList(missing)}`);
      }
      if (extra.length > 0) {
        details.push(`extra ${extra.length}: ${describeList(extra)}`);
      }
      if (details.length === 0) {
        details.push('same zambdas, but the grants must be a single sorted rule');
      }
      stale.push(`${specFile.path}: role ${key} zambda grants are out of date (${details.join('; ')})`);
    }
    results.push({ path: specFile.path, spec, changed });
  }
  return results;
};

/**
 * Pure evaluation of the zambda-access invariants over a set of spec files (any mix of files declaring
 * `zambdas` and/or `roles`). No I/O.
 */
export const evaluateZambdaAccess = (specFiles: EnvAwareSpecFile[]): ZambdaAccessEvaluation => {
  const failures: string[] = [];
  const stale: string[] = [];
  const roles = collectRoles(specFiles, failures);
  const ancestors = resolveInheritance(roles, failures);
  const zambdas = collectZambdas(specFiles, failures);
  validateAccessDeclarations(zambdas, roles, ancestors, failures);
  const grants = computeGrants(zambdas, roles, ancestors);
  const roleFiles = regenerateRoleFiles(specFiles, grants, failures, stale);
  return { failures, stale, grants, roleFiles };
};

const listJsonFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
};

/**
 * Loads the Oystehr spec files under `configDir` the same way deploy/generate-oystehr-resources.ts does
 * (config/oystehr, config/oystehr-core, config/billing-app-core), plus EVERY config/oystehr/env/<env>
 * overlay rather than a single environment's, so the generated grants are valid for all environments.
 */
export const discoverSpecFiles = (configDir: string): DiscoveredSpecFile[] => {
  const envRoot = path.join(configDir, 'oystehr', 'env');
  const envNames = fs.existsSync(envRoot)
    ? fs
        .readdirSync(envRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
  const sharedDirs = [
    path.join(configDir, 'oystehr'),
    path.join(configDir, 'oystehr-core'),
    path.join(configDir, 'billing-app-core'),
  ];
  const files: { file: string; env?: string }[] = [
    ...sharedDirs.flatMap((dir) => listJsonFiles(dir).map((file) => ({ file }))),
    ...envNames.flatMap((env) => listJsonFiles(path.join(envRoot, env)).map((file) => ({ file, env }))),
  ];

  return files.map(({ file, env }) => {
    const content = fs.readFileSync(file, 'utf-8');
    let spec: unknown;
    try {
      spec = JSON.parse(content);
    } catch (err) {
      throw new Error(`Error parsing JSON file ${file}: ${err}`);
    }
    if (!isObject(spec)) {
      throw new Error(`${file} is not a JSON object`);
    }
    return { path: file, spec, trailingNewline: content.endsWith('\n'), ...(env === undefined ? {} : { env }) };
  });
};

/** Serializes a spec the way the config files are formatted (2-space JSON), preserving the trailing newline. */
export const serializeSpecFile = (spec: unknown, trailingNewline: boolean): string =>
  JSON.stringify(spec, null, 2) + (trailingNewline ? '\n' : '');
