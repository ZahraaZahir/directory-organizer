import 'dotenv/config';
import express, {Request, Response} from 'express';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import {PrismaClient, FileStatus} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const watchFolder = path.join(process.env.HOME || '', 'test-watch-folder');

const app = express();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

let adapterConfig;
try {
  const u = new URL(databaseUrl);
  adapterConfig = {
    host: u.hostname,
    port: Number(u.port) || 5432,
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ''),
  };
} catch (e) {
  adapterConfig = {connectionString: databaseUrl};
}

const adapter = new PrismaPg(adapterConfig);
const prisma = new PrismaClient({adapter: adapter});

app.get('/', (req: Request, res: Response) => {
  res.send('<h1>Folder Mover is running!</h1>');
});

app.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    watching: watchFolder,
    uptime: process.uptime(),
  });
});

app.listen(PORT, () => {
  console.log(`[SERVER] API running at http://localhost:${PORT}`);
});

console.log(`[WATCHER] Watching for files in: ${watchFolder}`);

const watcher = chokidar.watch(watchFolder, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  depth: 0,
});

const processedFilesRoot = path.join(__dirname, '..', 'processed_files');

(async () => {
  try {
    await fs.mkdir(processedFilesRoot, {recursive: true});
    await fs.mkdir(path.join(processedFilesRoot, 'images'), {recursive: true});
    await fs.mkdir(path.join(processedFilesRoot, 'documents'), {
      recursive: true,
    });
    await fs.mkdir(path.join(processedFilesRoot, 'other'), {recursive: true});
    console.log('[SETUP] Ensured all destination folders exist.');
  } catch (error) {
    console.error('[SETUP ERROR] Could not create necessary folders:', error);
    process.exit(1);
  }
})();

watcher.on('add', async (filePath) => {
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(fileName).toLowerCase();

  console.log(
    `[DETECTED] New file found: ${fileName} (Extension: ${fileExtension})`,
  );

  let destinationSubfolder = 'other';

  switch (fileExtension) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.gif':
    case '.webp':
      destinationSubfolder = 'images';
      break;
    case '.pdf':
    case '.doc':
    case '.docx':
    case '.txt':
    case '.csv':
      destinationSubfolder = 'documents';
      break;
  }

  const finalDestinationFolder = path.join(
    processedFilesRoot,
    destinationSubfolder,
  );
  const finalDestinationPath = path.join(finalDestinationFolder, fileName);

  try {
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    await new Promise((resolve) => setTimeout(resolve, 500));

    await fs.rename(filePath, finalDestinationPath);
    console.log(`[SORTED] ${fileName} to ${destinationSubfolder}/`);

    await prisma.fileLog.create({
      data: {
        originalName: fileName,
        originalPath: filePath,
        fileSize: fileSize,
        fileExtension: fileExtension,
        movedToPath: finalDestinationPath,
        status: FileStatus.SUCCESS,
      },
    });
    console.log(`[DB] Logged ${fileName} to database.`);
  } catch (err: any) {
    console.error(`[ERROR] Failed to sort ${fileName}:`, err);
  }
});
