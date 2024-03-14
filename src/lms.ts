import * as dgram from 'dgram';
import * as net from 'net';

import { TextEncoder } from 'util';

const encodeMessage = (...args: string[]): Uint8Array => {
  const message = args.join(' ');
  const textEncoder = new TextEncoder();
  return textEncoder.encode(message + '\r\n');
};

const decodeMessage = (data: Buffer): string[] => {
  return data.toString('utf8').trim().split(/\s+/).map(decodeURIComponent);
};

export function discoverSlimServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');

    sock.bind(() => {
      sock.setBroadcast(true);
      sock.send(Buffer.from('e', 'utf-8'), 3483, '255.255.255.255', (err) => {
        if (err) {
          sock.close();
          return reject(err);
        }
      });
    });

    sock.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      const host = rinfo.address;
      sock.close();
      resolve(host);
    });

    sock.on('error', (err: Error) => {
      sock.close();
      reject(err);
    });
  });
}

export class SlimServer {

  host: string;
  port: number;

  _client: null | net.Socket = null;

  constructor(host: string, port = 9090) {
    this.host = host;
    this.port = port;
  }

  async connect() {
    return new Promise<net.Socket>((resolve, reject) => {
      const client = new net.Socket();

      client.connect(this.port, this.host, () => {
        console.log('Connected to server');
        this._client = client;
        resolve(client);
      });

      client.on('error', (error) => {
        reject(error);
      });
    });
  }

  async getPlayers() {
    const count = Number(await this.question('player', 'count'));
    const results = new Array(count);
    for (let index = 0; index < count; index++) {
      const player_id = await this.question('player', 'id', `${index}`) as string;
      const response = await this.query(player_id, 'status');
      results[index] = { player_id, ...response };
    }
    return results;
  }

  async question(...args: string[]) {
    const response = (await this.request(...args, '?')).slice(args.length);
    return response.pop();
  }

  async query(...args: string[]) {
    const result = (await this.request(...args)).slice(args.length);
    if (result.length === 1) {
      return result;
    }
    return Object.fromEntries(result.map(item => item.split(':')));
  }

  async request(...args: string[]) {
    return new Promise<string[]>((resolve, reject) => {
      this
        .connect()
        .then((client) => {
          client.on('data', (data: Buffer) => {
            const response = decodeMessage(data);
            console.log('Receving message:');
            console.log(response);
            resolve(response);
            client.end();
          });
          const bytes = encodeMessage(...args);
          console.log('Sending message:');
          console.log(args.join(' '));
          client.write(bytes);
        });
    });
  }
}

// Usage
// discoverSlimServer()
//   .then((host) => {
//     console.log('SlimServer discovered at:', host);
//     const server = new SlimServer(host);
//     server.getPlayers();
//   })
//   .catch((err) => {
//     console.error('Error discovering SlimServer:', err);
//   });