export type LearnTopicGroupId = 'basics' | 'protocols' | 'reading'

export interface LearnTopicGroup {
  id: LearnTopicGroupId
  title: string
  topicIds: string[]
}

export interface LearnExampleField {
  name: string
  value: string
  note: string
}

export interface LearnKeyField {
  field: string
  meaning: string
  lookFor: string
}

export interface LearnBridge {
  label: string
  filterExpression: string
  challengeId: string | null
  hint: string
}

export interface LearnAnimationSlot {
  id: 'osi-encapsulation' | 'tcp-handshake' | 'dns-flow' | 'icmp-ping'
  title: string
  modeLabel: string
  fallbackLabel: string
  steps: string[]
}

export interface LearnTopic {
  id: string
  title: string
  groupId: LearnTopicGroupId
  answer: string
  paragraphs: string[]
  exampleTitle: string
  exampleSummary: string
  exampleFields: LearnExampleField[]
  keyFields: LearnKeyField[]
  bridge: LearnBridge
  animation?: LearnAnimationSlot
  searchTerms: string[]
}

export const DEFAULT_LEARN_TOPIC_ID = 'packet'

export const LEARN_TOPIC_GROUPS: LearnTopicGroup[] = [
  {
    id: 'basics',
    title: 'networking basics',
    topicIds: ['packet', 'osi-model', 'how-data-travels']
  },
  {
    id: 'protocols',
    title: 'protocols',
    topicIds: ['ethernet', 'ipv4', 'ipv6', 'tcp', 'udp', 'dns', 'icmp', 'arp']
  },
  {
    id: 'reading',
    title: 'reading captures',
    topicIds: [
      'packet-lists',
      'protocol-headers',
      'filtering-traffic',
      'filter-reference',
      'choosing-interface',
      'spotting-patterns'
    ]
  }
]

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: 'packet',
    title: 'what is a packet?',
    groupId: 'basics',
    answer: 'A packet is one small piece of network traffic.',
    paragraphs: [
      'When your computer sends data, it does not send one giant blob. It breaks the data into small packets so each piece can travel across the network.',
      'Each packet carries a little data plus headers. Headers say where the packet came from, where it is going, and which protocol should read it next.',
      'NetVis shows packets in order, then lets you open one packet and see the layers inside it.'
    ],
    exampleTitle: 'sample packet',
    exampleSummary: 'A browser sends a TCP packet to a web server on port 443.',
    exampleFields: [
      { name: 'time', value: '1.248s', note: 'when this packet appeared' },
      { name: 'proto', value: 'TCP', note: 'the transport protocol' },
      { name: 'source', value: '192.168.1.x', note: 'your device' },
      { name: 'destination', value: '142.250.x.x', note: 'the server' }
    ],
    keyFields: [
      {
        field: 'source',
        meaning: 'where the packet came from',
        lookFor: 'local addresses usually start with 10.x or 192.168.x'
      },
      {
        field: 'destination',
        meaning: 'where the packet is going',
        lookFor: 'remote servers or another local device'
      },
      {
        field: 'protocol',
        meaning: 'the rule set used to read the packet',
        lookFor: 'TCP, DNS, ICMP, UDP, or ARP'
      },
      {
        field: 'length',
        meaning: 'how many bytes the packet used on the wire',
        lookFor: 'larger packets often carry more data'
      }
    ],
    bridge: {
      label: 'see packets live',
      filterExpression: '',
      challengeId: null,
      hint: 'Open Capture and select any packet to see its layers.'
    },
    animation: {
      id: 'osi-encapsulation',
      title: 'packet anatomy preview',
      modeLabel: 'use example packet',
      fallbackLabel: 'use my selected packet',
      steps: ['application data', 'transport header', 'internet header', 'ethernet frame']
    },
    searchTerms: ['packet', 'bytes', 'length', 'source', 'destination']
  },
  {
    id: 'osi-model',
    title: 'the osi model',
    groupId: 'basics',
    answer: 'The OSI model is a map of packet responsibilities.',
    paragraphs: [
      'The OSI model splits networking into layers. Each layer has one job, like local delivery, addressing, connection setup, or application meaning.',
      'A packet often carries several layers at once. Ethernet handles the local network. IP handles addressing between networks. TCP or UDP handles transport. DNS or another application protocol explains the payload.',
      'The inspector follows this same layered structure so the fields read like a packet being unwrapped.'
    ],
    exampleTitle: 'layered packet',
    exampleSummary: 'A DNS query travels inside UDP, IP, and Ethernet headers.',
    exampleFields: [
      { name: 'ethernet', value: 'local delivery', note: 'moves the frame on your network' },
      { name: 'ipv4', value: '192.168.1.x -> 8.8.x.x', note: 'addresses the packet' },
      { name: 'udp', value: '54320 -> 53', note: 'carries the message without a connection' },
      { name: 'dns', value: 'query example.com', note: 'the application question' }
    ],
    keyFields: [
      { field: 'L2 data link', meaning: 'local network delivery', lookFor: 'Ethernet and ARP' },
      { field: 'L3 network', meaning: 'routing between networks', lookFor: 'IPv4, IPv6, and ICMP' },
      { field: 'L4 transport', meaning: 'ports and delivery behavior', lookFor: 'TCP or UDP' },
      {
        field: 'L7 application',
        meaning: 'the user-facing protocol',
        lookFor: 'DNS and other app protocols'
      }
    ],
    bridge: {
      label: 'inspect packet layers',
      filterExpression: '',
      challengeId: null,
      hint: 'Open Capture and choose any packet with multiple layers.'
    },
    animation: {
      id: 'osi-encapsulation',
      title: 'osi layer breakdown',
      modeLabel: 'use example packet',
      fallbackLabel: 'use my selected packet',
      steps: ['start with data', 'wrap with TCP or UDP', 'wrap with IP', 'wrap with Ethernet']
    },
    searchTerms: ['osi', 'layer', 'encapsulation', 'ethernet', 'ip', 'tcp', 'udp']
  },
  {
    id: 'how-data-travels',
    title: 'how data travels',
    groupId: 'basics',
    answer: 'Data travels as packets between your device and other machines.',
    paragraphs: [
      'When you open a website, your computer may first ask DNS for an address. Then it opens a connection, sends requests, and receives responses.',
      'Packets may pass through your router, your internet provider, and several networks before they reach the destination. Each hop forwards the packet toward the next place.',
      'NetVis does not need to show every hop to be useful. The capture still shows the important local evidence: addresses, protocols, timing, and packet size.'
    ],
    exampleTitle: 'website visit',
    exampleSummary: 'A DNS lookup happens before TCP traffic to the web server.',
    exampleFields: [
      { name: 'dns', value: 'query example.com', note: 'finds the address' },
      { name: 'tcp', value: 'SYN -> SYN-ACK -> ACK', note: 'opens the connection' },
      { name: 'https', value: '443', note: 'web traffic uses this port' },
      { name: 'length', value: '74 bytes', note: 'small setup packet' }
    ],
    keyFields: [
      { field: 'time', meaning: 'when each step happened', lookFor: 'DNS before a new connection' },
      {
        field: 'destination',
        meaning: 'the next machine being contacted',
        lookFor: 'DNS server or web server'
      },
      {
        field: 'port',
        meaning: 'which service receives the packet',
        lookFor: '53 for DNS, 443 for HTTPS'
      },
      { field: 'flags', meaning: 'TCP connection state', lookFor: 'SYN when a connection starts' }
    ],
    bridge: {
      label: 'watch a flow',
      filterExpression: 'proto == DNS',
      challengeId: 'dns-query',
      hint: 'Start with DNS, then clear the filter to look for the connection that follows.'
    },
    searchTerms: ['flow', 'website', 'dns', 'tcp', 'https', 'router']
  },
  {
    id: 'ethernet',
    title: 'ethernet',
    groupId: 'protocols',
    answer: 'Ethernet moves frames across your local network.',
    paragraphs: [
      'Ethernet is the local delivery layer. It moves a frame from one network device to another on the same link, such as your laptop to your router.',
      'Ethernet uses MAC addresses instead of IP addresses. NetVis keeps addresses anonymized, but the inspector still shows the structure.',
      'Most packets you inspect are wrapped in Ethernet before they leave your machine.'
    ],
    exampleTitle: 'ethernet frame',
    exampleSummary: 'A local frame carries an IPv4 packet toward the router.',
    exampleFields: [
      { name: 'src mac', value: 'local-adapter', note: 'the sending network card' },
      { name: 'dst mac', value: 'gateway', note: 'usually your router' },
      { name: 'type', value: 'IPv4', note: 'what comes next inside the frame' }
    ],
    keyFields: [
      {
        field: 'src mac',
        meaning: 'the local sender hardware address',
        lookFor: 'same sender across many outgoing packets'
      },
      {
        field: 'dst mac',
        meaning: 'the next local receiver',
        lookFor: 'gateway for internet traffic'
      },
      { field: 'ether type', meaning: 'the payload protocol', lookFor: 'IPv4, IPv6, or ARP' }
    ],
    bridge: {
      label: 'inspect ethernet',
      filterExpression: '',
      challengeId: null,
      hint: 'Open any selected packet and expand the Ethernet layer.'
    },
    searchTerms: ['ethernet', 'mac', 'frame', 'gateway', 'local']
  },
  {
    id: 'ipv4',
    title: 'ip (ipv4)',
    groupId: 'protocols',
    answer: 'IPv4 addresses packets between networks.',
    paragraphs: [
      'IP decides where a packet should go beyond the local network. It carries source and destination addresses that routers can use.',
      'IPv4 also includes TTL. TTL means time to live. It limits how many hops a packet can take before it is dropped.',
      'In the inspector, IPv4 is usually the layer between Ethernet and TCP, UDP, or ICMP.'
    ],
    exampleTitle: 'ipv4 header',
    exampleSummary: 'A packet leaves your device for an external web server.',
    exampleFields: [
      { name: 'src', value: '192.168.1.x', note: 'your device' },
      { name: 'dst', value: '142.250.x.x', note: 'remote server' },
      { name: 'ttl', value: '64', note: 'hop limit' },
      { name: 'protocol', value: 'TCP (6)', note: 'next layer' }
    ],
    keyFields: [
      {
        field: 'src',
        meaning: 'the IP address that sent the packet',
        lookFor: 'your local anonymized address'
      },
      {
        field: 'dst',
        meaning: 'the IP address receiving the packet',
        lookFor: 'server, resolver, or local peer'
      },
      {
        field: 'ttl',
        meaning: 'how many hops remain',
        lookFor: 'small TTL values can indicate distance or loops'
      },
      { field: 'protocol', meaning: 'which layer follows IPv4', lookFor: 'TCP, UDP, or ICMP' }
    ],
    bridge: {
      label: 'inspect ip headers',
      filterExpression: '',
      challengeId: null,
      hint: 'Select any TCP, UDP, DNS, or ICMP packet and expand IPv4.'
    },
    searchTerms: ['ip', 'ipv4', 'ttl', 'address', 'routing', 'hop']
  },
  {
    id: 'ipv6',
    title: 'ip (ipv6)',
    groupId: 'protocols',
    answer: 'IPv6 is the modern addressing protocol with a much larger address space.',
    paragraphs: [
      'IPv6 uses 128-bit addresses instead of the 32-bit addresses in IPv4. This allows for a vastly larger number of unique addresses, which is important as more devices connect to the internet.',
      'IPv6 addresses are written as eight groups of four hexadecimal digits separated by colons, for example 2001:0db8:85a3::8a2e:0370:7334. NetVis anonymizes these addresses just like IPv4.',
      'IPv6 removes some IPv4 concepts like broadcast and replaces them with multicast. It also has a built-in flow label field for quality-of-service routing.'
    ],
    exampleTitle: 'ipv6 header',
    exampleSummary: 'A packet leaves your device using an IPv6 address.',
    exampleFields: [
      { name: 'src', value: '2001:db8::x', note: 'your device (anonymized)' },
      { name: 'dst', value: '2606:4700::x', note: 'remote server' },
      { name: 'hop limit', value: '64', note: 'equivalent to IPv4 TTL' },
      { name: 'next header', value: 'TCP (6)', note: 'next layer protocol' }
    ],
    keyFields: [
      {
        field: 'src',
        meaning: 'the IPv6 address that sent the packet',
        lookFor: 'your local anonymized address'
      },
      {
        field: 'dst',
        meaning: 'the IPv6 address receiving the packet',
        lookFor: 'server or local peer'
      },
      {
        field: 'hop limit',
        meaning: 'how many hops remain before the packet is dropped',
        lookFor: 'same role as TTL in IPv4'
      },
      {
        field: 'next header',
        meaning: 'which protocol follows the IPv6 header',
        lookFor: 'TCP, UDP, or ICMPv6'
      }
    ],
    bridge: {
      label: 'inspect ipv6 headers',
      filterExpression: '',
      challengeId: null,
      hint: 'Select any packet with an IPv6 layer and expand it in the inspector.'
    },
    searchTerms: ['ipv6', 'ip', 'address', 'hop limit', 'next header', 'routing', '128-bit']
  },
  {
    id: 'tcp',
    title: 'tcp',
    groupId: 'protocols',
    answer: 'TCP creates reliable conversations between two endpoints.',
    paragraphs: [
      'TCP starts with a handshake. The client sends SYN, the server replies SYN-ACK, and the client answers ACK.',
      'After the connection opens, TCP tracks data with sequence numbers and confirms delivery with acknowledgements.',
      'When you filter for TCP in NetVis, look for role badges. They make connection setup and teardown easier to spot.'
    ],
    exampleTitle: 'tcp handshake packet',
    exampleSummary: 'A SYN packet starts a connection to HTTPS.',
    exampleFields: [
      { name: 'src port', value: '54320', note: 'temporary client port' },
      { name: 'dst port', value: '443', note: 'HTTPS service' },
      { name: 'flags', value: 'SYN', note: 'connection request' },
      { name: 'seq', value: '2847301921', note: 'starting sequence number' }
    ],
    keyFields: [
      {
        field: 'src port',
        meaning: 'the sender application slot',
        lookFor: 'high temporary port from the client'
      },
      {
        field: 'dst port',
        meaning: 'the service being contacted',
        lookFor: '443 for HTTPS, 80 for HTTP'
      },
      { field: 'flags', meaning: 'the connection state signal', lookFor: 'SYN, ACK, FIN, RST' },
      {
        field: 'seq',
        meaning: 'where this byte stream position starts',
        lookFor: 'changes as data moves'
      }
    ],
    bridge: {
      label: 'find a tcp handshake',
      filterExpression: 'proto == TCP',
      challengeId: 'tcp-handshake',
      hint: 'Look for SYN, SYN-ACK, then ACK between the same endpoints.'
    },
    animation: {
      id: 'tcp-handshake',
      title: 'tcp three-way handshake',
      modeLabel: 'use example handshake',
      fallbackLabel: 'use my capture',
      steps: ['SYN', 'SYN-ACK', 'ACK', 'connection established']
    },
    searchTerms: ['tcp', 'handshake', 'syn', 'ack', 'fin', 'rst', 'port', 'sequence']
  },
  {
    id: 'udp',
    title: 'udp',
    groupId: 'protocols',
    answer: 'UDP sends messages without opening a connection first.',
    paragraphs: [
      'UDP is simpler than TCP. It sends a datagram and does not do a handshake or built-in retry.',
      'That makes UDP useful for protocols where speed or simplicity matters. DNS often uses UDP because a query and response are small.',
      'When reading UDP, ports matter most. They tell you which service should receive the message.'
    ],
    exampleTitle: 'udp datagram',
    exampleSummary: 'A UDP message carries a DNS query to port 53.',
    exampleFields: [
      { name: 'src port', value: '54320', note: 'temporary client port' },
      { name: 'dst port', value: '53', note: 'DNS service' },
      { name: 'length', value: '38', note: 'UDP payload size' },
      { name: 'checksum', value: 'valid', note: 'basic integrity check' }
    ],
    keyFields: [
      {
        field: 'src port',
        meaning: 'the sender application slot',
        lookFor: 'high temporary client port'
      },
      {
        field: 'dst port',
        meaning: 'the service receiving the datagram',
        lookFor: '53 for DNS, 123 for NTP'
      },
      { field: 'length', meaning: 'size of the UDP datagram', lookFor: 'small values for lookups' }
    ],
    bridge: {
      label: 'filter udp',
      filterExpression: 'proto == UDP',
      challengeId: null,
      hint: 'Filter to UDP and check which ports appear most often.'
    },
    searchTerms: ['udp', 'datagram', 'port', 'dns', 'connectionless']
  },
  {
    id: 'dns',
    title: 'dns',
    groupId: 'protocols',
    answer: 'DNS translates names like example.com into IP addresses.',
    paragraphs: [
      'Your computer usually needs an IP address before it can contact a site. DNS is the question-and-answer system that finds that address.',
      'A DNS query asks for a record. A DNS response answers with one or more addresses or tells your computer where to ask next.',
      'In NetVis, DNS role badges help you pair QUERY and RESPONSE packets.'
    ],
    exampleTitle: 'dns query',
    exampleSummary: 'Your device asks a DNS server for example.com.',
    exampleFields: [
      { name: 'query', value: 'example.com', note: 'the name being resolved' },
      { name: 'type', value: 'A', note: 'IPv4 address requested' },
      { name: 'server', value: '8.8.x.x', note: 'the resolver' },
      { name: 'id', value: '0x4a12', note: 'pairs query and response' }
    ],
    keyFields: [
      {
        field: 'query name',
        meaning: 'the domain being looked up',
        lookFor: 'the site or service name'
      },
      {
        field: 'query type',
        meaning: 'what kind of record is requested',
        lookFor: 'A, AAAA, CNAME, or MX'
      },
      {
        field: 'transaction id',
        meaning: 'the value that pairs query and response',
        lookFor: 'same ID in both packets'
      },
      {
        field: 'response code',
        meaning: 'whether the lookup worked',
        lookFor: 'NOERROR or NXDOMAIN'
      }
    ],
    bridge: {
      label: 'find a dns query',
      filterExpression: 'proto == DNS',
      challengeId: 'dns-query',
      hint: 'Look for a DNS QUERY followed by a matching RESPONSE.'
    },
    animation: {
      id: 'dns-flow',
      title: 'dns resolution flow',
      modeLabel: 'use example lookup',
      fallbackLabel: 'use my capture',
      steps: ['browser asks OS', 'resolver asks DNS', 'answer returns', 'browser connects']
    },
    searchTerms: ['dns', 'query', 'response', 'resolver', 'domain', 'transaction id', 'ttl']
  },
  {
    id: 'icmp',
    title: 'icmp',
    groupId: 'protocols',
    answer: 'ICMP carries network control and diagnostic messages.',
    paragraphs: [
      'ICMP is best known for ping. A device sends an echo request, then waits for an echo reply.',
      'ICMP can also report problems, such as a destination being unreachable or a packet taking too many hops.',
      'In NetVis, ICMP role badges help separate PING, REPLY, UNREACHABLE, and TTL EXCEEDED.'
    ],
    exampleTitle: 'icmp ping',
    exampleSummary: 'An echo request leaves your device and expects a reply.',
    exampleFields: [
      { name: 'type', value: '8', note: 'echo request' },
      { name: 'code', value: '0', note: 'no subtype error' },
      { name: 'id', value: '0x0021', note: 'pairs request and reply' },
      { name: 'seq', value: '4', note: 'ping sequence number' }
    ],
    keyFields: [
      {
        field: 'type',
        meaning: 'which ICMP message this is',
        lookFor: '8 for request, 0 for reply'
      },
      {
        field: 'code',
        meaning: 'extra detail for the type',
        lookFor: '0 for normal ping messages'
      },
      {
        field: 'id',
        meaning: 'identifier shared by a ping pair',
        lookFor: 'same value in request and reply'
      },
      {
        field: 'sequence',
        meaning: 'which ping in the series this is',
        lookFor: 'increases over time'
      }
    ],
    bridge: {
      label: 'find a ping',
      filterExpression: 'proto == ICMP',
      challengeId: 'icmp-echo-pair',
      hint: 'Look for PING followed by REPLY with matching identifiers.'
    },
    animation: {
      id: 'icmp-ping',
      title: 'icmp ping round trip',
      modeLabel: 'use example ping',
      fallbackLabel: 'use my capture',
      steps: [
        'echo request leaves',
        'destination receives it',
        'echo reply returns',
        'round trip time is measured'
      ]
    },
    searchTerms: ['icmp', 'ping', 'echo', 'reply', 'unreachable', 'ttl exceeded']
  },
  {
    id: 'arp',
    title: 'arp',
    groupId: 'protocols',
    answer: 'ARP finds the local hardware address for an IP address.',
    paragraphs: [
      'ARP works on the local network. A device broadcasts a question like who has this IP address.',
      'The device that owns the address answers with its hardware address. After that, Ethernet can deliver frames locally.',
      'ARP is noisy in a useful way. Requests and replies often appear close together in the packet list.'
    ],
    exampleTitle: 'arp request',
    exampleSummary: 'A device asks who has the gateway IP address.',
    exampleFields: [
      { name: 'opcode', value: 'who has', note: 'this is a request' },
      { name: 'sender ip', value: '192.168.1.x', note: 'the asking device' },
      { name: 'target ip', value: '192.168.1.1', note: 'the address being found' },
      { name: 'target mac', value: 'unknown', note: 'filled in by the reply' }
    ],
    keyFields: [
      { field: 'opcode', meaning: 'request or reply', lookFor: 'who has and is at' },
      {
        field: 'sender ip',
        meaning: 'the device making or answering the request',
        lookFor: 'local network address'
      },
      {
        field: 'target ip',
        meaning: 'the IP being resolved',
        lookFor: 'gateway or another local device'
      },
      { field: 'sender mac', meaning: 'the hardware address answer', lookFor: 'present in replies' }
    ],
    bridge: {
      label: 'filter arp',
      filterExpression: 'proto == ARP',
      challengeId: null,
      hint: 'Look for WHO HAS followed by IS AT.'
    },
    searchTerms: ['arp', 'who has', 'is at', 'mac', 'broadcast', 'local']
  },
  {
    id: 'packet-lists',
    title: 'understanding packet lists',
    groupId: 'reading',
    answer: 'A packet list is the story of traffic in time order.',
    paragraphs: [
      'Each row is one packet. Reading rows from top to bottom shows what happened first, what happened next, and what came back.',
      'Start with time, protocol, role, source, and destination. Those columns usually tell the story before you open the inspector.',
      'Filtered-out rows stay dimmed instead of disappearing so you can keep context while focusing on one protocol.'
    ],
    exampleTitle: 'packet list row',
    exampleSummary: 'A DNS query row shows what happened and where it went.',
    exampleFields: [
      { name: 'time', value: '2.104s', note: 'when it happened' },
      { name: 'proto', value: 'DNS', note: 'what kind of packet' },
      { name: 'role', value: 'QUERY', note: 'what the packet is doing' },
      { name: 'length', value: '74', note: 'packet size' }
    ],
    keyFields: [
      { field: 'time', meaning: 'packet order', lookFor: 'clusters and gaps' },
      {
        field: 'proto',
        meaning: 'protocol family',
        lookFor: 'DNS before TCP, ARP before local delivery'
      },
      { field: 'role', meaning: 'plain-English packet role', lookFor: 'SYN, QUERY, PING, WHO HAS' },
      { field: 'length', meaning: 'packet size', lookFor: 'outliers and data-heavy rows' }
    ],
    bridge: {
      label: 'open packet list',
      filterExpression: '',
      challengeId: null,
      hint: 'Open Capture and read the packet list from top to bottom.'
    },
    searchTerms: ['packet list', 'row', 'time', 'role', 'filtered out']
  },
  {
    id: 'protocol-headers',
    title: 'reading protocol headers',
    groupId: 'reading',
    answer: 'Headers are packet labels that each protocol understands.',
    paragraphs: [
      'A header is metadata at the front of a layer. It tells that layer how to handle the data that follows.',
      'You do not need every field at once. Start with the priority fields in the inspector, then expand your attention when something looks important.',
      'Help text explains fields in plain language so names like TTL, checksum, and sequence number have context.'
    ],
    exampleTitle: 'priority fields',
    exampleSummary: 'A TCP header puts port and flags before less urgent fields.',
    exampleFields: [
      { name: 'dst port', value: '443', note: 'service target' },
      { name: 'flags', value: 'SYN', note: 'connection start' },
      { name: 'seq', value: '2847301921', note: 'stream position' },
      { name: 'checksum', value: 'valid', note: 'integrity check' }
    ],
    keyFields: [
      {
        field: 'ports',
        meaning: 'which applications are talking',
        lookFor: '53, 80, 443, or high temporary ports'
      },
      { field: 'flags', meaning: 'TCP state markers', lookFor: 'SYN, ACK, FIN, RST' },
      {
        field: 'ttl',
        meaning: 'remaining hop limit',
        lookFor: 'very low values or TTL exceeded messages'
      },
      {
        field: 'checksum',
        meaning: 'basic integrity check',
        lookFor: 'invalid only when diagnosing packet issues'
      }
    ],
    bridge: {
      label: 'inspect headers',
      filterExpression: 'proto == TCP',
      challengeId: null,
      hint: 'Select a TCP packet and compare priority fields with the rest.'
    },
    searchTerms: ['headers', 'ttl', 'checksum', 'sequence', 'flags', 'port']
  },
  {
    id: 'filtering-traffic',
    title: 'filtering traffic',
    groupId: 'reading',
    answer: 'A filter narrows the list to packets you want to study.',
    paragraphs: [
      'Filters help when the capture is busy. Instead of scanning every row, you can focus on one protocol, port, address, or time window.',
      'Clicking a protocol bar writes the filter for you. Typing in the filter box gives you more control.',
      'Keep an eye on dimmed rows. They can show what happened around the packets you are studying.'
    ],
    exampleTitle: 'filter expression',
    exampleSummary: 'A protocol filter focuses the list on DNS traffic.',
    exampleFields: [
      { name: 'filter', value: 'proto == DNS', note: 'shows DNS rows first' },
      { name: 'port', value: 'port == 443', note: 'focuses on one service' },
      { name: 'time', value: 'ts >= 1000', note: 'focuses on one moment' }
    ],
    keyFields: [
      { field: 'proto == DNS', meaning: 'show one protocol', lookFor: 'good first filter' },
      { field: 'port == 443', meaning: 'show one service port', lookFor: 'web connections' },
      {
        field: 'src or dst',
        meaning: 'focus on one endpoint',
        lookFor: 'one conversation partner'
      },
      { field: 'timeline bucket', meaning: 'filter by time window', lookFor: 'bursts of traffic' }
    ],
    bridge: {
      label: 'try a filter',
      filterExpression: 'proto == DNS',
      challengeId: 'filter-one-protocol',
      hint: 'Use a protocol filter first, then try a port filter.'
    },
    searchTerms: ['filter', 'port', 'expression', 'protocol bar', 'timeline']
  },
  {
    id: 'filter-reference',
    title: 'filter reference',
    groupId: 'reading',
    answer: 'Filter fields are short names for packet properties.',
    paragraphs: [
      'The filter bar uses compact field names so expressions stay quick to type. The most common fields are protocol, port, address, and timestamp.',
      'Use proto when you want one protocol. Use port when you want traffic for one service. Use ts when you want a time window from the capture timeline.',
      'You can start with chart clicks, then edit the generated filter when you need more precision.'
    ],
    exampleTitle: 'filter field meanings',
    exampleSummary: 'Each short filter name maps to something visible in Capture.',
    exampleFields: [
      { name: 'proto', value: 'proto == DNS', note: 'protocol badge' },
      { name: 'port', value: 'port == 443', note: 'TCP or UDP port' },
      { name: 'src', value: 'src == 192.168.1.x', note: 'source address' },
      { name: 'ts', value: 'ts >= 1000', note: 'time since capture start' }
    ],
    keyFields: [
      { field: 'proto', meaning: 'protocol name', lookFor: 'TCP, UDP, DNS, ICMP, or ARP' },
      {
        field: 'port',
        meaning: 'source or destination port',
        lookFor: '53 for DNS, 443 for HTTPS'
      },
      {
        field: 'src / dst',
        meaning: 'source or destination address',
        lookFor: 'one endpoint in a conversation'
      },
      { field: 'ts', meaning: 'timestamp in milliseconds', lookFor: 'timeline bucket filters' }
    ],
    bridge: {
      label: 'try proto filter',
      filterExpression: 'proto == DNS',
      challengeId: 'filter-one-protocol',
      hint: 'This opens Capture with a DNS protocol filter applied.'
    },
    searchTerms: ['filter reference', 'proto', 'ts', 'src', 'dst', 'port', 'timestamp']
  },
  {
    id: 'choosing-interface',
    title: 'choosing an interface',
    groupId: 'reading',
    answer: 'Choose the interface that carries your real network traffic.',
    paragraphs: [
      'An interface is a network adapter. Wi-Fi and Ethernet are usually the useful choices for live capture.',
      'Loopback, virtual, VPN, Docker, and Bluetooth interfaces can be valid, but they often show specialized traffic. Start with the recommended Wi-Fi or Ethernet option when you are unsure.',
      'If the list is empty, live capture may need permissions or a packet capture driver. You can still import or replay a PCAP file.'
    ],
    exampleTitle: 'interface list',
    exampleSummary: 'A recommended interface is usually the best first live capture source.',
    exampleFields: [
      { name: 'wi-fi', value: 'recommended', note: 'common laptop connection' },
      { name: 'ethernet', value: 'wired', note: 'stable local network adapter' },
      { name: 'loopback', value: 'local only', note: 'traffic inside your machine' },
      { name: 'virtual', value: 'specialized', note: 'VM, VPN, or container traffic' }
    ],
    keyFields: [
      {
        field: 'status dot',
        meaning: 'whether the interface is up',
        lookFor: 'green means available'
      },
      { field: 'recommended', meaning: 'NetVis best guess', lookFor: 'Wi-Fi or Ethernet first' },
      {
        field: 'system name',
        meaning: 'the OS adapter identifier',
        lookFor: 'en0, eth0, or NPF names'
      },
      {
        field: 'type label',
        meaning: 'plain-English adapter category',
        lookFor: 'Wi-Fi, Ethernet, virtual, loopback'
      }
    ],
    bridge: {
      label: 'choose interface',
      filterExpression: '',
      challengeId: 'first-capture',
      hint: 'Open Capture and pick the recommended interface before starting live capture.'
    },
    searchTerms: ['interface', 'wi-fi', 'ethernet', 'loopback', 'virtual', 'adapter', 'npf']
  },
  {
    id: 'spotting-patterns',
    title: 'spotting patterns',
    groupId: 'reading',
    answer: 'Patterns reveal conversations, requests, replies, and unusual packets.',
    paragraphs: [
      'Packets make more sense in groups. A DNS query often has a response. A TCP connection starts with a handshake. A ping has a request and reply.',
      'Look for repeated endpoints, matching ports, role badges, and timing gaps. Those clues turn a list of packets into a story.',
      'Outliers matter too. A very large packet, a reset, or repeated retries can explain what the network is doing.'
    ],
    exampleTitle: 'traffic pattern',
    exampleSummary: 'A DNS query is followed by a response, then TCP starts.',
    exampleFields: [
      { name: 'step 1', value: 'DNS QUERY', note: 'ask for address' },
      { name: 'step 2', value: 'DNS RESPONSE', note: 'address returns' },
      { name: 'step 3', value: 'TCP SYN', note: 'connection starts' },
      { name: 'step 4', value: 'ACK/DATA', note: 'traffic continues' }
    ],
    keyFields: [
      {
        field: 'role badges',
        meaning: 'packet job labels',
        lookFor: 'QUERY, RESPONSE, SYN, ACK, PING'
      },
      {
        field: 'source and destination',
        meaning: 'conversation endpoints',
        lookFor: 'same pair repeated'
      },
      {
        field: 'length',
        meaning: 'packet size changes',
        lookFor: 'largest packet or tiny control packets'
      },
      {
        field: 'time gaps',
        meaning: 'delays between packets',
        lookFor: 'long pauses or tight bursts'
      }
    ],
    bridge: {
      label: 'compare packet sizes',
      filterExpression: '',
      challengeId: 'compare-packet-lengths',
      hint: 'Use the packet list and protocol chart to compare traffic types.'
    },
    searchTerms: [
      'patterns',
      'conversation',
      'request',
      'response',
      'largest',
      'retransmission',
      'handshake'
    ]
  }
]

export const LEARN_TOPIC_INDEX: Record<string, LearnTopic> = Object.fromEntries(
  LEARN_TOPICS.map((topic) => [topic.id, topic])
)
