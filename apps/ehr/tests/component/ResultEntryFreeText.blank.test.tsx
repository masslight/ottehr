import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { StringDataEntryComponent } from 'utils/lib/types/data/in-house/in-house.types';
import { describe, expect, it } from 'vitest';
import { ResultEntryFreeText } from '../../src/features/in-house-labs/components/details/ResultEntryFreeText';

const freeTextComponent: StringDataEntryComponent = {
  componentName: 'Notes',
  loincCode: [],
  observationDefinitionId: 'obs-def-free-text',
  dataType: 'string',
  displayType: 'Free Text',
};

const Harness = ({ component }: { component: StringDataEntryComponent }): ReactElement => {
  const methods = useForm({ mode: 'onChange' });
  return (
    <FormProvider {...methods}>
      <ResultEntryFreeText testItemComponent={component} />
    </FormProvider>
  );
};

describe('ResultEntryFreeText blank entry validation', () => {
  it('shows "Please input a value" for a whitespace-only entry', async () => {
    const user = userEvent.setup();
    render(<Harness component={freeTextComponent} />);

    await user.type(screen.getByRole('textbox'), '   ');

    expect(await screen.findByText('Please input a value')).toBeInTheDocument();
  });

  it('accepts an entry with surrounding spaces', async () => {
    const user = userEvent.setup();
    render(<Harness component={freeTextComponent} />);

    await user.type(screen.getByRole('textbox'), ' trace ');

    expect(screen.getByRole('textbox')).toHaveValue(' trace ');
    expect(screen.queryByText('Please input a value')).not.toBeInTheDocument();
  });

  it('still applies the configured format rule to non-blank entries', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        component={{ ...freeTextComponent, validations: { format: { value: '^\\d+$', display: 'digits only' } } }}
      />
    );

    await user.type(screen.getByRole('textbox'), 'abc');

    expect(await screen.findByText('Format: digits only')).toBeInTheDocument();
  });
});
