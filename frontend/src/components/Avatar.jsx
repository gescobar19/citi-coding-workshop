import { Avatar as MuiAvatar, Tooltip } from "@mui/material";

export function initialsOf(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

export default function Avatar({ name, color, size = 28, tooltip = true }) {
  const el = (
    <MuiAvatar
      sx={{
        width: size, height: size,
        fontSize: size * 0.34, fontWeight: 700,
        bgcolor: `${color}20`, color,
      }}
    >
      {initialsOf(name)}
    </MuiAvatar>
  );
  return tooltip ? <Tooltip title={name}>{el}</Tooltip> : el;
}
