import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FlagIcon from "@mui/icons-material/Flag";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { C, mono } from "../services/theme.js";
import { fmtMoney, laborCost } from "../services/format.js";
import Avatar from "./Avatar";

export default function TeamTable({
  team = [],
  color,
  resourceLoad = [],
  labor,
  canEdit = false,
  onAdd,
  onEdit,
  onRemove,
}) {
  const loadById = Object.fromEntries(resourceLoad.map((row) => [row.resource_id, row]));
  const totalWeekly = team.reduce(
    (sum, member) => sum + Number(member.weekly_cost ?? laborCost(member.allocated_hours)),
    0
  );
  const weeks = Number(labor?.duration_weeks || 0);

  const headers = [
    "Resource", "Role", "Department", "Weekly hours", "Rate", "Weekly cost",
    weeks ? `Cost over ${weeks}w` : "Projected cost", "Allocation",
    ...(canEdit ? ["Actions"] : []),
  ];

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack
        direction="row" justifyContent="space-between" alignItems="center"
        sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${C.borderSoft}` }}
      >
        <Box>
          <Typography variant="h4">Resources (full-time employees)</Typography>
          <Typography variant="caption" color="text.secondary">
            {team.length} assigned · {fmtMoney(totalWeekly)} total weekly cost
            {weeks ? ` · ${fmtMoney(labor?.projected_labor_cost || 0)} projected over ${weeks} weeks` : ""}
          </Typography>
        </Box>
        {canEdit && (
          <Button
            size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd}
            sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" }, whiteSpace: "nowrap" }}
          >
            Assign employee
          </Button>
        )}
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>{headers.map((header) => <TableCell key={header}>{header}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {team.length === 0 && (
              <TableRow>
                <TableCell colSpan={headers.length} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
                  No employees assigned yet.
                </TableCell>
              </TableRow>
            )}

            {team.map((member, idx) => {
              const load = loadById[member.resource_id];
              const overAllocated = Boolean(load?.is_over_allocated);
              const weeklyCost = Number(member.weekly_cost ?? laborCost(member.allocated_hours));
              const projected = Number(member.projected_cost ?? laborCost(member.allocated_hours, weeks));
              return (
                <TableRow key={member.allocation_id || member.resource_id || idx} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar name={member.resource_name} color={color} size={28} tooltip={false} />
                      <Typography variant="body2" fontWeight={600}>{member.resource_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{member.role || "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{member.department || "—"}</TableCell>
                  <TableCell sx={{ fontFamily: mono }}>{Number(member.allocated_hours || 0)}h</TableCell>
                  <TableCell sx={{ fontFamily: mono }}>
                    {member.hourly_rate ? `$${Number(member.hourly_rate)}/hr` : "—"}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{fmtMoney(weeklyCost)}</TableCell>
                  <TableCell sx={{ fontFamily: mono, color: C.purple, fontWeight: 600 }}>
                    {fmtMoney(projected)}
                  </TableCell>
                  <TableCell>
                    {overAllocated ? (
                      <Chip
                        size="small"
                        icon={<FlagIcon sx={{ fontSize: 13 }} />}
                        label={`Over-allocated (${load.allocated_hours}h)`}
                        sx={{ bgcolor: C.amberL, color: C.amber }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        icon={<CheckCircleOutlineIcon sx={{ fontSize: 13 }} />}
                        label="Within capacity"
                        sx={{ bgcolor: C.greenL, color: C.green }}
                      />
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit assignment">
                          <IconButton size="small" onClick={() => onEdit?.(member)}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove from project">
                          <IconButton size="small" onClick={() => onRemove?.(member)}>
                            <DeleteOutlineIcon sx={{ fontSize: 16, color: C.red }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
