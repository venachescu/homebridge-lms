import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { LmsHomebridgePlatform } from './lmsPlatform';
import { SlimServer } from './lms';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LmsModalPlayerAccessory {

  private inputServices: Service[] = [];
  private switchService: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    on: false,
    mute: false,
    inputSource: 0,
    isConfigured: false,
  };

  private id: string;
  private playerId: string;
  private playerName: string;
  private server: string;
  private input: string;

  constructor(
    private readonly platform: LmsHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    server: string,
    playerId: string,
    playerName?: string,
    input?: string,
  ) {
    this.id = `${playerId}`;
    this.playerId = playerId;
    this.playerName = playerName || '';
    this.server = server;
    this.input = input || 'INPUT';

    // this.service = this.accessory.getService(this.platform.Service.Speaker) || this.accessory.addService(this.platform.Service.Speaker);
    // this.service = this.accessory.getService(this.platform.Service.Outlet) || this.accessory.addService(this.platform.Service.Outlet);

    this.inputServices.push(this.accessory.getService(this.platform.Service.InputSource)
      || this.accessory.addService(this.platform.Service.InputSource));

    this.switchService = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    this.switchService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Logitech')
      .setCharacteristic(this.platform.Characteristic.Model, 'Squeezebox')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.id);

    this.inputServices[0].setCharacteristic(this.platform.Characteristic.Name, 'Mixer');

    this.inputServices[0].setCharacteristic(this.platform.Characteristic.InputSourceType, 0);
    this.inputServices[0].getCharacteristic(this.platform.Characteristic.InputSourceType)
      .onSet(this.setInputSource.bind(this))
      .onGet(this.getInputSource.bind(this));

    // create handlers for required characteristics
    this.inputServices[0].getCharacteristic(this.platform.Characteristic.ConfiguredName)
      .onGet(this.handleConfiguredNameGet.bind(this))
      .onSet(this.handleConfiguredNameSet.bind(this));

    this.inputServices[0].getCharacteristic(this.platform.Characteristic.InputSourceType)
      .onGet(this.handleInputSourceTypeGet.bind(this));

    this.inputServices[0].getCharacteristic(this.platform.Characteristic.IsConfigured)
      .onGet(this.handleIsConfiguredGet.bind(this))
      .onSet(this.handleIsConfiguredSet.bind(this));

    this.inputServices[0].getCharacteristic(this.platform.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));

    this.inputServices[0].getCharacteristic(this.platform.Characteristic.CurrentVisibilityState)
      .onGet(this.handleCurrentVisibilityStateGet.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {

    // const prevDeviceState = Boolean(this.state.deviceOn);
    const prevDeviceState = Boolean(this.platform.players[this.playerId].power);
    this.state.on = value as boolean;

    const client = new SlimServer(this.server);
    const power = await client.query(this.playerId, 'power', `${Number(value)}`);
    this.platform.players[this.playerId].power = Number(value);
    this.platform.log.debug(`sent power query: ${power}`);

    if (value) {
      if (!prevDeviceState) {
        await this.sleep(2000);
      }
      await client.query(this.playerId, 'irblaster', 'send', 'YamahaRAX100', `Input${this.input}`);
      this.platform.inputStates[this.playerId] = this.input;
      this.platform.players[this.playerId].input = this.input;
    }

    this.platform.log.debug(`Set Characteristic On From ${prevDeviceState} -> ${value}`);
    this.platform.log.debug(`Players: ${JSON.stringify(this.platform.players)}`);
  }

  /**
   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {

    this.platform.log.debug(`${this.id} ${this.playerId} ${this.playerName} ${this.input}`);
    // this.platform.log.debug(`Power: ${this.platform.players[this.playerId].power}`);
    // this.platform.log.debug(`Input: ${this.platform.players[this.playerId].input}`);
    this.platform.log.debug(`Players: ${JSON.stringify(this.platform.players)}`);

    const client = new SlimServer(this.server);
    const status = await client.query(this.playerId, 'status');
    this.platform.players[this.playerId].power = Number(status.power);
    // this.state.deviceOn = Boolean(Number(status.power));
    this.state.on = this.platform.players[this.playerId].power;

    this.platform.log.debug('Power state', this.platform.players[this.playerId].power);
    this.platform.log.debug('Input states', (this.platform.players[this.playerId].input === this.input));
    // this.platform.log.debug('Power state', Boolean(Number(status.power)));
    // this.platform.log.debug('Input states', (this.platform.inputStates[this.playerId] === this.input));
    this.platform.log.debug('Get Characteristic On ->', this.state.on);
    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return this.state.on;
  }

  async setInputSource(value: CharacteristicValue) {
    this.platform.log.debug(`Set Characteristic InputSource From ${this.input} -> ${value}`);
  }

  async getInputSource(): Promise<CharacteristicValue> {
    this.platform.log.debug(`Get Characteristic InputSource -> ${this.input}`);
    return this.state.inputSource;
  }

  /**
   * Handle requests to get the current value of the "Configured Name" characteristic
   */
  handleConfiguredNameGet() {
    this.platform.log.debug('Triggered GET ConfiguredName');

    // set this to a valid value for ConfiguredName
    const currentValue = 1;

    return currentValue;
  }

  /**
   * Handle requests to set the "Configured Name" characteristic
   */
  handleConfiguredNameSet(value) {
    this.platform.log.debug(`Triggered SET ConfiguredName: ${value}`);
  }

  /**
   * Handle requests to get the current value of the "Input Source Type" characteristic
   */
  handleInputSourceTypeGet() {
    this.platform.log.debug('Triggered GET InputSourceType');

    // set this to a valid value for InputSourceType
    const currentValue = this.platform.Characteristic.InputSourceType.OTHER;

    return currentValue;
  }


  /**
   * Handle requests to get the current value of the "Is Configured" characteristic
   */
  handleIsConfiguredGet() {
    this.platform.log.debug('Triggered GET IsConfigured');

    // set this to a valid value for IsConfigured
    // const currentValue = this.platform.Characteristic.IsConfigured.NOT_CONFIGURED;
    const currentValue = this.platform.Characteristic.IsConfigured.CONFIGURED;

    return currentValue;
  }

  /**
   * Handle requests to set the "Is Configured" characteristic
   */
  handleIsConfiguredSet(value) {
    this.platform.log.debug(`Triggered SET IsConfigured: ${value}`);
    this.state.isConfigured = value as boolean;
  }

  /**
   * Handle requests to get the current value of the "Name" characteristic
   */
  handleNameGet() {
    this.platform.log.debug('Triggered GET Name');

    // set this to a valid value for Name
    const currentValue = 1;

    return currentValue;
  }

  /**
   * Handle requests to get the current value of the "Current Visibility State" characteristic
   */
  handleCurrentVisibilityStateGet() {
    this.platform.log.debug('Triggered GET CurrentVisibilityState');

    // set this to a valid value for CurrentVisibilityState
    const currentValue = this.platform.Characteristic.CurrentVisibilityState.SHOWN;

    return currentValue;
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}
