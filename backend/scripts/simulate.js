// npm run simulate -- 4  -> a live burst of readings; machine 4 drifts past its vibration limit
import { simulate } from '../src/services/simulate.js';
console.log(await simulate({ points: 20, stepMinutes: 1, injectMachine: process.argv[2] || null }));
process.exit(0);
