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
 *  - Transport payload -> HMAC-SHA256(SESSION_KEY, payload).slice(0, 8) hex chars
 *  - Renderer-visible IP/MAC addresses -> deterministic session pseudonyms.
 *  - Exported raw bytes -> same-length HMAC-derived replacements.
 *
 * Requirements: Req 4.1, Req 4.2, Req 4.3, Req 4.4, Req 4.5, ARCH-04
 */

import { createHmac, randomBytes } from 'crypto'
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
 * Compute HMAC-SHA256(SESSION_KEY, namespace || data) and return 8 hex chars.
 * This is the canonical pseudonym for any byte sequence (Req 4.1).
 */
function pseudonym(data: Buffer | Uint8Array, namespace = 'payload'): string {
  return createHmac('sha256', SESSION_KEY)
    .update(namespace)
    .update(Buffer.from([0]))
    .update(data)
    .digest('hex')
    .slice(0, 8)
}

/**
 * Pseudonymize a string value that represents an IP address (Req 4.4).
 * The input string is encoded as UTF-8 bytes before hashing so the result
 * is deterministic across calls within the same session.
 */
function pseudonymString(value: string, namespace: 'ip' | 'mac'): string {
  return `${namespace}-${pseudonym(Buffer.from(value, 'utf8'), namespace)}`
}

function pseudonymBytes(data: Buffer | Uint8Array, length: number, namespace: string): Buffer {
  const chunks: Buffer[] = []
  let counter = 0

  while (Buffer.concat(chunks).length < length) {
    chunks.push(
      createHmac('sha256', SESSION_KEY)
        .update(namespace)
        .update(Buffer.from([0]))
        .update(data)
        .update(Buffer.from([counter++]))
        .digest()
    )
  }

  return Buffer.concat(chunks).subarray(0, length)
}

function isIpValue(value: string): boolean {
  return (
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) ||
    (/^[0-9a-f:]+$/i.test(value) && value.includes(':'))
  )
}

function isMacValue(value: string): boolean {
  return /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(value)
}

/**
 * Identify renderer-visible address fields that must not cross IPC raw.
 * - Preserve query name (queryName field) and record type (queryType field) — Req 4.4.
 * - DNS query names and record types remain readable for teaching.
 * - IP and MAC address fields become deterministic session pseudonyms.
 */
function fieldSensitivity(layer: ParsedLayer, field: ParsedField): 'ip' | 'mac' | null {
  const name = field.name.toLowerCase()
  const label = field.label.toLowerCase()
  const value = typeof field.value === 'string' ? field.value : ''

  if (layer.protocol === 'IPv4' || layer.protocol === 'IPv6') {
    if (name === 'src' || name === 'dst' || label.includes('ip')) return 'ip'
  }

  if (layer.protocol === 'ARP') {
    if (name.includes('ip') || label.includes('protocol address')) return 'ip'
    if (name.includes('mac') || label.includes('hardware address')) return 'mac'
  }

  if (label.includes('mac') || name.includes('mac')) return 'mac'
  if ((label.includes('ip') || name.includes('ip') || name === 'address') && isIpValue(value)) {
    return 'ip'
  }

  // Ethernet is currently represented as OTHER by the parser; src/dst with
  // 6 bytes are MAC addresses even when the layer protocol label is generic.
  if ((name === 'src' || name === 'dst') && field.byteLength === 6 && isMacValue(value)) {
    return 'mac'
  }

  // DNS query names stay readable for teaching, but resolved address fields do not.
  if (layer.protocol === 'DNS' && ['rdata', 'address', 'ip'].includes(name) && isIpValue(value)) {
    return 'ip'
  }

  return null
}

function anonymizeField(layer: ParsedLayer, field: ParsedField): ParsedField {
  const sensitivity = fieldSensitivity(layer, field)
  if (!sensitivity || typeof field.value !== 'string') return field
  return { ...field, value: pseudonymString(field.value, sensitivity) }
}

function anonymizeLayer(layer: ParsedLayer): ParsedLayer {
  return { ...layer, fields: layer.fields.map((field) => anonymizeField(layer, field)) }
}

/**
 * Derive top-level convenience fields (srcAddress, dstAddress, protocol) from
 * the anonymized layer stack for the AnonPacket (Req 4.3 — metadata preserved).
 *
 * Address fields in the layer stack have already been anonymized before this runs.
 * The convenience fields intentionally mirror those pseudonyms for filtering and UI.
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
    if (layer.protocol === 'ARP') {
      const src = layer.fields.find((f) => f.name === 'senderIP')
      const dst = layer.fields.find((f) => f.name === 'targetIP')
      if (src && typeof src.value === 'string') srcAddress = src.value
      if (dst && typeof dst.value === 'string') dstAddress = dst.value
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
   * - Transport-layer payload bytes are replaced with HMAC-SHA256 pseudonyms (Req 4.1).
   * - Renderer-visible IP/MAC addresses are replaced with deterministic session pseudonyms.
   * - DNS query names and record types are preserved for teaching (Req 4.4).
   * - Non-address protocol headers and metadata are preserved unchanged (Req 4.3).
   * - rawData is never included in the output (Req 4.5, ARCH-04).
   */
  anonymize(packet: ParsedPacket): AnonPacket {
    const anonLayers: ParsedLayer[] = packet.layers.map((layer) => anonymizeLayer(layer))

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
    const payloadPseudonym = pseudonym(payloadBytes, 'payload')

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
  },

  sanitizeForExport(packet: ParsedPacket): ParsedPacket {
    if (!packet.rawData) return packet

    const rawData = Buffer.from(packet.rawData)

    for (const layer of packet.layers) {
      for (const field of layer.fields) {
        const sensitivity = fieldSensitivity(layer, field)
        if (!sensitivity || field.byteLength <= 0) continue

        const start = field.byteOffset
        const end = start + field.byteLength
        if (start < 0 || end > rawData.length) continue

        const original = rawData.subarray(start, end)
        pseudonymBytes(original, field.byteLength, sensitivity).copy(rawData, start)
      }
    }

    const transportLayer = packet.layers.find(
      (l) => l.protocol === 'TCP' || l.protocol === 'UDP' || l.protocol === 'ICMP'
    )
    const payloadStart = transportLayer
      ? transportLayer.rawByteOffset + transportLayer.rawByteLength
      : packet.wireLength

    if (payloadStart >= 0 && payloadStart < rawData.length) {
      const payload = rawData.subarray(payloadStart)
      pseudonymBytes(payload, payload.length, 'payload').copy(rawData, payloadStart)
    }

    return {
      ...packet,
      rawData: new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.byteLength).slice()
    }
  }
}
