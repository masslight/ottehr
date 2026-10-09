import { Box, Button, Stack, Typography } from '@mui/material';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteVisitForm, getPatientFormResponses, sendPatientForm } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import { CustomFormCard } from 'src/components/CustomFormCard';
import DeleteDialog from 'src/components/dialogs/DeleteDialog';
import { EditFormResponseDialog } from 'src/components/dialogs/EditFormResponseDialog';
import { SendFormDialog } from 'src/components/dialogs/SendFormDialog';
import { Section } from 'src/components/layout/Section';
import { QuestionnaireResponseViewer } from 'src/components/QuestionnaireResponseViewer';
import { useApiClients } from 'src/hooks/useAppClients';
import { FormPlacement, hasAnyAnswer } from 'utils/lib/helpers/practice-managed-questionnaires';
import {
  GetPatientFormResponsesOutput,
  PatientFormResponse,
  StandaloneFormDTO,
} from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { Loader } from '../Loader';
import { formPagePath, OpenFormResponseState } from './formNavigation';
import { groupByForm } from './groupByForm';

/** One load per patient, shared by the Screening section, the Questionnaires page and the note. */
const usePatientFormResponses = (): UseQueryResult<GetPatientFormResponsesOutput> => {
  const { oystehrZambda } = useApiClients();
  const { patient } = useAppointmentData();
  return useQuery({
    queryKey: ['get-patient-form-responses', patient?.id],
    queryFn: () =>
      getPatientFormResponses(oystehrZambda!, { patientId: patient!.id!, placements: ['screening', 'questionnaires'] }),
    enabled: Boolean(oystehrZambda && patient?.id),
  });
};

interface PatientFormResponsesProps {
  placement: FormPlacement;
  /** Only this visit's responses (Screening), or every visit's grouped by form (Questionnaires). */
  scope: 'this-visit' | 'all-visits';
}

export const PatientFormResponses: FC<PatientFormResponsesProps> = ({ placement, scope }) => {
  const { oystehrZambda } = useApiClients();
  const { appointment, encounter, patient } = useAppointmentData();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const [formToEdit, setFormToEdit] = useState<StandaloneFormDTO | undefined>();
  const [formToDelete, setFormToDelete] = useState<PatientFormResponse | undefined>();
  const [deleting, setDeleting] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const patientId = patient?.id;
  const { data, refetch, isLoading, isError } = usePatientFormResponses();

  // A form started from another page's dialog arrives here to be filled out.
  const navigate = useNavigate();
  const location = useLocation();
  const openFormResponseId = (location.state as OpenFormResponseState | null)?.openFormResponseId;
  useEffect(() => {
    const toOpen = data?.responses.find((r) => r.questionnaireResponse.id === openFormResponseId);
    if (!toOpen) return;
    setFormToEdit(toOpen);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [data, openFormResponseId, location.pathname, location.search, navigate]);

  const isThisVisit = (r: PatientFormResponse): boolean => r.encounterId === encounter?.id;
  const responses = (data?.responses ?? []).filter(
    (r) => r.placement === placement && (scope === 'all-visits' || isThisVisit(r))
  );
  const canChange = !isAppointmentReadOnly;

  const fillOutNow = async (questionnaireId: string, formPlacement: FormPlacement): Promise<void> => {
    if (!oystehrZambda || !appointment?.id) return;
    try {
      const { questionnaireResponseId } = await sendPatientForm(oystehrZambda, {
        appointmentId: appointment.id,
        questionnaireId,
        notifyPatient: false,
        encounterId: encounter?.id,
      });
      if (formPlacement !== placement) {
        const state: OpenFormResponseState = { openFormResponseId: questionnaireResponseId };
        navigate(formPagePath(formPlacement, appointment.id, encounter?.partOf ? encounter.id : undefined), { state });
        return;
      }
      const { data: refreshed } = await refetch();
      setFormToEdit(refreshed?.responses.find((r) => r.questionnaireResponse.id === questionnaireResponseId));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Could not start the form. Please try again.', { variant: 'error' });
    }
  };

  const deleteForm = async (): Promise<void> => {
    const questionnaireResponseId = formToDelete?.questionnaireResponse.id;
    if (!oystehrZambda || !questionnaireResponseId || !patientId) return;
    setDeleting(true);
    try {
      await deleteVisitForm(oystehrZambda, { questionnaireResponseId, patientId });
      setFormToDelete(undefined);
      enqueueSnackbar('Form deleted', { variant: 'success' });
      await refetch();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to delete form.', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const renderResponse = (r: PatientFormResponse, titled: boolean): JSX.Element => {
    const date = formatDateForDisplay(r.visitDate);
    const form = titled ? r : { ...r, questionnaireTitle: `${date} · This visit` };
    if (isThisVisit(r) && canChange) {
      return (
        <CustomFormCard
          key={r.questionnaireResponse.id}
          form={form}
          deletable={r.deletable}
          onEdit={() => setFormToEdit(r)}
          onDelete={() => setFormToDelete(r)}
        />
      );
    }
    if (isThisVisit(r)) {
      return (
        <Section key={r.questionnaireResponse.id} title={form.questionnaireTitle}>
          <QuestionnaireResponseViewer form={r} />
        </Section>
      );
    }
    return <PastResponse key={r.questionnaireResponse.id} response={r} label={date} />;
  };

  return (
    <Stack spacing={2}>
      {canChange && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={() => setSendOpen(true)}>
            Add form
          </Button>
        </Box>
      )}

      {scope === 'this-visit'
        ? responses.map((r) => renderResponse(r, true))
        : groupByForm(responses).map((group) => (
            <FormGroup key={group[0].questionnaireUrl ?? group[0].questionnaireTitle} group={group}>
              {group.map((r) => renderResponse(r, false))}
            </FormGroup>
          ))}

      {isLoading && <Loader />}
      {isError && (
        <Typography variant="body2" color="error">
          Could not load forms. Reload to try again.
        </Typography>
      )}
      {scope === 'all-visits' && data && responses.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No responses yet.
        </Typography>
      )}

      {formToEdit && (
        <EditFormResponseDialog
          form={formToEdit}
          patientId={patientId}
          onClose={() => setFormToEdit(undefined)}
          onSaved={() => {
            setFormToEdit(undefined);
            void refetch();
          }}
        />
      )}
      <DeleteDialog
        open={Boolean(formToDelete)}
        title="Delete form?"
        description={`"${
          formToDelete?.questionnaireTitle ?? 'This form'
        }" and the answers submitted on it will no longer show on this visit.`}
        closeButtonText="Cancel"
        handleClose={() => setFormToDelete(undefined)}
        deleteButtonText="Delete"
        handleDelete={() => void deleteForm()}
        loadingDelete={deleting}
      />
      {appointment?.id && sendOpen && (
        <SendFormDialog
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          appointmentId={appointment.id}
          encounterId={encounter?.id}
          placement={placement}
          onSent={() => void refetch()}
          onFillOut={(questionnaireId, formPlacement) => void fillOutNow(questionnaireId, formPlacement)}
        />
      )}
    </Stack>
  );
};

const FormGroup: FC<{ group: PatientFormResponse[]; children: React.ReactNode }> = ({ group, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const latest = formatDateForDisplay(group[0].visitDate);
  return (
    <AccordionCard
      label={`${group[0].questionnaireTitle} · ${group.length} response${
        group.length === 1 ? '' : 's'
      } · latest ${latest}`}
      collapsed={collapsed}
      onSwitch={() => setCollapsed((c) => !c)}
    >
      <Stack spacing={2} sx={{ p: 2 }}>
        {children}
      </Stack>
    </AccordionCard>
  );
};

/** An earlier visit's response: view-only and collapsed until opened. */
const PastResponse: FC<{ response: PatientFormResponse; label: string }> = ({ response, label }) => {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <AccordionCard label={label} collapsed={collapsed} onSwitch={() => setCollapsed((c) => !c)}>
      <Box sx={{ p: 2 }}>
        <QuestionnaireResponseViewer form={response} />
      </Box>
    </AccordionCard>
  );
};

/** This visit's responses to Screening and Questionnaires forms, for the progress note. */
export const useThisVisitFormResponses = (): Record<'screening' | 'questionnaires', PatientFormResponse[]> => {
  const { encounter } = useAppointmentData();
  const { data } = usePatientFormResponses();
  const thisVisit = (data?.responses ?? []).filter((r) => r.encounterId === encounter?.id && hasAnyAnswer(r));
  return {
    screening: thisVisit.filter((r) => r.placement === 'screening'),
    questionnaires: thisVisit.filter((r) => r.placement === 'questionnaires'),
  };
};

/** Read-only answers, one block per form, as the note shows them. */
export const FormResponsesSummary: FC<{ responses: PatientFormResponse[]; emptyMessage?: string }> = ({
  responses,
  emptyMessage,
}) => (
  <Stack spacing={1}>
    {emptyMessage && responses.length === 0 && <Typography color="text.secondary">{emptyMessage}</Typography>}
    {responses.map((r) => (
      <Box key={r.questionnaireResponse.id}>
        <Typography fontWeight={600}>{r.questionnaireTitle}</Typography>
        <QuestionnaireResponseViewer form={r} />
      </Box>
    ))}
  </Stack>
);
