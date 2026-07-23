import { Box, Paper, Typography } from "@mui/material";
import { C } from "../services/theme.js";

export default function StatCard({
  label,
  value,
  sub,
  icon,
  color = C.indigo,
  bg = C.indigoL,
  valueColor,
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
      {icon && (
        <Box sx={{
          width: 36, height: 36, borderRadius: 2, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: bg, color,
        }}>
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h2" sx={{ lineHeight: 1.2, color: valueColor }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
