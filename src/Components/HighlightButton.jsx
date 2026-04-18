// src/Components/HighlightButton.jsx
import { useState } from 'react';
import { MdHighlight, MdClose } from 'react-icons/md';

const HighlightButton = ({ isActive, onToggle, unresolvedCount }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      style={styles.container}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={onToggle}
        style={{
          ...styles.button,
          ...(isActive ? styles.buttonActive : {})
        }}
        title={isActive ? 'Exit Highlight Mode' : 'Enable Highlight Mode'}
      >
        {isActive ? <MdClose size={20} /> : <MdHighlight size={20} />}
        {unresolvedCount > 0 && (
          <span style={styles.badge}>{unresolvedCount}</span>
        )}
      </button>
      
      {showTooltip && (
        <div style={styles.tooltip}>
          {isActive ? 'Exit Highlight Mode' : 'Highlight & Discuss'}
          {unresolvedCount > 0 && <div style={styles.tooltipSubtext}>{unresolvedCount} open discussion(s)</div>}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative',
    display: 'inline-block'
  },
  button: {
    padding: '10px 14px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    background: '#ffffff',
    color: '#666',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    position: 'relative',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  buttonActive: {
    background: '#FFF3CD',
    color: '#856404',
    borderColor: '#FFD700',
    boxShadow: '0 4px 8px rgba(255,215,0,0.3)'
  },
  badge: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    background: '#FF6B6B',
    color: 'white',
    fontSize: '11px',
    fontWeight: 'bold',
    minWidth: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(255,107,107,0.4)'
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '10px',
    background: '#333',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    animation: 'fadeIn 0.2s ease'
  },
  tooltipSubtext: {
    fontSize: '11px',
    opacity: 0.8,
    marginTop: '4px'
  }
};

export default HighlightButton;
