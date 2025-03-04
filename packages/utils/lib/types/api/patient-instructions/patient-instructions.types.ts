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
  instructionId?: string;
  text: string;
}

export interface DeletePatientInstructionInput {
  instructionId: string;
}
