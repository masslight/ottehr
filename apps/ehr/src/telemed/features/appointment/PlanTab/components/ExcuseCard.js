"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcuseCard = void 0;
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var components_1 = require("../../../../components");
var ExcuseLink_1 = require("./ExcuseLink");
var ExcuseCard = function (props) {
    var label = props.label, excuse = props.excuse, isLoading = props.isLoading, onDelete = props.onDelete, onPublish = props.onPublish, generateTemplateOpen = props.generateTemplateOpen, generateFreeOpen = props.generateFreeOpen, disabled = props.disabled;
    var _a = (0, react_1.useState)(null), anchorEl = _a[0], setAnchorEl = _a[1];
    var handlePopoverOpen = function (event) {
        setAnchorEl(event.currentTarget);
    };
    var handlePopoverClose = function () {
        setAnchorEl(null);
    };
    var open = Boolean(anchorEl);
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <components_1.UppercaseCaptionTypography>{label}</components_1.UppercaseCaptionTypography>

      {excuse && (<>
          <ExcuseLink_1.ExcuseLink label={excuse.name} to={excuse.presignedUrl} onDelete={disabled ? undefined : function () { return onDelete(excuse.id); }} disabled={isLoading}/>
          <material_1.Typography>
            Generated: {luxon_1.DateTime.fromISO(excuse.date).toLocaleString(luxon_1.DateTime.DATETIME_SHORT, { locale: 'en-us' })}
          </material_1.Typography>
          <material_1.Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'end' }}>
            <material_1.Box onMouseEnter={handlePopoverOpen} onMouseLeave={handlePopoverClose} sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoOutlined_1.default color="primary"/>
            </material_1.Box>
            <RoundedButton_1.RoundedButton variant="contained" disabled={excuse.published || isLoading || disabled} onClick={function () { return onPublish(excuse.id); }}>
              {excuse.published ? 'Published' : 'Publish now'}
            </RoundedButton_1.RoundedButton>
          </material_1.Box>
          <material_1.Popover sx={{
                pointerEvents: 'none',
            }} open={open} anchorEl={anchorEl} anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
            }} transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }} onClose={handlePopoverClose} disableRestoreFocus>
            <material_1.Typography sx={{ p: 2, width: '300px' }}>
              Optional - you can publish note now or it will publish automatically after you review and sign visit note
            </material_1.Typography>
          </material_1.Popover>
        </>)}

      {!excuse && (<material_1.Box sx={{ display: 'flex', gap: 2 }}>
          <RoundedButton_1.RoundedButton onClick={function () { return generateTemplateOpen(true); }} disabled={isLoading || disabled}>
            Generate to the template
          </RoundedButton_1.RoundedButton>
          <RoundedButton_1.RoundedButton onClick={function () { return generateFreeOpen(true); }} disabled={isLoading || disabled}>
            Free format note
          </RoundedButton_1.RoundedButton>
        </material_1.Box>)}
    </material_1.Box>);
};
exports.ExcuseCard = ExcuseCard;
//# sourceMappingURL=ExcuseCard.js.map