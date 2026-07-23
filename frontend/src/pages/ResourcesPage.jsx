import { useMemo, useState } from "react";
import {
  Alert,
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
import FlagIcon from "@mui/icons-material/Flag";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import { api } from "../api/client.js";
import { useDirectory } from "../services/useApi.js";
import { useAuth } from "../services/auth.jsx";
import { C, mono } from "../services/theme.js";
import { LABOR_RATE, fmtMoney, laborCost } from "../services/format.js";
import Avatar from "../components/Avatar";
import SearchField from "../components/SearchField";
import StatCard from "../components/StatCard";
import TablePager from "../components/TablePager";
import { usePagination } from "../services/usePagination.js";
import ProgressBar from "../components/ProgressBar";
import ResourceDialog from "../components/ResourceDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { Spinner } from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";

export default function ResourcesPage() {
  const { canEdit } = useAuth();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState({ open: false, resource: null });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data: resources = [], loading, error, refetch } = useDirectory();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return resources.filter(
      (r) =>
        !q ||
        (r.resource_name || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.job_title || "").toLowerCase().includes(q)
    );
  }, [resources, search]);

  const { paged, pagerProps } = usePagination(filtered);

  // Counts describe the whole directory, not the visible page — a headline that
  // changed when you turned the page would be measuring the wrong thing.
  const overCount = resources.filter((r) => r.is_over_allocated).length;
  const idleCount = resources.filter((r) => Number(r.allocated_hours) === 0).length;
  const okCount = resources.length - overCount - idleCount;
  const weeklyCost = resources.reduce((sum, r) => sum + laborCost(r.allocated_hours), 0);

  const headers = [
    "Resource", "Department", "Capacity", "Allocated", "Available",
    "Weekly cost", "Projects", "Utilization", "Status",
    ...(canEdit ? ["Actions"] : []),
  ];

  const handleDelete = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.deleteResource(confirm.resource_id);
      setConfirm(null);
      refetch();
    } catch (err) {
      setActionError(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading resources..." />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box>
          <Typography variant="h1">Resources</Typography>
          <Typography variant="body2" color="text.secondary">
            {resources.length} employees · capacity in weekly hours · charged at {fmtMoney(LABOR_RATE)}/hour
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <SearchField value={search} onChange={setSearch} placeholder="Search resources..." width={220} />
          {canEdit && (
            <Button
              variant="contained" startIcon={<AddIcon />}
              onClick={() => setDialog({ open: true, resource: null })}
              sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" }, whiteSpace: "nowrap" }}
            >
              New employee
            </Button>
          )}
        </Stack>
      </Stack>

      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Over-allocated" value={overCount} icon={<FlagIcon sx={{ fontSize: 18 }} />} color={C.amber} bg={C.amberL} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Within capacity" value={okCount} icon={<CheckCircleOutlineIcon sx={{ fontSize: 18 }} />} color={C.green} bg={C.greenL} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Unassigned" value={idleCount} icon={<CircleOutlinedIcon sx={{ fontSize: 18 }} />} color={C.muted} bg={C.panel} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Total weekly cost" value={fmtMoney(weeklyCost)} icon={<FlagIcon sx={{ fontSize: 18 }} />} color={C.purple} bg={C.purpleL} />
        </Grid>
      </Grid>

      {filtered.length === 0 ? (
        <EmptyState title="No resources found" subtitle="Try a different search term." />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>{headers.map((h) => <TableCell key={h}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {paged.map((r) => {
                  const allocated = Number(r.allocated_hours || 0);
                  const capacity = Number(r.weekly_hours || 0);
                  const util = capacity ? Math.round((allocated / capacity) * 100) : 0;
                  const unassigned = allocated === 0;

                  return (
                    <TableRow key={r.resource_id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar name={r.resource_name} color={C.indigo} size={30} tooltip={false} />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{r.resource_name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {r.job_title || "—"}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{r.department || "—"}</TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{capacity}h</TableCell>
                      <TableCell sx={{ fontFamily: mono, fontWeight: 600 }}>{allocated}h</TableCell>
                      <TableCell sx={{ fontFamily: mono, color: Number(r.available_hours) < 0 ? C.red : "text.primary" }}>
                        {Number(r.available_hours)}h
                      </TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{fmtMoney(laborCost(allocated))}</TableCell>
                      <TableCell sx={{ fontFamily: mono }}>{Number(r.project_count || 0)}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" sx={{ fontFamily: mono }}>{util}%</Typography>
                          <ProgressBar value={util} color={r.is_over_allocated ? C.red : util > 80 ? C.amber : C.teal} height={5} />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {r.is_over_allocated ? (
                          <Chip size="small" icon={<FlagIcon sx={{ fontSize: 13 }} />} label="Over-allocated" sx={{ bgcolor: C.amberL, color: C.amber }} />
                        ) : unassigned ? (
                          <Chip size="small" label="Unassigned" sx={{ bgcolor: C.panel, color: C.muted }} />
                        ) : (
                          <Chip size="small" icon={<CheckCircleOutlineIcon sx={{ fontSize: 13 }} />} label="Within capacity" sx={{ bgcolor: C.greenL, color: C.green }} />
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Edit employee">
                              <IconButton size="small" onClick={() => setDialog({ open: true, resource: r })}>
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete employee">
                              <IconButton size="small" onClick={() => setConfirm(r)}>
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
          <TablePager {...pagerProps} label="Employees per page:" />
        </Paper>
      )}

      <ResourceDialog
        open={dialog.open}
        resource={dialog.resource}
        onClose={() => setDialog({ open: false, resource: null })}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete employee"
        message={`Delete ${confirm?.resource_name}? They will be removed from every project they are assigned to.`}
        busy={busy}
        onConfirm={handleDelete}
        onClose={() => setConfirm(null)}
      />
    </Stack>
  );
}
