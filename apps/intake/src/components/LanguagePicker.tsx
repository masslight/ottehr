import LanguageIcon from '@mui/icons-material/Language';
import { Popover, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import mixpanel from 'mixpanel-browser';
import { FC, MouseEvent, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IntakeThemeContext } from '../contexts';
import { languages } from '../lib/i18n';

export const LanguagePicker: FC = () => {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const { otherColors } = useContext(IntakeThemeContext);

  useEffect(() => {
    // Not having a unique id uses the default $distinct_id prop
    mixpanel.identify();
  }, []);

  // Every time the language changes, update it in MixPanel
  useEffect(() => {
    mixpanel.people.set({
      Language: i18n.language,
    });
  }, [i18n.language]);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [anchorText, setAnchorText] = useState<string>(languages['en'].nativeName);
  const isPopupOpen = Boolean(anchorEl);
  const handlePopupOpen = (event: MouseEvent<HTMLElement>, language: string): void => {
    setAnchorText(languages[language].nativeName);
    setAnchorEl(event.currentTarget);
  };
  const handlePopupClose = (): void => {
    setAnchorEl(null);
  };
  console.log(theme);
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        mb: 1,
        pr: { xs: 1, md: 0 },
      }}
    >
      <LanguageIcon sx={{ color: theme.palette.primary.main, pr: 0.5 }} />
      <ToggleButtonGroup exclusive>
        {Object.keys(languages).map((lang) => (
          <ToggleButton
            aria-owns={isPopupOpen ? 'mouse-over-popup' : undefined}
            aria-haspopup="true"
            onMouseEnter={(event) => handlePopupOpen(event, lang)}
            onMouseLeave={handlePopupClose}
            value={lang}
            key={lang}
            onClick={() => i18n.changeLanguage(lang)}
            sx={{
              py: 0,
              px: 1,
              border: 'none',
              '&:not(:last-of-type)': {
                borderRight: `1px solid ${theme.palette.divider}`,
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.primary.main,
                fontWeight: i18n.language.split('-')[0] === lang ? 700 : 400,
                opacity: i18n.language.split('-')[0] === lang ? 1 : 0.7,
              }}
            >
              {lang}
            </Typography>
            {/* https://mui.com/material-ui/react-popover/#mouse-over-interaction */}
            <Popover
              id="mouse-over-popup"
              open={isPopupOpen}
              anchorEl={anchorEl}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
              onClose={handlePopupClose}
              disableRestoreFocus
              // To stop it adding a padding-right on the main element, shifting the background image
              disableScrollLock
              // Because 'none' doesn't work for some reason
              PaperProps={{ sx: { backgroundColor: otherColors.transparent } }}
              sx={{ mt: 1, pointerEvents: 'none' }}
            >
              <Typography
                sx={{
                  px: 1,
                  py: 0.5,
                  backgroundColor: otherColors.popupBackground,
                  color: theme.palette.background.paper,
                }}
              >
                {anchorText}
              </Typography>
            </Popover>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};
