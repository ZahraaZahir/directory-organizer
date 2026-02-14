import {FileLog} from '@prisma/client';

export function renderDashboard(logs: FileLog[], watchFolder: string): string {
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Directory Organizer</title>
      <style>
        body { font-family: sans-serif; padding: 30px; background-color: #f8f9fa; }
        h1 { color: #333; }
        .folder-info { color: #666; margin-bottom: 20px; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        th, td { padding: 12px; text-align: left; border: 1px solid #dee2e6; }
        th { background-color: #212529; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>Directory Organizer Dashboard</h1>
      <p class="folder-info">Watching: ${watchFolder}</p>
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
  `;
}
