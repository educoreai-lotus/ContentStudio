# דוגמת בקשה ל-DevLab Service דרך Coordinator

## מבנה הבקשה המלא ל-Postman

### Endpoint
```
POST {{COORDINATOR_URL}}/api/fill-content-metrics/
```

### Headers
```
Content-Type: application/json
X-Service-Name: content-studio
X-Signature: <SIGNATURE_BASE64>
X-Request-Timeout: 180000
```

### Request Body (JSON)

```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "description": "Generate devlab AI exercises",
    "targetService": "devlab-service",
    "topic_id": "123",
    "topic_name": "Lists (Arrays)",
    "question_type": "code",
    "skills": [
      "Lists",
      "Indexing",
      "List Methods",
      "Iteration",
      "Mutable Data"
    ],
    "humanLanguage": "english",
    "amount": 4,
    "programming_language": "python"
  },
  "response": {
    "answer": ""
  }
}
```

---

## איך ליצור את החתימה (X-Signature)

### שלב 1: יצירת ה-Message

החתימה נוצרת על ה-`envelope` המלא (לא רק ה-payload).

1. **Stringify את ה-envelope**:
   ```javascript
   const envelope = {
     requester_service: "content-studio",
     payload: { ... },
     response: { answer: "" }
   };
   const envelopeString = JSON.stringify(envelope);
   ```

2. **צור SHA256 hash**:
   ```javascript
   const crypto = require('crypto');
   const payloadHash = crypto.createHash('sha256')
     .update(envelopeString)
     .digest('hex');
   ```

3. **בנה את ה-Message**:
   ```javascript
   const message = `educoreai-content-studio-${payloadHash}`;
   ```

### שלב 2: חתום עם ECDSA P-256

```javascript
const crypto = require('crypto');

// ה-private key מ-CS_COORDINATOR_PRIVATE_KEY
const privateKeyPem = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...
-----END PRIVATE KEY-----`;

// צור את ה-signer
const signer = crypto.createSign('SHA256');
signer.update(message, 'utf8');
signer.end();

// חתום
const signatureBase64 = signer.sign(privateKeyPem, 'base64');

// נקה מ-whitespace
const cleanSignature = signatureBase64.replace(/\s+/g, '');
```

### שלב 3: השתמש ב-Signature ב-Header

```
X-Signature: <cleanSignature>
```

---

## דוגמה מלאה ב-Postman

### Pre-request Script (Postman)

```javascript
// 1. הגדר את ה-envelope
const envelope = {
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "description": "Generate devlab AI exercises",
    "targetService": "devlab-service",
    "topic_id": "123",
    "topic_name": "Lists (Arrays)",
    "question_type": "code",
    "skills": [
      "Lists",
      "Indexing",
      "List Methods",
      "Iteration",
      "Mutable Data"
    ],
    "humanLanguage": "english",
    "amount": 4,
    "programming_language": "python"
  },
  "response": {
    "answer": ""
  }
};

// 2. Stringify את ה-envelope
const envelopeString = JSON.stringify(envelope);

// 3. צור SHA256 hash
const payloadHash = crypto.createHash('sha256')
  .update(envelopeString)
  .digest('hex');

// 4. בנה את ה-Message
const message = `educoreai-content-studio-${payloadHash}`;

// 5. קבל את ה-private key מ-environment variable
const privateKeyPem = pm.environment.get("CS_COORDINATOR_PRIVATE_KEY");

// 6. חתום
const signer = crypto.createSign('SHA256');
signer.update(message, 'utf8');
signer.end();
const signatureBase64 = signer.sign(privateKeyPem, 'base64');
const cleanSignature = signatureBase64.replace(/\s+/g, '');

// 7. שמור ב-environment variable לשימוש ב-header
pm.environment.set("X_SIGNATURE", cleanSignature);

// 8. הגדר את ה-body
pm.request.body.raw = envelopeString;
pm.request.body.options.raw.language = 'json';
```

### Headers (Postman)

```
Content-Type: application/json
X-Service-Name: content-studio
X-Signature: {{X_SIGNATURE}}
X-Request-Timeout: 180000
```

### Body (Postman)

**Type**: `raw` → `JSON`

```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "description": "Generate devlab AI exercises",
    "targetService": "devlab-service",
    "topic_id": "123",
    "topic_name": "Lists (Arrays)",
    "question_type": "code",
    "skills": [
      "Lists",
      "Indexing",
      "List Methods",
      "Iteration",
      "Mutable Data"
    ],
    "humanLanguage": "english",
    "amount": 4,
    "programming_language": "python"
  },
  "response": {
    "answer": ""
  }
}
```

---

## דוגמה עם Node.js Script (ליצירת חתימה)

```javascript
const crypto = require('crypto');
const fs = require('fs');

// 1. טען את ה-private key
const privateKeyPem = process.env.CS_COORDINATOR_PRIVATE_KEY || 
  fs.readFileSync('private-key.pem', 'utf8');

// 2. בנה את ה-envelope
const envelope = {
  requester_service: "content-studio",
  payload: {
    action: "generate-questions",
    description: "Generate devlab AI exercises",
    targetService: "devlab-service",
    topic_id: "123",
    topic_name: "Lists (Arrays)",
    question_type: "code",
    skills: [
      "Lists",
      "Indexing",
      "List Methods",
      "Iteration",
      "Mutable Data"
    ],
    humanLanguage: "english",
    amount: 4,
    programming_language: "python"
  },
  response: {
    answer: ""
  }
};

// 3. Stringify את ה-envelope
const envelopeString = JSON.stringify(envelope);

// 4. צור SHA256 hash
const payloadHash = crypto.createHash('sha256')
  .update(envelopeString)
  .digest('hex');

// 5. בנה את ה-Message
const message = `educoreai-content-studio-${payloadHash}`;

console.log('Message to sign:', message);
console.log('Payload hash:', payloadHash);

// 6. חתום
const signer = crypto.createSign('SHA256');
signer.update(message, 'utf8');
signer.end();
const signatureBase64 = signer.sign(privateKeyPem, 'base64');
const cleanSignature = signatureBase64.replace(/\s+/g, '');

console.log('\n=== REQUEST DETAILS ===');
console.log('URL:', process.env.COORDINATOR_URL + '/api/fill-content-metrics/');
console.log('Method: POST');
console.log('\n=== HEADERS ===');
console.log('Content-Type: application/json');
console.log('X-Service-Name: content-studio');
console.log('X-Signature:', cleanSignature);
console.log('X-Request-Timeout: 180000');
console.log('\n=== BODY ===');
console.log(JSON.stringify(envelope, null, 2));
```

---

## Environment Variables ב-Postman

צריך להגדיר:

1. **COORDINATOR_URL**: `https://coordinator-production.railway.app` (או ה-URL שלך)
2. **CS_COORDINATOR_PRIVATE_KEY**: ה-private key של Content Studio (מ-`.env`)

---

## הערות חשובות

1. **סדר השדות חשוב**: ה-`JSON.stringify` ב-JavaScript שומר על סדר השדות, אבל צריך לוודא שהמבנה זהה
2. **החתימה על ה-envelope המלא**: לא רק על ה-payload, אלא על כל ה-envelope כולל `response: { answer: "" }`
3. **השדה `response` חובה**: חייב להיות `{ answer: "" }` (לא `{}`)
4. **השדה `targetService` חובה**: חייב להיות `"devlab-service"` ב-payload
5. **השדה `description` חובה**: חייב להיות `"Generate devlab AI exercises"` ב-payload

---

## דוגמה של Response מצופה

```json
{
  "success": true,
  "data": {
    "html": "<div>...</div>",
    "questions": [
      {
        "question_text": "Write a program that...",
        "question_type": "code",
        "programming_language": "python",
        "order_index": 1,
        "hint": null,
        "solution": null,
        "title": "Write a program that...",
        "description": "Write a program that...",
        "language": "en"
      }
    ],
    "metadata": {
      "amount": 4,
      "skills": ["Lists", "Indexing", ...],
      "language": "en",
      "topic_id": "123",
      "topic_name": "Lists (Arrays)",
      "generated_at": "2025-12-19T...",
      "question_type": "code",
      "generation_mode": "manual",
      "validation_status": "approved",
      "programming_language": "python"
    }
  },
  "metadata": {
    "timestamp": "2025-12-19T...",
    "service": "devlab-service"
  }
}
```

---

## בדיקת החתימה (Optional)

אם רוצה לבדוק שהחתימה תקינה:

```javascript
const crypto = require('crypto');

// ה-public key של Coordinator (מ-COORDINATOR_PUBLIC_KEY)
const publicKeyPem = process.env.COORDINATOR_PUBLIC_KEY;

// ה-message שהיה חתום
const message = `educoreai-content-studio-${payloadHash}`;

// ה-signature שקיבלת
const signature = "<SIGNATURE_BASE64>";

// בדוק
const verifier = crypto.createVerify('SHA256');
verifier.update(message, 'utf8');
verifier.end();
const isValid = verifier.verify(publicKeyPem, signature, 'base64');

console.log('Signature valid:', isValid);
```

