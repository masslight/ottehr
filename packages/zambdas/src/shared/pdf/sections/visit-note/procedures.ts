import { DateTime } from 'luxon';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, Procedures } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeProcedures: DataComposer<{ allChartData: AllChartData }, Procedures> = ({ allChartData }) => {
  const { chartData } = allChartData;
  const procedures = chartData?.procedures?.map((procedure) => ({
    procedureType: procedure.procedureType,
    cptCodes: procedure?.cptCodes?.map((cptCode) => cptCode.code + ' ' + cptCode.display),
    diagnoses: procedure?.diagnoses?.map((diagnosis) => diagnosis.code + ' ' + diagnosis.display),
    procedureDateTime:
      procedure.procedureDateTime != null
        ? DateTime.fromISO(procedure.procedureDateTime).toFormat('MM/dd/yyyy, HH:mm a')
        : undefined,
    performerType: procedure.performerType,
    medicationUsed: procedure.medicationUsed,
    bodySite: procedure.bodySite,
    bodySide: procedure.bodySide,
    technique: procedure.technique,
    suppliesUsed: procedure.suppliesUsed,
    procedureDetails: procedure.procedureDetails,
    specimenSent: procedure.specimenSent != null ? (procedure.specimenSent ? 'Yes' : 'No') : undefined,
    complications: procedure.complications,
    patientResponse: procedure.patientResponse,
    postInstructions: procedure.postInstructions,
    timeSpent: procedure.timeSpent,
    documentedBy: procedure.documentedBy,
  }));
  return {
    procedures,
  };
};

export const createProceduresSection = <TData extends { procedures?: Procedures }>(): PdfSection<TData, Procedures> => {
  return createConfiguredSection(null, () => ({
    title: 'Procedures',
    dataSelector: (data) => data.procedures,
    shouldRender: (sectionData) => !!sectionData.procedures?.length,
    render: (client, data, styles) => {
      data.procedures?.forEach((procedure) => {
        drawBlockHeader(client, styles, procedure.procedureType ?? '', styles.textStyles.blockSubHeader);
        drawRegularText(
          client,
          styles,
          procedure.cptCodes != null && procedure.cptCodes.length > 0
            ? 'CPT: ' + procedure.cptCodes.join('; ')
            : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.diagnoses != null && procedure.diagnoses.length > 0
            ? 'Dx: ' + procedure.diagnoses.join('; ')
            : undefined
        );

        drawRegularText(
          client,
          styles,
          procedure.procedureDateTime != null
            ? 'Date and time of the procedure: ' + procedure.procedureDateTime
            : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.performerType != null ? 'Performed by: ' + procedure.performerType : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.medicationUsed != null ? 'Anaesthesia / medication used: ' + procedure.medicationUsed : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.bodySite != null ? 'Site/location: ' + procedure.bodySite : undefined
        );
        drawRegularText(client, styles, procedure.bodySide != null ? 'Side of body: ' + procedure.bodySide : undefined);
        drawRegularText(client, styles, procedure.technique != null ? 'Technique: ' + procedure.technique : undefined);
        drawRegularText(
          client,
          styles,
          procedure.suppliesUsed != null ? 'Instruments / supplies used: ' + procedure.suppliesUsed : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.procedureDetails != null ? 'Procedure details: ' + procedure.procedureDetails : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.specimenSent != null ? 'Specimen sent: ' + procedure.specimenSent : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.complications != null ? 'Complications: ' + procedure.complications : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.patientResponse != null ? 'Patient response: ' + procedure.patientResponse : undefined
        );
        drawRegularText(
          client,
          styles,
          procedure.postInstructions != null ? 'Post-procedure instructions: ' + procedure.postInstructions : undefined
        );
        drawRegularText(client, styles, procedure.timeSpent != null ? 'Time spent: ' + procedure.timeSpent : undefined);
        drawRegularText(
          client,
          styles,
          procedure.documentedBy != null ? 'Documented by: ' + procedure.documentedBy : undefined
        );
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
