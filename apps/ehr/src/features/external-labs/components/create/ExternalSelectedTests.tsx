import { Grid, Typography } from '@mui/material';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { nameLabTest, OrderableItemSearchResult } from 'utils';

interface ExternalSelectedTestsProps {
  selectedLabs: OrderableItemSearchResult[];
  setSelectedLabs: (labs: OrderableItemSearchResult[]) => void;
}

export const ExternalSelectedTests: React.FC<ExternalSelectedTestsProps> = ({ selectedLabs, setSelectedLabs }) => {
  return (
    <Grid container>
      <Grid item xs={12} data-testid={dataTestIds.externalLabs.createPg.selectedLabContainer}>
        <ActionsList
          data={selectedLabs}
          getKey={(value, index) => `selected-lab-${index}-${value.lab.labName}-${value.item.itemCode}`}
          renderItem={(value) => (
            <Typography>{nameLabTest(value.item.itemName, value.item.itemCode, value.lab.labName, false)}</Typography>
          )}
          renderActions={(lab) => (
            <DeleteIconButton
              onClick={() => {
                // we need the lab name for generic compendium labs (unique name will be the same)
                const selectedUniqueNameWithLab = `${lab.item.uniqueName}${lab.lab.labName}`;
                setSelectedLabs(
                  selectedLabs.filter(
                    (tempLab) => `${tempLab.item.uniqueName}${tempLab.lab.labName}` !== selectedUniqueNameWithLab
                  )
                );
              }}
            />
          )}
        />
      </Grid>
    </Grid>
  );
};
