import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import {
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
        <ListItemButton
          onClick={onCreateFolderClick}
          sx={{
            borderRadius: 3,
            py: 0.5,
            marginX: 2,
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
          }}
        >
          <ListItemIcon sx={{ color: theme.palette.primary.main }}>
            <CreateNewFolderOutlinedIcon />
          </ListItemIcon>
          <ListItemText
            primary={<Typography sx={{ color: theme.palette.primary.main, fontWeight: '500' }}>New Folder</Typography>}
          />
        </ListItemButton>
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
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              '& .folder-rename-button': { opacity: 1 },
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: folder.isCustom ? theme.palette.primary.dark : theme.palette.primary.main,
            }}
          >
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
          {folder.isCustom && canManageFolders && (
            <IconButton
              size="small"
              className="folder-rename-button"
              sx={{
                ml: 'auto',
                color: theme.palette.primary.main,
                opacity: 0,
                transition: 'opacity 0.15s ease-in-out',
                '&:focus-visible': { opacity: 1 },
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRenameFolderClick?.(folder);
              }}
            >
              <EditOutlinedIcon fontSize="medium" />
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
