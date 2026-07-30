// src/utils/highlightUtils.js

/**
 * Get selected text and metadata
 */
export const getSelectedTextData = () => {
  const selection = window.getSelection();
  console.log('getSelectedTextData called, selection:', {
    rangeCount: selection.rangeCount,
    isCollapsed: selection.isCollapsed,
    toString: selection.toString()
  });
  
  if (!selection.rangeCount || selection.isCollapsed) {
    console.log('No valid selection (rangeCount=0 or isCollapsed)');
    return null;
  }

  const range = selection.getRangeAt(0); 
  const selectedText = selection.toString().trim();
  
  if (!selectedText) {
    console.log('Selected text is empty after trim');
    return null;
  }

  console.log('Valid text selected:', selectedText.substring(0, 50));

  // Get the container element (PDF page)
  const container = range.commonAncestorContainer.nodeType === 3
    ? range.commonAncestorContainer.parentElement
    : range.commonAncestorContainer;

  // Get surrounding context (up to 50 chars before and after)
  const preRange = range.cloneRange();
  preRange.setStart(range.startContainer, Math.max(0, range.startOffset - 50));
  const prePath = preRange.toString();

  const postRange = range.cloneRange();
  postRange.setEnd(range.endContainer, Math.min(range.endOffset + 50, range.endContainer.textContent.length));
  const postPath = postRange.toString();

  // Find start and end indices in the full text
  const containerText = container.textContent || '';
  const startIndex = containerText.indexOf(selectedText);
  const endIndex = startIndex + selectedText.length;

  return {
    text: selectedText,
    context: prePath + postPath, // Context around selection
    startIndex,
    endIndex,
    boundingRect: range.getBoundingClientRect()
  };
};

/**
 * Highlight text in the DOM
 */
export const highlightTextInDOM = (container, text, color = '#FFFF00', id = '') => {
  if (!container || !text) return null;

  // Create a temporary element to search within
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  const nodesToReplace = [];
  let found = false;

  while ((node = walker.nextNode())) {
    if (node.textContent.includes(text)) {
      nodesToReplace.push(node);
      found = true;
    }
  }

  if (!found) return null;

  // Replace text nodes with highlighted versions
  nodesToReplace.forEach(node => {
    const span = document.createElement('span');
    span.innerHTML = node.textContent.replace(
      new RegExp(`(${escapeRegex(text)})`, 'gi'),
      `<mark id="${id}" style="background-color: ${color}; cursor: pointer; opacity: 0.6; transition: opacity 0.2s;" data-highlight="${id}">$1</mark>`
    );
    node.parentNode.replaceChild(span, node);
  });

  return document.querySelector(`[data-highlight="${id}"]`);
};

/**
 * Remove highlight from DOM
 */
export const removeHighlight = (id) => {
  const highlight = document.querySelector(`[data-highlight="${id}"]`);
  if (highlight) {
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
    parent.normalize();
  }
};

/**
 * Escape special regex characters
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Generate a color from a discussion ID (deterministic colors)
 */
const highlightColors = [
  '#FFFF00', // Yellow
  '#FFB6C1', // Light Pink
  '#87CEEB', // Sky Blue
  '#90EE90', // Light Green
  '#FFD700', // Gold
  '#FF69B4', // Hot Pink
  '#00BFFF', // Deep Sky Blue
  '#98FB98', // Pale Green
  '#FFA07A', // Light Salmon
  '#DDA0DD'  // Plum
];

export const getColorForDiscussion = (discussionId, index = 0) => {
  // Use index if provided, otherwise generate from ID
  if (index >= 0) {
    return highlightColors[index % highlightColors.length];
  }
  
  let hash = 0;
  for (let i = 0; i < discussionId.length; i++) {
    hash = discussionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % highlightColors.length;
  return highlightColors[colorIndex];
};

/**
 * Get all highlights currently in the DOM
 */
export const getAllHighlights = () => {
  return Array.from(document.querySelectorAll('[data-highlight]')).map(el => ({
    id: el.getAttribute('data-highlight'),
    text: el.textContent,
    color: el.style.backgroundColor
  }));
};

/**
 * Scroll to highlight and make it visible
 */
export const scrollToHighlight = (id) => {
  const highlight = document.querySelector(`[data-highlight="${id}"]`);
  if (highlight) {
    highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash effect
    highlight.style.opacity = '1';
    setTimeout(() => {
      highlight.style.opacity = '0.6';
    }, 200);
  }
};

/**
 * Clear all highlights
 */
export const clearAllHighlights = () => {
  document.querySelectorAll('[data-highlight]').forEach(el => {
    const parent = el.parentNode;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
    parent.normalize();
  });
};

/**
 * Generate highlight ID from proposal and timestamp
 */
export const generateHighlightId = (proposalId) => {
  return `${proposalId}_${Date.now()}`;
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};
