// Where the API lives. bin/generate-env.sh writes both of these into
// .env.local; the fallback is a FastAPI app run directly with uvicorn.
// See frontend/.env.example for the two supported setups.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Service prefix for the Lambda CORS proxy route (/api/fastapi-service).
// Empty when talking to FastAPI directly.
const PREFIX = import.meta.env.VITE_API_PREFIX || "";

// The signed-in user, echoed to the backend on every call so it can enforce
// role-based access control (writes are administrator-only).
let authUser = null;

export function setAuthUser(user) {
  authUser = user;
}

function authHeaders() {
  if (!authUser) return {};
  return {
    "X-User-Id": String(authUser.user_id ?? ""),
    "X-User-Role": authUser.role ?? "executive",
  };
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // Keep status text when the body is not JSON.
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

/**
 * Try each path in order, falling through only on 404.
 * Covers three deployments without config changes:
 *   - Lambda proxy:  /api/fastapi-service/projects
 *   - Vite proxy:    /api/projects
 *   - Direct uvicorn: /projects  (if router has no prefix)
 */
async function requestWithFallback(paths, options = {}) {
  let lastError;
  for (const path of paths) {
    try {
      return await request(path, options);
    } catch (error) {
      if (error?.status !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError || new ApiError("Request failed", 500);
}

// When PREFIX is configured the route is known, so use it alone — the
// fallbacks would turn a genuine 404 into whatever the next path returns.
const routes = (suffix) =>
  PREFIX ? [`${PREFIX}${suffix}`] : [`/api${suffix}`, suffix];

const send = (suffix, method, body) =>
  requestWithFallback(routes(suffix), {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

export const api = {
  health: () => requestWithFallback(routes("/health")),

  login: (email, password) => send("/auth/login", "POST", { email, password }),

  // --- Dashboard ---------------------------------------------------
  getDashboard: () => requestWithFallback(routes("/dashboard/summary")),

  // --- Projects ----------------------------------------------------
  listProjects: (status) => {
    const qs = status && status !== "all" ? `?status=${status}` : "";
    return requestWithFallback(routes(`/projects${qs}`));
  },
  getProject: (id) => requestWithFallback(routes(`/projects/${id}`)),
  createProject: (payload) => send("/projects", "POST", payload),
  updateProject: (id, payload) => send(`/projects/${id}`, "PUT", payload),
  deleteProject: (id) => send(`/projects/${id}`, "DELETE"),

  // --- Resources (employees) ---------------------------------------
  listResources: () => requestWithFallback(routes("/resources")),
  listOverAllocated: () => requestWithFallback(routes("/resources/over-allocated")),
  listDirectory: () => requestWithFallback(routes("/resources/directory")),
  createResource: (payload) => send("/resources", "POST", payload),
  updateResource: (id, payload) => send(`/resources/${id}`, "PUT", payload),
  deleteResource: (id) => send(`/resources/${id}`, "DELETE"),

  // --- Allocations (employees assigned to a project) ---------------
  listAllocations: (projectId) =>
    requestWithFallback(
      routes(projectId ? `/allocations?project_id=${projectId}` : "/allocations")
    ),
  createAllocation: (payload) => send("/allocations", "POST", payload),
  updateAllocation: (id, payload) => send(`/allocations/${id}`, "PUT", payload),
  deleteAllocation: (id) => send(`/allocations/${id}`, "DELETE"),

  // --- Budgets -----------------------------------------------------
  getBudgetSummary: () => requestWithFallback(routes("/budgets/summary")),
  listBudgets: (projectId) =>
    requestWithFallback(
      routes(projectId ? `/budgets?project_id=${projectId}` : "/budgets")
    ),
  createBudget: (payload) => send("/budgets", "POST", payload),
  updateBudget: (id, payload) => send(`/budgets/${id}`, "PUT", payload),
  deleteBudget: (id) => send(`/budgets/${id}`, "DELETE"),

  // --- Deliverables ------------------------------------------------
  listDeliverables: (projectId) =>
    requestWithFallback(
      routes(projectId ? `/deliverables?project_id=${projectId}` : "/deliverables")
    ),
  createDeliverable: (payload) => send("/deliverables", "POST", payload),
  updateDeliverable: (id, payload) => send(`/deliverables/${id}`, "PUT", payload),
  deleteDeliverable: (id) => send(`/deliverables/${id}`, "DELETE"),

  // --- Deliverable dependency chain ---------------------------------
  listDependencies: (projectId) =>
    requestWithFallback(
      routes(
        projectId
          ? `/deliverables/dependencies?project_id=${projectId}`
          : "/deliverables/dependencies"
      )
    ),
  listBlockedDeliverables: () => requestWithFallback(routes("/deliverables/blocked")),
  getDependencyChain: (id) => requestWithFallback(routes(`/deliverables/${id}/chain`)),
  addDependency: (id, payload) => send(`/deliverables/${id}/dependencies`, "POST", payload),
  removeDependency: (id, dependsOnId) =>
    send(`/deliverables/${id}/dependencies/${dependsOnId}`, "DELETE"),

  // --- Users (admin console) ---------------------------------------
  listUsers: (role) => requestWithFallback(routes(role ? `/users?role=${role}` : "/users")),
  createUser: (payload) => send("/users", "POST", payload),
  updateUser: (id, payload) => send(`/users/${id}`, "PUT", payload),
  deleteUser: (id) => send(`/users/${id}`, "DELETE"),
};

export { ApiError };
