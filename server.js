/**
 * 最小構成のExpressサーバ
 * - public/ を静的配信
 * - ポートは process.env.PORT || 3000
 * - ビルド工程なし、CDN等も未使用（要件に準拠）
 */

 import express from 'express';
 import path from 'path';
 import { fileURLToPath } from 'url';
 
 const app = express();
 
 const __filename = fileURLToPath(import.meta.url);
 const __dirname = path.dirname(__filename);
 
 // 静的配信（/public）
 app.use(express.static(path.join(__dirname, 'public')));
 
 // ルートは index.html を返却
 app.get('/', (_req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'index.html'));
 });
 
 const PORT = process.env.PORT || 3000;
 app.listen(PORT, () => {
   console.log(`[kids-timer] Listening on http://localhost:${PORT}`);
 });
 