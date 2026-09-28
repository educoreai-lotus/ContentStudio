import { describe, it, expect } from '@jest/globals';
import { isTrainerNarratedPresentationEnabled } from '../../../../src/application/use-cases/trainerNarratedPresentationConfig.js';

describe('isTrainerNarratedPresentationEnabled', () => {
  it('defaults to false', () => {
    expect(isTrainerNarratedPresentationEnabled({})).toBe(false);
    expect(
      isTrainerNarratedPresentationEnabled({
        TRAINER_NARRATED_PRESENTATION_ENABLED: 'false',
      })
    ).toBe(false);
    expect(
      isTrainerNarratedPresentationEnabled({
        TRAINER_NARRATED_PRESENTATION_ENABLED: '1',
      })
    ).toBe(false);
  });

  it('enables only when exactly true', () => {
    expect(
      isTrainerNarratedPresentationEnabled({
        TRAINER_NARRATED_PRESENTATION_ENABLED: 'true',
      })
    ).toBe(true);
  });

  it('does not reuse Personalized or V2L flag names', () => {
    expect(
      isTrainerNarratedPresentationEnabled({
        PERSONALIZED_NARRATED_PRESENTATION_ENABLED: 'true',
      })
    ).toBe(false);
    expect(
      isTrainerNarratedPresentationEnabled({
        VIDEO_TO_LESSON_NARRATED_PRESENTATION_ENABLED: 'true',
      })
    ).toBe(false);
  });
});
