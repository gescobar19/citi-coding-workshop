import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  Avatar as MuiAvatar,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import TimelineIcon from "@mui/icons-material/Timeline";
import PeopleIcon from "@mui/icons-material/People";
import PaidIcon from "@mui/icons-material/Paid";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useLocation, useNavigate } from "react-router-dom";
import { C } from "../services/theme.js";
import { useAuth } from "../services/auth.jsx";
import { initialsOf } from "./Avatar";

export const SIDEBAR_WIDTH = 224;

const LINKS = [
  { to: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { to: "/projects", label: "Projects", Icon: TimelineIcon },
  { to: "/resources", label: "Resources", Icon: PeopleIcon },
  { to: "/budget", label: "Budget", Icon: PaidIcon },
];

const ADMIN_LINKS = [{ to: "/admin", label: "Administration", Icon: AdminPanelSettingsIcon }];

export default function Sidebar({ mobileOpen, onMobileClose, isMobile }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin, displayName, roleLabel, onLogout } = useAuth();

  const renderLink = ({ to, label, Icon }) => {
    const active = pathname.startsWith(to);
    return (
      <ListItemButton
        key={to}
        onClick={() => {
          navigate(to);
          onMobileClose?.();
        }}
        sx={{
          borderRadius: 2,
          mb: 0.25,
          py: 1,
          bgcolor: active ? C.sidebarActive : "transparent",
          "&:hover": { bgcolor: active ? C.sidebarActive : "rgba(255,255,255,0.04)" },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Icon sx={{ fontSize: 18, color: active ? "#5B7BE8" : C.sidebarText }} />
        </ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: active ? "#fff" : C.sidebarText }}
        />
        {active && <Box sx={{ width: 3, height: 16, borderRadius: 2, bgcolor: "#5B7BE8" }} />}
      </ListItemButton>
    );
  };

  // minHeight rather than height so the panel fills its container when there is
  // room and grows with the nav when there is not — a fixed height would paint
  // only one viewport-worth of background and let a scrolled nav run past it.
  const content = (
    <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column", bgcolor: C.sidebar }}>
      <Box sx={{ px: 2, py: 2.5, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: 2, bgcolor: C.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AccountBalanceIcon sx={{ fontSize: 16, color: "#fff" }} />
          </Box>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>ACME Inc.</Typography>
        </Stack>

        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, borderRadius: 2, bgcolor: "rgba(255,255,255,0.05)" }}>
          <MuiAvatar sx={{ width: 32, height: 32, bgcolor: C.indigo, fontSize: 11, fontWeight: 700 }}>
            {initialsOf(displayName)}
          </MuiAvatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }} noWrap>
              {displayName}
            </Typography>
            <Typography sx={{ color: C.sidebarText, fontSize: 10 }}>{roleLabel}</Typography>
          </Box>
        </Stack>
      </Box>

      <List sx={{ flex: 1, px: 1.5, py: 1.5 }}>
        <Typography sx={{ fontSize: 9, fontWeight: 700, color: "#4A5270", textTransform: "uppercase", letterSpacing: "0.12em", px: 1, mb: 1 }}>
          Workspace
        </Typography>

        {LINKS.map(renderLink)}

        {isAdmin && (
          <>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: "#4A5270", textTransform: "uppercase", letterSpacing: "0.12em", px: 1, mt: 2, mb: 1 }}>
              Admin
            </Typography>
            {ADMIN_LINKS.map(renderLink)}
          </>
        )}
      </List>

      <Box sx={{ px: 1.5, py: 1.5, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <ListItemButton onClick={onLogout} sx={{ borderRadius: 2, py: 1 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <LogoutIcon sx={{ fontSize: 18, color: C.sidebarText }} />
          </ListItemIcon>
          <ListItemText primary="Sign out" primaryTypographyProps={{ fontSize: 13, color: C.sidebarText }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        // Paint the paper itself, not just the panel inside it. Without a
        // background here the drawer falls back to MUI's white paper, which shows
        // through as soon as the nav is tall enough to scroll.
        sx={{
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            border: 0,
            bgcolor: C.sidebar,
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  // The panel is fixed to the viewport rather than stretched inside the flex row.
  // Anchoring top:0 and bottom:0 makes it exactly window-height at all times, so
  // the dark fill can never come up short — page length, page scroll and window
  // size stop mattering. The outer aside is just a spacer holding the column open
  // so the main content does not slide underneath.
  return (
    <Box component="aside" sx={{ width: SIDEBAR_WIDTH, flexShrink: 0 }}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          bgcolor: C.sidebar,
          overflowY: "auto",
          zIndex: 20,
        }}
      >
        {content}
      </Box>
    </Box>
  );
}
