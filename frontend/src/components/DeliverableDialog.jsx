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
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api/client.js";
import { C } from "../services/theme.js";

const STATUSES = ["not_started", "in_progress", "finished", "cancelled"];

/** Create or edit a deliverable (milestone) on a project. */
export default function DeliverableDialog({
  open,
  projectId,
  deliverable,
  resources = [],
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(deliverable);
  const [form, setForm] = useState({
    name: "",
    description: "",
    sequence_no: "",
    status: "not_started",
    expected_date: "",
    completed_date: "",
    owner_id: "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: deliverable?.name ?? "",
      description: deliverable?.description ?? "",
      sequence_no: deliverable?.sequence_no ?? "",
      status: deliverable?.status ?? "not_started",
      expected_date: deliverable?.expected_date ?? "",
      completed_date: deliverable?.completed_date ?? "",
      owner_id: deliverable?.owner_id ?? "",
    });
  }, [open, deliverable]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) return setError("Name is required");
    if (form.status === "finished" && !form.completed_date)
      return setError("A finished deliverable needs a completed date");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        status: form.status,
        expected_date: form.expected_date || null,
        completed_date: form.status === "finished" ? form.completed_date : null,
        owner_id: form.owner_id === "" ? null : Number(form.owner_id),
        ...(form.sequence_no === "" ? {} : { sequence_no: Number(form.sequence_no) }),
      };
      if (isEdit) {
        await api.updateDeliverable(deliverable.deliverable_id, payload);
      } else {
        await api.createDeliverable({ project_id: projectId, ...payload });
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
        <Typography variant="h2" component="div">{isEdit ? "Edit deliverable" : "Add deliverable"}</Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Name" required value={form.name} onChange={set("name")} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth size="small" label="Description" multiline minRows={2}
              value={form.description} onChange={set("description")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth size="small" label="Status" value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s.replace("_", " ")}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="number" label="Sequence (optional)"
              value={form.sequence_no} onChange={set("sequence_no")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="date" label="Expected date"
              InputLabelProps={{ shrink: true }}
              value={form.expected_date || ""} onChange={set("expected_date")}
            />
          </Grid>
          {form.status === "finished" && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth size="small" type="date" label="Completed date"
                InputLabelProps={{ shrink: true }}
                value={form.completed_date || ""} onChange={set("completed_date")}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth size="small" label="Owner" value={form.owner_id} onChange={set("owner_id")}>
              <MenuItem value="" sx={{ fontSize: 13 }}>— none —</MenuItem>
              {resources.map((r) => (
                <MenuItem key={r.resource_id} value={r.resource_id} sx={{ fontSize: 13 }}>
                  {r.resource_name}
                </MenuItem>
              ))}
            </TextField>
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
