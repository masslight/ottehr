import { ZambdaExecuteResult } from '@oystehr/sdk';
import { useMemo } from 'react';
import { useClient } from 'src/providers/intakeOysterClientProvider';

export interface ZambdaClient {
  execute: (id: string, body?: any) => Promise<ZambdaExecuteResult>;
  executePublic: (id: string, body?: any) => Promise<ZambdaExecuteResult>;
}

export function useUCZambdaClient({ tokenless }: { tokenless: boolean }): ZambdaClient | null {
  const client = useClient({ tokenless });

  return useMemo(() => {
    if (!client) return null;

    return {
      execute: (id: string, body?: Record<string, unknown>) => client.zambda.execute({ id, ...body }),
      executePublic: (id: string, body?: Record<string, unknown>) => client.zambda.executePublic({ id, ...body }),
    };
  }, [client]);
}
