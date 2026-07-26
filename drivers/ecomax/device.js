'use strict';

const Homey = require('homey');
const EcoNetClient = require('../../lib/econet');
const SENSORS = require('../../lib/sensors');
const MAPPINGS = require('../../lib/mappings');

module.exports = class EcoMaxDevice extends Homey.Device {

  async onInit() {
    this.log('ecoMAX device initialized');

    this.client = null;
    this.updateInterval = null;
    this.isUpdating = false;

    await this.synchronizeCapabilities();
    await this.initializeConnection();

    this.updateInterval = this.homey.setInterval(
      () => this.updateValues(),
      60 * 1000
    );
  }

  /**
   * Avgör om en sensor ska visas.
   *
   * Om inställningen ännu saknas, exempelvis på en enhet
   * som skapades innan inställningssidan infördes, används
   * enabledByDefault från sensorbiblioteket.
   */
  isSensorEnabled(sensor, settings = this.getSettings()) {
    const settingValue = settings[sensor.settingId];

    if (typeof settingValue === 'boolean') {
      return settingValue;
    }

    return sensor.enabledByDefault === true;
  }

  /**
   * Ser till att enheten har exakt de capabilities
   * som användaren har valt i enhetsinställningarna.
   */
  async synchronizeCapabilities(settings = this.getSettings()) {
    for (const sensor of SENSORS) {
      const shouldBeEnabled = this.isSensorEnabled(
        sensor,
        settings
      );

      const isEnabled = this.hasCapability(
        sensor.capability
      );

      if (shouldBeEnabled && !isEnabled) {
        await this.addCapability(sensor.capability);
        this.log(`Added capability: ${sensor.capability}`);
      }

      if (!shouldBeEnabled && isEnabled) {
        await this.removeCapability(sensor.capability);
        this.log(`Removed capability: ${sensor.capability}`);
      }
    }

    /*
     * Tar bort den gamla generella temperatur-capabilityn
     * från tidigare versioner.
     */
    if (this.hasCapability('measure_temperature')) {
      await this.removeCapability('measure_temperature');
      this.log('Removed old capability: measure_temperature');
    }
  }

  async initializeConnection() {
    const username = this.getStoreValue('username');
    const password = this.getStoreValue('password');
    const uid = this.getStoreValue('uid') || this.getData().id;

    if (!username || !password || !uid) {
      await this.setUnavailable(
        'Inloggningsuppgifter till ecoNET24 saknas.'
      );

      this.error('Missing ecoNET24 credentials or UID');
      return;
    }

    this.username = username;
    this.password = password;
    this.uid = uid;

    try {
      this.client = new EcoNetClient();

      await this.client.login(
        this.username,
        this.password
      );

      await this.updateValues();
      await this.setAvailable();
    } catch (error) {
      this.error(
        'Could not initialize ecoNET24 connection:',
        error
      );

      await this.setUnavailable(
        error?.message || 'Kunde inte ansluta till ecoNET24.'
      );
    }
  }

  async updateValues() {
    if (this.isUpdating || !this.client) {
      return;
    }

    this.isUpdating = true;

    try {
      const values = await this.getAllValuesWithRetry();

      for (const sensor of SENSORS) {
        if (!this.hasCapability(sensor.capability)) {
          continue;
        }

        await this.updateSensor(sensor, values);
      }

      this.log('--------------------------------');

      this.log(
        `Mode: ${
          MAPPINGS.mode[values.current.mode]
          ?? values.current.mode
        }`
      );

      this.log(
        `statusCO: ${
          MAPPINGS.statusCO[values.current.statusCO]
          ?? values.current.statusCO
        }`
      );

      this.log(
        `statusCWU: ${
          MAPPINGS.statusCWU[values.current.statusCWU]
          ?? values.current.statusCWU
        }`
      );

      this.log(
        `Thermostat: ${
          MAPPINGS.thermostat[values.current.thermostat]
          ?? values.current.thermostat
        }`
      );

      this.log('--------------------------------');

      await this.setAvailable();
    } catch (error) {
      this.error('Could not update ecoMAX values:', error);

      await this.setUnavailable(
        error?.message || 'Kunde inte uppdatera ecoMAX-värden.'
      );
    } finally {
      this.isUpdating = false;
    }
  }

  async getAllValuesWithRetry() {
    try {
      return await this.getAllValues();
    } catch (error) {
      this.log(
        'ecoNET24 request failed, trying a new login'
      );

      this.client = new EcoNetClient();

      await this.client.login(
        this.username,
        this.password
      );

      return this.getAllValues();
    }
  }

  async getAllValues() {
    const [deviceParams, registerParams] =
      await Promise.all([
        this.client.getDeviceParams(this.uid),
        this.client.getDeviceRegParams(this.uid),
      ]);

    return {
      current: deviceParams.curr,
      register: registerParams,
    };
  }

  async updateSensor(sensor, values) {
    const sourceValues = values[sensor.source];

    if (!sourceValues) {
      this.log(`Datakällan saknas för ${sensor.title}`);
      return;
    }

    const rawValue = sourceValues[sensor.sourceKey];

    if (sensor.type === 'temperature') {
      await this.updateTemperatureSensor(
        sensor,
        rawValue
      );
      return;
    }

    if (sensor.type === 'boolean') {
      await this.updateBooleanSensor(
        sensor,
        rawValue
      );
      return;
    }

    if (sensor.type === 'number') {
      await this.updateNumberSensor(
        sensor,
        rawValue
      );
      return;
    }

    this.log(
      `Okänd sensortyp för ${sensor.title}: ${sensor.type}`
    );
  }

  async updateTemperatureSensor(sensor, rawValue) {
    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      this.log(
        `${sensor.title} saknas eller är ogiltig: ${rawValue}`
      );
      return;
    }

    await this.setCapabilityValue(
      sensor.capability,
      value
    );

    this.log(
      `${sensor.title} updated: ${value.toFixed(1)} °C`
    );
  }

  async updateBooleanSensor(sensor, rawValue) {
    let value;

    if (typeof rawValue === 'boolean') {
      value = rawValue;
    } else if (rawValue === 1 || rawValue === '1') {
      value = true;
    } else if (rawValue === 0 || rawValue === '0') {
      value = false;
    } else {
      this.log(
        `${sensor.title} saknas eller är ogiltig: ${rawValue}`
      );
      return;
    }

    await this.setCapabilityValue(
      sensor.capability,
      value
    );

    this.log(
      `${sensor.title} updated: ${value ? 'På' : 'Av'}`
    );
  }

  async updateNumberSensor(sensor, rawValue) {
    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      this.log(
        `${sensor.title} saknas eller är ogiltig: ${rawValue}`
      );
      return;
    }

    await this.setCapabilityValue(
      sensor.capability,
      value
    );

    this.log(`${sensor.title} updated: ${value}`);
  }

  /**
   * Körs när användaren sparar enhetsinställningarna.
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }) {
    this.log(
      `Device settings changed: ${changedKeys.join(', ')}`
    );

    await this.synchronizeCapabilities(newSettings);

    /*
     * Uppdatera direkt, så att en nyaktiverad sensor
     * inte behöver vänta på nästa minutintervall.
     */
    await this.updateValues();

    return 'Sensorvalen har uppdaterats.';
  }

  async onAdded() {
    this.log('ecoMAX device added');
  }

  async onDeleted() {
    if (this.updateInterval) {
      this.homey.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.log('ecoMAX device deleted');
  }

};