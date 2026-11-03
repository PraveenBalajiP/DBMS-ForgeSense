// Imported by every DB/API test: refuses to run against a non-test database.
if (!/_test$/.test(process.env.MYSQL_DATABASE || '')) {
  console.error(`\nRefusing to run: MYSQL_DATABASE="${process.env.MYSQL_DATABASE}" does not end with "_test".\n` +
    'Copy backend/.env.test.example to backend/.env.test and use the npm run test:* scripts.\n');
  process.exit(1);
}
export const BASE = process.env.BASE_URL || 'http://localhost:4100';
