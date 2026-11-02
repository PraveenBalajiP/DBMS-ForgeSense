// npm run seed:mongo -> back-fills ~24h of synthetic history (no alerts) so charts and forecasts are not empty
import { simulate } from '../src/services/simulate.js';
console.log('Seeded:', await simulate({ points: 48, stepMinutes: 30 }));
process.exit(0);
