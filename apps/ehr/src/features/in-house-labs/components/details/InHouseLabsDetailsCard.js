"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseLabsDetailsCard = void 0;
var KeyboardArrowDown_1 = require("@mui/icons-material/KeyboardArrowDown");
var KeyboardArrowUp_1 = require("@mui/icons-material/KeyboardArrowUp");
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var InHouseLabOrderHistory_1 = require("./InHouseLabOrderHistory");
var InHouseLabsNotesCard_1 = require("./InHouseLabsNotesCard");
var InHouseLabsDetailsCard = function (_a) {
    var testDetails = _a.testDetails, page = _a.page, showDetails = _a.showDetails, setShowDetails = _a.setShowDetails;
    var showNotesCardAbove = testDetails.notes && page === utils_1.PageName.collectSample;
    var showNotesCardBelowDetails = testDetails.notes && page !== utils_1.PageName.collectSample;
    var finalView = page === utils_1.PageName.final;
    var notesLabel = 'Provider notes';
    return (<>
      {showNotesCardAbove && (<InHouseLabsNotesCard_1.InHouseLabsNotesCard notes={testDetails.notes} notesLabel={notesLabel} readOnly={true} additionalBoxSxProps={{ my: 3 }}/>)}
      <material_1.Box display="flex" justifyContent={finalView ? 'space-between' : 'flex-end'} mt={2}>
        <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            cursor: 'pointer',
        }} onClick={function () { return setShowDetails(!showDetails); }}>
          <material_1.Typography sx={{
            fontWeight: 500,
            color: '#1A73E8',
            fontSize: '0.875rem',
            mr: 0.5,
        }}>
            Details
          </material_1.Typography>
          <material_1.IconButton size="small" sx={{ color: '#1A73E8', p: 0 }}>
            {showDetails ? <KeyboardArrowUp_1.default /> : <KeyboardArrowDown_1.default />}
          </material_1.IconButton>
        </material_1.Box>
      </material_1.Box>
      <material_1.Collapse in={showDetails}>
        {showNotesCardBelowDetails && (<InHouseLabsNotesCard_1.InHouseLabsNotesCard notes={testDetails.notes} notesLabel={notesLabel} readOnly={true} additionalBoxSxProps={{ my: 3 }}/>)}
        <InHouseLabOrderHistory_1.InHouseLabOrderHistory showDetails={showDetails} testDetails={testDetails}/>
      </material_1.Collapse>
    </>);
};
exports.InHouseLabsDetailsCard = InHouseLabsDetailsCard;
//# sourceMappingURL=InHouseLabsDetailsCard.js.map