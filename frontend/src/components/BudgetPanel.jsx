import {
  Box,
  Button,
  Chip,
  Grid,
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts";
import { C, mono } from "../services/theme.js";
import { LABOR_RATE, fmtMoney, pct } from "../services/format.js";

const CATEGORY_COLORS = {
  personnel: C.indigo,
  software: C.teal,
  hardware: C.purple,
  vendor: C.amber,
  legal: C.red,
  marketing: "#C2568C",
  training: "#3E7CB1",
  contingency: C.muted,
  other: C.faint,
};

const tooltipStyle = {
  background: "#fff",
  border: "1px solid rgba(24,32,46,0.12)",
  borderRadius: 8,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 11,
  boxShadow: "0 4px 16px rgba(24,32,46,0.10)",
  color: C.fg,
};

export default function BudgetPanel({
  budget = [],
  color,
  labor,
  canEdit = false,
  onAdd,
  onEdit,
  onDelete,
}) {
  const rows = budget.map((item) => ({
    budget_id: item.budget_id,
    category: item.category || item.cost_category || "other",
    description: item.description,
    allocated_amount: Number(item.allocated_amount || item.budget_amount || item.amount || 0),
    spent_amount: Number(item.spent_amount || item.spent || 0),
    fiscal_year: item.fiscal_year,
  }));

  const totalAllocated = rows.reduce((sum, item) => sum + item.allocated_amount, 0);
  const totalSpent = rows.reduce((sum, item) => sum + item.spent_amount, 0);
  const remaining = totalAllocated - totalSpent;
  const usedPct = pct(totalSpent, totalAllocated);

  const projectedLabor = Number(labor?.projected_labor_cost || 0);
  const weeklyLabor = Number(labor?.weekly_labor_cost || 0);

  const pieData = [
    ...rows
      .filter((item) => item.spent_amount > 0)
      .map((item) => ({
        name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
        value: item.spent_amount,
        color: CATEGORY_COLORS[item.category] || C.faint,
      })),
    ...(remaining > 0 ? [{ name: "Remaining", value: remaining, color: "#ECEDF1" }] : []),
  ];

  const headers = ["Category", "Description", "Allocated", "Spent", "Remaining", "FY", ...(canEdit ? ["Actions"] : [])];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack
            direction="row" justifyContent="space-between" alignItems="center"
            sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${C.borderSoft}` }}
          >
            <Box>
              <Typography variant="h4">Budget line items</Typography>
              <Typography variant="caption" color="text.secondary">
                Allocated vs spent by category.
              </Typography>
            </Box>
            {canEdit && (
              <Button
                size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd}
                sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" }, whiteSpace: "nowrap" }}
              >
                Add line
              </Button>
            )}
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {headers.map((header) => <TableCell key={header}>{header}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={headers.length} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
                      No budget lines yet.
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((item, idx) => {
                  const catColor = CATEGORY_COLORS[item.category] || C.faint;
                  const lineRemaining = item.allocated_amount - item.spent_amount;
                  return (
                    <TableRow key={item.budget_id || idx} hover>
                      <TableCell>
                        <Chip
                          size="small"
                          label={item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                          sx={{ bgcolor: `${catColor}18`, color: catColor }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{item.description || "—"}</TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{fmtMoney(item.allocated_amount)}</TableCell>
                      <TableCell sx={{ fontFamily: mono, fontWeight: 600 }}>{fmtMoney(item.spent_amount)}</TableCell>
                      <TableCell sx={{ fontFamily: mono, color: lineRemaining < 0 ? C.red : C.green }}>
                        {fmtMoney(lineRemaining)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: mono, color: "text.secondary" }}>
                        {item.fiscal_year || "—"}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Edit line">
                              <IconButton size="small" onClick={() => onEdit?.(item)}>
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete line">
                              <IconButton size="small" onClick={() => onDelete?.(item)}>
                                <DeleteOutlineIcon sx={{ fontSize: 16, color: C.red }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                <TableRow sx={{ bgcolor: C.panel }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{fmtMoney(totalAllocated)}</TableCell>
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700, color }}>{fmtMoney(totalSpent)}</TableCell>
                  <TableCell
                    sx={{ fontFamily: mono, fontWeight: 700, color: remaining < 0 ? C.red : C.green }}
                  >
                    {fmtMoney(remaining)}
                  </TableCell>
                  <TableCell />
                  {canEdit && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {labor && (
          <Paper variant="outlined" sx={{ p: 2.5, mt: 2 }}>
            <Typography variant="h4" sx={{ mb: 0.5 }}>Employee cost</Typography>
            <Typography variant="caption" color="text.secondary">
              {Number(labor.weekly_hours || 0)}h per week at {fmtMoney(LABOR_RATE)}/hour ·{" "}
              {labor.fte_equivalent} full-time equivalent
              {labor.duration_weeks ? ` · ${labor.duration_weeks} week project` : ""}
            </Typography>

            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              {[
                { label: "Weekly", value: fmtMoney(weeklyLabor) },
                { label: "Projected total", value: fmtMoney(projectedLabor) },
                {
                  label: "Share of budget",
                  value: `${pct(projectedLabor, totalAllocated)}%`,
                  color: projectedLabor > totalAllocated ? C.red : C.green,
                },
                {
                  label: "Budget left after labour",
                  value: fmtMoney(totalAllocated - projectedLabor),
                  color: totalAllocated - projectedLabor < 0 ? C.red : C.green,
                },
              ].map((row) => (
                <Grid size={{ xs: 6, md: 3 }} key={row.label}>
                  <Box sx={{ bgcolor: C.panel, borderRadius: 2, p: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">{row.label}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ fontFamily: mono, color: row.color }}>
                      {row.value}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>Spend breakdown</Typography>

          <Box sx={{ position: "relative", width: 160, height: 160, mx: "auto", mb: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={66} dataKey="value" stroke="none">
                  {pieData.map((item, idx) => <Cell key={idx} fill={item.color} />)}
                </Pie>
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value) => fmtMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="h2">{usedPct}%</Typography>
              <Typography variant="caption" color="text.secondary">utilized</Typography>
            </Box>
          </Box>

          <Stack spacing={1.25}>
            {pieData.map((item) => (
              <Stack key={item.name} direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: item.color }} />
                  <Typography variant="body2" color="text.secondary">{item.name}</Typography>
                </Stack>
                <Typography variant="body2" fontWeight={700}>{fmtMoney(item.value)}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}
