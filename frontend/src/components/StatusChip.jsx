import { Chip } from "@mui/material";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BlockIcon from "@mui/icons-material/Block";
import { C } from "../services/theme.js";
import { STATUS_LABELS } from "../services/format.js";

const CFG = {
  not_started: { color: C.muted,  bg: C.panel,   Icon: CircleOutlinedIcon },
  in_progress: { color: C.indigo, bg: C.indigoL, Icon: AccessTimeIcon },
  late:        { color: C.red,    bg: C.redL,    Icon: WarningAmberIcon },
  finished:    { color: C.green,  bg: C.greenL,  Icon: CheckCircleOutlineIcon },
  cancelled:   { color: C.faint,  bg: C.panel,   Icon: BlockIcon },
};

export default function StatusChip({ status, size = "small", showIcon = true }) {
  const cfg = CFG[status] || CFG.not_started;
  const { Icon } = cfg;
  return (
    <Chip
      size={size}
      icon={showIcon ? <Icon sx={{ fontSize: 14, color: `${cfg.color} !important` }} /> : undefined}
      label={STATUS_LABELS[status] || status}
      sx={{
        color: cfg.color,
        bgcolor: cfg.bg,
        border: "none",
        "& .MuiChip-label": { px: 1 },
      }}
    />
  );
}
