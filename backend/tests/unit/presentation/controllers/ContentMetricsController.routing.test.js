import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fillCourseBuilderService } from '../../../../src/application/services/fillers/fillCourseBuilderService.js';
import { personalizedGenerationJobService } from '../../../../src/application/services/personalizedGenerationJobService.js';
import { PersonalizedGenerationWorker } from '../../../../src/infrastructure/jobs/PersonalizedGenerationWorker.js';

const controllerSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../../src/presentation/controllers/ContentMetricsController.js'),
  'utf8'
);

describe('ContentMetricsController course-builder-service routing', () => {
  it('keeps the course-builder alias on handleCourseBuilderFormat', () => {
    const aliasIndex = controllerSrc.indexOf("requesterService === 'course-builder'");
    const asyncCaseIndex = controllerSrc.indexOf("case 'course-builder-service'");
    expect(aliasIndex).toBeGreaterThan(-1);
    expect(asyncCaseIndex).toBeGreaterThan(aliasIndex);
    expect(controllerSrc).toContain('return await this.handleCourseBuilderFormat(requestBody, res, next, req);');
  });

  it('routes only course-builder-service through the additive job service', () => {
    expect(controllerSrc).toContain('executeCourseBuilderServiceRequest(requestBody)');
    expect(controllerSrc.match(/executeCourseBuilderServiceRequest/g).length).toBe(2);
    expect(controllerSrc).toContain("case 'directory':");
    expect(controllerSrc).toContain('filledData = await fillDirectory(parsedPayload);');
    expect(controllerSrc).toContain('filledData = await fillCourseBuilder(parsedPayload);');
    expect(controllerSrc).toContain('filledData = await fillDevLab(parsedPayload);');
  });

  it('reuses fillCourseBuilderService for legacy sync and worker execution', () => {
    expect(personalizedGenerationJobService.fillCourseBuilderServiceFn).toBe(fillCourseBuilderService);
    const worker = new PersonalizedGenerationWorker();
    expect(worker.fillCourseBuilderServiceFn).toBe(fillCourseBuilderService);
  });
});
