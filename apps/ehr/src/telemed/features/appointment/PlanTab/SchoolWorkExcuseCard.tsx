import { Box, Divider, Grid, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { SCHOOL_WORK_NOTE } from 'utils';
import { getStringAnswer } from '../../../../features/css-module/parser';
import { AccordionCard, DoubleColumnContainer } from '../../../components';
import {
  useExcusePresignedFiles,
  useGetAppointmentAccessibility,
  usePatientProvidedExcusePresignedFiles,
} from '../../../hooks';
import { useAppointmentData, useChartData, useDeleteChartData, useSaveChartData } from '../../../state';
import { ExcuseCard, ExcuseLink, GenerateExcuseDialog } from './components';

export const SchoolWorkExcuseCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [generateWorkTemplateOpen, setGenerateWorkTemplateOpen] = useState(false);
  const [generateWorkFreeOpen, setGenerateWorkFreeOpen] = useState(false);
  const [generateSchoolTemplateOpen, setGenerateSchoolTemplateOpen] = useState(false);
  const [generateSchoolFreeOpen, setGenerateSchoolFreeOpen] = useState(false);
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const isLoading = isSaveLoading || isDeleteLoading;
  const { questionnaireResponse } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const presignedFiles = useExcusePresignedFiles(chartData?.schoolWorkNotes);
  const { patientSchoolPresignedUrl, patientWorkPresignedUrl } = usePatientProvidedExcusePresignedFiles();

  const workExcuse = presignedFiles.find((file) => file.type === 'work');
  const schoolExcuse = presignedFiles.find((file) => file.type === 'school');

  const onDelete = (id: string): void => {
    const schoolWorkNotes = chartData?.schoolWorkNotes || [];
    const note = schoolWorkNotes.find((note) => note.id === id)!;
    deleteChartData(
      {
        schoolWorkNotes: [note],
      },
      {
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting excuse. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({
            schoolWorkNotes: schoolWorkNotes,
          });
        },
      }
    );
    setPartialChartData({
      schoolWorkNotes: schoolWorkNotes.filter((note) => note.id !== id),
    });
  };

  const onPublish = (id: string): void => {
    const schoolWorkNotes = chartData?.schoolWorkNotes || [];
    const note = schoolWorkNotes.find((note) => note.id === id)!;

    saveChartData(
      {
        schoolWorkNotes: [{ id: note.id, published: true }],
      },
      {
        onSuccess: () => {
          setPartialChartData({
            schoolWorkNotes: schoolWorkNotes.map((note) => (note.id === id ? { ...note, published: true } : note)),
          });
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while publishing excuse. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };

  const schoolWorkNoteChoice = getStringAnswer(questionnaireResponse, `${SCHOOL_WORK_NOTE}-choice`);

  let title = '';
  switch (schoolWorkNoteChoice) {
    case 'School only':
      title = 'School';
      break;
    case 'Work only':
      title = 'Work';
      break;
    case 'Both school and work notes':
      title = 'School & Work';
      break;
    default:
      // case 'Neither'
      title = 'Neither';
      break;
  }

  const numTemplatesUploaded = +Boolean(patientSchoolPresignedUrl) + +Boolean(patientWorkPresignedUrl);

  return (
    <>
      <AccordionCard
        label="School / Work Excuse"
        collapsed={collapsed}
        onSwitch={() => setCollapsed((prevState) => !prevState)}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography display="inline">Patient requested excuse from:</Typography>&nbsp;
            <Typography display="inline" fontWeight={500}>
              {title}
            </Typography>
          </Box>
          {numTemplatesUploaded !== 0 && (
            <>
              <Typography>{`Attached template${numTemplatesUploaded === 2 ? 's' : ''}:`}</Typography>
              <Grid container columnSpacing={3} sx={{ position: 'relative' }}>
                {patientSchoolPresignedUrl && (
                  <Grid item xs={6}>
                    {/* TODO extension should match extension uploaded */}
                    <ExcuseLink label={`School excuse note template${'.pdf'}`} to={patientSchoolPresignedUrl} />
                  </Grid>
                )}
                {patientWorkPresignedUrl && (
                  <Grid item xs={6}>
                    {/* TODO extension should match extension uploaded */}
                    <ExcuseLink label={`Work excuse note template${'.pdf'}`} to={patientWorkPresignedUrl} />
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </Box>

        <Divider />

        <DoubleColumnContainer
          leftColumn={
            <ExcuseCard
              label="School excuse"
              excuse={schoolExcuse}
              onDelete={onDelete}
              onPublish={onPublish}
              isLoading={isLoading || isReadOnly}
              generateTemplateOpen={setGenerateSchoolTemplateOpen}
              generateFreeOpen={setGenerateSchoolFreeOpen}
              disabled={isReadOnly}
            />
          }
          rightColumn={
            <ExcuseCard
              label="Work excuse"
              excuse={workExcuse}
              onDelete={onDelete}
              onPublish={onPublish}
              isLoading={isLoading}
              generateTemplateOpen={setGenerateWorkTemplateOpen}
              generateFreeOpen={setGenerateWorkFreeOpen}
              disabled={isReadOnly}
            />
          }
          divider
          padding
        />
      </AccordionCard>

      {generateWorkTemplateOpen && (
        <GenerateExcuseDialog
          type="workTemplate"
          open={generateWorkTemplateOpen}
          onClose={() => setGenerateWorkTemplateOpen(false)}
          generate={saveChartData}
        />
      )}
      {generateWorkFreeOpen && (
        <GenerateExcuseDialog
          type="workFree"
          open={generateWorkFreeOpen}
          onClose={() => setGenerateWorkFreeOpen(false)}
          generate={saveChartData}
        />
      )}
      {generateSchoolTemplateOpen && (
        <GenerateExcuseDialog
          type="schoolTemplate"
          open={generateSchoolTemplateOpen}
          onClose={() => setGenerateSchoolTemplateOpen(false)}
          generate={saveChartData}
        />
      )}
      {generateSchoolFreeOpen && (
        <GenerateExcuseDialog
          type="schoolFree"
          open={generateSchoolFreeOpen}
          onClose={() => setGenerateSchoolFreeOpen(false)}
          generate={saveChartData}
        />
      )}
    </>
  );
};
