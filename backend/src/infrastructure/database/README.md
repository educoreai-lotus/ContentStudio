# Database Integration

## Overview

Content Studio supports both PostgreSQL (production) and in-memory (development/testing) repositories.

## Architecture

- **DatabaseConnection**: Singleton connection pool manager
- **RepositoryFactory**: Factory pattern for repository selection
- **PostgreSQL Repositories**: Full database implementations
- **In-Memory Repositories**: Fallback for development

## Usage

### Environment Setup

Set `DATABASE_URL` environment variable:

```env
DATABASE_URL=postgresql://user:password@host:port/content_studio
```

### Repository Factory

```javascript
import { RepositoryFactory } from './repositories/RepositoryFactory.js';

// Automatically uses PostgreSQL if DATABASE_URL is set, otherwise in-memory
const courseRepository = RepositoryFactory.getCourseRepository();
```

### Database Connection

```javascript
import { db } from './DatabaseConnection.js';

// Test connection
const isConnected = await db.testConnection();

// Execute query
const result = await db.query('SELECT * FROM trainer_courses WHERE course_id = $1', [1]);
```

## Current Status

### ✅ Implemented
- DatabaseConnection singleton
- RepositoryFactory
- PostgreSQLCourseRepository
- Automatic fallback to in-memory if DATABASE_URL not set

### ⏳ TODO
- PostgreSQLTopicRepository
- PostgreSQLContentRepository
- PostgreSQLTemplateRepository
- PostgreSQLContentVersionRepository
- PostgreSQLQualityCheckRepository

## Migration

Run the migration script to create database schema:

```bash
psql -U postgres -d content_studio -f database/migrations/migration.sql
```

Or use the migration file directly in your database client.

## Connection Pooling

The connection pool is configured with:
- **Max connections**: 20
- **Idle timeout**: 30 seconds
- **Connection timeout**: 2 seconds
- **SSL**: Enabled in production

## Error Handling

- If `DATABASE_URL` is not set, repositories automatically fall back to in-memory
- Connection errors are logged and handled gracefully
- Slow queries (>1s) are logged as warnings



