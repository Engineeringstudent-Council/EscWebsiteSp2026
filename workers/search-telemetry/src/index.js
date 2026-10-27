/**
 * Worker entry point. Keep this file to a single default export: workerd
 * treats named exports of the entry module as entrypoints, so helpers live in
 * lib.js (see README.md for what this Worker does).
 */
import { handleRequest, pruneOldRows } from './lib.js';

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
  async scheduled(controller, env) {
    await pruneOldRows(env);
  },
};
