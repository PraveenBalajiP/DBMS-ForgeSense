export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
// Express 4 does not catch rejected promises: wrap every async handler.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// strict positive-integer id from a route parameter
export function intId(v, name = 'id') {
  if (!/^[1-9][0-9]{0,9}$/.test(String(v))) throw new HttpError(400, `${name} must be a positive integer`);
  return Number(v);
}
export const ALL = ['Admin', 'Engineer', 'Technician'];
export const MANAGE = ['Admin', 'Engineer'];
