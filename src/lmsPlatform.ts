import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, Categories } from 'homebridge';

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
  public readonly deviceInputs: { [deviceId: string]: string} = {};
  public readonly inputStates: { [macAddress: string]: string } = {};

  public server?: SlimServer;
  public readonly players: { playerId?: string } = {};
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
      .then(server => server.getPlayers())
      .then(players => {

        this.log.info(`players: ${JSON.stringify(players)}`);
        for (const player of players) {

          const { player_id: playerId, player_name: name, power: status, host } = player;
          this.players[playerId] = { name, status, host, input: '' };

          this.log.info(`attaching to player: ${playerId} ${name} ${status} ${host}`);
          this.log.info(`in configuration: ${playerId in this.configuration}`);
          if (!(player.player_id in this.configuration)) {
            continue;
          }

          for (const playerConfig of this.configuration[playerId]) {

            const uuid = this.api.hap.uuid.generate(`${player.player_id}:${playerConfig.name}`);
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            this.players[playerId].input = playerConfig.input;

            if (existingAccessory) {
              this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
              new LmsModalPlayerAccessory(this, existingAccessory, host, playerConfig.name, playerConfig.input);
            } else {
              this.log.info('Adding new accessory:', playerConfig.name);

              const accessory = new this.api.platformAccessory(playerConfig.name, uuid, Categories.SPEAKER);
              accessory.context.device = this.players;

              new LmsModalPlayerAccessory(this, accessory, host, playerConfig.name, playerConfig.input);
              this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
          }
        }
      });
  }
}
