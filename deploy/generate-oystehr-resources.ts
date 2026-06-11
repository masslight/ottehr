/**
 * Generates Terraform JSON configuration files from Ottehr spec files.
 *
 * This script reads JSON spec files from config/oystehr/ and config/oystehr-core/,
 * and optionally from config/oystehr/env/<env>/ for environment-specific resources,
 * then generates Terraform-compatible JSON files in the output directory.
 *
 * Resources are partitioned into deployment stacks via an optional `stack` field on
 * each resource entry (a stack name or list of names; entries without one belong to
 * the "clinical" stack). Only resources belonging to the requested stack are
 * generated, so each Terraform root manages an independent slice of the project.
 *
 * Usage: tsx generate-oystehr-resources.ts <config-dir> <env> <output-path> [stack]
 *
 * @see packages/spec/README.md for schema documentation
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { BRANDING_CONFIG, FEATURE_FLAGS_CONFIG, SENDGRID_CONFIG } from 'utils';
import { SpecFile } from '../packages/spec/src/schema';
import { Schema20250319 } from '../packages/spec/src/schema-20250319';
import { Schema20250925 } from '../packages/spec/src/schema-20250925';

const validSchemas = ['2025-03-19', '2025-09-25'];

const DEFAULT_STACK = 'clinical';
const validStacks = ['clinical', 'billing'];

const RESOURCE_TYPE_KEYS = [
  'project',
  'apps',
  'buckets',
  'faxNumbers',
  'fhirResources',
  'labRoutes',
  'm2ms',
  'outputs',
  'roles',
  'secrets',
  'zambdas',
];

const zambdasDirPath = path.resolve(__dirname, '../packages/zambdas');

// args

async function generate(input: GenerateResourcesArgs): Promise<void> {
  const { configDir, env, outputPath, stack } = input;
  // Sendgrid resources are owned by the clinical stack
  if (stack === DEFAULT_STACK) {
    await generateSendgridResources({ configDir, env });
  }
  const varFile = `../config/.env/${env}.json`;
  await generateOystehrResources({
    configDir: `${configDir}/oystehr`,
    coreConfigDir: `${configDir}/oystehr-core`,
    varFile,
    outputPath,
    env,
    stack,
  });
}

/**
 * Returns the list of stacks a resource entry belongs to. The `stack` field may be a
 * single stack name or a list of names; entries without one belong to the default stack.
 */
function stacksForResource(resource: unknown): string[] {
  const stack = isObject(resource) ? resource.stack : undefined;
  if (stack === undefined) {
    return [DEFAULT_STACK];
  }
  const stacks = Array.isArray(stack) ? stack : [stack];
  if (!stacks.length || !stacks.every((s) => typeof s === 'string' && validStacks.includes(s))) {
    throw new Error(`Invalid stack value: ${JSON.stringify(stack)}. Valid stacks are: ${validStacks.join(', ')}`);
  }
  return stacks;
}

/**
 * Filters a spec to the resources belonging to the requested stack, stripping the
 * `stack` field so it does not leak into generated Terraform configuration.
 */
function filterSpecByStack(spec: { [key: string]: unknown }, stack: string): { [key: string]: unknown } {
  if (!isObject(spec)) {
    return spec;
  }
  const filtered: { [key: string]: unknown } = {};
  for (const [key, value] of Object.entries(spec)) {
    if (!RESOURCE_TYPE_KEYS.includes(key) || !isObject(value)) {
      filtered[key] = value;
      continue;
    }
    const filteredResources: { [key: string]: unknown } = {};
    for (const [resourceName, resource] of Object.entries(value)) {
      if (stacksForResource(resource).includes(stack)) {
        if (isObject(resource)) {
          const { stack: _stack, ...rest } = resource;
          filteredResources[resourceName] = rest;
        } else {
          filteredResources[resourceName] = resource;
        }
      }
    }
    filtered[key] = filteredResources;
  }
  return filtered;
}
interface GenerateSendgridResources {
  configDir: string;
  env: string;
}

async function generateSendgridResources(input: GenerateSendgridResources): Promise<void> {
  const { configDir, env } = input;
  const templates = Object.values(SENDGRID_CONFIG.templates || {})
    .filter(Boolean)
    .reduce(
      (acc, entry) => {
        if (entry && entry.templateName) {
          const { templateName, ...rest } = entry;
          const keyName = `${templateName}`;
          acc[keyName] = rest;
        }
        return acc;
      },
      {} as Record<string, any>
    );
  let { projectName } = BRANDING_CONFIG;
  if (!projectName) {
    throw new Error('Project name is not defined');
  }
  projectName += `-${env}`;
  const tfModel = {
    projectName,
    featureFlag: FEATURE_FLAGS_CONFIG.sendgridEnabled,
    templates,
  };
  const stringifiedConfig = JSON.stringify(tfModel, null, 2);
  await fs.mkdir(`${configDir}/sendgrid`, { recursive: true });
  await fs.writeFile(`${configDir}/sendgrid/sendgrid.json`, stringifiedConfig, 'utf8');
}

interface GenerateFhirResourcesArgs {
  configDir: string;
  coreConfigDir: string;
  varFile: string;
  outputPath: string;
  env: string;
  stack?: string;
}
async function generateOystehrResources(input: GenerateFhirResourcesArgs): Promise<void> {
  const { configDir, coreConfigDir, varFile, outputPath, env, stack = DEFAULT_STACK } = input;

  if (!configDir) {
    throw new Error('Config directory is required.');
  }

  if (!varFile) {
    throw new Error('Variable file is required.');
  }

  if (!outputPath) {
    throw new Error('Output path is required.');
  }

  // Ensure output directory exists
  await fs.mkdir(outputPath, { recursive: true });

  // Read all spec files from the config directory
  const specFiles = await fs.readdir(configDir, { withFileTypes: true });
  const jsonSpecFiles = specFiles
    .filter((file) => file.isFile() && file.name.endsWith('.json'))
    .map((file) => path.join(configDir, file.name));

  // Read core config spec files if the directory exists
  try {
    const coreSpecFiles = await fs.readdir(coreConfigDir, { withFileTypes: true });
    const coreJsonSpecFiles = coreSpecFiles
      .filter((file) => file.isFile() && file.name.endsWith('.json'))
      .map((file) => path.join(coreConfigDir, file.name));
    jsonSpecFiles.push(...coreJsonSpecFiles);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    console.log(`No core config directory found at: ${coreConfigDir}`);
  }

  // Read environment-specific specs if directory exists
  const envConfigDir = path.join(configDir, 'env', env);
  try {
    const envDirStats = await fs.stat(envConfigDir);
    if (envDirStats.isDirectory()) {
      console.log(`Loading environment-specific configs from: ${envConfigDir}`);
      const envSpecFiles = await fs.readdir(envConfigDir, { withFileTypes: true });
      const envJsonSpecFiles = envSpecFiles
        .filter((file) => file.isFile() && file.name.endsWith('.json'))
        .map((file) => path.join(envConfigDir, file.name));

      jsonSpecFiles.push(...envJsonSpecFiles);
    }
  } catch (err: any) {
    // ONLY ignore "directory not found" - propagate other errors
    if (err.code !== 'ENOENT') {
      throw err;
    }
    console.log(`No environment-specific config directory for: ${env}`);
  }

  const specs: SpecFile[] = await Promise.all(
    jsonSpecFiles.map(async (file) => {
      const content = await fs.readFile(file, 'utf-8');
      let spec: { [key: string]: unknown };
      try {
        spec = JSON.parse(content) as { [key: string]: unknown };
      } catch (err) {
        throw new Error(`Error parsing JSON file ${file}: ${err}`);
      }
      return { path: file, spec: filterSpecByStack(spec, stack) };
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

  let vars: any;
  try {
    vars = JSON.parse(await fs.readFile(varFile, 'utf-8'));
  } catch (err) {
    throw new Error(`Error parsing variable file ${varFile}: ${err}`);
  }
  if (!isObject(vars)) {
    throw new Error(`Variable file ${varFile} is not a valid JSON map.`);
  }

  // Generate resources for specs
  if (schemaVersion === '2025-03-19') {
    const schema = new Schema20250319(specs, vars, outputPath, zambdasDirPath);
    await schema.generate();
  }
  if (schemaVersion === '2025-09-25') {
    const schema = new Schema20250925(specs, vars, outputPath, zambdasDirPath);
    await schema.generate();
  }
}

function isObject(spec: any): spec is { [key: string]: unknown } {
  return spec && typeof spec === 'object' && !Array.isArray(spec);
}

interface GenerateResourcesArgs {
  configDir: string;
  env: string;
  outputPath: string;
  stack: string;
}

const validateInput = (): GenerateResourcesArgs => {
  const args = process.argv.slice(2);
  if (args.length !== 3 && args.length !== 4) {
    throw new Error('Usage: tsx generate-oystehr-resources.ts <config-dir> <env> <output-path> [stack]');
  }

  const [configDir, env, outputPath, stack = DEFAULT_STACK] = args;

  console.log('env', env);
  console.log('stack', stack);

  if (!configDir) {
    throw new Error('Config directory is required.');
  }

  if (!env) {
    throw new Error('Environment is required.');
  }

  if (!outputPath) {
    throw new Error('Output path is required.');
  }

  if (!validStacks.includes(stack)) {
    throw new Error(`Invalid stack: ${stack}. Valid stacks are: ${validStacks.join(', ')}`);
  }

  return { configDir, env, outputPath, stack };
};

// Export for testing
export {
  filterSpecByStack,
  generate,
  generateOystehrResources,
  isObject,
  stacksForResource,
  validateInput,
  validSchemas,
  validStacks,
  type GenerateResourcesArgs,
  type GenerateFhirResourcesArgs,
};

// Only run when executed directly (not when imported for testing)
const isMainModule = require.main === module || process.argv[1]?.endsWith('generate-oystehr-resources.ts');

if (isMainModule) {
  const validatedArgs = validateInput();
  generate(validatedArgs)
    .then(() => {
      console.log('Done!');
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
