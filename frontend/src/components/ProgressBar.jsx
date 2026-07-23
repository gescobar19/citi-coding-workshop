import { Box, LinearProgress } from "@mui/material";

export default function ProgressBar({ value = 0, color = "#3B5299", height = 6 }) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Box sx={{ width: "100%" }}>
      <LinearProgress
        variant="determinate"
        value={normalized}
        sx={{
          height,
          borderRadius: height,
          bgcolor: "#ECEDF1",
          "& .MuiLinearProgress-bar": { borderRadius: height, bgcolor: color },
        }}
      />
    </Box>
  );
}
