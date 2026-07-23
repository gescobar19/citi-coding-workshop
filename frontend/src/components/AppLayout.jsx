import { useState } from "react";
import { Box, IconButton, Stack, Typography, Chip } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ShieldIcon from "@mui/icons-material/Shield";
import { useMediaQuery } from "react-responsive";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { C } from "../services/theme.js";
import { useAuth } from "../services/auth.jsx";

const TITLES = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/resources": "Resources",
  "/budget": "Budget",
  "/reports": "Reports",
  "/admin": "Administration",
};

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 900 });
  const { pathname } = useLocation();
  const { isAdmin, user } = useAuth();

  const title =
    Object.entries(TITLES).find(([p]) => pathname.startsWith(p))?.[1] || "Dashboard";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: C.bg }}>
      <Sidebar
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{
          position: "sticky", top: 0, zIndex: 10, height: 56,
          px: 3, display: "flex", alignItems: "center", justifyContent: "space-between",
          bgcolor: "rgba(236,237,241,0.9)", backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {isMobile && (
              <IconButton size="small" onClick={() => setMobileOpen(true)}>
                <MenuIcon fontSize="small" />
              </IconButton>
            )}
            <Typography variant="h4">{title}</Typography>
          </Stack>

          <Stack direction="row" spacing={1.25} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              {user?.email}
            </Typography>
            {isAdmin ? (
              <Chip
                size="small" icon={<ShieldIcon sx={{ fontSize: 13 }} />} label="Administrator"
                sx={{ bgcolor: C.indigoL, color: C.indigo }}
              />
            ) : (
              <Chip
                size="small" icon={<VisibilityIcon sx={{ fontSize: 13 }} />} label="Read only"
                sx={{ bgcolor: C.tealL, color: C.teal }}
              />
            )}
          </Stack>
        </Box>

        <Box sx={{ p: 3, maxWidth: 1400 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
