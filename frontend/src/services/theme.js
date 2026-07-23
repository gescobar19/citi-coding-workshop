import { createTheme } from "@mui/material/styles";

export const C = {
  indigo: "#3B5299", indigoL: "#EBF0FA",
  teal: "#1F8A7D", tealL: "#E5F4F2",
  amber: "#B06A20", amberL: "#FAF0E5",
  purple: "#6B4FA0", purpleL: "#F0EBF8",
  red: "#A63040", redL: "#F8EBEC",
  green: "#1E7A54", greenL: "#E6F4EE",
  sidebar: "#1E2235", sidebarActive: "#262B40",
  sidebarText: "#7B839E", sidebarTextHover: "#C8CDD9",
  bg: "#ECEDF1", card: "#FFFFFF",
  fg: "#18202E", muted: "#5C6580", faint: "#9AA3BA",
  border: "rgba(24,32,46,0.11)",
  borderSoft: "rgba(24,32,46,0.07)",
  panel: "#F5F6F9",
};

export const PROJECT_COLORS = [C.indigo, C.teal, C.purple, C.amber, C.red];

export function getProjectColor(index) {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

export const mono = "'JetBrains Mono', ui-monospace, monospace";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: C.indigo, light: C.indigoL, contrastText: "#fff" },
    secondary: { main: C.teal, light: C.tealL, contrastText: "#fff" },
    error: { main: C.red, light: C.redL },
    warning: { main: C.amber, light: C.amberL },
    success: { main: C.green, light: C.greenL },
    background: { default: C.bg, paper: C.card },
    text: { primary: C.fg, secondary: C.muted, disabled: C.faint },
    divider: C.border,
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    h1: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h2: { fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontSize: "0.9375rem", fontWeight: 600 },
    h4: { fontSize: "0.875rem", fontWeight: 600 },
    body1: { fontSize: "0.875rem" },
    body2: { fontSize: "0.8125rem" },
    caption: { fontSize: "0.6875rem" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: "rgba(24,32,46,0.09)" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 8, background: "#fff" } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "rgba(24,32,46,0.06)", fontSize: "0.75rem" },
        head: {
          fontSize: "0.625rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: C.muted,
          background: C.panel,
          whiteSpace: "nowrap",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.6875rem" },
        sizeSmall: { height: 22 },
      },
    },
  },
});

export default theme;
