import { afterEach, describe, expect, it } from 'vitest';
import {
  C_ECHO_RQ,
  CommandTag,
  DicomEchoError,
  encodeAssociateRequest,
  encodeCommandPDataTf,
  encodeEchoRequestCommand,
  encodeReleaseRequest,
  parseAssociateAccept,
  parseCommandSet,
  parsePDataTf,
  performDicomEcho,
  PRESENTATION_CONTEXT_ID,
} from '../src/dicomEcho';
import {
  abort,
  APPLICATION_CONTEXT_NAME,
  associateAccept,
  associateReject,
  dribble,
  echoResponse,
  echoResponseCommand,
  FakeScp,
  getUnusedPort,
  IMPLICIT_VR_LITTLE_ENDIAN_UID,
  pdataTf,
  releaseResponse,
  SCP_AE_TITLE,
  startFakeScp,
  VERIFICATION_SOP_CLASS_UID,
  wellBehavedScp,
} from './helpers/fakeDicomScp';

const echoOptions = (port: number, timeoutMs = 2000): Parameters<typeof performDicomEcho>[0] => ({
  host: '127.0.0.1',
  port,
  calledAeTitle: SCP_AE_TITLE,
  callingAeTitle: 'PACS_POLL',
  timeoutMs,
});

const expectFailure = async (promise: Promise<unknown>, reason: DicomEchoError['reason']): Promise<DicomEchoError> => {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DicomEchoError);
  expect((caught as DicomEchoError).reason).toBe(reason);
  return caught as DicomEchoError;
};

const hexOf = (buffer: Buffer): string => buffer.toString('hex');

describe('DICOM UL encoding', () => {
  it('encodes an A-ASSOCIATE-RQ with the Verification SOP Class and padded AE titles', () => {
    const request = encodeAssociateRequest('REMOTE_PACS', 'PACS_POLL');

    expect(request.readUInt8(0)).toBe(0x01);
    expect(request.readUInt8(1)).toBe(0x00);
    expect(request.readUInt32BE(2)).toBe(request.length - 6);
    expect(request.readUInt16BE(6)).toBe(1); // protocol version
    expect(request.subarray(10, 26).toString('ascii')).toBe('REMOTE_PACS     ');
    expect(request.subarray(26, 42).toString('ascii')).toBe('PACS_POLL       ');
    expect(hexOf(request.subarray(42, 74))).toBe('00'.repeat(32));

    // Variable items: application context, one presentation context, user information.
    const items: { type: number; body: Buffer }[] = [];
    let offset = 74;
    while (offset < request.length) {
      const length = request.readUInt16BE(offset + 2);
      items.push({ type: request.readUInt8(offset), body: request.subarray(offset + 4, offset + 4 + length) });
      offset += 4 + length;
    }
    expect(offset).toBe(request.length);
    expect(items.map((item) => item.type)).toEqual([0x10, 0x20, 0x50]);
    expect(items[0].body.toString('ascii')).toBe(APPLICATION_CONTEXT_NAME);

    const presentationContext = items[1].body;
    expect(presentationContext.readUInt8(0)).toBe(PRESENTATION_CONTEXT_ID);
    expect(hexOf(presentationContext.subarray(1, 4))).toBe('000000');
    const abstractSyntax = presentationContext.subarray(4);
    expect(abstractSyntax.readUInt8(0)).toBe(0x30);
    expect(abstractSyntax.readUInt16BE(2)).toBe(VERIFICATION_SOP_CLASS_UID.length);
    expect(abstractSyntax.subarray(4, 4 + VERIFICATION_SOP_CLASS_UID.length).toString('ascii')).toBe(
      VERIFICATION_SOP_CLASS_UID
    );
    const transferSyntax = abstractSyntax.subarray(4 + VERIFICATION_SOP_CLASS_UID.length);
    expect(transferSyntax.readUInt8(0)).toBe(0x40);
    expect(transferSyntax.subarray(4).toString('ascii')).toBe(IMPLICIT_VR_LITTLE_ENDIAN_UID);

    const userInformation = items[2].body;
    expect(userInformation.readUInt8(0)).toBe(0x51); // maximum length sub-item first
    expect(userInformation.readUInt16BE(2)).toBe(4);
    expect(userInformation.readUInt32BE(4)).toBeGreaterThan(0);
    expect(userInformation.readUInt8(8)).toBe(0x52); // implementation class UID
    const implementationUidLength = userInformation.readUInt16BE(10);
    expect(userInformation.subarray(12, 12 + implementationUidLength).toString('ascii')).toMatch(/^2\.25\.\d+$/);
    expect(userInformation.readUInt8(12 + implementationUidLength)).toBe(0x55); // implementation version name
    expect(userInformation.readUInt16BE(14 + implementationUidLength)).toBeLessThanOrEqual(16);
  });

  it('encodes the C-ECHO-RQ command set byte for byte', () => {
    const expected = [
      '0000 0000 04000000 38000000', // (0000,0000) UL group length = 56
      '0000 0200 12000000 312e322e3834302e31303030382e312e3100', // (0000,0002) UI "1.2.840.10008.1.1" + null pad
      '0000 0001 02000000 3000', // (0000,0100) US command field = C-ECHO-RQ
      '0000 1001 02000000 0100', // (0000,0110) US message id = 1
      '0000 0008 02000000 0101', // (0000,0800) US data set type = none
    ]
      .join('')
      .replace(/ /g, '');
    expect(hexOf(encodeEchoRequestCommand(1))).toBe(expected);
  });

  it('wraps a command in a single last-fragment PDV inside a P-DATA-TF', () => {
    const command = encodeEchoRequestCommand(7);
    const pdu = encodeCommandPDataTf(1, command);
    expect(pdu.readUInt8(0)).toBe(0x04);
    expect(pdu.readUInt32BE(2)).toBe(command.length + 6);
    expect(pdu.readUInt32BE(6)).toBe(command.length + 2);
    expect(pdu.readUInt8(10)).toBe(1);
    expect(pdu.readUInt8(11)).toBe(0x03);
    expect(pdu.subarray(12).equals(command)).toBe(true);
  });

  it('encodes an A-RELEASE-RQ', () => {
    expect(hexOf(encodeReleaseRequest())).toBe('05000000000400000000');
  });
});

describe('DICOM UL decoding', () => {
  it('reads presentation context results out of an A-ASSOCIATE-AC', () => {
    expect(parseAssociateAccept(associateAccept(0).subarray(6)).get(1)).toBe(0);
    expect(parseAssociateAccept(associateAccept(3).subarray(6)).get(1)).toBe(3);
    expect(parseAssociateAccept(associateAccept(0, 5).subarray(6)).get(1)).toBeUndefined();
  });

  it('rejects a truncated A-ASSOCIATE-AC', () => {
    expect(() => parseAssociateAccept(Buffer.alloc(10))).toThrow(DicomEchoError);
  });

  it('splits a P-DATA-TF into presentation data values', () => {
    const command = echoResponseCommand(0);
    const [value] = parsePDataTf(pdataTf(command, 0x03).subarray(6));
    expect(value.presentationContextId).toBe(1);
    expect(value.isCommand).toBe(true);
    expect(value.isLastFragment).toBe(true);
    expect(value.data.equals(command)).toBe(true);
  });

  it('rejects a P-DATA-TF whose item length overruns the PDU', () => {
    const payload = Buffer.from([0, 0, 0, 50, 1, 3, 0, 0]);
    expect(() => parsePDataTf(payload)).toThrow(/does not fit/);
  });

  it('decodes a command set and rejects a truncated one', () => {
    const command = parseCommandSet(echoResponseCommand(0x0211, 9));
    expect(command.get(CommandTag.CommandField)?.readUInt16LE(0)).toBe(0x8030);
    expect(command.get(CommandTag.MessageIdBeingRespondedTo)?.readUInt16LE(0)).toBe(9);
    expect(command.get(CommandTag.Status)?.readUInt16LE(0)).toBe(0x0211);
    expect(() => parseCommandSet(echoResponseCommand(0).subarray(0, 20))).toThrow(/does not fit/);
  });
});

describe('performDicomEcho', () => {
  let scp: FakeScp | undefined;

  afterEach(async () => {
    await scp?.close();
    scp = undefined;
  });

  it('completes a full associate / echo / release exchange', async () => {
    scp = await startFakeScp(wellBehavedScp);

    await expect(performDicomEcho(echoOptions(scp.port))).resolves.toBeUndefined();

    expect(scp.received.map((received) => received.type)).toEqual([0x01, 0x04, 0x05]);
    const associateRequest = scp.received[0].payload;
    expect(associateRequest.subarray(4, 20).toString('ascii')).toBe(SCP_AE_TITLE.padEnd(16));
    expect(associateRequest.subarray(20, 36).toString('ascii')).toBe('PACS_POLL'.padEnd(16));
    const [echoRequest] = parsePDataTf(scp.received[1].payload);
    const command = parseCommandSet(echoRequest.data);
    expect(command.get(CommandTag.CommandField)?.readUInt16LE(0)).toBe(C_ECHO_RQ);
    expect(command.get(CommandTag.AffectedSopClassUid)?.toString('ascii')).toBe(`${VERIFICATION_SOP_CLASS_UID}\0`);
  });

  it('reassembles PDUs that arrive one byte at a time', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) dribble(socket, associateAccept());
      if (type === 0x04) dribble(socket, echoResponse(0x0000));
      if (type === 0x05) dribble(socket, releaseResponse());
    });

    await expect(performDicomEcho(echoOptions(scp.port))).resolves.toBeUndefined();
  });

  it('reassembles a command fragmented across two P-DATA-TF PDUs', async () => {
    const command = echoResponseCommand(0x0000);
    const split = 30;
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(associateAccept());
      if (type === 0x04) {
        socket.write(pdataTf(command.subarray(0, split), 0x01));
        socket.write(pdataTf(command.subarray(split), 0x03));
      }
      if (type === 0x05) socket.write(releaseResponse());
    });

    await expect(performDicomEcho(echoOptions(scp.port))).resolves.toBeUndefined();
  });

  it('still succeeds when the peer never answers the release', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(associateAccept());
      if (type === 0x04) socket.write(echoResponse(0x0000));
    });

    await expect(performDicomEcho(echoOptions(scp.port, 5000))).resolves.toBeUndefined();
  }, 10000);

  it('reports a rejected association with the decoded reason', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(associateReject(1, 1, 7));
    });

    const error = await expectFailure(performDicomEcho(echoOptions(scp.port)), 'association_rejected');
    expect(error.message).toContain('rejected-permanent');
    expect(error.message).toContain('called-AE-title-not-recognized');
  });

  it('reports a rejected presentation context', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(associateAccept(3));
    });

    const error = await expectFailure(performDicomEcho(echoOptions(scp.port)), 'presentation_context_rejected');
    expect(error.message).toContain('abstract-syntax-not-supported');
  });

  it('reports a non-success C-ECHO status', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(associateAccept());
      if (type === 0x04) socket.write(echoResponse(0x0211));
    });

    const error = await expectFailure(performDicomEcho(echoOptions(scp.port)), 'echo_failure_status');
    expect(error.message).toContain('0x0211');
  });

  it('reports an A-ABORT from the peer', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(abort(2, 2));
    });

    const error = await expectFailure(performDicomEcho(echoOptions(scp.port)), 'aborted');
    expect(error.message).toContain('unexpected-PDU');
  });

  it('reports a peer that closes the connection mid-exchange', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.end();
    });

    await expectFailure(performDicomEcho(echoOptions(scp.port)), 'connection_closed');
  });

  it('reports a peer that accepts the connection but never speaks DICOM', async () => {
    scp = await startFakeScp(() => undefined);

    const started = Date.now();
    await expectFailure(performDicomEcho(echoOptions(scp.port, 300)), 'timeout');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('reports a refused connection', async () => {
    const error = await expectFailure(performDicomEcho(echoOptions(await getUnusedPort())), 'connect_error');
    expect(error.message).toContain('ECONNREFUSED');
  });

  it('treats a non-DICOM reply as a protocol error', async () => {
    scp = await startFakeScp(({ type }, socket) => {
      if (type === 0x01) socket.write(Buffer.from('HTTP/1.1 400 Bad Request\r\n\r\n'));
    });

    // "HTTP/1.1 ..." parses as PDU type 0x48 with an absurd length, which trips the size guard.
    await expectFailure(performDicomEcho(echoOptions(scp.port, 1000)), 'protocol_error');
  });
});
