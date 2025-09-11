import fs from 'node:fs/promises';
import path from 'node:path';
import { Schema, SpecFile } from './schema';

export const VAR_REGEX = /#\{var\/([^}]+)\}/g;
export const REF_REGEX = /#\{ref\/([^}/]+)\/([^}/]+)\/([^}]+)\}/g;

export type Spec20250319 = {
  apps: { [key: string]: any };
  buckets: { [key: string]: any };
  fhirResources: { [key: string]: any };
  labRoutes: { [key: string]: any };
  m2ms: { [key: string]: any };
  roles: { [key: string]: any };
  secrets: { [key: string]: any };
  zambdas: { [key: string]: any };
};

export class Schema20250319 implements Schema<Spec20250319> {
  private specFiles: SpecFile[];
  private vars: { [key: string]: any };
  private outputPath: string;
  private zambdasDirPath: string;
  constructor(specFiles: SpecFile[], vars: { [key: string]: any }, outputPath: string, zambdasDirPath: string) {
    this.specFiles = specFiles;
    this.vars = vars;
    this.outputPath = outputPath;
    this.zambdasDirPath = zambdasDirPath;
  }

  getSchemaVersion(): string {
    return '2025-03-19';
  }

  validate(specFile: SpecFile): Spec20250319 {
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
    return spec as Spec20250319;
  }

  async generate(): Promise<void> {
    const resources: Spec20250319 = {
      apps: {},
      buckets: {},
      fhirResources: {},
      labRoutes: {},
      m2ms: {},
      roles: {},
      secrets: {},
      zambdas: {},
    };
    for (const [_, specFile] of this.specFiles.entries()) {
      const spec = this.validate(specFile);
      resources.apps = { ...resources.apps, ...(spec.apps as object) };
      resources.buckets = { ...resources.buckets, ...(spec.buckets as object) };
      resources.fhirResources = { ...resources.fhirResources, ...(spec.fhirResources as object) };
      resources.labRoutes = { ...resources.labRoutes, ...(spec.labRoutes as object) };
      resources.m2ms = { ...resources.m2ms, ...(spec.m2ms as object) };
      resources.roles = { ...resources.roles, ...(spec.roles as object) };
      resources.secrets = { ...resources.secrets, ...(spec.secrets as object) };
      resources.zambdas = { ...resources.zambdas, ...(spec.zambdas as object) };
    }

    const outputsOutFile = path.join(this.outputPath, 'outputs.tf.json');
    const outputDirectives: { output: { [key: string]: { value: any } } } = { output: {} };
    const refMatches = [...JSON.stringify(resources).matchAll(REF_REGEX)];
    console.log(`Found ${refMatches.length} references in specs.`);
    for (const [fullMatch, resourceType, resourceName, fieldName] of refMatches) {
      const tfRef = this.getTerraformResourceReference(
        resources,
        resourceType as keyof Spec20250319,
        resourceName,
        fieldName
      );
      if (tfRef) {
        console.log(`Reference ${fullMatch} resolved to ${tfRef}`);
        const tfOutputName = this.getTerraformResourceOutputName(fullMatch);
        outputDirectives.output[tfOutputName] = { value: `\${${tfRef}}` };
      } else {
        console.log('Warning: could not resolve reference', fullMatch);
      }
    }
    await fs.writeFile(outputsOutFile, JSON.stringify(outputDirectives, null, 2));

    // Write out resources
    const appOutFile = path.join(this.outputPath, 'apps.tf.json');
    const appResources: { resource: { oystehr_application: { [key: string]: any } } } = {
      resource: { oystehr_application: {} },
    };
    for (const [appName, app] of Object.entries(resources.apps)) {
      appResources.resource.oystehr_application[appName] = {
        name: this.getValue(app.name, resources),
        description: this.getValue(app.description, resources),
        login_redirect_uri: this.getValue(app.loginRedirectUri, resources),
        login_with_email_enabled: this.getValue(app.loginWithEmailEnabled, resources),
        allowed_callback_urls: JSON.parse(this.getValue(JSON.stringify(app.allowedCallbackUrls ?? []), resources)),
        allowed_logout_urls: JSON.parse(this.getValue(JSON.stringify(app.allowedLogoutUrls ?? []), resources)),
        allowed_web_origins_urls: JSON.parse(this.getValue(JSON.stringify(app.allowedWebOriginsUrls ?? []), resources)),
        allowed_cors_origins_urls: JSON.parse(
          this.getValue(JSON.stringify(app.allowedCorsOriginsUrls ?? []), resources)
        ),
        passwordless_sms: this.getValue(app.passwordlessSMS, resources),
        mfa_enabled: this.getValue(app.mfaEnabled, resources),
        should_send_invite_email: this.getValue(app.shouldSendInviteEmail, resources),
        logo_uri: this.getValue(app.logoUri, resources),
        refresh_token_enabled: this.getValue(app.refreshTokenEnabled, resources),
      };
    }
    await fs.writeFile(appOutFile, JSON.stringify(appResources, null, 2));

    const bucketOutFile = path.join(this.outputPath, 'buckets.tf.json');
    const bucketResources: { resource: { oystehr_z3_bucket: { [key: string]: any } } } = {
      resource: { oystehr_z3_bucket: {} },
    };
    for (const [bucketName, bucket] of Object.entries(resources.buckets)) {
      bucketResources.resource.oystehr_z3_bucket[bucketName] = {
        name: this.getValue(bucket.name, resources),
      };
    }
    await fs.writeFile(bucketOutFile, JSON.stringify(bucketResources, null, 2));

    const fhirOutFile = path.join(this.outputPath, 'fhir-resources.tf.json');
    const fhirResources: { resource: { oystehr_fhir_resource: { [key: string]: any } } } = {
      resource: { oystehr_fhir_resource: {} },
    };
    for (const [resourceKey, resource] of Object.entries(resources.fhirResources)) {
      const resourceData = structuredClone(resource);
      const managedFields = resourceData.managedFields ?? undefined;
      delete resourceData.managedFields;
      fhirResources.resource.oystehr_fhir_resource[resourceKey] = {
        type: this.getValue(resource.resourceType, resources),
        data: JSON.parse(this.getValue(JSON.stringify(resourceData), resources)),
        managed_fields: managedFields,
      };
    }
    await fs.writeFile(fhirOutFile, JSON.stringify(fhirResources, null, 2));

    const labRoutesOutFile = path.join(this.outputPath, 'lab-routes.tf.json');
    const labRoutesResources: { resource: { oystehr_lab_route: { [key: string]: any } } } = {
      resource: { oystehr_lab_route: {} },
    };
    for (const [routeName, route] of Object.entries(resources.labRoutes)) {
      labRoutesResources.resource.oystehr_lab_route[routeName] = {
        account_number: this.getValue(route.accountNumber, resources),
        lab_id: this.getValue(route.labId, resources),
      };
    }
    await fs.writeFile(labRoutesOutFile, JSON.stringify(labRoutesResources, null, 2));

    const m2msOutFile = path.join(this.outputPath, 'm2ms.tf.json');
    const m2mResources: { resource: { oystehr_m2m: { [key: string]: any } } } = {
      resource: { oystehr_m2m: {} },
    };
    for (const [m2mName, m2m] of Object.entries(resources.m2ms)) {
      m2mResources.resource.oystehr_m2m[m2mName] = {
        name: this.getValue(m2m.name, resources),
        description: this.getValue(m2m.description, resources),
        access_policy: {
          rule: JSON.parse(this.getValue(JSON.stringify(m2m.accessPolicy), resources)),
        },
        roles: this.getValue(m2m.roles, resources),
        jwks_url: this.getValue(m2m.jwksUrl, resources),
      };
    }
    await fs.writeFile(m2msOutFile, JSON.stringify(m2mResources, null, 2));

    const rolesOutFile = path.join(this.outputPath, 'roles.tf.json');
    const roleResources: { resource: { oystehr_role: { [key: string]: any } } } = {
      resource: { oystehr_role: {} },
    };
    for (const [roleName, role] of Object.entries(resources.roles)) {
      roleResources.resource.oystehr_role[roleName] = {
        name: this.getValue(role.name, resources),
        description: this.getValue(role.description, resources),
        access_policy: {
          rule: JSON.parse(this.getValue(JSON.stringify(role.accessPolicy), resources)),
        },
      };
    }
    await fs.writeFile(rolesOutFile, JSON.stringify(roleResources, null, 2));

    const secretsOutFile = path.join(this.outputPath, 'secrets.tf.json');
    const secretResources: { resource: { oystehr_secret: { [key: string]: any } } } = {
      resource: { oystehr_secret: {} },
    };
    for (const [secretName, secret] of Object.entries(resources.secrets)) {
      secretResources.resource.oystehr_secret[secretName] = {
        name: this.getValue(secret.name, resources),
        value: this.getValue(secret.value, resources),
      };
    }
    await fs.writeFile(secretsOutFile, JSON.stringify(secretResources, null, 2));

    const zambdasOutFile = path.join(this.outputPath, 'zambdas.tf.json');
    const zambdaResources: { resource: { oystehr_zambda: { [key: string]: any } } } = {
      resource: { oystehr_zambda: {} },
    };
    for (const [zambdaName, zambda] of Object.entries(resources.zambdas)) {
      zambdaResources.resource.oystehr_zambda[zambdaName] = {
        name: this.getValue(zambda.name, resources),
        runtime: this.getValue(zambda.runtime, resources),
        memory_size: this.getValue(zambda.memorySize, resources),
        timeout: this.getValue(zambda.timeout, resources),
        trigger_method: this.getValue(zambda.type, resources),
        schedule: this.getValue(zambda.schedule, resources),
        source: path.join(this.zambdasDirPath, this.getValue(zambda.zip, resources)),
      };
    }
    await fs.writeFile(zambdasOutFile, JSON.stringify(zambdaResources, null, 2));
  }

  getValue(value: any, spec: Spec20250319): any {
    if (typeof value !== 'string') {
      return value;
    }
    const varReplacedValue = this.replaceVariableWithValue(value);
    const refReplacedValue = varReplacedValue.replace(
      REF_REGEX,
      (match: string, resourceType: string, resourceName: string, fieldName: string) => {
        const tfRef = this.getTerraformResourceReference(
          spec,
          resourceType as keyof Spec20250319,
          resourceName,
          fieldName
        );
        if (tfRef) {
          return `\${${tfRef}}`;
        }
        return match;
      }
    );
    return refReplacedValue;
  }

  replaceVariableWithValue(value: string): string {
    return value.replace(VAR_REGEX, (match: string, varName: string) => {
      if (Object.prototype.hasOwnProperty.call(this.vars, varName)) {
        return this.vars[varName];
      }
      return match;
    });
  }

  getTerraformResourceReference(
    spec: Spec20250319,
    resourceType: keyof Spec20250319,
    resourceName: string,
    fieldName: string
  ): string | null {
    if (this.isResourceType(resourceType) && Object.prototype.hasOwnProperty.call(spec[resourceType], resourceName)) {
      const oystehrResource = this.oystehrResourceFromResourceType(resourceType);
      return `${oystehrResource}.${resourceName}.${fieldName}`;
    }
    return null;
  }

  oystehrResourceFromResourceType(resourceType: keyof Spec20250319): string {
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

  isResourceType(resourceType: string): resourceType is keyof Spec20250319 {
    return ['apps', 'buckets', 'fhirResources', 'labRoutes', 'm2ms', 'roles', 'secrets', 'zambdas'].includes(
      resourceType
    );
  }

  getTerraformResourceOutputName(fullMatch: string, module?: string): string {
    return `${module ? `module.${module}.` : ''}${fullMatch.replace(/\//g, '_').slice(2, -1)}`;
  }

  isObject(spec: any): spec is { [key: string]: unknown } {
    return spec && typeof spec === 'object' && !Array.isArray(spec);
  }
}
