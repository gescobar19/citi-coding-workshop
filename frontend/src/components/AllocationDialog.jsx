import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api/client.js";
import { C, mono } from "../services/theme.js";
import { FULL_TIME_WEEKLY_COST, LABOR_RATE, fmtMoney, laborCost } from "../services/format.js";

/** Assign an employee to a project, or change an existing assignment. */
export default function AllocationDialog({
  open,
  projectId,
  allocation,
  resources = [],
  assignedIds = [],
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(allocation);
  const [form, setForm] = useState({ resource_id: "", role: "", allocated_hours: 40, start_date: "", end_date: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      resource_id: allocation?.resource_id ?? "",
      role: allocation?.role ?? "",
      allocated_hours: allocation?.allocated_hours ?? 40,
      start_date: allocation?.start_date ?? "",
      end_date: allocation?.end_date ?? "",
    });
  }, [open, allocation]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const available = resources.filter(
    (r) => r.resource_id === form.resource_id || !assignedIds.includes(r.resource_id)
  );

  const handleSave = async () => {
    const hours = Number(form.allocated_hours);
    if (!isEdit && !form.resource_id) return setError("Pick an employee");
    if (!(hours > 0 && hours <= 40)) return setError("Weekly hours must be between 1 and 40");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        role: form.role || null,
        allocated_hours: hours,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (isEdit) {
        await api.updateAllocation(allocation.allocation_id, payload);
      } else {
        await api.createAllocation({
          project_id: projectId,
          resource_id: Number(form.resource_id),
          ...payload,
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
        <Typography variant="h2" component="div">{isEdit ? "Edit assignment" : "Assign employee"}</Typography>
        <Typography variant="body2" color="text.secondary">
          Charged at {fmtMoney(LABOR_RATE)}/hour — a full 40-hour week costs{" "}
          {fmtMoney(FULL_TIME_WEEKLY_COST)}.
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              select fullWidth size="small" label="Employee" disabled={isEdit}
              value={form.resource_id} onChange={set("resource_id")}
            >
              {available.map((r) => (
                <MenuItem key={r.resource_id} value={r.resource_id} sx={{ fontSize: 13 }}>
                  {r.resource_name} — {r.job_title || "—"}
                  {r.is_over_allocated ? " (over-allocated)" : ""}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth size="small" label="Role on project" value={form.role} onChange={set("role")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="number" label="Hours per week"
              inputProps={{ min: 1, max: 40 }}
              value={form.allocated_hours} onChange={set("allocated_hours")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="date" label="Start date"
              InputLabelProps={{ shrink: true }}
              value={form.start_date || ""} onChange={set("start_date")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="date" label="End date"
              InputLabelProps={{ shrink: true }}
              value={form.end_date || ""} onChange={set("end_date")}
            />
          </Grid>
        </Grid>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 2, p: 1.5, bgcolor: C.panel, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">Weekly cost</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ fontFamily: mono }}>
            {fmtMoney(laborCost(form.allocated_hours))}
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: "text.secondary" }}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" } }}
        >
          {saving ? "Saving…" : isEdit ? "Save" : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
