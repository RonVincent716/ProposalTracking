import { usePermissions } from "../utils/permissions";
import "./PermissionGuard.css";

/**
 * PermissionGuard Component
 * Shows different UI based on user permissions
 * 
 * Usage:
 * <PermissionGuard
 *   require="viewAllUsers"
 *   fallback={<div>You don't have permission</div>}
 * >
 *   <UsersList />
 * </PermissionGuard>
 */
export default function PermissionGuard({
  children,
  require = null,
  requireAll = null,
  requireAny = null,
  fallback = null,
  showWarning = false
}) {
  const { can, canAll, canAny, loading, role } = usePermissions();

  if (loading) {
    return <div className="permission-loading">Loading permissions...</div>;
  }

  let hasAccess = true;

  // Check single permission
  if (require) {
    hasAccess = can(require);
  }

  // Check all permissions
  if (requireAll && requireAll.length > 0) {
    hasAccess = canAll(requireAll);
  }

  // Check any permission
  if (requireAny && requireAny.length > 0) {
    hasAccess = canAny(requireAny);
  }

  if (!hasAccess) {
    if (showWarning) {
      return (
        <div className="permission-warning">
          <div className="permission-warning-content">
            <span className="permission-icon">⚠️</span>
            <div>
              <strong>Access Denied</strong>
              <p>Your current role ({role}) does not have permission to access this feature.</p>
            </div>
          </div>
        </div>
      );
    }

    return fallback || <div className="permission-denied">Access Denied</div>;
  }

  return children;
}

/**
 * PermissionList Component
 * Display all permissions for current user
 */
export function PermissionList() {
  const { permissions, role } = usePermissions();

  return (
    <div className="permission-list">
      <h3>Permissions for {role}</h3>
      <ul>
        {Object.entries(permissions).map(([key, value]) => (
          <li key={key} className={value ? "granted" : "denied"}>
            <span className="permission-icon">{value ? "✅" : "❌"}</span>
            <span className="permission-name">{key}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * RoleInfo Component
 * Display current user's role and basic info
 */
export function RoleInfo() {
  const { role, loading, level } = usePermissions();

  if (loading) return <div>Loading...</div>;

  const roleColors = {
    user: "#95a5a6",
    admin: "#4ecdc4",
    superadmin: "#ff6b6b"
  };

  const roleDescriptions = {
    user: "Regular user with basic access",
    admin: "Administrator with broad access to content",
    superadmin: "Super Administrator with full system access"
  };

  return (
    <div className="role-info">
      <div
        className="role-badge"
        style={{ background: roleColors[role] }}
      >
        {role.toUpperCase()}
      </div>
      <div className="role-details">
        <strong>{role.charAt(0).toUpperCase() + role.slice(1)}</strong>
        <p>{roleDescriptions[role]}</p>
        <small>Permission Level: {level}/2</small>
      </div>
    </div>
  );
}
