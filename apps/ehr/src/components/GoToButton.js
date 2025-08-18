"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GoToButton;
var material_1 = require("@mui/material");
function GoToButton(props) {
    var theme = (0, material_1.useTheme)();
    if (props.loading) {
        return (<material_1.Box sx={{ width: '80px', height: '70px' }} display={'flex'} alignItems={'center'} justifyContent={'space-evenly'}>
        <material_1.CircularProgress sx={{ color: theme.palette.primary.main }} size={24}/>
      </material_1.Box>);
    }
    return (<material_1.IconButton data-testid={props.dataTestId} sx={{
            backgroundColor: '#FFF',
            width: '80px',
            height: '70px',
            borderRadius: '8px',
            padding: '4px',
            display: 'flex',
            justifyContent: 'space-evenly',
            flexDirection: 'column',
            alignItems: 'center',
            '&:hover': {
                backgroundColor: '#EEF3FF',
            },
            fontSize: '14px',
            color: '#5F6166',
            '& .MuiSvgIcon-root': {
                '&:first-of-type': {
                    color: theme.palette.primary.main,
                    height: '16px',
                    width: '16px',
                },
            },
        }} onClick={props.onClick}>
      {props.children}
      {props.text}
    </material_1.IconButton>);
}
//# sourceMappingURL=GoToButton.js.map