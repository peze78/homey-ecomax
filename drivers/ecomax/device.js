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
    this.hasLoggedSensorExplorer = false;

    await this.synchronizeCapabilities();
    await this.initializeConnection();

    this.updateInterval = this.homey.setInterval(
      () => this.updateValues(),
      60 * 1000
    );
  }

  isSensorEnabled(sensor, settings = this.getSettings()) {
    const settingValue = settings[sensor.settingId];

    if (typeof settingValue === 'boolean') {
      return settingValue;
    }

    return sensor.enabledByDefault === true;
  }

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

    const legacyCapabilities = [
      'measure_temperature',
      'pump_circulation',
    ];

    for (const capability of legacyCapabilities) {
      if (this.hasCapability(capability)) {
        await this.removeCapability(capability);
        this.log(`Removed old capability: ${capability}`);
      }
    }
  }

  async initializeConnection() {
    const username = this.getStoreValue('username');
    const password = this.getStoreValue('password');
    const uid = this.getStoreValue('uid') || this.getData().id;

    if (!username || !password || !uid) {
      await this.setUnavailable(
        this.homey.__('errors.missing_credentials')
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
        error?.message || this.homey.__('errors.connection_failed')
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

      if (!this.hasLoggedSensorExplorer) {
        this.logUnusedLiveValues(values.current);
        this.hasLoggedSensorExplorer = true;
      }

      this.logMappedStatuses(values.current);

      await this.setAvailable();
    } catch (error) {
      this.error('Could not update ecoMAX values:', error);

      await this.setUnavailable(
        error?.message || this.homey.__('errors.update_failed')
      );
    } finally {
      this.isUpdating = false;
    }
  }

  logUnusedLiveValues(currentValues) {
    if (!currentValues || typeof currentValues !== 'object') {
      this.log('Sensor Explorer: inga livevärden hittades.');
      return;
    }

    const usedCurrentKeys = new Set(
      SENSORS
        .filter((sensor) => sensor.source === 'current')
        .map((sensor) => String(sensor.sourceKey))
    );

    const unusedValues = Object.entries(currentValues)
      .filter(([key]) => !usedCurrentKeys.has(key))
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    const informativeValues = [];
    const emptyValues = [];

    for (const [key, value] of unusedValues) {
      if (
        typeof value === 'function'
        || (typeof value === 'object' && value !== null)
      ) {
        continue;
      }

      if (
        value === null
        || value === undefined
        || value === ''
        || value === 0
        || value === '0'
        || value === false
      ) {
        emptyValues.push([key, value]);
      } else {
        informativeValues.push([key, value]);
      }
    }

    this.log('');
    this.log('========================================');
    this.log(' SENSOR EXPLORER – OANVÄNDA LIVEVÄRDEN');
    this.log('========================================');
    this.log(
      `Hittade ${unusedValues.length} oanvända livevärden.`
    );

    if (informativeValues.length > 0) {
      this.log('');
      this.log('--- Värden med innehåll ---');

      for (const [key, value] of informativeValues) {
        this.log(`${key} = ${String(value)}`);
      }
    }

    if (emptyValues.length > 0) {
      this.log('');
      this.log('--- Noll, false eller tomma värden ---');

      for (const [key, value] of emptyValues) {
        this.log(`${key} = ${String(value)}`);
      }
    }

    this.log('========================================');
    this.log('');
  }

  logMappedStatuses(currentValues) {
    this.log('--------------------------------');

    this.log(
      `Mode: ${
        MAPPINGS.mode[currentValues.mode]
        ?? `Okänt (${currentValues.mode})`
      }`
    );

    this.log(
      `statusCO: ${
        MAPPINGS.statusCO[currentValues.statusCO]
        ?? currentValues.statusCO
      }`
    );

    this.log(
      `statusCWU: ${
        MAPPINGS.statusCWU[currentValues.statusCWU]
        ?? currentValues.statusCWU
      }`
    );

    this.log(
      `Thermostat: ${
        MAPPINGS.thermostat[currentValues.thermostat]
        ?? currentValues.thermostat
      }`
    );

    this.log('--------------------------------');
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

    if (sensor.type === 'enum') {
      await this.updateEnumSensor(
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

  async updateEnumSensor(sensor, rawValue) {
    const mapKey = String(rawValue);
    const value = sensor.valueMap?.[mapKey] || 'unknown';

    await this.setCapabilityValue(
      sensor.capability,
      value
    );

    if (value === 'unknown') {
      this.log(
        `${sensor.title} updated: Okänt driftläge (${rawValue})`
      );
      return;
    }

    const readableValue = {
      stopped: 'Stoppad',
      startup: 'Uppstart',
      running: 'Drift',
      shutdown: 'Nereldning',
    }[value] || value;

    this.log(
      `${sensor.title} updated: ${readableValue}`
    );
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }) {
    this.log(
      `Device settings changed: ${changedKeys.join(', ')}`
    );

    await this.synchronizeCapabilities(newSettings);
    await this.updateValues();

    return this.homey.__('settings.updated');
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
