import { Box, Paper, Typography } from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";

export default function EmptyState({ title = "Nothing found", subtitle, icon }) {
  return (
    <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
      <Box sx={{ color: "text.disabled", mb: 1.5 }}>
        {icon || <SearchOffIcon sx={{ fontSize: 32 }} />}
      </Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    </Paper>
  );
}
