import { createAccounts } from './accounts.js';
import { defaultDatabasePath } from './paths.js';

export function accountPlugin() {
  const configure = server => {
    const accounts = createAccounts({ databasePath: defaultDatabasePath() });
    server.middlewares.use((req, res, next) => {
      accounts.handle(req, res).then(handled => { if (!handled) next(); }).catch(next);
    });
    server.httpServer?.once('close', () => accounts.close());
  };
  return { name: 'ulbris-local-accounts', configureServer: configure, configurePreviewServer: configure };
}
