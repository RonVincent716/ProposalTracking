import { usePermissions } from "../utils/permissions";
import { MdDelete } from "react-icons/md";

/**
 * ProtectedDeleteButton
 * Shows delete button only to users with permission
 * Regular users can only delete their own items
 * Admins/SuperAdmins can delete any item
 */
export default function ProtectedDeleteButton({
  onDelete,
  itemOwnerId,
  currentUserId,
  itemName = "item",
  confirmMessage = "Are you sure you want to delete this?"
}) {
  const { can, role } = usePermissions();

  // Regular users can only delete their own items
  if (role === "user" && itemOwnerId !== currentUserId) {
    return null; // Don't show delete button for others' items
  }

  // Admins and SuperAdmins can delete any item
  // Users can only delete their own
  const canDelete = can("deleteOwnProposals") || can("deleteOthersProposals");

  if (!canDelete) {
    return null;
  }

  const handleDelete = () => {
    if (confirm(confirmMessage)) {
      onDelete();
    }
  };

  return (
    <button
      onClick={handleDelete}
      title={`Delete ${itemName}`}
      style={{
        padding: "8px 12px",
        background: "#e74c3c",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: "13px",
        fontWeight: 500,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#c0392b";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(231, 76, 60, 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#e74c3c";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <MdDelete size={16} />
      Delete
    </button>
  );
}

/**
 * DeleteAccessGuard
 * Guard that prevents non-authorized users from seeing/interacting with delete functionality
 */
export function DeleteAccessGuard({ children, itemOwnerId, currentUserId, role }) {
  const shouldShow = role === "user" 
    ? itemOwnerId === currentUserId 
    : role === "admin" || role === "superadmin";

  if (!shouldShow) {
    return null;
  }

  return children;
}
