import { useUserRole } from "../hooks/useUserRole";

/**
 * RoleBasedAccess Component
 * Renders content based on user role
 * 
 * Usage:
 * <RoleBasedAccess roles={["superadmin", "admin"]}>
 *   <AdminPanel />
 * </RoleBasedAccess>
 */
export const RoleBasedAccess = ({ 
  children, 
  roles = [], 
  fallback = null,
  requireAll = false 
}) => {
  const { userRole, loading } = useUserRole();

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  if (!userRole) {
    return fallback || <div>Access Denied: No role assigned</div>;
  }

  // Check if user has required role(s)
  const hasAccess = requireAll
    ? roles.every(role => role === userRole)
    : roles.includes(userRole);

  if (!hasAccess) {
    return fallback || <div>Access Denied: Insufficient permissions</div>;
  }

  return children;
};

/**
 * SuperAdminOnly Component
 * Renders content only for super admin users
 */
export const SuperAdminOnly = ({ children, fallback = null }) => {
  return (
    <RoleBasedAccess roles={["superadmin"]} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
};

/**
 * AdminOnly Component
 * Renders content for both admin and super admin
 */
export const AdminOnly = ({ children, fallback = null }) => {
  return (
    <RoleBasedAccess roles={["admin", "superadmin"]} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
};

/**
 * UserOnly Component
 * Renders content only for regular users
 */
export const UserOnly = ({ children, fallback = null }) => {
  return (
    <RoleBasedAccess roles={["user"]} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
};
