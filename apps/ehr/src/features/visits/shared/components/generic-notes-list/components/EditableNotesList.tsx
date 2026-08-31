import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { Loader } from '../../Loader';
import { useNoteHandlers } from '../hooks/useNoteHandlers';
import { EditableNotesListProps } from '../types';
import { NoteEntity } from './NoteEntity';
import { ButtonStyled } from './ui/ButtonStyled';
import { PaperStyled } from './ui/PaperStyled';
import { TextFieldStyled } from './ui/TextFieldStyled';

export const EditableNotesList: React.FC<EditableNotesListProps> = ({
  currentEncounterId,
  locales,
  apiConfig,
  encounterId,
  appointmentId,
  patientId,
  separateEncounterNotes,
  alwaysEditable,
  showEditedMarker,
  softDeleteWithTombstone,
  addNoteButtonDataTestId,
  noteLoadingIndicatorDataTestId,
  containerSx,
}) => {
  const { entities, isLoading, handleSave, handleEdit, handleDelete } = useNoteHandlers({
    appointmentId,
    encounterId,
    patientId,
    apiConfig: apiConfig,
    locales: locales,
    softDeleteWithTombstone,
  });

  const theme = useTheme();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  // Addendum notes stay editable after the visit is locked; other note types respect the lock.
  const isReadOnly = alwaysEditable ? false : isAppointmentReadOnly;
  const [isSaving, setIsSaving] = useState(false);
  const [isMoreEntitiesShown, setIsMoreEntitiesShown] = useState(false);
  const [savingEntityText, setSavingEntityText] = useState('');

  const toggleShowMore = (): void => {
    setIsMoreEntitiesShown((state) => !state);
  };

  const handleSaveEntity = async (text: string): Promise<void> => {
    if (!text) return;
    setIsSaving(true);
    try {
      await handleSave(text);
      setSavingEntityText('');
    } catch {
      enqueueSnackbar(locales.getErrorMessage('saving', locales.entityLabel), { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentEncounterEntities = entities.filter((entity) => entity.encounterId === currentEncounterId);
  const otherEncountersEntities = entities.filter((entity) => entity.encounterId !== currentEncounterId);

  if (!entities.length && isLoading)
    return <Loader height="80px" marginTop="20px" backgroundColor={theme.palette.background.paper} />;

  return (
    <PaperStyled sx={containerSx}>
      {!isReadOnly && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 3 }}>
          <Box sx={{ flex: 1 }}>
            <TextFieldStyled
              data-testid={dataTestIds.screeningPage.screeningNoteField}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (!savingEntityText) return;
                  void handleSaveEntity(savingEntityText);
                }
              }}
              onChange={(e) => setSavingEntityText(e.target.value)}
              value={savingEntityText}
              disabled={isSaving}
              label={`Enter ${locales.entityLabel}...`}
            />
          </Box>
          <RoundedButton
            data-testid={addNoteButtonDataTestId}
            disabled={!savingEntityText || isSaving}
            onClick={() => handleSaveEntity(savingEntityText)}
            variant="contained"
            color="primary"
            sx={{
              height: '46px',
              minWidth: '80px',
              px: 2,
            }}
            startIcon={
              isSaving ? (
                <CircularProgress data-testid={noteLoadingIndicatorDataTestId} size={20} color="inherit" />
              ) : null
            }
          >
            {locales.getAddButtonText(isSaving)}
          </RoundedButton>
        </Box>
      )}

      {currentEncounterEntities.map((entity) => (
        <NoteEntity
          key={entity.resourceId}
          entity={entity}
          onEdit={handleEdit}
          onDelete={handleDelete}
          locales={locales}
          isReadOnly={isReadOnly}
          showEditedMarker={showEditedMarker}
          softDeleteWithTombstone={softDeleteWithTombstone}
        />
      ))}

      {otherEncountersEntities.length > 0 && separateEncounterNotes && (
        <ButtonStyled
          onClick={toggleShowMore}
          startIcon={isMoreEntitiesShown ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
        >
          {locales.getMoreButtonText(isMoreEntitiesShown)}
        </ButtonStyled>
      )}

      {(isMoreEntitiesShown || !separateEncounterNotes) &&
        otherEncountersEntities.map((entity) => (
          <NoteEntity
            key={entity.resourceId}
            entity={entity}
            onEdit={handleEdit}
            onDelete={handleDelete}
            locales={locales}
            isReadOnly={isReadOnly}
          />
        ))}
    </PaperStyled>
  );
};
