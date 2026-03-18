import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import PatientRecordFormField from './PatientRecordFormField';

const DirtyFieldsCount = (): JSX.Element => {
  const {
    formState: { dirtyFields },
  } = useFormContext();
  return <div data-testid="dirty-fields-count">{Object.keys(dirtyFields).length}</div>;
};

const TestWrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const methods = useForm({
    defaultValues: {
      source: 'TX',
      target: '',
    },
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('PatientRecordFormField', () => {
  it('does not mark form dirty when dynamically populating a disabled field', async () => {
    render(
      <TestWrapper>
        <PatientRecordFormField
          item={{
            key: 'target',
            label: 'Target',
            type: 'string',
            dynamicPopulation: {
              sourceLinkId: 'source',
              triggerState: 'disabled',
            },
            disabledDisplay: 'disabled',
          }}
          isLoading={false}
          disabled
        />
        <DirtyFieldsCount />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('TX')).toBeInTheDocument();
    });

    expect(screen.getByTestId('dirty-fields-count')).toHaveTextContent('0');
  });
});
