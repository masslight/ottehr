import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Typography,
  useTheme,
} from '@mui/material';
import { FC } from 'react';
import { PatientDocumentsFolder } from 'src/hooks/useGetPatientDocs';

export type PatientDocumentFoldersColumnProps = {
  documentsFolders: PatientDocumentsFolder[];
  selectedFolder?: PatientDocumentsFolder;
  onFolderSelected?: (selectedFolder: PatientDocumentsFolder) => void;
  canManageFolders?: boolean;
  onCreateFolderClick?: () => void;
  onRenameFolderClick?: (folder: PatientDocumentsFolder) => void;
};

export const PatientDocumentFoldersColumn: FC<PatientDocumentFoldersColumnProps> = (props) => {
  const {
    documentsFolders,
    selectedFolder,
    onFolderSelected,
    canManageFolders = false,
    onCreateFolderClick,
    onRenameFolderClick,
  } = props;

  const theme = useTheme();

  const selectedIndex = documentsFolders
    .slice()
    .sort((a, b) => a.folderName.localeCompare(b.folderName))
    .findIndex((folder) => folder.id === selectedFolder?.id || folder.folderName === selectedFolder?.folderName);

  const sortedFolders = documentsFolders.slice().sort((a, b) => a.folderName.localeCompare(b.folderName));

  return (
    <List>
      {canManageFolders && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Button
            startIcon={<AddIcon />}
            size="small"
            variant="text"
            onClick={onCreateFolderClick}
            sx={{ textTransform: 'none' }}
          >
            New Folder
          </Button>
        </Box>
      )}

      {sortedFolders.map((folder, index) => (
        <ListItemButton
          key={`${folder.folderName}__${index}`}
          onClick={() => onFolderSelected && onFolderSelected(folder)}
          sx={{
            backgroundColor: selectedIndex === index ? '#4D15B714' : 'transparent',
            borderRadius: 3,
            py: 0.5,
            marginX: 2,
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&:hover .rename-btn': { visibility: 'visible' },
          }}
        >
          <ListItemIcon
            sx={{
              color: folder.isCustom ? theme.palette.primary.dark : theme.palette.primary.main,
            }}
          >
            {folder.isCustom ? (
              <FolderIcon />
            ) : selectedIndex === index ? (
              <FolderOpenOutlinedIcon />
            ) : (
              <FolderOutlinedIcon />
            )}
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
          {folder.isCustom && canManageFolders && (
            <IconButton
              className="rename-btn"
              size="small"
              sx={{ visibility: 'hidden', ml: 'auto' }}
              onClick={(e) => {
                e.stopPropagation();
                onRenameFolderClick?.(folder);
              }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          )}
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
