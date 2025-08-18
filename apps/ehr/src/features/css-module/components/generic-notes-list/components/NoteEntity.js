"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteEntity = void 0;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var DeleteNoteModal_1 = require("./DeleteNoteModal");
var EditNoteModal_1 = require("./EditNoteModal");
var BoxStyled_1 = require("./ui/BoxStyled");
var NoteEntity = function (_a) {
    var entity = _a.entity, onEdit = _a.onEdit, onDelete = _a.onDelete, locales = _a.locales;
    var theme = (0, material_1.useTheme)();
    var _b = (0, react_1.useState)(false), isDeleteModalOpen = _b[0], setIsDeleteModalOpen = _b[1];
    var _c = (0, react_1.useState)(false), isEditModalOpen = _c[0], setIsEditModalOpen = _c[1];
    var handleDeleteClick = function () {
        setIsDeleteModalOpen(true);
    };
    var handleCloseDeleteModal = function () {
        setIsDeleteModalOpen(false);
    };
    var openEditModal = function () { return setIsEditModalOpen(true); };
    var closeEditModal = function () { return setIsEditModalOpen(false); };
    return (<>
      <BoxStyled_1.BoxStyled>
        <material_1.Box sx={{ py: 1, pr: 4 }}>
          <material_1.Typography variant="body1">{entity.text}</material_1.Typography>
          <material_1.Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
            {entity.lastUpdated ? luxon_1.DateTime.fromISO(entity.lastUpdated).toFormat('MM/dd/yyyy HH:mm a') : ''} by{' '}
            {entity.authorName || entity.authorId}
          </material_1.Typography>
        </material_1.Box>
        <material_1.Box sx={{ minWidth: '72px', py: 1 }}>
          <material_1.IconButton size="small" aria-label="edit" sx={{ color: theme.palette.primary.dark }} onClick={openEditModal}>
            <icons_material_1.EditOutlined fontSize="small"/>
          </material_1.IconButton>
          <material_1.IconButton size="small" aria-label="delete" sx={{ color: theme.palette.warning.dark }} onClick={handleDeleteClick}>
            <icons_material_1.DeleteOutlined fontSize="small"/>
          </material_1.IconButton>
        </material_1.Box>
      </BoxStyled_1.BoxStyled>

      <DeleteNoteModal_1.DeleteNoteModal open={isDeleteModalOpen} onClose={handleCloseDeleteModal} entity={entity} onDelete={onDelete} locales={locales}/>

      <EditNoteModal_1.EditNoteModal open={isEditModalOpen} onClose={closeEditModal} entity={entity} onEdit={onEdit} locales={locales}/>
    </>);
};
exports.NoteEntity = NoteEntity;
//# sourceMappingURL=NoteEntity.js.map