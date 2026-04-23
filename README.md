# AAuth Knowledge Graph

> An open-source interactive protocol explorer for [AAuth](https://www.aauth.dev/) — contributed to the community by [MCPShark](https://www.mcpshark.sh/).

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Built with Cytoscape.js](https://img.shields.io/badge/Built%20with-Cytoscape.js-orange.svg)
![Protocol: AAuth](https://img.shields.io/badge/Protocol-AAuth-cyan.svg)

---

## Overview

AAuth Knowledge Graph is an interactive, browser-based visualization of the [AAuth (Agent Authorization)](https://www.aauth.dev/) protocol. It maps every participant, token, and protocol flow as a navigable graph — letting developers, architects, and protocol implementers explore AAuth's signing schemes, access modes, mission governance, and advanced patterns in a single unified view.

No build step. No dependencies to install. Open `index.html` and explore.

---

## About AAuth

AAuth is an open protocol for **agent authorization**. It gives every agent its own cryptographic identity — no pre-registration, no shared secrets, no bearer tokens.

Key properties:
- **Proof of possession** — every request is signed with HTTP Message Signatures ([RFC 9421](https://www.rfc-editor.org/rfc/rfc9421)). Stolen tokens are worthless without the signing key.
- **No pre-registration** — agents self-publish identity at HTTPS URLs. Any agent can interact with any resource on first contact.
- **Async by design** — `202 Accepted` + polling handles consent, approvals, clarification, and headless agents with one pattern.
- **Mission governance** — the agent states intent, the user approves, and every access is evaluated in that context.
- **Progressive adoption** — each access mode is independently deployable. Start with 2-party identity, add a Person Server or Access Server later without changing the agent.

**Resources:**
- Specification: [aauth.dev](https://www.aauth.dev/)
- Interactive Explorer: [explorer.aauth.dev](https://explorer.aauth.dev/)
- Internet Drafts: [github.com/dickhardt/AAuth](https://github.com/dickhardt/AAuth)

---

## Motivation

The official AAuth Explorer walks through each scenario in isolation — one flow at a time, step by step. This is great for learning individual flows but makes it hard to see how the protocol composes: how signing underlies every access mode, how missions layer on top of federation, how call chaining builds on the 4-party flow.

This knowledge graph addresses that by:

1. **Modeling the full protocol as a graph** — participants as nodes, protocol flows as directed edges, tokens as first-class artifacts
2. **Progressive disclosure** — explore one flow at a time (Interactive mode) or see the entire protocol at once (Full mode)
3. **Layer filtering** — isolate Signing, Access, Mission, or Advanced patterns independently
4. **Contextual detail** — click any node or edge for a protocol-level explanation, token payload structure, and a direct link to the relevant AAuth Explorer page

---

## Features

| Feature | Description |
|---|---|
| **Interactive step-through** | Navigate protocol flows step by step using arrow keys or `‹ ›` buttons |
| **Full view toggle** | Switch between focused (one flow) and full protocol view |
| **Layer filters** | Signing / Access / Mission / Advanced — each expandable to sub-modes |
| **Right sidebar** | Click any node or edge for participant role, protocol detail, token payloads |
| **Explorer links** | Every edge links directly to the corresponding AAuth Explorer scenario page |
| **Dark security theme** | Trust-domain colour coding — participant colours map to protocol boundaries |
| **Keyboard shortcuts** | `1`–`4` for layers, `←` `→` for steps, `Esc` to reset |
| **Zero build step** | Single `index.html` — deployable to GitHub Pages with no toolchain |

---

## Protocol Coverage

All scenarios validated against [explorer.aauth.dev](https://explorer.aauth.dev/) and [aauth.dev](https://www.aauth.dev/).

### Signing Layer

| Sub-mode | Schemes | Explorer |
|---|---|---|
| All Schemes | sig=hwk, sig=jkt-jwt, sig=jwks_uri, sig=jwt | [/signing/compare](https://explorer.aauth.dev/signing/compare) |
| Pseudonymous | sig=hwk (inline key) | [/signing/pseudonymous](https://explorer.aauth.dev/signing/pseudonymous) |
| Hardware-backed | sig=jkt-jwt (enclave delegation) | [/signing/hardware-backed](https://explorer.aauth.dev/signing/hardware-backed) |
| Agent Identity | sig=jwks_uri (HTTPS discovery) | [/signing/identity](https://explorer.aauth.dev/signing/identity) |
| Agent Tokens | sig=jwt (JWT confirmation key) | [/signing/agent-tokens](https://explorer.aauth.dev/signing/agent-tokens) |

### Access Layer

| Mode | Parties | Description | Explorer |
|---|---|---|---|
| Identity-Based | 2 | Resource verifies agent identity directly | [/access/identity-based](https://explorer.aauth.dev/access/identity-based) |
| Resource-Managed | 2 | Resource issues opaque AAuth-Access token | [/access/resource-managed](https://explorer.aauth.dev/access/resource-managed) |
| PS-Managed | 3 | Person Server issues auth token (aud=PS) | [/access/ps-managed](https://explorer.aauth.dev/access/ps-managed) |
| Federated | 4 | AS issues auth token via PS federation (aud=AS) | [/access/federated](https://explorer.aauth.dev/access/federated) |
| User Delegation | 5 | Deferred consent — 202 + polling + user approval | [/access/user-delegation](https://explorer.aauth.dev/access/user-delegation) |

### Mission Layer

| Scenario | Description | Explorer |
|---|---|---|
| Proposal & Approval | Agent proposes mission; user reviews + approves; s256 fingerprint issued | [/missions/lifecycle](https://explorer.aauth.dev/missions/lifecycle) |
| Resource Access | Mission claim flows through token chain end-to-end | [/missions/resource-access](https://explorer.aauth.dev/missions/resource-access) |
| Out-of-Bounds | PS detects scope mismatch; user consent or new mission required | [/missions/out-of-bounds](https://explorer.aauth.dev/missions/out-of-bounds) |
| Completion | Agent submits summary; user accepts; mission terminated | [/missions/completion](https://explorer.aauth.dev/missions/completion) |
| Audit | Fire-and-forget action log tied to mission s256 | [/missions/audit](https://explorer.aauth.dev/missions/audit) |

### Advanced Patterns

| Pattern | Description | Explorer |
|---|---|---|
| Call Chaining | R1 acts as agent to R2; nested act claims record delegation chain | [/advanced/call-chaining](https://explorer.aauth.dev/advanced/call-chaining) |
| Clarification Chat | AS poses question before user consent; agent answers inline | [/advanced/clarification](https://explorer.aauth.dev/advanced/clarification) |
| Interaction Chaining | R1 bubbles 202 back to agent when R2 requires user consent | [/advanced/interaction-chaining](https://explorer.aauth.dev/advanced/interaction-chaining) |

---

## Quick Start

```bash
git clone https://github.com/mcp-shark/mcp-shark.git
cd aauth-explorer
open index.html        # macOS
# or
start index.html       # Windows
# or simply open index.html in any modern browser
```

No npm. No webpack. No server required.

### How to Navigate

1. **Select a layer** from the left nav (Signing / Access / Mission / Advanced)
2. **Select a sub-mode** from the expanded dropdown (e.g. Federated)
3. **Step through** the flow using `‹ ›` or `←` `→` keyboard shortcuts
4. **Click any node or edge** to open the detail sidebar
5. **Toggle Full view** (top right) to see the entire protocol at once
6. Press **Esc** to reset

---

## Project Structure

```
aauth-explorer/
├── index.html              # Application shell — no build step required
├── README.md               # This file
├── SCHEMA.md               # Complete validated node/edge schema with AAuth source references
├── LICENSE
├── assets/
│   └── images/
│       └── logo.jpeg       # MCPShark logo
├── data/
│   └── graph.js            # Single source of truth — all nodes, edges, metadata
├── js/
│   ├── graph.js            # Cytoscape.js initialization, layout, and style
│   ├── interactions.js     # Click, hover, tooltip, and sidebar logic
│   └── filters.js          # Layer filter toolbar, view toggle, step navigation
└── css/
    └── style.css           # Dark security theme — glassmorphism, trust-domain colours
```

---

## Data Model

The graph is encoded in `data/graph.js` as a self-contained JavaScript module (`AAuthGraph`).

### Nodes

| Type | Count | Description |
|---|---|---|
| Participants | 11 | Agent, Resource, PS, AS, User, Agent Server, Delegate, R1, R2, AS1, AS2 |
| Tokens | 4 | aa-agent+jwt, aa-resource+jwt, aa-auth+jwt, Opaque token |

### Edges

| Layer | Count | Description |
|---|---|---|
| Signing | 7 | S1–S7: signing schemes and key discovery |
| Access | 23 | A1–A23: 5 access modes across 2–5 parties |
| Mission | 21 | M1–M21: proposal, access, out-of-bounds, completion, audit |
| Advanced | 21 | V1–V21: call chaining, clarification, interaction chaining |
| **Total** | **72** | |

Each edge carries: `id`, `source`, `target`, `label`, `layer`, `sublayer`, `step`, `tooltip`, `detail`, `url`.

The `url` field links directly to the corresponding [AAuth Explorer](https://explorer.aauth.dev/) scenario page.

For the full validated schema including token payloads and HTTP header examples, see [SCHEMA.md](./SCHEMA.md).

---

## Contributing

Contributions are welcome. The most valuable contributions are:

1. **Protocol updates** — if AAuth spec changes, update `data/graph.js` (nodes/edges) and `SCHEMA.md`
2. **Richer sidebar content** — add `example` fields (token payloads, header snippets) to edges in `data/graph.js`
3. **New scenarios** — add edges for any new Explorer pages using the existing `id/layer/sublayer/step/url` pattern
4. **UI improvements** — `css/style.css` and `js/interactions.js` for visual and interaction enhancements

### Adding a new edge

```javascript
{
  data: {
    id: 'X1',                          // unique id
    source: 'agent',                   // participant id
    target: 'resource',                // participant id
    label: 'Short label',              // shown on graph edge
    layer: 'access',                   // signing | access | mission | advanced
    sublayer: 'access-identity',       // sub-filter key
    step: 1,                           // temporal order within sub-filter
    url: 'https://explorer.aauth.dev/access/identity-based',
    tooltip: 'One-liner for hover',
    detail: 'Full explanation for sidebar panel.'
  }
}
```

---

## License

MIT © [MCPShark](https://www.mcpshark.sh/)

See [LICENSE](./LICENSE) for full terms.

---

## Acknowledgements

- **[AAuth Protocol](https://www.aauth.dev/)** — Dick Hardt and contributors
- **[AAuth Explorer](https://explorer.aauth.dev/)** — all protocol content validated against the official explorer
- **[Cytoscape.js](https://js.cytoscape.org/)** — graph visualization engine
- **[MCPShark](https://www.mcpshark.sh/)** — [github.com/mcp-shark/mcp-shark](https://github.com/mcp-shark/mcp-shark)
