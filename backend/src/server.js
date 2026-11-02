import { createApp } from './app.js';
import { requireAllEnv } from './config/env.js';

try { requireAllEnv(); } catch (e) { console.error('\n' + e.message + '\n'); process.exit(1); }
const port = Number(process.env.PORT || 4000);
createApp().listen(port, () => console.log(`API listening on http://localhost:${port}  (database: ${process.env.MYSQL_DATABASE})`));
