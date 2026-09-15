// Tema por defecto — debe coincidir con :root en src/index.css.
// Es el mismo para todas las empresas hasta que se personalice vía backend (tabla `tema`).
export const DEFAULT_COMPANY_COLOR = "#d94b8a";
export const DEFAULT_COMPANY_COLOR_SECONDARY = "#8f2e56";
export const DEFAULT_COMPANY_BG = "#fffdf9";
export const DEFAULT_COMPANY_BG_SOFT = "#fff6f7";
export const DEFAULT_COMPANY_TEXT = "#241923";
export const DEFAULT_COMPANY_TEXT_SOFT = "#6d5b68";
export const DEFAULT_COMPANY_BORDER = "#efd9e1";
export const DEFAULT_COMPANY_FONT_FAMILY = "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
export const DEFAULT_COMPANY_FONT_SIZE = "16px";

export interface CompanyThemeColors {
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  colorFondo?: string | null;
  colorFondoSuave?: string | null;
  colorTexto?: string | null;
  colorTextoSuave?: string | null;
  colorBorde?: string | null;
  fuenteFamilia?: string | null;
  fuenteTamanoBase?: string | null;
}

export function applyCompanyTheme(theme: CompanyThemeColors): void {
  const root = document.documentElement.style;
  root.setProperty("--brand-color", theme.colorPrimario || DEFAULT_COMPANY_COLOR);
  root.setProperty("--brand-color-dark", theme.colorSecundario || DEFAULT_COMPANY_COLOR_SECONDARY);
  root.setProperty("--bg", theme.colorFondo || DEFAULT_COMPANY_BG);
  root.setProperty("--bg-soft", theme.colorFondoSuave || DEFAULT_COMPANY_BG_SOFT);
  root.setProperty("--ink", theme.colorTexto || DEFAULT_COMPANY_TEXT);
  root.setProperty("--ink-soft", theme.colorTextoSuave || DEFAULT_COMPANY_TEXT_SOFT);
  root.setProperty("--line", theme.colorBorde || DEFAULT_COMPANY_BORDER);
  root.setProperty("--font-family", theme.fuenteFamilia || DEFAULT_COMPANY_FONT_FAMILY);
  root.setProperty("--font-size-base", theme.fuenteTamanoBase || DEFAULT_COMPANY_FONT_SIZE);
}
