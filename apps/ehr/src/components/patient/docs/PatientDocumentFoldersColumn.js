"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientDocumentFoldersColumnSkeleton = exports.PatientDocumentFoldersColumn = void 0;
var FolderOpenOutlined_1 = require("@mui/icons-material/FolderOpenOutlined");
var FolderOutlined_1 = require("@mui/icons-material/FolderOutlined");
var material_1 = require("@mui/material");
var PatientDocumentFoldersColumn = function (props) {
    var documentsFolders = props.documentsFolders, selectedFolder = props.selectedFolder, onFolderSelected = props.onFolderSelected;
    var theme = (0, material_1.useTheme)();
    var selectedIndex = documentsFolders.findIndex(function (folder) { return folder.id === (selectedFolder === null || selectedFolder === void 0 ? void 0 : selectedFolder.id) || folder.folderName === (selectedFolder === null || selectedFolder === void 0 ? void 0 : selectedFolder.folderName); });
    // const lineColor = historyEntry.isTemperatureWarning ? theme.palette.error.main : theme.palette.text.primary;
    return (<material_1.List>
      {documentsFolders
            .sort(function (a, b) { return a.folderName.localeCompare(b.folderName); })
            .map(function (folder, index) { return (<material_1.ListItemButton key={"".concat(folder.folderName, "__").concat(index)} onClick={function () { return onFolderSelected && onFolderSelected(folder); }} sx={{
                backgroundColor: selectedIndex === index ? '#4D15B714' : 'transparent',
                borderRadius: 3,
                py: 0.5,
                marginX: 2,
                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            }}>
            <material_1.ListItemIcon sx={{ color: theme.palette.primary.main }}>
              {selectedIndex === index ? <FolderOpenOutlined_1.default /> : <FolderOutlined_1.default />}
            </material_1.ListItemIcon>
            <material_1.ListItemText primary={<material_1.Typography sx={{
                    color: theme.palette.text.primary,
                    fontWeight: selectedIndex === index ? 'bold' : 'normal',
                }}>
                  {folder.folderName} - {folder.documentsCount}
                </material_1.Typography>}/>
          </material_1.ListItemButton>); })}
    </material_1.List>);
};
exports.PatientDocumentFoldersColumn = PatientDocumentFoldersColumn;
var PatientDocumentFoldersColumnSkeleton = function (_a) {
    var stubsCount = _a.stubsCount;
    var fakeFolders = new Array(stubsCount).fill('Stub folder');
    return (<material_1.List>
      {fakeFolders.map(function (folderName, index) { return (<material_1.Skeleton key={"".concat(folderName, "__").concat(index)}>
          <material_1.ListItemButton sx={{
                borderRadius: 3,
                py: 0.5,
                marginX: 2,
                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            }}>
            <material_1.ListItemIcon>
              <FolderOpenOutlined_1.default />
            </material_1.ListItemIcon>
            <material_1.ListItemText primary={<material_1.Typography>{folderName} - 10</material_1.Typography>}/>
          </material_1.ListItemButton>
        </material_1.Skeleton>); })}
    </material_1.List>);
};
exports.PatientDocumentFoldersColumnSkeleton = PatientDocumentFoldersColumnSkeleton;
//# sourceMappingURL=PatientDocumentFoldersColumn.js.map