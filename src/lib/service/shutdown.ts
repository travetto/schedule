import { EventEmitter } from 'events';

export class Shutdown {
  private static listeners: { name: string, handler: Function }[] = [];
  private static shutdownEvent = new EventEmitter();
  private static shutdownCode = -1;
  private static shutdownPromise = new Promise((resolve) => {
    Shutdown.shutdownEvent.on('shutdown', resolve);
  });

  static onShutdownPromise() {
    return Shutdown.shutdownPromise;
  }

  static onShutdown(name: string, handler: Function) {
    this.listeners.push({ name, handler });
  }

  static async shutdown(exitCode: number = 0, err?: any) {

    if (Shutdown.shutdownCode > 0) {
      return Shutdown.shutdownPromise;
    }

    Shutdown.shutdownCode = exitCode;

    let listeners = Shutdown.listeners.slice(0);
    Shutdown.listeners = [];

    try {
      if (err) {
        console.log(err.stack || err);
      }

      Shutdown.listeners = [];
      if (listeners.length) {
        console.log('');
      }

      let promises: Promise<any>[] = [];

      for (let listener of listeners) {
        let {name, handler} = listener;

        try {
          console.log(`Shutting down ${name}`);
          let res = handler();
          if (res && res.then) {
            promises.push(res as Promise<any>);
            let prefix = `Error shutting down ${name}`;
            res.catch((e: any) => console.error(prefix, e));
          }
        } catch (e) {
          console.error(`Error shutting down ${name}`, e);
        }
      }

      await Promise.all(promises);
      console.log(`Successfully shut down ${name}`);
    } catch (e) {
      console.error('Error on shutting down', e);
    }

    Shutdown.shutdownEvent.emit('shutdown');

    if (Shutdown.shutdownCode >= 0) {
      process.nextTick(() => process.exit(Shutdown.shutdownCode));
    }

    return Shutdown.shutdownPromise;
  }
}

process.on('exit', Shutdown.shutdown.bind(null, 0));
process.on('SIGINT', Shutdown.shutdown.bind(null, 130));
process.on('uncaughtException', Shutdown.shutdown.bind(null, 1));