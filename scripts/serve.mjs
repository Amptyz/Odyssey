import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../EmberDemo/build/web-desktop');
const port = Number(process.env.PORT || 8080);
if (!existsSync(resolve(root, 'index.html'))) {
  console.error('请先在 Cocos Creator 中构建 EmberDemo 的 Web Desktop 版本。');
  process.exit(1);
}
const mime = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.wasm':'application/wasm', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let path = resolve(root, '.' + pathname);
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
    if (!existsSync(path) || !statSync(path).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type':mime[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
    createReadStream(path).pipe(res);
  } catch { res.writeHead(400).end(); }
}).listen(port, '127.0.0.1', () => console.log(`余烬试炼：http://127.0.0.1:${port}/`));
