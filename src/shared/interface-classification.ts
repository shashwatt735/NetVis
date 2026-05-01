import type { NetworkInterface } from './capture-types'

export type InterfaceKind = NonNullable<NetworkInterface['kind']>

const VPN_PATTERN =
  /\b(vpn|tap|tun|openvpn|wireguard|wintun|express|nord|proton|surfshark|tailscale|zerotier|hamachi)\b/
const VIRTUAL_PATTERN =
  /\b(virtual|vmware|hyper-v|hyperv|docker|vbox|virtualbox|vethernet|wsl|teredo|tunnel)\b/
const WIFI_PATTERN = /\b(wi-?fi|wlan|wireless|802\.11)\b/
const ETHERNET_PATTERN = /\b(ethernet|lan|realtek|intel|killer|gbe|pcie|family controller)\b/

export function getInterfaceSearchText(
  iface: Pick<NetworkInterface, 'name' | 'displayName'>
): string {
  return `${iface.displayName} ${iface.name}`.toLowerCase()
}

export function classifyInterfaceKind(
  iface: Pick<NetworkInterface, 'name' | 'displayName'>
): InterfaceKind {
  const label = getInterfaceSearchText(iface)

  if (label.includes('loopback') || label.includes('npf_loopback') || label === 'lo') {
    return 'loopback'
  }

  if (VPN_PATTERN.test(label)) return 'vpn'
  if (VIRTUAL_PATTERN.test(label)) return 'virtual'
  if (label.includes('bluetooth')) return 'bluetooth'
  if (WIFI_PATTERN.test(label)) return 'wifi'
  if (ETHERNET_PATTERN.test(label)) return 'ethernet'

  return 'interface'
}

export function semanticInterfaceLabel(kind: InterfaceKind): string {
  switch (kind) {
    case 'ethernet':
      return 'Ethernet'
    case 'wifi':
      return 'Wi-Fi'
    case 'vpn':
      return 'VPN'
    case 'virtual':
      return 'Virtual'
    case 'loopback':
      return 'Loopback'
    case 'bluetooth':
      return 'Bluetooth'
    default:
      return 'Interface'
  }
}

export function scoreInterface(iface: NetworkInterface): number {
  const kind = iface.kind ?? classifyInterfaceKind(iface)
  let score = 0

  if (iface.isDefaultRoute) score += 100
  if (kind === 'ethernet') score += 80
  if (kind === 'wifi') score += 75
  if (iface.isUp) score += 20
  if (iface.hasAddress) score += 30
  if (iface.isCaptureCapable !== false) score += 20

  if (kind === 'vpn') score -= 80
  if (kind === 'virtual' || kind === 'bluetooth') score -= 90
  if (kind === 'loopback') score -= 100
  if (iface.hasAddress === false) score -= 40
  if (!iface.isUp) score -= 20

  return score
}

export function withInterfaceRecommendation(interfaces: NetworkInterface[]): NetworkInterface[] {
  let bestName: string | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  const scored = interfaces.map((iface) => {
    const kind = iface.kind ?? classifyInterfaceKind(iface)
    const score = scoreInterface({ ...iface, kind })
    if (score > bestScore) {
      bestScore = score
      bestName = iface.name
    }
    return {
      ...iface,
      kind,
      semanticLabel: iface.semanticLabel ?? semanticInterfaceLabel(kind),
      recommendationScore: score
    }
  })

  return scored.map((iface) => ({
    ...iface,
    isRecommended: iface.name === bestName,
    recommendationReason: recommendationReason(iface)
  }))
}

function recommendationReason(iface: NetworkInterface): string {
  if (iface.kind === 'vpn') {
    return iface.isDefaultRoute
      ? 'VPN default route; specialized capture'
      : 'VPN adapter; specialized capture'
  }
  if (iface.kind === 'loopback') return 'Local-only traffic'
  if (iface.kind === 'virtual' || iface.kind === 'bluetooth') return 'Specialized adapter'
  if (iface.isDefaultRoute) return 'Primary route'
  if (iface.kind === 'ethernet' || iface.kind === 'wifi') return 'Physical network adapter'
  return 'Available capture adapter'
}
