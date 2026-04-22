# Product Overview

**Last Modified:** 2026-04-13

NetVis is a cross-platform desktop application for educational network packet visualization. It enables beginner networking students to capture live network packets, load saved PCAP files, and explore protocol behavior through real-time visualizations and guided challenges.

## Target Audience

Beginner networking students learning protocol fundamentals.

## Core Value Proposition

- Live packet capture and PCAP file import
- Real-time protocol visualization with educational explanations
- Guided challenges for hands-on learning
- Privacy-first design with built-in payload anonymization

## Key Features

- Live capture via libpcap/Npcap
- PCAP file import/export
- Simulated replay with speed control (0.5×-5×)
- Protocol parsing (Ethernet, IPv4/IPv6, TCP/UDP/ICMP/DNS/ARP)
- Payload anonymization (HMAC-based pseudonymization)
- Ring buffer (1K-100K packets, default 10K)
- Educational field explanations
- Guided challenges

## Product Principles

- **Education-first:** NetVis is an education-first packet visualization desktop application, not a professional network forensics replacement
- **Security over convenience:** Security has priority over convenience and visual polish
- **Correctness first:** Correctness and stability come before advanced features
- **Visualization with boundaries:** Visualization is a primary product feature, but never at the cost of security or correctness
- **Separate capture modes:** Live capture, file import, and simulated replay are separate features that share a downstream pipeline

## Documentation Authority

- **Historical synopsis documents** are vision/motivation references, not current technical authority
- **Requirements and design documents** are the normative technical sources

## Current Status

This document does not assert implementation completion, test counts, or bugfix-final status.

Operational and implementation-coupled status must be tracked separately and remains subject to source-code and test verification.
