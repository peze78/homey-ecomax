'use strict';

const Homey = require('homey');
const EcoNetClient = require('../../lib/econet');

module.exports = class EcoMaxDriver extends Homey.Driver {

  async onInit() {
    this.log('ecoMAX driver initialized');
  }

  async onPair(session) {
    let pairingDevice = null;

    session.setHandler('login', async (data) => {
      const username = String(data?.username || '').trim();
      const password = String(data?.password || '');
      const uid = String(data?.uid || '').trim().toUpperCase();

      if (!username || !password || !uid) {
        throw new Error(
          this.homey.__('pair.missing_fields')
        );
      }

      this.log(`Testing ecoNET24 connection for UID ${uid}`);

      const client = new EcoNetClient();

      await client.login(username, password);
      const deviceInfo = await client.getDevice(uid);

      const reportedModel =
        typeof deviceInfo[5] === 'string'
          ? deviceInfo[5].trim()
          : '';

      pairingDevice = {
        name: reportedModel || 'ecoMAX Controller',
        data: {
          id: uid,
        },
        store: {
          username,
          password,
          uid,
        },
      };

      this.log(
        `ecoNET24 login and UID verification succeeded: ${uid}`
      );

      return true;
    });

    session.setHandler('list_devices', async () => {
      if (!pairingDevice) {
        throw new Error(
          this.homey.__('pair.connection_not_verified')
        );
      }

      return [pairingDevice];
    });
  }

};