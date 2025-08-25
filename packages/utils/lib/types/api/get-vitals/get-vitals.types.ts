export interface ObservationComponent {
  code: {
    text: string;
  };
  valueString?: string;
  valueInteger?: number;
}

export interface Observation {
  id: string;
  code: string;
  status: string;
  effectiveDateTime?: string;
  components: ObservationComponent[];
}

export interface VitalsData {
  message: string;
  observations: Observation[];
  total: number;
}
