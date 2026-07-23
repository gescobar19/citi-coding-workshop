import { useMemo, useState } from "react";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "react-router-dom";
import { useDirectory, useProjects } from "../services/useApi.js";
import { useAuth } from "../services/auth.jsx";
import { getProjectColor, C } from "../services/theme.js";
import { displayStatus, STATUS_LABELS } from "../services/format.js";
import ProjectCard from "../components/ProjectCard";
import ProjectFormDialog from "../components/ProjectFormDialog";
import SearchField from "../components/SearchField";
import { CardSkeletons } from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";

const FILTERS = ["all", "not_started", "in_progress", "late", "finished"];

export default function ProjectsListPage() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);

  // 'late' is derived, so it can't be filtered server-side; fetch all and
  // filter client-side for that one case.
  const serverStatus = statusFilter === "late" ? undefined : statusFilter;
  const { data: projects, loading, error, refetch } = useProjects(serverStatus);
  const { data: directory = [] } = useDirectory();

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = search.toLowerCase();
    return projects.filter((p) => {
      const matchSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        String(p.project_id).includes(q);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "late"
          ? displayStatus(p) === "late" || p.has_late_deliverables
          : p.status === statusFilter);
      return matchSearch && matchStatus;
    });
  }, [projects, search, statusFilter]);

  const lateCount = projects?.filter((p) => p.has_late_deliverables).length || 0;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box>
          <Typography variant="h1">Projects</Typography>
          <Typography variant="body2" color="text.secondary">
            {projects ? `${projects.length} projects · ${lateCount} with late deliverables` : "Loading…"}
          </Typography>
        </Box>
        {canEdit && (
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
            sx={{ bgcolor: C.sidebar, "&:hover": { bgcolor: "#2A3048" }, whiteSpace: "nowrap" }}
          >
            New project
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Box sx={{ flex: 1 }}>
          <SearchField
            value={search} onChange={setSearch}
            placeholder="Search projects by name, ID, or description…"
          />
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {FILTERS.map((s) => (
            <Button
              key={s} size="small"
              variant={statusFilter === s ? "contained" : "outlined"}
              onClick={() => setStatusFilter(s)}
              sx={{
                fontSize: 12,
                ...(statusFilter === s
                  ? { bgcolor: "#1E2235", "&:hover": { bgcolor: "#2A3048" } }
                  : { color: "text.secondary", borderColor: "divider", bgcolor: "#fff" }),
              }}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </Button>
          ))}
        </Stack>
      </Stack>

      {error && <ErrorState error={error} onRetry={refetch} />}
      {loading && !error && <CardSkeletons count={4} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="No projects found"
          subtitle={canEdit ? "Try adjusting your search, or create a new project." : "Try adjusting your search or filter."}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <Grid container spacing={2}>
          {filtered.map((p, i) => (
            <Grid size={{ xs: 12, lg: 6 }} key={p.project_id}>
              <ProjectCard
                project={p}
                color={getProjectColor(i)}
                onClick={() => navigate(`/projects/${p.project_id}`)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <ProjectFormDialog
        open={formOpen}
        resources={directory}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />
    </Stack>
  );
}
