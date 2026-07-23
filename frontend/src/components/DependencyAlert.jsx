import { Alert, AlertTitle, Chip, Stack, Typography } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import StatusChip from "./StatusChip";

function blockerName(blocker) {
  return blocker.blocked_by_name || blocker.blocking_project_name || blocker.name || "Unknown project";
}

function blockerStatus(blocker) {
  return blocker.blocker_status || blocker.display_status || blocker.status || "not_started";
}

function blockerKey(blocker, index) {
  return blocker.blocked_by_id || blocker.blocking_project_id || blocker.project_id || index;
}

export default function DependencyAlert({ blockers = [] }) {
  if (blockers.length === 0) return null;

  return (
    <Alert severity="warning" icon={<LinkIcon />} sx={{ borderRadius: 2 }}>
      <AlertTitle sx={{ fontSize: 13, fontWeight: 700 }}>
        Dependency chain: must finish first
      </AlertTitle>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        {blockers.map((blocker, index) => (
          <Chip
            key={blockerKey(blocker, index)}
            size="small"
            label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="caption" fontWeight={600}>{blockerName(blocker)}</Typography>
                <StatusChip status={blockerStatus(blocker)} showIcon={false} />
              </Stack>
            }
            sx={{ bgcolor: "rgba(176,106,32,0.12)", height: "auto", py: 0.5 }}
          />
        ))}
      </Stack>
    </Alert>
  );
}
