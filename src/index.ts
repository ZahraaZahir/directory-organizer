import express, {Request, Response} from 'express';
import chokidar from 'chokidar';
import path from 'path';

const PORT = 3000;
const watchFolder = path.join(process.env.HOME || '', 'Downloads');

const app = express();

app.get('/', (req: Request, res: Response) => {
  res.send('<h1>API is running!</h1>');
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

watcher.on('add', (filePath) => {
  const fileName = path.basename(filePath);
  console.log(`[DETECTED] New file found: ${fileName}`);
});
