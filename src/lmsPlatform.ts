import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LmsModalPlayerAccessory } from './modalPlayerAccessory';
// import { LmsPlayerAccessory } from './playerAccessory';

import { discoverSlimServer, SlimServer } from './lms';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class LmsHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly inputStates: { [macAddress: string]: string } = {};
  public readonly configuration: { [macAddress: string]: Array<{ name: string; input: string }> } = {
    '00:04:20:07:ec:32': [
      { name: 'Technics', input: 'CD' },
      { name: 'Squeezebox', input: 'DVD' },
    ],
  };

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.api.on('didFinishLaunching', () => {
      log.debug('Running device auto-discovery...');
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   */
  discoverDevices() {

    discoverSlimServer()
      .then(host => new SlimServer(host))
      .then(client => client.getPlayers())
      .then(players => {

        for (const device of players) {

          if (!(device.player_id in this.configuration)) {
            continue;
          }

          for (const playerMode of this.configuration[device.player_id]) {

            const uuid = this.api.hap.uuid.generate(`${device.player_id}:${playerMode.name}`);
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            this.inputStates[device.player_id] = playerMode.input;

            if (existingAccessory) {
              this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
              new LmsModalPlayerAccessory(this, existingAccessory, device.host, playerMode.name, playerMode.input);
            } else {
              this.log.info('Adding new accessory:', device.player_name);

              const accessory = new this.api.platformAccessory(device.player_name, uuid);
              accessory.context.device = device;

              new LmsModalPlayerAccessory(this, accessory, device.host, playerMode.name, playerMode.input);
              this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
          }
        }
      });
  }
}
