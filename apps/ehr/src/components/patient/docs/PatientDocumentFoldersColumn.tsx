import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { List, ListItemButton, ListItemIcon, ListItemText, Skeleton, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { PatientDocumentsFolder } from '../../../hooks/useGetPatientDocs';

export type PatientDocumentFoldersColumnProps = {
  documentsFolders: PatientDocumentsFolder[];
  selectedFolder?: PatientDocumentsFolder;
  onFolderSelected?: (selectedFolder: PatientDocumentsFolder) => void;
};

export const PatientDocumentFoldersColumn: FC<PatientDocumentFoldersColumnProps> = (props) => {
  const { documentsFolders, selectedFolder, onFolderSelected } = props;

  const theme = useTheme();

  const selectedIndex = documentsFolders.findIndex(
    (folder) => folder.id === selectedFolder?.id || folder.folderName === selectedFolder?.folderName
  );

  // const lineColor = historyEntry.isTemperatureWarning ? theme.palette.error.main : theme.palette.text.primary;

  return (
    <List>
      {documentsFolders
        .sort((a, b) => a.folderName.localeCompare(b.folderName))
        .map((folder, index) => (
          <ListItemButton
            key={`${folder.folderName}__${index}`}
            onClick={() => onFolderSelected && onFolderSelected(folder)}
            sx={{
              backgroundColor: selectedIndex === index ? '#4D15B714' : 'transparent',
              borderRadius: 3,
              py: 0.5,
              marginX: 2,
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            }}
          >
            <ListItemIcon sx={{ color: theme.palette.primary.main }}>
              {selectedIndex === index ? <FolderOpenOutlinedIcon /> : <FolderOutlinedIcon />}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: selectedIndex === index ? 'bold' : 'normal',
                  }}
                >
                  {folder.folderName} - {folder.documentsCount}
                </Typography>
              }
            />
          </ListItemButton>
        ))}
    </List>
  );
};

export const PatientDocumentFoldersColumnSkeleton: React.FC<{ stubsCount: number }> = ({ stubsCount }): JSX.Element => {
  const fakeFolders = new Array<string>(stubsCount).fill('Stub folder');
  return (
    <List>
      {fakeFolders.map((folderName, index) => (
        <Skeleton key={`${folderName}__${index}`}>
          <ListItemButton
            sx={{
              borderRadius: 3,
              py: 0.5,
              marginX: 2,
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            }}
          >
            <ListItemIcon>
              <FolderOpenOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary={<Typography>{folderName} - 10</Typography>} />
          </ListItemButton>
        </Skeleton>
      ))}
    </List>
  );
};
