/**
 * Generates Terraform JSON configuration files from Ottehr spec files.
 *
 * This script reads JSON spec files from config/oystehr/ and optionally from
 * config/oystehr/env/<env>/ for environment-specific resources, then generates
 * Terraform-compatible JSON files in the output directory.
 *
 * Usage: tsx generate-oystehr-resources.ts <config-dir> <env> <output-path>
 *
 * @see packages/spec/README.md for schema documentation
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { BRANDING_CONFIG, SENDGRID_CONFIG } from 'utils';
import { SpecFile } from '../packages/spec/src/schema';
import { Schema20250319 } from '../packages/spec/src/schema-20250319';
import { Schema20250925 } from '../packages/spec/src/schema-20250925';

const validSchemas = ['2025-03-19', '2025-09-25'];

const zambdasDirPath = path.resolve(__dirname, '../packages/zambdas');

// args

async function generate(input: GenerateResourcesArgs): Promise<void> {
  const { configDir, env, outputPath } = input;
  await generateSendgridResources({ configDir, env });
  const varFile = `../packages/zambdas/.env/${env}.json`;
  await generateOystehrResources({ configDir: `${configDir}/oystehr`, varFile, outputPath, env });
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
    templates,
  };
  const stringifiedConfig = JSON.stringify(tfModel, null, 2);
  await fs.mkdir(`${configDir}/sendgrid`, { recursive: true });
  await fs.writeFile(`${configDir}/sendgrid/sendgrid.json`, stringifiedConfig, 'utf8');
}

interface GenerateFhirResourcesArgs {
  configDir: string;
  varFile: string;
  outputPath: string;
  env: string;
}
async function generateOystehrResources(input: GenerateFhirResourcesArgs): Promise<void> {
  const { configDir, varFile, outputPath, env } = input;

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
      try {
        return { path: file, spec: JSON.parse(content) as { [key: string]: unknown } };
      } catch (err) {
        throw new Error(`Error parsing JSON file ${file}: ${err}`);
      }
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
}

const validateInput = (): GenerateResourcesArgs => {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    throw new Error('Usage: tsx generate-oystehr-resources.ts <config-dir> <env> <output-path>');
  }

  const [configDir, env, outputPath] = args;

  console.log('env', env);

  if (!configDir) {
    throw new Error('Config directory is required.');
  }

  if (!env) {
    throw new Error('Environment is required.');
  }

  if (!outputPath) {
    throw new Error('Output path is required.');
  }

  return { configDir, env, outputPath };
};

// Export for testing
export {
  generate,
  generateOystehrResources,
  isObject,
  validateInput,
  validSchemas,
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
