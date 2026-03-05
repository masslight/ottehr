import z from 'zod';

const colorString = z.string().min(1, { message: 'Color value cannot be empty' });

/**
 * EmailPaletteSchema - Color palette for branded emails
 */
export const EmailPaletteSchema = z.object({
  deemphasizedText: z.string().min(1, { message: 'Deemphasized text color cannot be empty' }),
  headerText: z.string().min(1, { message: 'Header text color cannot be empty' }),
  bodyText: z.string().min(1, { message: 'Body text color cannot be empty' }),
  footerText: z.string().min(1, { message: 'Footer text color cannot be empty' }),
  buttonColor: z.string().min(1, { message: 'Button color cannot be empty' }),
});

export type EmailPalette = z.infer<typeof EmailPaletteSchema>;

/**
 * EmailConfigSchema - Email branding configuration
 */
export const EmailConfigSchema = z.object({
  logoURL: z.string().optional(),
  sender: z.string().email(),
  replyTo: z.string().email().optional(),
  palette: EmailPaletteSchema,
});

export type EmailConfig = z.infer<typeof EmailConfigSchema>;

/**
 * LogoConfigSchema - Logo URLs for different contexts
 */
export const LogoConfigSchema = z.object({
  default: z.string().optional(),
  email: z.string().optional(),
  pdf: z.string().optional(),
});

export type LogoConfig = z.infer<typeof LogoConfigSchema>;

export const IntakeAssetsSchema = z
  .object({
    logo: z.string().optional(),
    primaryIcon: z.string().optional(),
    secondaryIcon: z.string().optional(),
    aiIcon: z.string().optional(),
  })
  .partial();

export type IntakeAssets = z.infer<typeof IntakeAssetsSchema>;

export const IntakeThemeOtherColorsSchema = z.record(colorString);

export type IntakeThemeOtherColors = z.infer<typeof IntakeThemeOtherColorsSchema>;

const IntakePaletteColorSchema = z
  .object({
    main: colorString,
    light: colorString,
    dark: colorString,
    contrast: colorString,
    contrastText: colorString,
  })
  .partial();

const IntakePaletteTextSchema = z
  .object({
    primary: colorString,
    secondary: colorString,
    disabled: colorString,
    cancelled: colorString,
  })
  .partial();

const IntakePaletteActionSchema = z
  .object({
    active: colorString,
    hover: colorString,
    selected: colorString,
    disabled: colorString,
    disabledBackground: colorString,
    focus: colorString,
  })
  .partial();

const IntakePaletteBackgroundSchema = z
  .object({
    default: colorString,
    paper: colorString,
    cancelled: colorString,
  })
  .partial();

export const IntakeThemePaletteSchema = z
  .object({
    text: IntakePaletteTextSchema,
    primary: IntakePaletteColorSchema,
    secondary: IntakePaletteColorSchema,
    tertiary: IntakePaletteColorSchema,
    step: IntakePaletteColorSchema,
    info: IntakePaletteColorSchema,
    success: IntakePaletteColorSchema,
    warning: IntakePaletteColorSchema,
    error: IntakePaletteColorSchema,
    destructive: IntakePaletteColorSchema,
    action: IntakePaletteActionSchema,
    background: IntakePaletteBackgroundSchema,
    divider: colorString,
  })
  .partial();

export type IntakeThemePalette = z.infer<typeof IntakeThemePaletteSchema>;

export const IntakeThemeSchema = z
  .object({
    palette: IntakeThemePaletteSchema,
    otherColors: IntakeThemeOtherColorsSchema,
  })
  .partial();

export type IntakeTheme = z.infer<typeof IntakeThemeSchema>;

/**
 * IntakeBrandingSchema - Intake-specific branding options
 */
export const IntakeBrandingSchema = z.object({
  appBar: z.object({
    backgroundColor: z.string().min(1, { message: 'AppBar background color cannot be empty' }),
    logoHeight: z.string().min(1, { message: 'AppBar logo height cannot be empty' }),
    logoutButtonTextColor: z.string().min(1, { message: 'AppBar logout button color cannot be empty' }),
  }),
  assets: IntakeAssetsSchema.optional(),
  theme: IntakeThemeSchema.optional(),
});

export type IntakeBranding = z.infer<typeof IntakeBrandingSchema>;

/**
 * BrandingConfig - Global branding configuration
 * Defines project name, logos, email styling, and app-specific branding
 */
export const BrandingConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name cannot be empty' }),
  projectDomain: z.string().min(1, { message: 'Project domain cannot be empty' }),
  primaryIconAlt: z.string().min(1, { message: 'Primary icon alt text cannot be empty' }),
  email: EmailConfigSchema,
  logo: LogoConfigSchema,
  intake: IntakeBrandingSchema,
});

export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
