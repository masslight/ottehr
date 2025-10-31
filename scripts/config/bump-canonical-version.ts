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

async function main(): Promise<void> {
  try {
    const latestFilePath = process.argv[2];
    const bumpTypeOrKey = process.argv[3];
    const maybeBumpType = process.argv[4];
    let maybeKey: string;
    let bumpType: string;
    if (maybeBumpType) {
      bumpType = maybeBumpType ?? 'patch';
      maybeKey = bumpTypeOrKey;
    } else {
      bumpType = bumpTypeOrKey ?? 'patch';
    }
    if (!latestFilePath) {
      console.error('Please provide a canonical resource JSON file path');
      process.exit(1);
    }
    if (!['patch', 'minor', 'major'].includes(bumpType)) {
      console.error('Bump type must be one of: patch, minor, major');
      process.exit(1);
    }
    const archiveFilePath = latestFilePath.replace('.json', '-archive.json');

    // Read and parse JSON
    const fileContent = await fs.promises.readFile(latestFilePath, 'utf-8');
    const data: InputData = JSON.parse(fileContent);
    let archiveFileContent;
    try {
      archiveFileContent = await fs.promises.readFile(archiveFilePath, 'utf-8');
    } catch {
      console.warn(`Archive file not found at ${archiveFilePath}, a new one will be created.`);
    }
    let archiveData: InputData = { fhirResources: {} };
    if (archiveFileContent) {
      archiveData = JSON.parse(archiveFileContent);
    }

    // Validate input
    if (!data.fhirResources) {
      console.error('No fhirResources found in the provided file');
      process.exit(1);
    }
    if (!archiveData.fhirResources) {
      console.error('No fhirResources found in the archive file');
      process.exit(1);
    }

    // Find canonical resources to bump by looking for those with an url and version field
    const toBump = Object.entries(data.fhirResources).filter(
      ([key, resource]) =>
        resource.resource && resource.resource.url && resource.resource.version && (!maybeKey || key === maybeKey)
    );
    if (toBump.length === 0) {
      console.error('The provided file must at least one fhirResource with an url and version field');
      process.exit(1);
    }

    const newFhirResources = structuredClone(data.fhirResources);
    for (const [resourceKey, originalResourceValue] of toBump) {
      const resourceValue = structuredClone(originalResourceValue);
      delete newFhirResources[resourceKey];
      const resource = resourceValue.resource;

      // Stash resource and key
      archiveData.fhirResources[resourceKey] = structuredClone(resourceValue);
      // Mark only some resources as retired
      if (
        ['ActivityDefinition'].includes(archiveData.fhirResources[resourceKey].resource.resourceType) &&
        archiveData.fhirResources[resourceKey].resource.status
      ) {
        archiveData.fhirResources[resourceKey].resource.status = 'retired';
      }
      const currentVersion: string = resource.version;

      // Bump version
      const versionParts = currentVersion.split('.');
      if (versionParts.length !== 3 || versionParts.some((part: string) => isNaN(Number(part)))) {
        console.error(`Resource ${resourceKey} has an invalid version format`);
        process.exit(1);
      }
      let [major, minor, patch] = versionParts.map(Number);
      if (bumpType === 'patch') {
        patch += 1;
      } else if (bumpType === 'minor') {
        minor += 1;
        patch = 0;
      } else if (bumpType === 'major') {
        major += 1;
        minor = 0;
        patch = 0;
      }
      const newVersion = [major, minor, patch].join('.');

      // Update version in resource and key
      resource.version = newVersion;
      const newKey = resourceKey.replace(currentVersion.replaceAll('.', '_'), newVersion.replaceAll('.', '_'));
      newFhirResources[newKey] = { ...resourceValue, ...{ resource } };
    }

    // Write transformed data back to file
    await fs.promises.writeFile(latestFilePath, JSON.stringify({ ...data, fhirResources: newFhirResources }, null, 2));
    // Update archive file
    await fs.promises.writeFile(archiveFilePath, JSON.stringify(archiveData, null, 2));
    console.log('Version bump complete');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

void main();
