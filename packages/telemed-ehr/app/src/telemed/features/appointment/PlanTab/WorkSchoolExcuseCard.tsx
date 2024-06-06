import React, { FC, useState } from 'react';
import { Box, Divider, Grid, Typography } from '@mui/material';
import { AccordionCard, DoubleColumnContainer } from '../../../components';
import { ExcuseLink, GenerateExcuseDialog, ExcuseCard } from './components';
import { useDeleteChartData, useSaveChartData } from '../../../state';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { useExcusePresignedFiles } from '../../../hooks';

export const WorkSchoolExcuseCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const [generateWorkTemplateOpen, setGenerateWorkTemplateOpen] = useState(false);
  const [generateWorkFreeOpen, setGenerateWorkFreeOpen] = useState(false);
  const [generateSchoolTemplateOpen, setGenerateSchoolTemplateOpen] = useState(false);
  const [generateSchoolFreeOpen, setGenerateSchoolFreeOpen] = useState(false);

  const { mutate: saveChartData, isLoading: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();
  const isLoading = isSaveLoading || isDeleteLoading;

  const { chartData, setPartialChartData, isReadOnly } = getSelectors(useAppointmentStore, [
    'chartData',
    'setPartialChartData',
    'isReadOnly',
  ]);
  const presignedFiles = useExcusePresignedFiles(chartData?.workSchoolNotes);

  const workExcuse = presignedFiles.find((file) => file.type === 'work');
  const schoolExcuse = presignedFiles.find((file) => file.type === 'school');

  const onDelete = (id: string): void => {
    const workSchoolNotes = chartData?.workSchoolNotes || [];
    const note = workSchoolNotes.find((note) => note.id === id)!;
    deleteChartData({
      workSchoolNotes: [note],
    });
    setPartialChartData({
      workSchoolNotes: workSchoolNotes.filter((note) => note.id !== id),
    });
  };

  const onPublish = (id: string): void => {
    const workSchoolNotes = chartData?.workSchoolNotes || [];
    const note = workSchoolNotes.find((note) => note.id === id)!;

    saveChartData(
      {
        workSchoolNotes: [{ id: note.id, published: true }],
      },
      {
        onSuccess: () => {
          setPartialChartData({
            workSchoolNotes: workSchoolNotes.map((note) => (note.id === id ? { ...note, published: true } : note)),
          });
        },
      }
    );
  };

  return (
    <>
      <AccordionCard
        label="Work / School Excuse"
        collapsed={collapsed}
        onSwitch={() => setCollapsed((prevState) => !prevState)}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography display="inline">Patient requested excuse from:</Typography>&nbsp;
            <Typography display="inline" fontWeight={700}>
              Work & School
            </Typography>
          </Box>
          <Typography>Attached templates:</Typography>

          <Grid container columnSpacing={3} sx={{ position: 'relative' }}>
            <Grid item xs={6}>
              <ExcuseLink label="Work excuse note - Pixel Inc.pdf" to="#" />
            </Grid>
            <Grid item xs={6}>
              <ExcuseLink label="Pasadena Elementary School - excuse note.docx" to="#" />
            </Grid>
          </Grid>
        </Box>

        <Divider />

        <DoubleColumnContainer
          leftColumn={
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
          rightColumn={
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
