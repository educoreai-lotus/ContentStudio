import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binDir = path.join(__dirname, '..', 'bin');
const ytDlpPath = path.join(binDir, 'yt-dlp');
const ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

// Create bin directory if it doesn't exist
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Check if yt-dlp already exists
if (fs.existsSync(ytDlpPath)) {
  console.log('yt-dlp binary already exists, skipping download');
  process.exit(0);
}

console.log('Downloading yt-dlp binary...');

// Download yt-dlp binary
const file = fs.createWriteStream(ytDlpPath);

https.get(ytDlpUrl, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // Follow redirect
    https.get(response.headers.location, (redirectResponse) => {
      redirectResponse.pipe(file);
      file.on('finish', () => {
        file.close();
        // Make executable (Unix/Linux)
        if (process.platform !== 'win32') {
          fs.chmodSync(ytDlpPath, 0o755);
        }
        console.log('yt-dlp binary downloaded successfully');
      });
    }).on('error', (err) => {
      fs.unlinkSync(ytDlpPath);
      console.error('Error downloading yt-dlp:', err.message);
      process.exit(1);
    });
  } else {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      // Make executable (Unix/Linux)
      if (process.platform !== 'win32') {
        fs.chmodSync(ytDlpPath, 0o755);
      }
      console.log('yt-dlp binary downloaded successfully');
    });
  }
}).on('error', (err) => {
  fs.unlinkSync(ytDlpPath);
  console.error('Error downloading yt-dlp:', err.message);
  process.exit(1);
});

