import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InputHTMLAttributes } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormFields } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { describe, expect, it, vi } from 'vitest';
import { PrimaryCareContainer } from './PrimaryCareContainer';

vi.mock('../InputMask', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
      ({ onChange, value, ...rest }, ref) => {
        return <input ref={ref} {...rest} onChange={onChange} value={value} />;
      }
    ),
  };
});

const TestWrapper = ({
  children,
  defaultValues = {},
}: {
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
}): JSX.Element => {
  const TestForm = (): JSX.Element => {
    const methods = useForm({
      defaultValues: {
        [FormFields.primaryCarePhysician.active.key]: true,
        [FormFields.primaryCarePhysician.firstName.key]: '',
        [FormFields.primaryCarePhysician.lastName.key]: '',
        [FormFields.primaryCarePhysician.practiceName.key]: '',
        [FormFields.primaryCarePhysician.address.key]: '',
        [FormFields.primaryCarePhysician.phone.key]: '',
        ...defaultValues,
      },
    });

    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  return <TestForm />;
};

const getFieldInput = (fieldTestId: string): HTMLInputElement =>
  screen.getByTestId(fieldTestId).querySelector('input') as HTMLInputElement;

describe('PrimaryCareContainer', () => {
  const user = userEvent.setup();

  const filledFieldValues = {
    [FormFields.primaryCarePhysician.active.key]: true,
    [FormFields.primaryCarePhysician.firstName.key]: 'Dr. Jane',
    [FormFields.primaryCarePhysician.lastName.key]: 'Smith',
    [FormFields.primaryCarePhysician.practiceName.key]: 'Family Medical Center',
    [FormFields.primaryCarePhysician.address.key]: '123 Main St, Anytown, ST 12345',
    [FormFields.primaryCarePhysician.phone.key]: '5551234567',
  };

  it('should display correct checkbox label', () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer />
      </TestWrapper>
    );

    expect(screen.getByText("Patient doesn't have a PCP at this time")).toBeInTheDocument();
  });

  it('should show and hide PCP form fields based on checkbox state', async () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer />
      </TestWrapper>
    );

    const pcpCheckbox = getFieldInput(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox);

    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.address)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile)).toBeVisible();

    await user.click(pcpCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.address)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile)).not.toBeVisible();
    });
  });

  it('should preserve field values when checkbox is checked and unchecked', async () => {
    render(
      <TestWrapper defaultValues={filledFieldValues}>
        <PrimaryCareContainer />
      </TestWrapper>
    );

    const pcpCheckbox = getFieldInput(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox);

    expect(pcpCheckbox).toBeInTheDocument();
    expect(pcpCheckbox).not.toBeChecked();

    const firstNameInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.firstName);
    const lastNameInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.lastName);
    const practiceNameInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.practiceName);
    const addressInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.address);
    const mobileInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.mobile);

    expect(firstNameInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.firstName.key] as string);
    expect(lastNameInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.lastName.key] as string);
    expect(practiceNameInput).toHaveValue(
      filledFieldValues[FormFields.primaryCarePhysician.practiceName.key] as string
    );
    expect(addressInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.address.key] as string);
    expect(mobileInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.phone.key] as string);

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).toBeChecked();

    await waitFor(() => {
      expect(firstNameInput).not.toBeVisible();
      expect(lastNameInput).not.toBeVisible();
      expect(practiceNameInput).not.toBeVisible();
      expect(addressInput).not.toBeVisible();
      expect(mobileInput).not.toBeVisible();
    });

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).not.toBeChecked();

    await waitFor(() => {
      expect(firstNameInput).toBeVisible();
      expect(lastNameInput).toBeVisible();
      expect(practiceNameInput).toBeVisible();
      expect(addressInput).toBeVisible();
      expect(mobileInput).toBeVisible();
    });

    expect(firstNameInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.firstName.key] as string);
    expect(lastNameInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.lastName.key] as string);
    expect(practiceNameInput).toHaveValue(
      filledFieldValues[FormFields.primaryCarePhysician.practiceName.key] as string
    );
    expect(addressInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.address.key] as string);
    expect(mobileInput).toHaveValue(filledFieldValues[FormFields.primaryCarePhysician.phone.key] as string);
  });
});
