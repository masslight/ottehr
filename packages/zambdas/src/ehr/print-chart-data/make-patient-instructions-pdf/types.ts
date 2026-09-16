import { Secrets } from 'utils/lib/secrets';
import { MakePatientInstructionsPdfZambdaInput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';

export type MakePatientInstructionsPdfInputValidated = MakePatientInstructionsPdfZambdaInput & {
  secrets: Secrets | null;
  userToken: string;
};
