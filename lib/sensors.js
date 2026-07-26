'use strict';

/*
 * Gemensamt sensorbibliotek för ecoMAX.
 *
 * settingId kopplar sensorn till kryssrutan i
 * driver.settings.compose.json.
 *
 * type:
 *   temperature = temperatur i °C
 *   boolean     = av/på-status
 *   number      = numeriskt värde
 *
 * source:
 *   current  = /service/getDeviceParams
 *   register = /service/getDeviceRegParams
 */

module.exports = [
  {
    id: 'boiler_temperature',
    settingId: 'show_boiler_temperature',
    type: 'temperature',
    category: 'Panna',
    title: 'Panntemperatur',
    capability: 'measure_temperature.boiler',
    source: 'current',
    sourceKey: 'tempCO',
    enabledByDefault: true,
  },
  {
    id: 'outside_temperature',
    settingId: 'show_outside_temperature',
    type: 'temperature',
    category: 'Panna',
    title: 'Utomhustemperatur',
    capability: 'measure_temperature.outside',
    source: 'current',
    sourceKey: 'tempExternalSensor',
    enabledByDefault: true,
  },
  {
    id: 'buffer_top',
    settingId: 'show_buffer_top',
    type: 'temperature',
    category: 'Ackumulatortank',
    title: 'Buffert övre',
    capability: 'measure_temperature.buffer_top',
    source: 'current',
    sourceKey: 'tempUpperBuffer',
    enabledByDefault: true,
  },
  {
    id: 'buffer_middle',
    settingId: 'show_buffer_middle',
    type: 'temperature',
    category: 'Ackumulatortank',
    title: 'Buffert mitten',
    capability: 'measure_temperature.buffer_middle',
    source: 'register',
    sourceKey: '24',
    enabledByDefault: true,
  },
  {
    id: 'buffer_bottom',
    settingId: 'show_buffer_bottom',
    type: 'temperature',
    category: 'Ackumulatortank',
    title: 'Buffert nedre',
    capability: 'measure_temperature.buffer_bottom',
    source: 'current',
    sourceKey: 'tempLowerBuffer',
    enabledByDefault: true,
  },
  {
    id: 'heating_circuit_1_temperature',
    settingId: 'show_heating_circuit_1_temperature',
    type: 'temperature',
    category: 'Värmekrets 1',
    title: 'Framledning krets 1',
    capability: 'measure_temperature.mixer1',
    source: 'current',
    sourceKey: 'mixerTemp1',
    enabledByDefault: true,
  },
  {
    id: 'heating_circuit_1_target',
    settingId: 'show_heating_circuit_1_target',
    type: 'temperature',
    category: 'Värmekrets 1',
    title: 'Börvärde krets 1',
    capability: 'measure_temperature.mixer1_set',
    source: 'current',
    sourceKey: 'mixerSetTemp1',
    enabledByDefault: true,
  },
  {
    id: 'pump_co',
    settingId: 'show_pump_co',
    type: 'boolean',
    category: 'Värmekrets 1',
    title: 'Värmekretspump 1',
    capability: 'pump_co',
    source: 'current',
    sourceKey: 'pumpCOWorks',
    enabledByDefault: true,
  },
  {
    id: 'pump_cwu',
    settingId: 'show_pump_cwu',
    type: 'boolean',
    category: 'Övriga pumpar',
    title: 'Varmvattenpump',
    capability: 'pump_cwu',
    source: 'current',
    sourceKey: 'pumpCWUWorks',
    enabledByDefault: true,
  },
  {
    id: 'pump_circulation',
    settingId: 'show_pump_circulation',
    type: 'boolean',
    category: 'Övriga pumpar',
    title: 'Cirkulationspump',
    capability: 'pump_circulation',
    source: 'current',
    sourceKey: 'pumpCirculationWorks',
    enabledByDefault: true,
  },
  {
    id: 'flue_gas_fan',
    settingId: 'show_flue_gas_fan',
    type: 'boolean',
    category: 'Panna',
    title: 'Rökgasfläkt',
    capability: 'flue_gas_fan',
    source: 'current',
    sourceKey: 'fan2ExhaustWorks',
    enabledByDefault: true,
  },
  {
    id: 'flue_gas_fan_power',
    settingId: 'show_flue_gas_fan_power',
    type: 'number',
    category: 'Panna',
    title: 'Rökgasfläkt effekt',
    capability: 'flue_gas_fan_power',
    source: 'current',
    sourceKey: 'fanPower',
    enabledByDefault: true,
  },
];