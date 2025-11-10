import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

router.get('/google-drive', async (req, res) => {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return res.status(400).json({
      success: false,
      message: 'GOOGLE_SERVICE_ACCOUNT_JSON is not configured.',
    });
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    const folderId = process.env.GOOGLE_SLIDES_FOLDER_ID;
    let folderCheck = null;

    if (folderId) {
      folderCheck = await drive.files.get({
        fileId: folderId,
        fields: 'id, name',
        supportsAllDrives: true,
      });
    }

    const tempName = `debug-check-${Date.now()}`;
    const createResponse = await drive.files.create({
      requestBody: {
        name: tempName,
        mimeType: 'application/vnd.google-apps.presentation',
        ...(folderId ? { parents: [folderId] } : {}),
      },
      supportsAllDrives: true,
      fields: 'id',
    });

    const presentationId = createResponse.data.id;

    await drive.files.delete({ fileId: presentationId, supportsAllDrives: true });

    return res.json({
      success: true,
      message: 'Service account can create and delete presentations successfully.',
      folder: folderCheck ? { id: folderCheck.data.id, name: folderCheck.data.name } : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Google Drive debug check failed',
      error: error.response?.data || error.message,
    });
  }
});

export default router;
