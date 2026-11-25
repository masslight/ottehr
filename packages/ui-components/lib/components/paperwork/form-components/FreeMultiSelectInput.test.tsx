import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { PaperworkContext, PaperworkProvider } from '../context';
import { PaperworkThemeProvider } from '../theme';
import { FreeMultiSelectInput } from './FreeMultiSelectInput';

const paperworkContext = { paperworkComponentHelpers: {} } as PaperworkContext;

const Wrapper = ({ children }: { children: ReactNode }): ReactElement => {
  const methods = useForm();
  return (
    <QueryClientProvider client={new QueryClient()}>
      <PaperworkThemeProvider>
        <PaperworkProvider value={paperworkContext}>
          <FormProvider {...methods}>{children}</FormProvider>
        </PaperworkProvider>
      </PaperworkThemeProvider>
    </QueryClientProvider>
  );
};

const OPTIONS = [{ valueString: 'Male' }, { valueString: 'Female' }, { valueString: 'Intersex' }];

describe('FreeMultiSelectInput', () => {
  // The intake e2e suite finds the field by this id and picks from the options it opens.
  it('lists its options when opened', () => {
    render(
      <FreeMultiSelectInput name="patient-birth-sex" value={undefined} options={OPTIONS} onChange={() => undefined} />,
      { wrapper: Wrapper }
    );

    const input = document.getElementById('patient-birth-sex') as HTMLInputElement;
    fireEvent.mouseDown(input);

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Male', 'Female', 'Intersex']);
  });
});
