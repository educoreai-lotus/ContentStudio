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

    const createResponse = await this.slides.presentations.create({
      requestBody: { title },
    });

    const presentationId = createResponse.data.presentationId;
    const presentation = await this.slides.presentations.get({ presentationId });
    const firstSlide = presentation.data.slides?.[0];

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
      await this.slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests },
      });
    }

    await this.drive.permissions.create({
      fileId: presentationId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
        allowFileDiscovery: false,
      },
      supportsAllDrives: true,
      sendNotificationEmail: false,
    });

    const publicUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    console.log('[GoogleSlidesClient] Presentation shared publicly:', publicUrl);

    return {
      presentationId,
      publicUrl,
    };
  }
}

