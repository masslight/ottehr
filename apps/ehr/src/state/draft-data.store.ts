import { useEffect } from 'react';
import {
  CPTCodeDTO,
  CreateInHouseLabOrderParameters,
  CreateLabOrderParameters,
  CreateNursingOrderInput,
  CreateRadiologyZambdaOrderInput,
  CreateUpdateImmunizationOrderRequest,
  DiagnosisDTO,
  LateralityValue,
  ProcedurePageState,
  UpdateMedicationOrderInput,
  VitalsObservationDTO,
} from 'utils';
import { create, Mutate, StoreApi, UseBoundStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// add key for any section that should have persisted "draft" data
type StoreKey =
  | 'external-lab'
  | 'in-house-lab'
  | 'radiology'
  | 'procedure'
  | 'nursing-order'
  | 'immunization'
  | 'in-house-med'
  | 'vitals';

const DRAFT_STORE_NAME_BY_KEY: Record<StoreKey, string> = {
  'external-lab': 'create-external-lab-order-draft',
  'in-house-lab': 'create-in-house-lab-order-draft',
  radiology: 'create-radiology-order-draft',
  procedure: 'create-procedure-draft',
  'nursing-order': 'nursing-order-draft',
  immunization: 'immunization-order-draft',
  'in-house-med': 'in-house-med-order-draft',
  vitals: 'vitals-draft',
};

type GenericStateDraft = {
  hasNavigatedAway: boolean;
};

type CreateExternalLabOrderDraft = Partial<
  Omit<CreateLabOrderParameters, 'encounter' | 'orderingLocation'> & {
    orderingLocationId: string;
  } & GenericStateDraft
>;
type CreateInHouseLabOrderDraft = Partial<
  Omit<CreateInHouseLabOrderParameters, 'diagnosesAll' | 'diagnosesNew'> & {
    selectedNewDx: DiagnosisDTO[];
    selectedAssessmentDx: DiagnosisDTO[];
  } & GenericStateDraft
>;
type CreateRadiologyOrderDraft = Partial<
  Omit<CreateRadiologyZambdaOrderInput, 'diagnosisCode' | 'cptCode' | 'lateralityModifier'> & {
    dx: DiagnosisDTO;
    cptCode: CPTCodeDTO;
    laterality: LateralityValue | '';
  } & GenericStateDraft
>;
type CreateProcedureDraft = Partial<ProcedurePageState & GenericStateDraft>;
type CreateNursingOrderDraft = Partial<CreateNursingOrderInput & GenericStateDraft>;
type CreateImmunizationOrderDraft = Partial<CreateUpdateImmunizationOrderRequest & GenericStateDraft>;
type CreateInHouseMedicationOrderDraft = Partial<Pick<UpdateMedicationOrderInput, 'orderData'> & GenericStateDraft>;
type VitalsDraft = Partial<VitalsObservationDTO & GenericStateDraft>;

interface DraftState<TDraft extends object> {
  draftsByEncounterId: Record<string, TDraft>;
  setDraft: (encounterId: string, draftData: TDraft) => void;
  clearDraft: (encounterId: string) => void;
  hasDraft: (encounterId: string) => boolean;
  getDraft: (encounterId: string) => TDraft;
}

function createGenericStore<TDraft extends object>(
  storeKey: StoreKey
): UseBoundStore<Mutate<StoreApi<DraftState<TDraft>>, [['zustand/persist', unknown]]>> {
  return create<DraftState<TDraft>>()(
    persist(
      (set, get) => ({
        draftsByEncounterId: {},
        setDraft: (encounterId, draftData) =>
          set((state) => ({
            draftsByEncounterId: {
              ...state.draftsByEncounterId,
              [encounterId]: { ...(get().draftsByEncounterId[encounterId] ?? {}), ...draftData },
            },
          })),
        clearDraft: (encounterId) =>
          set((state) => {
            const updatedState = { ...state.draftsByEncounterId };
            delete updatedState[encounterId];
            return { draftsByEncounterId: updatedState };
          }),
        hasDraft: (encounterId) => !!get().draftsByEncounterId[encounterId],
        getDraft: (encounterId) => get().draftsByEncounterId[encounterId] ?? {},
      }),
      { name: DRAFT_STORE_NAME_BY_KEY[storeKey], storage: createJSONStorage(() => sessionStorage) }
    )
  );
}

export const useCreateExternalLabStore = createGenericStore<CreateExternalLabOrderDraft>('external-lab');
export const useCreateInHouseLabStore = createGenericStore<CreateInHouseLabOrderDraft>('in-house-lab');
export const useCreateRadiologyOrderStore = createGenericStore<CreateRadiologyOrderDraft>('radiology');
export const useProcedureStore = createGenericStore<CreateProcedureDraft>('procedure');
export const useNursingOrderStore = createGenericStore<CreateNursingOrderDraft>('nursing-order');
export const useImmunizationOrderStore = createGenericStore<CreateImmunizationOrderDraft>('immunization');
export const useInHouseMedicationOrderStore = createGenericStore<CreateInHouseMedicationOrderDraft>('in-house-med');
export const useVitalsDraftStore = createGenericStore<VitalsDraft>('vitals');

/**
 * Adds listeners to track is a user navigates away from the page and marks the draft as navigated away.
 * Useful for conditional warning rendering
 * @param input
 */
export function useMarkDraftNavigatedAway(input: {
  encounterId: string;
  setDraft: (encounterId: string, draftData: Partial<GenericStateDraft>) => void;
  hasDraft: (encounterId: string) => boolean;
}): void {
  const { encounterId, setDraft, hasDraft } = input;

  useEffect(() => {
    const markNavigatedAway = (): void => {
      if (encounterId && hasDraft(encounterId)) {
        setDraft(encounterId, {
          hasNavigatedAway: true,
        });
      }
    };

    window.addEventListener('beforeunload', markNavigatedAway);

    return () => {
      window.removeEventListener('beforeunload', markNavigatedAway);
      markNavigatedAway();
    };
  }, [encounterId, hasDraft, setDraft]);
}
