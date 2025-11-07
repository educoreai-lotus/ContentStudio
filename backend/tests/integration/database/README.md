# PostgreSQL Integration Tests

## Overview

These tests verify that all PostgreSQL repositories work correctly with an actual database.

## Prerequisites

1. **PostgreSQL Database** - Running PostgreSQL instance
2. **Database URL** - Connection string in format:
   ```
   postgresql://username:password@host:port/database_name
   ```

## Setup

### 1. Create Test Database

```sql
CREATE DATABASE content_studio_test;
```

### 2. Run Migrations

```bash
# Set DATABASE_URL
export DATABASE_URL=postgresql://user:password@localhost:5432/content_studio_test

# Run migrations
psql $DATABASE_URL -f database/migrations/migration.sql
psql $DATABASE_URL -f database/migrations/add_language_stats.sql
psql $DATABASE_URL -f database/migrations/add_cleanup_functions.sql
```

### 3. Run Tests

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL=postgresql://user:password@localhost:5432/content_studio_test

# Run PostgreSQL integration tests
npm test -- tests/integration/database/postgresql.test.js
```

## Test Coverage

### Repositories Tested

1. **PostgreSQLCourseRepository**
   - Create course
   - Find by ID
   - Update course
   - Delete course (soft delete)

2. **PostgreSQLTopicRepository**
   - Create topic
   - Find by course ID

3. **PostgreSQLContentRepository**
   - Create content
   - Find by topic ID

4. **PostgreSQLTemplateRepository**
   - Create template
   - Find all templates

5. **PostgreSQLContentVersionRepository**
   - Create version
   - Find by content ID

6. **PostgreSQLQualityCheckRepository**
   - Create quality check
   - Find by content ID

## Test Data Cleanup

Tests automatically clean up test data after execution. Test data is identified by `created_by = 'test-user'`.

## Skipping Tests

If `DATABASE_URL` is not set, tests will be skipped with a warning message. This allows the test suite to run in environments without a database connection.

## CI/CD Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Setup PostgreSQL
  uses: actions/setup-postgresql@v1
  with:
    postgresql-version: '14'

- name: Run migrations
  run: |
    psql $DATABASE_URL -f database/migrations/migration.sql

- name: Run PostgreSQL tests
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/content_studio_test
  run: npm test -- tests/integration/database/postgresql.test.js
```

## Troubleshooting

### Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check connection string format
- Verify database exists
- Check user permissions

### Migration Issues

- Ensure all migrations are run
- Check for foreign key constraints
- Verify table structure matches expectations

### Test Failures

- Check database logs
- Verify test data cleanup
- Ensure no concurrent test runs
- Check for constraint violations

