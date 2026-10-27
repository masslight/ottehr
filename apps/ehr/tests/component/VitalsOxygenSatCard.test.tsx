import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeEvent, FC } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS (must precede component imports)
// ============================================================================

// Only the network-facing hooks are mocked; the card runs on the real useVitalsManagement, local state and draft store.
const { saveVitals } = vi.hoisted(() => ({ saveVitals: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'appointment-1' }) };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('src/api/api', () => ({ uploadDotVisionDocument: vi.fn() }));

vi.mock('src/features/visits/shared/components/vitals/hooks/useGetVitals', () => ({
  useGetVitals: () => ({ data: undefined, isLoading: false, refetch: vi.fn().mockResolvedValue({}) }),
  useGetHistoricalVitals: () => ({ data: undefined }),
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useSaveVitals', () => ({
  useSaveVitals: () => saveVitals,
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useBatchSaveVitals', () => ({
  useBatchSaveVitals: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock('src/features/visits/shared/components/vitals/hooks/useDeleteVitals', () => ({
  useDeleteVitals: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

// The history column has its own coverage (VitalsHistoryEntry.test.tsx).
vi.mock('src/features/visits/shared/components/vitals/components/VitalsHistoryContainer', () => ({
  default: () => <div />,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsOxygenSatObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useVitalsManagement } from '../../src/features/visits/shared/components/vitals/hooks/useVitalsManagement';
import VitalsOxygenSatCard from '../../src/features/visits/shared/components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import { useVitalsDraftStore } from '../../src/state/draft-data.store';

// ============================================================================
// HELPERS
// ============================================================================

const ENCOUNTER_ID = 'enc-oxygen-sat-test';
const FLOW_RATE_LABEL = 'Flow rate (L/min)';
const OTHER_TEXT_LABEL = 'Please specify other type';
const { OnRoomAir, OnSupplementalO2 } = VitalsOxygenSatObservationMethod;

const Harness: FC = () => {
  const vitals = useVitalsManagement({ encounterId: ENCOUNTER_ID });
  return (
    <>
      <VitalsOxygenSatCard field={vitals.fields.oxygenSat} />
      <button onClick={() => void vitals.saveAll()}>Add all vitals</button>
    </>
  );
};

const selectOption = async (comboboxName: string, option: string): Promise<void> => {
  await userEvent.click(screen.getByRole('combobox', { name: comboboxName }));
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
};

const typeInto = (input: HTMLElement, value: string): void => {
  fireEvent.change(input, { target: { value } });
};

const satInput = (): HTMLElement => screen.getByRole('spinbutton', { name: 'Sat (%)' });
const flowRateInput = (): HTMLElement | null => screen.queryByRole('spinbutton', { name: FLOW_RATE_LABEL });
const typeSelect = (): HTMLElement | null => screen.queryByRole('combobox', { name: 'Type' });
const otherTextInput = (): HTMLElement | null => screen.queryByRole('textbox', { name: OTHER_TEXT_LABEL });

const clickAdd = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
};

// ============================================================================
// TESTS
// ============================================================================

describe('VitalsOxygenSatCard — supplemental O2 details', () => {
  beforeEach(() => {
    useVitalsDraftStore.setState({ draftsByEncounterId: {} });
    saveVitals.mockReset().mockResolvedValue(undefined);
  });

  describe('visibility', () => {
    it('hides the details until a qualifier is chosen', () => {
      render(<Harness />);

      expect(flowRateInput()).not.toBeInTheDocument();
      expect(typeSelect()).not.toBeInTheDocument();
    });

    it('shows Flow rate and Type for supplemental O2 only', async () => {
      render(<Harness />);

      await selectOption('Qualifier', OnSupplementalO2);
      expect(flowRateInput()).toBeInTheDocument();
      expect(typeSelect()).toBeInTheDocument();
      expect(otherTextInput()).not.toBeInTheDocument();

      for (const qualifier of Object.values(VitalsOxygenSatObservationMethod).filter((q) => q !== OnSupplementalO2)) {
        await selectOption('Qualifier', qualifier);
        expect(flowRateInput()).not.toBeInTheDocument();
        expect(typeSelect()).not.toBeInTheDocument();
      }
    });

    it('offers exactly the six delivery types, in order', async () => {
      render(<Harness />);
      await selectOption('Qualifier', OnSupplementalO2);

      await userEvent.click(screen.getByRole('combobox', { name: 'Type' }));
      const options = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.textContent?.trim())
        .filter(Boolean);

      expect(options).toEqual([
        'Nasal Cannula',
        'Non-Rebreather Mask',
        'Simple Face Mask',
        'Tracheostomy Collar',
        'Venturi Mask',
        'Other',
      ]);
    });

    it('shows the free text input only while Type is Other', async () => {
      render(<Harness />);
      await selectOption('Qualifier', OnSupplementalO2);

      await selectOption('Type', VitalsSupplementalO2DeliveryType.Other);
      expect(otherTextInput()).toBeInTheDocument();
      expect(otherTextInput()).toHaveAttribute('placeholder', 'Please specify');

      await selectOption('Type', VitalsSupplementalO2DeliveryType.VenturiMask);
      expect(otherTextInput()).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('saves supplemental O2 with neither detail', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);

      await clickAdd();

      expect(saveVitals).toHaveBeenCalledWith({
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 91,
        observationMethod: OnSupplementalO2,
      });
    });

    it('saves a decimal flow rate without a type', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '4.5');

      await clickAdd();

      expect(saveVitals).toHaveBeenCalledWith(expect.objectContaining({ supplementalO2: { flowRate: 4.5 } }));
    });

    it('saves a type without a flow rate', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);
      await selectOption('Type', VitalsSupplementalO2DeliveryType.TracheostomyCollar);

      await clickAdd();

      expect(saveVitals).toHaveBeenCalledWith(
        expect.objectContaining({
          supplementalO2: { deliveryType: VitalsSupplementalO2DeliveryType.TracheostomyCollar },
        })
      );
    });

    it('saves both details with the Other text and clears the form afterwards', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '10');
      await selectOption('Type', VitalsSupplementalO2DeliveryType.Other);
      typeInto(otherTextInput()!, ' Face tent ');

      await clickAdd();

      expect(saveVitals).toHaveBeenCalledWith({
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 91,
        observationMethod: OnSupplementalO2,
        supplementalO2: {
          flowRate: 10,
          deliveryType: VitalsSupplementalO2DeliveryType.Other,
          deliveryTypeOther: 'Face tent',
        },
      });
      await waitFor(() => expect(flowRateInput()).not.toBeInTheDocument());
      expect(satInput()).toHaveValue(null);
    });

    it('saves a zero flow rate as recorded', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '0');

      await clickAdd();

      expect(saveVitals).toHaveBeenCalledWith(expect.objectContaining({ supplementalO2: { flowRate: 0 } }));
    });

    it('blocks a negative flow rate and flags only the flow rate input', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '-1');

      await clickAdd();

      expect(saveVitals).not.toHaveBeenCalled();
      expect(flowRateInput()).toHaveAttribute('aria-invalid', 'true');
      expect(satInput()).toHaveAttribute('aria-invalid', 'false');

      typeInto(flowRateInput()!, '1');
      await clickAdd();
      expect(saveVitals).toHaveBeenCalledWith(expect.objectContaining({ supplementalO2: { flowRate: 1 } }));
    });

    it('still flags a missing SpO2 value on the Sat input', async () => {
      render(<Harness />);
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '2');

      await userEvent.click(screen.getByRole('button', { name: 'Add all vitals' }));

      expect(saveVitals).not.toHaveBeenCalled();
      expect(satInput()).toHaveAttribute('aria-invalid', 'true');
      expect(flowRateInput()).toHaveAttribute('aria-invalid', 'false');
    });

    it('saves room air exactly as before', async () => {
      render(<Harness />);
      typeInto(satInput(), '97');
      await selectOption('Qualifier', OnRoomAir);

      await clickAdd();

      expect(saveVitals).toHaveBeenCalledWith({
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 97,
        observationMethod: OnRoomAir,
      });
    });
  });

  describe('switching away', () => {
    it('drops the details when the qualifier changes and does not bring them back', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '4');
      await selectOption('Type', VitalsSupplementalO2DeliveryType.NasalCannula);

      await selectOption('Qualifier', OnRoomAir);
      await selectOption('Qualifier', OnSupplementalO2);
      expect(flowRateInput()).toHaveValue(null);
      expect(typeSelect()).not.toHaveTextContent(VitalsSupplementalO2DeliveryType.NasalCannula);

      await selectOption('Qualifier', OnRoomAir);
      await clickAdd();
      expect(saveVitals).toHaveBeenCalledWith({
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 91,
        observationMethod: OnRoomAir,
      });
    });

    it('drops the Other text when the type changes away from Other', async () => {
      render(<Harness />);
      typeInto(satInput(), '91');
      await selectOption('Qualifier', OnSupplementalO2);
      await selectOption('Type', VitalsSupplementalO2DeliveryType.Other);
      typeInto(otherTextInput()!, 'Face tent');

      await selectOption('Type', VitalsSupplementalO2DeliveryType.SimpleFaceMask);
      await selectOption('Type', VitalsSupplementalO2DeliveryType.Other);
      expect(otherTextInput()).toHaveValue('');

      await selectOption('Type', VitalsSupplementalO2DeliveryType.SimpleFaceMask);
      await clickAdd();
      expect(saveVitals).toHaveBeenCalledWith(
        expect.objectContaining({ supplementalO2: { deliveryType: VitalsSupplementalO2DeliveryType.SimpleFaceMask } })
      );
    });
  });

  describe('reopening with a draft', () => {
    it('restores every detail after leaving and returning', async () => {
      const { unmount } = render(<Harness />);
      typeInto(satInput(), '92');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '2.5');
      await selectOption('Type', VitalsSupplementalO2DeliveryType.Other);
      typeInto(otherTextInput()!, 'Face tent');
      unmount();

      render(<Harness />);

      await waitFor(() => expect(flowRateInput()).toHaveValue(2.5));
      expect(satInput()).toHaveValue(92);
      expect(typeSelect()).toHaveTextContent(VitalsSupplementalO2DeliveryType.Other);
      expect(otherTextInput()).toHaveValue('Face tent');
    });

    it('keeps an invalid flow rate for the user to correct', async () => {
      const { unmount } = render(<Harness />);
      typeInto(satInput(), '92');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '-2');
      unmount();

      render(<Harness />);

      await waitFor(() => expect(flowRateInput()).toHaveValue(-2));
      await clickAdd();
      expect(saveVitals).not.toHaveBeenCalled();
      expect(flowRateInput()).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not keep dropped details in the draft', async () => {
      render(<Harness />);
      typeInto(satInput(), '92');
      await selectOption('Qualifier', OnSupplementalO2);
      typeInto(flowRateInput()!, '3');
      await selectOption('Type', VitalsSupplementalO2DeliveryType.Other);
      typeInto(otherTextInput()!, 'Face tent');

      await selectOption('Type', VitalsSupplementalO2DeliveryType.NasalCannula);
      expect(useVitalsDraftStore.getState().getDraft(ENCOUNTER_ID).oxygenSat?.supplementalO2).toEqual({
        flowRate: 3,
        deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula,
      });

      await selectOption('Qualifier', OnRoomAir);
      expect(useVitalsDraftStore.getState().getDraft(ENCOUNTER_ID).oxygenSat).toEqual({
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 92,
        observationMethod: OnRoomAir,
      });
    });

    it('restores a legacy draft that has no details', async () => {
      useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, {
        oxygenSat: { field: VitalFieldNames.VitalOxygenSaturation, value: 95, observationMethod: OnSupplementalO2 },
      });

      render(<Harness />);

      await waitFor(() => expect(satInput()).toHaveValue(95));
      expect(flowRateInput()).toHaveValue(null);
      expect(otherTextInput()).not.toBeInTheDocument();
    });
  });
});

describe('useVitalsManagement — SpO2 draft', () => {
  const changeEvent = (value: string): ChangeEvent<HTMLInputElement> =>
    ({ target: { value } }) as ChangeEvent<HTMLInputElement>;

  const draft = (): Partial<VitalsOxygenSatObservationDTO> | undefined =>
    useVitalsDraftStore.getState().getDraft(ENCOUNTER_ID).oxygenSat;

  beforeEach(() => {
    useVitalsDraftStore.setState({ draftsByEncounterId: {} });
  });

  it('keeps every change made in the same batch', () => {
    const { result } = renderHook(() => useVitalsManagement({ encounterId: ENCOUNTER_ID }));
    // Handlers from a single render, as an event handler calling several of them would hold.
    const { localState } = result.current.fields.oxygenSat;

    act(() => {
      localState.handleValueChange(changeEvent('92'));
      localState.handleQualifierChange(OnSupplementalO2);
      localState.handleFlowRateChange(changeEvent('3'));
      localState.handleDeliveryTypeChange(VitalsSupplementalO2DeliveryType.Other);
      localState.handleDeliveryTypeOtherChange(changeEvent('Face tent'));
    });

    expect(draft()).toEqual({
      field: VitalFieldNames.VitalOxygenSaturation,
      value: 92,
      observationMethod: OnSupplementalO2,
      supplementalO2: {
        flowRate: 3,
        deliveryType: VitalsSupplementalO2DeliveryType.Other,
        deliveryTypeOther: 'Face tent',
      },
    });
    expect(result.current.fields.oxygenSat.localState).toMatchObject({
      flowRate: '3',
      deliveryType: VitalsSupplementalO2DeliveryType.Other,
      deliveryTypeOther: 'Face tent',
    });
  });

  it('does not store a flow rate the form rejects as a number', () => {
    const { result } = renderHook(() => useVitalsManagement({ encounterId: ENCOUNTER_ID }));
    act(() => {
      result.current.fields.oxygenSat.localState.handleValueChange(changeEvent('92'));
      result.current.fields.oxygenSat.localState.handleQualifierChange(OnSupplementalO2);
    });

    act(() => result.current.fields.oxygenSat.localState.handleFlowRateChange(changeEvent('4abc')));

    expect(result.current.fields.oxygenSat.localState.isFlowRateInvalid).toBe(true);
    expect(draft()?.supplementalO2).toBeUndefined();
  });

  it('does not restore a delivery type that is no longer offered', async () => {
    useVitalsDraftStore.getState().setDraft(ENCOUNTER_ID, {
      oxygenSat: {
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 92,
        observationMethod: OnSupplementalO2,
        // A label saved by an earlier release.
        supplementalO2: { flowRate: 2, deliveryType: 'Non Rebreather' as unknown as VitalsSupplementalO2DeliveryType },
      },
    });

    const { result } = renderHook(() => useVitalsManagement({ encounterId: ENCOUNTER_ID }));
    await act(async () => {});

    expect(result.current.fields.oxygenSat.localState).toMatchObject({ flowRate: '2', deliveryType: '' });
    expect(result.current.fields.oxygenSat.localState.getDTO()?.supplementalO2).toEqual({ flowRate: 2 });
  });
});
