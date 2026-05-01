# NetVis Troubleshooting

**Last updated:** 2026-05-02

## Live Capture Is Unavailable

Check platform setup first:

- Windows: install Npcap and use the `Npcap Users` group or run as Administrator.
- Linux: install libpcap and grant `cap_net_raw,cap_net_admin` to the packaged binary.
- macOS: ensure the app or terminal has the required capture permissions.

If the app reports that live capture is unavailable, PCAP import and simulated replay should still work.

## Wrong Interface Is Recommended

Open Settings and choose either:

- `Auto-detect recommended interface`
- A specific interface under `Always use selected`

NetVis classifies VPN, TAP/TUN, virtual, loopback, and physical adapters separately. VPN adapters are visible but marked as specialized. If the recommendation still looks wrong, compare the app list with Windows PowerShell:

```powershell
Get-NetAdapter |
  Sort-Object Status, InterfaceDescription |
  Format-Table ifIndex, Name, InterfaceDescription, Status, LinkSpeed -AutoSize

$ipifs = Get-NetIPInterface -AddressFamily IPv4 | Group-Object -AsHashTable -Property InterfaceIndex
Get-NetRoute -AddressFamily IPv4 -DestinationPrefix "0.0.0.0/0" |
  ForEach-Object {
    [pscustomobject]@{
      ifIndex = $_.InterfaceIndex
      Alias = $_.InterfaceAlias
      RouteMetric = $_.RouteMetric
      InterfaceMetric = $ipifs[$_.InterfaceIndex].InterfaceMetric
      TotalMetric = $_.RouteMetric + $ipifs[$_.InterfaceIndex].InterfaceMetric
    }
  } |
  Sort-Object TotalMetric |
  Format-Table -AutoSize
```

## Capture Starts but No Packets Appear

Try:

- Generate traffic on the selected interface by opening a website or running `ping`.
- Choose a physical Ethernet or Wi-Fi adapter instead of a VPN adapter.
- Confirm Npcap/libpcap permissions.
- Open the log folder from Settings and inspect recent errors.

## PCAP Import Looks Empty

Check that:

- The file is a valid `.pcap` or `.pcapng`.
- A filter is not hiding all rows.
- The packet buffer was not cleared after import.

The bandwidth chart anchors to capture timestamps, so imported files with historical timestamps should still render if packets are present.

## Visualizations Are Missing

Phase 2 visualizations are enabled by default. If a visualization is missing:

- Rebuild the app with `npm run build`.
- Check that `VITE_PHASE` is not forced to `1`.
- Confirm packets exist in the buffer.
- Check the renderer console and main-process logs.

## Clean Build

When stale build output is suspected:

```powershell
npm run typecheck
npm run build
```

Avoid deleting build artifacts unless you specifically need a clean packaging run.

## Historical Note

This file replaces `QUICK_DIAGNOSTIC_GUIDE.md`. Durable bugfix history is in `docs/BUGFIX_REFERENCE.md`.
