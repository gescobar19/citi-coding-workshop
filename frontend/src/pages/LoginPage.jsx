import { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Link as MuiLink,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ShieldIcon from "@mui/icons-material/Shield";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LockIcon from "@mui/icons-material/Lock";
import { useMediaQuery } from "react-responsive";
import { C } from "../services/theme.js";
import { api } from "../api/client.js";

const FEATURES = [
  { label: "Project and deliverable tracking", color: C.indigo },
  { label: "Resource allocation and cost visibility", color: C.teal },
  { label: "Budget breakdown by category", color: C.purple },
  { label: "Cross-project dependency chains", color: C.amber },
];

const ROLES = [
  { role: "admin", label: "Administrator", sub: "Full access", Icon: ShieldIcon, color: C.indigo },
  { role: "executive", label: "Executive", sub: "Read only", Icon: VisibilityIcon, color: C.teal },
];

export default function LoginPage({ onLogin }) {
  const [selected, setSelected] = useState(null);
  const [email, setEmail] = useState("j.whitmore@vantagebank.com");
  const [password, setPassword] = useState("demopassword");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isWide = useMediaQuery({ minWidth: 1024 });

  // Picking a role is a filter, not a grant — the account's own role decides
  // what the portal lets you do, so a mismatch is rejected here.
  const handleLogin = async () => {
    if (!selected || !email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const user = await api.login(email, password);
      if (user.role !== selected) {
        setError(
          `This is a${user.role === "admin" ? "n administrator" : "n executive"} account. ` +
            `Select "${user.role === "admin" ? "Administrator" : "Executive"}" to continue.`
        );
        return;
      }
      onLogin({ ...user, roleSelected: selected });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: C.bg }}>
      {isWide && (
        <Box
          sx={{
            width: 400,
            flexShrink: 0,
            bgcolor: C.sidebar,
            p: 5,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 7 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  bgcolor: C.indigo,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AccountBalanceIcon sx={{ fontSize: 18, color: "#fff" }} />
              </Box>
              <Typography sx={{ color: "#fff", fontWeight: 700 }}>Vantage Bank</Typography>
            </Stack>

            <Typography variant="h1" sx={{ color: "#fff", fontSize: "1.75rem", mb: 2, lineHeight: 1.3 }}>
              Project
              <br />
              Management Portal
            </Typography>
            <Typography sx={{ color: C.sidebarText, fontSize: 14, mb: 5, lineHeight: 1.6 }}>
              Track projects, manage resource allocation, monitor deliverables,
              and control budgets in one place.
            </Typography>

            <Stack spacing={1.5}>
              {FEATURES.map(({ label, color }) => (
                <Stack key={label} direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                  <Typography sx={{ color: "#A8B0C4", fontSize: 14 }}>{label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "#4A5270" }}>
            <LockIcon sx={{ fontSize: 13 }} />
            <Typography variant="caption">SOC 2 Type II · Employee access only</Typography>
          </Stack>
        </Box>
      )}

      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6 }}>
        <Box sx={{ width: "100%", maxWidth: 384 }}>
          <Typography variant="h1" sx={{ mb: 0.5 }}>Sign in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
            Access your workspace with your employee credentials.
          </Typography>

          <Stack spacing={2} sx={{ mb: 2.5 }}>
            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.75 }}>
                Email address
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.75 }}>
                Password
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </Box>
          </Stack>

          {error && (
            <Typography variant="caption" color="error" display="block" sx={{ mb: 1.5 }}>
              {error}
            </Typography>
          )}

          <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 1 }}>
            Access role
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
            {ROLES.map(({ role, label, sub, Icon, color }) => {
              const active = selected === role;
              return (
                <Paper
                  key={role}
                  variant="outlined"
                  onClick={() => {
                    setSelected(role);
                    setError(null);
                    // Prefill the demo account for the chosen role.
                    if (role === "admin") {
                      setEmail("admin@vantagebank.com");
                      setPassword("adminpass123");
                    } else {
                      setEmail("j.whitmore@vantagebank.com");
                      setPassword("demopassword");
                    }
                  }}
                  sx={{
                    flex: 1,
                    p: 2,
                    cursor: "pointer",
                    textAlign: "center",
                    borderWidth: 2,
                    borderColor: active ? C.indigo : "rgba(24,32,46,0.1)",
                    bgcolor: active ? C.indigoL : "#fff",
                    transition: "all .15s",
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 2,
                      mx: "auto",
                      mb: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: active ? color : C.bg,
                    }}
                  >
                    <Icon sx={{ fontSize: 18, color: active ? "#fff" : C.muted }} />
                  </Box>
                  <Typography variant="body2" fontWeight={600} sx={{ color: active ? C.indigo : C.muted }}>
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{sub}</Typography>
                </Paper>
              );
            })}
          </Stack>

          <Button
            fullWidth
            variant="contained"
            disabled={!selected || loading}
            onClick={handleLogin}
            sx={{ py: 1.25, bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" } }}
          >
            {loading ? "Signing in..." : "Sign in to portal"}
          </Button>

          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 2.5 }}>
            Issues? <MuiLink href="#" underline="hover">Contact IT Support</MuiLink>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
