import { db } from '../../src/infrastructure/database/DatabaseConnection.js';
import { RepositoryFactory } from '../../src/infrastructure/database/repositories/RepositoryFactory.js';
import { CourseRepository } from '../../src/infrastructure/database/repositories/CourseRepository.js';
import { TopicRepository } from '../../src/infrastructure/database/repositories/TopicRepository.js';
import { ContentRepository } from '../../src/infrastructure/database/repositories/ContentRepository.js';
import { TemplateRepository } from '../../src/infrastructure/database/repositories/TemplateRepository.js';
import { ContentVersionRepository } from '../../src/infrastructure/database/repositories/ContentVersionRepository.js';
import { QualityCheckRepository } from '../../src/infrastructure/database/repositories/QualityCheckRepository.js';
import { ExerciseRepository } from '../../src/infrastructure/database/repositories/ExerciseRepository.js';

const inMemorySingletons = {};

function wrapFactoryMethod(methodName, createInstance) {
  const original = RepositoryFactory[methodName].bind(RepositoryFactory);
  RepositoryFactory[methodName] = async function patchedRepositoryFactoryMethod() {
    await db.ready;
    if (!db.isConnected()) {
      if (!inMemorySingletons[methodName]) {
        inMemorySingletons[methodName] = createInstance();
      }
      return inMemorySingletons[methodName];
    }
    return original();
  };
}

/**
 * In test runs without DATABASE_URL, RepositoryFactory otherwise returns a new
 * in-memory repository on every call. Routes and OwnershipService then see
 * different stores. Singletons mirror PostgreSQL shared-database behaviour.
 */
export function patchRepositoryFactoryForTests() {
  wrapFactoryMethod('getCourseRepository', () => new CourseRepository(null));
  wrapFactoryMethod('getTopicRepository', () => new TopicRepository(null));
  wrapFactoryMethod('getContentRepository', () => new ContentRepository());
  wrapFactoryMethod('getTemplateRepository', () => new TemplateRepository());
  wrapFactoryMethod('getContentVersionRepository', () => new ContentVersionRepository());
  wrapFactoryMethod('getQualityCheckRepository', () => new QualityCheckRepository());
  wrapFactoryMethod('getExerciseRepository', () => new ExerciseRepository(null));
}

export function resetInMemoryRepositorySingletons() {
  Object.keys(inMemorySingletons).forEach(key => {
    delete inMemorySingletons[key];
  });
}
