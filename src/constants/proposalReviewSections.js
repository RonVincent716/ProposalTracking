export const PROPOSAL_REVIEW_SECTIONS = [
  {
    key: "pricing",
    title: "Pricing",
    description: "Review the total price, line items, discounts, and cost assumptions."
  },
  {
    key: "scope",
    title: "Scope Of Work",
    description: "Confirm the work being delivered matches the client expectation."
  },
  {
    key: "deliverables",
    title: "Deliverables",
    description: "Check the documents, files, services, or outputs promised in the proposal."
  },
  {
    key: "timeline",
    title: "Timeline",
    description: "Review milestones, deadlines, launch dates, and delivery schedule."
  },
  {
    key: "payment_terms",
    title: "Payment Terms",
    description: "Confirm deposit requirements, schedules, and due dates are acceptable."
  },
  {
    key: "terms_conditions",
    title: "Terms And Conditions",
    description: "Review legal terms, responsibilities, exclusions, and limitations."
  },
  {
    key: "support",
    title: "Warranty Or Support",
    description: "Review any post-delivery support, maintenance, or warranty coverage."
  },
  {
    key: "other_notes",
    title: "Additional Notes",
    description: "Use this section for any other approvals, concerns, or negotiation points."
  }
];

export const buildDefaultProposalFeedbackItems = () =>
  PROPOSAL_REVIEW_SECTIONS.map((section) => ({
    sectionKey: section.key,
    sectionTitle: section.title,
    clientDecision: "",
    clientComment: "",
    adminReply: "",
    itemStatus: "open"
  }));
