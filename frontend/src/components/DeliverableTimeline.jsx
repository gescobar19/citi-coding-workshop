import { Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import LinkIcon from "@mui/icons-material/Link";
import { C, mono } from "../services/theme.js";
import { fmtDate, displayStatus } from "../services/format.js";
import StatusChip from "./StatusChip";

export default function DeliverableTimeline({
  deliverables = [],
  color,
  canEdit = false,
  onAdd,
  onEdit,
  onDelete,
  onDependencies,
}) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack
        direction="row" justifyContent="space-between" alignItems="center"
        sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${C.borderSoft}` }}
      >
        <Box>
          <Typography variant="h4">Deliverables (sequence order)</Typography>
          <Typography variant="caption" color="text.secondary">
            A blocked milestone is waiting on the deliverables listed beneath it —
            dependencies can point at other projects.
          </Typography>
        </Box>
        {canEdit && (
          <Button
            size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd}
            sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" }, whiteSpace: "nowrap" }}
          >
            Add deliverable
          </Button>
        )}
      </Stack>

      {deliverables.length === 0 && (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">No deliverables yet.</Typography>
        </Box>
      )}

      <Stack divider={<Box sx={{ borderTop: `1px solid ${C.borderSoft}` }} />}>
        {deliverables.map((deliverable, idx) => {
          const status = displayStatus(deliverable);
          const isFinished = status === "finished";
          // Blocking comes from the recorded dependency chain. Fall back to
          // sequence order only when no dependencies are known.
          const waitsOn = deliverable.waits_on || [];
          const blockers = waitsOn.filter((edge) => edge.is_blocking);
          const prevDone = idx === 0 || displayStatus(deliverables[idx - 1]) === "finished";
          const isBlocked =
            deliverable.is_blocked ??
            (waitsOn.length ? blockers.length > 0 : !prevDone && status === "not_started");

          return (
            <Box key={deliverable.deliverable_id || idx} sx={{ p: 2.5, opacity: isBlocked ? 0.55 : 1 }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Stack alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      bgcolor: isFinished ? color : C.panel,
                      color: isFinished ? "#fff" : C.muted,
                      border: isFinished ? "none" : `1px solid ${C.border}`,
                    }}
                  >
                    {isFinished ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : deliverable.sequence_no}
                  </Box>
                  {idx < deliverables.length - 1 && <Box sx={{ width: 2, height: 24, bgcolor: "#ECEDF1" }} />}
                </Stack>

                <Box sx={{ flex: 1, minWidth: 0, pb: 1 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1.5}
                    sx={{ mb: 0.5 }}
                  >
                    <Box>
                      <Typography variant="h4">{deliverable.name}</Typography>
                      {isBlocked && blockers.length === 0 && (
                        <Chip
                          size="small"
                          label="Blocked: previous milestone incomplete"
                          sx={{ mt: 0.5, bgcolor: C.amberL, color: C.amber, fontSize: 10 }}
                        />
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <StatusChip status={status} />
                      <Tooltip title="Dependencies">
                        <IconButton size="small" onClick={() => onDependencies?.(deliverable)}>
                          <AccountTreeIcon
                            sx={{ fontSize: 16, color: blockers.length ? C.amber : C.muted }}
                          />
                        </IconButton>
                      </Tooltip>
                      {canEdit && (
                        <>
                          <Tooltip title="Edit deliverable">
                            <IconButton size="small" onClick={() => onEdit?.(deliverable)}>
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete deliverable">
                            <IconButton size="small" onClick={() => onDelete?.(deliverable)}>
                              <DeleteOutlineIcon sx={{ fontSize: 16, color: C.red }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  </Stack>

                  {deliverable.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {deliverable.description}
                    </Typography>
                  )}

                  {waitsOn.length > 0 && (
                    <Box sx={{ mb: 1.25 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        WAITS ON
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        {waitsOn.map((edge) => (
                          <Tooltip
                            key={edge.depends_on_id}
                            title={edge.notes || `${edge.depends_on_name} — ${edge.depends_on_status}`}
                          >
                            <Chip
                              size="small"
                              icon={
                                <LinkIcon
                                  sx={{
                                    fontSize: 13,
                                    color: `${edge.is_blocking ? C.amber : C.green} !important`,
                                  }}
                                />
                              }
                              label={
                                edge.is_cross_project
                                  ? `${edge.depends_on_name} · ${edge.depends_on_project_name}`
                                  : edge.depends_on_name
                              }
                              sx={{
                                bgcolor: edge.is_blocking ? C.amberL : C.greenL,
                                color: edge.is_blocking ? C.amber : C.green,
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ fontFamily: mono, fontSize: 10 }}>
                    {deliverable.expected_date && (
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "text.secondary" }}>
                        <CalendarTodayIcon sx={{ fontSize: 11 }} />
                        <span>
                          {status === "finished" ? "Completed" : status === "late" ? "Was due" : "Expected"}
                          : {fmtDate(deliverable.expected_date)}
                        </span>
                      </Stack>
                    )}
                    {Number(deliverable.days_late) > 0 && (
                      <Typography sx={{ fontFamily: mono, fontSize: 10, color: C.red, fontWeight: 600 }}>
                        {deliverable.days_late} days late
                      </Typography>
                    )}
                    {deliverable.completed_date && (
                      <Typography sx={{ fontFamily: mono, fontSize: 10, color: C.green, fontWeight: 600 }}>
                        Delivered {fmtDate(deliverable.completed_date)}
                      </Typography>
                    )}
                    {deliverable.owner_name && (
                      <Typography sx={{ fontFamily: mono, fontSize: 10, color: C.muted }}>
                        Owner: {deliverable.owner_name}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
