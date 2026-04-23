# AAuth Knowledge Graph — Complete Schema

> Validated against [explorer.aauth.dev](https://explorer.aauth.dev/) and [aauth.dev](https://www.aauth.dev/)
> Generated: 2026-04-21

---

## 1. Protocol Overview

AAuth (Autonomous Authorization) gives every agent its own cryptographic identity.
No pre-registration. No shared secrets. No bearer tokens.

**Three layers** (each builds on the previous):
1. **Signing** — How an agent proves who it is on every request
2. **Resource Access** — How a protected API decides what the agent may do
3. **Mission** — Optional governance: proposal, approval, audit, completion

**One advanced layer**:
4. **Advanced Patterns** — Call chaining, clarification chat, interaction chaining

**Core specs**:
- RFC 9421 (HTTP Message Signatures)
- Signature-Key draft (Signature-Key header + 5 schemes)
- AAuth SPEC (profiles the above, adds tokens + mission)

---

## 2. Nodes

### 2.1 Participants

| id | label | description | appears_in |
|---|---|---|---|
| `agent` | Agent | Makes signed requests, holds keys, proposes missions | All layers |
| `resource` | Resource | Protected API; issues resource tokens, verifies auth | All layers |
| `ps` | Person Server | Represents the user; manages missions, federates to AS, issues/relays auth tokens | Access (3+4 party), Mission, Advanced |
| `as` | Access Server | Issues auth tokens; enforces resource access policy | Access (4-party), Mission, Advanced |
| `user` | User | Human who reviews/approves missions and consent | Mission, User Delegation, Advanced |
| `agent_server` | Agent Server | Issues aa-agent+jwt to delegate agents, binding cnf.jwk | Signing (agent tokens) |
| `delegate` | Delegate Agent | Receives aa-agent+jwt from agent server, signs with sig=jwt | Signing (agent tokens) |
| `resource1` | Resource 1 | First resource in call/interaction chaining | Advanced |
| `resource2` | Resource 2 | Second resource called by R1 | Advanced |
| `as1` | Access Server 1 | AS for Resource 1 | Advanced |
| `as2` | Access Server 2 | AS for Resource 2 | Advanced |

### 2.2 Tokens

| id | label | typ | description |
|---|---|---|---|
| `token_agent` | Agent Token | `aa-agent+jwt` | Binds an agent's signing key (cnf.jwk) to its identity. Issued by agent server. Contains: iss, sub, dwk, jti, cnf, iat, exp, ps (optional) |
| `token_resource` | Resource Token | `aa-resource+jwt` | Describes the access needed. Issued by resource in 401 challenge. Contains: iss, aud (PS or AS URL), dwk, jti, agent, agent_jkt, scope, mission (optional) |
| `token_auth` | Auth Token | `aa-auth+jwt` | Grants an agent access to a resource. Issued by PS or AS. Contains: iss, aud, dwk, jti, cnf, agent, act, scope, mission (optional) |
| `token_opaque` | Opaque Access Token | string | Simple opaque string issued by resource in Resource-Managed mode via AAuth-Access header. Not a JWT. |

### 2.3 Concepts (Foundational)

| id | label | description |
|---|---|---|
| `http_sig` | HTTP Message Signatures | RFC 9421. Three headers: Signature-Key, Signature-Input, Signature. Base components: @method, @authority, @path, signature-key |
| `sig_hwk` | sig=hwk | Header Web Key. Public key inline. Pseudonymous — no identity revealed. |
| `sig_jkt_jwt` | sig=jkt-jwt | JKT JWT. Hardware enclave key delegates to ephemeral key via cnf claim. Pseudonymous — stable thumbprint identity. |
| `sig_jwks_uri` | sig=jwks_uri | JWKS URI Discovery. Agent identifier URI + kid. Verifier fetches well-known + JWKS. Identity tier. |
| `sig_jwt` | sig=jwt | JWT Confirmation Key. Signed JWT carries pub key in cnf. Used for all AAuth tokens (agent/resource/auth). Identity tier. |
| `dwk_agent` | aauth-agent.json | Well-known metadata for agent server keys |
| `dwk_resource` | aauth-resource.json | Well-known metadata for resource keys |
| `dwk_person` | aauth-person.json | Well-known metadata for person server keys |
| `dwk_access` | aauth-access.json | Well-known metadata for access server keys |
| `mission_blob` | Mission Blob | Approved mission: approver, agent, approved_at, description (markdown), approved_tools, capabilities, s256 |
| `aauth_mission_header` | AAuth-Mission Header | approver URL + s256 (SHA-256 of mission blob bytes). Included in signed components. |
| `aauth_capabilities_header` | AAuth-Capabilities Header | Declares agent capabilities: interaction, clarification |
| `signature_error` | Signature-Error Header | Machine-readable error codes: invalid_request, invalid_input, invalid_signature, unsupported_algorithm, invalid_key, unknown_key, invalid_jwt, expired_jwt |

---

## 3. Edges

### 3.1 Signing Layer

| id | from | to | label | detail | scheme |
|---|---|---|---|---|---|
| `S1` | `agent` | `resource` | Unsigned request → 401 | Resource returns 401 + Accept-Signature challenge (sigkey=jkt or sigkey=uri) | — |
| `S2` | `agent` | `resource` | Signed request (sig=hwk) → 200 | Public key inline in Signature-Key. Resource verifies signature. Pseudonymous — learns JWK Thumbprint only. | hwk |
| `S3` | `agent` | `resource` | Signed request (sig=jkt-jwt) → 200 | Hardware enclave key delegates to ephemeral key via JWT cnf claim. Pseudonymous — stable thumbprint. | jkt-jwt |
| `S4` | `agent` | `resource` | Signed request (sig=jwks_uri) → 200 | Signature-Key references agent identifier URI + kid. | jwks_uri |
| `S5` | `resource` | `agent` | Fetch well-known + JWKS | Resource fetches {id}/.well-known/aauth-agent.json, resolves jwks_uri, verifies kid. | jwks_uri |
| `S6` | `agent_server` | `delegate` | Issues aa-agent+jwt | Agent server signs JWT with cnf.jwk = delegate's public key. sub = delegate identifier. | jwt |
| `S7` | `delegate` | `resource` | Signed request (sig=jwt) with agent token → 200 | Delegate embeds aa-agent+jwt in Signature-Key. Resource verifies JWT + HTTP signature via cnf.jwk. | jwt |

### 3.2 Access Layer

#### Identity-Based (2-party, simplest)

| id | from | to | label | detail |
|---|---|---|---|---|
| `A1` | `agent` | `resource` | Signed GET (sig=jwt) → 200 | Agent presents agent token. Resource resolves iss+dwk, verifies JWT, checks cnf.jwk, applies identity policy. No token exchange. |
| `A2` | `resource` | `agent` | Fetch agent JWKS | Resource fetches agent.example/.well-known/aauth-agent.json to verify agent token. |

#### Resource-Managed (2-party)

| id | from | to | label | detail |
|---|---|---|---|---|
| `A3` | `agent` | `resource` | Signed GET (sig=jwt) → 200 + opaque token | Resource verifies identity, issues AAuth-Access header with opaque token. |
| `A4` | `agent` | `resource` | Subsequent request with AAuth-Access → 200 | Agent includes opaque token in Authorization header. No re-signing needed. |

#### PS-Managed (3-party)

| id | from | to | label | detail |
|---|---|---|---|---|
| `A5` | `agent` | `resource` | Signed GET → 401 + aa-resource+jwt (aud=PS) | Resource issues resource token with aud = PS URL. PS will handle issuance directly. |
| `A6` | `agent` | `ps` | POST aa-resource+jwt to PS /token | Agent forwards resource token to PS. |
| `A7` | `ps` | `agent` | Issues aa-auth+jwt (iss=PS) | PS issues auth token directly. No AS involved. |
| `A8` | `agent` | `resource` | Present aa-auth+jwt → 200 | Agent retries with auth token. Resource verifies and grants access. |

#### Federated (4-party)

| id | from | to | label | detail |
|---|---|---|---|---|
| `A9` | `agent` | `resource` | Signed GET → 401 + aa-resource+jwt (aud=AS) | Resource issues resource token with aud = AS URL. |
| `A10` | `agent` | `ps` | POST aa-resource+jwt to PS | Agent forwards resource token. |
| `A11` | `ps` | `as` | Federate: POST resource + agent tokens to AS /token | PS signs and forwards. PS uses its own jwks_uri identity. AS honours only trusted_person_servers. |
| `A12` | `as` | `ps` | Issues aa-auth+jwt (iss=AS) | AS mints auth token bound to agent's cnf.jwk. |
| `A13` | `ps` | `agent` | Returns aa-auth+jwt | PS relays auth token back to agent. |
| `A14` | `agent` | `resource` | Present aa-auth+jwt → 200 | Agent retries with auth token. |

#### User Delegation (5-party, deferred)

| id | from | to | label | detail |
|---|---|---|---|---|
| `A15` | `agent` | `resource` | Signed GET → 401 + aa-resource+jwt | Same 401 challenge as Federated. |
| `A16` | `agent` | `ps` | POST resource token to PS | Agent forwards. |
| `A17` | `ps` | `as` | Federate to AS /token | PS forwards to AS. |
| `A18` | `as` | `ps` | 202 + pending URL + interaction URL | AS requires user consent. Returns deferred response. |
| `A19` | `ps` | `agent` | 202 + pending URL + interaction URL | PS relays deferred response to agent. |
| `A20` | `user` | `as` | Open interaction URL → authenticate + approve | User visits interaction URL, reviews scope, approves consent. |
| `A21` | `agent` | `ps` | Poll pending URL → 202 (waiting) | Agent polls while user decides. |
| `A22` | `agent` | `ps` | Poll pending URL → 200 + aa-auth+jwt | After approval, PS returns auth token. |
| `A23` | `agent` | `resource` | Present aa-auth+jwt → 200 | Agent retries with auth token. |

### 3.3 Mission Layer

#### Proposal & Approval (Lifecycle)

| id | from | to | label | detail |
|---|---|---|---|---|
| `M1` | `agent` | `ps` | GET /.well-known/aauth-person.json | Discover PS metadata: mission_endpoint, interaction_endpoint, token_endpoint. |
| `M2` | `agent` | `ps` | POST /mission (proposal) → 202 | Agent proposes: markdown description + tools list. PS returns pending URL + interaction URL. |
| `M3` | `ps` | `user` | Present mission for review | User opens interaction URL to see description + tool list. |
| `M4` | `user` | `ps` | Approve mission | User approves. PS computes s256 = SHA-256(approved_blob_bytes). |
| `M5` | `agent` | `ps` | Poll pending URL → 200 + mission blob | Agent receives: approver, agent, approved_at, description, approved_tools, capabilities + AAuth-Mission header with s256. |

#### Resource Access with Mission

| id | from | to | label | detail |
|---|---|---|---|---|
| `M6` | `agent` | `resource` | POST /authorize + AAuth-Mission → 200 + aa-resource+jwt | Proactive authorization. AAuth-Mission header included. aauth-mission in signed components. Resource token carries mission:{approver, s256}. |
| `M7` | `agent` | `ps` | POST resource token to PS /token | Resource token has mission claim. |
| `M8` | `ps` | `as` | Federate to AS with mission claim | Mission claim preserved through federation. |
| `M9` | `as` | `ps` | Auth token with mission claim intact | AS preserves mission.s256 in aa-auth+jwt. |
| `M10` | `ps` | `agent` | Return auth token | Relay back to agent. |
| `M11` | `agent` | `resource` | Present auth token + AAuth-Mission → 200 | Resource compares AAuth-Mission s256 with auth token mission.s256 — end-to-end chain verified. |

#### Out-of-Bounds Access

| id | from | to | label | detail |
|---|---|---|---|---|
| `M12` | `agent` | `resource` | POST /authorize (out-of-scope) → 200 + resource token | Resource issues token — it does NOT evaluate mission scope. Only the PS does. |
| `M13` | `agent` | `ps` | POST resource token to PS | PS evaluates against mission scope + log. Detects mismatch. |
| `M14` | `ps` | `user` | 202 + requirement=interaction (consent request) | PS asks user for out-of-scope consent. |
| `M15` | `user` | `ps` | Decline consent | User declines. PS returns 403 access_denied to agent. |
| `M16` | `agent` | `ps` | POST /mission (new proposal M2) | Agent must propose new mission with broader scope. New s256. |

#### Completion

| id | from | to | label | detail |
|---|---|---|---|---|
| `M17` | `agent` | `ps` | POST /interaction {type=completion, summary, mission} → 202 | Agent submits markdown summary referencing mission by approver + s256. |
| `M18` | `ps` | `user` | Present completion summary | User reviews summary. |
| `M19` | `user` | `ps` | Accept → mission terminated | PS terminates mission. Mission log retained for audit. |

#### Audit

| id | from | to | label | detail |
|---|---|---|---|---|
| `M20` | `agent` | `ps` | POST /audit {mission, action, description, parameters, result} → 201 | Fire-and-forget. Agent SHOULD NOT block on response. Requires mission context. |
| `M21` | `agent` | `ps` | POST /audit after termination → 403 mission_terminated | Late audits rejected. |

### 3.4 Advanced Patterns

#### Call Chaining (R1 acts as agent to R2)

| id | from | to | label | detail |
|---|---|---|---|---|
| `V1` | `agent` | `resource1` | Signed request with AS1 auth token → 200 | Agent accesses R1. R1 needs data from R2. |
| `V2` | `resource1` | `resource2` | R1 calls R2 → 401 + R2 resource token | R1 acts as an agent to R2. |
| `V3` | `resource1` | `ps` | R1 sends R2 resource token + upstream auth token to PS | PS federates on R1's behalf. |
| `V4` | `ps` | `as2` | Federate for R2 auth token | PS forwards to AS2. |
| `V5` | `as2` | `ps` | Chained auth token (nested act claims) | Auth token has nested act: R1 acting on behalf of original agent. |
| `V6` | `ps` | `resource1` | Return chained auth token | PS relays back to R1. |
| `V7` | `resource1` | `resource2` | R1 accesses R2 with chained auth token → 200 | R2 sees R1 as current actor, agent as original. |
| `V8` | `resource1` | `agent` | R1 returns combined result to agent | Agent receives merged response. |

#### Clarification Chat

| id | from | to | label | detail |
|---|---|---|---|---|
| `V9` | `agent` | `resource` | Signed request + AAuth-Capabilities: clarification → 401 | Agent declares clarification capability. |
| `V10` | `agent` | `as` | POST resource token → 202 + requirement=clarification | AS poses a question before user consent. |
| `V11` | `agent` | `as` | POST clarification answer → 202 + requirement=interaction | Agent answers. AS now needs user consent with richer context. |
| `V12` | `as` | `user` | Present consent UI + clarification Q&A | User sees agent identity, scope, and agent's clarification answer. |
| `V13` | `user` | `as` | Approve consent | User approves with full context. |
| `V14` | `agent` | `as` | Poll pending URL → 200 + aa-auth+jwt | Agent receives auth token. |

#### Interaction Chaining (202 bubbles back)

| id | from | to | label | detail |
|---|---|---|---|---|
| `V15` | `agent` | `resource1` | Signed request with auth token → 202 | R1 needs R2, but R2's AS requires user consent. R1 bubbles 202 back. |
| `V16` | `resource1` | `resource2` | R1 calls R2 → 401 + R2 resource token | R1 acts as agent to R2. |
| `V17` | `resource1` | `as2` | R1 sends R2 resource token to AS2 → 202 + interaction URL | AS2 requires user consent. |
| `V18` | `user` | `as2` | Open interaction URL (redirected via R1) → approve | User visits R1's /interact URL, redirected to AS2 consent page. |
| `V19` | `resource1` | `as2` | R1 polls AS2 → 200 + chained auth token | After user consent, R1 gets auth token for R2. |
| `V20` | `resource1` | `resource2` | R1 accesses R2 with chained auth token | R1 completes R2 call. |
| `V21` | `agent` | `resource1` | Agent polls R1 → 200 combined result | Agent gets final merged result. |

---

## 4. Layers & Filters

The graph supports layer-based filtering. Each layer controls which edges are visible.

| Layer | Filter Key | Description | Participants involved |
|---|---|---|---|
| Signing | `signing` | How agents prove identity per-request | Agent, Resource, Agent Server, Delegate |
| Access | `access` | How resources authorize agents | Agent, Resource, PS, AS, User |
| Mission | `mission` | Optional governance: propose, approve, audit, complete | Agent, PS, AS, User, Resource |
| Advanced | `advanced` | Multi-resource chaining, clarification, interaction chaining | Agent, R1, R2, PS, AS1, AS2, User |

**Sub-filters within Access:**

| Sub-filter | Mode | Parties |
|---|---|---|
| `access-identity` | Identity-Based | 2 (Agent, Resource) |
| `access-resource` | Resource-Managed | 2 (Agent, Resource) |
| `access-ps` | PS-Managed | 3 (Agent, Resource, PS) |
| `access-federated` | Federated | 4 (Agent, Resource, PS, AS) |
| `access-delegation` | User Delegation | 5 (Agent, Resource, PS, AS, User) |

**Sub-filters within Mission:**

| Sub-filter | Scenario |
|---|---|
| `mission-lifecycle` | Proposal & Approval |
| `mission-access` | Resource Access with Mission |
| `mission-oob` | Out-of-Bounds Access |
| `mission-completion` | Completion |
| `mission-audit` | Audit |

**Sub-filters within Advanced:**

| Sub-filter | Pattern |
|---|---|
| `advanced-chain` | Call Chaining |
| `advanced-clarification` | Clarification Chat |
| `advanced-interaction` | Interaction Chaining |

---

## 5. View Modes

| Mode | Behaviour |
|---|---|
| **Interactive** (default) | Click a layer/sub-filter to show only those edges. Click a node to expand its flows step by step. Sidebar shows detail per step. |
| **Full** | All edges visible at once. Layer filter toolbar highlights (not hides) edges. Good for seeing the whole protocol. |

Toggle via a button in the toolbar.

---

## 6. UI Components

| Component | Purpose |
|---|---|
| **Graph canvas** | Cytoscape.js — participant nodes as hubs, token nodes as smaller connected nodes, edges as protocol flows |
| **Layer toolbar** | Filter buttons: Signing / Access / Mission / Advanced, each expandable to sub-filters |
| **View toggle** | Interactive ↔ Full |
| **Tooltip** (hover) | One-liner description of node/edge |
| **Sidebar panel** (click) | Full detail: description, token payloads, header examples, why this step matters |

---

## 7. Colour Scheme

| Element | Colour | Hex |
|---|---|---|
| Agent / Delegate | Blue | `#3B82F6` |
| Resource / R1 / R2 | Green | `#10B981` |
| Person Server | Purple | `#8B5CF6` |
| Access Server / AS1 / AS2 | Orange | `#F59E0B` |
| User | Teal | `#14B8A6` |
| Agent Server | Indigo | `#6366F1` |
| Agent Token | Blue (lighter) | `#93C5FD` |
| Resource Token | Green (lighter) | `#6EE7B7` |
| Auth Token | Orange (lighter) | `#FCD34D` |
| Opaque Token | Gray | `#9CA3AF` |
| Signing edges | Gray | `#6B7280` |
| Access edges | Blue | `#2563EB` |
| Mission edges | Purple | `#7C3AED` |
| Advanced edges | Amber | `#D97706` |

---

## 8. Data Sources

| Source | URL | What we validated |
|---|---|---|
| AAuth Explorer | https://explorer.aauth.dev/ | All 20 scenario pages: 4 signing modes, 5 access modes, 6 mission scenarios, 3 advanced patterns, 3 foundation pages |
| AAuth Home | https://www.aauth.dev/ | Protocol overview, 4 access modes, 3 token types, participant roles, spec links |

---

## 9. File Structure

```
aauth-explorer/
├── index.html          # Main page, loads all JS/CSS
├── SCHEMA.md           # This file
├── data/
│   └── graph.js        # Nodes + edges (from this schema)
├── js/
│   ├── graph.js        # Cytoscape init + layout
│   ├── interactions.js # Click, hover, expand, sidebar logic
│   └── filters.js      # Layer filter toolbar + view toggle
└── css/
    └── style.css       # Styling, colours, sidebar, toolbar
```
