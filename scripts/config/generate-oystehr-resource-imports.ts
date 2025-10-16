#! npx tsx

import fs from 'node:fs/promises';
import path, { resolve } from 'node:path';
import Oystehr from '@oystehr/sdk';
import type { Options } from 'execa';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { SpecFile } from '../../packages/spec/src/schema';
import { Schema20250925, Spec20250925 } from '../../packages/spec/src/schema-20250925';

interface GenerateResourcesArgs {
  configDir: string;
  env: string;
  projectId: string;
  accessToken: string;
}

const validSchemas = ['2025-03-19', '2025-09-25'];

const zambdasDirPath = path.resolve(__dirname, '../../packages/zambdas');

async function generate(input: GenerateResourcesArgs): Promise<void> {
  const { configDir, env, projectId, accessToken } = input;
  const varFile = path.resolve(__dirname, `../../packages/zambdas/.env/${env}.json`);
  await generateOystehrResourceImports({ configDir: `${configDir}/oystehr`, varFile, projectId, accessToken });
}

async function generateOystehrResourceImports(input: {
  configDir: string;
  varFile: string;
  projectId: string;
  accessToken: string;
}): Promise<void> {
  const { configDir, varFile, projectId, accessToken } = input;

  if (!configDir) {
    throw new Error('Config directory is required.');
  }

  if (!varFile) {
    throw new Error('Variable file is required.');
  }

  if (!projectId) {
    throw new Error('Oystehr project ID is required.');
  }

  if (!accessToken) {
    throw new Error('Oystehr access token is required.');
  }

  // Read all spec files from the config directory
  const specFiles = await fs.readdir(configDir, { withFileTypes: true });
  const jsonSpecFiles = specFiles
    .filter((file) => file.isFile() && file.name.endsWith('.json'))
    .map((file) => path.join(configDir, file.name));

  const specs: SpecFile[] = await Promise.all(
    jsonSpecFiles.map(async (file) => {
      const content = await fs.readFile(file, 'utf-8');
      return { path: file, spec: JSON.parse(content) as { [key: string]: unknown } };
    })
  );

  if (!specs.every((spec) => isObject(spec) && isObject(spec.spec))) {
    throw new Error('One or more spec files are not valid JSON maps.');
  }
  const schemaVersion = isObject(specs[0].spec) && specs[0].spec['schema-version'];
  if (!schemaVersion || !(typeof schemaVersion === 'string') || !validSchemas.includes(schemaVersion)) {
    throw new Error(`Invalid or missing schema version: ${schemaVersion}`);
  }
  if (!specs.every((spec) => isObject(spec.spec) && spec.spec['schema-version'] === schemaVersion)) {
    throw new Error('All spec files must have the same schema version.');
  }

  const vars = JSON.parse(await fs.readFile(varFile, 'utf-8'));
  if (!isObject(vars)) {
    throw new Error(`Variable file ${varFile} is not a valid JSON map.`);
  }

  const oystehr = new Oystehr({
    accessToken,
    projectId,
  });

  const { $ } = await import('execa');
  const execaOpts: Options = {
    cwd: resolve(__dirname, '../../deploy'),
  };

  const imports: string[] = [];

  // Generate resource imports for specs
  if (schemaVersion === '2025-03-19') {
    throw new Error(
      'Import generation not supported for schema version 2025-03-19. Please upgrade to 2025-09-25 first.'
    );
  }
  if (schemaVersion === '2025-09-25') {
    const schema = new Schema20250925(specs, vars, '/dev/null', zambdasDirPath);
    let existingResources: Record<keyof Spec20250925, any> = {
      apps: [],
      buckets: [],
      faxNumbers: [],
      fhirResources: {},
      labRoutes: [],
      m2ms: [],
      roles: [],
      secrets: [],
      zambdas: [],
      project: [],
      outputs: [],
    };
    try {
      existingResources = {
        apps: await oystehr.application.list(),
        buckets: await oystehr.z3.listBuckets(),
        faxNumbers: [...((await oystehr.fax.getConfiguration()).faxNumbers ?? []).map((number) => ({ number }))],
        fhirResources: {}, // No list API for FHIR resources
        labRoutes: await oystehr.lab.routeList(),
        m2ms: (await oystehr.m2m.listV2()).data,
        roles: await oystehr.role.list(),
        secrets: await oystehr.secret.list(),
        zambdas: await oystehr.zambda.list(),
        project: [],
        outputs: [],
      };
    } catch (err) {
      throw new Error(`Error fetching resources from Oystehr: ${err}`);
    }
    for (const [resourceType, resources] of Object.entries(schema.resources)) {
      if (['project', 'outputs', 'zambdas'].includes(resourceType)) {
        continue;
      }
      for (const [key, resource] of Object.entries(resources)) {
        try {
          let tfValue: any;
          if (resourceType !== 'fhirResources' || ['Location'].includes(resource.resource.resourceType)) {
            const tfResourceRef = schema.getTerraformResourceReference(
              schema.resources,
              resourceType as keyof Spec20250925,
              key,
              schema.getIdentifierForResourceType(resourceType as keyof Spec20250925)
            );
            if (!tfResourceRef) {
              console.warn(`No terraform reference found for ${resourceType}.${key}, skipping import.`);
              continue;
            }
            const tfOutputName = schema.getTerraformResourceOutputName(tfResourceRef, 'oystehr');
            const tfConsoleRead = await $({
              ...execaOpts,
              input: `nonsensitive(${tfOutputName})`,
            })`terraform console`;
            console.log(`Terraform console read for ${resourceType}.${key}: ${tfConsoleRead.stdout}`);
            tfValue = tfConsoleRead.stdout;
          }
          // console value will either be the actual value or 'tostring(null)'
          if (
            tfValue &&
            typeof tfValue === 'string' &&
            tfValue !== 'tostring(null)' &&
            tfValue !== '(known after apply)'
          ) {
            // App already exists in terraform, continue
            console.log(`${resourceType}.${key} already exists in terraform, skipping import.`);
          } else {
            // App does not exist in terraform, check if it exists in Oystehr
            let match: any;
            if (resourceType === 'fhirResources') {
              switch (resource.resource.resourceType) {
                case 'Location': {
                  // Locations and their schedules
                  const slugIdentifier = resource.resource.identifier?.find(
                    (id: any) => id.system === 'https://fhir.ottehr.com/r4/slug'
                  );
                  if (!slugIdentifier) {
                    console.log(
                      `No slug identifier found for FHIR Location ${key}, cannot match existing resource, skipping import.`
                    );
                    break;
                  }
                  const existingLocation = (
                    await oystehr.fhir.search<Location | Schedule>({
                      resourceType: 'Location',
                      params: [
                        {
                          name: 'identifier',
                          value: `${slugIdentifier?.system}|${slugIdentifier?.value}`,
                        },
                        { name: '_revinclude', value: 'Schedule:actor:Location' },
                      ],
                    })
                  ).unbundle();
                  if (existingLocation.length > 0) {
                    const loc = existingLocation.find((loc) => loc.resourceType === 'Location');
                    if (!loc || !loc.id) {
                      console.log(`No ID found for matching FHIR Location ${key}, cannot import, skipping import.`);
                      break;
                    }
                    console.log(`Found existing resource in Oystehr for FHIR Location.${key}: ${loc.id} (${loc.id})`);
                    imports.push(
                      `terraform import ${schema.oystehrResourceFromResourceType(
                        resourceType as keyof Spec20250925
                      )}.${key} ${loc.id}`
                    );
                    const scheds = existingLocation.filter((res) => res.resourceType === 'Schedule') as Schedule[];
                    if (scheds.length > 0) {
                      scheds.forEach((sched) => {
                        if (sched.id) {
                          console.log(
                            `Found existing resource in Oystehr for FHIR Schedule associated with Location.${key}: ${sched.id} (${sched.id})`
                          );
                          imports.push(
                            `terraform import ${schema.oystehrResourceFromResourceType(
                              resourceType as keyof Spec20250925
                            )}.${key.replace('LOCATION', 'SCHEDULE')} ${sched.id}` // brittle convention-based replacement
                          );
                        }
                      });
                    }
                  }
                  break;
                }
                case 'HealthcareService': {
                  // Locations and their schedules
                  const slugIdentifier = resource.resource.identifier?.find(
                    (id: any) => id.system === 'https://fhir.ottehr.com/r4/slug'
                  );
                  if (!slugIdentifier) {
                    console.log(
                      `No slug identifier found for FHIR HealthcareService ${key}, cannot match existing resource, skipping import.`
                    );
                    break;
                  }
                  const existingHCS = (
                    await oystehr.fhir.search<HealthcareService | PractitionerRole | Practitioner | Schedule>({
                      resourceType: 'HealthcareService',
                      params: [
                        {
                          name: 'identifier',
                          value: `${slugIdentifier?.system}|${slugIdentifier?.value}`,
                        },
                        { name: '_revinclude', value: 'PractitionerRole:service:HealthcareService' },
                        { name: '_include:iterate', value: 'PractitionerRole:practitioner:Practitioner' },
                        { name: '_revinclude:iterate', value: 'Schedule:actor:Practitioner' },
                      ],
                    })
                  ).unbundle();
                  if (existingHCS.length > 0) {
                    const hcs = existingHCS.find((hcs) => hcs.resourceType === 'HealthcareService');
                    if (!hcs || !hcs.id) {
                      console.log(
                        `No ID found for matching FHIR HealthcareService ${key}, cannot import, skipping import.`
                      );
                      break;
                    }
                    console.log(
                      `Found existing resource in Oystehr for FHIR HealthcareService.${key}: ${hcs.id} (${hcs.id})`
                    );
                    imports.push(
                      `terraform import ${schema.oystehrResourceFromResourceType(
                        resourceType as keyof Spec20250925
                      )}.${key} ${hcs.id}`
                    );
                    const pracs = existingHCS.filter((res) => res.resourceType === 'Practitioner') as Practitioner[];
                    const pracIds: Record<string, string> = {};
                    if (pracs.length > 0) {
                      pracs.forEach((prac) => {
                        if (prac.id) {
                          console.log(
                            `Found existing resource in Oystehr for FHIR Practitioner associated with HealthcareService.${key}: ${prac.id} (${prac.id})`
                          );
                          const pracSlug = prac.identifier?.find(
                            (id: any) => id.system === 'https://fhir.ottehr.com/r4/slug'
                          )?.value;
                          const pracMatch = Object.entries(schema.resources.fhirResources).find(([_, res]) => {
                            const resSlug = res.resource.identifier?.find(
                              (id: any) => id.system === 'https://fhir.ottehr.com/r4/slug'
                            )?.value;
                            return res.resource.resourceType === 'Practitioner' && resSlug === pracSlug;
                          });
                          if (pracMatch) {
                            pracIds[pracMatch[0]] = prac.id;
                            imports.push(
                              `terraform import ${schema.oystehrResourceFromResourceType(
                                resourceType as keyof Spec20250925
                              )}.${pracMatch[0]} ${prac.id}` // brittle convention-based replacement
                            );
                          }
                        }
                      });
                    }
                    const pracRoles = existingHCS.filter(
                      (res) => res.resourceType === 'PractitionerRole'
                    ) as PractitionerRole[];
                    if (pracRoles.length > 0) {
                      pracRoles.forEach((pracRole) => {
                        if (pracRole.id) {
                          console.log(
                            `Found existing resource in Oystehr for FHIR PractitionerRole associated with HealthcareService.${key}: ${pracRole.id} (${pracRole.id})`
                          );
                          const pracRef = (pracRole.practitioner as { reference: string } | undefined)?.reference;
                          if (pracRef) {
                            const pracKey = Object.entries(pracIds).find(([, id]) => pracRef === `Practitioner/${id}`);
                            if (pracKey) {
                              const prKey = pracKey[0].includes('_1')
                                ? 'PRACTITIONER_ROLE_VISIT_FOLLOWUP_GROUP_1'
                                : 'PRACTITIONER_ROLE_VISIT_FOLLOWUP_GROUP_2';
                              imports.push(
                                `terraform import ${schema.oystehrResourceFromResourceType(
                                  resourceType as keyof Spec20250925
                                )}.${prKey} ${pracRole.id}` // brittle convention-based replacement
                              );
                            }
                          }
                        }
                      });
                    }
                    const scheds = existingHCS.filter((res) => res.resourceType === 'Schedule') as Schedule[];
                    if (scheds.length > 0) {
                      scheds.forEach((sched) => {
                        if (sched.id) {
                          console.log(
                            `Found existing resource in Oystehr for FHIR Schedule associated with HealthcareService.${key}: ${sched.id} (${sched.id})`
                          );
                          const pracRef = (sched.actor?.[0] as { reference: string } | undefined)?.reference;
                          if (pracRef) {
                            const pracKey = Object.entries(pracIds).find(([, id]) => pracRef === `Practitioner/${id}`);
                            if (pracKey) {
                              const schKey = pracKey[0].includes('_1')
                                ? 'SCHEDULE_VISIT_FOLLOWUP_GROUP_PRACTITIONER_1'
                                : 'SCHEDULE_VISIT_FOLLOWUP_GROUP_PRACTITIONER_2';
                              imports.push(
                                `terraform import ${schema.oystehrResourceFromResourceType(
                                  resourceType as keyof Spec20250925
                                )}.${schKey} ${sched.id}` // brittle convention-based replacement
                              );
                            }
                          }
                        }
                      });
                    }
                  }
                  break;
                }
              }
            } else {
              match =
                resourceType === 'faxNumbers'
                  ? existingResources[resourceType as keyof Spec20250925].length > 0 &&
                    existingResources[resourceType as keyof Spec20250925][0]
                  : existingResources[resourceType as keyof Spec20250925].find(
                      (existingResource: any) =>
                        existingResource[getSecondaryIdentifierForResourceType(resourceType as keyof Spec20250925)] ===
                        schema.replaceVariableWithValue(
                          resource[getSecondaryIdentifierForResourceType(resourceType as keyof Spec20250925)]
                        )
                    );
              if (match) {
                console.log(
                  `Found existing resource in Oystehr for ${resourceType}.${key}: ${
                    match[getSecondaryIdentifierForResourceType(resourceType as keyof Spec20250925)]
                  }`
                );
                imports.push(
                  `terraform import ${schema.oystehrResourceFromResourceType(
                    resourceType as keyof Spec20250925
                  )}.${key} ${match[schema.getIdentifierForResourceType(resourceType as keyof Spec20250925)]}`
                );
              } else {
                console.log(`No existing resource found in Oystehr for ${resourceType}.${key}, skipping import.`);
              }
            }
          }
        } catch (err) {
          console.error(`Error processing ${resourceType}.${key}: ${err}`);
        }
      }
    }
  }

  if (imports.length) {
    console.log('');
    console.log('');
    console.log('Run the following commands to import existing resources into terraform:');
    console.log('---');
    imports.forEach((imp) => console.log(imp));
    console.log('---');
  } else {
    console.log('No resources to import.');
  }
}

function getSecondaryIdentifierForResourceType(resourceType: keyof Spec20250925): string {
  switch (resourceType) {
    case 'apps':
    case 'buckets':
    case 'fhirResources': // TODO: not really
    case 'm2ms':
    case 'roles':
    case 'secrets':
    case 'zambdas':
      return 'name';
    case 'faxNumbers':
      return 'number';
    case 'labRoutes':
      return 'accountNumber';
  }
  throw new Error(`No secondary identifier defined for resource type ${resourceType}`);
}

function isObject(spec: any): spec is { [key: string]: unknown } {
  return spec && typeof spec === 'object' && !Array.isArray(spec);
}

const validateInput = (): GenerateResourcesArgs => {
  const args = process.argv.slice(2);
  if (args.length !== 4) {
    throw new Error(
      'Usage: tsx generate-oystehr-resource-imports.ts <config-dir> <env> <oystehr-project-id> <oystehr-access-token>'
    );
  }

  const [configDir, env, projectId, accessToken] = args;

  if (!configDir) {
    throw new Error('Config directory is required.');
  }

  if (!env) {
    throw new Error('Environment is required.');
  }

  if (!projectId) {
    throw new Error('Oystehr project ID is required.');
  }

  if (!accessToken) {
    throw new Error('Oystehr access token is required.');
  }

  return { configDir, env, projectId, accessToken };
};

const validatedArgs = validateInput();
generate(validatedArgs)
  .then(() => {
    console.log('Done!');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
