import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { CircularProgress, Grid, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { CSSLoader } from '../../CSSLoader';
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
  addNoteButtonDataTestId,
  noteLoadingIndicatorDataTestId,
}) => {
  const { entities, isLoading, handleSave, handleEdit, handleDelete } = useNoteHandlers({
    appointmentId,
    encounterId,
    patientId,
    apiConfig: apiConfig,
    locales: locales,
  });

  const theme = useTheme();
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
    return <CSSLoader height="80px" marginTop="20px" backgroundColor={theme.palette.background.paper} />;

  return (
    <PaperStyled>
      <Grid container spacing={1} alignItems="center" sx={{ p: 3 }}>
        <Grid item xs>
          <TextFieldStyled
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
        </Grid>
        <Grid item>
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
        </Grid>
      </Grid>

      {currentEncounterEntities.map((entity) => (
        <NoteEntity
          key={entity.resourceId}
          entity={entity}
          onEdit={handleEdit}
          onDelete={handleDelete}
          locales={locales}
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
          />
        ))}
    </PaperStyled>
  );
};
