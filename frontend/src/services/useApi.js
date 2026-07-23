import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

export function useFetch(fn, deps = []) {
  // Undefined (not null) so `const { data = [] } = useFetch(...)` defaults work
  // while the first request is still in flight.
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fn()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { data, loading, error, refetch: run };
}

export function useProjects(status) {
  return useFetch(() => api.listProjects(status), [status]);
}

export function useProject(id) {
  return useFetch(() => api.getProject(id), [id]);
}

export function useResources() {
  return useFetch(() => api.listResources(), []);
}

export function useDirectory() {
  return useFetch(() => api.listDirectory(), []);
}

export function useDashboard() {
  return useFetch(() => api.getDashboard(), []);
}

export function useBudgetSummary() {
  return useFetch(() => api.getBudgetSummary(), []);
}

export function useUsers() {
  return useFetch(() => api.listUsers(), []);
}

export function useAllDeliverables() {
  return useFetch(() => api.listDeliverables(), []);
}
