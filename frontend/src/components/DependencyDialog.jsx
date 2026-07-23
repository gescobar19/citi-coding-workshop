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
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { api } from "../api/client.js";
import { C, mono } from "../services/theme.js";
import StatusChip from "./StatusChip";

const TYPES = [
  { value: "finish_to_start", label: "Finish → start (must finish first)" },
  { value: "start_to_start", label: "Start → start (must be underway)" },
];

/**
 * Manage which deliverables a given deliverable waits on.
 * Dependencies may point at deliverables in other projects.
 */
export default function DependencyDialog({
  open,
  deliverable,
  allDeliverables = [],
  onClose,
  onSaved,
}) {
  const [dependsOn, setDependsOn] = useState("");
  const [type, setType] = useState("finish_to_start");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const waitsOn = deliverable?.waits_on || [];
  const requiredBy = deliverable?.required_by || [];
  const alreadyLinked = waitsOn.map((edge) => edge.depends_on_id);

  const options = useMemo(
    () =>
      allDeliverables.filter(
        (d) =>
          d.deliverable_id !== deliverable?.deliverable_id &&
          !alreadyLinked.includes(d.deliverable_id)
      ),
    [allDeliverables, deliverable, alreadyLinked]
  );

  const handleAdd = async () => {
    if (!dependsOn) return setError("Pick the deliverable this one waits on");

    setBusy(true);
    setError(null);
    try {
      await api.addDependency(deliverable.deliverable_id, {
        depends_on_id: Number(dependsOn),
        dependency_type: type,
        notes: notes || null,
      });
      setDependsOn("");
      setNotes("");
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (dependsOnId) => {
    setBusy(true);
    setError(null);
    try {
      await api.removeDependency(deliverable.deliverable_id, dependsOnId);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!deliverable) return null;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h2" component="div">Dependencies</Typography>
        <Typography variant="body2" color="text.secondary">
          What <strong>{deliverable.name}</strong> waits on, and what waits on it.
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="h4" sx={{ mb: 1 }}>
          <ArrowBackIcon sx={{ fontSize: 14, verticalAlign: "-2px", mr: 0.5 }} />
          Waits on ({waitsOn.length})
        </Typography>

        {waitsOn.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nothing — this deliverable can start whenever it is scheduled.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {waitsOn.map((edge) => (
              <Paper
                key={edge.depends_on_id}
                variant="outlined"
                sx={{ p: 1.25, display: "flex", alignItems: "center", gap: 1 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" fontWeight={600}>{edge.depends_on_name}</Typography>
                    <StatusChip status={edge.depends_on_status} />
                    {edge.is_cross_project && (
                      <Chip
                        size="small" label={edge.depends_on_project_name}
                        sx={{ bgcolor: C.purpleL, color: C.purple }}
                      />
                    )}
                  </Stack>
                  {edge.notes && (
                    <Typography variant="caption" color="text.secondary">{edge.notes}</Typography>
                  )}
                </Box>
                <Typography sx={{ fontFamily: mono, fontSize: 10, color: C.muted }}>
                  {edge.dependency_type === "start_to_start" ? "SS" : "FS"}
                </Typography>
                <Tooltip title="Remove dependency">
                  <IconButton size="small" disabled={busy} onClick={() => handleRemove(edge.depends_on_id)}>
                    <DeleteOutlineIcon sx={{ fontSize: 16, color: C.red }} />
                  </IconButton>
                </Tooltip>
              </Paper>
            ))}
          </Stack>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: C.panel }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
            ADD A DEPENDENCY
          </Typography>
          <Stack spacing={1.25}>
            <TextField
              select fullWidth size="small" label="This deliverable waits on…"
              value={dependsOn} onChange={(e) => setDependsOn(e.target.value)}
            >
              {options.map((d) => (
                <MenuItem key={d.deliverable_id} value={d.deliverable_id} sx={{ fontSize: 13 }}>
                  {d.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1}>
              <TextField
                select size="small" label="Type" sx={{ width: 260 }}
                value={type} onChange={(e) => setType(e.target.value)}
              >
                {TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value} sx={{ fontSize: 13 }}>{t.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small" label="Why (optional)" sx={{ flex: 1 }}
                value={notes} onChange={(e) => setNotes(e.target.value)}
              />
            </Stack>
            <Button
              size="small" variant="contained" startIcon={<AddIcon />}
              onClick={handleAdd} disabled={busy}
              sx={{ alignSelf: "flex-start", bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" } }}
            >
              Add dependency
            </Button>
          </Stack>
        </Paper>

        <Typography variant="h4" sx={{ mb: 1 }}>
          <ArrowForwardIcon sx={{ fontSize: 14, verticalAlign: "-2px", mr: 0.5 }} />
          Required by ({requiredBy.length})
        </Typography>
        {requiredBy.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing is waiting on this deliverable.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {requiredBy.map((edge) => (
              <Stack key={edge.deliverable_id} direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2">{edge.deliverable_name}</Typography>
                <StatusChip status={edge.deliverable_status} />
                {edge.is_cross_project && (
                  <Chip size="small" label={edge.project_name} sx={{ bgcolor: C.purpleL, color: C.purple }} />
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: "text.secondary" }}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
