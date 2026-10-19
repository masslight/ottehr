export interface PreliminaryReadChoiceList {
  title: string;
  options: string[];
  childDefault?: string;
  childOnly?: boolean;
  childOnlyOptions?: string[];
  mustPick?: boolean;
  emptyWhen?: string[];
}

export interface PreliminaryReadTemplate {
  name: string;
  text: string;
}

export interface PreliminaryReadRegion {
  name: string;
  cptCodes: string[];
  templates: PreliminaryReadTemplate[];
}

export interface PreliminaryReadTemplatesConfig {
  choices: Record<string, PreliminaryReadChoiceList>;
  regions: PreliminaryReadRegion[];
  conflicts: [string, string][];
}
