import express, {Request, Response} from 'express';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';

const PORT = 3000;
const watchFolder = path.join(process.env.HOME || '', 'Downloads');

const app = express();

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
  const fileExtension = path.extname(fileName).toLocaleLowerCase();

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
    await new Promise((resolve) => setTimeout(resolve, 500));

    await fs.rename(filePath, finalDestinationPath);
    console.log(`[SORTED] ${fileName} to ${destinationSubfolder}/`);
  } catch (err: any) {
    console.error(`[ERROR] Failed to sort ${fileName}:`, err);
  }
});
