import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogProps, IconButton } from '@mui/material';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FHIR_EXTENSION, PrescribedMedicationDTO } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../state';

interface PhotonPrescription {
  treatment: { id: string; name: string };
  instructions: string;
  writtenAt: string;
  id: string;
}

export const ERXDialog = ({
  onClose,
  patientPhotonId,
}: {
  onClose: () => void;
  patientPhotonId?: string;
}): ReactElement => {
  const { patient, setPartialChartData, chartData } = getSelectors(useAppointmentStore, [
    'patient',
    'setPartialChartData',
    'chartData',
  ]);
  let weight: number | undefined = Number.parseFloat(
    patient?.extension?.find((ext) => ext.url === FHIR_EXTENSION.Patient.weight.url)?.valueString ?? ''
  );
  if (isNaN(weight)) {
    weight = undefined;
  }

  const existingPrescribedMeds = useMemo(
    () => chartData?.prescribedMedications || [],
    [chartData?.prescribedMedications]
  );

  useEffect(() => {
    const photonListener = (e: Event): void => {
      const prescriptionsEvent = e as unknown as { detail?: { prescriptions?: PhotonPrescription[] } };

      const prescribedMeds =
        prescriptionsEvent.detail?.prescriptions?.map(
          (detail) =>
            ({
              name: detail.treatment.name,
              instructions: detail.instructions,
              added: detail.writtenAt,
              prescriptionId: detail.id,
              status: 'loading',
            }) as PrescribedMedicationDTO
        ) || [];
      if (prescribedMeds.length > 0) {
        setPartialChartData({
          prescribedMedications: [
            ...existingPrescribedMeds,
            ...prescribedMeds.filter(
              (newMed) =>
                existingPrescribedMeds.findIndex(
                  (existingMed) => existingMed.instructions === newMed.instructions && existingMed.name === newMed.name
                ) < 0
            ),
          ],
        });
      }
      onClose();
    };
    document.addEventListener('photon-prescriptions-created', photonListener);

    return () => {
      document.removeEventListener('photon-prescriptions-created', photonListener);
    };
  }, [existingPrescribedMeds, onClose, setPartialChartData]);

  const handleClose: DialogProps['onClose'] = (_, reason) => {
    if (reason === 'backdropClick') return;
    onClose();
  };

  const [photonPortalElement, setPhotonPortalElement] = useState<HTMLElement | null>();

  useEffect(() => {
    setPhotonPortalElement(document.getElementById('photon-prescribe-workflow-dialog'));
  }, []);

  return (
    <>
      {photonPortalElement &&
        createPortal(
          <Dialog
            open={true}
            onClose={handleClose}
            fullWidth
            disablePortal={true}
            disableEscapeKeyDown
            disableScrollLock
            sx={{
              '.MuiPaper-root': {
                maxWidth: '750px',
                p: 5,
              },
              m: 5,
            }}
          >
            <Box
              sx={{
                position: 'sticky',
                marginTop: '-30px',
                marginBottom: '15px',
                marginRight: '-30px',
                display: 'block',
                width: '30px',
                left: '100%',
                top: '-30px',
              }}
            >
              <IconButton size="small" onClick={() => onClose()}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <photon-prescribe-workflow
              weight={lbsToKg(weight)}
              weight-unit="kg"
              patient-id={patientPhotonId}
              enable-order="true"
            />
          </Dialog>,
          photonPortalElement
        )}
    </>
  );
};

function lbsToKg(weightInLbs: number | undefined): number | undefined {
  if (weightInLbs === undefined) {
    return undefined;
  }

  return +(weightInLbs * 0.45359237).toFixed(2);
}
