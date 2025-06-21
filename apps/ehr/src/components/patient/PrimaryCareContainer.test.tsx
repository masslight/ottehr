import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, it, expect, vi } from 'vitest';
import { PrimaryCareContainer } from './PrimaryCareContainer';
import { dataTestIds } from 'src/constants/data-test-ids';
import type { InputHTMLAttributes } from 'react';
import { FormFields } from 'src/constants';

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

  it('should preserve field values when checkbox is checked and unchecked', async () => {
    render(
      <TestWrapper>
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

    await user.type(firstNameInput, 'Dr. Jane');
    await user.type(lastNameInput, 'Smith');
    await user.type(practiceNameInput, 'Family Medical Center');
    await user.type(addressInput, '123 Main St, Anytown, ST 12345');
    await user.type(mobileInput, '5551234567');

    expect(firstNameInput).toHaveValue('Dr. Jane');
    expect(lastNameInput).toHaveValue('Smith');
    expect(practiceNameInput).toHaveValue('Family Medical Center');
    expect(addressInput).toHaveValue('123 Main St, Anytown, ST 12345');
    expect(mobileInput).toHaveValue('5551234567');

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

    expect(firstNameInput).toHaveValue('Dr. Jane');
    expect(lastNameInput).toHaveValue('Smith');
    expect(practiceNameInput).toHaveValue('Family Medical Center');
    expect(addressInput).toHaveValue('123 Main St, Anytown, ST 12345');
    expect(mobileInput).toHaveValue('5551234567');
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

  it('should display correct checkbox label', () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer />
      </TestWrapper>
    );

    expect(screen.getByText("Patient doesn't have a PCP at this time")).toBeInTheDocument();
  });
});
