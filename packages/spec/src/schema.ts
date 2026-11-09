export type SpecFile = { path: string; spec: { [key: string]: unknown } };

type TerraformResources = {
  resource: Record<string, Record<string, Record<string, unknown>>>;
};

// Expose configured inputs so overrides can extend them without referencing the resource itself.
export function withConfigLocals(config: TerraformResources): TerraformResources & {
  locals: Record<string, Record<string, unknown>>;
} {
  const locals: Record<string, Record<string, unknown>> = {};
  for (const [resourceType, resources] of Object.entries(config.resource)) {
    for (const [name, attributes] of Object.entries(resources)) {
      locals[`${resourceType}_${name}_config`] = Object.fromEntries(
        Object.entries(attributes).filter(([key]) => key !== 'depends_on')
      );
    }
  }
  return { ...config, locals };
}

export abstract class Schema<T> {
  abstract getSchemaVersion(): string;
  abstract validate(specFile: SpecFile): T;
  abstract generate(): Promise<void>;
  abstract getValue(value: any, vars: { [key: string]: any }, resources: any): any;
  abstract replaceVariableWithValue(value: string): string;
  abstract getTerraformResourceReference(
    spec: T,
    resourceType: keyof T,
    resourceName: string,
    fieldName: string
  ): string | null;
  abstract getTerraformResourceOutputName(fullMatch: string, module?: string): string;
}
