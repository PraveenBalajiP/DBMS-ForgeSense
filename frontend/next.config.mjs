// The browser only ever talks to Next.js (same origin). Next forwards /api/* to the Express backend,
// so the login cookie works without any CORS setup.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';
export default {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND}/api/:path*` }];
  },
};
