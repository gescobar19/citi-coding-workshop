import { useState } from "react";
import {
  Alert, Box, Button, Grid, Paper, Stack, Tab, Tabs, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useAllDeliverables, useDirectory, useProject, useResources } from "../services/useApi.js";
import { useAuth } from "../services/auth.jsx";
import { getProjectColor, C, mono } from "../services/theme.js";
import { fmtDate, fmtMoney, displayStatus } from "../services/format.js";
import StatusChip from "../components/StatusChip";
import DependencyAlert from "../components/DependencyAlert";
import ProjectOverview from "../components/ProjectOverview";
import DeliverableTimeline from "../components/DeliverableTimeline";
import TeamTable from "../components/TeamTable";
import BudgetPanel from "../components/BudgetPanel";
import ProjectFormDialog from "../components/ProjectFormDialog";
import AllocationDialog from "../components/AllocationDialog";
import BudgetLineDialog from "../components/BudgetLineDialog";
import DeliverableDialog from "../components/DeliverableDialog";
import DependencyDialog from "../components/DependencyDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { Spinner } from "../components/LoadingState";
import ErrorState from "../components/ErrorState";

const TABS = ["Overview", "Deliverables", "Resources", "Budget"];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [tab, setTab] = useState(0);

  const { data, loading, error, refetch } = useProject(id);
  const { data: resourceLoad, refetch: refetchLoad } = useResources();
  const { data: directory = [] } = useDirectory();
  const { data: allDeliverables = [], refetch: refetchDeliverables } = useAllDeliverables();

  const [editOpen, setEditOpen] = useState(false);
  const [allocationDialog, setAllocationDialog] = useState({ open: false, allocation: null });
  const [budgetDialog, setBudgetDialog] = useState({ open: false, line: null });
  const [deliverableDialog, setDeliverableDialog] = useState({ open: false, deliverable: null });
  const [dependencyDialog, setDependencyDialog] = useState({ open: false, deliverable: null });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const reload = () => {
    refetch();
    refetchLoad();
    refetchDeliverables();
  };

  const runConfirm = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await confirm.action();
      setConfirm(null);
      if (confirm.afterDelete === "back") {
        navigate("/projects");
      } else {
        reload();
      }
    } catch (err) {
      setActionError(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading project…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const { project, team = [], budget = [], deliverables = [], blockers = [], labor } = data;
  const color = getProjectColor(Number(id) - 1);
  const doneCount = deliverables.filter((d) => displayStatus(d) === "finished").length;
  const assignedIds = team.map((m) => m.resource_id);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          startIcon={<ArrowBackIcon />} onClick={() => navigate("/projects")}
          sx={{ color: "text.secondary" }}
        >
          Back to projects
        </Button>

        {canEdit && (
          <Stack direction="row" spacing={1}>
            <Button
              size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 16 }} />}
              onClick={() => setEditOpen(true)}
              sx={{ borderColor: "divider", color: "text.secondary", bgcolor: "#fff" }}
            >
              Edit project
            </Button>
            <Button
              size="small" variant="outlined" startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
              onClick={() =>
                setConfirm({
                  title: "Delete project",
                  message: `Delete "${project.name}"? Its team assignments, budget lines and deliverables are removed too.`,
                  action: () => api.deleteProject(project.project_id),
                  afterDelete: "back",
                })
              }
              sx={{ borderColor: C.redL, color: C.red, bgcolor: "#fff" }}
            >
              Delete
            </Button>
          </Stack>
        )}
      </Stack>

      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
          <Box sx={{ width: 8, height: 48, borderRadius: 4, bgcolor: color, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontFamily: mono, fontSize: 10, color: "text.secondary" }}>
              PRJ-{String(project.project_id).padStart(3, "0")}
            </Typography>
            <Typography variant="h2">{project.name}</Typography>
            {project.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {project.description}
              </Typography>
            )}
          </Box>
          <StatusChip status={displayStatus(project)} />
        </Stack>

        {project.objective && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: C.panel, borderRadius: 2 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
              OBJECTIVE
            </Typography>
            <Typography variant="body2">{project.objective}</Typography>
          </Box>
        )}

        <Box sx={{ mb: 2 }}>
          <DependencyAlert blockers={blockers} />
        </Box>

        <Grid container spacing={1.5}>
          {[
            { label: "Start date", value: fmtDate(project.start_date) },
            { label: "Expected end", value: fmtDate(project.expected_end_date) },
            { label: "Resources", value: `${team.length} people` },
            { label: "Deliverables", value: `${doneCount} of ${deliverables.length} done` },
            { label: "Weekly labour", value: fmtMoney(labor?.weekly_labor_cost || 0) },
            {
              label: "Projected labour",
              value: `${fmtMoney(labor?.projected_labor_cost || 0)}${labor?.duration_weeks ? ` · ${labor.duration_weeks}w` : ""}`,
            },
          ].map(({ label, value }) => (
            <Grid size={{ xs: 6, md: 2 }} key={label}>
              <Box sx={{ bgcolor: C.panel, borderRadius: 2, p: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </Typography>
                <Typography variant="body2" fontWeight={600}>{value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ px: 1 }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          TabIndicatorProps={{ sx: { bgcolor: color, height: 3 } }}
        >
          {TABS.map((t) => (
            <Tab key={t} label={t} sx={{ fontSize: 13, "&.Mui-selected": { color } }} />
          ))}
        </Tabs>
      </Paper>

      {tab === 0 && (
        <ProjectOverview
          project={project} deliverables={deliverables}
          budget={budget} team={team} color={color}
        />
      )}
      {tab === 1 && (
        <DeliverableTimeline
          deliverables={deliverables} color={color} canEdit={canEdit}
          onAdd={() => setDeliverableDialog({ open: true, deliverable: null })}
          onEdit={(deliverable) => setDeliverableDialog({ open: true, deliverable })}
          onDependencies={(deliverable) => setDependencyDialog({ open: true, deliverable })}
          onDelete={(deliverable) =>
            setConfirm({
              title: "Delete deliverable",
              message: `Delete "${deliverable.name}" from this project?`,
              action: () => api.deleteDeliverable(deliverable.deliverable_id),
            })
          }
        />
      )}
      {tab === 2 && (
        <TeamTable
          team={team} color={color} resourceLoad={resourceLoad || []} labor={labor}
          canEdit={canEdit}
          onAdd={() => setAllocationDialog({ open: true, allocation: null })}
          onEdit={(allocation) => setAllocationDialog({ open: true, allocation })}
          onRemove={(allocation) =>
            setConfirm({
              title: "Remove employee",
              message: `Remove ${allocation.resource_name} from this project?`,
              action: () => api.deleteAllocation(allocation.allocation_id),
            })
          }
        />
      )}
      {tab === 3 && (
        <BudgetPanel
          budget={budget} color={color} labor={labor} canEdit={canEdit}
          onAdd={() => setBudgetDialog({ open: true, line: null })}
          onEdit={(line) => setBudgetDialog({ open: true, line })}
          onDelete={(line) =>
            setConfirm({
              title: "Delete budget line",
              message: `Delete the ${line.category} line of ${fmtMoney(line.allocated_amount)}?`,
              action: () => api.deleteBudget(line.budget_id),
            })
          }
        />
      )}

      <ProjectFormDialog
        open={editOpen} project={project} resources={directory}
        onClose={() => setEditOpen(false)} onSaved={reload}
      />

      <AllocationDialog
        open={allocationDialog.open}
        projectId={project.project_id}
        allocation={allocationDialog.allocation}
        resources={directory}
        assignedIds={assignedIds}
        onClose={() => setAllocationDialog({ open: false, allocation: null })}
        onSaved={reload}
      />

      <BudgetLineDialog
        open={budgetDialog.open}
        projectId={project.project_id}
        line={budgetDialog.line}
        onClose={() => setBudgetDialog({ open: false, line: null })}
        onSaved={reload}
      />

      <DeliverableDialog
        open={deliverableDialog.open}
        projectId={project.project_id}
        deliverable={deliverableDialog.deliverable}
        resources={directory}
        onClose={() => setDeliverableDialog({ open: false, deliverable: null })}
        onSaved={reload}
      />

      <DependencyDialog
        open={dependencyDialog.open}
        deliverable={
          deliverables.find(
            (d) => d.deliverable_id === dependencyDialog.deliverable?.deliverable_id
          ) || dependencyDialog.deliverable
        }
        allDeliverables={allDeliverables}
        onClose={() => setDependencyDialog({ open: false, deliverable: null })}
        onSaved={reload}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        busy={busy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </Stack>
  );
}
