import net from 'node:net';

/**
 * Minimal DICOM C-ECHO SCU (a DICOM "ping"), written directly against the DICOM Upper Layer protocol
 * (PS3.8) and DIMSE-C (PS3.7) so the poller needs neither dcm4che nor Java on the host.
 *
 * One echo runs the same association lifecycle a modality would:
 *   TCP connect → A-ASSOCIATE-RQ → A-ASSOCIATE-AC → C-ECHO-RQ → C-ECHO-RSP → A-RELEASE-RQ → A-RELEASE-RP
 * and succeeds only when the peer accepts the Verification SOP Class and answers with status 0x0000.
 */

export interface DicomEchoOptions {
  host: string;
  port: number;
  /** AE title of the SCP being verified (1-16 characters). */
  calledAeTitle: string;
  /** AE title this poller presents itself as (1-16 characters). */
  callingAeTitle: string;
  /** Deadline for the whole exchange, TCP connect included. */
  timeoutMs: number;
}

export type DicomEchoFailureReason =
  | 'connect_error'
  | 'timeout'
  | 'association_rejected'
  | 'presentation_context_rejected'
  | 'aborted'
  | 'connection_closed'
  | 'protocol_error'
  | 'echo_failure_status';

export class DicomEchoError extends Error {
  readonly reason: DicomEchoFailureReason;

  constructor(reason: DicomEchoFailureReason, message: string) {
    super(message);
    this.name = 'DicomEchoError';
    this.reason = reason;
  }
}

const APPLICATION_CONTEXT_NAME = '1.2.840.10008.3.1.1.1';
export const VERIFICATION_SOP_CLASS_UID = '1.2.840.10008.1.1';
const IMPLICIT_VR_LITTLE_ENDIAN_UID = '1.2.840.10008.1.2';
// UUID-derived UID under the ISO/ITU-T "2.25" arc, which needs no registered root (PS3.5 B.2).
const IMPLEMENTATION_CLASS_UID = '2.25.324603257484646771108536778689154495449';
const IMPLEMENTATION_VERSION_NAME = 'OTTEHR_PACSPOLL';
export const PRESENTATION_CONTEXT_ID = 1;
const MAX_PDU_LENGTH_RECEIVED = 16384;
const ECHO_MESSAGE_ID = 1;
// Nothing in a C-ECHO exchange comes anywhere near this; it only bounds buffering of a misbehaving peer.
const MAX_INCOMING_PDU_LENGTH = 1024 * 1024;
// How long to wait for A-RELEASE-RP once the echo itself has already succeeded.
const RELEASE_TIMEOUT_MS = 2000;

const PduType = {
  AssociateRequest: 0x01,
  AssociateAccept: 0x02,
  AssociateReject: 0x03,
  PDataTf: 0x04,
  ReleaseRequest: 0x05,
  ReleaseResponse: 0x06,
  Abort: 0x07,
} as const;

const PDU_NAMES: Record<number, string> = {
  [PduType.AssociateRequest]: 'A-ASSOCIATE-RQ',
  [PduType.AssociateAccept]: 'A-ASSOCIATE-AC',
  [PduType.AssociateReject]: 'A-ASSOCIATE-RJ',
  [PduType.PDataTf]: 'P-DATA-TF',
  [PduType.ReleaseRequest]: 'A-RELEASE-RQ',
  [PduType.ReleaseResponse]: 'A-RELEASE-RP',
  [PduType.Abort]: 'A-ABORT',
};

const ItemType = {
  ApplicationContext: 0x10,
  PresentationContextRequest: 0x20,
  PresentationContextAccept: 0x21,
  AbstractSyntax: 0x30,
  TransferSyntax: 0x40,
  UserInformation: 0x50,
  MaximumLength: 0x51,
  ImplementationClassUid: 0x52,
  ImplementationVersionName: 0x55,
} as const;

/** Command set tags, as (group << 16) | element. */
export const CommandTag = {
  GroupLength: 0x00000000,
  AffectedSopClassUid: 0x00000002,
  CommandField: 0x00000100,
  MessageId: 0x00000110,
  MessageIdBeingRespondedTo: 0x00000120,
  CommandDataSetType: 0x00000800,
  Status: 0x00000900,
} as const;

export const C_ECHO_RQ = 0x0030;
export const C_ECHO_RSP = 0x8030;
const NO_DATA_SET_PRESENT = 0x0101;
const MESSAGE_CONTROL_COMMAND = 0x01;
const MESSAGE_CONTROL_LAST_FRAGMENT = 0x02;

// PS3.8 table 9-21
const REJECT_RESULT: Record<number, string> = { 1: 'rejected-permanent', 2: 'rejected-transient' };
const REJECT_SOURCE: Record<number, string> = {
  1: 'service-user',
  2: 'service-provider (ACSE)',
  3: 'service-provider (presentation)',
};
const REJECT_REASON: Record<number, Record<number, string>> = {
  1: {
    1: 'no-reason-given',
    2: 'application-context-name-not-supported',
    3: 'calling-AE-title-not-recognized',
    7: 'called-AE-title-not-recognized',
  },
  2: { 1: 'no-reason-given', 2: 'protocol-version-not-supported' },
  3: { 1: 'temporary-congestion', 2: 'local-limit-exceeded' },
};
// PS3.8 table 9-18
const PRESENTATION_CONTEXT_RESULT: Record<number, string> = {
  0: 'acceptance',
  1: 'user-rejection',
  2: 'no-reason',
  3: 'abstract-syntax-not-supported',
  4: 'transfer-syntaxes-not-supported',
};
// PS3.8 table 9-26
const ABORT_SOURCE: Record<number, string> = { 0: 'service-user', 2: 'service-provider' };
const ABORT_REASON: Record<number, string> = {
  0: 'reason-not-specified',
  1: 'unrecognized-PDU',
  2: 'unexpected-PDU',
  4: 'unrecognized-PDU-parameter',
  5: 'unexpected-PDU-parameter',
  6: 'invalid-PDU-parameter-value',
};

// ── Encoding ────────────────────────────────────────────────────────

const hex = (value: number, digits: number): string => value.toString(16).padStart(digits, '0');

const encodeItem = (type: number, body: Buffer): Buffer => {
  const header = Buffer.alloc(4);
  header.writeUInt8(type, 0);
  header.writeUInt16BE(body.length, 2);
  return Buffer.concat([header, body]);
};

const encodePdu = (type: number, body: Buffer): Buffer => {
  const header = Buffer.alloc(6);
  header.writeUInt8(type, 0);
  header.writeUInt32BE(body.length, 2);
  return Buffer.concat([header, body]);
};

// UIDs inside association items are sent at their exact length, without the null padding used in data sets.
const encodeUidItem = (type: number, uid: string): Buffer => encodeItem(type, Buffer.from(uid, 'ascii'));

const encodeAeTitle = (aeTitle: string): Buffer => Buffer.from(aeTitle.padEnd(16, ' '), 'ascii');

export const encodeAssociateRequest = (calledAeTitle: string, callingAeTitle: string): Buffer => {
  // Protocol version, 2 reserved bytes, called AE, calling AE, 32 reserved bytes (PS3.8 table 9-11).
  const fixedFields = Buffer.alloc(68);
  fixedFields.writeUInt16BE(1, 0);
  encodeAeTitle(calledAeTitle).copy(fixedFields, 4);
  encodeAeTitle(callingAeTitle).copy(fixedFields, 20);

  const presentationContext = encodeItem(
    ItemType.PresentationContextRequest,
    Buffer.concat([
      Buffer.from([PRESENTATION_CONTEXT_ID, 0, 0, 0]),
      encodeUidItem(ItemType.AbstractSyntax, VERIFICATION_SOP_CLASS_UID),
      encodeUidItem(ItemType.TransferSyntax, IMPLICIT_VR_LITTLE_ENDIAN_UID),
    ])
  );

  const maximumLength = Buffer.alloc(4);
  maximumLength.writeUInt32BE(MAX_PDU_LENGTH_RECEIVED, 0);
  const userInformation = encodeItem(
    ItemType.UserInformation,
    Buffer.concat([
      encodeItem(ItemType.MaximumLength, maximumLength),
      encodeUidItem(ItemType.ImplementationClassUid, IMPLEMENTATION_CLASS_UID),
      encodeItem(ItemType.ImplementationVersionName, Buffer.from(IMPLEMENTATION_VERSION_NAME, 'ascii')),
    ])
  );

  return encodePdu(
    PduType.AssociateRequest,
    Buffer.concat([
      fixedFields,
      encodeUidItem(ItemType.ApplicationContext, APPLICATION_CONTEXT_NAME),
      presentationContext,
      userInformation,
    ])
  );
};

const uint16LE = (value: number): Buffer => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
};

const uint32LE = (value: number): Buffer => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
};

// UI values in a data set or command set are padded to even length with a single null (PS3.5 6.2).
const encodeUidValue = (uid: string): Buffer => Buffer.from(uid.length % 2 === 0 ? uid : `${uid}\0`, 'ascii');

// Command sets are always Implicit VR Little Endian (PS3.7 6.3.1).
const encodeCommandElement = (tag: number, value: Buffer): Buffer => {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(tag >>> 16, 0);
  header.writeUInt16LE(tag & 0xffff, 2);
  header.writeUInt32LE(value.length, 4);
  return Buffer.concat([header, value]);
};

/** C-ECHO-RQ command set (PS3.7 table 9.3-12). */
export const encodeEchoRequestCommand = (messageId: number): Buffer => {
  const elements = Buffer.concat([
    encodeCommandElement(CommandTag.AffectedSopClassUid, encodeUidValue(VERIFICATION_SOP_CLASS_UID)),
    encodeCommandElement(CommandTag.CommandField, uint16LE(C_ECHO_RQ)),
    encodeCommandElement(CommandTag.MessageId, uint16LE(messageId)),
    encodeCommandElement(CommandTag.CommandDataSetType, uint16LE(NO_DATA_SET_PRESENT)),
  ]);
  return Buffer.concat([encodeCommandElement(CommandTag.GroupLength, uint32LE(elements.length)), elements]);
};

/** Wraps a complete command set in a single-fragment P-DATA-TF PDU (PS3.8 table 9-22). */
export const encodeCommandPDataTf = (presentationContextId: number, command: Buffer): Buffer => {
  const pdvHeader = Buffer.alloc(6);
  // Item length covers the presentation context id, the message control header and the value.
  pdvHeader.writeUInt32BE(command.length + 2, 0);
  pdvHeader.writeUInt8(presentationContextId, 4);
  pdvHeader.writeUInt8(MESSAGE_CONTROL_COMMAND | MESSAGE_CONTROL_LAST_FRAGMENT, 5);
  return encodePdu(PduType.PDataTf, Buffer.concat([pdvHeader, command]));
};

export const encodeReleaseRequest = (): Buffer => encodePdu(PduType.ReleaseRequest, Buffer.alloc(4));

// ── Decoding ────────────────────────────────────────────────────────

const protocolError = (message: string): DicomEchoError => new DicomEchoError('protocol_error', message);

/** Presentation context id → result/reason, read from the A-ASSOCIATE-AC variable items. */
export const parseAssociateAccept = (payload: Buffer): Map<number, number> => {
  if (payload.length < 68) {
    throw protocolError(`A-ASSOCIATE-AC is ${payload.length} bytes, shorter than its fixed fields`);
  }
  const results = new Map<number, number>();
  let offset = 68;
  while (offset + 4 <= payload.length) {
    const type = payload.readUInt8(offset);
    const length = payload.readUInt16BE(offset + 2);
    const body = payload.subarray(offset + 4, offset + 4 + length);
    if (body.length < length) {
      throw protocolError('A-ASSOCIATE-AC item runs past the end of the PDU');
    }
    if (type === ItemType.PresentationContextAccept && body.length >= 4) {
      results.set(body.readUInt8(0), body.readUInt8(2));
    }
    offset += 4 + length;
  }
  return results;
};

export interface PresentationDataValue {
  presentationContextId: number;
  isCommand: boolean;
  isLastFragment: boolean;
  data: Buffer;
}

export const parsePDataTf = (payload: Buffer): PresentationDataValue[] => {
  const values: PresentationDataValue[] = [];
  let offset = 0;
  while (offset < payload.length) {
    if (offset + 6 > payload.length) {
      throw protocolError('P-DATA-TF presentation data value header is truncated');
    }
    const itemLength = payload.readUInt32BE(offset);
    if (itemLength < 2 || offset + 4 + itemLength > payload.length) {
      throw protocolError(`P-DATA-TF presentation data value length ${itemLength} does not fit in the PDU`);
    }
    const controlHeader = payload.readUInt8(offset + 5);
    values.push({
      presentationContextId: payload.readUInt8(offset + 4),
      isCommand: (controlHeader & MESSAGE_CONTROL_COMMAND) !== 0,
      isLastFragment: (controlHeader & MESSAGE_CONTROL_LAST_FRAGMENT) !== 0,
      data: payload.subarray(offset + 6, offset + 4 + itemLength),
    });
    offset += 4 + itemLength;
  }
  return values;
};

const tagToString = (tag: number): string => `(${hex(tag >>> 16, 4)},${hex(tag & 0xffff, 4)})`;

/** Decodes an Implicit VR Little Endian command set into tag → raw value. */
export const parseCommandSet = (data: Buffer): Map<number, Buffer> => {
  const elements = new Map<number, Buffer>();
  let offset = 0;
  while (offset < data.length) {
    if (offset + 8 > data.length) {
      throw protocolError('command set element header is truncated');
    }
    const tag = data.readUInt16LE(offset) * 0x10000 + data.readUInt16LE(offset + 2);
    const length = data.readUInt32LE(offset + 4);
    if (length === 0xffffffff || offset + 8 + length > data.length) {
      throw protocolError(
        `command set element ${tagToString(tag)} has length ${length}, which does not fit the message`
      );
    }
    elements.set(tag, data.subarray(offset + 8, offset + 8 + length));
    offset += 8 + length;
  }
  return elements;
};

const readUint16Element = (command: Map<number, Buffer>, tag: number): number | undefined => {
  const value = command.get(tag);
  return value !== undefined && value.length >= 2 ? value.readUInt16LE(0) : undefined;
};

const describeCode = (table: Record<number, string>, code: number): string => `${table[code] ?? 'unknown'} (${code})`;

const describeAssociateReject = (payload: Buffer): string => {
  if (payload.length < 4) {
    return 'A-ASSOCIATE-RJ with a truncated body';
  }
  const source = payload.readUInt8(2);
  return (
    `A-ASSOCIATE-RJ: ${describeCode(REJECT_RESULT, payload.readUInt8(1))}, ` +
    `source ${describeCode(REJECT_SOURCE, source)}, reason ${describeCode(
      REJECT_REASON[source] ?? {},
      payload.readUInt8(3)
    )}`
  );
};

const describeAbort = (payload: Buffer): string => {
  if (payload.length < 4) {
    return 'A-ABORT with a truncated body';
  }
  return `A-ABORT from ${describeCode(ABORT_SOURCE, payload.readUInt8(2))}: ${describeCode(
    ABORT_REASON,
    payload.readUInt8(3)
  )}`;
};

// ── Transport ───────────────────────────────────────────────────────

interface Pdu {
  type: number;
  payload: Buffer;
}

interface PduReader {
  next: () => Promise<Pdu>;
}

const unexpectedPdu = (received: Pdu, expected: string): DicomEchoError => {
  if (received.type === PduType.Abort) {
    return new DicomEchoError('aborted', describeAbort(received.payload));
  }
  const name = PDU_NAMES[received.type] ?? `PDU type 0x${hex(received.type, 2)}`;
  return protocolError(`expected ${expected} but received ${name}`);
};

/** Reassembles PDUs from the TCP byte stream and hands them out one at a time. */
const createPduReader = (socket: net.Socket): PduReader => {
  let buffered: Buffer = Buffer.alloc(0);
  const ready: Pdu[] = [];
  let waiting: { resolve: (pdu: Pdu) => void; reject: (error: Error) => void } | undefined;
  let terminalError: Error | undefined;

  const fail = (error: Error): void => {
    terminalError ??= error;
    waiting?.reject(terminalError);
    waiting = undefined;
  };

  socket.on('data', (chunk: Buffer) => {
    buffered = buffered.length === 0 ? chunk : Buffer.concat([buffered, chunk]);
    while (buffered.length >= 6) {
      const length = buffered.readUInt32BE(2);
      if (length > MAX_INCOMING_PDU_LENGTH) {
        fail(protocolError(`peer announced a ${length} byte PDU, above the ${MAX_INCOMING_PDU_LENGTH} byte limit`));
        socket.destroy();
        return;
      }
      if (buffered.length < 6 + length) {
        break;
      }
      const pdu: Pdu = { type: buffered.readUInt8(0), payload: buffered.subarray(6, 6 + length) };
      buffered = buffered.subarray(6 + length);
      if (waiting) {
        waiting.resolve(pdu);
        waiting = undefined;
      } else {
        ready.push(pdu);
      }
    }
  });
  socket.on('error', (error: NodeJS.ErrnoException) => {
    fail(new DicomEchoError('connection_closed', `socket error: ${error.code ?? error.message}`));
  });
  socket.on('close', () => fail(new DicomEchoError('connection_closed', 'connection closed by peer')));

  return {
    next: () =>
      new Promise<Pdu>((resolve, reject) => {
        const pdu = ready.shift();
        if (pdu) {
          resolve(pdu);
        } else if (terminalError) {
          reject(terminalError);
        } else {
          waiting = { resolve, reject };
        }
      }),
  };
};

const connectSocket = (socket: net.Socket, host: string, port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      reject(new DicomEchoError('connect_error', `TCP connect failed: ${error.code ?? error.message}`));
    };
    socket.once('error', onError);
    socket.connect(port, host, () => {
      socket.off('error', onError);
      resolve();
    });
  });

const readCommand = async (reader: PduReader): Promise<Buffer> => {
  const fragments: Buffer[] = [];
  for (;;) {
    const pdu = await reader.next();
    if (pdu.type !== PduType.PDataTf) {
      throw unexpectedPdu(pdu, 'P-DATA-TF');
    }
    for (const value of parsePDataTf(pdu.payload)) {
      if (!value.isCommand) {
        continue;
      }
      fragments.push(value.data);
      if (value.isLastFragment) {
        return Buffer.concat(fragments);
      }
    }
  }
};

// The echo has already succeeded by the time we release, so a peer that never answers only costs a short wait.
const awaitReleaseResponse = async (reader: PduReader): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  const releaseTimeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, RELEASE_TIMEOUT_MS);
  });
  try {
    await Promise.race([reader.next(), releaseTimeout]);
  } catch {
    // Peer closed without A-RELEASE-RP; nothing left to do.
  } finally {
    clearTimeout(timer);
  }
};

const withDeadline = async <T>(work: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new DicomEchoError('timeout', `no response within ${timeoutMs}ms`));
      onTimeout();
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Sends a C-ECHO to a DICOM SCP. Resolves when the SCP answers with a success status, rejects with a
 * DicomEchoError describing the first step that went wrong otherwise.
 */
export const performDicomEcho = async (options: DicomEchoOptions): Promise<void> => {
  const { host, port, calledAeTitle, callingAeTitle, timeoutMs } = options;
  const socket = new net.Socket();
  socket.setNoDelay(true);
  const reader = createPduReader(socket);

  const exchange = async (): Promise<void> => {
    await connectSocket(socket, host, port);

    socket.write(encodeAssociateRequest(calledAeTitle, callingAeTitle));
    const associateResponse = await reader.next();
    if (associateResponse.type === PduType.AssociateReject) {
      throw new DicomEchoError('association_rejected', describeAssociateReject(associateResponse.payload));
    }
    if (associateResponse.type !== PduType.AssociateAccept) {
      throw unexpectedPdu(associateResponse, 'A-ASSOCIATE-AC');
    }
    const contextResult = parseAssociateAccept(associateResponse.payload).get(PRESENTATION_CONTEXT_ID);
    if (contextResult === undefined) {
      throw protocolError('A-ASSOCIATE-AC did not answer the Verification SOP Class presentation context');
    }
    if (contextResult !== 0) {
      throw new DicomEchoError(
        'presentation_context_rejected',
        `Verification SOP Class presentation context rejected: ${describeCode(
          PRESENTATION_CONTEXT_RESULT,
          contextResult
        )}`
      );
    }

    socket.write(encodeCommandPDataTf(PRESENTATION_CONTEXT_ID, encodeEchoRequestCommand(ECHO_MESSAGE_ID)));
    const command = parseCommandSet(await readCommand(reader));
    const commandField = readUint16Element(command, CommandTag.CommandField);
    if (commandField !== C_ECHO_RSP) {
      throw protocolError(
        `expected C-ECHO-RSP (0x${hex(C_ECHO_RSP, 4)}) but received command 0x${hex(commandField ?? 0, 4)}`
      );
    }
    const status = readUint16Element(command, CommandTag.Status);
    if (status === undefined) {
      throw protocolError('C-ECHO-RSP has no Status element');
    }
    if (status !== 0x0000) {
      throw new DicomEchoError('echo_failure_status', `C-ECHO-RSP returned status 0x${hex(status, 4)}`);
    }

    socket.write(encodeReleaseRequest());
    await awaitReleaseResponse(reader);
  };

  const work = exchange();
  // When the deadline wins the race below, this promise still settles later; keep that from surfacing as an
  // unhandled rejection.
  work.catch(() => undefined);
  try {
    await withDeadline(work, timeoutMs, () => socket.destroy());
  } finally {
    socket.destroy();
  }
};
