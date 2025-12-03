# Service Auto-Registration

This module handles automatic registration of Content Studio with the Coordinator microservice on startup.

## Environment Variables

You must configure exactly **two** environment variables in Railway:

### 1. `COORDINATOR_URL`
- **Description**: The base URL of the Coordinator microservice
- **Example**: `https://coordinator-production.railway.app`
- **Required**: Yes

### 2. `SERVICE_ENDPOINT`
- **Description**: The public URL of this Content Studio service (from Railway)
- **Example**: `https://content-studio-production.railway.app`
- **Required**: Yes

## Setting Environment Variables in Railway

### Via Railway Dashboard:

1. Go to your **Content Studio** project in Railway
2. Click on your service (backend)
3. Go to the **Variables** tab
4. Click **+ New Variable**
5. Add each variable:
   - **Name**: `COORDINATOR_URL`
   - **Value**: `https://your-coordinator-url.railway.app`
   - Click **Add**
   
   - **Name**: `SERVICE_ENDPOINT`
   - **Value**: `https://your-content-studio-url.railway.app`
   - Click **Add**

6. Railway will automatically redeploy your service

### Via Railway CLI:

```bash
railway variables set COORDINATOR_URL=https://coordinator-production.railway.app
railway variables set SERVICE_ENDPOINT=https://content-studio-production.railway.app
```

## How It Works

1. **On Service Startup**: The registration script runs automatically
2. **Registration Request**: POSTs to `${COORDINATOR_URL}/register` with service metadata
3. **Retry Logic**: If registration fails, retries up to 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s)
4. **Non-Blocking**: Registration failures do NOT crash the service - it continues to start normally
5. **Logging**: All registration attempts and results are logged

## Registration Payload

```json
{
  "serviceName": "content-studio",
  "version": "1.0.0",
  "endpoint": "https://your-service-url.railway.app",
  "healthCheck": "/health",
  "description": "Content generation and course-building microservice",
  "metadata": {
    "team": "Content Studio",
    "owner": "system",
    "capabilities": [
      "generate_content",
      "course_management",
      "lesson_creation"
    ]
  }
}
```

## Health Endpoint

The service exposes a `/health` endpoint that returns:

```json
{
  "status": "healthy",
  "service": "content-studio",
  "version": "1.0.0"
}
```

This endpoint is used by the Coordinator for health checks.

## Troubleshooting

### Registration Fails

- **Check logs**: Look for registration error messages
- **Verify URLs**: Ensure both `COORDINATOR_URL` and `SERVICE_ENDPOINT` are correct
- **Network**: Ensure the service can reach the Coordinator URL
- **Service continues**: Even if registration fails, the service will still start

### Common Errors

- `COORDINATOR_URL environment variable is required` → Set the variable in Railway
- `SERVICE_ENDPOINT environment variable is required` → Set the variable in Railway
- `Connection refused` → Coordinator service may be down or URL is incorrect
- `Request timeout` → Coordinator service is not responding

## Manual Registration

If automatic registration fails, you can manually register by calling:

```bash
curl -X POST https://coordinator-url.railway.app/register \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "content-studio",
    "version": "1.0.0",
    "endpoint": "https://your-service-url.railway.app",
    "healthCheck": "/health",
    "description": "Content generation and course-building microservice",
    "metadata": {
      "team": "Content Studio",
      "owner": "system",
      "capabilities": ["generate_content", "course_management", "lesson_creation"]
    }
  }'
```

