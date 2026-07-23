import { Box, Paper, Stack, Typography, Chip } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FlagIcon from "@mui/icons-material/Flag";
import { C, mono } from "../services/theme.js";
import { fmtMoney, fmtDate, pct, displayStatus } from "../services/format.js";
import StatusChip from "./StatusChip";
import ProgressBar from "./ProgressBar";

export default function ProjectCard({ project, color, onClick }) {
  const projectId = project.project_id;
  const budgetAllocated = Number(project.budget_allocated || 0);
  const budgetSpent = Number(project.budget_spent || 0);
  const deliverablesTotal = Number(project.deliverables_total || 0);
  const deliverablesDone = Number(project.deliverables_done || 0);
  const teamSize = Number(project.team_size || 0);

  const budgetPct = pct(budgetSpent, budgetAllocated);
  const delivPct = pct(deliverablesDone, deliverablesTotal);
  const overBudget = budgetPct > 90;

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2.5,
        cursor: "pointer",
        height: "100%",
        transition: "box-shadow .2s, border-color .2s",
        "&:hover": {
          boxShadow: "0 4px 16px rgba(24,32,46,0.08)",
          borderColor: "rgba(24,32,46,0.18)",
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Box sx={{ width: 6, height: 40, borderRadius: 3, bgcolor: color, flexShrink: 0, mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: 10, color: "text.secondary" }}>
            PRJ-{String(projectId).padStart(3, "0")}
          </Typography>
          <Typography variant="h4" sx={{ lineHeight: 1.35 }}>{project.name}</Typography>
        </Box>
        <StatusChip status={displayStatus(project)} />
      </Stack>

      {project.description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            pl: 2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {project.description}
        </Typography>
      )}

      {project.has_late_deliverables && (
        <Box
          sx={{
            pl: 2,
            mb: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            color: C.amber,
            bgcolor: C.amberL,
            borderRadius: 1,
            px: 1,
            py: 0.75,
          }}
        >
          <FlagIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption" fontWeight={600}>Has late deliverables</Typography>
        </Box>
      )}

      <Box sx={{ pl: 2, mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography variant="body2" color="text.secondary">Deliverables</Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color }}>
            {deliverablesDone}/{deliverablesTotal} done
          </Typography>
        </Stack>
        <ProgressBar value={delivPct} color={color} />
      </Box>

      <Box sx={{ pl: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography variant="body2" color="text.secondary">Budget used</Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: mono, fontSize: 11, color: overBudget ? C.red : "text.secondary" }}
          >
            {fmtMoney(budgetSpent)} / {fmtMoney(budgetAllocated)}
          </Typography>
        </Stack>
        <ProgressBar value={budgetPct} color={overBudget ? C.red : color} />
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ pl: 2, pt: 1.5, borderTop: `1px solid ${C.borderSoft}` }}
      >
        <Chip
          size="small"
          label={`${teamSize} ${teamSize === 1 ? "person" : "people"}`}
          sx={{ bgcolor: `${color}18`, color, fontWeight: 600 }}
        />
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "text.secondary" }}>
          <CalendarTodayIcon sx={{ fontSize: 12 }} />
          <Typography sx={{ fontFamily: mono, fontSize: 10 }}>
            {fmtDate(project.expected_end_date)}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
