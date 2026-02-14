import 'dotenv/config';
import express, {Request, Response} from 'express';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import {PrismaClient, FileStatus} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Pool} from 'pg';
import {AppConfig} from './types.js';
import {renderDashboard} from './dashboard.view.js';

let appConfig: AppConfig;

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
    res.send(renderDashboard(logs, watchFolder));
  } catch (error) {
    console.error('[DASHBOARD ERROR]', error);
    res
      .status(500)
      .send(
        `<h1>Directory Organizer is running!</h1><p>Error loading logs: ${error}</p>`,
      );
  }
});

async function startApp() {
  await loadConfig();
  try {
    await fs.mkdir(processedFilesRoot, {recursive: true});
    for (const rule of appConfig.rules) {
      await fs.mkdir(path.join(processedFilesRoot, rule.folderName), {
        recursive: true,
      });
    }
    await fs.mkdir(path.join(processedFilesRoot, appConfig.defaultFolder), {
      recursive: true,
    });
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
    console.error('[ERROR] Failed to start:', error);
    process.exit(1);
  }
}

async function loadConfig() {
  const configPath = path.join(process.cwd(), 'config.json');
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    appConfig = JSON.parse(configData) as AppConfig;
    console.log(
      `[CONFIG] Loaded rules for ${appConfig.rules.length} categories.`,
    );
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}
async function handleNewFile(filePath: string) {
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(fileName).toLowerCase();

  if (filePath.includes(processedFilesRoot)) return;

  console.log(`[DETECTED] ${fileName}`);

  const matchedRule = appConfig.rules.find((rule) =>
    rule.extensions.includes(fileExtension),
  );

  const destinationSubfolder = matchedRule
    ? matchedRule.folderName
    : appConfig.defaultFolder;

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
  } catch (error) {
    console.error(`[ERROR] ${fileName}:`, error);
  }
}

startApp();
