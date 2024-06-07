export type InstructionType = 'provider' | 'organization';

export interface PatientInstruction {
  id?: string;
  text: string;
  type: InstructionType;
}

export interface GetPatientInstructionsInput {
  type: InstructionType;
}

export interface SavePatientInstructionInput {
  id?: string;
  text: string;
}

export interface DeletePatientInstructionInput {
  id: string;
}
