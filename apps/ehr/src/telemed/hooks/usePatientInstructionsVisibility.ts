import { NOTHING_TO_EAT_OR_DRINK_FIELD } from 'utils';
import { useChartData } from '../state';
import { useExcusePresignedFiles } from '.';

export const usePatientInstructionsVisibility = (): {
  showInstructions: boolean;
  showDischargeInstructions: boolean;
  showFollowUp: boolean;
  showSchoolWorkExcuse: boolean;
  showPatientInstructions: boolean;
} => {
  const { chartData } = useChartData();
  const instructions = chartData?.instructions;
  const disposition = chartData?.disposition;
  const schoolWorkExcuses = useExcusePresignedFiles(chartData?.schoolWorkNotes);
  const showInstructions = !!(instructions && instructions.length > 0);

  const showDischargeInstructions = !!(
    (disposition?.note && disposition?.note.length > 0) ||
    disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ||
    (disposition?.labService && disposition.labService.length > 0) ||
    (disposition?.virusTest && disposition.virusTest.length > 0)
  );

  const showFollowUp = !!(disposition?.followUp && disposition.followUp.length > 0);
  const showSchoolWorkExcuse = !!(schoolWorkExcuses.length > 0);

  const showPatientInstructions = showInstructions || showDischargeInstructions || showFollowUp || showSchoolWorkExcuse;

  return {
    showInstructions,
    showDischargeInstructions,
    showFollowUp,
    showSchoolWorkExcuse,
    showPatientInstructions,
  };
};
