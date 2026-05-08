import { usePermissions } from "../utils/permissions";
import PermissionGuard, { PermissionList, RoleInfo } from "./PermissionGuard";
import "./AccessControlDemo.css";

/**
 * AccessControlDemo Component
 * Shows examples of how to use the permission system
 * This is a helpful reference for developers
 */
export default function AccessControlDemo() {
  const { role, can, canAny, permissions } = usePermissions();

  return (
    <div className="access-control-demo">
      <div className="demo-container">
        <h1>🔐 Access Control Demo</h1>
        <p className="intro-text">
          This page demonstrates how to use the role-based access control system.
        </p>

        {/* Current User Role */}
        <section className="demo-section">
          <h2>Your Role & Permissions</h2>
          <RoleInfo />
        </section>

        {/* All Permissions */}
        <section className="demo-section">
          <h2>Detailed Permissions</h2>
          <PermissionList />
        </section>

        {/* Example 1: Simple Permission Check */}
        <section className="demo-section">
          <h2>Example 1: Simple Permission Check</h2>
          <div className="demo-code">
            <pre>{`const { can } = usePermissions();

if (can("viewAllUsers")) {
  // Show admin features
} else {
  // Show user features
}`}</pre>
          </div>
          <div className="demo-output">
            {can("viewAllUsers") ? (
              <div className="output-success">
                ✅ You CAN view all users
              </div>
            ) : (
              <div className="output-error">
                ❌ You CANNOT view all users
              </div>
            )}
          </div>
        </section>

        {/* Example 2: Multiple Permissions */}
        <section className="demo-section">
          <h2>Example 2: Check Multiple Permissions</h2>
          <div className="demo-code">
            <pre>{`const { canAny } = usePermissions();

if (canAny(["changeUserRole", "deleteUsers"])) {
  // Show admin controls
}`}</pre>
          </div>
          <div className="demo-output">
            {canAny(["changeUserRole", "deleteUsers"]) ? (
              <div className="output-success">
                ✅ You have admin control permissions
              </div>
            ) : (
              <div className="output-error">
                ❌ You don't have admin control permissions
              </div>
            )}
          </div>
        </section>

        {/* Example 3: PermissionGuard Component */}
        <section className="demo-section">
          <h2>Example 3: Using PermissionGuard Component</h2>
          <div className="demo-code">
            <pre>{`<PermissionGuard
  require="manageUsers"
  fallback={<div>Access Denied</div>}
>
  <UserManagement />
</PermissionGuard>`}</pre>
          </div>
          <div className="demo-output">
            <PermissionGuard
              require="manageUsers"
              fallback={<div className="output-error">❌ Access Denied - You cannot manage users</div>}
              showWarning={true}
            >
              <div className="output-success">
                ✅ You can manage users! (This content is protected)
              </div>
            </PermissionGuard>
          </div>
        </section>

        {/* Example 4: Access Levels */}
        <section className="demo-section">
          <h2>Example 4: Understanding Access Levels</h2>
          <div className="access-level-table">
            <div className="table-row header">
              <div className="table-cell">Feature</div>
              <div className="table-cell">User</div>
              <div className="table-cell">Admin</div>
              <div className="table-cell">SuperAdmin</div>
            </div>
            <div className="table-row">
              <div className="table-cell">Upload Proposals</div>
              <div className="table-cell">✅</div>
              <div className="table-cell">✅</div>
              <div className="table-cell">✅</div>
            </div>
            <div className="table-row">
              <div className="table-cell">View All Proposals</div>
              <div className="table-cell">❌</div>
              <div className="table-cell">✅</div>
              <div className="table-cell">✅</div>
            </div>
            <div className="table-row">
              <div className="table-cell">Manage Users</div>
              <div className="table-cell">❌</div>
              <div className="table-cell">❌</div>
              <div className="table-cell">✅</div>
            </div>
            <div className="table-row">
              <div className="table-cell">Change User Roles</div>
              <div className="table-cell">❌</div>
              <div className="table-cell">❌</div>
              <div className="table-cell">✅</div>
            </div>
          </div>
        </section>

        {/* Example 5: Conditional Rendering */}
        <section className="demo-section">
          <h2>Example 5: Conditional UI Rendering</h2>
          <div className="demo-code">
            <pre>{`export default function Dashboard() {
  const { role } = usePermissions();

  return (
    <div>
      <h1>Dashboard</h1>
      
      {role === "user" && <UserDashboard />}
      {role === "admin" && <AdminDashboard />}
      {role === "superadmin" && <SuperAdminDashboard />}
    </div>
  );
}`}</pre>
          </div>
          <div className="demo-output">
            <div className="current-role">
              Currently rendering as: <strong>{role}</strong>
            </div>
            {role === "user" && <div className="output-info">👤 User Dashboard</div>}
            {role === "admin" && <div className="output-success">👮 Admin Dashboard</div>}
            {role === "superadmin" && <div className="output-success">👑 SuperAdmin Dashboard</div>}
          </div>
        </section>

        {/* How to Use Guide */}
        <section className="demo-section usage-guide">
          <h2>📖 How to Use in Your Components</h2>
          
          <div className="usage-item">
            <h3>1. Import the hook</h3>
            <code>import { usePermissions } from "../utils/permissions";</code>
          </div>

          <div className="usage-item">
            <h3>2. Use in your component</h3>
            <code>{`const { can, canAll, canAny, role } = usePermissions();`}</code>
          </div>

          <div className="usage-item">
            <h3>3. Check permissions</h3>
            <code>{`if (can("manageUsers")) { ... }`}</code>
          </div>

          <div className="usage-item">
            <h3>Or use PermissionGuard component</h3>
            <code>{`<PermissionGuard require="manageUsers">
  <AdminFeature />
</PermissionGuard>`}</code>
          </div>
        </section>

        {/* Role Hierarchy */}
        <section className="demo-section">
          <h2>🏛️ Role Hierarchy</h2>
          <div className="hierarchy">
            <div className="hierarchy-level level-3">
              <div className="level-badge">3</div>
              <div className="level-content">
                <strong>SuperAdmin</strong>
                <p>Full system access</p>
              </div>
            </div>
            <div className="hierarchy-arrow">↓</div>
            <div className="hierarchy-level level-2">
              <div className="level-badge">2</div>
              <div className="level-content">
                <strong>Admin</strong>
                <p>Broad content access</p>
              </div>
            </div>
            <div className="hierarchy-arrow">↓</div>
            <div className="hierarchy-level level-1">
              <div className="level-badge">1</div>
              <div className="level-content">
                <strong>User</strong>
                <p>Basic access</p>
              </div>
            </div>
          </div>
        </section>

        {/* Key Functions */}
        <section className="demo-section">
          <h2>🔧 Available Functions</h2>
          <div className="functions-list">
            <div className="function-item">
              <code>can(permission)</code>
              <p>Check single permission</p>
            </div>
            <div className="function-item">
              <code>canAll(permissions)</code>
              <p>Check all permissions required</p>
            </div>
            <div className="function-item">
              <code>canAny(permissions)</code>
              <p>Check if has any permission</p>
            </div>
            <div className="function-item">
              <code>isAdmin</code>
              <p>Check if admin or higher</p>
            </div>
            <div className="function-item">
              <code>level</code>
              <p>Get permission level (0-2)</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
