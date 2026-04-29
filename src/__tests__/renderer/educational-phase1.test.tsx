// @vitest-environment jsdom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CapturePage } from '../../renderer/src/components/CapturePage'
import { PacketDetailInspector } from '../../renderer/src/components/PacketDetailInspector'
import { formatFieldValue } from '../../renderer/src/lib/field-help'
import { formatRelativeTimestamp, getPacketRoleInfo } from '../../renderer/src/lib/packet-analysis'
import { makeAnonPacket, renderWithStore, resetStore, screen, useNetVisStore } from './test-utils'
import type { AnonPacket, ParsedLayer } from '../../shared/capture-types'

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function tcpLayer(flags: string): ParsedLayer {
  return {
    protocol: 'TCP',
    rawByteOffset: 34,
    rawByteLength: 20,
    fields: [
      { name: 'srcPort', label: 'Source Port', value: 49152, byteOffset: 34, byteLength: 2 },
      { name: 'dstPort', label: 'Destination Port', value: 443, byteOffset: 36, byteLength: 2 },
      { name: 'flags', label: 'Flags', value: flags, byteOffset: 47, byteLength: 1 }
    ]
  }
}

function ipv4Layer(protocol = 6): ParsedLayer {
  return {
    protocol: 'IPv4',
    rawByteOffset: 14,
    rawByteLength: 20,
    fields: [
      { name: 'version', label: 'Version', value: 4, byteOffset: 14, byteLength: 1 },
      { name: 'ihl', label: 'Header Length', value: 20, byteOffset: 14, byteLength: 1 },
      { name: 'totalLength', label: 'Total Length', value: 40, byteOffset: 16, byteLength: 2 },
      { name: 'ttl', label: 'TTL', value: 64, byteOffset: 22, byteLength: 1 },
      { name: 'protocol', label: 'Protocol', value: protocol, byteOffset: 23, byteLength: 1 }
    ]
  }
}

function ethernetLayer(): ParsedLayer {
  return {
    protocol: 'OTHER',
    rawByteOffset: 0,
    rawByteLength: 14,
    fields: [
      {
        name: 'dst',
        label: 'Destination MAC',
        value: 'mac-broadcast',
        byteOffset: 0,
        byteLength: 6
      },
      { name: 'src', label: 'Source MAC', value: 'mac-host-a', byteOffset: 6, byteLength: 6 },
      { name: 'etherType', label: 'EtherType', value: '0x0800', byteOffset: 12, byteLength: 2 }
    ]
  }
}

function dnsLayer(flags: string): ParsedLayer {
  return {
    protocol: 'DNS',
    rawByteOffset: 42,
    rawByteLength: 32,
    fields: [
      { name: 'id', label: 'Transaction ID', value: '0x1234', byteOffset: 42, byteLength: 2 },
      { name: 'flags', label: 'Flags', value: flags, byteOffset: 44, byteLength: 2 },
      {
        name: 'queryName',
        label: 'Query Name',
        value: 'example.com',
        byteOffset: 54,
        byteLength: 13
      }
    ]
  }
}

describe('Phase 1 educational enrichment', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('formats packet time as relative seconds with units', () => {
    expect(formatRelativeTimestamp(1_700_000_000_024, 1_700_000_000_000)).toBe('+0.024s')
    expect(formatRelativeTimestamp(1_700_000_001_382, 1_700_000_000_000)).toBe('+1.382s')
  })

  it('classifies protocol-aware packet roles for the table', () => {
    const syn = makeAnonPacket({ protocol: 'TCP', layers: [tcpLayer('SYN')] })
    const dnsQuery = makeAnonPacket({ protocol: 'DNS', layers: [dnsLayer('Query')] })
    const udp = makeAnonPacket({ protocol: 'UDP', layers: [] })
    const unknown = makeAnonPacket({ protocol: 'OTHER', layers: [] })

    expect(getPacketRoleInfo(syn).tableLabel).toBe('Conn start')
    expect(getPacketRoleInfo(dnsQuery).tableLabel).toBe('Name lookup')
    expect(getPacketRoleInfo(udp).tableLabel).toBe('UDP data')
    expect(getPacketRoleInfo(unknown).tableLabel).toBe('Unclassified')
  })

  it('translates important numeric protocol fields', () => {
    expect(
      formatFieldValue('IPv4', {
        name: 'protocol',
        label: 'Protocol',
        value: 6,
        byteOffset: 0,
        byteLength: 1
      })
    ).toBe('6 - TCP')
    expect(
      formatFieldValue('Ethernet', {
        name: 'etherType',
        label: 'EtherType',
        value: '0x0800',
        byteOffset: 0,
        byteLength: 2
      })
    ).toBe('0x0800 - IPv4')
  })

  it('shows selected-packet explanation, field help, and meaningful byte ranges', () => {
    const packet = makeAnonPacket({
      protocol: 'TCP',
      wireLength: 74,
      layers: [ethernetLayer(), ipv4Layer(), tcpLayer('SYN')]
    })

    useNetVisStore.setState({
      packets: [packet],
      filteredPackets: [packet],
      selectedPacketId: packet.id
    })

    renderWithStore(<PacketDetailInspector />)

    expect(screen.getByText('TCP SYN')).toBeInTheDocument()
    expect(screen.getByText(/Why it matters:/)).toBeInTheDocument()
    expect(screen.getByLabelText('Protocol: 6 - TCP')).toBeInTheDocument()
    expect(screen.getByText(/Identifies the transport-layer protocol/)).toBeInTheDocument()
    expect(screen.getByText('Bytes 14-33')).toBeInTheDocument()
    expect(screen.queryByText('--')).not.toBeInTheDocument()
  })

  it('shows a natural-language active filter chip and filtered count', () => {
    const tcp = makeAnonPacket({ protocol: 'TCP', layers: [tcpLayer('SYN')] })
    const dns = makeAnonPacket({ protocol: 'DNS', layers: [dnsLayer('Query')] })
    const packets: AnonPacket[] = [tcp, dns]

    useNetVisStore.setState({
      packets,
      filteredPackets: [dns],
      filterExpression: 'proto == DNS'
    })

    renderWithStore(<CapturePage />)

    expect(
      screen.getByRole('status', { name: 'Active filter: Protocol = DNS' })
    ).toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 2 packets')).toBeInTheDocument()
  })
})
