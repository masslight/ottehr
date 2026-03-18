import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import PatientRecordFormField from './PatientRecordFormField';

const DirtyFieldsCount = (): JSX.Element => {
  const {
    formState: { dirtyFields },
  } = useFormContext();
  return <div data-testid="dirty-fields-count">{Object.keys(dirtyFields).length}</div>;
};

const TestWrapper = ({
  children,
  defaultValues,
}: {
  children: ReactNode;
  defaultValues: Record<string, unknown>;
}): JSX.Element => {
  const methods = useForm({ defaultValues });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const getInputByName = (name: string): HTMLInputElement => {
  const input = document.querySelector(`input[name="${name}"]`);
  if (!input) {
    throw new Error(`Input with name "${name}" not found`);
  }
  return input as HTMLInputElement;
};

const DynamicPopulationHarness = (): JSX.Element => {
  const [targetDisabled, setTargetDisabled] = useState(true);

  return (
    <>
      <PatientRecordFormField item={{ key: 'source', label: 'Source', type: 'string' }} isLoading={false} />
      <PatientRecordFormField
        item={{
          key: 'target',
          label: 'Target',
          type: 'string',
          dynamicPopulation: { sourceLinkId: 'source', triggerState: 'disabled' },
          disabledDisplay: 'disabled',
        }}
        isLoading={false}
        disabled={targetDisabled}
      />
      <button type="button" onClick={() => setTargetDisabled((previousValue) => !previousValue)}>
        toggle-target-disabled
      </button>
      <DirtyFieldsCount />
    </>
  );
};

describe('PatientRecordFormField', () => {
  it('does not mark form dirty when dynamically populating a disabled field', async () => {
    render(
      <TestWrapper defaultValues={{ source: 'TX', target: '' }}>
        <DynamicPopulationHarness />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getInputByName('target')).toHaveValue('TX');
    });
    expect(screen.getByTestId('dirty-fields-count')).toHaveTextContent('0');
  });

  it('restores original value when source changes while field is disabled and then re-enabled', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper defaultValues={{ source: 'TX', target: 'OR' }}>
        <DynamicPopulationHarness />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getInputByName('target')).toHaveValue('TX');
    });

    const sourceInput = getInputByName('source');
    await user.clear(sourceInput);
    await user.type(sourceInput, 'CA');

    await waitFor(() => {
      expect(getInputByName('target')).toHaveValue('CA');
    });

    await user.click(screen.getByRole('button', { name: 'toggle-target-disabled' }));

    await waitFor(() => {
      expect(getInputByName('target')).toHaveValue('OR');
    });
  });
});
