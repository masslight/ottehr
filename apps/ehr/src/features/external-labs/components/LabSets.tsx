import CloseIcon from '@mui/icons-material/Close';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import { LoadingButton } from '@mui/lab';
import { Box, Dialog, DialogContent, DialogTitle, Divider, Grid, IconButton, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { FC, useState } from 'react';
import { LabListsDTO } from 'utils';

type LabSetsProps = {
  labSets: LabListsDTO[];
  setSelectedLabs: (labSet: LabListsDTO) => Promise<void>;
};

export const LabSets: FC<LabSetsProps> = ({ labSets, setSelectedLabs }) => {
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string[] | undefined>(undefined);

  const handleSelectLabSet = async (labSet: LabListsDTO): Promise<void> => {
    setLoadingId(labSet.listId); // start loading for this button only
    try {
      await setSelectedLabs(labSet);
      setOpen(false);
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('error selecting this lab set', sdkError.code, sdkError.message);
      setError([sdkError.message]);
    } finally {
      setLoadingId(null);
    }
  };

  if (labSets.length === 0) return <></>;

  return (
    <>
      <Box
        sx={{ display: 'flex', p: '16px 8px', cursor: 'pointer' }}
        gap={1}
        color="primary.main"
        onClick={() => setOpen(true)}
      >
        <FormatListBulletedIcon />
        <Typography fontWeight="500">Lab Sets</Typography>
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: '24px 24px 16px 24px',
          }}
        >
          <Typography variant="h4" component="div" color="primary.dark">
            Lab Sets
          </Typography>
          <IconButton
            onClick={() => {
              setError(undefined);
              setOpen(false);
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {labSets.map((set, idx) => (
            <Box key={`set-${idx}-${set.listId}`}>
              <Grid container>
                <Grid
                  item
                  xs={9}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    rowGap: '8px',
                  }}
                >
                  <Typography variant="h6" fontWeight="700" color="primary.dark">
                    {set.listName}:
                  </Typography>
                  {set.labs.map((lab, idx) => (
                    <Typography key={`set-item-${set.listId}-${idx}`}>{lab.display}</Typography>
                  ))}
                </Grid>
                <Grid item xs={3} sx={{ textAlign: 'right' }}>
                  <LoadingButton
                    loading={loadingId === set.listId}
                    variant="contained"
                    sx={{ borderRadius: '100px', p: '8px 22px', textTransform: 'none' }}
                    onClick={async () => {
                      await handleSelectLabSet(set);
                    }}
                  >
                    Select
                  </LoadingButton>
                </Grid>
              </Grid>
              {idx < labSets.length - 1 && <Divider sx={{ my: 2 }} />}
            </Box>
          ))}
          {Array.isArray(error) &&
            error.length > 0 &&
            error.map((msg, idx) => (
              <Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                <Typography color="error">{typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}</Typography>
              </Grid>
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
};
