import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM, GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM } from '../../fhir';
import { examConfig } from './index';

type UnknownRecord = Record<string, unknown>;

const repoRootFromHere = (): string => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, '../../../../../');
};

const loadGlobalTemplatesConfig = async (): Promise<UnknownRecord> => {
  const filePath = path.join(repoRootFromHere(), 'config/oystehr/global-templates.json');
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as UnknownRecord;
};

const extractCodingVersionsBySystem = (config: UnknownRecord): Map<string, Set<string>> => {
  const fhirResources = config.fhirResources as UnknownRecord | undefined;
  const versionsBySystem = new Map<string, Set<string>>();

  if (!fhirResources) return versionsBySystem;

  for (const v of Object.values(fhirResources)) {
    const resource = (v as UnknownRecord | undefined)?.resource as UnknownRecord | undefined;
    const codings = (resource?.code as UnknownRecord | undefined)?.coding as unknown;
    if (!Array.isArray(codings)) continue;

    for (const coding of codings) {
      const c = coding as UnknownRecord;
      const system = c.system;
      const version = c.version;
      if (typeof system !== 'string' || typeof version !== 'string') continue;

      const set = versionsBySystem.get(system) ?? new Set<string>();
      set.add(version);
      versionsBySystem.set(system, set);
    }
  }

  return versionsBySystem;
};

describe('global templates exam versioning', () => {
  it('in-person global templates match the runtime-generated exam version', async () => {
    const config = await loadGlobalTemplatesConfig();
    const versionsBySystem = extractCodingVersionsBySystem(config);

    const inPersonVersions = versionsBySystem.get(GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM) ?? new Set<string>();
    expect(inPersonVersions.size).toBeGreaterThan(0);

    const uniqueVersions = [...inPersonVersions].sort();
    expect(uniqueVersions).toEqual([examConfig.inPerson.default.version]);
  });

  it('telemed global templates (if present) match the runtime-generated exam version', async () => {
    const config = await loadGlobalTemplatesConfig();
    const versionsBySystem = extractCodingVersionsBySystem(config);

    const telemedVersions = versionsBySystem.get(GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM) ?? new Set<string>();
    if (telemedVersions.size === 0) return;

    const uniqueVersions = [...telemedVersions].sort();
    expect(uniqueVersions).toEqual([examConfig.telemed.default.version]);
  });
});
