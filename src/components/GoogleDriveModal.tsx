import React, { useEffect, useState, useRef } from 'react';
import {
  signInWithGoogleDrive,
  signOutGoogleDrive,
  getDriveAccessToken,
  initDriveAuth,
  listDriveFiles,
  uploadFileToDrive,
  createDriveTextFile,
  deleteDriveFile,
  getDriveAbout,
  type DriveFile,
  type DriveAboutInfo
} from '../services/googleDrive';
import {
  X,
  Search,
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Image as ImageIcon,
  File as GenericFile,
  ExternalLink,
  Trash2,
  Plus,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  User,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GoogleDriveModalProps {
  onClose: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({ onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [aboutInfo, setAboutInfo] = useState<DriveAboutInfo | null>(null);

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // New Note Modal state
  const [showCreateDocModal, setShowCreateDocModal] = useState<boolean>(false);
  const [newDocTitle, setNewDocTitle] = useState<string>('Lab Experiment Report');
  const [newDocContent, setNewDocContent] = useState<string>('');
  const [newDocType, setNewDocType] = useState<'doc' | 'text' | 'csv'>('doc');
  const [isCreatingDoc, setIsCreatingDoc] = useState<boolean>(false);

  // File Deletion Confirmation Modal state (MANDATORY per Workspace guidelines)
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if token already exists in memory
    const token = getDriveAccessToken();
    if (token) {
      setIsAuthenticated(true);
      fetchDriveData();
    } else {
      const unsubscribe = initDriveAuth(
        (_user, _token) => {
          setIsAuthenticated(true);
          fetchDriveData();
        },
        () => {
          setIsAuthenticated(false);
          setAboutInfo(null);
          setFiles([]);
        }
      );
      return () => unsubscribe();
    }
  }, []);

  const fetchDriveData = async (filterCategory = categoryFilter, query = searchQuery) => {
    setLoadingFiles(true);
    setErrorMessage('');
    try {
      const [filesData, aboutData] = await Promise.all([
        listDriveFiles({ query, mimeTypeCategory: filterCategory, pageSize: 40 }),
        getDriveAbout().catch(() => null)
      ]);
      setFiles(filesData);
      if (aboutData) setAboutInfo(aboutData);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to load Google Drive files.');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setErrorMessage('');
    try {
      await signInWithGoogleDrive();
      setIsAuthenticated(true);
      await fetchDriveData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogleDrive();
    setIsAuthenticated(false);
    setAboutInfo(null);
    setFiles([]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDriveData(categoryFilter, searchQuery);
  };

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
    fetchDriveData(cat, searchQuery);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    const file = selectedFiles[0];

    setUploading(true);
    setErrorMessage('');
    setUploadSuccess('');
    try {
      const uploaded = await uploadFileToDrive(file, 'easeLabs');
      setUploadSuccess(`"${uploaded.name}" successfully uploaded to Google Drive!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDriveData();
    } catch (err: any) {
      setErrorMessage(err.message || 'File upload to Google Drive failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    setIsCreatingDoc(true);
    setErrorMessage('');
    try {
      const created = await createDriveTextFile(newDocTitle, newDocContent, newDocType);
      setShowCreateDocModal(false);
      setNewDocTitle('Lab Experiment Report');
      setNewDocContent('');
      setUploadSuccess(`Created "${created.name}" in your Google Drive.`);
      await fetchDriveData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create document in Google Drive.');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      setUploadSuccess(`File "${fileToDelete.name}" removed from Google Drive.`);
      setFileToDelete(null);
      await fetchDriveData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete file from Google Drive.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return <Presentation className="w-5 h-5 text-amber-400" />;
    }
    if (mimeType.includes('image/')) {
      return <ImageIcon className="w-5 h-5 text-rose-400" />;
    }
    if (mimeType.includes('json') || mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('python')) {
      return <FileCode className="w-5 h-5 text-cyan-400" />;
    }
    return <GenericFile className="w-5 h-5 text-neutral-400" />;
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return '';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatModifiedDate = (dateString?: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-6xl h-[90vh] bg-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-8 flex flex-col overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-neutral-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center bg-white/5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 18.5L8.5 11.5H19.5L15.5 18.5H4.5Z" fill="#34A853" />
                <path d="M12.5 4.5L16.5 11.5H23.5L19.5 4.5H12.5Z" fill="#4285F4" />
                <path d="M8.5 11.5L4.5 18.5L1 12.5L7.5 4.5L8.5 11.5Z" fill="#FBBC04" />
                <path d="M12.5 4.5L8.5 11.5L19.5 11.5L23.5 4.5H12.5Z" fill="#EA4335" opacity="0.1" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white font-mono">LAB DRIVE</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-cyan-950 text-cyan-400 border border-cyan-800">
                  GOOGLE WORKSPACE
                </span>
              </div>
              <p className="text-neutral-400 text-xs font-mono tracking-wider mt-0.5">
                CAMPUS LABORATORY CLOUD DOCUMENTATION & EXPERIMENT ARCHIVES
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <button
                onClick={() => fetchDriveData()}
                disabled={loadingFiles}
                title="Refresh Google Drive files"
                className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications Bar */}
        {uploadSuccess && (
          <div className="my-3 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
            <button onClick={() => setUploadSuccess('')} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="my-3 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Not Authenticated Screen */}
        {!isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-xl mx-auto my-auto">
            <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(66,133,244,0.15)]">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 18.5L8.5 11.5H19.5L15.5 18.5H4.5Z" fill="#34A853" />
                <path d="M12.5 4.5L16.5 11.5H23.5L19.5 4.5H12.5Z" fill="#4285F4" />
                <path d="M8.5 11.5L4.5 18.5L1 12.5L7.5 4.5L8.5 11.5Z" fill="#FBBC04" />
              </svg>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">
              CONNECT GOOGLE DRIVE
            </h3>
            <p className="text-sm text-neutral-400 mb-8 font-light leading-relaxed">
              Link your Google account to seamlessly access, upload, and organize laboratory manuals, experiment logs, safety certificates, and research project notes directly within easeLabs.
            </p>

            {/* Official Material Google Sign-In Button */}
            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="px-6 py-3.5 rounded-xl bg-white text-neutral-900 font-semibold text-xs font-mono tracking-wider hover:bg-neutral-200 transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isAuthenticating ? 'CONNECTING WITH GOOGLE...' : 'SIGN IN WITH GOOGLE'}</span>
            </button>

            <div className="mt-8 p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-[11px] text-neutral-500 font-mono">
              Access is granted with permission from your Google account. Tokens are kept securely in-memory and never shared publicly.
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="flex-1 flex flex-col overflow-hidden mt-4">
            {/* User Profile & Actions Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 mb-5">
              {/* Profile Details */}
              <div className="flex items-center gap-3">
                {aboutInfo?.user.photoLink ? (
                  <img
                    src={aboutInfo.user.photoLink}
                    alt={aboutInfo.user.displayName}
                    className="w-10 h-10 rounded-full border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{aboutInfo?.user.displayName || 'Google Drive User'}</h3>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono">{aboutInfo?.user.emailAddress || 'drive-connected'}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs font-mono tracking-wider hover:bg-neutral-200 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'UPLOADING...' : 'UPLOAD TO DRIVE'}</span>
                </button>

                <button
                  onClick={() => setShowCreateDocModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white font-semibold text-xs font-mono tracking-wider hover:bg-neutral-800 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>NEW LAB DOC</span>
                </button>

                <button
                  onClick={handleSignOut}
                  title="Disconnect Google Drive"
                  className="px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">DISCONNECT</span>
                </button>
              </div>
            </div>

            {/* Search & Categories Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 custom-scrollbar">
                {[
                  { id: 'all', label: 'All Files' },
                  { id: 'documents', label: 'Docs & PDFs' },
                  { id: 'spreadsheets', label: 'Sheets & Data' },
                  { id: 'presentations', label: 'Slides' },
                  { id: 'images', label: 'Images' },
                  { id: 'code', label: 'Code & Scripts' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleCategoryChange(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono tracking-wider whitespace-nowrap transition-colors ${
                      categoryFilter === tab.id
                        ? 'bg-white text-black font-semibold'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in Google Drive..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 pl-9 text-white placeholder:text-neutral-600 text-xs font-mono focus:outline-none focus:border-white transition-colors"
                />
              </form>
            </div>

            {/* Files List / Grid */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {loadingFiles ? (
                <div className="flex flex-col items-center justify-center h-64 text-neutral-500 font-mono text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mb-3 text-cyan-400" />
                  <span>FETCHING GOOGLE DRIVE FILES...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-8 rounded-2xl bg-neutral-900/30 border border-neutral-800/60">
                  <HardDrive className="w-10 h-10 text-neutral-600 mb-3" />
                  <p className="text-sm text-neutral-400 font-medium">No files found matching your criteria.</p>
                  <p className="text-xs text-neutral-600 font-mono mt-1">Upload a lab manual or create a new document above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="group bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between hover:border-neutral-700 hover:bg-neutral-900 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 shrink-0">
                            {getFileIcon(file.mimeType)}
                          </div>
                          <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open in Google Drive"
                                className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => setFileToDelete(file)}
                              title="Delete file"
                              className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:border-rose-900/60 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-sm font-semibold text-white truncate group-hover:text-cyan-200 transition-colors" title={file.name}>
                          {file.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 mt-1">
                          {file.size && <span>{formatFileSize(file.size)}</span>}
                          {file.size && file.modifiedTime && <span>•</span>}
                          {file.modifiedTime && <span>{formatModifiedDate(file.modifiedTime)}</span>}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-neutral-800/80 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                        <span className="truncate max-w-[180px]">
                          {file.mimeType.replace('application/vnd.google-apps.', '').replace('application/', '')}
                        </span>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <span>VIEW</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Document Modal */}
        {showCreateDocModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-900 mb-6">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-bold text-white font-mono">CREATE LAB DOCUMENT</h3>
                </div>
                <button
                  onClick={() => setShowCreateDocModal(false)}
                  className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateDocument} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1 uppercase">Document Title</label>
                  <input
                    type="text"
                    required
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="e.g. Physics Lab 04 - Laser Interference Log"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1 uppercase">File Type</label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as any)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
                  >
                    <option value="doc">Google Document (.docx / Doc)</option>
                    <option value="text">Plain Text (.txt)</option>
                    <option value="csv">Data Sheet (.csv)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1 uppercase">Initial Content / Notes</label>
                  <textarea
                    rows={4}
                    value={newDocContent}
                    onChange={(e) => setNewDocContent(e.target.value)}
                    placeholder="Type initial lab observations, equipment checklist, or experiment outline..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setShowCreateDocModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-neutral-900 text-neutral-300 text-xs font-mono hover:bg-neutral-800"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingDoc}
                    className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs font-mono hover:bg-neutral-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50"
                  >
                    {isCreatingDoc ? 'CREATING...' : 'SAVE TO GOOGLE DRIVE'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MANDATORY USER CONFIRMATION DIALOG FOR DESTRUCTIVE OPERATIONS */}
        {fileToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-neutral-950 border border-rose-900/60 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_20px_60px_rgba(244,63,94,0.15)]"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-white mb-2">Delete File from Google Drive?</h3>
              <p className="text-xs text-neutral-300 mb-2 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">"{fileToDelete.name}"</strong>?
              </p>
              <p className="text-[11px] text-neutral-500 font-mono mb-6">
                This action will permanently remove this file from your Google Drive. This cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setFileToDelete(null)}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl bg-neutral-900 text-neutral-300 text-xs font-mono hover:bg-neutral-800 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteFile}
                  disabled={isDeleting}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-semibold text-xs font-mono hover:bg-rose-500 transition-colors shadow-[0_0_20px_rgba(225,29,72,0.3)] disabled:opacity-50"
                >
                  {isDeleting ? 'DELETING...' : 'CONFIRM DELETE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
