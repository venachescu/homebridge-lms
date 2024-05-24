import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { LmsHomebridgePlatform } from './lmsPlatform';
import { SlimServer } from './lms';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LmsModalPlayerAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    deviceOn: false,
    On: false,
  };

  private id: string;
  private playerId: string;
  private server: string;
  private name: string;
  private input: string;

  constructor(
    private readonly platform: LmsHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    server: string,
    playerId: string,
    name: string,
    input: string,
  ) {
    this.id = `${playerId}:${input}`;
    this.playerId = playerId;
    this.server = server;
    this.name = name;
    this.input = input.toUpperCase();

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Logitech')
      .setCharacteristic(this.platform.Characteristic.Model, 'Squeezebox')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.id);

    // this.service = this.accessory.getService(this.platform.Service.Speaker) || this.accessory.addService(this.platform.Service.Speaker);
    this.service = this.accessory.getService(this.platform.Service.Outlet) || this.accessory.addService(this.platform.Service.Outlet);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.name);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {

    const prevDeviceState = Boolean(this.state.deviceOn);
    this.state.On = value as boolean;

    const client = new SlimServer(this.server);
    await client.query(this.playerId, 'power', `${Number(value)}`);
    this.platform.players[this.playerId].power = value;
    this.platform.log.debug(`${JSON.stringify(this.platform.players)}`);

    if (value) {
      if (!prevDeviceState) {
        await this.sleep(2000);
      }
      const response = await client.query(this.playerId, 'irblaster', 'send', 'RX497', `INPUT_${this.input}`);
      this.platform.inputStates[this.playerId] = this.input;
      this.platform.players[this.playerId] = this.input;
      this.platform.log.debug('Response ->', response);
    }

    this.platform.log.debug(`Set Characteristic On From ${prevDeviceState} -> ${value}`);
  }

  /**
   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {

    this.platform.log.debug(`${this.id} ${this.playerId} ${this.name} ${this.input}`);
    this.platform.log.debug(`Power: ${this.platform.players[this.playerId].power}`);
    this.platform.log.debug(`Input: ${this.platform.players[this.playerId].power}`);

    const client = new SlimServer(this.server);
    const status = await client.query(this.playerId, 'status');
    this.state.deviceOn = Boolean(Number(status.power));
    this.state.On = this.state.deviceOn && (this.platform.inputStates[this.playerId] === this.input);

    this.platform.log.debug('Power state', Boolean(Number(status.power)));
    this.platform.log.debug('Input states', (this.platform.inputStates[this.playerId] === this.input));
    this.platform.log.debug('Get Characteristic On ->', this.state.On);
    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return this.state.On;
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}
