#! npx tsx

import fs from 'fs';

interface FhirResource {
  managedFields?: any;
  [key: string]: any;
}

interface InputData {
  fhirResources: Record<string, FhirResource>;
  [key: string]: any;
}

function transformResource(resource: FhirResource): FhirResource {
  const { managedFields, ...rest } = resource;
  if (Object.keys(rest).length === 1 && rest.resource) {
    return {
      ...(managedFields ? { managedFields } : {}),
      resource: rest.resource,
    };
  }
  return {
    ...(managedFields ? { managedFields } : {}),
    resource: { ...rest },
  };
}

async function main(): Promise<void> {
  try {
    const filePath = process.argv[2];

    if (!filePath) {
      console.error('Please provide a JSON file path');
      process.exit(1);
    }

    // Read and parse JSON
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const data: InputData = JSON.parse(fileContent);

    // Update schema version
    data['schema-version'] = '2025-09-25';

    // Transform FHIR resources -- nest resource data under `resource` property
    if (data.fhirResources) {
      for (const key in data.fhirResources) {
        data.fhirResources[key] = transformResource(data.fhirResources[key]);
      }
    }

    // Write transformed data back to file
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log('Transformation complete');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

void main();
