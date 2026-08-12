import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'imports');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class StorageProvider {
    static async saveFile(fileBuffer, originalName, provider = process.env.STORAGE_PROVIDER || 'local') {
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const ext = path.extname(originalName) || '.csv';
        const filename = `${Date.now()}_${hash.substring(0, 10)}${ext}`;

        if (provider === 'local') {
            const filePath = path.join(UPLOAD_DIR, filename);
            await fs.promises.writeFile(filePath, fileBuffer);
            return {
                provider: 'local',
                storageKey: filename,
                storagePath: filePath,
                fileHash: hash,
                fileSize: fileBuffer.length
            };
        } else {
            // S3 / Azure / GCS Fallback Mock Interface
            console.log(`[STORAGE PROVIDER MOCK] Cloud upload triggered for ${originalName} to provider: ${provider}`);
            const filePath = path.join(UPLOAD_DIR, filename);
            await fs.promises.writeFile(filePath, fileBuffer);
            return {
                provider,
                storageKey: `cloud_${filename}`,
                storagePath: filePath,
                fileHash: hash,
                fileSize: fileBuffer.length
            };
        }
    }

    static async getFileStream(storagePath) {
        if (!fs.existsSync(storagePath)) {
            throw new Error(`Import file not found on storage: ${storagePath}`);
        }
        return fs.createReadStream(storagePath);
    }
}
