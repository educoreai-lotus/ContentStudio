# Service Auto-Registration

This module handles automatic registration of Content Studio with the Coordinator microservice on startup.

## Environment Variables

You must configure exactly **three** environment variables in Railway:

### 1. `COORDINATOR_URL`
- **Description**: The base URL of the Coordinator microservice
- **Example**: `https://coordinator-production.railway.app`
- **Required**: Yes

### 2. `SERVICE_ENDPOINT`
- **Description**: The public URL of this Content Studio service (from Railway)
- **Example**: `https://content-studio-production.railway.app`
- **Required**: Yes

### 3. `COORDINATOR_PUBLIC_KEY`
- **Description**: The public key of the Coordinator service (stored in GitHub Actions secrets)
- **Example**: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`
- **Required**: Yes
- **Note**: This key is used to generate HMAC tokens for request signing

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
   
   - **Name**: `COORDINATOR_PUBLIC_KEY`
   - **Value**: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`
   - Click **Add**

6. Railway will automatically redeploy your service

### Via Railway CLI:

```bash
railway variables set COORDINATOR_URL=https://coordinator-production.railway.app
railway variables set SERVICE_ENDPOINT=https://content-studio-production.railway.app
railway variables set COORDINATOR_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

## How It Works

1. **On Service Startup**: The registration script runs automatically
2. **Token Generation**: Creates HMAC token from Coordinator public key + service name + payload
3. **Registration Request**: POSTs to `${COORDINATOR_URL}/register` with service metadata and `X-Registration-Token` header
4. **Retry Logic**: If registration fails, retries up to 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s)
5. **Non-Blocking**: Registration failures do NOT crash the service - it continues to start normally
6. **Logging**: All registration attempts and results are logged

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
- **Verify URLs**: Ensure `COORDINATOR_URL` and `SERVICE_ENDPOINT` are correct
- **Verify Public Key**: Ensure `COORDINATOR_PUBLIC_KEY` is set correctly (from GitHub Actions secrets)
- **Network**: Ensure the service can reach the Coordinator URL
- **Service continues**: Even if registration fails, the service will still start

### Common Errors

- `COORDINATOR_URL environment variable is required` → Set the variable in Railway
- `SERVICE_ENDPOINT environment variable is required` → Set the variable in Railway
- `COORDINATOR_PUBLIC_KEY environment variable is required` → Set the variable in Railway (from GitHub Actions secrets)
- `Connection refused` → Coordinator service may be down or URL is incorrect
- `Request timeout` → Coordinator service is not responding
- `401 Unauthorized` → Registration token may be invalid - verify `COORDINATOR_PUBLIC_KEY` is correct

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

