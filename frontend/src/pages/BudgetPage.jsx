import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
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
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import PaidIcon from "@mui/icons-material/Paid";
import SavingsIcon from "@mui/icons-material/Savings";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useNavigate } from "react-router-dom";
import { useBudgetSummary } from "../services/useApi.js";
import { C, mono } from "../services/theme.js";
import { fmtMoney, fmtDate } from "../services/format.js";
import StatCard from "../components/StatCard";
import StatusChip from "../components/StatusChip";
import ProgressBar from "../components/ProgressBar";
import SearchField from "../components/SearchField";
import TablePager from "../components/TablePager";
import { usePagination } from "../services/usePagination.js";
import { Spinner } from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";

const HEADERS = [
  "", "Project", "Status", "Team", "Weekly hours", "Weekly labour",
  "Projected labour", "Budget", "Spent", "Remaining", "Used",
];

export default function BudgetPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const { data, loading, error, refetch } = useBudgetSummary();

  const projects = data?.projects ?? [];
  const totals = data?.totals;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [projects, search]);

  // Called before the early returns below: hooks have to run on every render.
  const { paged, pagerProps } = usePagination(filtered);

  if (loading) return <Spinner label="Calculating budgets…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!totals) return null;

  const rate = Number(totals.standard_hourly_rate);
  const fullWeek = rate * Number(totals.standard_weekly_hours);

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box>
          <Typography variant="h1">Budget</Typography>
          <Typography variant="body2" color="text.secondary">
            Total portfolio budget with personnel cost calculated at {fmtMoney(rate)}/hour ·{" "}
            {Number(totals.standard_weekly_hours)}h week = {fmtMoney(fullWeek)} per full-time employee
          </Typography>
        </Box>
        <SearchField value={search} onChange={setSearch} placeholder="Search projects…" width={220} />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total budget allocated" value={fmtMoney(totals.budget_allocated)}
            icon={<PaidIcon sx={{ fontSize: 18 }} />} color={C.indigo} bg={C.indigoL}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label={`Spent (${totals.utilization_pct}%)`} value={fmtMoney(totals.budget_spent)}
            icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} color={C.teal} bg={C.tealL}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Remaining" value={fmtMoney(totals.budget_remaining)}
            icon={<SavingsIcon sx={{ fontSize: 18 }} />}
            color={Number(totals.budget_remaining) < 0 ? C.red : C.green}
            bg={Number(totals.budget_remaining) < 0 ? C.redL : C.greenL}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label={`Employee cost / week (${Number(totals.weekly_hours)}h)`}
            value={fmtMoney(totals.weekly_labor_cost)}
            icon={<GroupsIcon sx={{ fontSize: 18 }} />} color={C.purple} bg={C.purpleL}
          />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              PROJECTED EMPLOYEE COST (ALL PROJECTS)
            </Typography>
            <Typography variant="h2" sx={{ fontFamily: mono }}>
              {fmtMoney(totals.projected_labor_cost)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Assigned hours × {fmtMoney(rate)}/hr × project duration
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={1} sx={{ height: "100%", justifyContent: "center" }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Projected employee cost vs total budget
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: mono }}>
                  {fmtMoney(totals.projected_labor_cost)} / {fmtMoney(totals.budget_allocated)}
                </Typography>
              </Stack>
              <ProgressBar
                value={
                  Number(totals.budget_allocated)
                    ? (Number(totals.projected_labor_cost) / Number(totals.budget_allocated)) * 100
                    : 0
                }
                color={C.purple}
                height={8}
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Budget consumed to date</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: mono }}>
                  {totals.utilization_pct}%
                </Typography>
              </Stack>
              <ProgressBar value={totals.utilization_pct} color={C.teal} height={8} />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {filtered.length === 0 ? (
        <EmptyState title="No projects found" subtitle="Try a different search term." />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${C.borderSoft}` }}>
            <Typography variant="h4">Budget by project</Typography>
            <Typography variant="caption" color="text.secondary">
              Expand a row to see the employee cost breakdown.
            </Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>{HEADERS.map((h, i) => <TableCell key={`${h}-${i}`}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {paged.map((p) => {
                  const open = expanded === p.project_id;
                  const remaining = Number(p.budget_remaining);
                  return [
                    <TableRow key={p.project_id} hover>
                      <TableCell sx={{ width: 40 }}>
                        <IconButton size="small" onClick={() => setExpanded(open ? null : p.project_id)}>
                          {open ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2" fontWeight={600}
                          onClick={() => navigate(`/projects/${p.project_id}`)}
                          sx={{ cursor: "pointer", "&:hover": { color: C.indigo } }}
                        >
                          {p.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {fmtDate(p.start_date)} → {fmtDate(p.expected_end_date)} · {p.duration_weeks}w
                        </Typography>
                      </TableCell>
                      <TableCell><StatusChip status={p.status} /></TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{p.team_size}</TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{Number(p.weekly_hours)}h</TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{fmtMoney(p.weekly_labor_cost)}</TableCell>
                      <TableCell sx={{ fontFamily: mono, fontWeight: 600, color: C.purple }}>
                        {fmtMoney(p.projected_labor_cost)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{fmtMoney(p.budget_allocated)}</TableCell>
                      <TableCell sx={{ fontFamily: mono, fontWeight: 600 }}>{fmtMoney(p.budget_spent)}</TableCell>
                      <TableCell sx={{ fontFamily: mono, color: remaining < 0 ? C.red : C.green }}>
                        {fmtMoney(remaining)}
                      </TableCell>
                      <TableCell sx={{ minWidth: 110 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" sx={{ fontFamily: mono }}>{p.utilization_pct}%</Typography>
                          <ProgressBar
                            value={p.utilization_pct}
                            color={p.utilization_pct > 90 ? C.red : p.utilization_pct > 75 ? C.amber : C.teal}
                            height={5}
                          />
                        </Stack>
                      </TableCell>
                    </TableRow>,

                    <TableRow key={`${p.project_id}-detail`}>
                      <TableCell colSpan={HEADERS.length} sx={{ p: 0, border: 0 }}>
                        <Collapse in={open} unmountOnExit>
                          <Box sx={{ p: 2.5, bgcolor: C.panel }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                              <Typography variant="h4">Employee cost breakdown</Typography>
                              <Chip
                                size="small"
                                label={`${p.fte_equivalent} FTE · ${p.duration_weeks} weeks`}
                                sx={{ bgcolor: C.indigoL, color: C.indigo }}
                              />
                              {p.over_budget && (
                                <Chip size="small" label="Over budget" sx={{ bgcolor: C.redL, color: C.red }} />
                              )}
                            </Stack>

                            {p.labor.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">
                                No employees assigned to this project yet.
                              </Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    {["Employee", "Role", "Department", "Hours/week", "Rate", "Weekly cost", `Cost over ${p.duration_weeks}w`].map((h) => (
                                      <TableCell key={h}>{h}</TableCell>
                                    ))}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {p.labor.map((line) => (
                                    <TableRow key={line.resource_id}>
                                      <TableCell sx={{ fontWeight: 600 }}>{line.resource_name}</TableCell>
                                      <TableCell sx={{ color: "text.secondary" }}>{line.job_title || "—"}</TableCell>
                                      <TableCell sx={{ color: "text.secondary" }}>{line.department || "—"}</TableCell>
                                      <TableCell sx={{ fontFamily: mono }}>{Number(line.allocated_hours)}h</TableCell>
                                      <TableCell sx={{ fontFamily: mono }}>{fmtMoney(line.hourly_rate)}/hr</TableCell>
                                      <TableCell sx={{ fontFamily: mono }}>{fmtMoney(line.weekly_cost)}</TableCell>
                                      <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>
                                        {fmtMoney(line.projected_cost)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow>
                                    <TableCell colSpan={3} sx={{ fontWeight: 700 }}>Total</TableCell>
                                    <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{Number(p.weekly_hours)}h</TableCell>
                                    <TableCell />
                                    <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{fmtMoney(p.weekly_labor_cost)}</TableCell>
                                    <TableCell sx={{ fontFamily: mono, fontWeight: 700, color: C.purple }}>
                                      {fmtMoney(p.projected_labor_cost)}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            )}

                            <Stack direction="row" spacing={3} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                  PROJECTED LABOUR VS BUDGET
                                </Typography>
                                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: mono }}>
                                  {p.labor_vs_budget_pct}% of {fmtMoney(p.budget_allocated)}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                  BUDGET REMAINING
                                </Typography>
                                <Typography
                                  variant="body2" fontWeight={700}
                                  sx={{ fontFamily: mono, color: remaining < 0 ? C.red : C.green }}
                                >
                                  {fmtMoney(remaining)}
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>,
                  ];
                })}

                <TableRow sx={{ bgcolor: C.panel }}>
                  <TableCell />
                  <TableCell sx={{ fontWeight: 700 }}>Portfolio total</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{Number(totals.weekly_hours)}h</TableCell>
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{fmtMoney(totals.weekly_labor_cost)}</TableCell>
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700, color: C.purple }}>
                    {fmtMoney(totals.projected_labor_cost)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{fmtMoney(totals.budget_allocated)}</TableCell>
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{fmtMoney(totals.budget_spent)}</TableCell>
                  <TableCell
                    sx={{ fontFamily: mono, fontWeight: 700, color: Number(totals.budget_remaining) < 0 ? C.red : C.green }}
                  >
                    {fmtMoney(totals.budget_remaining)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: mono, fontWeight: 700 }}>{totals.utilization_pct}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <TablePager {...pagerProps} label="Projects per page:" />
        </Paper>
      )}
    </Stack>
  );
}
