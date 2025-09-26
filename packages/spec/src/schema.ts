export type SpecFile = { path: string; spec: { [key: string]: unknown } };

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
