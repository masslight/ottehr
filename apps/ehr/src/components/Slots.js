"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Slots = Slots;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var data_test_ids_1 = require("../constants/data-test-ids");
function Slots(_a) {
    var slots = _a.slots, timezone = _a.timezone, selectedSlot = _a.selectedSlot, setSelectedSlot = _a.setSelectedSlot;
    var theme = (0, material_1.useTheme)();
    if (slots.length === 0) {
        return (<material_1.Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
        There are no slots available, please walk-in.
      </material_1.Typography>);
    }
    return (<material_1.Grid container spacing={1} justifyContent={'center'} mt={1}>
      {slots.map(function (slot, idx) {
            var startDate = luxon_1.DateTime.fromISO(slot.start);
            var startDateTimezoneAdjusted = startDate.setZone(timezone);
            var isSelected = selectedSlot === slot;
            return (<material_1.Grid key={idx} item>
            <material_1.Button sx={{
                    width: '110px',
                    borderColor: theme.palette.divider,
                    fontWeight: isSelected ? 700 : 400,
                }} variant={isSelected ? 'contained' : 'outlined'} color="primary" onClick={function () { return setSelectedSlot(slot); }} data-testid={data_test_ids_1.dataTestIds.slots.slot}>
              {startDateTimezoneAdjusted.toFormat('h:mm a')}
            </material_1.Button>
          </material_1.Grid>);
        })}
    </material_1.Grid>);
}
//# sourceMappingURL=Slots.js.map