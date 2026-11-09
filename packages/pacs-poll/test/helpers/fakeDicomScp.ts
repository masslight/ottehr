import net from 'node:net';

/**
 * A scripted DICOM SCP for tests. PDUs below are built by hand from PS3.7/PS3.8 so they do not share
 * code with the encoder under test.
 */

export const APPLICATION_CONTEXT_NAME = '1.2.840.10008.3.1.1.1';
export const VERIFICATION_SOP_CLASS_UID = '1.2.840.10008.1.1';
export const IMPLICIT_VR_LITTLE_ENDIAN_UID = '1.2.840.10008.1.2';
export const SCP_AE_TITLE = 'ANY-SCP';

export const item = (type: number, body: Buffer): Buffer =>
  Buffer.concat([Buffer.from([type, 0, body.length >> 8, body.length & 0xff]), body]);

export const pdu = (type: number, body: Buffer): Buffer => {
  const header = Buffer.alloc(6);
  header[0] = type;
  header.writeUInt32BE(body.length, 2);
  return Buffer.concat([header, body]);
};

const uint16LE = (value: number): Buffer => Buffer.from([value & 0xff, value >> 8]);

const element = (group: number, elementNumber: number, value: Buffer): Buffer => {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(elementNumber, 2);
  header.writeUInt32LE(value.length, 4);
  return Buffer.concat([header, value]);
};

export const associateAccept = (contextResult = 0, contextId = 1): Buffer => {
  const fixed = Buffer.alloc(68);
  fixed.writeUInt16BE(1, 0);
  Buffer.from(SCP_AE_TITLE.padEnd(16), 'ascii').copy(fixed, 4);
  Buffer.from('PACS_POLL'.padEnd(16), 'ascii').copy(fixed, 20);
  return pdu(
    0x02,
    Buffer.concat([
      fixed,
      item(0x10, Buffer.from(APPLICATION_CONTEXT_NAME, 'ascii')),
      item(
        0x21,
        Buffer.concat([
          Buffer.from([contextId, 0, contextResult, 0]),
          item(0x40, Buffer.from(IMPLICIT_VR_LITTLE_ENDIAN_UID, 'ascii')),
        ])
      ),
      item(
        0x50,
        Buffer.concat([item(0x51, Buffer.from([0, 0, 0x40, 0])), item(0x52, Buffer.from('1.2.3.4.5.6', 'ascii'))])
      ),
    ])
  );
};

export const associateReject = (result: number, source: number, reason: number): Buffer =>
  pdu(0x03, Buffer.from([0, result, source, reason]));

export const abort = (source: number, reason: number): Buffer => pdu(0x07, Buffer.from([0, 0, source, reason]));

export const releaseResponse = (): Buffer => pdu(0x06, Buffer.alloc(4));

export const echoResponseCommand = (status: number, messageId = 1): Buffer => {
  const elements = Buffer.concat([
    element(0x0000, 0x0002, Buffer.from(`${VERIFICATION_SOP_CLASS_UID}\0`, 'ascii')),
    element(0x0000, 0x0100, uint16LE(0x8030)),
    element(0x0000, 0x0120, uint16LE(messageId)),
    element(0x0000, 0x0800, uint16LE(0x0101)),
    element(0x0000, 0x0900, uint16LE(status)),
  ]);
  const groupLength = Buffer.alloc(4);
  groupLength.writeUInt32LE(elements.length, 0);
  return Buffer.concat([element(0x0000, 0x0000, groupLength), elements]);
};

export const pdataTf = (command: Buffer, controlHeader: number, contextId = 1): Buffer => {
  const header = Buffer.alloc(6);
  header.writeUInt32BE(command.length + 2, 0);
  header[4] = contextId;
  header[5] = controlHeader;
  return pdu(0x04, Buffer.concat([header, command]));
};

export const echoResponse = (status = 0x0000): Buffer => pdataTf(echoResponseCommand(status), 0x03);

export interface ReceivedPdu {
  type: number;
  payload: Buffer;
}

export type ScpBehavior = (received: ReceivedPdu, socket: net.Socket) => void;

export interface FakeScp {
  port: number;
  received: ReceivedPdu[];
  close: () => Promise<void>;
}

export const wellBehavedScp: ScpBehavior = ({ type }, socket) => {
  if (type === 0x01) {
    socket.write(associateAccept());
  } else if (type === 0x04) {
    socket.write(echoResponse(0x0000));
  } else if (type === 0x05) {
    socket.write(releaseResponse());
  }
};

/** Writes one byte per event-loop turn so the client sees arbitrary PDU boundaries. */
export const dribble = (socket: net.Socket, bytes: Buffer): void => {
  let index = 0;
  const step = (): void => {
    if (index >= bytes.length || socket.destroyed) {
      return;
    }
    socket.write(bytes.subarray(index, index + 1));
    index += 1;
    setImmediate(step);
  };
  step();
};

export const startFakeScp = async (behavior: ScpBehavior): Promise<FakeScp> => {
  const received: ReceivedPdu[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setNoDelay(true);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    let buffered = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 6) {
        const length = buffered.readUInt32BE(2);
        if (buffered.length < 6 + length) {
          break;
        }
        const next = { type: buffered[0], payload: Buffer.from(buffered.subarray(6, 6 + length)) };
        buffered = buffered.subarray(6 + length);
        received.push(next);
        behavior(next, socket);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolve());
      }),
  };
};

/** A port nothing listens on: bind to an ephemeral port, then release it. */
export const getUnusedPort = async (): Promise<number> => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
};
