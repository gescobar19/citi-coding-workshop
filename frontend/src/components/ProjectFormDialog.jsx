import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../api/client.js";
import { C, mono } from "../services/theme.js";
import {
  FULL_TIME_WEEKLY_COST,
  LABOR_RATE,
  STANDARD_WEEKLY_HOURS,
  fmtMoney,
  laborCost,
  weeksBetween,
} from "../services/format.js";
import Avatar from "./Avatar";
import SearchField from "./SearchField";

const STATUSES = ["not_started", "in_progress", "finished", "cancelled"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const CATEGORIES = [
  "personnel", "software", "hardware", "vendor",
  "legal", "marketing", "training", "contingency", "other",
];

const EMPTY = {
  name: "",
  description: "",
  objective: "",
  status: "not_started",
  priority: "medium",
  start_date: "",
  expected_end_date: "",
  actual_end_date: "",
  sponsor_id: "",
  lead_id: "",
};

const STEPS = ["Project details", "Assign employees", "Assign budget"];

const nullable = (value) => (value === "" || value === undefined ? null : value);

export default function ProjectFormDialog({ open, project, resources = [], onClose, onSaved }) {
  const isEdit = Boolean(project);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [team, setTeam] = useState([]);
  const [lines, setLines] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    setSearch("");
    setTeam([]);
    setLines([]);
    setForm(
      project
        ? {
            ...EMPTY,
            ...Object.fromEntries(
              Object.keys(EMPTY).map((key) => [key, project[key] ?? EMPTY[key]])
            ),
          }
        : EMPTY
    );
  }, [open, project]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const weeks = weeksBetween(form.start_date, form.expected_end_date);
  const weeklyHours = team.reduce((sum, m) => sum + Number(m.allocated_hours || 0), 0);
  const weeklyLabor = laborCost(weeklyHours);
  const projectedLabor = laborCost(weeklyHours, weeks);
  const budgetTotal = lines.reduce((sum, l) => sum + (Number(l.allocated_amount) || 0), 0);

  const filteredResources = useMemo(() => {
    const q = search.toLowerCase();
    return resources.filter(
      (r) =>
        !q ||
        (r.resource_name || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.job_title || "").toLowerCase().includes(q)
    );
  }, [resources, search]);

  const toggleResource = (resource) =>
    setTeam((prev) =>
      prev.some((m) => m.resource_id === resource.resource_id)
        ? prev.filter((m) => m.resource_id !== resource.resource_id)
        : [
            ...prev,
            {
              resource_id: resource.resource_id,
              resource_name: resource.resource_name,
              role: resource.job_title || "",
              allocated_hours: STANDARD_WEEKLY_HOURS,
            },
          ]
    );

  const setHours = (resourceId, value) =>
    setTeam((prev) =>
      prev.map((m) => (m.resource_id === resourceId ? { ...m, allocated_hours: value } : m))
    );

  const setRole = (resourceId, value) =>
    setTeam((prev) =>
      prev.map((m) => (m.resource_id === resourceId ? { ...m, role: value } : m))
    );

  const addLine = (preset = {}) =>
    setLines((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${prev.length}`,
        category: "other",
        description: "",
        allocated_amount: "",
        spent_amount: 0,
        fiscal_year: new Date().getFullYear(),
        ...preset,
      },
    ]);

  const setLine = (key, field, value) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  const validate = () => {
    if (!form.name.trim()) return "Project name is required";
    if (form.start_date && form.expected_end_date && form.expected_end_date < form.start_date)
      return "Expected end date cannot be before the start date";
    if (form.status === "finished" && !form.actual_end_date)
      return "A finished project needs an actual end date";
    const badHours = team.find(
      (m) => !(Number(m.allocated_hours) > 0 && Number(m.allocated_hours) <= 40)
    );
    if (badHours) return `Weekly hours for ${badHours.resource_name} must be between 1 and 40`;
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      description: nullable(form.description),
      objective: nullable(form.objective),
      status: form.status,
      priority: form.priority,
      start_date: nullable(form.start_date),
      expected_end_date: nullable(form.expected_end_date),
      actual_end_date: nullable(form.actual_end_date),
      sponsor_id: nullable(form.sponsor_id),
      lead_id: nullable(form.lead_id),
    };

    try {
      if (isEdit) {
        await api.updateProject(project.project_id, payload);
      } else {
        const created = await api.createProject(payload);
        const projectId = created.project_id;

        for (const member of team) {
          await api.createAllocation({
            project_id: projectId,
            resource_id: member.resource_id,
            role: nullable(member.role),
            allocated_hours: Number(member.allocated_hours),
            start_date: nullable(form.start_date),
            end_date: nullable(form.expected_end_date),
          });
        }

        for (const line of lines) {
          if (!Number(line.allocated_amount)) continue;
          await api.createBudget({
            project_id: projectId,
            category: line.category,
            description: nullable(line.description),
            allocated_amount: Number(line.allocated_amount),
            spent_amount: Number(line.spent_amount) || 0,
            fiscal_year: Number(line.fiscal_year) || null,
          });
        }
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const people = resources;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h2" component="div">{isEdit ? "Edit project" : "New project"}</Typography>
        <Typography variant="body2" color="text.secondary">
          {isEdit
            ? "Update the project record. Manage its team and budget from the project page."
            : "Create the project, staff it, and set its budget in one go."}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {!isEdit && (
          <Stepper activeStep={step} sx={{ mb: 3 }}>
            {STEPS.map((label, index) => (
              <Step key={label} completed={step > index}>
                <StepLabel
                  onClick={() => setStep(index)}
                  sx={{ cursor: "pointer", "& .MuiStepLabel-label": { fontSize: 13 } }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {(isEdit || step === 0) && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth size="small" label="Project name" required
                value={form.name} onChange={set("name")}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth size="small" label="Description" multiline minRows={2}
                value={form.description} onChange={set("description")}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth size="small" label="Objective" multiline minRows={2}
                value={form.objective} onChange={set("objective")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth size="small" label="Status" value={form.status} onChange={set("status")}>
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>
                    {s.replace("_", " ")}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth size="small" label="Priority" value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p} sx={{ fontSize: 13 }}>{p}</MenuItem>
                ))}
              </TextField>
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
                fullWidth size="small" type="date" label="Expected end date"
                InputLabelProps={{ shrink: true }}
                value={form.expected_end_date || ""} onChange={set("expected_end_date")}
              />
            </Grid>
            {form.status === "finished" && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth size="small" type="date" label="Actual end date"
                  InputLabelProps={{ shrink: true }}
                  value={form.actual_end_date || ""} onChange={set("actual_end_date")}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth size="small" label="Sponsor" value={form.sponsor_id ?? ""} onChange={set("sponsor_id")}>
                <MenuItem value="" sx={{ fontSize: 13 }}>— none —</MenuItem>
                {people.map((r) => (
                  <MenuItem key={r.resource_id} value={r.resource_id} sx={{ fontSize: 13 }}>
                    {r.resource_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth size="small" label="Project lead" value={form.lead_id ?? ""} onChange={set("lead_id")}>
                <MenuItem value="" sx={{ fontSize: 13 }}>— none —</MenuItem>
                {people.map((r) => (
                  <MenuItem key={r.resource_id} value={r.resource_id} sx={{ fontSize: 13 }}>
                    {r.resource_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        )}

        {!isEdit && step === 1 && (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              Every assigned employee is costed at {fmtMoney(LABOR_RATE)}/hour — a full
              {" "}{STANDARD_WEEKLY_HOURS}-hour week is {fmtMoney(FULL_TIME_WEEKLY_COST)}.
            </Alert>

            <SearchField value={search} onChange={setSearch} placeholder="Search employees…" />

            <Paper variant="outlined" sx={{ maxHeight: 240, overflow: "auto" }}>
              {filteredResources.map((resource) => {
                const picked = team.some((m) => m.resource_id === resource.resource_id);
                return (
                  <Stack
                    key={resource.resource_id}
                    direction="row" alignItems="center" spacing={1.25}
                    onClick={() => toggleResource(resource)}
                    sx={{
                      px: 1.5, py: 1, cursor: "pointer",
                      borderBottom: `1px solid ${C.borderSoft}`,
                      bgcolor: picked ? C.indigoL : "transparent",
                      "&:hover": { bgcolor: picked ? C.indigoL : C.panel },
                    }}
                  >
                    <Checkbox checked={picked} size="small" sx={{ p: 0.5 }} />
                    <Avatar name={resource.resource_name} color={C.indigo} size={28} tooltip={false} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>{resource.resource_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {resource.job_title || "—"} · {resource.department || "—"}
                      </Typography>
                    </Box>
                    {resource.is_over_allocated && (
                      <Chip size="small" label="Over-allocated" sx={{ bgcolor: C.amberL, color: C.amber }} />
                    )}
                    <Typography sx={{ fontFamily: mono, fontSize: 11, color: C.muted }}>
                      {Number(resource.allocated_hours || 0)}h assigned
                    </Typography>
                  </Stack>
                );
              })}
            </Paper>

            {team.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="h4">Selected ({team.length})</Typography>
                {team.map((member) => (
                  <Stack key={member.resource_id} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1 }}>{member.resource_name}</Typography>
                    <TextField
                      size="small" label="Role" sx={{ width: 180 }}
                      value={member.role}
                      onChange={(e) => setRole(member.resource_id, e.target.value)}
                    />
                    <TextField
                      size="small" label="Hours/week" type="number" sx={{ width: 120 }}
                      inputProps={{ min: 1, max: 40 }}
                      value={member.allocated_hours}
                      onChange={(e) => setHours(member.resource_id, e.target.value)}
                    />
                    <Typography sx={{ fontFamily: mono, fontSize: 12, width: 90, textAlign: "right" }}>
                      {fmtMoney(laborCost(member.allocated_hours))}/wk
                    </Typography>
                    <IconButton size="small" onClick={() => toggleResource({ resource_id: member.resource_id })}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}

            <Divider />
            <Grid container spacing={1.5}>
              {[
                { label: "Weekly hours", value: `${weeklyHours}h` },
                { label: "Weekly labour cost", value: fmtMoney(weeklyLabor) },
                { label: "Project duration", value: weeks ? `${weeks} weeks` : "Set dates" },
                { label: "Projected labour", value: fmtMoney(projectedLabor) },
              ].map(({ label, value }) => (
                <Grid size={{ xs: 6, md: 3 }} key={label}>
                  <Box sx={{ bgcolor: C.panel, borderRadius: 2, p: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Stack>
        )}

        {!isEdit && step === 2 && (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              Projected personnel cost for this team is{" "}
              <strong>{fmtMoney(projectedLabor)}</strong>
              {weeks ? ` over ${weeks} weeks` : ""} — add it as a personnel line, plus any
              other spend.
            </Alert>

            <Stack direction="row" spacing={1}>
              <Button
                size="small" variant="outlined" startIcon={<AddIcon />}
                onClick={() => addLine()}
                sx={{ borderColor: "divider", color: "text.secondary", bgcolor: "#fff" }}
              >
                Add line
              </Button>
              {projectedLabor > 0 && (
                <Button
                  size="small" variant="outlined" startIcon={<AddIcon />}
                  onClick={() =>
                    addLine({
                      category: "personnel",
                      description: `${team.length} employees · ${weeklyHours}h/week at ${fmtMoney(LABOR_RATE)}/hr`,
                      allocated_amount: projectedLabor,
                    })
                  }
                  sx={{ borderColor: "divider", color: C.indigo, bgcolor: "#fff" }}
                >
                  Add projected personnel cost
                </Button>
              )}
            </Stack>

            {lines.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No budget lines yet. You can also add them later from the project page.
              </Typography>
            )}

            {lines.map((line) => (
              <Stack key={line.key} direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
                <TextField
                  select size="small" label="Category" sx={{ width: { xs: "100%", md: 150 } }}
                  value={line.category}
                  onChange={(e) => setLine(line.key, "category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small" label="Description" sx={{ flex: 1, width: "100%" }}
                  value={line.description}
                  onChange={(e) => setLine(line.key, "description", e.target.value)}
                />
                <TextField
                  size="small" label="Allocated" type="number" sx={{ width: { xs: "100%", md: 130 } }}
                  value={line.allocated_amount}
                  onChange={(e) => setLine(line.key, "allocated_amount", e.target.value)}
                />
                <TextField
                  size="small" label="Spent" type="number" sx={{ width: { xs: "100%", md: 110 } }}
                  value={line.spent_amount}
                  onChange={(e) => setLine(line.key, "spent_amount", e.target.value)}
                />
                <TextField
                  size="small" label="FY" type="number" sx={{ width: { xs: "100%", md: 90 } }}
                  value={line.fiscal_year}
                  onChange={(e) => setLine(line.key, "fiscal_year", e.target.value)}
                />
                <IconButton size="small" onClick={() => removeLine(line.key)}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            ))}

            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h4">Total budget allocated</Typography>
              <Typography variant="h4" sx={{ fontFamily: mono }}>{fmtMoney(budgetTotal)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Projected personnel cost ({weeklyHours}h/week × {weeks || 0} weeks × {fmtMoney(LABOR_RATE)}/hr)
              </Typography>
              <Typography
                variant="body2" fontWeight={700}
                sx={{ fontFamily: mono, color: projectedLabor > budgetTotal ? C.red : C.green }}
              >
                {fmtMoney(projectedLabor)}
              </Typography>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: "text.secondary" }}>Cancel</Button>
        <Box sx={{ flex: 1 }} />
        {!isEdit && step > 0 && (
          <Button onClick={() => setStep(step - 1)} disabled={saving} sx={{ color: "text.secondary" }}>
            Back
          </Button>
        )}
        {!isEdit && step < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={() => {
              if (step === 0 && !form.name.trim()) {
                setError("Project name is required");
                return;
              }
              setError(null);
              setStep(step + 1);
            }}
            sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" } }}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" } }}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create project"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
