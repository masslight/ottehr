"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitTypeSelect = VisitTypeSelect;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var types_1 = require("../../../types/types");
var tracking_board_store_1 = require("../../state/tracking-board/tracking-board.store");
function VisitTypeSelect() {
    var visitTypes = (0, utils_1.getSelectors)(tracking_board_store_1.useTrackingBoardStore, ['visitTypes']).visitTypes;
    var visitTypesOptions = Object.keys(types_1.VisitTypeToLabelTelemed).filter(function (key) { return key === types_1.VisitType.PreBook || key === types_1.VisitType.WalkIn; });
    return (<material_1.Autocomplete id="visitTypes" sx={{
            '.MuiButtonBase-root.MuiChip-root': {
                width: { xs: '100%', sm: '120px' },
                textAlign: 'start',
            },
        }} value={visitTypes != null ? visitTypes : visitTypesOptions} options={visitTypesOptions} getOptionLabel={function (option) {
            return types_1.VisitTypeToLabelTelemed[option];
        }} onChange={function (_, value) {
            tracking_board_store_1.useTrackingBoardStore.setState({ visitTypes: value });
        }} multiple renderInput={function (params) { return <material_1.TextField name="visitTypes" {...params} label="Visit type" required={false}/>; }}/>);
}
//# sourceMappingURL=VisitTypeSelect.js.map