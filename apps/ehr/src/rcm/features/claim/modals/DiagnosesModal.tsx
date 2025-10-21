import AddIcon from '@mui/icons-material/Add';
import { Box, Divider, Typography } from '@mui/material';
import { FC, Fragment } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { useEditClaimInformationMutation } from 'src/rcm/state';
import { ClaimState, useClaimStore } from 'src/rcm/state/claim/claim.store';
import { DIAGNOSES_SEQUENCE_LETTER, DiagnosesFormValues, mapDiagnosesToClaimResource } from 'src/rcm/utils';
import { getSelectors } from 'utils/lib/store';
import { RoundedButton } from '../../../../components/RoundedButton';
import { DiagnosisController, EditModal, TextFieldController } from './components';

const getDefaultValues = (claimData: ClaimState['claimData']): DiagnosesFormValues => ({
  items: claimData?.diagnoses || [],
  comment: claimData?.diagnosesComment || '',
});

export const DiagnosesModal: FC = () => {
  const { claimData, claim, setClaimData } = getSelectors(useClaimStore, ['claimData', 'claim', 'setClaimData']);

  const editClaim = useEditClaimInformationMutation();

  const methods = useForm<DiagnosesFormValues>({
    defaultValues: getDefaultValues(claimData),
  });

  const { control, handleSubmit, reset } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const onSave = (values: DiagnosesFormValues, hideDialog: () => void): void => {
    if (!claim) {
      throw Error('Claim not provided');
    }

    const updatedClaim = mapDiagnosesToClaimResource(claim, values);

    const editClaimPromise = editClaim.mutateAsync({
      claimData: updatedClaim,
      previousClaimData: claim,
      fieldsToUpdate: ['diagnosis', 'extension'],
    });

    Promise.resolve(editClaimPromise)
      .then((responseClaim) => {
        setClaimData(responseClaim);
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        hideDialog();
      });
  };

  return (
    <FormProvider {...methods}>
      <EditModal
        title="21. Diagnoses"
        onSave={(hideDialog) => handleSubmit((values) => onSave(values, hideDialog))()}
        isSaveLoading={editClaim.isPending}
        onShow={() => reset(getDefaultValues(claimData))}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map((field, index) => (
            <Fragment key={field.id}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography sx={{ width: '1rem' }}>{DIAGNOSES_SEQUENCE_LETTER[index]}</Typography>
                <DiagnosisController name={`items.${index}`} />
                <DeleteIconButton fontSize="medium" onClick={() => remove(index)} />
              </Box>
              <Divider flexItem />
            </Fragment>
          ))}
          {fields.length < 12 && (
            <RoundedButton startIcon={<AddIcon />} variant="text" onClick={() => append(null)}>
              Add diagnosis
            </RoundedButton>
          )}
          <TextFieldController name="comment" label="Comment about diagnosis change" multiline />
        </Box>
      </EditModal>
    </FormProvider>
  );
};
