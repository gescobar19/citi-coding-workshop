import {
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip as MuiTooltip,
  Typography,
} from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PeopleIcon from "@mui/icons-material/People";
import PaidIcon from "@mui/icons-material/Paid";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboard } from "../services/useApi.js";
import { C, mono } from "../services/theme.js";
import { fmtMoney, fmtDate, STATUS_LABELS } from "../services/format.js";
import StatCard from "../components/StatCard";
import StatusChip from "../components/StatusChip";
import ProgressBar from "../components/ProgressBar";
import { Spinner } from "../components/LoadingState";
import ErrorState from "../components/ErrorState";

const STATUS_COLORS = {
  not_started: C.muted,
  in_progress: C.indigo,
  finished: C.green,
  cancelled: C.faint,
};

const SEVERITY = {
  critical: { color: C.red, bg: C.redL, label: "Critical" },
  high: { color: C.amber, bg: C.amberL, label: "High" },
  medium: { color: C.indigo, bg: C.indigoL, label: "Medium" },
};

const KIND = {
  project: { Icon: TimelineIcon, label: "Project" },
  deliverable: { Icon: LinkOffIcon, label: "Deliverable" },
  resource: { Icon: PeopleIcon, label: "Person" },
};

const CHART_HEIGHT = 300;
const CHART_ROWS = 8;

const tooltipStyle = {
  background: "#fff",
  border: "1px solid rgba(24,32,46,0.12)",
  borderRadius: 8,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 11,
  boxShadow: "0 4px 16px rgba(24,32,46,0.10)",
  color: C.fg,
};

const axisTick = { fontSize: 10, fill: C.muted };

function shorten(name, max = 20) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function Panel({ title, subtitle, children, action }) {
  return (
    <Paper variant="outlined" sx={{ height: "100%", overflow: "hidden" }}>
      <Stack
        direction="row" justifyContent="space-between" alignItems="center"
        sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${C.borderSoft}` }}
      >
        <Box>
          <Typography variant="h4">{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useDashboard();

  if (loading) return <Spinner label="Building dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const { kpis, status_breakdown, projects, upcoming_deliverables, standard_rate } = data;
  const attention = data.attention || [];
  const deliveryRows = data.delivery_by_project || [];

  // Biggest budgets first — that is the order an admin scans money in.
  const budgetChart = projects
    .filter((p) => !["finished", "cancelled"].includes(p.status))
    .map((p) => ({
      name: shorten(p.name),
      Allocated: Number(p.budget_allocated || 0),
      Spent: Number(p.budget_spent || 0),
    }))
    .filter((row) => row.Allocated > 0 || row.Spent > 0)
    .sort((a, b) => b.Allocated - a.Allocated)
    .slice(0, CHART_ROWS);

  // Most slipped first, so the top of the chart is always the problem.
  const deliveryChart = deliveryRows
    .map((row) => ({
      name: shorten(row.project_name),
      Done: row.done_count,
      Open: row.open_count,
      Late: row.late_count,
    }))
    .sort((a, b) => b.Late - a.Late || b.Open - a.Open)
    .slice(0, CHART_ROWS);

  const statusBar = status_breakdown.filter((row) => row.count > 0);
  const statusTotal = statusBar.reduce((sum, row) => sum + row.count, 0);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h1">Portfolio dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          {kpis.projects_total} projects · {kpis.resources_total} employees · labour charged at{" "}
          {fmtMoney(standard_rate.hourly_rate)}/hour on a {standard_rate.weekly_hours}-hour week
        </Typography>
      </Box>

      {/* Exceptions, not inventory: every card is a number you might have to act on. */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Projects at risk"
            value={kpis.projects_at_risk}
            sub={`of ${kpis.projects_active} active`}
            valueColor={kpis.projects_at_risk > 0 ? C.red : C.green}
            icon={<WarningAmberIcon sx={{ fontSize: 18 }} />}
            color={C.red} bg={C.redL}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Late deliverables"
            value={kpis.deliverables_late}
            sub={`${kpis.blocked_deliverables} blocked by a dependency`}
            valueColor={kpis.deliverables_late > 0 ? C.red : C.green}
            icon={<TaskAltIcon sx={{ fontSize: 18 }} />}
            color={C.indigo} bg={C.indigoL}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="People over capacity"
            value={kpis.resources_over_allocated}
            sub={`${kpis.utilization_pct}% capacity used · ${kpis.resources_unassigned} unassigned`}
            valueColor={kpis.resources_over_allocated > 0 ? C.amber : C.green}
            icon={<PeopleIcon sx={{ fontSize: 18 }} />}
            color={C.amber} bg={C.amberL}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Budget remaining"
            value={fmtMoney(kpis.budget_remaining)}
            sub={`${kpis.budget_used_pct}% of ${fmtMoney(kpis.budget_allocated)} spent`}
            valueColor={Number(kpis.budget_remaining) < 0 ? C.red : C.green}
            icon={<PaidIcon sx={{ fontSize: 18 }} />}
            color={C.teal} bg={C.tealL}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Panel
            title="Needs attention"
            subtitle="Projects, deliverables and people ranked by severity — worst first"
            action={
              <Chip
                size="small"
                label={`${attention.length} open`}
                sx={{
                  bgcolor: attention.length ? C.redL : C.greenL,
                  color: attention.length ? C.red : C.green,
                }}
              />
            }
          >
            {attention.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing needs attention right now.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {attention.slice(0, 10).map((item) => {
                  const sev = SEVERITY[item.severity] || SEVERITY.medium;
                  const { Icon, label: kindLabel } = KIND[item.kind] || KIND.project;
                  const target = item.project_id ? `/projects/${item.project_id}` : "/resources";
                  return (
                    <Stack
                      key={item.key}
                      direction="row" spacing={1.5} alignItems="flex-start"
                      onClick={() => navigate(target)}
                      sx={{ cursor: "pointer", p: 1.25, borderRadius: 2, "&:hover": { bgcolor: C.panel } }}
                    >
                      <Box sx={{ width: 4, alignSelf: "stretch", borderRadius: 3, bgcolor: sev.color }} />
                      <MuiTooltip title={kindLabel}>
                        <Icon sx={{ fontSize: 17, color: C.muted, mt: 0.25 }} />
                      </MuiTooltip>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" fontWeight={700}>{item.title}</Typography>
                          <Chip size="small" label={sev.label} sx={{ bgcolor: sev.bg, color: sev.color }} />
                          <Typography variant="caption" color="text.secondary">{item.context}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                          {item.reasons.map((reason) => (
                            <Chip
                              key={reason} size="small" label={reason}
                              sx={{ bgcolor: C.panel, color: C.muted }}
                            />
                          ))}
                        </Stack>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {item.owner || "No owner"}
                        </Typography>
                        <Typography sx={{ fontFamily: mono, fontSize: 11 }}>
                          {item.due ? fmtDate(item.due) : "—"}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
                {attention.length > 10 && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1.25 }}>
                    Showing the 10 most severe of {attention.length}.
                  </Typography>
                )}
              </Stack>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Panel title="Portfolio at a glance">
            <Stack spacing={2}>
              <Box>
                {/* 2px gaps carry the segment boundaries, so the labelled legend
                    below — not colour alone — is what identifies each status. */}
                <Stack direction="row" spacing="2px" sx={{ height: 10, mb: 1.5 }}>
                  {statusBar.map((row) => (
                    <Box
                      key={row.status}
                      sx={{
                        flexGrow: row.count, borderRadius: 0.5,
                        bgcolor: STATUS_COLORS[row.status] || C.faint,
                      }}
                    />
                  ))}
                </Stack>
                <Stack spacing={0.75}>
                  {statusBar.map((row) => (
                    <Stack key={row.status} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{
                          width: 10, height: 10, borderRadius: 0.5,
                          bgcolor: STATUS_COLORS[row.status] || C.faint,
                        }} />
                        <Typography variant="body2" color="text.secondary">
                          {STATUS_LABELS[row.status] || row.status}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={700}>
                        {row.count}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {" "}/ {statusTotal}
                        </Typography>
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>

              <Box sx={{ pt: 2, borderTop: `1px solid ${C.borderSoft}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Deliverables done</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {kpis.deliverables_done} of {kpis.deliverables_total}
                  </Typography>
                </Stack>
                <ProgressBar value={kpis.deliverables_done_pct} color={C.indigo} height={8} />
              </Box>

              <Box sx={{ pt: 2, borderTop: `1px solid ${C.borderSoft}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Weekly labour cost</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: mono }}>
                    {fmtMoney(kpis.weekly_labor_cost)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {fmtMoney(kpis.projected_labor_cost)} projected to current end dates
                </Typography>
              </Box>
            </Stack>
          </Panel>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Panel title="Budget by project" subtitle="Allocated vs spent on live projects">
            <Box sx={{ height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={budgetChart} layout="vertical" barGap={2}
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(24,32,46,0.07)" horizontal={false} />
                  <XAxis
                    type="number" tick={axisTick}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis type="category" dataKey="name" width={120} tick={axisTick} />
                  <Tooltip
                    contentStyle={tooltipStyle} cursor={{ fill: "rgba(24,32,46,0.04)" }}
                    formatter={(value) => fmtMoney(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Allocated" fill={C.indigo} radius={4} barSize={9} />
                  <Bar dataKey="Spent" fill={C.teal} radius={4} barSize={9} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            {budgetChart.length === CHART_ROWS && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Showing the {CHART_ROWS} largest budgets. Full list on the Budget page.
              </Typography>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Panel title="Deliverables by project" subtitle="Where each live project stands">
            <Box sx={{ height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                {/* Done and Late are never adjacent — Open sits between them, so the
                    red/green pair is not the thing a colourblind reader has to split. */}
                <BarChart
                  data={deliveryChart} layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(24,32,46,0.07)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} />
                  <YAxis type="category" dataKey="name" width={120} tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(24,32,46,0.04)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Done" stackId="d" fill={C.green} barSize={14} />
                  <Bar dataKey="Open" stackId="d" fill={C.indigo} barSize={14} />
                  <Bar dataKey="Late" stackId="d" fill={C.red} barSize={14} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            {deliveryChart.length === CHART_ROWS && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Showing the {CHART_ROWS} projects with the most slipped deliverables.
              </Typography>
            )}
          </Panel>
        </Grid>
      </Grid>

      <Panel title="Next milestones" subtitle="Nearest deliverables across the portfolio">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Deliverable", "Project", "Owner", "Due", "Status"].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {upcoming_deliverables.map((d) => (
                <TableRow
                  key={d.deliverable_id} hover
                  onClick={() => navigate(`/projects/${d.project_id}`)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{d.project_name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{d.owner_name || "—"}</TableCell>
                  <TableCell sx={{ fontFamily: mono }}>{fmtDate(d.expected_date)}</TableCell>
                  <TableCell><StatusChip status={d.display_status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    </Stack>
  );
}
