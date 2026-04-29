import type { ParsedField, ParsedLayer } from '../../../shared/capture-types'
import fieldExplanations from '../data/field-explanations.json'

interface FieldExplanationEntry {
  protocol: string
  field: string
  label: string
  explanation: string
  byteOffset: number
  byteLength: number
  symbolicValues: Record<string, string>
}

export interface FieldHelp {
  label: string
  explanation: string
  valueMeaning?: string
}

const FIELD_EXPLANATION_MAP = new Map(
  (fieldExplanations as FieldExplanationEntry[]).map((entry) => [
    `${entry.protocol.toLowerCase()}::${entry.field.toLowerCase()}`,
    entry
  ])
)

const FIELD_ALIASES: Record<string, Record<string, string>> = {
  ethernet: {
    dst: 'dst_mac',
    src: 'src_mac',
    ethertype: 'ethertype'
  },
  ipv4: {
    version: 'version',
    ihl: 'ihl',
    dscp: 'dscp',
    totallength: 'total_length',
    protocol: 'protocol',
    ttl: 'ttl',
    src: 'src_ip',
    dst: 'dst_ip'
  },
  tcp: {
    srcport: 'src_port',
    dstport: 'dst_port',
    seqnum: 'seq',
    acknum: 'ack',
    flags: 'flags',
    windowsize: 'window_size'
  },
  udp: {
    srcport: 'src_port',
    dstport: 'dst_port',
    length: 'length',
    checksum: 'checksum'
  },
  icmp: {
    type: 'type',
    code: 'code',
    checksum: 'checksum'
  },
  dns: {
    id: 'id',
    flags: 'flags',
    qdcount: 'qdcount',
    ancount: 'ancount',
    queryname: 'query_name',
    querytype: 'record_type'
  }
}

const ETHER_TYPE_MEANINGS: Record<string, string> = {
  '0x0800': 'IPv4',
  '0x0806': 'ARP',
  '0x86DD': 'IPv6'
}

const IP_PROTOCOL_MEANINGS: Record<string, string> = {
  '1': 'ICMP',
  '6': 'TCP',
  '17': 'UDP',
  '58': 'ICMPv6'
}

const ICMP_TYPE_MEANINGS: Record<string, string> = {
  '0': 'Echo reply',
  '3': 'Destination unreachable',
  '8': 'Echo request',
  '11': 'Time exceeded'
}

export function displayLayerProtocol(layer: ParsedLayer): string {
  if (
    layer.protocol === 'OTHER' &&
    layer.fields.some((field) => normalizeName(field.name) === 'ethertype')
  ) {
    return 'Ethernet'
  }
  return layer.protocol
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function explanationKey(layerProtocol: string, field: ParsedField): string | null {
  const protocolKey = layerProtocol.toLowerCase()
  const normalized = normalizeName(field.name)
  const alias = FIELD_ALIASES[protocolKey]?.[normalized]
  if (alias) return `${protocolKey}::${alias}`

  const labelAlias = FIELD_ALIASES[protocolKey]?.[normalizeName(field.label)]
  if (labelAlias) return `${protocolKey}::${labelAlias}`

  return null
}

function symbolicMeaning(layerProtocol: string, field: ParsedField): string | undefined {
  const value = String(field.value)
  const normalizedValue = value.startsWith('0x') ? `0x${value.slice(2).toUpperCase()}` : value
  const fieldName = normalizeName(field.name)
  const fieldLabel = normalizeName(field.label)

  if (layerProtocol === 'Ethernet' && (fieldName === 'ethertype' || fieldLabel === 'ethertype')) {
    return ETHER_TYPE_MEANINGS[normalizedValue]
  }

  if (layerProtocol === 'IPv4' && (fieldName === 'protocol' || fieldLabel === 'protocol')) {
    return IP_PROTOCOL_MEANINGS[normalizedValue]
  }

  if (layerProtocol === 'ICMP' && (fieldName === 'type' || fieldLabel === 'type')) {
    return ICMP_TYPE_MEANINGS[normalizedValue]
  }

  return undefined
}

export function getFieldHelp(layerProtocol: string, field: ParsedField): FieldHelp | null {
  const key = explanationKey(layerProtocol, field)
  const entry = key ? FIELD_EXPLANATION_MAP.get(key) : undefined
  const valueMeaning = symbolicMeaning(layerProtocol, field)

  if (!entry && !valueMeaning) return null

  return {
    label: entry?.label ?? field.label,
    explanation: entry?.explanation ?? `${field.label} value ${field.value} means ${valueMeaning}.`,
    valueMeaning
  }
}

export function formatFieldValue(layerProtocol: string, field: ParsedField): string {
  const value = typeof field.value === 'number' ? String(field.value) : field.value
  const meaning = symbolicMeaning(layerProtocol, field)
  if (!meaning) return value
  if (value.toLowerCase().includes(meaning.toLowerCase())) return value
  return `${value} - ${meaning}`
}
