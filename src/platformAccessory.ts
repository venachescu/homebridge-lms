import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { LmsHomebridgePlatform } from './platform';
import { SlimServer, discoverSlimServer } from './lms';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LmsPlatformAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    On: false,
    Volume: 100,
    Mute: false,
  };

  private id: string;

  constructor(
    private readonly platform: LmsHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    this.id = accessory.context.player_id;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Logitech')
      .setCharacteristic(this.platform.Characteristic.Model, 'Squeezebox')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.player_id);

    this.service = this.accessory.getService(this.platform.Service.Speaker) || this.accessory.addService(this.platform.Service.Speaker);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Volume)
      .onSet(this.setVolume.bind(this))
      .onGet(this.getVolume.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Mute)
      .onSet(this.setMute.bind(this))
      .onGet(this.getMute.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {

    this.state.On = value as boolean;

    discoverSlimServer()
      .then(host => new SlimServer(host))
      .then(client => client.query(this.id, 'power', `${Number(value)}`));

    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    let isOn = this.state.On;

    const client = new SlimServer(await discoverSlimServer());
    const status = await client.query(this.id, 'status');
    isOn = Boolean(Number(status.power));

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn;
  }

  /**
   */
  async getVolume(): Promise<CharacteristicValue> {
    let volume = this.state.Volume;

    const client = new SlimServer(await discoverSlimServer());
    const status = await client.query(this.id, 'status');
    volume = Number(status['mixer volume']);

    this.platform.log.debug('Get Characteristic Volume ->', volume);

    return volume;
  }

  /**
   */
  async setVolume(value: CharacteristicValue) {
    this.state.Volume = value as number;
    const client = new SlimServer(await discoverSlimServer());
    const volume = await client.query(this.id, 'mixer', 'volume', `${this.state.Volume}`);
    this.platform.log.debug('Set Characteristic Brightness -> ', volume);
  }

  /**
   */
  async getMute(): Promise<CharacteristicValue> {

    const client = new SlimServer(await discoverSlimServer());
    const status = await client.query(this.id, 'status');
    this.state.Mute = Boolean(Number(status['mixer muting']));

    this.platform.log.debug('Get Characteristic Volume ->', this.state.Mute);

    return this.state.Mute;
  }

  /**
   */
  async setMute(value: CharacteristicValue): Promise<CharacteristicValue> {

    this.state.Mute = value as boolean;
    const client = new SlimServer(await discoverSlimServer());
    const status = await client.query(this.id, 'mixer', 'muting');
    this.state.Mute = Boolean(Number(status['mixer muting']));

    this.platform.log.debug('Get Characteristic Volume ->', this.state.Mute);

    return this.state.Mute;
  }

}
