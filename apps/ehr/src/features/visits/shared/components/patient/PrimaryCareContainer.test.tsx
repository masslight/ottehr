import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { type InputHTMLAttributes } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { describe, expect, it, vi } from 'vitest';
import { createDynamicValidationResolver } from './patientRecordValidation';
import { PrimaryCareContainer } from './PrimaryCareContainer';

// The practice-name picker reads the directory; keep it offline.
const directoryContact: AddressBookContact = vi.hoisted(() => ({
  id: 'c1',
  firstName: 'Jane',
  lastName: 'Doe',
  credential: 'MD',
  organizationName: 'Springfield Cardiology',
  address: { line1: '1 Main St', line2: 'Suite 2', city: 'Springfield', state: 'IL', zip: '62701' },
  phone: '+12125551234',
  fax: '+12125554321',
  tags: ['pcp'],
}));
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({ contacts: [directoryContact] }),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

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

interface TestWrapperProps {
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
  onFormReady?: (methods: ReturnType<typeof useForm>) => void;
}

const TestWrapper = ({ children, defaultValues = {}, onFormReady }: TestWrapperProps): JSX.Element => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const TestForm = (): JSX.Element => {
    const pcpItems = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;
    const initialPcpValues = Object.values(pcpItems).reduce<Record<string, unknown>>((acc, item) => {
      acc[item.key] = item.key === pcpItems.active.key ? true : '';
      return acc;
    }, {});
    const methods = useForm({
      resolver: createDynamicValidationResolver(),
      defaultValues: {
        ...initialPcpValues,
        ...defaultValues,
      },
    });

    React.useEffect(() => {
      if (onFormReady) {
        onFormReady(methods);
      }
    }, [methods]);

    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TestForm />
    </QueryClientProvider>
  );
};

// Helper to get field input by config key (fields have id attribute matching their key)
const getFieldById = (fieldKey: string): HTMLElement => {
  const element = document.getElementById(fieldKey);
  if (!element) {
    throw new Error(`Element with id "${fieldKey}" not found`);
  }
  return element;
};

const getFieldInput = (fieldKey: string): HTMLInputElement => {
  // Query by name attribute (works for all field types including checkboxes)
  const input = document.querySelector(`input[name="${fieldKey}"]`);
  if (!input) {
    throw new Error(`Input with name "${fieldKey}" not found`);
  }
  return input as HTMLInputElement;
};

// Helper to get conditionally rendered fields from config
const getConditionallyRenderedFields = (
  items: Record<string, any>,
  controlFieldKey: string
): { key: string; label: string; shouldBeRequired: boolean }[] => {
  return Object.values(items)
    .filter((item) => {
      // Field must have triggers
      if (!item.triggers || item.triggers.length === 0) return false;

      // Field must have disabledDisplay: 'hidden'
      if (item.disabledDisplay !== 'hidden') return false;

      // At least one trigger must target the control field
      return item.triggers.some((trigger: any) => trigger.targetQuestionLinkId === controlFieldKey);
    })
    .map((item) => {
      // Check if any trigger targeting the control field has 'require' effect
      const shouldBeRequired = item.triggers.some(
        (trigger: any) => trigger.targetQuestionLinkId === controlFieldKey && trigger.effect.includes('require')
      );
      return { key: item.key, label: item.label, shouldBeRequired };
    });
};

describe('PrimaryCareContainer', () => {
  const user = userEvent.setup();

  const pcp = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;

  // Build filled field values from config
  const conditionalFields = getConditionallyRenderedFields(pcp, pcp.active.key);
  const namedSampleValues: Record<string, string> = {
    firstName: 'Dr. Jane',
    lastName: 'Smith',
    practiceName: 'Family Medical Center',
    address: '123 Main St, AnyTown, ST 12345',
    phone: '(555) 123-4567',
    fax: '(555) 123-4567',
  };
  const testFieldValues: Record<string, string> = Object.entries(pcp).reduce<Record<string, string>>(
    (acc, [name, item]: [string, any]) => {
      if (name !== 'active' && namedSampleValues[name] !== undefined) {
        acc[item.key] = namedSampleValues[name];
      }
      return acc;
    },
    {}
  );

  const filledFieldValues = {
    [pcp.active.key]: true,
    ...testFieldValues,
  };

  it('should display correct checkbox label', () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    expect(screen.getByText("Patient doesn't have a PCP at this time")).toBeInTheDocument();
  });

  it('should show and hide PCP form fields based on checkbox state', async () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    const pcp = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;
    const pcpCheckbox = getFieldInput(pcp.active.key);

    // Get the list of conditionally rendered fields from config
    const conditionalFields = getConditionallyRenderedFields(pcp, pcp.active.key);

    // Initially, all conditional fields should be in the document
    conditionalFields.forEach((field) => {
      expect(getFieldById(field.key)).toBeInTheDocument();
    });

    await user.click(pcpCheckbox);

    // After clicking checkbox, all conditional fields should be removed from the document
    await waitFor(() => {
      conditionalFields.forEach((field) => {
        expect(document.getElementById(field.key)).not.toBeInTheDocument();
      });
    });
  });

  it('should preserve field values when checkbox is checked and unchecked', async () => {
    render(
      <TestWrapper defaultValues={filledFieldValues}>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    const pcpCheckbox = getFieldInput(pcp.active.key);

    expect(pcpCheckbox).toBeInTheDocument();
    expect(pcpCheckbox).not.toBeChecked();

    // Verify initial values for all conditional fields
    conditionalFields.forEach((field) => {
      const input = getFieldInput(field.key);
      expect(input).toHaveValue(testFieldValues[field.key]);
    });

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).toBeChecked();

    // All conditional fields should be removed from the document
    await waitFor(() => {
      conditionalFields.forEach((field) => {
        expect(document.querySelector(`input[name="${field.key}"]`)).not.toBeInTheDocument();
      });
    });

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).not.toBeChecked();

    // All conditional fields should be back in the document
    await waitFor(() => {
      conditionalFields.forEach((field) => {
        expect(document.querySelector(`input[name="${field.key}"]`)).toBeInTheDocument();
      });
    });

    // Verify values are preserved after fields are re-rendered
    conditionalFields.forEach((field) => {
      const refreshedInput = getFieldInput(field.key);
      expect(refreshedInput).toHaveValue(testFieldValues[field.key]);
    });
  });

  it('fills the PCP fields from a directory contact and marks them dirty', async () => {
    let formMethods: ReturnType<typeof useForm> | null = null;
    render(
      <TestWrapper onFormReady={(methods) => (formMethods = methods)}>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    await user.click(within(getFieldById(pcp.firstName.key)).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Jane Doe, MD/ }));

    expect(getFieldInput(pcp.practiceName.key)).toHaveValue('Springfield Cardiology');
    expect(getFieldInput(pcp.firstName.key)).toHaveValue('Jane');
    expect(getFieldInput(pcp.lastName.key)).toHaveValue('Doe');
    expect(getFieldInput(pcp.address.key)).toHaveValue('1 Main St, Suite 2, Springfield, IL 62701');
    expect(getFieldInput(pcp.phone.key)).toHaveValue('(212) 555-1234');
    expect(getFieldInput(pcp.fax.key)).toHaveValue('(212) 555-4321');
    expect(getFieldInput(pcp.active.key)).not.toBeChecked();
    expect(formMethods!.formState.dirtyFields).toMatchObject({ [pcp.firstName.key]: true, [pcp.fax.key]: true });
  });

  it('still takes a free-text practice name', async () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    await user.type(within(getFieldById(pcp.firstName.key)).getByRole('combobox'), 'Some Doctor');

    await waitFor(() => expect(getFieldInput(pcp.firstName.key)).toHaveValue('Some Doctor'));
    expect(getFieldInput(pcp.practiceName.key)).toHaveValue('');
  });

  it('should validate required fields based on config triggers', async () => {
    let formMethods: ReturnType<typeof useForm> | null = null;

    render(
      <TestWrapper
        onFormReady={(methods) => {
          formMethods = methods;
        }}
      >
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    // Wait for form to be ready
    await waitFor(() => {
      expect(formMethods).not.toBeNull();
    });

    const pcpCheckbox = getFieldInput(pcp.active.key);
    expect(pcpCheckbox).not.toBeChecked(); // Fields should be visible and potentially required

    // Test each conditional field based on its config
    for (const field of conditionalFields) {
      const input = getFieldInput(field.key);

      // Clear the field - userEvent actions are automatically wrapped in act()
      await user.clear(input);

      // Trigger validation and wait for all async updates
      await act(async () => {
        await formMethods!.trigger(field.key);
      });

      // Wait for validation to complete and DOM to update
      await waitFor(() => {
        expect(formMethods!.formState.isValidating).toBe(false);
      });

      // Check if error appears based on config

      if (field.shouldBeRequired) {
        // Field should show required error
        await waitFor(() => {
          const errorElement = document.getElementById(field.key)?.querySelector('p.MuiFormHelperText-root.Mui-error');
          expect(errorElement).toBeInTheDocument();
          expect(errorElement).toHaveTextContent('This field is required');
        });
      } else {
        // Field should NOT show required error - wait a bit to ensure no error appears
        await waitFor(() => {
          const errorElement = document.getElementById(field.key)?.querySelector('p.MuiFormHelperText-root.Mui-error');
          expect(errorElement).not.toBeInTheDocument();
        });
      }
    }
  });
});
