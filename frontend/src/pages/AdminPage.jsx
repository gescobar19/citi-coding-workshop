import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ShieldIcon from "@mui/icons-material/Shield";
import VisibilityIcon from "@mui/icons-material/Visibility";
import GroupIcon from "@mui/icons-material/Group";
import { api } from "../api/client.js";
import { useUsers } from "../services/useApi.js";
import { useAuth } from "../services/auth.jsx";
import { C, mono } from "../services/theme.js";
import { fmtDate } from "../services/format.js";
import Avatar from "../components/Avatar";
import StatCard from "../components/StatCard";
import SearchField from "../components/SearchField";
import ConfirmDialog from "../components/ConfirmDialog";
import { Spinner } from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";

const HEADERS = ["User", "Role", "Status", "Created", "Actions"];
const ROLES = ["admin", "executive"];

function UserDialog({ open, user, onClose, onSaved }) {
  const isEdit = Boolean(user);
  const [form, setForm] = useState({ email: "", password: "", role: "executive", is_active: true });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Reset whenever the dialog is opened for a different user.
  const key = `${open}-${user?.user_id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setError(null);
    setForm({
      email: user?.email ?? "",
      password: "",
      role: user?.role ?? "executive",
      is_active: user?.is_active ?? true,
    });
  }

  const set = (key2) => (event) => setForm((prev) => ({ ...prev, [key2]: event.target.value }));

  const handleSave = async () => {
    if (!form.email.trim()) return setError("Email is required");
    if (!isEdit && !form.password.trim()) return setError("Password is required");

    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const payload = {
          email: form.email.trim(),
          role: form.role,
          is_active: form.is_active,
          ...(form.password.trim() ? { password: form.password } : {}),
        };
        await api.updateUser(user.user_id, payload);
      } else {
        await api.createUser({
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h2" component="div">{isEdit ? "Edit user" : "New user"}</Typography>
        <Typography variant="body2" color="text.secondary">
          Administrators can manage everything; executives get read-only access.
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Email" value={form.email} onChange={set("email")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="password"
              label={isEdit ? "New password (optional)" : "Password"}
              value={form.password} onChange={set("password")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth size="small" label="Role" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <MenuItem key={r} value={r} sx={{ fontSize: 13 }}>
                  {r === "admin" ? "Administrator" : "Executive (read only)"}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                size="small" checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              <Typography variant="body2">Account active</Typography>
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: "text.secondary" }}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" } }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const { data: users = [], loading, error, refetch } = useUsers();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("admin");
  const [dialog, setDialog] = useState({ open: false, user: null });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const admins = users.filter((u) => u.role === "admin");
  const executives = users.filter((u) => u.role === "executive");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (!q || u.email.toLowerCase().includes(q))
    );
  }, [users, search, roleFilter]);

  const handleDelete = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.deleteUser(confirm.user_id);
      setConfirm(null);
      refetch();
    } catch (err) {
      setActionError(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading administrators…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box>
          <Typography variant="h1">Administration</Typography>
          <Typography variant="body2" color="text.secondary">
            Portal accounts and their access level
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <SearchField value={search} onChange={setSearch} placeholder="Search by email…" width={200} />
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => setDialog({ open: true, user: null })}
            sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" }, whiteSpace: "nowrap" }}
          >
            New user
          </Button>
        </Stack>
      </Stack>

      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label="Administrators" value={admins.length} icon={<ShieldIcon sx={{ fontSize: 18 }} />} color={C.indigo} bg={C.indigoL} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label="Executives (read only)" value={executives.length} icon={<VisibilityIcon sx={{ fontSize: 18 }} />} color={C.teal} bg={C.tealL} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label="Total accounts" value={users.length} icon={<GroupIcon sx={{ fontSize: 18 }} />} color={C.purple} bg={C.purpleL} />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={0.75}>
        {[
          { key: "admin", label: `Administrators (${admins.length})` },
          { key: "executive", label: `Executives (${executives.length})` },
          { key: "all", label: `All (${users.length})` },
        ].map(({ key, label }) => (
          <Button
            key={key} size="small"
            variant={roleFilter === key ? "contained" : "outlined"}
            onClick={() => setRoleFilter(key)}
            sx={{
              fontSize: 12,
              ...(roleFilter === key
                ? { bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" } }
                : { color: "text.secondary", borderColor: "divider", bgcolor: "#fff" }),
            }}
          >
            {label}
          </Button>
        ))}
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" subtitle="Try a different search or filter." />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>{HEADERS.map((h) => <TableCell key={h}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((u) => {
                  const isSelf = u.user_id === currentUser?.user_id;
                  const isAdmin = u.role === "admin";
                  return (
                    <TableRow key={u.user_id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar
                            name={u.email.split("@")[0].replace(/[._]/g, " ")}
                            color={isAdmin ? C.indigo : C.teal}
                            size={30} tooltip={false}
                          />
                          <Box>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Typography variant="body2" fontWeight={600}>{u.email}</Typography>
                              {isSelf && <Chip size="small" label="You" sx={{ bgcolor: C.panel, color: C.muted }} />}
                            </Stack>
                            <Typography sx={{ fontFamily: mono, fontSize: 10, color: "text.secondary" }}>
                              USR-{String(u.user_id).padStart(3, "0")}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={isAdmin
                            ? <ShieldIcon sx={{ fontSize: 13, color: `${C.indigo} !important` }} />
                            : <VisibilityIcon sx={{ fontSize: 13, color: `${C.teal} !important` }} />}
                          label={isAdmin ? "Administrator" : "Executive · read only"}
                          sx={{ bgcolor: isAdmin ? C.indigoL : C.tealL, color: isAdmin ? C.indigo : C.teal }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small" label={u.is_active ? "Active" : "Inactive"}
                          sx={{
                            bgcolor: u.is_active ? C.greenL : C.panel,
                            color: u.is_active ? C.green : C.muted,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: mono, color: "text.secondary" }}>
                        {fmtDate(u.created_at)}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit user">
                            <IconButton size="small" onClick={() => setDialog({ open: true, user: u })}>
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={isSelf ? "You cannot delete your own account" : "Delete user"}>
                            <span>
                              <IconButton
                                size="small" disabled={isSelf}
                                onClick={() => setConfirm(u)}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 16, color: isSelf ? undefined : C.red }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <UserDialog
        open={dialog.open}
        user={dialog.user}
        onClose={() => setDialog({ open: false, user: null })}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete user"
        message={`Delete ${confirm?.email}? They will lose access to the portal immediately.`}
        busy={busy}
        onConfirm={handleDelete}
        onClose={() => setConfirm(null)}
      />
    </Stack>
  );
}
