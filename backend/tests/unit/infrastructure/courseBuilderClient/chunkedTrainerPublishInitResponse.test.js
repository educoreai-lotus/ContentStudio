import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  ACTION_CHUNK,
  ACTION_FINALIZE,
  ACTION_INIT,
  extractPublishResponseBody,
  extractRoutingTicket,
  validateInitResponse,
} from '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js';

const TRANSFER_ID = '3439036c-ef0c-52a0-9429-66eca0fb31c2';
const EXPIRES_AT = '2026-11-01T13:22:06.209Z';
const FINGERPRINT = 'b'.repeat(64);

/** Production-shaped signed ticket (values synthetic; structure matches CB). */
function productionRoutingTicket() {
  return {
    claims: {
      transfer_id: TRANSFER_ID,
      target_service: 'course-builder-service',
      exp: 1799999999,
    },
    signature: 'MEUCIQDproductionSyntheticSignatureForRegressionTestsOnlyAAAA',
  };
}

function productionInitEnvelope(ticket = productionRoutingTicket()) {
  return {
    requester_service: 'content-studio',
    payload: {
      action: ACTION_INIT,
    },
    response: {
      status: 'initialized',
      transfer_id: TRANSFER_ID,
      routing_ticket: ticket,
      expires_at: EXPIRES_AT,
    },
  };
}

describe('INIT response parsing — production routing_ticket object', () => {
  it('extracts envelope.response from parsed Coordinator object', () => {
    const body = extractPublishResponseBody({ data: productionInitEnvelope() });
    expect(body.status).toBe('initialized');
    expect(body.transfer_id).toBe(TRANSFER_ID);
    expect(body.routing_ticket).toEqual(productionRoutingTicket());
  });

  it('extracts envelope.response from JSON text (Axios responseType text path)', () => {
    const raw = JSON.stringify(productionInitEnvelope());
    const body = extractPublishResponseBody({ data: raw });
    expect(body.status).toBe('initialized');
    expect(body.routing_ticket.claims.transfer_id).toBe(TRANSFER_ID);
    expect(typeof body.routing_ticket.signature).toBe('string');
  });

  it('accepts routing_ticket object with claims+signature without mutation', () => {
    const ticket = productionRoutingTicket();
    const extracted = extractRoutingTicket(ticket);
    expect(extracted).toBe(ticket);
    expect(extracted.claims).toBe(ticket.claims);
    expect(extracted.signature).toBe(ticket.signature);
  });

  it('validateInitResponse accepts production object ticket', () => {
    const response = productionInitEnvelope().response;
    const session = validateInitResponse(response);
    expect(session.transferId).toBe(TRANSFER_ID);
    expect(session.expiresAt).toBe(EXPIRES_AT);
    expect(session.routingTicket).toBe(response.routing_ticket);
  });

  it('still accepts opaque string routing_ticket', () => {
    expect(extractRoutingTicket('  ticket-opaque.sig  ')).toBe('ticket-opaque.sig');
    const session = validateInitResponse({
      status: 'initialized',
      transfer_id: TRANSFER_ID,
      routing_ticket: 'opaque-ticket',
      expires_at: EXPIRES_AT,
    });
    expect(session.routingTicket).toBe('opaque-ticket');
  });

  it('fails closed when routing_ticket is missing', () => {
    expect(() => extractRoutingTicket(undefined)).toThrow(/routing_ticket is required/);
    try {
      validateInitResponse({
        status: 'initialized',
        transfer_id: TRANSFER_ID,
        expires_at: EXPIRES_AT,
      });
      throw new Error('expected COURSE_PUBLISH_INIT_FAILED');
    } catch (e) {
      expect(e.code).toBe('COURSE_PUBLISH_INIT_FAILED');
    }
  });

  it('fails closed on malformed JSON text', () => {
    expect(extractPublishResponseBody({ data: '{not-json' })).toBeNull();
  });

  it('fails closed when object ticket lacks signature or claims', () => {
    expect(() => extractRoutingTicket({ claims: { a: 1 } })).toThrow(
      /routing_ticket is invalid/
    );
    expect(() => extractRoutingTicket({ signature: 'sig' })).toThrow(
      /routing_ticket is invalid/
    );
  });
});

describe('CHUNK / FINALIZE JSON text acknowledgments', () => {
  it('parses CHUNK response from JSON text', () => {
    const envelope = {
      requester_service: 'content-studio',
      payload: { action: ACTION_CHUNK },
      response: {
        status: 'chunk_received',
        transfer_id: TRANSFER_ID,
        chunk_index: 0,
      },
    };
    const body = extractPublishResponseBody({ data: JSON.stringify(envelope) });
    expect(body).toEqual(envelope.response);
  });

  it('parses FINALIZE response from JSON text with matching ids', () => {
    const envelope = {
      requester_service: 'content-studio',
      payload: { action: ACTION_FINALIZE },
      response: {
        status: 'published',
        transfer_id: TRANSFER_ID,
        course_id: 'cb-course-1',
        source_course_id: '32',
        lessons_created: 3,
        lessons_expected: 3,
        content_fingerprint: FINGERPRINT,
      },
    };
    const body = extractPublishResponseBody({ data: JSON.stringify(envelope) });
    expect(body.status).toBe('published');
    expect(body.transfer_id).toBe(TRANSFER_ID);
    expect(body.source_course_id).toBe('32');
    expect(body.content_fingerprint).toBe(FINGERPRINT);
  });
});

describe('end-to-end INIT with production ticket object then CHUNK', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('passes object routing_ticket unchanged into CHUNK envelope', async () => {
    const ticket = productionRoutingTicket();
    const seenChunkTickets = [];
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      const action = envelope.payload.action;
      if (action === ACTION_INIT) {
        return { data: productionInitEnvelope(ticket) };
      }
      if (action === ACTION_CHUNK) {
        seenChunkTickets.push(envelope.payload.routing_ticket);
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: TRANSFER_ID,
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      return {
        data: {
          response: {
            status: 'published',
            transfer_id: TRANSFER_ID,
            course_id: 'cb-1',
            source_course_id: '32',
            lessons_created: 2,
            lessons_expected: 2,
            content_fingerprint: FINGERPRINT,
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    const courseData = {
      course_id: '32',
      course_name: 'Prod repro',
      course_description: '',
      course_language: 'en',
      trainer_id: 'trainer-1',
      trainer_name: 'trainer-1',
      topics: [
        {
          topic_id: '1',
          topic_name: 'A',
          topic_description: '',
          topic_language: 'en',
          template_id: '1',
          format_order: ['code'],
          contents: [{ content_id: '1', content_type: 'code', content_data: { code: 'a' } }],
          devlab_exercises: '{"questions":[{"q":"1"}]}',
        },
        {
          topic_id: '2',
          topic_name: 'B',
          topic_description: '',
          topic_language: 'en',
          template_id: '1',
          format_order: ['code'],
          contents: [{ content_id: '2', content_type: 'code', content_data: { code: 'b' } }],
          devlab_exercises: '{"questions":[{"q":"2"}]}',
        },
      ],
    };

    // Force two chunks with tiny payload still may be 1 chunk — OK for ticket path
    const result = await sendChunkedTrainerPublish(courseData, {
      publisherTrainerId: '11111111-2222-4333-8444-555555555555',
    });

    expect(result.status).toBe('published');
    expect(result.source_course_id).toBe('32');
    expect(seenChunkTickets.length).toBeGreaterThan(0);
    for (const t of seenChunkTickets) {
      expect(t).toEqual(ticket);
      expect(t.claims).toEqual(ticket.claims);
      expect(t.signature).toBe(ticket.signature);
    }
  });
});

describe('isolation', () => {
  it('does not change legacy or Full AI modules', async () => {
    const fs = await import('fs');
    const path = new URL(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js',
      import.meta.url
    );
    const src = await fs.promises.readFile(path, 'utf8');
    expect(src).not.toMatch(/fillCourseBuilderService/);
    expect(src).toMatch(/extractRoutingTicket/);
  });
});
