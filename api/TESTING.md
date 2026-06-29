# Testing Guide

This document explains how to run and write tests for the Notedrill API.

## Setup

### 1. Install Test Dependencies

```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### 2. Configure Test Database

Copy the test environment file:
```bash
cp .env.test.example .env.test
```

Update `.env.test` with your test MongoDB connection string:
```env
MONGODB_URI_TEST=mongodb://localhost:27017/notedrill-test
```

**Important:** Use a separate database for testing to avoid affecting your development or production data.

### 3. Start MongoDB

Make sure MongoDB is running:
```bash
# For local MongoDB
mongod

# Or use Docker
docker run -d -p 27017:27017 --name mongodb-test mongo:latest
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- note.routes.test
```

### Run Tests in CI Mode
```bash
npm run test:ci
```

## Test Structure

```
apps/api/src/tests/
├── setup.ts              # Test configuration and mocks
├── note.routes.test.ts   # Note endpoint tests
└── ...                   # Other test files
```

## Writing Tests

### Test Template

```typescript
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server';

describe('Feature Name', () => {
  beforeAll(async () => {
    // Setup - create test data
  });

  afterAll(async () => {
    // Cleanup - delete test data
    await mongoose.connection.close();
  });

  describe('GET /api/v1/endpoint', () => {
    it('should return expected result', async () => {
      const response = await request(app)
        .get('/api/v1/endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

## Test Coverage

### Current Endpoints Tested

#### Note Endpoints
- ✅ `POST /api/v1/notes/generate` - Generate note from content/file
- ✅ `GET /api/v1/notes/search` - Search notes with filters
- ✅ `PUT /api/v1/notes/:id/enhance` - Enhance note with AI
- ✅ `POST /api/v1/notes/:id/move` - Move note to folder

#### Folder Endpoints
- ✅ `PUT /api/v1/folders/:id` - Update folder

### Coverage Goals
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

## Mocked Services

The following external services are mocked in tests:
- Gemini AI service (note generation)
- Storage service (MinIO/file upload)
- PDF extraction service
- Audio transcription service

This allows tests to run without requiring external API keys or services.

## Test Environment Variables

Tests use separate environment variables defined in `.env.test`:

```env
NODE_ENV=test
MONGODB_URI_TEST=mongodb://localhost:27017/notedrill-test
JWT_SECRET=test-jwt-secret-key
JWT_REFRESH_SECRET=test-jwt-refresh-secret-key
```

## Best Practices

### 1. Isolation
- Each test should be independent
- Clean up test data after each test
- Don't rely on test execution order

### 2. Naming
- Use descriptive test names: `should return 404 when note not found`
- Group related tests with `describe` blocks

### 3. Assertions
- Test both success and failure cases
- Verify response status, body structure, and data
- Check error messages for clarity

### 4. Authentication
- Test both authenticated and unauthenticated requests
- Verify authorization (user can only access their own data)

### 5. Data
- Use meaningful test data
- Create minimal test data needed for each test
- Clean up after tests

## Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test
```bash
npm test -- -t "should search notes by query"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open Chrome DevTools and connect to the debugger.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:ci
        env:
          MONGODB_URI_TEST: mongodb://localhost:27017/notedrill-test
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret
```

## Troubleshooting

### Tests Hang or Timeout
- Ensure MongoDB is running
- Check for missing `await` in async operations
- Verify all database connections are closed in `afterAll`

### Connection Errors
- Verify `MONGODB_URI_TEST` is correct
- Ensure MongoDB is accessible
- Check firewall settings

### Mock Issues
- Verify mocks in `src/tests/setup.ts`
- Clear module cache if needed: `jest.resetModules()`

### Port Conflicts
- Change test port in `.env.test`
- Kill processes using the port: `lsof -ti:3003 | xargs kill`

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Express APIs](https://www.albertgao.xyz/2017/05/24/how-to-test-expressjs-with-jest-and-supertest/)
