import { Box, CircularProgress, Skeleton, Stack, Typography } from "@mui/material";

export function Spinner({ label = "Loading..." }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 8 }}>
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export function CardSkeletons({ count = 4 }) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={180} />
      ))}
    </Stack>
  );
}
