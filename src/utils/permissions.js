import { useUserRole } from "../hooks/useUserRole";

/**
 * Permission Check Utilities
 * Use these functions to check if a user can perform specific actions
 */

// Define all permissions for each role
const PERMISSIONS = {
  user: {
    // Proposals
    uploadProposal: true,
    viewOwnProposals: false,
    editOwnProposals: false,
    deleteOwnProposals: false,
    viewOthersProposals: false,
    deleteOthersProposals: false,
    
    // Analytics
    viewOwnAnalytics: false,
    viewAllAnalytics: false,
    
    // Users
    viewAllUsers: false,
    manageUsers: false,
    changeUserRole: false,
    deleteUsers: false,
    viewUserActivity: false,
    
    // Admin features
    accessAdminDashboard: false,
    viewAdminDiscussions: false,
  },
  admin: {
    // Proposals
    uploadProposal: true,
    viewOwnProposals: true,
    editOwnProposals: true,
    deleteOwnProposals: true,
    viewOthersProposals: true,
    deleteOthersProposals: true,
    
    // Analytics
    viewOwnAnalytics: true,
    viewAllAnalytics: true,
    
    // Users
    viewAllUsers: false,
    manageUsers: false,
    changeUserRole: false,
    deleteUsers: false,
    viewUserActivity: true,
    
    // Admin features
    accessAdminDashboard: true,
    viewAdminDiscussions: true,
  },
  superadmin: {
    // Proposals
    uploadProposal: true,
    viewOwnProposals: true,
    editOwnProposals: true,
    deleteOwnProposals: true,
    viewOthersProposals: true,
    deleteOthersProposals: true,
    
    // Analytics
    viewOwnAnalytics: true,
    viewAllAnalytics: true,
    
    // Users
    viewAllUsers: true,
    manageUsers: true,
    changeUserRole: true,
    deleteUsers: true,
    viewUserActivity: true,
    
    // Admin features
    accessAdminDashboard: true,
    viewAdminDiscussions: true,
  }
};

/**
 * Check if a user has a specific permission
 * @param {string} role - User role (user, admin, superadmin)
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !PERMISSIONS[role]) return false;
  return PERMISSIONS[role][permission] || false;
}

/**
 * Check if user has any of the specified permissions
 * @param {string} role - User role
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean}
 */
export function hasAnyPermission(role, permissions) {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if user has all of the specified permissions
 * @param {string} role - User role
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean}
 */
export function hasAllPermissions(role, permissions) {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Check if user has admin or higher role
 */
export function isAdminOrHigher(role) {
  return role === "admin" || role === "superadmin";
}

/**
 * Check if user is only a regular user
 */
export function isRegularUser(role) {
  return role === "user";
}

/**
 * Get user's permission level (0=user, 1=admin, 2=superadmin)
 */
export function getPermissionLevel(role) {
  const levels = {
    "user": 0,
    "admin": 1,
    "superadmin": 2
  };
  return levels[role] || 0;
}

/**
 * Check if user can perform action on target user
 * (e.g., can they delete/edit this user?)
 */
export function canManageUser(userRole, targetUserRole) {
  const userLevel = getPermissionLevel(userRole);
  const targetLevel = getPermissionLevel(targetUserRole);
  
  // Only superadmin can manage users, and only if target is lower level
  return userRole === "superadmin" && targetLevel < getPermissionLevel("superadmin");
}

/**
 * Hook to use permissions in components
 */
export function usePermissions() {
  const { role, loading } = useUserRole();

  return {
    role,
    loading,
    can: (permission) => hasPermission(role, permission),
    canAny: (permissions) => hasAnyPermission(role, permissions),
    canAll: (permissions) => hasAllPermissions(role, permissions),
    isAdmin: isAdminOrHigher(role),
    isRegular: isRegularUser(role),
    level: getPermissionLevel(role),
    canManage: (targetRole) => canManageUser(role, targetRole),
    permissions: PERMISSIONS[role] || {}
  };
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role) {
  return PERMISSIONS[role] || {};
}

/**
 * Get human-readable permission name
 */
export function getPermissionLabel(permission) {
  const labels = {
    uploadProposal: "Upload Proposals",
    viewOwnProposals: "View Own Proposals",
    editOwnProposals: "Edit Own Proposals",
    deleteOwnProposals: "Delete Own Proposals",
    viewOthersProposals: "View Others' Proposals",
    deleteOthersProposals: "Delete Others' Proposals",
    viewOwnAnalytics: "View Own Analytics",
    viewAllAnalytics: "View All Analytics",
    viewAllUsers: "View All Users",
    manageUsers: "Manage Users",
    changeUserRole: "Change User Roles",
    deleteUsers: "Delete Users",
    accessAdminDashboard: "Access Admin Dashboard",
    viewAdminDiscussions: "View Admin Discussions",
  };
  return labels[permission] || permission;
}
