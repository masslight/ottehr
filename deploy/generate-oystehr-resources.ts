import fs from 'node:fs/promises';
import path from 'node:path';
import { Schema20250319 } from '../packages/spec/src/schema-20250319';
import { SpecFile } from '../packages/spec/src/schema';

const validSchemas = [
  '2025-03-19'
];

const zambdasDirPath = path.resolve(__dirname, '../packages/zambdas');

// args
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error('Usage: tsx generate-oystehr-resources.ts <config-dir> <var-file> <output-path>');
  process.exit(1);
}

async function generate(): Promise<void> {
  const [configDir, varFile, outputPath] = args;

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
  if (
    !schemaVersion ||
    !(typeof schemaVersion === 'string') ||
    !validSchemas.includes(schemaVersion)
  ) {
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
}

function isObject(spec: any): spec is { [key: string]: unknown } {
  return spec && typeof spec === 'object' && !Array.isArray(spec);
}

generate()
  .then(() => {
    console.log('Done!');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
