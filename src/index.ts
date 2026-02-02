import 'dotenv/config';
import express, {Request, Response} from 'express';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import {PrismaClient, FileStatus} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Pool} from 'pg';

const PORT = 3050;

const watchFolder = path.join(process.env.HOME || '', 'test-watch-folder');
const processedFilesRoot = path.join(watchFolder, 'processed_files');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({connectionString: databaseUrl});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({adapter: adapter});

const app = express();

app.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    watching: watchFolder,
    uptime: process.uptime(),
  });
});

app.get('/', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.fileLog.findMany({
      orderBy: {processedAt: 'desc'},
      take: 20,
    });

    const logRows =
      logs.length > 0
        ? logs
            .map(
              (log) => `
          <tr>
            <td>${log.originalName}</td>
            <td>${log.status}</td>
            <td>${log.movedToPath || 'N/A'}</td>
            <td>${new Date(log.processedAt).toLocaleString()}</td>
          </tr>`,
            )
            .join('')
        : '<tr><td colspan="4">No files processed yet.</td></tr>';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Folder Mover</title>
        <style>
          body { font-family: sans-serif; padding: 30px; background-color: #f8f9fa; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          th, td { padding: 12px; text-align: left; border: 1px solid #dee2e6; }
          th { background-color: #212529; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Folder Mover is a bit!</h1> <!-- Your Header is here now -->
        <p>Latest Activity (Top 20 files):</p>
        <table>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Status</th>
              <th>Destination</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${logRows}
          </tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('[DASHBOARD ERROR]', error.message);
    res
      .status(500)
      .send(
        `<h1>Folder Mover is running!</h1><p>Error loading logs: ${error.message}</p>`,
      );
  }
});

async function startApp() {
  try {
    await fs.mkdir(processedFilesRoot, {recursive: true});
    await fs.mkdir(path.join(processedFilesRoot, 'images'), {recursive: true});
    await fs.mkdir(path.join(processedFilesRoot, 'documents'), {
      recursive: true,
    });
    await fs.mkdir(path.join(processedFilesRoot, 'other'), {recursive: true});
    console.log('[SETUP] Folders ready.');

    app.listen(PORT, () => {
      console.log(`[SERVER] Running at http://localhost:${PORT}`);
    });

    const watcher = chokidar.watch(watchFolder, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      depth: 0,
    });

    watcher.on('add', handleNewFile);
    console.log(`[WATCHER] Watching: ${watchFolder}`);
  } catch (error) {
    console.error('[FATAL ERROR] Failed to start:', error);
    process.exit(1);
  }
}

async function handleNewFile(filePath: string) {
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(fileName).toLowerCase();

  if (filePath.includes(processedFilesRoot)) return;

  console.log(`[DETECTED] ${fileName}`);

  let destinationSubfolder = 'other';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension)) {
    destinationSubfolder = 'images';
  } else if (
    ['.pdf', '.doc', '.docx', '.txt', '.csv'].includes(fileExtension)
  ) {
    destinationSubfolder = 'documents';
  }

  const finalPath = path.join(
    processedFilesRoot,
    destinationSubfolder,
    fileName,
  );

  try {
    const stat = await fs.stat(filePath);
    await new Promise((resolve) => setTimeout(resolve, 500));

    await fs.rename(filePath, finalPath);

    await prisma.fileLog.create({
      data: {
        originalName: fileName,
        originalPath: filePath,
        fileSize: stat.size,
        fileExtension: fileExtension,
        movedToPath: finalPath,
        status: FileStatus.SUCCESS,
      },
    });
    console.log(`[SORTED] ${fileName}`);
  } catch (err) {
    console.error(`[ERROR] ${fileName}:`, err);
  }
}

startApp();
