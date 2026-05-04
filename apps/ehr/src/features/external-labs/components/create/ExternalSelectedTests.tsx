import { Grid, Typography } from '@mui/material';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { nameLabTest, OrderableItemSearchResult } from 'utils';

interface ExternalSelectedTestsProps {
  selectedLabs: OrderableItemSearchResult[];
  setSelectedLabs: React.Dispatch<React.SetStateAction<OrderableItemSearchResult[]>>;
}

export const ExternalSelectedTests: React.FC<ExternalSelectedTestsProps> = ({ selectedLabs, setSelectedLabs }) => {
  return (
    <Grid container>
      <Grid item xs={12} data-testid={dataTestIds.externalLabs.createPg.selectedLabContainer}>
        <ActionsList
          data={selectedLabs}
          getKey={(value, index) => `selected-lab-${index}-${value.item.itemCode}`}
          renderItem={(value) => <Typography>{nameLabTest(value.item.itemName, value.lab.labName, false)}</Typography>}
          renderActions={(lab) => (
            <DeleteIconButton
              onClick={() =>
                setSelectedLabs((prev) =>
                  prev.filter((tempLab) => {
                    return tempLab.item.uniqueName !== lab.item.uniqueName;
                  })
                )
              }
            />
          )}
        />
      </Grid>
    </Grid>
  );
};
