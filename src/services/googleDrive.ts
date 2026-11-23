import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance safely (singleton pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

const provider = new GoogleAuthProvider();
GOOGLE_DRIVE_SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

// Flag to track ongoing sign-in flow
let isSigningIn = false;
// In-memory token cache (Do NOT store in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: FirebaseUser; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not retrieve access token from Google sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const signOutGoogleDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  size?: string;
  modifiedTime?: string;
  shared?: boolean;
}

export interface DriveAboutInfo {
  user: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
  storageQuota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
  };
}

export const getDriveAbout = async (): Promise<DriveAboutInfo | null> => {
  const token = getDriveAccessToken();
  if (!token) return null;
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('Failed to fetch Google Drive user details');
  }
  return await res.json();
};

export const listDriveFiles = async (params?: {
  query?: string;
  mimeTypeCategory?: string;
  pageSize?: number;
}): Promise<DriveFile[]> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const conditions = ['trashed = false'];
  if (params?.query) {
    const sanitized = params.query.replace(/'/g, "\\'");
    conditions.push(`name contains '${sanitized}'`);
  }

  if (params?.mimeTypeCategory && params.mimeTypeCategory !== 'all') {
    switch (params.mimeTypeCategory) {
      case 'documents':
        conditions.push("(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/pdf' or mimeType contains 'text/' or mimeType contains 'word')");
        break;
      case 'spreadsheets':
        conditions.push("(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType contains 'sheet' or mimeType contains 'excel' or mimeType = 'text/csv')");
        break;
      case 'presentations':
        conditions.push("(mimeType = 'application/vnd.google-apps.presentation' or mimeType contains 'presentation' or mimeType contains 'powerpoint')");
        break;
      case 'images':
        conditions.push("mimeType contains 'image/'");
        break;
      case 'code':
        conditions.push("(mimeType contains 'json' or mimeType contains 'javascript' or mimeType contains 'python' or mimeType contains 'xml' or name contains '.py' or name contains '.cpp' or name contains '.ts')");
        break;
    }
  }

  const q = encodeURIComponent(conditions.join(' and '));
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,webContentLink,iconLink,thumbnailLink,size,modifiedTime,shared)');
  const pageSize = params?.pageSize || 40;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=${pageSize}&orderBy=modifiedTime desc`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Failed to list Google Drive files');
  }

  const data = await res.json();
  return data.files || [];
};

export const uploadFileToDrive = async (
  file: File,
  folderName: string = 'easeLabs Resources'
): Promise<DriveFile> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    description: `Uploaded via easeLabs Resource Hub (${folderName})`
  };

  const boundary = '-------easeLabsDriveUploadBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  const fileDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const fileBytes = await fileDataPromise;

  const metadataPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n';

  // Base64 encoding of file content
  let binary = '';
  const bytes = new Uint8Array(fileBytes);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  const multipartRequestBody = metadataPart + base64Data + closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,modifiedTime', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to upload file to Google Drive');
  }

  return await res.json();
};

export const createDriveTextFile = async (
  title: string,
  content: string,
  type: 'doc' | 'text' | 'csv' = 'doc'
): Promise<DriveFile> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  let mimeType = 'text/plain';
  let fileName = title;
  if (type === 'doc') {
    mimeType = 'application/vnd.google-apps.document';
    if (!fileName.endsWith('.docx') && !fileName.endsWith('.doc')) {
      fileName = `${title}`;
    }
  } else if (type === 'csv') {
    mimeType = 'text/csv';
    if (!fileName.endsWith('.csv')) fileName += '.csv';
  } else {
    if (!fileName.endsWith('.txt')) fileName += '.txt';
  }

  const metadata = {
    name: fileName,
    mimeType: type === 'doc' ? 'application/vnd.google-apps.document' : mimeType,
    description: 'Created with easeLabs Campus Laboratory Portal'
  };

  const boundary = '-------easeLabsTextBoundary' + Math.random().toString(36).substring(2);
  const multipartBody =
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${type === 'doc' ? 'text/plain' : mimeType}; charset=UTF-8\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,modifiedTime', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create file in Google Drive');
  }

  return await res.json();
};

export const deleteDriveFile = async (fileId: string): Promise<void> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to delete file from Google Drive');
  }
};
