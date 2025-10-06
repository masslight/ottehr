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
  await generateOystehrResources({ configDir: `${configDir}/oystehr`, varFile, outputPath });
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
}
async function generateOystehrResources(input: GenerateFhirResourcesArgs): Promise<void> {
  const { configDir, varFile, outputPath } = input;

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

const validatedArgs = validateInput();
generate(validatedArgs)
  .then(() => {
    console.log('Done!');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
