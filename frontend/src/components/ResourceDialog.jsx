import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api/client.js";
import { C } from "../services/theme.js";
import { STANDARD_WEEKLY_HOURS } from "../services/format.js";

/** Create or edit an employee record. */
export default function ResourceDialog({ open, resource, onClose, onSaved }) {
  const isEdit = Boolean(resource);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_title: "",
    department: "",
    weekly_hours: STANDARD_WEEKLY_HOURS,
    hire_date: "",
    is_active: true,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      first_name: resource?.first_name ?? "",
      last_name: resource?.last_name ?? "",
      email: resource?.email ?? "",
      job_title: resource?.job_title ?? "",
      department: resource?.department ?? "",
      weekly_hours: resource?.weekly_hours ?? STANDARD_WEEKLY_HOURS,
      hire_date: resource?.hire_date ?? "",
      is_active: resource?.is_active ?? true,
    });
  }, [open, resource]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return setError("First and last name are required");
    if (!form.email.trim()) return setError("Email is required");
    if (!(Number(form.weekly_hours) > 0)) return setError("Weekly capacity must be greater than zero");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        job_title: form.job_title || null,
        department: form.department || null,
        weekly_hours: Number(form.weekly_hours),
        hire_date: form.hire_date || null,
        is_active: form.is_active,
      };
      if (isEdit) {
        await api.updateResource(resource.resource_id, payload);
      } else {
        await api.createResource(payload);
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
        <Typography variant="h2" component="div">{isEdit ? "Edit employee" : "New employee"}</Typography>
        <Typography variant="body2" color="text.secondary">
          Project work is charged at the standard rate of $100/hour.
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth size="small" label="First name" value={form.first_name} onChange={set("first_name")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth size="small" label="Last name" value={form.last_name} onChange={set("last_name")} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Email" value={form.email} onChange={set("email")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth size="small" label="Job title" value={form.job_title} onChange={set("job_title")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth size="small" label="Department" value={form.department} onChange={set("department")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="number" label="Weekly capacity (hours)"
              value={form.weekly_hours} onChange={set("weekly_hours")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="date" label="Hire date"
              InputLabelProps={{ shrink: true }}
              value={form.hire_date || ""} onChange={set("hire_date")}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                size="small" checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              <Typography variant="body2">Currently employed</Typography>
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
