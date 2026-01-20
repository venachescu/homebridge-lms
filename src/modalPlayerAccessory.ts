import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { LmsHomebridgePlatform } from './lmsPlatform';
import { SlimServer } from './lms';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LmsModalPlayerAccessory {

  private inputService: Service;
  private speakerService: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    active: false,
    mute: false,
    inputSource: 0,
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

    this.inputService = this.accessory.getService(this.platform.Service.InputSource)
      || this.accessory.addService(this.platform.Service.InputSource);

    this.speakerService = this.accessory.getService(this.platform.Service.Speaker)
      || this.accessory.addService(this.platform.Service.Speaker);

    // set accessory information
    // this.accessory.getService(this.platform.Service.AccessoryInformation)!
    //   .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Logitech')
    //   .setCharacteristic(this.platform.Characteristic.Model, 'Squeezebox')
    //   .setCharacteristic(this.platform.Characteristic.SerialNumber, this.id);

    this.inputService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.playerName);
    this.inputService.setCharacteristic(this.platform.Characteristic.Name, this.playerName);
    this.inputService.setCharacteristic(this.platform.Characteristic.IsConfigured, true);
    this.inputService.setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, true);
    this.inputService.setCharacteristic(this.platform.Characteristic.InputDeviceType,
      this.platform.Characteristic.InputDeviceType.AUDIO_SYSTEM);

    this.inputService.setCharacteristic(this.platform.Characteristic.InputSourceType, 0);
    this.inputService.getCharacteristic(this.platform.Characteristic.InputSourceType)
      .onSet(this.setInputSource.bind(this))
      .onGet(this.getInputSource.bind(this));

    this.speakerService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
      .onSet(this.setMute.bind(this))
      .onGet(this.getMute.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {

    // const prevDeviceState = Boolean(this.state.deviceOn);
    const prevDeviceState = Boolean(this.platform.players[this.playerId].power);
    this.state.active = value as boolean;

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
    this.state.active = this.platform.players[this.playerId].power;

    this.platform.log.debug('Power state', this.platform.players[this.playerId].power);
    this.platform.log.debug('Input states', (this.platform.players[this.playerId].input === this.input));
    // this.platform.log.debug('Power state', Boolean(Number(status.power)));
    // this.platform.log.debug('Input states', (this.platform.inputStates[this.playerId] === this.input));
    this.platform.log.debug('Get Characteristic On ->', this.state.active);
    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return this.state.active;
  }

  async setMute(value: CharacteristicValue) {
    this.platform.log.debug(`Set Characteristic Mute From ${value}`);
  }

  async getMute(): Promise<CharacteristicValue> {
    this.platform.log.debug(`Get Characteristic Mute -> ${this.state.mute}`);
    return this.state.mute;
  }

  async setInputSource(value: CharacteristicValue) {
    this.platform.log.debug(`Set Characteristic InputSource From ${this.input} -> ${value}`);
  }

  async getInputSource(): Promise<CharacteristicValue> {
    this.platform.log.debug(`Get Characteristic InputSource -> ${this.input}`);
    return this.state.inputSource;
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}
