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

const CATEGORIES = [
  "personnel", "software", "hardware", "vendor",
  "legal", "marketing", "training", "contingency", "other",
];

/** Create or edit one budget line on a project. */
export default function BudgetLineDialog({ open, projectId, line, onClose, onSaved }) {
  const isEdit = Boolean(line);
  const [form, setForm] = useState({
    category: "other",
    description: "",
    allocated_amount: "",
    spent_amount: 0,
    fiscal_year: new Date().getFullYear(),
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      category: line?.category ?? "other",
      description: line?.description ?? "",
      allocated_amount: line?.allocated_amount ?? "",
      spent_amount: line?.spent_amount ?? 0,
      fiscal_year: line?.fiscal_year ?? new Date().getFullYear(),
    });
  }, [open, line]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSave = async () => {
    if (Number(form.allocated_amount) < 0 || Number(form.spent_amount) < 0)
      return setError("Amounts cannot be negative");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        category: form.category,
        description: form.description || null,
        allocated_amount: Number(form.allocated_amount) || 0,
        spent_amount: Number(form.spent_amount) || 0,
        fiscal_year: Number(form.fiscal_year) || null,
      };
      if (isEdit) {
        await api.updateBudget(line.budget_id, payload);
      } else {
        await api.createBudget({ project_id: projectId, ...payload });
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
        <Typography variant="h2" component="div">{isEdit ? "Edit budget line" : "Add budget line"}</Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth size="small" label="Category" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="number" label="Fiscal year"
              value={form.fiscal_year} onChange={set("fiscal_year")}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="Description" value={form.description} onChange={set("description")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="number" label="Allocated amount (USD)"
              value={form.allocated_amount} onChange={set("allocated_amount")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth size="small" type="number" label="Spent amount (USD)"
              value={form.spent_amount} onChange={set("spent_amount")}
            />
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
