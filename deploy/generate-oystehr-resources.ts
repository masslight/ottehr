import fs from 'node:fs/promises';
import path from 'node:path';

const validSchemas: { [key: string]: (spec: any, vars: any, outputPath: string) => Promise<void> } = {
  '2025-03-19': generate20250319,
};

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

  const specs = await Promise.all(
    jsonSpecFiles.map(async (file) => {
      const content = await fs.readFile(file, 'utf-8');
      return { path: file, spec: JSON.parse(content) as unknown };
    })
  );

  if (!specs.every((spec) => isObject(spec) && isObject(spec.spec))) {
    throw new Error('One or more spec files are not valid JSON maps.');
  }
  const schemaVersion = isObject(specs[0].spec) && specs[0].spec['schema-version'];
  if (
    !schemaVersion ||
    !(typeof schemaVersion === 'string') ||
    !Object.prototype.hasOwnProperty.call(validSchemas, schemaVersion)
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
  await validSchemas[schemaVersion](specs, vars, outputPath);
}

type ValidSpec20250319 = {
  apps: { [key: string]: any };
  buckets: { [key: string]: any };
  fhirResources: { [key: string]: any };
  labRoutes: { [key: string]: any };
  m2ms: { [key: string]: any };
  roles: { [key: string]: any };
  secrets: { [key: string]: any };
  zambdas: { [key: string]: any };
};

async function generate20250319(
  specs: { path: string; spec: { [key: string]: any } }[],
  vars: { [key: string]: any },
  outputPath: string
): Promise<void> {
  const resources: ValidSpec20250319 = {
    apps: {},
    buckets: {},
    fhirResources: {},
    labRoutes: {},
    m2ms: {},
    roles: {},
    secrets: {},
    zambdas: {},
  };
  for (const [_, specFile] of specs.entries()) {
    const spec = validateSpec20250319(specFile);
    resources.apps = { ...resources.apps, ...(spec.apps as object) };
    resources.buckets = { ...resources.buckets, ...(spec.buckets as object) };
    resources.fhirResources = { ...resources.fhirResources, ...(spec.fhirResources as object) };
    resources.labRoutes = { ...resources.labRoutes, ...(spec.labRoutes as object) };
    resources.m2ms = { ...resources.m2ms, ...(spec.m2ms as object) };
    resources.roles = { ...resources.roles, ...(spec.roles as object) };
    resources.secrets = { ...resources.secrets, ...(spec.secrets as object) };
    resources.zambdas = { ...resources.zambdas, ...(spec.zambdas as object) };
  }

  // Write out resources
  const appOutFile = path.join(outputPath, 'apps.tf.json');
  const appResources: { resource: { oystehr_application: { [key: string]: any } } } = {
    resource: { oystehr_application: {} },
  };
  for (const [appName, app] of Object.entries(resources.apps)) {
    appResources.resource.oystehr_application[appName] = {
      name: getValue(app.name, vars, resources),
      description: getValue(app.description, vars, resources),
      login_redirect_uri: getValue(app.loginRedirectUri, vars, resources),
      login_with_email_enabled: getValue(app.loginWithEmailEnabled, vars, resources),
      allowed_callback_urls: JSON.parse(getValue(JSON.stringify(app.allowedCallbackUrls ?? []), vars, resources)),
      allowed_logout_urls: JSON.parse(getValue(JSON.stringify(app.allowedLogoutUrls ?? []), vars, resources)),
      allowed_web_origins_urls: JSON.parse(getValue(JSON.stringify(app.allowedWebOriginsUrls ?? []), vars, resources)),
      allowed_cors_origins_urls: JSON.parse(
        getValue(JSON.stringify(app.allowedCorsOriginsUrls ?? []), vars, resources)
      ),
      passwordless_sms: getValue(app.passwordlessSMS, vars, resources),
      mfa_enabled: getValue(app.mfaEnabled, vars, resources),
      should_send_invite_email: getValue(app.shouldSendInviteEmail, vars, resources),
      logo_uri: getValue(app.logoUri, vars, resources),
      refresh_token_enabled: getValue(app.refreshTokenEnabled, vars, resources),
    };
  }
  await fs.writeFile(appOutFile, JSON.stringify(appResources, null, 2));

  const bucketOutFile = path.join(outputPath, 'buckets.tf.json');
  const bucketResources: { resource: { oystehr_z3_bucket: { [key: string]: any } } } = {
    resource: { oystehr_z3_bucket: {} },
  };
  for (const [bucketName, bucket] of Object.entries(resources.buckets)) {
    bucketResources.resource.oystehr_z3_bucket[bucketName] = {
      name: getValue(bucket.name, vars, resources),
    };
  }
  await fs.writeFile(bucketOutFile, JSON.stringify(bucketResources, null, 2));

  const fhirOutFile = path.join(outputPath, 'fhir-resources.tf.json');
  const fhirResources: { resource: { oystehr_fhir_resource: { [key: string]: any } } } = {
    resource: { oystehr_fhir_resource: {} },
  };
  for (const [resourceKey, resource] of Object.entries(resources.fhirResources)) {
    fhirResources.resource.oystehr_fhir_resource[resourceKey] = {
      type: getValue(resource.resourceType, vars, resources),
      data: JSON.parse(getValue(JSON.stringify(resource), vars, resources)),
    };
  }
  await fs.writeFile(fhirOutFile, JSON.stringify(fhirResources, null, 2));

  const labRoutesOutFile = path.join(outputPath, 'lab-routes.tf.json');
  const labRoutesResources: { resource: { oystehr_lab_route: { [key: string]: any } } } = {
    resource: { oystehr_lab_route: {} },
  };
  for (const [routeName, route] of Object.entries(resources.labRoutes)) {
    labRoutesResources.resource.oystehr_lab_route[routeName] = {
      account_number: getValue(route.accountNumber, vars, resources),
      lab_id: getValue(route.labId, vars, resources),
    };
  }
  await fs.writeFile(labRoutesOutFile, JSON.stringify(labRoutesResources, null, 2));

  const m2msOutFile = path.join(outputPath, 'm2ms.tf.json');
  const m2mResources: { resource: { oystehr_m2m: { [key: string]: any } } } = {
    resource: { oystehr_m2m: {} },
  };
  for (const [m2mName, m2m] of Object.entries(resources.m2ms)) {
    m2mResources.resource.oystehr_m2m[m2mName] = {
      name: getValue(m2m.name, vars, resources),
      description: getValue(m2m.description, vars, resources),
      access_policy: {
        rule: JSON.parse(getValue(JSON.stringify(m2m.accessPolicy), vars, resources)),
      },
      roles: getValue(m2m.roles, vars, resources),
      jwks_url: getValue(m2m.jwksUrl, vars, resources),
    };
  }
  await fs.writeFile(m2msOutFile, JSON.stringify(m2mResources, null, 2));

  const rolesOutFile = path.join(outputPath, 'roles.tf.json');
  const roleResources: { resource: { oystehr_role: { [key: string]: any } } } = {
    resource: { oystehr_role: {} },
  };
  for (const [roleName, role] of Object.entries(resources.roles)) {
    roleResources.resource.oystehr_role[roleName] = {
      name: getValue(role.name, vars, resources),
      description: getValue(role.description, vars, resources),
      access_policy: {
        rule: JSON.parse(getValue(JSON.stringify(role.accessPolicy), vars, resources)),
      },
    };
  }
  await fs.writeFile(rolesOutFile, JSON.stringify(roleResources, null, 2));

  const secretsOutFile = path.join(outputPath, 'secrets.tf.json');
  const secretResources: { resource: { oystehr_secret: { [key: string]: any } } } = {
    resource: { oystehr_secret: {} },
  };
  for (const [secretName, secret] of Object.entries(resources.secrets)) {
    secretResources.resource.oystehr_secret[secretName] = {
      name: getValue(secret.name, vars, resources),
      value: getValue(secret.value, vars, resources),
    };
  }
  await fs.writeFile(secretsOutFile, JSON.stringify(secretResources, null, 2));

  const zambdasOutFile = path.join(outputPath, 'zambdas.tf.json');
  const zambdaResources: { resource: { oystehr_zambda: { [key: string]: any } } } = {
    resource: { oystehr_zambda: {} },
  };
  for (const [zambdaName, zambda] of Object.entries(resources.zambdas)) {
    zambdaResources.resource.oystehr_zambda[zambdaName] = {
      name: getValue(zambda.name, vars, resources),
      runtime: getValue(zambda.runtime, vars, resources),
      memory_size: getValue(zambda.memorySize, vars, resources),
      timeout: getValue(zambda.timeout, vars, resources),
      trigger_method: getValue(zambda.type, vars, resources),
      schedule: getValue(zambda.schedule, vars, resources),
      source: path.join(zambdasDirPath, getValue(zambda.zip, vars, resources)),
    };
  }
  await fs.writeFile(zambdasOutFile, JSON.stringify(zambdaResources, null, 2));
}

function validateSpec20250319(specFile: { path: string; spec: { [key: string]: unknown } }): ValidSpec20250319 {
  const spec = specFile.spec;
  for (const key of Object.keys(spec)) {
    if (
      ![
        'schema-version',
        'apps',
        'buckets',
        'fhirResources',
        'labRoutes',
        'm2ms',
        'roles',
        'secrets',
        'zambdas',
      ].includes(key)
    ) {
      throw new Error(`${specFile.path} has unknown top-level key: ${key}`);
    }
  }
  if (
    !['apps', 'buckets', 'fhirResources', 'labRoutes', 'm2ms', 'roles', 'secrets', 'zambdas'].some((key) =>
      Object.prototype.hasOwnProperty.call(spec, key)
    )
  ) {
    throw new Error(
      `${specFile.path} must have at least one of the following top-level keys: apps, buckets, fhirResources, labRoutes, m2ms, roles, secrets, zambdas.`
    );
  }
  return spec as unknown as ValidSpec20250319;
}

function getValue(value: any, vars: { [key: string]: any }, resources: ValidSpec20250319): any {
  if (typeof value !== 'string') {
    return value;
  }
  const varReplacedValue = value.replace(/#\{var\/([^}]+)\}/g, (match: string, varName: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, varName)) {
      return vars[varName];
    }
    return match;
  });
  const refReplacedValue = varReplacedValue.replace(
    /#\{ref\/([^}/]+)\/([^}/]+)\/([^}]+)\}/g,
    (match: string, resourceType: string, resourceName: string, fieldName: string) => {
      if (isResourceType(resourceType) && Object.prototype.hasOwnProperty.call(resources[resourceType], resourceName)) {
        const oystehrResource = oystehrResourceFromResourceType(resourceType);
        return `\${${oystehrResource}.${resourceName}.${fieldName}}`;
      }
      return match;
    }
  );
  return refReplacedValue;
}

function oystehrResourceFromResourceType(resourceType: keyof ValidSpec20250319): string {
  switch (resourceType) {
    case 'apps':
      return 'oystehr_application';
    case 'buckets':
      return 'oystehr_z3_bucket';
    case 'fhirResources':
      return 'oystehr_fhir_resource';
    case 'labRoutes':
      return 'oystehr_lab_route';
    case 'm2ms':
      return 'oystehr_m2m';
    case 'roles':
      return 'oystehr_role';
    case 'secrets':
      return 'oystehr_secret';
    case 'zambdas':
      return 'oystehr_zambda';
    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
}

function isResourceType(resourceType: string): resourceType is keyof ValidSpec20250319 {
  return ['apps', 'buckets', 'fhirResources', 'labRoutes', 'm2ms', 'roles', 'secrets', 'zambdas'].includes(
    resourceType
  );
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
