# File Integrity & Digital Signature Implementation

## 📋 Summary

Added file integrity protection and digital signature generation for all media files (presentations, avatar videos, audio) uploaded to Supabase Storage.

---

## 🔧 Changes Made

### 1. New Service: `FileIntegrityService.js`

**File:** `backend/src/infrastructure/security/FileIntegrityService.js` (NEW)

**Purpose:** Centralized service for file hashing and digital signature generation.

**Key Methods:**
- `generateFileHash(fileBuffer)` - Generates SHA-256 hash (64-char hex string)
- `signHash(hash)` - Signs hash using private key (returns base64 signature)
- `generateHashAndSignature(fileBuffer)` - Combined operation
- `verifySignature(hash, signature, publicKey)` - Static method for verification (TODO)

**Environment Variable:**
- `CONTENT_STUDIO_PRIVATE_KEY` - RSA private key in PEM format (required)

**Returns:**
```javascript
{
  sha256Hash: string,        // 64-character hex string
  digitalSignature: string   // Base64-encoded signature
}
```

---

### 2. Updated: `AvatarVideoStorageService.js`

**File:** `backend/src/infrastructure/storage/AvatarVideoStorageService.js`

**Changes:**
- Added `FileIntegrityService` integration
- `uploadVideoToStorage()` now generates hash and signature
- Returns `sha256Hash` and `digitalSignature` in metadata

**Updated Return Structure:**
```javascript
{
  fileUrl: string,
  fileName: string,
  fileSize: number,
  fileType: string,
  storagePath: string,
  uploadedAt: string,
  sha256Hash: string | null,        // NEW
  digitalSignature: string | null    // NEW
}
```

---

### 3. Updated: `SupabaseStorageClient.js`

**File:** `backend/src/infrastructure/storage/SupabaseStorageClient.js`

**Changes:**
- Added `FileIntegrityService` integration
- `uploadFile()` now generates hash and signature
- Returns `sha256Hash` and `digitalSignature` in result

**Updated Return Structure:**
```javascript
{
  url: string,
  path: string,
  sha256Hash: string | null,        // NEW
  digitalSignature: string | null   // NEW
}
```

---

### 4. Updated: `GammaClient.js`

**File:** `backend/src/infrastructure/gamma/GammaClient.js`

**Changes:**
- Extracts `sha256Hash` and `digitalSignature` from upload result
- Passes integrity data through to return value

**Updated Return Structure:**
```javascript
{
  presentationUrl: string,
  storagePath: string,
  sha256Hash: string | null,        // NEW
  digitalSignature: string | null,  // NEW
  rawResponse: object
}
```

---

### 5. Updated: `AIGenerationService.js`

**File:** `backend/src/infrastructure/ai/AIGenerationService.js`

**Changes:**
- **Avatar Video:** Extracts and passes through hash/signature from storage metadata
- **Presentation:** Extracts and passes through hash/signature from Gamma upload
- **Audio:** Extracts and passes through hash/signature from storage upload

**Updated Return Structures:**

**Avatar Video:**
```javascript
{
  videoUrl: string,
  videoId: string,
  // ... existing fields ...
  fileUrl: string,
  fileName: string,
  fileSize: number,
  fileType: string,
  storagePath: string,
  uploadedAt: string,
  sha256Hash: string | null,        // NEW
  digitalSignature: string | null   // NEW
}
```

**Presentation:**
```javascript
{
  presentationUrl: string,
  storagePath: string,
  format: string,
  sha256Hash: string | null,        // NEW
  digitalSignature: string | null,  // NEW
  metadata: object
}
```

**Audio:**
```javascript
{
  audioUrl: string,
  format: string,
  duration: number,
  voice: string,
  sha256Hash: string | null,        // NEW
  digitalSignature: string | null,  // NEW
  metadata: object
}
```

---

### 6. Updated: `ContentDataCleaner.js`

**File:** `backend/src/application/utils/ContentDataCleaner.js`

**Changes:**
- `cleanAvatarVideoData()` - Preserves `sha256Hash` and `digitalSignature`
- `cleanPresentationData()` - Preserves `sha256Hash` and `digitalSignature`
- `cleanAudioData()` - Preserves `sha256Hash` and `digitalSignature`

**Cleaned Data Structure (Example - Avatar Video):**
```javascript
{
  videoUrl: string,
  videoId: string,
  duration_seconds: number,
  fileUrl: string,
  fileName: string,
  fileSize: number,
  fileType: string,
  storagePath: string,
  uploadedAt: string,
  sha256Hash: string,              // NEW - preserved
  digitalSignature: string,         // NEW - preserved
  metadata: {
    heygen_video_url: string
  }
}
```

---

## 📊 Complete Flow

```
1. File Buffer Ready
   ↓
2. FileIntegrityService.generateHashAndSignature(fileBuffer)
   - Generates SHA-256 hash
   - Signs hash with private key
   ↓
3. Upload to Supabase Storage
   ↓
4. Return metadata with hash + signature
   ↓
5. Save to DB with integrity data
```

---

## 🔐 Security Implementation

### Private Key Storage

**Environment Variable:** `CONTENT_STUDIO_PRIVATE_KEY`

**Format:** RSA private key in PEM format

**Example:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

**Validation:**
- Service validates key format on initialization
- Logs warning if key is missing or invalid
- System continues to function without integrity protection if key is missing

### Public Key (for Verification)

**TODO:** Store `CONTENT_STUDIO_PUBLIC_KEY` in environment variables

**Location for Verification:**
- GET endpoints for media files (download/stream)
- Use `FileIntegrityService.verifySignature()` static method

**Example Usage (TODO):**
```javascript
// In download endpoint
const { sha256Hash, digitalSignature } = contentData;
const publicKey = process.env.CONTENT_STUDIO_PUBLIC_KEY;

if (sha256Hash && digitalSignature && publicKey) {
  const isValid = FileIntegrityService.verifySignature(
    sha256Hash,
    digitalSignature,
    publicKey
  );
  
  if (!isValid) {
    throw new Error('File integrity verification failed');
  }
}
```

---

## 📁 Files Modified

1. ✅ **NEW:** `backend/src/infrastructure/security/FileIntegrityService.js`
2. ✅ **UPDATED:** `backend/src/infrastructure/storage/AvatarVideoStorageService.js`
3. ✅ **UPDATED:** `backend/src/infrastructure/storage/SupabaseStorageClient.js`
4. ✅ **UPDATED:** `backend/src/infrastructure/gamma/GammaClient.js`
5. ✅ **UPDATED:** `backend/src/infrastructure/ai/AIGenerationService.js`
6. ✅ **UPDATED:** `backend/src/application/utils/ContentDataCleaner.js`

---

## ✅ Validation Checklist

- [x] SHA-256 hash generated for all media files
- [x] Digital signature generated using private key
- [x] Hash and signature saved to DB in `content_data`
- [x] No existing fields modified (only added new fields)
- [x] Private key read from environment variable
- [x] Warning logged if private key is missing
- [x] System continues to function without key (graceful degradation)
- [x] Clean service structure (no logic in controllers)
- [x] Works for: Avatar Video, Presentation, Audio

---

## 🧪 Test Example

### Successful Upload with Integrity Protection:

```javascript
// 1. File uploaded to Supabase Storage
const uploadResult = await storageService.uploadVideoToStorage(
  fileBuffer,
  'avatar_12345.mp4',
  'video/mp4'
);

// 2. Result includes integrity data
console.log(uploadResult);
// {
//   fileUrl: 'https://xxx.supabase.co/storage/v1/object/public/media/avatar_videos/avatar_12345.mp4',
//   fileName: 'avatar_12345.mp4',
//   fileSize: 5242880,
//   fileType: 'video/mp4',
//   storagePath: 'avatar_videos/avatar_12345.mp4',
//   uploadedAt: '2025-01-22T12:00:00.000Z',
//   sha256Hash: 'a1b2c3d4e5f6...',  // 64-char hex
//   digitalSignature: 'xyz123...'    // base64
// }

// 3. Content saved to DB with integrity data
// content_data in DB:
{
  "videoUrl": "https://xxx.supabase.co/storage/v1/object/public/media/avatar_videos/avatar_12345.mp4",
  "videoId": "12345",
  "duration_seconds": 15,
  "fileUrl": "https://xxx.supabase.co/storage/v1/object/public/media/avatar_videos/avatar_12345.mp4",
  "fileName": "avatar_12345.mp4",
  "fileSize": 5242880,
  "fileType": "video/mp4",
  "storagePath": "avatar_videos/avatar_12345.mp4",
  "uploadedAt": "2025-01-22T12:00:00.000Z",
  "sha256Hash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",  // NEW
  "digitalSignature": "xyz123abc456def789...",  // NEW
  "metadata": {
    "heygen_video_url": "https://app.heygen.com/share/12345"
  }
}
```

---

## 🔍 Key Implementation Details

### Hash Generation
- Uses Node.js `crypto.createHash('sha256')`
- Returns 64-character hexadecimal string
- Generated from file buffer before upload

### Signature Generation
- Uses Node.js `crypto.sign('sha256', Buffer.from(hash, 'hex'), privateKey)`
- Returns Base64-encoded signature
- Signs the hash (not the file directly)

### Error Handling
- If private key is missing: Returns `null` for hash/signature, upload continues
- If hash generation fails: Logs warning, upload continues
- If signature generation fails: Logs warning, upload continues
- System gracefully degrades without integrity protection

---

## 📝 TODO for Verification

### 1. Store Public Key

Add to environment variables:
```bash
CONTENT_STUDIO_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

### 2. Implement Verification in GET Endpoints

**Location:** Media download/stream endpoints

**Example Implementation:**
```javascript
import { FileIntegrityService } from '../infrastructure/security/FileIntegrityService.js';

// In download endpoint
const content = await getContentById(contentId);
const { sha256Hash, digitalSignature } = content.content_data;

if (sha256Hash && digitalSignature) {
  const publicKey = process.env.CONTENT_STUDIO_PUBLIC_KEY;
  
  if (!publicKey) {
    logger.warn('[Download] Public key not configured, skipping verification');
  } else {
    const isValid = FileIntegrityService.verifySignature(
      sha256Hash,
      digitalSignature,
      publicKey
    );
    
    if (!isValid) {
      logger.error('[Download] File integrity verification failed', {
        contentId,
        sha256Hash: sha256Hash.substring(0, 16) + '...',
      });
      throw new Error('File integrity verification failed. File may have been tampered with.');
    }
    
    logger.info('[Download] File integrity verified successfully', { contentId });
  }
}
```

---

## 🎯 Result

Every media file (avatar video, presentation, audio) now has:
1. ✅ SHA-256 hash generated and stored
2. ✅ Digital signature generated and stored
3. ✅ Metadata saved to DB with `sha256Hash` and `digitalSignature` fields
4. ✅ Graceful degradation if private key is not configured

---

**Status:** ✅ Complete
**Date:** 2025-01-22

