import { google } from 'googleapis';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
];

export class GoogleSlidesClient {
  constructor({ serviceAccountJson }) {
    if (!serviceAccountJson) {
      console.warn('[GoogleSlidesClient] Service account JSON not provided. Google Slides integration disabled.');
      this.enabled = false;
      return;
    }

    try {
      this.credentials = typeof serviceAccountJson === 'string'
        ? JSON.parse(serviceAccountJson)
        : serviceAccountJson;
    } catch (error) {
      console.error('[GoogleSlidesClient] Failed to parse service account JSON:', error.message);
      this.enabled = false;
      return;
    }

    this.auth = new google.auth.GoogleAuth({
      credentials: this.credentials,
      scopes: DEFAULT_SCOPES,
    });

    this.slides = google.slides({ version: 'v1', auth: this.auth });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.enabled = true;
  }

  isEnabled() {
    return this.enabled;
  }

  async createPresentation({ lessonTopic, slides }) {
    if (!this.enabled) {
      throw new Error('Google Slides client not enabled');
    }

    if (!Array.isArray(slides) || slides.length === 0) {
      throw new Error('Slides data is required to create presentation');
    }

    const title = lessonTopic ? `Lesson - ${lessonTopic}` : 'EduCore Lesson Deck';
    const folderId = process.env.GOOGLE_SLIDES_FOLDER_ID;
    if (folderId) {
      try {
        console.log('[GoogleSlidesClient] Verifying folder access...');
        const folderCheck = await this.drive.files.get({
          fileId: folderId,
          fields: 'id, name',
          supportsAllDrives: true,
        });
        console.log('[GoogleSlidesClient] Folder access OK:', folderCheck.data.name);
      } catch (error) {
        console.error('[GoogleSlidesClient] Service Account CANNOT ACCESS folder:', error.response?.data || error.message);
        throw new Error('Service Account has no access to shared folder');
      }
    } else {
      console.log('[GoogleSlidesClient] No GOOGLE_SLIDES_FOLDER_ID set – creating file in Service Account root Drive.');
    }
    let presentationId = null;

    try {
      const creationScopeMessage = folderId
        ? '[GoogleSlidesClient] Step 1: Creating Drive file (presentation) in shared folder...'
        : '[GoogleSlidesClient] Step 1: Creating Drive file (presentation) in Service Account root...';
      console.log(creationScopeMessage);
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: title,
          mimeType: 'application/vnd.google-apps.presentation',
          ...(folderId ? { parents: [folderId] } : {}),
        },
        supportsAllDrives: true,
        auth: this.auth,
      });
      presentationId = createResponse.data.id;
      if (folderId) {
        console.log('[GoogleSlidesClient] Presentation created successfully in shared folder.');
      } else {
        console.log('[GoogleSlidesClient] Presentation created successfully inside Service Account Drive.');
      }
    } catch (error) {
      console.error('[GoogleSlidesClient] FAILED at Step 1 (drive.files.create):', error.response?.data || error.message);
      throw error;
    }

    let presentation;
    let firstSlide;
    try {
      console.log('[GoogleSlidesClient] Step 2: Fetching initial slide data');
      presentation = await this.slides.presentations.get({ presentationId });
      firstSlide = presentation.data.slides?.[0];
    } catch (error) {
      console.error('[GoogleSlidesClient] FAILED at Step 2 (presentations.get):', error.response?.data || error.message);
      throw error;
    }

    const requests = [];

    if (firstSlide?.pageElements?.length) {
      firstSlide.pageElements.forEach(element => {
        if (element.objectId) {
          requests.push({ deleteObject: { objectId: element.objectId } });
        }
      });
    }

    const SLIDE_WIDTH = 9144000; // 10 in
    const SLIDE_HEIGHT = 6858000; // 7.5 in

    slides.forEach((slide, index) => {
      const slideObjectId = index === 0 ? firstSlide?.objectId || 'p' : `slide_${index + 1}`;

      if (index > 0) {
        requests.push({
          createSlide: {
            objectId: slideObjectId,
            slideLayoutReference: { predefinedLayout: 'BLANK' },
          },
        });
      }

      const titleShapeId = `title_${index + 1}`;
      const bodyShapeId = `body_${index + 1}`;

      requests.push({
        createShape: {
          objectId: titleShapeId,
          shapeType: 'TEXT_BOX',
          elementProperties: {
            pageObjectId: slideObjectId,
            size: {
              width: { magnitude: SLIDE_WIDTH * 0.75, unit: 'EMU' },
              height: { magnitude: 685800, unit: 'EMU' },
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              shearX: 0,
              shearY: 0,
              translateX: SLIDE_WIDTH * 0.125,
              translateY: SLIDE_HEIGHT * 0.1,
              unit: 'EMU',
            },
          },
        },
      });

      requests.push({
        insertText: {
          objectId: titleShapeId,
          insertionIndex: 0,
          text: (slide.title || `Slide ${index + 1}`).trim(),
        },
      });

      requests.push({
        updateTextStyle: {
          objectId: titleShapeId,
          textRange: { type: 'ALL' },
          style: {
            bold: true,
            fontSize: { magnitude: 32, unit: 'PT' },
          },
          fields: 'bold,fontSize',
        },
      });

      requests.push({
        updateParagraphStyle: {
          objectId: titleShapeId,
          textRange: { type: 'ALL' },
          style: { alignment: 'CENTER' },
          fields: 'alignment',
        },
      });

      const bulletText = Array.isArray(slide.content)
        ? slide.content.map(line => String(line).trim()).filter(Boolean).join('\n')
        : '';

      requests.push({
        createShape: {
          objectId: bodyShapeId,
          shapeType: 'TEXT_BOX',
          elementProperties: {
            pageObjectId: slideObjectId,
            size: {
              width: { magnitude: SLIDE_WIDTH * 0.75, unit: 'EMU' },
              height: { magnitude: SLIDE_HEIGHT * 0.6, unit: 'EMU' },
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              shearX: 0,
              shearY: 0,
              translateX: SLIDE_WIDTH * 0.125,
              translateY: SLIDE_HEIGHT * 0.25,
              unit: 'EMU',
            },
          },
        },
      });

      if (bulletText) {
        requests.push({
          insertText: {
            objectId: bodyShapeId,
            insertionIndex: 0,
            text: bulletText,
          },
        });

        requests.push({
          createParagraphBullets: {
            objectId: bodyShapeId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC',
          },
        });
      }

      requests.push({
        updateTextStyle: {
          objectId: bodyShapeId,
          textRange: { type: 'ALL' },
          style: {
            fontSize: { magnitude: 20, unit: 'PT' },
          },
          fields: 'fontSize',
        },
      });
    });

    if (requests.length > 0) {
      try {
        console.log('[GoogleSlidesClient] Step 3: Applying slide updates');
        await this.slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });
      } catch (error) {
        console.error('[GoogleSlidesClient] FAILED at Step 3 (presentations.batchUpdate):', error.response?.data || error.message);
        throw error;
      }
    }

    let publicUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

    try {
      console.log('[GoogleSlidesClient] Step 4: Setting permissions for public access');
      await this.drive.permissions.create({
        fileId: presentationId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
          allowFileDiscovery: false,
        },
        sendNotificationEmail: false,
      });
      console.log('[GoogleSlidesClient] Presentation shared publicly:', publicUrl);
    } catch (error) {
      console.warn('[GoogleSlidesClient] WARNING: failed to make file public. Returning URL anyway.', error.response?.data || error.message);
    }

    return {
      presentationId,
      publicUrl,
    };
  }
}

