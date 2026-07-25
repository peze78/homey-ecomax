'use strict';

const Homey = require('homey');
const EcoNetClient = require('../../lib/econet');
const SENSORS = require('../../lib/sensors');

module.exports = class EcoMaxDevice extends Homey.Device {

  async onInit() {
    this.log('ecoMAX device initialized');

    this.client = null;
    this.updateInterval = null;
    this.isUpdating = false;

    await this.ensureCapabilities();
    await this.initializeConnection();

    this.updateInterval = this.homey.setInterval(
      () => this.updateValues(),
      60 * 1000
    );
  }

  /**
   * Lägger till de sensorer som är aktiverade som standard.
   * Det fungerar även för enheter som redan är installerade.
   */
  async ensureCapabilities() {
    const enabledSensors = SENSORS.filter(
      (sensor) => sensor.enabledByDefault
    );

    for (const sensor of enabledSensors) {
      if (!this.hasCapability(sensor.capability)) {
        await this.addCapability(sensor.capability);
        this.log(`Added capability: ${sensor.capability}`);
      }
    }

    /*
     * Tar bort den gamla generella temperatur-capabilityn
     * från tidigare versioner av appen.
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

      await this.client.login(this.username, this.password);
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
	/*
 * Logga driftstatus för att kartlägga ecoMAX.
 */
this.log('--------------------------------');
this.log(`Mode: ${values.current.mode}`);
this.log(`statusCO: ${values.current.statusCO}`);
this.log(`statusCWU: ${values.current.statusCWU}`);
this.log(`Thermostat: ${values.current.thermostat}`);
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
      await this.client.login(this.username, this.password);

      return this.getAllValues();
    }
  }

  async getAllValues() {
    const [deviceParams, registerParams] = await Promise.all([
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
      await this.updateTemperatureSensor(sensor, rawValue);
      return;
    }

    if (sensor.type === 'boolean') {
      await this.updateBooleanSensor(sensor, rawValue);
      return;
    }

    if (sensor.type === 'number') {
      await this.updateNumberSensor(sensor, rawValue);
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

    await this.setCapabilityValue(sensor.capability, value);

    this.log(
      `${sensor.title} updated: ${value.toFixed(1)} °C`
    );
  }

  async updateBooleanSensor(sensor, rawValue) {
    /*
     * Hanterar både riktiga boolean-värden och 0/1.
     */
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

    await this.setCapabilityValue(sensor.capability, value);

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

    await this.setCapabilityValue(sensor.capability, value);

    this.log(`${sensor.title} updated: ${value}`);
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