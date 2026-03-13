import { 
  MdDrafts, 
  MdSend, 
  MdVisibility, 
  MdCheckCircle, 
  MdEdit,
  MdSchedule,
  MdCancel
} from "react-icons/md";

export default function ProposalStatusBadge({ status, size = "medium" }) {
  const getStatusConfig = (status) => {
    switch(status?.toLowerCase()) {
      case "draft":
        return { 
          color: "#64748b", 
          bg: "#f1f5f9", 
          border: "#cbd5e1",
          icon: MdDrafts, 
          label: "Draft",
          description: "Proposal created but not sent"
        };
      case "sent":
        return { 
          color: "#3b82f6", 
          bg: "#eff6ff", 
          border: "#93c5fd",
          icon: MdSend, 
          label: "Sent",
          description: "Sent to client for review"
        };
      case "viewed":
        return { 
          color: "#8b5cf6", 
          bg: "#f5f3ff", 
          border: "#c4b5fd",
          icon: MdVisibility, 
          label: "Viewed",
          description: "Client has opened the proposal"
        };
      case "signed":
        return { 
          color: "#10b981", 
          bg: "#f0fdf4", 
          border: "#86efac",
          icon: MdCheckCircle, 
          label: "Signed",
          description: "Client has signed the proposal"
        };
      case "completed":
        return { 
          color: "#059669", 
          bg: "#ecfdf5", 
          border: "#6ee7b7",
          icon: MdCheckCircle, 
          label: "Completed",
          description: "All signatures collected"
        };
      case "expired":
        return { 
          color: "#ef4444", 
          bg: "#fef2f2", 
          border: "#fecaca",
          icon: MdCancel, 
          label: "Expired",
          description: "Proposal has expired"
        };
      case "pending":
        return { 
          color: "#f59e0b", 
          bg: "#fffbeb", 
          border: "#fde68a",
          icon: MdSchedule, 
          label: "Pending",
          description: "Awaiting client action"
        };
      default:
        return { 
          color: "#64748b", 
          bg: "#f8fafc", 
          border: "#e2e8f0",
          icon: MdEdit, 
          label: status || "Unknown",
          description: "Status unknown"
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeStyles = {
    small: {
      padding: "2px 8px",
      fontSize: "11px",
      gap: "4px",
      iconSize: 12
    },
    medium: {
      padding: "4px 12px",
      fontSize: "12px",
      gap: "6px",
      iconSize: 14
    },
    large: {
      padding: "6px 16px",
      fontSize: "14px",
      gap: "8px",
      iconSize: 16
    }
  };

  const currentSize = sizeStyles[size] || sizeStyles.medium;

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: currentSize.gap,
      padding: currentSize.padding,
      background: config.bg,
      color: config.color,
      borderRadius: "100px",
      fontSize: currentSize.fontSize,
      fontWeight: "500",
      border: `1px solid ${config.border}`,
      whiteSpace: "nowrap",
      cursor: "help",
      transition: "all 0.2s",
      position: "relative",
      title: config.description
    }}>
      <Icon size={currentSize.iconSize} />
      <span>{config.label}</span>
    </div>
  );
}