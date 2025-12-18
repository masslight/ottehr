import { otherColors } from '@ehrTheme/colors';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LoadingButton } from '@mui/lab';
import { Box, Button, TableCell, TableRow, TextField, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { ReactElement, useState } from 'react';
import { updateLabOrderResources } from 'src/api/api';
import { CustomDialog } from 'src/components/dialogs';
import { HL7_NOTE_CHAR_LIMIT, LabOrderListPageDTO, openPdf } from 'utils';

interface LabsTableBundleHeaderRowProps {
  columnsLen: number;
  orderBundleName: string;
  showSubmitButton: boolean;
  pendingLabsLen: number;
  submitLoading: boolean;
  abnPdfUrl: string | undefined;
  orderPdfUrl: string | undefined;
  submitOrders: (manualOrder: boolean, labsToSubmit?: LabOrderListPageDTO[]) => Promise<void>;
  refetchLabOrders: () => Promise<void>;
  oystehr: Oystehr | undefined;
  requisitionNumber?: string; // results are not grouped by requisition but still need a header row
  existingNote?: string;
}

export const LabsTableBundleHeaderRow = ({
  columnsLen,
  orderBundleName,
  showSubmitButton,
  pendingLabsLen,
  submitLoading,
  abnPdfUrl,
  orderPdfUrl,
  submitOrders,
  refetchLabOrders,
  oystehr,
  requisitionNumber,
  existingNote,
}: LabsTableBundleHeaderRowProps): ReactElement => {
  const [openOrderNoteDialog, setOpenOrderNoteDialog] = useState<boolean>(false);
  const [orderNote, setOrderNote] = useState<string>(existingNote ?? '');
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [noteState, setNoteState] = useState<'add' | 'view' | 'edit'>(existingNote ? 'view' : 'add');
  const [noteError, setNoteError] = useState<string | undefined>(undefined);

  const handleAddOrEditOrderNote = async (): Promise<void> => {
    if (!oystehr) throw Error('no oystehr configured');
    if (!requisitionNumber) throw Error('no requisitionNumber');
    if (!orderNote && noteState === 'add') {
      setNoteError('Please enter a note.');
      return;
    }
    if (orderNote.length > HL7_NOTE_CHAR_LIMIT) {
      setNoteError(`Note must be under ${HL7_NOTE_CHAR_LIMIT} characters long, length of note: ${orderNote.length}`);
      return;
    }
    setSavingNote(true);
    try {
      await updateLabOrderResources(oystehr, {
        event: existingNote ? 'updateOrderLevelNote' : 'addOrderLevelNote',
        requisitionNumber,
        note: orderNote,
      });
      await refetchLabOrders();
    } catch (e) {
      const error = e as OystehrSdkError;
      console.error('error', JSON.stringify(error));
      setNoteError(error.message ?? 'Error saving note');
    }
    setSavingNote(false);
    setNoteState('view');
  };

  const makeNoteEditable = (): void => {
    setNoteState('edit');
  };

  const closeEditNoteDialog = (): void => {
    setOpenOrderNoteDialog(false);
    setNoteError(undefined);
    setOrderNote(existingNote ?? '');
    if (existingNote) {
      setNoteState('view');
      setOrderNote(existingNote);
    } else {
      setNoteState('add');
    }
  };

  return (
    <>
      <TableRow>
        <TableCell colSpan={columnsLen} sx={{ p: '8px 18px', backgroundColor: '#2169F514' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body1" sx={{ fontWeight: '500', color: 'primary.dark' }}>
                {orderBundleName}
              </Typography>
            </Box>
            {showSubmitButton && (
              <Box>
                <Button
                  onClick={() => setOpenOrderNoteDialog(true)}
                  variant="outlined"
                  type="button"
                  sx={{ maxWidth: 200, borderRadius: '50px', textTransform: 'none', mr: 1 }}
                >
                  {existingNote ? 'View' : 'Add'} order level note
                </Button>

                <LoadingButton
                  loading={submitLoading}
                  variant="contained"
                  sx={{ borderRadius: '50px', textTransform: 'none', py: 1, px: 5, textWrap: 'nowrap' }}
                  color="primary"
                  size={'medium'}
                  onClick={() => submitOrders(false)}
                  disabled={pendingLabsLen > 0}
                >
                  Submit & Print Order(s)
                </LoadingButton>
              </Box>
            )}
            {abnPdfUrl && (
              <Button
                variant="outlined"
                type="button"
                sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
                onClick={() => openPdf(abnPdfUrl)}
              >
                Re-print ABN
              </Button>
            )}
            {orderPdfUrl && (
              <Button
                variant="outlined"
                type="button"
                sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
                onClick={() => openPdf(orderPdfUrl)}
              >
                Re-print Order
              </Button>
            )}
          </Box>
        </TableCell>
      </TableRow>
      {abnPdfUrl && (
        <TableRow sx={{ p: '6px 16px' }}>
          <TableCell colSpan={columnsLen} sx={{ p: '8px 18px', background: otherColors.warningBackground }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <WarningAmberIcon sx={{ fontWeight: '600', color: otherColors.warningIcon, paddingRight: '8px' }} />
              <Typography variant="h5" color={otherColors.warningIcon}>
                Advance Beneficiary Notice
              </Typography>
            </Box>
            <Typography variant="body2">
              Some tests may not be covered by patient’s insurance. Patient needs to review and sign ABN. If not signed,
              please mark the test(s) as rejected on the printed order form.
            </Typography>
          </TableCell>
        </TableRow>
      )}
      <CustomDialog
        open={openOrderNoteDialog}
        confirmLoading={savingNote}
        handleConfirm={noteState === 'view' ? makeNoteEditable : handleAddOrEditOrderNote}
        confirmText={noteState === 'view' ? 'Edit note' : 'Save note'}
        handleClose={closeEditNoteDialog}
        title="Order Level Note"
        description={
          <Box sx={{ width: '400px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption">
              This note will be sent to the lab and will apply to all tests within the order.
            </Typography>
            {noteState === 'view' ? (
              <Typography>{existingNote}</Typography>
            ) : (
              <TextField
                multiline
                rows={2}
                value={orderNote}
                onChange={(e) => {
                  setOrderNote(e.target.value);
                }}
              ></TextField>
            )}
          </Box>
        }
        error={noteError}
        closeButtonText={noteState === 'view' ? 'Close' : 'Cancel'}
      />
    </>
  );
};
