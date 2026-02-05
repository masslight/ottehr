import { Patient, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getQuestionnaireResponseByLinkId } from 'utils';
import { getPatientLastFirstName } from '../../../patients';
import { drawFieldLine } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PatientInfoForProgressNote, PdfSection, ProgressNotePatientDataInput } from '../../types';

export const composePatientInformation: DataComposer<ProgressNotePatientDataInput, PatientInfoForProgressNote> = ({
  patient,
  questionnaireResponse,
}) => {
  const patientName = getPatientLastFirstName(patient) ?? '';
  const patientDOB = getPatientDob(patient) ?? '';
  const personAccompanying = getPersonAccompanying(questionnaireResponse) ?? '';
  const patientPhone =
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0].valueString ?? '';

  return {
    patientName,
    patientDOB,
    personAccompanying,
    patientPhone,
  };
};

export const createProgressNotePatientInfoSection = <
  TData extends { patient?: PatientInfoForProgressNote },
>(): PdfSection<TData, PatientInfoForProgressNote> => {
  return createConfiguredSection(null, () => ({
    title: 'Patient information',
    dataSelector: (data) => data.patient,
    render: (client, patientInfo, styles) => {
      drawFieldLine(client, styles, { label: 'Patient name', value: patientInfo.patientName });
      drawFieldLine(client, styles, { label: 'Date of birth', value: patientInfo.patientDOB });
      if (patientInfo.personAccompanying) {
        drawFieldLine(client, styles, {
          label: 'Person accompanying the minor patient',
          value: patientInfo.personAccompanying,
        });
      }
      if (patientInfo.patientPhone) {
        drawFieldLine(client, styles, { label: 'Phone', value: patientInfo.patientPhone });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};

function getPatientDob(patient: Patient): string | undefined {
  return patient?.birthDate && DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
}

function getPersonAccompanying(questionnaireResponse?: QuestionnaireResponse): string | undefined {
  if (!questionnaireResponse) return;

  const personAccompanying = {
    firstName: getQuestionnaireResponseByLinkId('person-accompanying-minor-first-name', questionnaireResponse)
      ?.answer?.[0]?.valueString,
    lastName: getQuestionnaireResponseByLinkId('person-accompanying-minor-last-name', questionnaireResponse)
      ?.answer?.[0]?.valueString,
  };

  if (!personAccompanying.lastName && !personAccompanying.lastName) return;

  return `${personAccompanying.lastName}, ${personAccompanying.lastName}`;
}
