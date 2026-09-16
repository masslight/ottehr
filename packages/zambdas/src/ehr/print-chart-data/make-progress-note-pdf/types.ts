import { Secrets } from 'utils/lib/secrets';
import { MakeProgressNotePdfZambdaInput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';

export type MakeProgressNotePdfInputValidated = MakeProgressNotePdfZambdaInput & {
  secrets: Secrets | null;
  userToken: string;
};
