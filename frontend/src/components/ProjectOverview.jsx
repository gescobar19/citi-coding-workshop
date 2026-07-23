import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { C } from "../services/theme.js";
import { fmtMoney, pct, displayStatus } from "../services/format.js";
import StatusChip from "./StatusChip";

export default function ProjectOverview({ project, deliverables = [], budget = [], team = [], color }) {
  const totalAllocated = budget.reduce(
    (sum, item) => sum + Number(item.allocated_amount || item.budget_amount || item.amount || 0),
    0
  );
  const totalSpent = budget.reduce(
    (sum, item) => sum + Number(item.spent_amount || item.spent || 0),
    0
  );
  const usedPct = pct(totalSpent, totalAllocated);
  const weeklyCost = team.reduce(
    (sum, member) => sum + Number(member.allocated_hours || 0) * Number(member.hourly_rate || 0),
    0
  );
  const totalHours = team.reduce((sum, member) => sum + Number(member.allocated_hours || 0), 0);

  const pieData = [
    { name: "Spent", value: totalSpent, color },
    { name: "Remaining", value: Math.max(totalAllocated - totalSpent, 0), color: "#ECEDF1" },
  ];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>Deliverable progress</Typography>
          <Stack spacing={1.5}>
            {deliverables.map((deliverable) => (
              <Stack key={deliverable.deliverable_id} direction="row" spacing={1.5} alignItems="center">
                <Typography
                  variant="caption"
                  sx={{ width: 16, textAlign: "right", color: "text.secondary", flexShrink: 0 }}
                >
                  {deliverable.sequence_no}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      textDecoration: displayStatus(deliverable) === "finished" ? "line-through" : "none",
                      color: displayStatus(deliverable) === "finished" ? "text.secondary" : "text.primary",
                    }}
                  >
                    {deliverable.name}
                  </Typography>
                </Box>
                <StatusChip status={displayStatus(deliverable)} />
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>Budget summary</Typography>

          <Box sx={{ position: "relative", width: 140, height: 140, mx: "auto", mb: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={60}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((item, idx) => <Cell key={idx} fill={item.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="h2">{usedPct}%</Typography>
              <Typography variant="caption" color="text.secondary">used</Typography>
            </Box>
          </Box>

          {[
            { label: "Total budget", value: totalAllocated },
            { label: "Spent to date", value: totalSpent, color },
            { label: "Remaining", value: totalAllocated - totalSpent, color: C.green },
          ].map((row) => (
            <Stack
              key={row.label}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1, borderBottom: `1px solid ${C.borderSoft}`, "&:last-of-type": { border: 0 } }}
            >
              <Typography variant="body2" color="text.secondary">{row.label}</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: row.color || "text.primary" }}>
                {fmtMoney(row.value)}
              </Typography>
            </Stack>
          ))}

          <Box sx={{ pt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Weekly resource cost
            </Typography>
            <Typography variant="h3">{fmtMoney(weeklyCost)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {team.length} resources · {totalHours}h/week committed
            </Typography>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}
