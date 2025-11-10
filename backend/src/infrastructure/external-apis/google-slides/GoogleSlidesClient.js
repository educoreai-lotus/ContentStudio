import { google } from 'googleapis';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
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

  async createPresentation({ lessonTopic, slides, accentColor = '#00B894' }) {
    if (!this.enabled) {
      throw new Error('Google Slides client not enabled');
    }

    if (!Array.isArray(slides) || slides.length === 0) {
      throw new Error('Slides data is required to create presentation');
    }

    // 1. Create presentation
    const createResponse = await this.slides.presentations.create({
      requestBody: {
        title: `Lesson - ${lessonTopic}`,
      },
    });

    const presentationId = createResponse.data.presentationId;
    let existingSlides = createResponse.data.slides || [];

    // 2. Create additional slides if needed
    const requests = [];

    // Ensure we have enough slides (Google creates a default first slide)
    for (let i = 1; i < slides.length; i += 1) {
      requests.push({
        createSlide: {
          objectId: `slide_${i + 1}`,
          insertionIndex: i,
          slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
        },
      });
    }

    // Apply white background to all slides
    requests.push(
      ...slides.map((_, index) => ({
        updatePageProperties: {
          objectId: index === 0
            ? existingSlides[0]?.objectId
            : `slide_${index + 1}`,
          fields: 'pageBackgroundFill.solidFill.color',
          pageProperties: {
            pageBackgroundFill: {
              solidFill: {
                color: this.hexToColor('#FFFFFF'),
              },
            },
          },
        },
      })),
    );

    if (requests.length > 0) {
      await this.slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests },
      });
    }

    // Fetch updated presentation to get slide placeholders
    const presentation = await this.slides.presentations.get({
      presentationId,
    });

    existingSlides = presentation.data.slides || [];

    const textRequests = [];

    slides.forEach((slide, index) => {
      const slideObject = existingSlides[index];
      if (!slideObject) return;

      const titleShape = slideObject.pageElements?.find(
        el => el.shape?.placeholder?.type === 'TITLE',
      );
      const bodyShape = slideObject.pageElements?.find(
        el => el.shape?.placeholder?.type === 'BODY',
      );

      if (titleShape) {
        textRequests.push(
          this.buildDeleteTextRequest(titleShape.objectId),
          this.buildInsertTextRequest(titleShape.objectId, slide.title || `Slide ${index + 1}`),
          this.buildUpdateTextStyleRequest(titleShape.objectId, 32, {
            bold: true,
            color: accentColor,
          }),
        );
      }

      if (bodyShape) {
        const bulletText = Array.isArray(slide.points)
          ? slide.points.filter(Boolean).join('\n')
          : '';

        textRequests.push(this.buildDeleteTextRequest(bodyShape.objectId));

        if (bulletText) {
          textRequests.push(
            this.buildInsertTextRequest(bodyShape.objectId, bulletText),
            {
              createParagraphBullets: {
                objectId: bodyShape.objectId,
                textRange: { type: 'ALL' },
                bulletPreset: 'BULLET_DISC',
              },
            },
            this.buildUpdateTextStyleRequest(bodyShape.objectId, 20, {
              color: '#333333',
            }),
          );
        }
      }
    });

    if (textRequests.length > 0) {
      await this.slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: textRequests },
      });
    }

    // 3. Share presentation publicly
    await this.drive.permissions.create({
      fileId: presentationId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
        allowFileDiscovery: false,
      },
      supportsAllDrives: true,
    });

    const publicUrl = `https://docs.google.com/presentation/d/${presentationId}/edit?usp=sharing`;
    console.log('[GoogleSlidesClient] Presentation shared publicly:', publicUrl);

    return {
      presentationId,
      publicUrl,
    };
  }

  buildDeleteTextRequest(objectId) {
    return {
      deleteText: {
        objectId,
        textRange: { type: 'ALL' },
      },
    };
  }

  buildInsertTextRequest(objectId, text) {
    return {
      insertText: {
        objectId,
        insertionIndex: 0,
        text,
      },
    };
  }

  buildUpdateTextStyleRequest(objectId, fontSize, options = {}) {
    return {
      updateTextStyle: {
        objectId,
        textRange: { type: 'ALL' },
        style: {
          fontSize: {
            magnitude: fontSize,
            unit: 'PT',
          },
          ...(options.bold !== undefined ? { bold: options.bold } : {}),
          ...(options.color
            ? {
                foregroundColor: {
                  opaqueColor: {
                    rgbColor: this.hexToColor(options.color),
                  },
                },
              }
            : {}),
        },
        fields: [
          'fontSize',
          options.bold !== undefined ? 'bold' : null,
          options.color ? 'foregroundColor' : null,
        ]
          .filter(Boolean)
          .join(','),
      },
    };
  }

  hexToColor(hex) {
    const color = hex.replace('#', '');
    const bigint = parseInt(color, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return {
      red: r / 255,
      green: g / 255,
      blue: b / 255,
    };
  }
}

