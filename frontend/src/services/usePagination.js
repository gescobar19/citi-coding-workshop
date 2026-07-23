import { useEffect, useMemo, useState } from "react";

// 5 is included so pagination is demonstrable against a small seed dataset,
// not only once the tables are realistically full.
export const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];

/**
 * Client-side pagination for a list that is already in memory.
 *
 * The API returns whole collections, so this caps what React renders rather
 * than what is fetched — the win is a table that stays the same size as the
 * directory grows, instead of one row component per employee. Server-side
 * LIMIT/OFFSET is the next step once the data outgrows a single response.
 *
 * @param {Array} rows            the full, already-filtered list
 * @param {number} initialPerPage rows shown per page before the user changes it
 */
export function usePagination(rows, initialPerPage = 10) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialPerPage);

  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  // Typing into a search box shortens the list, which can strand the viewer on
  // a page that no longer exists — page 4 of a result set that now has one
  // page. Step back to the last real page instead of rendering an empty table.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount - 1);

  const paged = useMemo(
    () => rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [rows, safePage, rowsPerPage]
  );

  const pagerProps = {
    count: rows.length,
    page: safePage,
    rowsPerPage,
    rowsPerPageOptions: ROWS_PER_PAGE_OPTIONS,
    onPageChange: (_event, next) => setPage(next),
    onRowsPerPageChange: (event) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
    },
  };

  return { paged, pagerProps };
}
