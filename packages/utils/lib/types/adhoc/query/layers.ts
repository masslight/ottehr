// Opt-in data layers (columns loaded on demand).
export interface AdHocLayer {
  id: string;
  label: string;
  description?: string;
  default?: boolean;
}

export type LayerSelection<Id extends string = string> = Partial<Record<Id, boolean>>;
