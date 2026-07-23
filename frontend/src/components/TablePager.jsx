import { TablePagination } from "@mui/material";
import { C } from "../services/theme.js";

/**
 * Pagination footer, styled once so every table and card grid gets the same
 * control. Spread the `pagerProps` returned by usePagination into it.
 */
export default function TablePager({ label = "Rows per page:", ...props }) {
  return (
    <TablePagination
      component="div"
      labelRowsPerPage={label}
      {...props}
      sx={{
        borderTop: `1px solid ${C.borderSoft}`,
        "& .MuiTablePagination-toolbar": { minHeight: 48, px: 2 },
        "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
          fontSize: 12,
          color: C.muted,
          margin: 0,
        },
        "& .MuiTablePagination-select": { fontSize: 12 },
      }}
    />
  );
}
