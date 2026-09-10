import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { applyTemplate } from 'src/api/api';
import { CHART_DATA_QUERY_KEY, CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { DiagnosisDTO, ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { TemplateSectionActions } from 'utils/lib/types/data/apply-template.types';
import { invalidateChartFields, useChartFields } from '../../hooks/useChartFields';
import { GET_MEDICATION_ORDERS_QUERY_KEY } from '../../stores/appointment/appointment.queries';
import {
  ChartDataResponse,
  useAppointmentData,
  useChartData,
  useDeleteChartData,
  useSaveChartData,
} from '../../stores/appointment/appointment.store';
import { resetExamObservationsStore } from '../../stores/appointment/reset-exam-observations';
import {
  useRosObservationsInitializationStore,
  useRosObservationsStore,
} from '../../stores/appointment/ros-observations.store';
import { useListTemplates } from '../templates/useListTemplates';
import { useSaveVitals } from '../vitals/hooks/useSaveVitals';
import { applySelectedRecommendations } from './applySelectedRecommendations';
import {
  AllergyRecommendation,
  DiagnosisRecommendation,
  HpiRecommendation,
  MedicationRecommendation,
  RosRecommendation,
  ScribeRecommendation,
  TemplateRecommendation,
  WeightRecommendation,
} from './types';

/**
 * How the recommended template is applied. The transcript-derived items in the same batch cover
 * ROS, so the template must not overwrite it; orders stay a manual checklist, so the template's
 * lab/procedure/medication plans are skipped too. Everything else takes the apply-template defaults.
 */
export const SCRIBE_TEMPLATE_SECTION_ACTIONS: TemplateSectionActions = {
  hpi: 'append',
  moi: 'skip',
  ros: 'skip',
  examFindings: 'overwrite',
  mdm: 'overwrite',
  diagnoses: 'append',
  patientInstructions: 'overwrite',
  cptCodes: 'append',
  emCode: 'overwrite',
  inHouseLabs: 'skip',
  externalLabs: 'skip',
  procedures: 'skip',
  inHouseMedications: 'skip',
};

/**
 * Writes the selected recommendations into the chart with the same requests the section screens
 * use. Each `apply*` below mirrors what the corresponding screen does when a provider enters the
 * same thing by hand, including how it keeps the client-side caches in step.
 */
export const useApplyRecommendations = (): { applySelected: () => Promise<void> } => {
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const queryClient = useQueryClient();
  const { oystehrZambda } = useApiClients();
  const { mutateAsync: saveChartData } = useSaveChartData();
  const { mutateAsync: deleteChartData } = useDeleteChartData();
  const { refetch: refetchChartData, chartDataSetState, queryKey: chartDataQueryKey } = useChartData();
  // Same query the HPI editor reads, so the appended text shows up there without a refetch.
  const { data: hpiFields, setQueryCache: setHpiQueryCache } = useChartFields({
    requestedFields: { chiefComplaint: { _tag: 'chief-complaint' } },
  });
  const saveVitals = useSaveVitals({ encounterId: encounterId ?? '' });
  const { templates } = useListTemplates();

  const getChartData = useCallback(
    (): ChartDataResponse | undefined => queryClient.getQueryData<ChartDataResponse>(chartDataQueryKey) ?? undefined,
    [queryClient, chartDataQueryKey]
  );

  const applyTemplateRecommendation = useCallback(
    async (rec: TemplateRecommendation): Promise<void> => {
      if (!oystehrZambda || !encounterId) throw new Error('The visit is still loading. Please try again.');
      const template = templates.find((t) => t.label.toLowerCase() === rec.templateName.trim().toLowerCase());
      if (!template) {
        throw new Error(
          `Template “${rec.templateName}” isn't available in this environment. Edit the recommendation to pick another template.`
        );
      }
      if (!template.isCurrentVersion) {
        throw new Error('This template is out of date and needs to be updated by an admin before it can be applied.');
      }
      const result = await applyTemplate(oystehrZambda, {
        encounterId,
        templateName: template.value,
        sectionActions: SCRIBE_TEMPLATE_SECTION_ACTIONS,
      });
      // Exam observations live in Zustand rather than React Query, so they need a reset before the
      // refetch below can repopulate them (same as ApplyTemplate does).
      resetExamObservationsStore();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [CHART_DATA_QUERY_KEY, encounterId] }),
        queryClient.invalidateQueries({ queryKey: [CHART_FIELDS_QUERY_KEY, encounterId] }),
        queryClient.invalidateQueries({ queryKey: [GET_MEDICATION_ORDERS_QUERY_KEY] }),
      ]);
      for (const warning of result?.warnings ?? []) {
        enqueueSnackbar(warning.message, { variant: 'warning' });
      }
    },
    [oystehrZambda, encounterId, templates, queryClient]
  );

  const applyHpi = useCallback(
    async (rec: HpiRecommendation): Promise<void> => {
      const addition = rec.text.trim();
      if (!addition) throw new Error('The HPI text is empty.');
      const existing = hpiFields?.chiefComplaint;
      const current = existing?.text?.trim() ?? '';
      // Re-applying (or a template that already wrote the same sentence) shouldn't duplicate it.
      if (current.includes(addition)) return;
      const text = current ? `${current}\n${addition}` : addition;
      const result = await saveChartData({ chiefComplaint: { resourceId: existing?.resourceId, text } });
      setHpiQueryCache({ chiefComplaint: result.chartData.chiefComplaint });
    },
    [hpiFields, saveChartData, setHpiQueryCache]
  );

  const applyDiagnosis = useCallback(
    async (rec: DiagnosisRecommendation): Promise<void> => {
      const diagnoses = getChartData()?.diagnosis ?? [];
      if (diagnoses.some((d) => d.code === rec.code)) return;
      const hasPrimary = diagnoses.some((d) => d.isPrimary);
      const prepared: DiagnosisDTO = { code: rec.code, display: rec.display, isPrimary: !hasPrimary };
      const result = await saveChartData({ diagnosis: [prepared] });
      const saved = result.chartData.diagnosis ?? [prepared];
      chartDataSetState(
        (state) => ({
          chartData: {
            ...state.chartData!,
            diagnosis: [...(state.chartData?.diagnosis ?? []).filter((d) => d.code !== rec.code), ...saved],
          },
        }),
        { invalidateQueries: false }
      );
    },
    [getChartData, saveChartData, chartDataSetState]
  );

  const applyAllergy = useCallback(
    async (rec: AllergyRecommendation): Promise<void> => {
      const name = rec.name.trim();
      if (!name) throw new Error('The allergy name is empty.');
      const allergies = getChartData()?.allergies ?? [];
      if (allergies.some((a) => a.current && a.name?.trim().toLowerCase() === name.toLowerCase())) return;
      // No allergen catalog id: the transcript only gives us a name, which the chart stores as an
      // "other" allergy, the same way a manually typed one is.
      const result = await saveChartData({
        allergies: [{ name, current: true, lastUpdated: new Date().toISOString() }],
      });
      const saved = result.chartData.allergies ?? [];
      chartDataSetState(
        (state) => ({
          chartData: { ...state.chartData!, allergies: [...(state.chartData?.allergies ?? []), ...saved] },
        }),
        { invalidateQueries: false }
      );
    },
    [getChartData, saveChartData, chartDataSetState]
  );

  const applyWeight = useCallback(
    async (rec: WeightRecommendation): Promise<void> => {
      if (!encounterId) throw new Error('The visit is still loading. Please try again.');
      if (!Number.isFinite(rec.weightLbs) || rec.weightLbs <= 0) throw new Error('Enter a weight in pounds.');
      const kg = Math.round((rec.weightLbs / LBS_IN_KG) * 100) / 100;
      await saveVitals({ field: VitalFieldNames.VitalWeight, value: kg });
      await queryClient.invalidateQueries({ queryKey: [`current-encounter-vitals-${encounterId}`] });
      invalidateChartFields(queryClient, encounterId, ['vitalsObservations']);
    },
    [encounterId, saveVitals, queryClient]
  );

  const applyMedication = useCallback(
    async (rec: MedicationRecommendation): Promise<void> => {
      const name = rec.name.trim();
      if (!name) throw new Error('The medication name is empty.');
      const medications = getChartData()?.medications ?? [];
      if (medications.some((m) => m.status === 'active' && m.name.trim().toLowerCase() === name.toLowerCase())) return;
      await saveChartData({
        medications: [
          {
            name,
            type: rec.type,
            status: 'active',
            intakeInfo: { patientCouldNotConfirmDosage: rec.patientCouldNotConfirmDosage || undefined },
          },
        ],
      });
      // The Medications screen lists from its own chart-fields query; the note summary from chart data.
      invalidateChartFields(queryClient, encounterId, ['medications']);
    },
    [getChartData, saveChartData, queryClient, encounterId]
  );

  const applyRos = useCallback(
    async (rec: RosRecommendation): Promise<void> => {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(rec.baseKey);
      const targetKey = rec.finding === RosFindingState.Reports ? reportsKey : deniesKey;
      const pairedKey = rec.finding === RosFindingState.Reports ? deniesKey : reportsKey;
      const rosState = useRosObservationsStore.getState();
      const existing = rosState[targetKey];
      if (existing?.value !== true) {
        const toSave: ExamObservationDTO = {
          field: targetKey,
          label: rec.label,
          value: true,
          resourceId: existing?.resourceId,
        };
        const result = await saveChartData({ rosObservations: [toSave] });
        const returned = result.chartData.rosObservations ?? [];
        useRosObservationsStore.setState(Object.fromEntries(returned.map((obs) => [obs.field, obs])));
      }
      // Reports and Denies are mutually exclusive for a finding, exactly as the ROS table enforces.
      const paired = rosState[pairedKey];
      if (paired?.value === true && paired.resourceId) {
        await deleteChartData({ rosObservations: [{ ...paired, value: false }] });
        useRosObservationsStore.setState({ [pairedKey]: { field: pairedKey, label: rec.label, value: false } });
      }
      useRosObservationsInitializationStore.setState({ hasInitialData: true });
    },
    [saveChartData, deleteChartData]
  );

  const applyOne = useCallback(
    async (rec: ScribeRecommendation): Promise<void> => {
      switch (rec.kind) {
        case 'template':
          return applyTemplateRecommendation(rec);
        case 'hpi':
          return applyHpi(rec);
        case 'diagnosis':
          return applyDiagnosis(rec);
        case 'allergy':
          return applyAllergy(rec);
        case 'vital-weight':
          return applyWeight(rec);
        case 'medication':
          return applyMedication(rec);
        case 'ros':
          return applyRos(rec);
      }
    },
    [applyTemplateRecommendation, applyHpi, applyDiagnosis, applyAllergy, applyWeight, applyMedication, applyRos]
  );

  const applySelected = useCallback(async (): Promise<void> => {
    const { applied, failed } = await applySelectedRecommendations(applyOne, {
      // Reconcile every summary on screen with what the server actually stored. Allergies and
      // diagnoses live on the chart-data query itself; the fields below have caches of their own.
      reconcile: async () => {
        await refetchChartData();
        invalidateChartFields(queryClient, encounterId, ['chiefComplaint', 'medications', 'vitalsObservations']);
      },
    });
    if (applied === 0 && failed === 0) return;

    const noun = (count: number): string => `${count} recommendation${count === 1 ? '' : 's'}`;
    if (failed === 0) {
      enqueueSnackbar(`Applied ${noun(applied)} to the progress note.`, { variant: 'success' });
    } else {
      enqueueSnackbar(`Applied ${noun(applied)}; ${failed} could not be applied. See the panel for details.`, {
        variant: 'warning',
      });
    }
  }, [applyOne, refetchChartData, queryClient, encounterId]);

  return { applySelected };
};
