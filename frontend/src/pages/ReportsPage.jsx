import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import { C } from "../services/theme.js";

const REPORTS = [
  "Project status summary",
  "Resource allocation summary",
  "Budget variance analysis",
  "Dependency chain overview",
  "Deliverable completion rate",
  "Over-allocation risk report",
];

export default function ReportsPage() {
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h1">Reports</Typography>
        <Typography variant="body2" color="text.secondary">
          Generated views across all projects
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {REPORTS.map((r) => (
          <Grid size={{ xs: 12, md: 4 }} key={r}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5, cursor: "pointer", height: "100%",
                transition: "box-shadow .2s, border-color .2s",
                "&:hover": {
                  boxShadow: "0 2px 12px rgba(24,32,46,0.07)",
                  borderColor: "rgba(24,32,46,0.18)",
                },
              }}
            >
              <Box sx={{
                width: 36, height: 36, borderRadius: 2, mb: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: C.indigoL, color: C.indigo,
              }}>
                <DescriptionIcon sx={{ fontSize: 18 }} />
              </Box>
              <Typography variant="h4" sx={{ mb: 0.5 }}>{r}</Typography>
              <Typography variant="caption" color="text.secondary">
                Not yet implemented
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
