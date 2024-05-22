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
    On: false,
  };

  private id: string;
  private playerId: string;
  private slimserver: string;
  private name: string;
  private input: string;

  constructor(
    private readonly platform: LmsHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    slimserver: string,
    name: string,
    input: string,
  ) {

    this.id = `${accessory.context.device.player_id}:${input}`;
    this.playerId = accessory.context.device.player_id;
    this.slimserver = slimserver;
    this.name = name;
    this.input = input.toUpperCase();

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Logitech')
      .setCharacteristic(this.platform.Characteristic.Model, 'Squeezebox')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.player_id);

    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

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

    this.state.On = value as boolean;

    const client = await new SlimServer(this.slimserver);
    const response = await client.query(this.playerId, 'power', `${Number(value)}`);
    this.platform.log.debug('Response ->', response);

    if (value) {
      const response = await client.query(this.playerId, 'input', `Input${this.input}`);
      this.platform.log.debug('Response ->', response);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {

    const client = new SlimServer(this.slimserver);
    const status = await client.query(this.playerId, 'status');
    this.state.On = Boolean(Number(status.power)) && (this.platform.inputStates[this.playerId] === this.input);

    this.platform.log.debug('Power state', Boolean(Number(status.power)));
    this.platform.log.debug('Input states', (this.platform.inputStates[this.playerId] === this.input));
    this.platform.log.debug('Get Characteristic On ->', this.state.On);
    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return this.state.On;
  }

}
