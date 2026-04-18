// src/components/TrackingPDFViewer.jsx
import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { usePageTracking } from '../hooks/usePageTracking';
import HighlightButton from './HighlightButton';
import DiscussionPanel from './DiscussionPanel';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function TrackingPDFViewer({ pdfUrl, proposalId, clientId, proposalName, filePath, userId, userEmail, userRole }) {
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(800);
  const [loading, setLoading] = useState(true);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [highlightModeActive, setHighlightModeActive] = useState(false);
  const [discussionPanelOpen, setDiscussionPanelOpen] = useState(false);
  
  const {
    currentPage,
    totalPages,
    timeOnCurrentPage,
    totalTime,
    pageTimes,
    setCurrentPage
  } = usePageTracking(proposalId, clientId, numPages);

  useEffect(() => {
    setCurrentPageNum(currentPage);
  }, [currentPage]);

  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth - 100, 900);
      setPageWidth(width);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    console.log(`📄 PDF loaded: ${numPages} pages`);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
    }
  };

  const formatTimeDisplay = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div className="spinner"></div>
        <p>Loading document...</p>
        <style>{`
          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #00D4FF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header with tracking info */}
      <div style={headerStyle}>
        <div style={titleSection}>
          <h2 style={titleStyle}>📄 Document Viewer</h2>
          <div style={trackingBadgeStyle}>
            <span className="live-dot"></span>
            Tracking Active
          </div>
        </div>
        
        <div style={statsPanelStyle}>
          <div style={statItemStyle}>
            <span style={statLabelStyle}>Current Page:</span>
            <span style={statValueStyle}>{currentPage} / {numPages}</span>
          </div>
          <div style={statItemStyle}>
            <span style={statLabelStyle}>Time on this page:</span>
            <span style={statValueStyle}>{timeOnCurrentPage}</span>
          </div>
          <div style={statItemStyle}>
            <span style={statLabelStyle}>Total time:</span>
            <span style={statValueStyle}>{totalTime}</span>
          </div>
          
          {/* Highlight & Discussion Button (if user info provided) */}
          {userId && (
            <HighlightButton
              isActive={highlightModeActive}
              onToggle={() => {
                setHighlightModeActive(!highlightModeActive);
                setDiscussionPanelOpen(true);
              }}
              unresolvedCount={0}
            />
          )}
        </div>
      </div>

      {/* Page Navigation */}
      <div style={navStyle}>
        <button 
          onClick={() => handlePageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          style={navButtonStyle(currentPage === 1)}
        >
          ◀ Previous
        </button>
        
        <div style={pageInputStyle}>
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={numPages}
            value={currentPage}
            onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
            style={pageInputFieldStyle}
          />
          <span>of {numPages}</span>
        </div>
        
        <button 
          onClick={() => handlePageChange(currentPage + 1)} 
          disabled={currentPage === numPages}
          style={navButtonStyle(currentPage === numPages)}
        >
          Next ▶
        </button>
      </div>

      {/* Page Thumbnails with time indicators */}
      <div style={thumbnailsStyle}>
        {Array.from({ length: Math.min(numPages, 15) }, (_, i) => i + 1).map(pageNum => {
          const timeSpent = pageTimes[pageNum] || 0;
          const intensity = Math.min((timeSpent / 60) * 100, 100);
          return (
            <div
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              style={{
                ...thumbnailStyle,
                background: pageNum === currentPage ? '#00D4FF20' : '#f5f5f5',
                border: pageNum === currentPage ? '2px solid #00D4FF' : '1px solid #ddd'
              }}
            >
              <div style={thumbnailNumberStyle}>{pageNum}</div>
              {timeSpent > 0 && (
                <div style={thumbnailTimeStyle}>{formatTimeDisplay(timeSpent)}</div>
              )}
              <div style={thumbnailProgressStyle}>
                <div style={{
                  ...thumbnailProgressFillStyle,
                  width: `${intensity}%`,
                  background: intensity > 60 ? '#10B981' : intensity > 30 ? '#F59E0B' : '#EF4444'
                }} />
              </div>
            </div>
          );
        })}
        {numPages > 15 && (
          <div style={thumbnailMoreStyle}>+{numPages - 15} more</div>
        )}
      </div>

      {/* PDF Viewer */}
      <div style={viewerContainerStyle}>
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => console.error("PDF load error:", error)}
          loading={<div>Loading PDF...</div>}
        >
          <Page 
            pageNumber={currentPage} 
            width={pageWidth}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            data-testid="pdf-page"
          />
        </Document>
      </div>

      {/* Footer Summary */}
      <div style={footerStyle}>
        <div style={footerTitleStyle}>📊 Time spent per page:</div>
        <div style={pageTimeSummaryStyle}>
          {Object.entries(pageTimes).slice(0, 10).map(([page, time]) => (
            <div key={page} style={pageTimeBadgeStyle(time)}>
              Page {page}: {formatTimeDisplay(time)}
            </div>
          ))}
          {Object.keys(pageTimes).length > 10 && (
            <div style={morePagesStyle}>+{Object.keys(pageTimes).length - 10} more</div>
          )}
        </div>
      </div>

      {/* Discussion Panel */}
      {userId && (
        <DiscussionPanel
          isOpen={discussionPanelOpen}
          onClose={() => setDiscussionPanelOpen(false)}
          proposalId={proposalId}
          proposalName={proposalName || 'Document'}
          filePath={filePath}
          currentPage={currentPageNum}
          userId={userId}
          userEmail={userEmail}
          userRole={userRole}
          highlightModeActive={highlightModeActive}
          onHighlightModeChange={setHighlightModeActive}
        />
      )}

      <style>{`
        .live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          margin-right: 6px;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Styles
const containerStyle = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '20px',
  fontFamily: "'Inter', system-ui, sans-serif"
};

const loadingContainer = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '500px',
  gap: '20px'
};

const headerStyle = {
  background: '#fff',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
};

const titleSection = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '15px'
};

const titleStyle = {
  margin: 0,
  fontSize: '24px',
  color: '#1a1a2e'
};

const trackingBadgeStyle = {
  display: 'flex',
  alignItems: 'center',
  background: '#10B98120',
  padding: '6px 12px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '500',
  color: '#10B981'
};

const statsPanelStyle = {
  display: 'flex',
  gap: '30px',
  flexWrap: 'wrap',
  padding: '15px',
  background: '#f8f9fa',
  borderRadius: '8px'
};

const statItemStyle = {
  display: 'flex',
  gap: '10px',
  alignItems: 'center'
};

const statLabelStyle = {
  fontSize: '13px',
  color: '#666'
};

const statValueStyle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#00D4FF'
};

const navStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '20px',
  marginBottom: '20px'
};

const navButtonStyle = (disabled) => ({
  padding: '10px 20px',
  background: disabled ? '#ccc' : '#00D4FF',
  color: disabled ? '#666' : '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: '500'
});

const pageInputStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const pageInputFieldStyle = {
  width: '60px',
  padding: '8px',
  textAlign: 'center',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px'
};

const thumbnailsStyle = {
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  padding: '15px',
  background: '#fff',
  borderRadius: '12px',
  marginBottom: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
};

const thumbnailStyle = {
  minWidth: '60px',
  height: '70px',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  transition: 'all 0.2s'
};

const thumbnailNumberStyle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#333'
};

const thumbnailTimeStyle = {
  fontSize: '9px',
  color: '#666',
  marginTop: '4px'
};

const thumbnailProgressStyle = {
  position: 'absolute',
  bottom: '0',
  left: '0',
  right: '0',
  height: '3px',
  background: '#e0e0e0',
  borderRadius: '0 0 8px 8px',
  overflow: 'hidden'
};

const thumbnailProgressFillStyle = {
  height: '100%',
  transition: 'width 0.3s'
};

const thumbnailMoreStyle = {
  minWidth: '60px',
  height: '70px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f5f5f5',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#666'
};

const viewerContainerStyle = {
  background: '#fff',
  padding: '20px',
  borderRadius: '12px',
  display: 'flex',
  justifyContent: 'center',
  overflowX: 'auto',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  minHeight: '600px'
};

const footerStyle = {
  marginTop: '20px',
  padding: '15px',
  background: '#fff',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
};

const footerTitleStyle = {
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '10px',
  color: '#333'
};

const pageTimeSummaryStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap'
};

const pageTimeBadgeStyle = (time) => ({
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: '500',
  background: time > 60 ? '#10B98120' : time > 30 ? '#F59E0B20' : '#EF444420',
  color: time > 60 ? '#10B981' : time > 30 ? '#F59E0B' : '#EF4444'
});

const morePagesStyle = {
  padding: '4px 10px',
  fontSize: '11px',
  color: '#666'
};