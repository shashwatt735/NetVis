/**
 * Anonymizer — replaces transport-layer payload bytes with a deterministic
 * pseudonym derived from a session-scoped key.
 *
 * Security rules (ANON-SEC-01, ARCH-04):
 *  - SESSION_KEY is generated once at module load via crypto.randomBytes(32).
 *  - The key is never exported, logged, serialized, or written to disk.
 *  - Only anonymized data (AnonPacket) crosses the IPC_Bridge to the renderer.
 *
 * Anonymization algorithm:
 *  - Transport payload → sha256(SESSION_KEY || payload).slice(0, 8) hex chars
 *  - DNS answer IPs → same pseudonym; query name and record type are preserved.
 *
 * Requirements: Req 4.1, Req 4.2, Req 4.3, Req 4.4, Req 4.5, ARCH-04
 */

import { createHash, randomBytes } from 'crypto'
import type {
  ParsedPacket,
  ParsedLayer,
  ParsedField,
  AnonPacket,
  ProtocolName
} from '../../shared/capture-types'

// ─── Session key — generated once, never exported ────────────────────────────

// ANON-SEC-01: key is a module-level constant; never written to disk, log, IPC, or PCAP.
const SESSION_KEY: Buffer = randomBytes(32)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute sha256(SESSION_KEY || data) and return the first 8 hex characters.
 * This is the canonical pseudonym for any byte sequence (Req 4.1).
 */
function pseudonym(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(SESSION_KEY).update(data).digest('hex').slice(0, 8)
}

/**
 * Pseudonymize a string value that represents an IP address (Req 4.4).
 * The input string is encoded as UTF-8 bytes before hashing so the result
 * is deterministic across calls within the same session.
 */
function pseudonymString(value: string): string {
  return pseudonym(Buffer.from(value, 'utf8'))
}

/**
 * Return true if the field name looks like an IP address field that should
 * be anonymized in DNS answer records.
 */
function isDnsAnswerIpField(fieldName: string): boolean {
  // DNS answer IP fields are named 'rdata' or 'address' in answer records.
  // We also cover generic 'ip', 'address', 'rdata' names.
  return fieldName === 'rdata' || fieldName === 'address' || fieldName === 'ip'
}

/**
 * Anonymize a DNS layer.
 * - Preserve query name (queryName field) and record type (queryType field) — Req 4.4.
 * - Anonymize any answer IP address fields.
 * - All other fields are preserved unchanged (Req 4.3).
 */
function anonymizeDnsLayer(layer: ParsedLayer): ParsedLayer {
  const anonFields: ParsedField[] = layer.fields.map((f) => {
    // Preserve query name and record type (Req 4.4)
    if (f.name === 'queryName' || f.name === 'queryType') {
      return f
    }
    // Anonymize answer IP address fields
    if (isDnsAnswerIpField(f.name) && typeof f.value === 'string') {
      return { ...f, value: pseudonymString(f.value) }
    }
    return f
  })

  return { ...layer, fields: anonFields }
}

/**
 * Derive top-level convenience fields (srcAddress, dstAddress, protocol) from
 * the anonymized layer stack for the AnonPacket (Req 4.3 — metadata preserved).
 *
 * IP addresses in src/dst fields at the network layer are NOT anonymized here
 * because they are protocol headers (metadata), not payload content.
 * Only transport-layer payload bytes and DNS answer IPs are anonymized.
 */
function extractConvenienceFields(layers: ParsedLayer[]): {
  srcAddress: string
  dstAddress: string
  protocol: ProtocolName
} {
  let srcAddress = ''
  let dstAddress = ''
  let protocol: ProtocolName = 'OTHER'

  for (const layer of layers) {
    if (layer.protocol === 'IPv4' || layer.protocol === 'IPv6') {
      const src = layer.fields.find((f) => f.name === 'src')
      const dst = layer.fields.find((f) => f.name === 'dst')
      if (src && typeof src.value === 'string') srcAddress = src.value
      if (dst && typeof dst.value === 'string') dstAddress = dst.value
    }
    if (
      layer.protocol === 'TCP' ||
      layer.protocol === 'UDP' ||
      layer.protocol === 'ICMP' ||
      layer.protocol === 'DNS' ||
      layer.protocol === 'ARP'
    ) {
      protocol = layer.protocol
    }
  }

  // Fall back to Ethernet src/dst if no IP layer found
  if (!srcAddress || !dstAddress) {
    const eth = layers.find((l) => l.fields.some((f) => f.name === 'src' && f.byteLength === 6))
    if (eth) {
      const src = eth.fields.find((f) => f.name === 'src')
      const dst = eth.fields.find((f) => f.name === 'dst')
      if (src && typeof src.value === 'string' && !srcAddress) srcAddress = src.value
      if (dst && typeof dst.value === 'string' && !dstAddress) dstAddress = dst.value
    }
  }

  return { srcAddress, dstAddress, protocol }
}

// ─── Anonymizer ───────────────────────────────────────────────────────────────

export const Anonymizer = {
  /**
   * Anonymize a ParsedPacket, producing an AnonPacket safe to cross the IPC_Bridge.
   *
   * - Transport-layer payload bytes are replaced with sha256(key||payload)[0..7] hex (Req 4.1).
   * - DNS answer IPs are anonymized; query name and record type are preserved (Req 4.4).
   * - All protocol headers and metadata are preserved unchanged (Req 4.3).
   * - rawData is never included in the output (Req 4.5, ARCH-04).
   */
  anonymize(packet: ParsedPacket): AnonPacket {
    const anonLayers: ParsedLayer[] = packet.layers.map((layer) => {
      if (layer.protocol === 'DNS') {
        return anonymizeDnsLayer(layer)
      }
      // All other layers pass through unchanged — headers are metadata, not payload (Req 4.3).
      return layer
    })

    // Replace transport-layer payload with pseudonym token.
    // Find the transport layer to determine where payload starts.
    const transportLayer = packet.layers.find(
      (l) => l.protocol === 'TCP' || l.protocol === 'UDP' || l.protocol === 'ICMP'
    )

    // Calculate payload start offset (after all headers)
    const payloadStart = transportLayer
      ? transportLayer.rawByteOffset + transportLayer.rawByteLength
      : packet.wireLength

    // Extract only the payload bytes (not the entire frame)
    const payloadBytes = packet.rawData
      ? Buffer.from(packet.rawData).subarray(payloadStart)
      : Buffer.alloc(0)

    // Compute pseudonym from payload bytes only (Req 4.1)
    const payloadPseudonym = pseudonym(payloadBytes)

    // Attach the payload pseudonym as a synthetic field on the innermost transport layer.
    const finalLayers = anonLayers.map((layer) => {
      if (layer.protocol === 'TCP' || layer.protocol === 'UDP' || layer.protocol === 'ICMP') {
        // Replace any existing payload field or append one
        const withoutPayload = layer.fields.filter((f) => f.name !== 'payload')
        return {
          ...layer,
          fields: [
            ...withoutPayload,
            {
              name: 'payload',
              label: 'Payload (anonymized)',
              value: payloadPseudonym,
              byteOffset: layer.rawByteOffset + layer.rawByteLength,
              byteLength: 0
            }
          ]
        }
      }
      return layer
    })

    const { srcAddress, dstAddress, protocol } = extractConvenienceFields(finalLayers)

    return {
      id: packet.id,
      timestamp: packet.timestamp,
      sourceId: packet.sourceId,
      captureMode: packet.captureMode,
      wireLength: packet.wireLength,
      layers: finalLayers,
      srcAddress,
      dstAddress,
      protocol,
      length: packet.wireLength
      // rawData intentionally omitted — never crosses IPC (Req 4.5, ARCH-04)
    }
  }
}
