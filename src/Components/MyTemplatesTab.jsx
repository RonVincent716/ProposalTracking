import { useEffect, useMemo, useRef, useState } from "react";
import {
  MdAdd,
  MdArrowBack,
  MdClose,
  MdContentCopy,
  MdDelete,
  MdDescription,
  MdEdit,
  MdFolder,
  MdGridView,
  MdImage,
  MdOutlineStar,
  MdPerson,
  MdRedo,
  MdSave,
  MdSearch,
  MdSend,
  MdTextFields,
  MdUndo,
  MdZoomIn,
  MdZoomOut
} from "react-icons/md";
import { db, storage } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import html2pdf from "html2pdf.js";
import emailjs from "@emailjs/browser";

const categoryOptions = [
  "General",
  "Web Development",
  "Marketing",
  "Branding",
  "Consulting",
  "Operations"
];

const galleryTemplates = [
  {
    id: "gallery-modern-sales",
    name: "Modern Sales Proposal",
    category: "Marketing",
    description: "A polished sales template with strong visual hierarchy.",
    sections: ["Cover", "Executive Summary", "Scope", "Pricing", "Signoff"],
    isFeatured: true,
    accent: "#06b6d4"
  },
  {
    id: "gallery-clean-consulting",
    name: "Consulting Brief",
    category: "Consulting",
    description: "Simple structure for consulting statements of work.",
    sections: ["Cover", "Problem", "Approach", "Timeline", "Investment"],
    isFeatured: false,
    accent: "#4f46e5"
  },
  {
    id: "gallery-creative-branding",
    name: "Brand Strategy Deck",
    category: "Branding",
    description: "Creative-first layout for branding and identity projects.",
    sections: ["Cover", "Brand Goals", "Audience", "Deliverables", "Fees"],
    isFeatured: false,
    accent: "#0f766e"
  }
];

const initialFormState = {
  name: "",
  description: "",
  category: "General",
  tags: "",
  folder: "Templates",
  sections: "Cover\nExecutive Summary\nScope of Work\nTimeline\nPricing\nTerms"
};

const EMAILJS_CONFIG = {
  SERVICE_ID: "service_q6k7l9r",
  TEMPLATE_ID: "template_438lqns",
  PUBLIC_KEY: "UF-7_4AU7Jw9Sdo5P"
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeSections = (rawSections) =>
  rawSections
    .split("\n")
    .map((section) => section.trim())
    .filter(Boolean);

const PAGE_WIDTH = 760;
const PAGE_HEIGHT = 960;

const buildDefaultCanvasElements = () => [
  {
    id: `el-client-${Date.now()}`,
    type: "client_name",
    text: "{client_name}",
    x: 210,
    y: 300,
    fontSize: 54,
    fontWeight: 800,
    color: "#0f172a",
    width: 360
  },
  {
    id: `el-proposal-${Date.now()}`,
    type: "proposal_name",
    text: "{proposal_name}",
    x: 210,
    y: 380,
    fontSize: 44,
    fontWeight: 700,
    color: "#1e293b",
    width: 360
  },
  {
    id: `el-section-${Date.now()}`,
    type: "section_title",
    text: "{section_title}",
    x: 210,
    y: 460,
    fontSize: 24,
    fontWeight: 700,
    color: "#0369a1",
    width: 320
  }
];

export default function MyTemplatesTab({ currentUser }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("saved");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedFolder, setSelectedFolder] = useState("Templates");
  const [folders, setFolders] = useState(["Templates", "Untitled folder"]);
  const [newFolderName, setNewFolderName] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [clientPreviewName, setClientPreviewName] = useState("Client Name");
  const [proposalPreviewName, setProposalPreviewName] = useState("Proposal Name");
  const [canvasElements, setCanvasElements] = useState(buildDefaultCanvasElements);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadTarget, setImageUploadTarget] = useState("new");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [sendingProposal, setSendingProposal] = useState(false);
  const [shareError, setShareError] = useState("");
  const [showProposalSuccessModal, setShowProposalSuccessModal] = useState(false);
  const [proposalSuccessData, setProposalSuccessData] = useState(null);
  const canvasPageRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
  }, []);

  useEffect(() => {
    const templatesQuery = query(
      collection(db, "proposalTemplates"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      templatesQuery,
      (snapshot) => {
        const records = snapshot.docs.map((recordDoc) => {
          const data = recordDoc.data();
          return {
            id: recordDoc.id,
            ...data,
            source: "saved",
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt)
          };
        });
        setTemplates(records);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading templates:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, []);

  const builderSections = useMemo(
    () => normalizeSections(formData.sections || ""),
    [formData.sections]
  );

  useEffect(() => {
    if (selectedSectionIndex >= builderSections.length) {
      setSelectedSectionIndex(Math.max(0, builderSections.length - 1));
    }
  }, [builderSections, selectedSectionIndex]);

  const activeCollection = viewMode === "saved"
    ? templates
    : galleryTemplates.map((template) => ({
        ...template,
        source: "gallery",
        folder: "Templates",
        tags: ["gallery"],
        updatedAt: null
      }));

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = activeCollection.filter((template) => {
      const matchesSearch =
        !normalizedSearch ||
        template.name?.toLowerCase().includes(normalizedSearch) ||
        template.description?.toLowerCase().includes(normalizedSearch) ||
        (template.tags || []).some((tag) =>
          String(tag).toLowerCase().includes(normalizedSearch)
        );

      const matchesCategory =
        categoryFilter === "all" || template.category === categoryFilter;

      const matchesFolder =
        selectedFolder === "Templates" ||
        (template.folder || "Templates") === selectedFolder;

      return matchesSearch && matchesCategory && matchesFolder;
    });

    if (sortBy === "updated") {
      return filtered.sort((a, b) => {
        const aTime = a.updatedAt?.getTime?.() || 0;
        const bTime = b.updatedAt?.getTime?.() || 0;
        return bTime - aTime;
      });
    }

    return filtered.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
  }, [activeCollection, categoryFilter, searchTerm, selectedFolder, sortBy]);

  const ensureFolderExists = (folderName) => {
    if (!folderName) return;
    setFolders((prev) => (prev.includes(folderName) ? prev : [...prev, folderName]));
  };

  const openCreateBuilder = () => {
    setEditingTemplateId(null);
    setFormData({
      ...initialFormState,
      folder: selectedFolder === "Templates" ? "Templates" : selectedFolder
    });
    setClientPreviewName("Client Name");
    setProposalPreviewName("Proposal Name");
    setCanvasElements(buildDefaultCanvasElements());
    setSelectedElementId(null);
    setSelectedSectionIndex(0);
    setBuilderOpen(true);
  };

  const openEditBuilder = (template) => {
    const sections = Array.isArray(template.sections) && template.sections.length
      ? template.sections
      : ["Cover", "Executive Summary", "Scope of Work"];

    const folder = template.folder || "Templates";
    ensureFolderExists(folder);
    setEditingTemplateId(template.source === "saved" ? template.id : null);
    setFormData({
      name: template.name || "",
      description: template.description || "",
      category: template.category || "General",
      tags: (template.tags || []).join(", "),
      folder,
      sections: sections.join("\n")
    });
    setClientPreviewName(template.clientPreviewName || "Client Name");
    setProposalPreviewName(template.proposalPreviewName || "Proposal Name");
    const incomingCanvas = Array.isArray(template.canvasElements) && template.canvasElements.length
      ? template.canvasElements.map((element, index) => ({
          ...element,
          id: element.id || `canvas-${Date.now()}-${index}`
        }))
      : buildDefaultCanvasElements();
    setCanvasElements(incomingCanvas);
    setSelectedElementId(incomingCanvas[0]?.id || null);
    setSelectedSectionIndex(0);
    setBuilderOpen(true);
  };

  const closeBuilder = () => {
    if (saving) return;
    setBuilderOpen(false);
    setZoom(100);
  };

  const saveTemplate = async () => {
    if (!formData.name.trim()) {
      window.alert("Template name is required.");
      return;
    }

    const normalizedTags = formData.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const normalizedSections = normalizeSections(formData.sections);
    const normalizedFolder = formData.folder.trim() || "Templates";

    setSaving(true);
    try {
      ensureFolderExists(normalizedFolder);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category || "General",
        tags: normalizedTags,
        folder: normalizedFolder,
        sections: normalizedSections,
        clientPreviewName: clientPreviewName.trim() || "Client Name",
        proposalPreviewName: proposalPreviewName.trim() || "Proposal Name",
        canvasElements,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || null,
        updatedByEmail: currentUser?.email || null
      };

      if (editingTemplateId) {
        await updateDoc(doc(db, "proposalTemplates", editingTemplateId), payload);
      } else {
        await addDoc(collection(db, "proposalTemplates"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid || null,
          createdByEmail: currentUser?.email || null
        });
      }

      closeBuilder();
      setEditingTemplateId(null);
      setFormData(initialFormState);
    } catch (error) {
      console.error("Error saving template:", error);
      window.alert("Unable to save this template right now.");
    } finally {
      setSaving(false);
    }
  };

  const duplicateTemplate = async (template) => {
    if (template.source !== "saved") {
      openEditBuilder(template);
      return;
    }
    try {
      await addDoc(collection(db, "proposalTemplates"), {
        name: `${template.name || "Template"} (Copy)`,
        description: template.description || "",
        category: template.category || "General",
        folder: template.folder || "Templates",
        tags: template.tags || [],
        sections: template.sections || [],
        clientPreviewName: template.clientPreviewName || "Client Name",
        proposalPreviewName: template.proposalPreviewName || "Proposal Name",
        canvasElements: template.canvasElements || buildDefaultCanvasElements(),
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || null,
        createdByEmail: currentUser?.email || null,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || null,
        updatedByEmail: currentUser?.email || null
      });
    } catch (error) {
      console.error("Error duplicating template:", error);
      window.alert("Unable to duplicate template.");
    }
  };

  const removeTemplate = async (template) => {
    if (template.source !== "saved") return;
    const shouldDelete = window.confirm("Delete this template?");
    if (!shouldDelete) return;

    try {
      await deleteDoc(doc(db, "proposalTemplates", template.id));
    } catch (error) {
      console.error("Error deleting template:", error);
      window.alert("Unable to delete template.");
    }
  };

  const addFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    ensureFolderExists(trimmed);
    setSelectedFolder(trimmed);
    setNewFolderName("");
  };

  const updateSectionName = (value) => {
    const updated = [...builderSections];
    if (!updated.length) return;
    updated[selectedSectionIndex] = value;
    setFormData((prev) => ({ ...prev, sections: updated.join("\n") }));
  };

  const addSection = () => {
    const updated = [...builderSections, "New Section"];
    setFormData((prev) => ({ ...prev, sections: updated.join("\n") }));
    setSelectedSectionIndex(updated.length - 1);
  };

  const currentSection = builderSections[selectedSectionIndex] || "Cover";
  const selectedElement =
    canvasElements.find((element) => element.id === selectedElementId) || null;

  const resolveCanvasText = (element, sectionName = currentSection) => {
    if (element.type === "client_name") return clientPreviewName || "{client_name}";
    if (element.type === "proposal_name") return proposalPreviewName || "{proposal_name}";
    if (element.type === "section_title") return sectionName;
    if (element.type === "signature") return "Client Signature: __________________";
    return element.text || "Text block";
  };

  const startDragElement = (element, event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setSelectedElementId(element.id);

    const scale = zoom / 100;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = element.x || 0;
    const originY = element.y || 0;

    const handleMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;

      setCanvasElements((prev) =>
        prev.map((item) => {
          if (item.id !== element.id) return item;
          const itemWidth = item.width || 280;
          const itemHeight = item.height || Math.max((item.fontSize || 22) + 28, 44);
          const clampedX = Math.min(
            PAGE_WIDTH - itemWidth - 16,
            Math.max(16, originX + dx)
          );
          const clampedY = Math.min(
            PAGE_HEIGHT - itemHeight - 16,
            Math.max(16, originY + dy)
          );
          return { ...item, x: Math.round(clampedX), y: Math.round(clampedY) };
        })
      );
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const addCanvasTool = (toolType) => {
    const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const base = {
      id,
      x: 180,
      y: 180 + canvasElements.length * 28,
      width: 300,
      color: "#0f172a",
      fontWeight: 600
    };

    const toolMap = {
      text: { type: "text", text: "Editable text", fontSize: 22 },
      client_name: { type: "client_name", text: "{client_name}", fontSize: 48, fontWeight: 800, width: 360 },
      proposal_name: { type: "proposal_name", text: "{proposal_name}", fontSize: 36, fontWeight: 700, width: 360 },
      section_title: { type: "section_title", text: "{section_title}", fontSize: 24, fontWeight: 700, color: "#0369a1", width: 320 },
      signature: { type: "signature", text: "Client Signature: __________________", fontSize: 18, width: 420 }
    };

    const item = { ...base, ...(toolMap[toolType] || toolMap.text) };
    setCanvasElements((prev) => [...prev, item]);
    setSelectedElementId(id);
  };

  const uploadImageToStorage = async (file) => {
    const extension = file.name?.split(".").pop() || "png";
    const folder = currentUser?.uid || "anonymous";
    const path = `templateDesignAssets/${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const addCanvasImageElement = (imageUrl, fallbackName = "Image") => {
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const imageElement = {
      id,
      type: "image",
      text: fallbackName,
      imageUrl,
      x: 180,
      y: 220,
      width: 320,
      height: 200
    };
    setCanvasElements((prev) => [...prev, imageElement]);
    setSelectedElementId(id);
  };

  const requestImageUpload = (target = "new") => {
    setImageUploadTarget(target);
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageUploading(true);
    try {
      const imageUrl = await uploadImageToStorage(file);
      if (imageUploadTarget === "replace" && selectedElementId) {
        updateSelectedElement({
          type: "image",
          imageUrl,
          text: file.name || "Image"
        });
      } else {
        addCanvasImageElement(imageUrl, file.name || "Image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      window.alert("Unable to upload image right now.");
    } finally {
      setImageUploading(false);
    }
  };

  const updateSelectedElement = (patch) => {
    if (!selectedElementId) return;
    setCanvasElements((prev) =>
      prev.map((item) => (item.id === selectedElementId ? { ...item, ...patch } : item))
    );
  };

  const removeSelectedElement = () => {
    if (!selectedElementId) return;
    setCanvasElements((prev) => prev.filter((item) => item.id !== selectedElementId));
    setSelectedElementId(null);
  };

  const sanitizeFileName = (name) =>
    name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);

  const generateProposalPdfBlob = async () => {
    if (!canvasElements.length) throw new Error("Canvas is not ready yet.");

    const sectionsForExport = builderSections.length ? builderSections : [currentSection];
    const exportRoot = document.createElement("div");
    exportRoot.style.width = `${PAGE_WIDTH}px`;
    exportRoot.style.background = "#ffffff";

    sectionsForExport.forEach((sectionName, index) => {
      const page = document.createElement("div");
      page.style.width = `${PAGE_WIDTH}px`;
      page.style.minHeight = `${PAGE_HEIGHT}px`;
      page.style.position = "relative";
      page.style.background = "#ffffff";
      page.style.overflow = "hidden";
      page.style.pageBreakAfter = index === sectionsForExport.length - 1 ? "auto" : "always";

      canvasElements.forEach((element) => {
        if (element.type === "image" && element.imageUrl) {
          const img = document.createElement("img");
          img.src = element.imageUrl;
          img.alt = element.text || "Template image";
          img.style.position = "absolute";
          img.style.left = `${element.x || 0}px`;
          img.style.top = `${element.y || 0}px`;
          img.style.width = `${element.width || 320}px`;
          img.style.height = `${element.height || 200}px`;
          img.style.objectFit = "cover";
          img.style.borderRadius = "4px";
          page.appendChild(img);
          return;
        }

        const textNode = document.createElement("div");
        textNode.textContent = resolveCanvasText(element, sectionName);
        textNode.style.position = "absolute";
        textNode.style.left = `${element.x || 0}px`;
        textNode.style.top = `${element.y || 0}px`;
        textNode.style.width = `${element.width || 300}px`;
        textNode.style.fontSize = `${element.fontSize || 22}px`;
        textNode.style.fontWeight = `${element.fontWeight || 600}`;
        textNode.style.color = `${element.color || "#0f172a"}`;
        textNode.style.lineHeight = "1.25";
        textNode.style.whiteSpace = "pre-wrap";
        page.appendChild(textNode);
      });

      exportRoot.appendChild(page);
    });

    const hiddenMount = document.createElement("div");
    hiddenMount.style.position = "fixed";
    hiddenMount.style.left = "-99999px";
    hiddenMount.style.top = "0";
    hiddenMount.style.background = "#ffffff";
    hiddenMount.appendChild(exportRoot);
    document.body.appendChild(hiddenMount);

    try {
      const worker = html2pdf().set({
        margin: 0.3,
        filename: `${sanitizeFileName(formData.name || "proposal-template")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      }).from(exportRoot);
      const blob = await worker.outputPdf("blob");
      return blob;
    } finally {
      document.body.removeChild(hiddenMount);
    }
  };

  const ensureClientRecord = async (email, name) => {
    const lowered = email.toLowerCase();
    const usersQuery = query(collection(db, "users"), where("email", "==", lowered));
    const userSnapshot = await getDocs(usersQuery);

    if (!userSnapshot.empty) {
      const clientDoc = userSnapshot.docs[0];
      return clientDoc.id;
    }

    const newClientRef = await addDoc(collection(db, "users"), {
      email: lowered,
      displayName: name || lowered.split("@")[0],
      role: "client",
      createdAt: serverTimestamp(),
      status: "active"
    });
    return newClientRef.id;
  };

  const sendGeneratedProposal = async () => {
    if (!recipientEmail.trim()) {
      setShareError("Client email is required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      setShareError("Enter a valid email address.");
      return;
    }

    setSendingProposal(true);
    setShareError("");

    try {
      const pdfBlob = await generateProposalPdfBlob();
      const safeName = sanitizeFileName(formData.name || "proposal");
      const filePath = `proposals/${Date.now()}_${safeName}.pdf`;
      const fileRef = storageRef(storage, filePath);

      await uploadBytes(fileRef, pdfBlob, { contentType: "application/pdf" });
      const downloadUrl = await getDownloadURL(fileRef);
      const encodedPath = btoa(filePath);
      const proposalLink = `${window.location.origin}/p/${encodedPath}`;
      const clientId = await ensureClientRecord(recipientEmail.trim(), recipientName.trim());

      await addDoc(collection(db, "proposals"), {
        fileName: `${safeName}.pdf`,
        originalName: `${safeName}.pdf`,
        filePath,
        shareLink: proposalLink,
        downloadUrl,
        uploadedBy: currentUser?.uid || null,
        uploadedByEmail: currentUser?.email || null,
        uploadedAt: serverTimestamp(),
        size: pdfBlob.size || 0,
        source: "template_builder"
      });

      await addDoc(collection(db, "sharedProposals"), {
        fileName: `${safeName}.pdf`,
        filePath,
        fileUrl: proposalLink,
        clientEmail: recipientEmail.trim().toLowerCase(),
        clientId,
        clientName: recipientName.trim() || recipientEmail.trim().split("@")[0],
        sharedBy: currentUser?.uid || null,
        sharedByEmail: currentUser?.email || null,
        sharedAt: serverTimestamp(),
        status: "pending",
        viewCount: 0
      });

      const templateParams = {
        to_email: recipientEmail.trim(),
        to_name: recipientName.trim() || "Valued Client",
        from_name: currentUser?.displayName || currentUser?.email?.split("@")[0] || "Admin",
        from_email: currentUser?.email || "",
        proposal_name: formData.name || "Proposal",
        proposal_link: proposalLink,
        message:
          shareMessage.trim() ||
          "I generated a proposal for you. Please review it using the link below.",
        reply_to: currentUser?.email || "",
        current_date: new Date().toLocaleDateString(),
        login_link: `${window.location.origin}/client-login`
      };

      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        templateParams
      );

      setGeneratedLink(proposalLink);
      setProposalSuccessData({
        recipientEmail: recipientEmail.trim().toLowerCase(),
        recipientName:
          recipientName.trim() || recipientEmail.trim().split("@")[0],
        proposalName: `${safeName}.pdf`,
        proposalLink
      });
      setShowProposalSuccessModal(true);
      setShareModalOpen(false);
    } catch (error) {
      console.error("Error generating/sending proposal:", error);
      setShareError(error?.message || "Unable to generate and send proposal right now.");
    } finally {
      setSendingProposal(false);
    }
  };

  const copyGeneratedLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <>
      <div style={libraryPageStyle}>
        <div style={heroStyle}>
          <div style={heroIconWrapStyle}>
            <MdGridView size={34} color="#00D4FF" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={heroTitleStyle}>LOOKING FOR A UNIQUE DESIGN OR CUSTOM TEMPLATE?</div>
            <div style={heroTextStyle}>
              Build and reuse polished proposal templates. Keep your layout consistent while giving your team a faster starting point for every client.
            </div>
          </div>
          <button style={heroCtaStyle}>SEE OUR SERVICES</button>
        </div>

        <div style={modeTabsStyle}>
          <button
            onClick={() => setViewMode("saved")}
            style={modeTabButtonStyle(viewMode === "saved")}
          >
            SAVED
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            style={modeTabButtonStyle(viewMode === "gallery")}
          >
            GALLERY
          </button>
        </div>

        <div style={controlsRowStyle}>
          <div style={searchWrapStyle}>
            <MdSearch size={22} color="#94a3b8" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search template"
              style={searchInputStyle}
            />
          </div>
          <button onClick={openCreateBuilder} style={createButtonStyle}>
            <MdAdd size={20} />
            Template
          </button>
        </div>

        <div style={subControlsStyle}>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            style={selectStyle}
          >
            <option value="name">Template Name</option>
            <option value="updated">Recently Updated</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            style={selectStyle}
          >
            <option value="all">All Categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div style={folderHeaderStyle}>
          <MdFolder size={18} color="#00D4FF" />
          <span>Templates</span>
        </div>

        <div style={foldersRowStyle}>
          <div style={newFolderStyle}>
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="New folder"
              style={newFolderInputStyle}
            />
            <button onClick={addFolder} style={newFolderAddStyle}>
              <MdAdd size={16} />
            </button>
          </div>
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              style={folderChipStyle(selectedFolder === folder)}
            >
              <MdFolder size={16} />
              {folder}
            </button>
          ))}
        </div>

        {loading && viewMode === "saved" ? (
          <div style={emptyStyle}>Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div style={emptyStyle}>No templates found for this view.</div>
        ) : (
          <div style={templatesGridStyle}>
            {filteredTemplates.map((template) => (
              <div key={template.id} style={templateTileStyle}>
                <button
                  onClick={() => openEditBuilder(template)}
                  style={previewButtonStyle}
                >
                  {template.isFeatured && (
                    <span style={featuredBadgeStyle}>
                      <MdOutlineStar size={14} />
                    </span>
                  )}
                  <div
                    style={{
                      ...previewCanvasStyle,
                      borderColor: template.accent || "#22c55e"
                    }}
                  >
                    <div style={previewTitleStyle}>{template.name}</div>
                    <div style={previewTokenStyle}>{"{client_name}"}</div>
                    <div style={previewTokenStyle}>{"{proposal_name}"}</div>
                  </div>
                </button>

                <div style={tileMetaStyle}>
                  <div style={tileTitleStyle}>{template.name}</div>
                  <div style={tileSubtitleStyle}>
                    {(template.sections || []).length} sections
                    {template.updatedAt ? ` | Updated ${template.updatedAt.toLocaleDateString()}` : ""}
                  </div>
                </div>

                <div style={tileActionsStyle}>
                  <button onClick={() => openEditBuilder(template)} style={smallActionButtonStyle}>
                    <MdEdit size={14} />
                    Edit
                  </button>
                  <button onClick={() => duplicateTemplate(template)} style={smallActionButtonStyle}>
                    <MdContentCopy size={14} />
                    {template.source === "saved" ? "Duplicate" : "Use"}
                  </button>
                  {template.source === "saved" && (
                    <button
                      onClick={() => removeTemplate(template)}
                      style={smallDangerButtonStyle}
                    >
                      <MdDelete size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {builderOpen && (
        <div style={builderOverlayStyle}>
          <div style={builderShellStyle}>
            <div style={builderTopBarStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={closeBuilder} style={toolbarButtonStyle}>
                  <MdArrowBack size={16} />
                  Back
                </button>
                <button onClick={saveTemplate} disabled={saving} style={saveToolbarButtonStyle}>
                  <MdSave size={16} />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setZoom((prev) => Math.max(60, prev - 10))}
                  style={toolbarIconStyle}
                >
                  <MdZoomOut size={16} />
                </button>
                <div style={zoomValueStyle}>{zoom}%</div>
                <button
                  onClick={() => setZoom((prev) => Math.min(150, prev + 10))}
                  style={toolbarIconStyle}
                >
                  <MdZoomIn size={16} />
                </button>
                <button style={toolbarIconStyle}><MdUndo size={16} /></button>
                <button style={toolbarIconStyle}><MdRedo size={16} /></button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button style={toolbarButtonStyle}>Edit Styles and Formatting</button>
                <button
                  style={generateButtonStyle}
                  onClick={() => {
                    setShareError("");
                    setShareModalOpen(true);
                  }}
                >
                  Generate Proposal
                </button>
                <button onClick={closeBuilder} style={toolbarIconStyle}>
                  <MdClose size={17} />
                </button>
              </div>
            </div>

            <div style={builderBodyStyle}>
              <div style={leftRailStyle}>
                <div style={railHeaderStyle}>
                  <span>SECTIONS</span>
                  <button onClick={addSection} style={railAddStyle}>
                    <MdAdd size={15} />
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {builderSections.map((section, index) => (
                    <button
                      key={`${section}-${index}`}
                      onClick={() => setSelectedSectionIndex(index)}
                      style={sectionItemStyle(selectedSectionIndex === index)}
                    >
                      {section}
                    </button>
                  ))}
                </div>

                <div style={toolsWrapStyle}>
                  <div style={railHeaderStyle}>
                    <span>TOOLS</span>
                  </div>
                  <button onClick={() => addCanvasTool("text")} style={toolButtonStyle}>
                    <MdTextFields size={14} />
                    Text Block
                  </button>
                  <button onClick={() => addCanvasTool("client_name")} style={toolButtonStyle}>
                    <MdPerson size={14} />
                    Client Name
                  </button>
                  <button onClick={() => addCanvasTool("proposal_name")} style={toolButtonStyle}>
                    <MdDescription size={14} />
                    Proposal Name
                  </button>
                  <button onClick={() => addCanvasTool("section_title")} style={toolButtonStyle}>
                    <MdGridView size={14} />
                    Section Title
                  </button>
                  <button onClick={() => addCanvasTool("signature")} style={toolButtonStyle}>
                    <MdEdit size={14} />
                    Signature Line
                  </button>
                  <button
                    onClick={() => requestImageUpload("new")}
                    style={toolButtonStyle}
                    disabled={imageUploading}
                  >
                    <MdImage size={14} />
                    {imageUploading ? "Uploading..." : "Upload Image"}
                  </button>
                </div>
              </div>

              <div style={canvasAreaStyle}>
                <div
                  ref={canvasPageRef}
                  style={{
                    ...canvasPageStyle,
                    transform: `scale(${zoom / 100})`
                  }}
                >
                  {canvasElements.map((element) => (
                    <div
                      key={element.id}
                      onMouseDown={(event) => startDragElement(element, event)}
                      onClick={() => setSelectedElementId(element.id)}
                      style={canvasElementStyle(
                        element,
                        selectedElementId === element.id
                      )}
                    >
                      {element.type === "image" && element.imageUrl ? (
                        <img
                          src={element.imageUrl}
                          alt={element.text || "Template image"}
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                          style={canvasImageStyle(element)}
                        />
                      ) : (
                        resolveCanvasText(element)
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={rightRailStyle}>
                <div style={detailsTitleStyle}>TEMPLATE DETAILS</div>

                <label style={fieldLabelStyle}>
                  Name
                  <input
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, name: event.target.value }))
                    }
                    style={fieldInputStyle}
                  />
                </label>

                <label style={fieldLabelStyle}>
                  Description
                  <textarea
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, description: event.target.value }))
                    }
                    style={{ ...fieldInputStyle, minHeight: 64, resize: "vertical" }}
                  />
                </label>

                <label style={fieldLabelStyle}>
                  Client Name (Preview)
                  <input
                    value={clientPreviewName}
                    onChange={(event) => setClientPreviewName(event.target.value)}
                    style={fieldInputStyle}
                  />
                </label>

                <label style={fieldLabelStyle}>
                  Proposal Name (Preview)
                  <input
                    value={proposalPreviewName}
                    onChange={(event) => setProposalPreviewName(event.target.value)}
                    style={fieldInputStyle}
                  />
                </label>

                <label style={fieldLabelStyle}>
                  Current Section
                  <input
                    value={currentSection}
                    onChange={(event) => updateSectionName(event.target.value)}
                    style={fieldInputStyle}
                  />
                </label>

                <label style={fieldLabelStyle}>
                  Category
                  <select
                    value={formData.category}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, category: event.target.value }))
                    }
                    style={fieldInputStyle}
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldLabelStyle}>
                  Folder
                  <input
                    value={formData.folder}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, folder: event.target.value }))
                    }
                    style={fieldInputStyle}
                  />
                </label>

                <label style={fieldLabelStyle}>
                  Tags
                  <input
                    value={formData.tags}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, tags: event.target.value }))
                    }
                    style={fieldInputStyle}
                    placeholder="retainer, annual, design"
                  />
                </label>

                <div style={canvasEditorPanelStyle}>
                  <div style={canvasEditorTitleStyle}>Canvas Element</div>
                  {!selectedElement ? (
                    <div style={canvasEditorEmptyStyle}>Click an item in the page to edit it.</div>
                  ) : (
                    <>
                      <label style={fieldLabelStyle}>
                        Text
                        <input
                          value={selectedElement.text || ""}
                          onChange={(event) => updateSelectedElement({ text: event.target.value })}
                          style={fieldInputStyle}
                          disabled={
                            selectedElement.type === "section_title" ||
                            selectedElement.type === "image"
                          }
                        />
                      </label>
                      <label style={fieldLabelStyle}>
                        Font Size
                        <input
                          type="number"
                          min={12}
                          max={80}
                          value={selectedElement.fontSize || 22}
                          onChange={(event) =>
                            updateSelectedElement({ fontSize: Number(event.target.value) || 22 })
                          }
                          style={fieldInputStyle}
                        />
                      </label>
                      <label style={fieldLabelStyle}>
                        Width
                        <input
                          type="number"
                          min={120}
                          max={700}
                          value={selectedElement.width || 280}
                          onChange={(event) =>
                            updateSelectedElement({ width: Number(event.target.value) || 280 })
                          }
                          style={fieldInputStyle}
                        />
                      </label>
                      {selectedElement.type === "image" && (
                        <label style={fieldLabelStyle}>
                          Height
                          <input
                            type="number"
                            min={80}
                            max={700}
                            value={selectedElement.height || 200}
                            onChange={(event) =>
                              updateSelectedElement({ height: Number(event.target.value) || 200 })
                            }
                            style={fieldInputStyle}
                          />
                        </label>
                      )}
                      {selectedElement.type === "image" && (
                        <button
                          onClick={() => requestImageUpload("replace")}
                          style={replaceImageButtonStyle}
                          disabled={imageUploading}
                        >
                          <MdImage size={14} />
                          {imageUploading ? "Uploading..." : "Replace Image"}
                        </button>
                      )}
                      <button onClick={removeSelectedElement} style={removeElementButtonStyle}>
                        <MdDelete size={14} />
                        Remove Element
                      </button>
                    </>
                  )}
                </div>

                <div style={rightRailActionsStyle}>
                  <button onClick={closeBuilder} style={secondaryActionStyle}>
                    Cancel
                  </button>
                  <button onClick={saveTemplate} disabled={saving} style={primaryActionStyle}>
                    {saving ? "Saving..." : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareModalOpen && (
        <div style={shareOverlayStyle} onClick={() => !sendingProposal && setShareModalOpen(false)}>
          <div style={shareModalStyle} onClick={(event) => event.stopPropagation()}>
            <div style={shareHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
                Generate & Send Proposal
              </h3>
              <button
                style={toolbarIconStyle}
                onClick={() => !sendingProposal && setShareModalOpen(false)}
              >
                <MdClose size={16} />
              </button>
            </div>

            <div style={shareBodyStyle}>
              <label style={fieldLabelStyle}>
                Client Email
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  placeholder="client@example.com"
                  style={fieldInputStyle}
                />
              </label>

              <label style={fieldLabelStyle}>
                Client Name (Optional)
                <input
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Client name"
                  style={fieldInputStyle}
                />
              </label>

              <label style={fieldLabelStyle}>
                Message
                <textarea
                  value={shareMessage}
                  onChange={(event) => setShareMessage(event.target.value)}
                  placeholder="Add a note for the client..."
                  style={{ ...fieldInputStyle, minHeight: 92, resize: "vertical" }}
                />
              </label>

              {generatedLink && (
                <div style={linkPreviewStyle}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Proposal Link</div>
                  <div style={{ fontSize: 12, color: "#0369a1", wordBreak: "break-all", marginTop: 4 }}>
                    {generatedLink}
                  </div>
                  <button onClick={copyGeneratedLink} style={copyLinkButtonStyle}>
                    <MdContentCopy size={14} />
                    Copy Link
                  </button>
                </div>
              )}

              {shareError && <div style={shareErrorStyle}>{shareError}</div>}
            </div>

            <div style={shareFooterStyle}>
              <button
                style={secondaryActionStyle}
                onClick={() => setShareModalOpen(false)}
                disabled={sendingProposal}
              >
                Cancel
              </button>
              <button
                style={primaryActionStyle}
                onClick={sendGeneratedProposal}
                disabled={sendingProposal}
              >
                <MdSend size={14} />
                {sendingProposal ? "Generating..." : "Generate & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProposalSuccessModal && (
        <div
          style={shareOverlayStyle}
          onClick={() => setShowProposalSuccessModal(false)}
        >
          <div
            style={proposalSuccessModalStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={proposalSuccessIconStyle}>Success</div>
            <h3 style={{ margin: "6px 0 4px", color: "#0f172a", fontSize: 22 }}>
              Proposal Sent Successfully
            </h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
              Your proposal was generated and sent to the client.
            </p>

            <div style={proposalSuccessDetailsStyle}>
              <div style={proposalSuccessRowStyle}>
                <span>Client</span>
                <strong>{proposalSuccessData?.recipientName}</strong>
              </div>
              <div style={proposalSuccessRowStyle}>
                <span>Email</span>
                <strong>{proposalSuccessData?.recipientEmail}</strong>
              </div>
              <div style={proposalSuccessRowStyle}>
                <span>File</span>
                <strong>{proposalSuccessData?.proposalName}</strong>
              </div>
            </div>

            {proposalSuccessData?.proposalLink && (
              <div style={proposalSuccessLinkStyle}>
                {proposalSuccessData.proposalLink}
              </div>
            )}

            <div style={proposalSuccessActionsStyle}>
              <button
                onClick={() => setShowProposalSuccessModal(false)}
                style={secondaryActionStyle}
              >
                Close
              </button>
              <button
                onClick={copyGeneratedLink}
                style={primaryActionStyle}
              >
                <MdContentCopy size={14} />
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        style={{ display: "none" }}
      />
    </>
  );
}

const libraryPageStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 16
};

const heroStyle = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  padding: "18px 20px",
  borderRadius: 10,
  background: "linear-gradient(90deg, #0f172a 0%, #1e293b 60%, #0b223a 100%)",
  color: "#fff"
};

const heroIconWrapStyle = {
  width: 96,
  height: 96,
  borderRadius: "50%",
  background: "rgba(0, 212, 255, 0.14)",
  border: "1px solid rgba(0, 212, 255, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const heroTitleStyle = {
  fontSize: 22,
  fontWeight: 800
};

const heroTextStyle = {
  marginTop: 8,
  fontSize: 14,
  color: "rgba(241, 245, 249, 0.95)",
  maxWidth: 760,
  lineHeight: 1.45
};

const heroCtaStyle = {
  border: "1px solid rgba(0, 212, 255, 0.4)",
  background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  color: "#ffffff",
  borderRadius: 8,
  padding: "14px 18px",
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0
};

const modeTabsStyle = {
  display: "flex",
  gap: 8
};

const modeTabButtonStyle = (active) => ({
  border: "none",
  borderBottom: active ? "2px solid #00D4FF" : "2px solid transparent",
  background: "transparent",
  color: active ? "#0f172a" : "#64748b",
  fontWeight: 700,
  fontSize: 14,
  padding: "8px 4px",
  cursor: "pointer"
});

const controlsRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center"
};

const searchWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  background: "#fff",
  padding: "10px 12px",
  minWidth: 320,
  flex: 1
};

const searchInputStyle = {
  width: "100%",
  border: "none",
  outline: "none",
  fontSize: 18,
  fontFamily: "inherit",
  color: "#334155"
};

const createButtonStyle = {
  border: "1px solid rgba(0, 212, 255, 0.45)",
  background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  color: "#fff",
  borderRadius: 8,
  padding: "12px 20px",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer"
};

const subControlsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap"
};

const selectStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: 6,
  background: "#fff",
  color: "#334155",
  padding: "8px 10px",
  fontSize: 14
};

const folderHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0f172a",
  fontWeight: 700
};

const foldersRowStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap"
};

const newFolderStyle = {
  display: "flex",
  alignItems: "center",
  border: "1px dashed #93c5fd",
  borderRadius: 8,
  background: "#fff",
  padding: "6px 8px"
};

const newFolderInputStyle = {
  border: "none",
  outline: "none",
  width: 140,
  fontSize: 14
};

const newFolderAddStyle = {
  border: "none",
  background: "transparent",
  color: "#0284c7",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center"
};

const folderChipStyle = (active) => ({
  border: `1px solid ${active ? "rgba(0, 212, 255, 0.45)" : "#cbd5e1"}`,
  borderRadius: 8,
  background: active
    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 153, 204, 0.08) 100%)"
    : "#fff",
  color: active ? "#0369a1" : "#0f172a",
  padding: "10px 12px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontWeight: 600,
  cursor: "pointer"
});

const emptyStyle = {
  border: "1px dashed #93c5fd",
  background: "#fff",
  borderRadius: 10,
  color: "#64748b",
  textAlign: "center",
  padding: 28
};

const templatesGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
  gap: 16
};

const templateTileStyle = {
  border: "1px solid #dbeafe",
  borderRadius: 10,
  background: "#fff",
  overflow: "hidden",
  boxShadow: "0 6px 18px rgba(14, 116, 144, 0.08)"
};

const previewButtonStyle = {
  width: "100%",
  border: "none",
  background: "#f8fbff",
  padding: 0,
  cursor: "pointer",
  position: "relative"
};

const featuredBadgeStyle = {
  position: "absolute",
  top: 8,
  left: 8,
  borderRadius: 6,
  background: "#00D4FF",
  color: "#083344",
  padding: "4px 6px",
  zIndex: 1,
  display: "inline-flex",
  alignItems: "center"
};

const previewCanvasStyle = {
  borderLeft: "10px solid #00D4FF",
  minHeight: 190,
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 8
};

const previewTitleStyle = {
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
  textAlign: "center",
  padding: "0 10px"
};

const previewTokenStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "#334155"
};

const tileMetaStyle = {
  padding: "10px 12px 0 12px"
};

const tileTitleStyle = {
  fontWeight: 700,
  color: "#0f172a",
  fontSize: 14
};

const tileSubtitleStyle = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 12
};

const tileActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  padding: "10px 12px 12px 12px"
};

const smallActionButtonStyle = {
  border: "1px solid #bfdbfe",
  background: "#fff",
  color: "#0369a1",
  borderRadius: 6,
  padding: "6px 8px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 4
};

const smallDangerButtonStyle = {
  ...smallActionButtonStyle,
  border: "1px solid #fecaca",
  color: "#b91c1c",
  background: "#fff1f2"
};

const builderOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(2, 6, 23, 0.55)",
  zIndex: 1500,
  padding: 10
};

const builderShellStyle = {
  width: "100%",
  height: "100%",
  background: "#f8fbff",
  borderRadius: 8,
  border: "1px solid #bfdbfe",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column"
};

const builderTopBarStyle = {
  height: 52,
  borderBottom: "1px solid #dbeafe",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 10px",
  gap: 10
};

const toolbarButtonStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: 6,
  background: "#fff",
  color: "#0369a1",
  padding: "7px 10px",
  fontSize: 13,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5
};

const saveToolbarButtonStyle = {
  ...toolbarButtonStyle,
  background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  border: "1px solid rgba(0, 212, 255, 0.45)",
  color: "#fff",
  fontWeight: 700
};

const toolbarIconStyle = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid #bfdbfe",
  background: "#fff",
  color: "#0369a1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};

const zoomValueStyle = {
  minWidth: 52,
  height: 30,
  borderRadius: 6,
  border: "1px solid #bfdbfe",
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  color: "#334155"
};

const generateButtonStyle = {
  border: "1px solid rgba(0, 212, 255, 0.45)",
  background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  color: "#fff",
  borderRadius: 6,
  padding: "7px 11px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer"
};

const builderBodyStyle = {
  display: "grid",
  gridTemplateColumns: "220px minmax(0, 1fr) 290px",
  minHeight: 0,
  height: "100%"
};

const leftRailStyle = {
  background: "#fff",
  borderRight: "1px solid #dbeafe",
  padding: 10,
  overflowY: "auto"
};

const railHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const railAddStyle = {
  border: "none",
  background: "transparent",
  color: "#00A8DF",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center"
};

const toolsWrapStyle = {
  marginTop: 16,
  paddingTop: 12,
  borderTop: "1px solid #dbeafe",
  display: "flex",
  flexDirection: "column",
  gap: 7
};

const toolButtonStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: 6,
  background: "#fff",
  color: "#0369a1",
  padding: "8px 9px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  textAlign: "left"
};

const sectionItemStyle = (active) => ({
  border: `1px solid ${active ? "rgba(0, 212, 255, 0.5)" : "#d1d5db"}`,
  borderRadius: 6,
  background: active
    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.16) 0%, rgba(0, 153, 204, 0.08) 100%)"
    : "#fff",
  color: active ? "#075985" : "#1f2937",
  textAlign: "left",
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer"
});

const canvasAreaStyle = {
  padding: 20,
  overflow: "auto",
  display: "flex",
  justifyContent: "center"
};

const canvasPageStyle = {
  width: 760,
  minHeight: 960,
  background: "#fff",
  border: "1px solid #dbeafe",
  boxShadow: "0 6px 20px rgba(14, 116, 144, 0.12)",
  position: "relative",
  transformOrigin: "top center"
};

const canvasElementStyle = (element, selected) => ({
  position: "absolute",
  left: element.x || 0,
  top: element.y || 0,
  maxWidth: element.width || 300,
  width: element.width || "auto",
  fontSize: element.fontSize || 22,
  fontWeight: element.fontWeight || 600,
  color: element.color || "#0f172a",
  cursor: "grab",
  border: selected ? "1px dashed #00D4FF" : "1px dashed transparent",
  background: selected ? "rgba(0, 212, 255, 0.08)" : "transparent",
  borderRadius: 4,
  padding: "4px 6px",
  userSelect: "none",
  whiteSpace: "pre-wrap",
  transition: "background 0.15s ease, border-color 0.15s ease"
});

const canvasImageStyle = (element) => ({
  width: "100%",
  height: element.height || 200,
  objectFit: "cover",
  borderRadius: 4,
  pointerEvents: "none",
  display: "block",
  userSelect: "none"
});

const rightRailStyle = {
  background: "#f8fbff",
  borderLeft: "1px solid #dbeafe",
  padding: 12,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10
};

const detailsTitleStyle = {
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a"
};

const fieldLabelStyle = {
  display: "grid",
  gap: 5,
  fontSize: 12,
  color: "#334155",
  fontWeight: 700
};

const fieldInputStyle = {
  border: "1px solid #bfdbfe",
  background: "#fff",
  borderRadius: 6,
  padding: "8px 9px",
  fontSize: 13,
  color: "#0f172a",
  fontFamily: "inherit"
};

const rightRailActionsStyle = {
  display: "flex",
  gap: 8,
  marginTop: 6
};

const canvasEditorPanelStyle = {
  border: "1px solid #dbeafe",
  borderRadius: 8,
  background: "#ffffff",
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 8
};

const canvasEditorTitleStyle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#0f172a"
};

const canvasEditorEmptyStyle = {
  color: "#64748b",
  fontSize: 12
};

const removeElementButtonStyle = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  borderRadius: 6,
  padding: "8px 9px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 700
};

const replaceImageButtonStyle = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#0369a1",
  borderRadius: 6,
  padding: "8px 9px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 700
};

const shareOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(2, 6, 23, 0.6)",
  zIndex: 1700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const shareModalStyle = {
  width: "100%",
  maxWidth: 560,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "0 16px 42px rgba(2, 6, 23, 0.24)"
};

const shareHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid #dbeafe",
  background: "#f8fbff"
};

const shareBodyStyle = {
  display: "grid",
  gap: 10,
  padding: "14px 16px"
};

const shareFooterStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "0 16px 14px 16px"
};

const linkPreviewStyle = {
  border: "1px solid #dbeafe",
  borderRadius: 8,
  background: "#f8fbff",
  padding: "10px 11px"
};

const copyLinkButtonStyle = {
  marginTop: 8,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#0369a1",
  borderRadius: 6,
  padding: "6px 8px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6
};

const shareErrorStyle = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 600
};

const proposalSuccessModalStyle = {
  width: "100%",
  maxWidth: 540,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 14,
  boxShadow: "0 24px 54px rgba(2, 6, 23, 0.32)",
  padding: "22px 20px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const proposalSuccessIconStyle = {
  width: 72,
  height: 32,
  borderRadius: 999,
  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  letterSpacing: 0.4
};

const proposalSuccessDetailsStyle = {
  border: "1px solid #dbeafe",
  background: "#f8fbff",
  borderRadius: 10,
  padding: "6px 10px",
  display: "flex",
  flexDirection: "column"
};

const proposalSuccessRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  borderBottom: "1px solid #e2e8f0",
  padding: "8px 0",
  fontSize: 12,
  color: "#64748b"
};

const proposalSuccessLinkStyle = {
  border: "1px dashed #93c5fd",
  background: "#f8fbff",
  borderRadius: 8,
  color: "#0369a1",
  fontSize: 12,
  padding: "10px",
  wordBreak: "break-all"
};

const proposalSuccessActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8
};

const secondaryActionStyle = {
  border: "1px solid #bfdbfe",
  background: "#fff",
  borderRadius: 6,
  color: "#0369a1",
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 700
};

const primaryActionStyle = {
  border: "1px solid rgba(0, 212, 255, 0.45)",
  background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  borderRadius: 6,
  color: "#fff",
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 700
};
