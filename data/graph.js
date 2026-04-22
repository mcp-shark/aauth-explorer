// data/graph.js
// AAuth Knowledge Graph — Single source of truth
// Validated against explorer.aauth.dev and aauth.dev
//
// Structure:
//   NODES  — participants + tokens (Cytoscape elements format)
//   EDGES  — protocol flows with layer/sublayer/step metadata
//   META   — concept definitions for sidebar detail panels

const AAuthGraph = (() => {

  // ─── PARTICIPANTS ──────────────────────────────────────────
  // These map 1:1 to the AAuth spec's defined roles.
  // Each participant is a hub in the graph; edges represent
  // protocol flows between them.

  const participants = [
    {
      data: {
        id: 'agent', label: 'Agent', type: 'participant',
        color: '#06B6D4', glow: 'rgba(6,182,212,0.5)',
        tooltip: 'Makes signed requests, holds keys, proposes missions',
        detail: 'The agent is the HTTP client that initiates every AAuth flow. It self-publishes identity at an HTTPS URL, signs every request with HTTP Message Signatures (RFC 9421), and never relies on pre-registration or shared secrets. In mission-enabled flows, the agent proposes what it intends to do and audits what it did.'
      }
    },
    {
      data: {
        id: 'resource', label: 'Resource', type: 'participant',
        color: '#10B981', glow: 'rgba(16,185,129,0.5)',
        tooltip: 'Protected API; issues resource tokens, verifies auth',
        detail: 'The resource is the protected API. It issues 401 challenges with Accept-Signature headers, mints aa-resource+jwt tokens describing the access needed, and verifies auth tokens on retry. The resource never evaluates mission content — only signature validity and token claims.'
      }
    },
    {
      data: {
        id: 'ps', label: 'Person Server', type: 'participant',
        color: '#8B5CF6', glow: 'rgba(139,92,246,0.5)',
        tooltip: 'Represents the user; manages missions, federates to AS',
        detail: 'The Person Server (PS) represents the human user. It manages the mission lifecycle (proposal, approval, audit, completion), federates to the Access Server on the agent\'s behalf, and is the only party that holds the full mission description and tool list. The PS enforces mission-level governance at its token endpoint.'
      }
    },
    {
      data: {
        id: 'as', label: 'Access Server', type: 'participant',
        color: '#F59E0B', glow: 'rgba(245,158,11,0.5)',
        tooltip: 'Issues auth tokens; enforces resource access policy',
        detail: 'The Access Server (AS) issues aa-auth+jwt tokens after verifying the resource token and the PS\'s identity. It enforces resource-level access policy and honours only trusted_person_servers. In deferred flows, it returns 202 with interaction URLs for user consent.'
      }
    },
    {
      data: {
        id: 'user', label: 'User', type: 'participant',
        color: '#14B8A6', glow: 'rgba(20,184,166,0.5)',
        tooltip: 'Human who reviews/approves missions and consent',
        detail: 'The human user who reviews mission proposals, approves or declines consent at interaction URLs, reviews completion summaries, and provides clarification context. The user never directly touches tokens — all interaction is mediated by the PS or AS via browser-based UIs.'
      }
    },
    {
      data: {
        id: 'agent_server', label: 'Agent Server', type: 'participant',
        color: '#6366F1', glow: 'rgba(99,102,241,0.5)',
        tooltip: 'Issues aa-agent+jwt to delegate agents',
        detail: 'The Agent Server issues agent tokens (aa-agent+jwt) to delegate agents, binding the delegate\'s signing key via the cnf.jwk claim. The sub claim identifies the delegate, not the agent server. Keys are discoverable at {iss}/.well-known/aauth-agent.json.'
      }
    },
    {
      data: {
        id: 'delegate', label: 'Delegate', type: 'participant',
        color: '#06B6D4', glow: 'rgba(6,182,212,0.5)',
        tooltip: 'Receives aa-agent+jwt, signs with sig=jwt',
        detail: 'A delegate agent receives an aa-agent+jwt from the agent server and uses it to sign requests via sig=jwt. The resource verifies the JWT signature (issued by agent server) and then verifies the HTTP signature using the cnf.jwk bound in the token.'
      }
    },
    // Advanced pattern participants
    {
      data: {
        id: 'resource1', label: 'Resource 1', type: 'participant',
        color: '#10B981', glow: 'rgba(16,185,129,0.5)',
        tooltip: 'First resource in call/interaction chaining',
        detail: 'Resource 1 (R1) is the initial resource the agent contacts. In call chaining, R1 acts as an agent itself to call Resource 2, forwarding the delegation chain via nested act claims in auth tokens.'
      }
    },
    {
      data: {
        id: 'resource2', label: 'Resource 2', type: 'participant',
        color: '#10B981', glow: 'rgba(16,185,129,0.5)',
        tooltip: 'Second resource called by R1',
        detail: 'Resource 2 (R2) is called by R1 during call chaining. R2 sees R1 as the current actor (act.sub) acting on behalf of the original agent. R2 has its own Access Server (AS2) for policy enforcement.'
      }
    },
    {
      data: {
        id: 'as1', label: 'Access Server 1', type: 'participant',
        color: '#F59E0B', glow: 'rgba(245,158,11,0.5)',
        tooltip: 'AS for Resource 1',
        detail: 'Access Server 1 issues the initial auth token that grants the agent access to Resource 1.'
      }
    },
    {
      data: {
        id: 'as2', label: 'Access Server 2', type: 'participant',
        color: '#F59E0B', glow: 'rgba(245,158,11,0.5)',
        tooltip: 'AS for Resource 2',
        detail: 'Access Server 2 issues chained auth tokens for Resource 2, recording the full delegation chain in nested act claims.'
      }
    }
  ];

  // ─── TOKENS ────────────────────────────────────────────────
  // Tokens are first-class nodes because they have lifecycle:
  // issued → forwarded → verified → (accepted | rejected).
  // This cannot be represented as edge labels.

  const tokens = [
    {
      data: {
        id: 'token_agent', label: 'Agent Token', type: 'token',
        color: '#22D3EE', typ: 'aa-agent+jwt',
        tooltip: 'Binds signing key to agent identity (cnf.jwk)',
        detail: 'aa-agent+jwt — Issued by the agent server. Binds the agent\'s signing key via cnf.jwk. Claims: iss (agent server), sub (agent identifier), dwk (aauth-agent.json), jti, cnf, iat, exp, ps (optional Person Server URL).',
        example: '{"iss":"https://agent.example","sub":"aauth:local@agent.example","dwk":"aauth-agent.json","cnf":{"jwk":{...}},"ps":"https://ps.example"}'
      }
    },
    {
      data: {
        id: 'token_resource', label: 'Resource Token', type: 'token',
        color: '#34D399', typ: 'aa-resource+jwt',
        tooltip: 'Describes access needed; issued in 401 challenge',
        detail: 'aa-resource+jwt — Issued by the resource in a 401 challenge. The aud field determines who can exchange it: aud=PS (3-party) or aud=AS (4-party). Claims: iss, aud, dwk (aauth-resource.json), jti, agent, agent_jkt, scope, mission (optional {approver, s256}).',
        example: '{"iss":"https://api.example","aud":"https://as.example","agent":"aauth:local@agent.example","scope":"read","mission":{"approver":"https://ps.example","s256":"R9kN..."}}'
      }
    },
    {
      data: {
        id: 'token_auth', label: 'Auth Token', type: 'token',
        color: '#FBBF24', typ: 'aa-auth+jwt',
        tooltip: 'Grants agent access to resource; issued by PS or AS',
        detail: 'aa-auth+jwt — Issued by the PS (3-party) or AS (4-party). Binds the agent\'s signing key via cnf.jwk. In call chaining, carries nested act claims. Claims: iss, aud, dwk (aauth-access.json or aauth-person.json), jti, cnf, agent, act, scope, mission (optional).',
        example: '{"iss":"https://as.example","aud":"https://api.example","agent":"aauth:local@agent.example","act":{"sub":"aauth:local@agent.example"},"cnf":{"jwk":{...}},"scope":"read"}'
      }
    },
    {
      data: {
        id: 'token_opaque', label: 'Opaque Token', type: 'token',
        color: '#64748B', typ: 'string',
        tooltip: 'Simple opaque string; Resource-Managed mode only',
        detail: 'A simple opaque string (not a JWT) issued by the resource in Resource-Managed access mode via the AAuth-Access header. The resource is its own authority — no PS or AS involved. Used for subsequent requests without re-signing.'
      }
    }
  ];

  // ─── EDGES ─────────────────────────────────────────────────
  // Each edge carries:
  //   layer    — top-level filter (signing|access|mission|advanced)
  //   sublayer — sub-filter for progressive disclosure
  //   step     — temporal order within the flow (for interactive mode)
  //   detail   — rich description for sidebar panel
  //   tooltip  — one-liner for hover
  //
  // Edge IDs match the SCHEMA.md identifiers (S1, A1, M1, V1, etc.)
  // for traceability back to the validated spec.

  const edges = [

    // ═══ SIGNING LAYER ═══════════════════════════════════════
    // How an agent cryptographically proves who it is.
    // Built on RFC 9421 + Signature-Key draft.
    // AAuth profiles 4 of the 5 Signature-Key schemes.

    {
      data: {
        id: 'S1', source: 'agent', target: 'resource',
        label: 'Unsigned → 401',
        layer: 'signing', sublayer: 'signing', step: 1,
        tooltip: 'Agent sends unsigned request; resource challenges with Accept-Signature',
        detail: 'The agent sends an unsigned HTTP request. The resource returns 401 with an Accept-Signature header specifying sigkey=jkt (pseudonymous tier) or sigkey=uri (identity tier). This tells the agent which Signature-Key scheme to use.'
      }
    },
    {
      data: {
        id: 'S2', source: 'agent', target: 'resource',
        label: 'sig=hwk → 200',
        layer: 'signing', sublayer: 'signing', step: 2,
        tooltip: 'Pseudonymous: public key inline, no identity revealed',
        detail: 'Agent signs with sig=hwk — the Ed25519 public key is embedded inline in the Signature-Key header. Self-contained verification: no network fetches, no issuer, no identity. The resource learns a stable JWK Thumbprint for rate-limiting but nothing about who the agent is.'
      }
    },
    {
      data: {
        id: 'S3', source: 'agent', target: 'resource',
        label: 'sig=jkt-jwt → 200',
        layer: 'signing', sublayer: 'signing', step: 2,
        tooltip: 'Hardware-backed: enclave key delegates to ephemeral key',
        detail: 'Agent signs with sig=jkt-jwt — a hardware enclave key signs a JWT delegating to a fast ephemeral key via the cnf claim. Requests are signed at line rate by the ephemeral key. The resource learns a stable JWK Thumbprint URN of the enclave key (pseudonymous, TOFU).'
      }
    },
    {
      data: {
        id: 'S4', source: 'agent', target: 'resource',
        label: 'sig=jwks_uri → 200',
        layer: 'signing', sublayer: 'signing', step: 2,
        tooltip: 'Identity: agent URI + kid, verifier fetches JWKS',
        detail: 'Agent signs with sig=jwks_uri — Signature-Key references the agent\'s HTTPS identifier URI and kid. The resource fetches {id}/.well-known/aauth-agent.json, reads jwks_uri, resolves the kid, and verifies the signature. This establishes full cryptographic identity.'
      }
    },
    {
      data: {
        id: 'S5', source: 'resource', target: 'agent',
        label: 'Fetch well-known + JWKS',
        layer: 'signing', sublayer: 'signing', step: 3,
        tooltip: 'Resource discovers agent keys via .well-known metadata',
        detail: 'For sig=jwks_uri, the resource fetches {id}/.well-known/aauth-agent.json to discover the agent\'s jwks_uri endpoint, then fetches the JWKS and resolves the kid referenced in Signature-Key. This is how AAuth establishes identity without pre-registration.'
      }
    },
    {
      data: {
        id: 'S6', source: 'agent_server', target: 'delegate',
        label: 'Issues aa-agent+jwt',
        layer: 'signing', sublayer: 'signing', step: 1,
        tooltip: 'Agent server binds delegate key via cnf.jwk',
        detail: 'The agent server issues an aa-agent+jwt whose cnf.jwk is the delegate\'s own public key. The sub claim identifies the delegate (e.g. aauth:delegate@agent.example), not the agent server. The token type (typ: aa-agent+jwt) identifies this as an AAuth agent token.'
      }
    },
    {
      data: {
        id: 'S7', source: 'delegate', target: 'resource',
        label: 'sig=jwt (agent token) → 200',
        layer: 'signing', sublayer: 'signing', step: 2,
        tooltip: 'Delegate signs with sig=jwt embedding aa-agent+jwt',
        detail: 'The delegate embeds the aa-agent+jwt in the Signature-Key header using sig=jwt. The resource verifies: (1) the JWT signature using the agent server\'s JWKS (iss + dwk), (2) the HTTP message signature using cnf.jwk from the token. This proves the delegate holds the bound key.'
      }
    },

    // ═══ ACCESS LAYER ════════════════════════════════════════
    // How a protected API decides what the agent may do.
    // Five modes, each adding parties and capabilities.
    // Progressive adoption: each mode is independently deployable.

    // ─── Identity-Based (2-party) ────────────────────────────
    {
      data: {
        id: 'A1', source: 'agent', target: 'resource',
        label: 'sig=jwt → identity check → 200',
        layer: 'access', sublayer: 'access-identity', step: 1,
        tooltip: 'Resource verifies agent identity and applies policy directly',
        detail: 'The simplest access mode. Agent signs with sig=jwt (agent token in Signature-Key). Resource resolves iss+dwk to fetch agent server JWKS, verifies the JWT, confirms the HTTP signature matches cnf.jwk, and applies its own identity-based policy (e.g. allowlist). No token exchange, no PS, no AS.'
      }
    },
    {
      data: {
        id: 'A2', source: 'resource', target: 'agent',
        label: 'Fetch agent JWKS',
        layer: 'access', sublayer: 'access-identity', step: 1,
        tooltip: 'Resource fetches JWKS to verify agent token',
        detail: 'Resource fetches {iss}/.well-known/{dwk} (e.g. agent.example/.well-known/aauth-agent.json) to discover the agent server\'s JWKS URI and verify the agent token signature.'
      }
    },

    // ─── Resource-Managed (2-party) ──────────────────────────
    {
      data: {
        id: 'A3', source: 'agent', target: 'resource',
        label: 'sig=jwt → 200 + opaque token',
        layer: 'access', sublayer: 'access-resource', step: 1,
        tooltip: 'Resource verifies identity and issues AAuth-Access token',
        detail: 'Resource verifies the agent\'s identity (same as Identity-Based), then issues an opaque AAuth-Access token in the response header. This token is a simple string — not a JWT — minted by the resource for subsequent calls. The resource is its own authority.'
      }
    },
    {
      data: {
        id: 'A4', source: 'agent', target: 'resource',
        label: 'AAuth-Access → 200',
        layer: 'access', sublayer: 'access-resource', step: 2,
        tooltip: 'Subsequent request with opaque token, no re-signing',
        detail: 'Agent includes the opaque token in the Authorization header for subsequent requests. No HTTP message signature needed — the opaque token serves as a session credential. The authorization component MUST be in covered components when presenting an AAuth-Access token.'
      }
    },

    // ─── PS-Managed (3-party) ────────────────────────────────
    {
      data: {
        id: 'A5', source: 'agent', target: 'resource',
        label: 'sig=jwt → 401 + resource token (aud=PS)',
        layer: 'access', sublayer: 'access-ps', step: 1,
        tooltip: 'Resource issues aa-resource+jwt with aud = PS URL',
        detail: 'Agent signs request with sig=jwt. Resource returns 401 + aa-resource+jwt. KEY DIFFERENCE from Federated: aud = PS URL (not AS URL). Because aud=PS, the PS handles token issuance directly — no Access Server needed.'
      }
    },
    {
      data: {
        id: 'A6', source: 'agent', target: 'ps',
        label: 'POST resource token to PS',
        layer: 'access', sublayer: 'access-ps', step: 2,
        tooltip: 'Agent forwards aa-resource+jwt to PS /token endpoint',
        detail: 'Agent POSTs the aa-resource+jwt to the PS\'s token endpoint. The PS verifies the resource token, confirms the agent\'s identity via the agent token, and applies its own policy.'
      }
    },
    {
      data: {
        id: 'A7', source: 'ps', target: 'agent',
        label: 'aa-auth+jwt (iss=PS)',
        layer: 'access', sublayer: 'access-ps', step: 3,
        tooltip: 'PS issues auth token directly — no AS involved',
        detail: 'PS issues aa-auth+jwt directly (iss = PS URL, dwk = aauth-person.json). The auth token binds the agent\'s signing key via cnf.jwk and includes scope from the resource token. No Access Server is involved in this mode.'
      }
    },
    {
      data: {
        id: 'A8', source: 'agent', target: 'resource',
        label: 'Present aa-auth+jwt → 200',
        layer: 'access', sublayer: 'access-ps', step: 4,
        tooltip: 'Agent retries with auth token; resource grants access',
        detail: 'Agent retries the original request with the aa-auth+jwt in Signature-Key (sig=jwt). Resource verifies the auth token\'s JWT signature via PS\'s JWKS (iss+dwk), confirms the HTTP signature matches cnf.jwk, and grants access.'
      }
    },

    // ─── Federated (4-party) ─────────────────────────────────
    {
      data: {
        id: 'A9', source: 'agent', target: 'resource',
        label: 'sig=jwt → 401 + resource token (aud=AS)',
        layer: 'access', sublayer: 'access-federated', step: 1,
        tooltip: 'Resource issues aa-resource+jwt with aud = AS URL',
        detail: 'Agent signs with sig=jwt. Resource returns 401 + aa-resource+jwt with aud = AS URL. Only the AS can honour this token. The agent token\'s ps claim tells the ecosystem which Person Server represents this agent.'
      }
    },
    {
      data: {
        id: 'A10', source: 'agent', target: 'ps',
        label: 'POST resource token to PS',
        layer: 'access', sublayer: 'access-federated', step: 2,
        tooltip: 'Agent forwards aa-resource+jwt to PS',
        detail: 'Agent POSTs the resource token to the PS. The PS will federate to the AS on the agent\'s behalf — the agent never contacts the AS directly.'
      }
    },
    {
      data: {
        id: 'A11', source: 'ps', target: 'as',
        label: 'Federate to AS /token',
        layer: 'access', sublayer: 'access-federated', step: 3,
        tooltip: 'PS signs and forwards resource + agent tokens to AS',
        detail: 'PS federates to the AS: signs the request with its own jwks_uri identity, forwards the resource token and agent token. The AS honours only trusted_person_servers — this is the trust boundary between the PS and AS domains.'
      }
    },
    {
      data: {
        id: 'A12', source: 'as', target: 'ps',
        label: 'aa-auth+jwt (iss=AS)',
        layer: 'access', sublayer: 'access-federated', step: 4,
        tooltip: 'AS mints auth token bound to agent\'s cnf.jwk',
        detail: 'AS verifies the resource token, the agent token, and the PS\'s identity. It mints aa-auth+jwt (iss = AS URL, dwk = aauth-access.json) bound to the agent\'s cnf.jwk with act.sub = agent identifier.'
      }
    },
    {
      data: {
        id: 'A13', source: 'ps', target: 'agent',
        label: 'Returns aa-auth+jwt',
        layer: 'access', sublayer: 'access-federated', step: 5,
        tooltip: 'PS relays auth token back to agent',
        detail: 'PS relays the AS-issued auth token back to the agent. The agent now has a token that proves its identity and authorization to the resource.'
      }
    },
    {
      data: {
        id: 'A14', source: 'agent', target: 'resource',
        label: 'Present aa-auth+jwt → 200',
        layer: 'access', sublayer: 'access-federated', step: 6,
        tooltip: 'Agent retries with auth token; resource grants access',
        detail: 'Agent retries with aa-auth+jwt. Resource verifies via AS\'s JWKS (iss+dwk=aauth-access.json), confirms HTTP signature matches cnf.jwk, and grants access.'
      }
    },

    // ─── User Delegation (5-party, deferred) ─────────────────
    {
      data: {
        id: 'A15', source: 'agent', target: 'resource',
        label: 'sig=jwks_uri → 401 + resource token',
        layer: 'access', sublayer: 'access-delegation', step: 1,
        tooltip: 'Same 401 challenge as Federated mode',
        detail: 'Agent signs with sig=jwks_uri (agent identity). Resource issues 401 + aa-resource+jwt with aud=AS. The flow starts like Federated, but the AS will defer issuance pending user consent.'
      }
    },
    {
      data: {
        id: 'A16', source: 'agent', target: 'ps',
        label: 'POST resource token to PS',
        layer: 'access', sublayer: 'access-delegation', step: 2,
        tooltip: 'Agent forwards resource token',
        detail: 'Agent forwards the resource token to the PS for federation to the AS.'
      }
    },
    {
      data: {
        id: 'A17', source: 'ps', target: 'as',
        label: 'Federate to AS /token',
        layer: 'access', sublayer: 'access-delegation', step: 3,
        tooltip: 'PS forwards to AS',
        detail: 'PS federates to the AS. The AS determines user consent is required before issuing the auth token.'
      }
    },
    {
      data: {
        id: 'A18', source: 'as', target: 'ps',
        label: '202 + pending + interaction URL',
        layer: 'access', sublayer: 'access-delegation', step: 4,
        tooltip: 'AS defers — requires user consent',
        detail: 'AS returns 202 Accepted with a pending URL (for polling) and an interaction URL (for the user to visit and approve). This is AAuth\'s async-by-design pattern: 202 + polling handles consent, approvals, and headless agents with one pattern.'
      }
    },
    {
      data: {
        id: 'A19', source: 'ps', target: 'agent',
        label: '202 + pending + interaction URL',
        layer: 'access', sublayer: 'access-delegation', step: 5,
        tooltip: 'PS relays deferred response to agent',
        detail: 'PS relays the 202 response to the agent, including the pending URL for polling and the interaction URL for the user.'
      }
    },
    {
      data: {
        id: 'A20', source: 'user', target: 'as',
        label: 'Open interaction URL → approve',
        layer: 'access', sublayer: 'access-delegation', step: 6,
        tooltip: 'User visits interaction URL, reviews scope, approves',
        detail: 'User opens the interaction URL in a browser, authenticates, reviews the requested scope and agent identity, and approves consent. The AS records the approval and releases the auth token on the next poll.'
      }
    },
    {
      data: {
        id: 'A21', source: 'agent', target: 'ps',
        label: 'Poll → 202 (waiting)',
        layer: 'access', sublayer: 'access-delegation', step: 7,
        tooltip: 'Agent polls pending URL while user decides',
        detail: 'Agent polls the pending URL. While the user has not yet approved, the PS returns 202 (still pending). The agent continues polling at a reasonable interval.'
      }
    },
    {
      data: {
        id: 'A22', source: 'agent', target: 'ps',
        label: 'Poll → 200 + aa-auth+jwt',
        layer: 'access', sublayer: 'access-delegation', step: 8,
        tooltip: 'After user approval, PS returns auth token',
        detail: 'After the user approves at the AS, the next poll returns 200 with the aa-auth+jwt. The agent now has authorization to access the resource.'
      }
    },
    {
      data: {
        id: 'A23', source: 'agent', target: 'resource',
        label: 'Present aa-auth+jwt → 200',
        layer: 'access', sublayer: 'access-delegation', step: 9,
        tooltip: 'Agent retries with auth token',
        detail: 'Agent retries the original request with the auth token. Resource verifies and grants access.'
      }
    },

    // ═══ MISSION LAYER ═══════════════════════════════════════
    // Optional governance: the agent states intent, the user
    // approves, and every access is evaluated in that context.
    // The s256 fingerprint flows unchanged through every token.

    // ─── Proposal & Approval ─────────────────────────────────
    {
      data: {
        id: 'M1', source: 'agent', target: 'ps',
        label: 'GET well-known metadata',
        layer: 'mission', sublayer: 'mission-lifecycle', step: 1,
        tooltip: 'Discover PS mission_endpoint, interaction_endpoint, token_endpoint',
        detail: 'Agent fetches {ps}/.well-known/aauth-person.json to discover the mission_endpoint (where proposals are POSTed), interaction_endpoint (for completion), and token_endpoint (for resource token exchange).'
      }
    },
    {
      data: {
        id: 'M2', source: 'agent', target: 'ps',
        label: 'POST /mission → 202',
        layer: 'mission', sublayer: 'mission-lifecycle', step: 2,
        tooltip: 'Agent proposes: markdown description + tools list',
        detail: 'Agent POSTs a mission proposal: a Markdown description of what it intends to accomplish plus a list of tools it will use. The PS returns 202 with a pending URL (for polling) and an interaction URL (for user review). Missions are immutable once approved.'
      }
    },
    {
      data: {
        id: 'M3', source: 'ps', target: 'user',
        label: 'Present mission for review',
        layer: 'mission', sublayer: 'mission-lifecycle', step: 3,
        tooltip: 'User opens interaction URL to review description + tools',
        detail: 'The PS presents the mission to the user at the interaction URL. The user sees the Markdown description and the list of tools the agent intends to use. The user can approve or decline.'
      }
    },
    {
      data: {
        id: 'M4', source: 'user', target: 'ps',
        label: 'Approve mission',
        layer: 'mission', sublayer: 'mission-lifecycle', step: 4,
        tooltip: 'PS computes s256 = SHA-256(approved_blob_bytes)',
        detail: 'User approves. The PS computes s256 = SHA-256 of the approved mission blob bytes. The mission blob contains: approver (PS URL), agent identifier, approved_at timestamp, description (Markdown), approved_tools array, and capabilities. The s256 is the immutable fingerprint.'
      }
    },
    {
      data: {
        id: 'M5', source: 'agent', target: 'ps',
        label: 'Poll → 200 + mission blob',
        layer: 'mission', sublayer: 'mission-lifecycle', step: 5,
        tooltip: 'Agent receives mission blob + AAuth-Mission header with s256',
        detail: 'Agent polls the pending URL. PS returns 200 with the approved mission blob and an AAuth-Mission header containing approver URL and s256. The agent now includes AAuth-Mission on every subsequent request and adds aauth-mission to signed components.'
      }
    },

    // ─── Resource Access with Mission ────────────────────────
    {
      data: {
        id: 'M6', source: 'agent', target: 'resource',
        label: 'POST /authorize + AAuth-Mission → resource token',
        layer: 'mission', sublayer: 'mission-access', step: 1,
        tooltip: 'Proactive authorization with mission context',
        detail: 'Agent proactively requests authorization via POST /authorize. The AAuth-Mission header carries approver + s256. The aauth-mission component is included in the HTTP signature per spec. Resource issues aa-resource+jwt with mission:{approver, s256} stamped as opaque metadata. Resource does NOT evaluate mission content.'
      }
    },
    {
      data: {
        id: 'M7', source: 'agent', target: 'ps',
        label: 'POST resource token to PS',
        layer: 'mission', sublayer: 'mission-access', step: 2,
        tooltip: 'Resource token carries mission claim',
        detail: 'Agent forwards the resource token (which contains mission:{approver, s256}) to the PS\'s token endpoint.'
      }
    },
    {
      data: {
        id: 'M8', source: 'ps', target: 'as',
        label: 'Federate with mission claim',
        layer: 'mission', sublayer: 'mission-access', step: 3,
        tooltip: 'Mission claim preserved through federation',
        detail: 'PS federates to the AS. The mission claim is preserved through the federation — the AS receives it in the resource token and stamps it into the auth token.'
      }
    },
    {
      data: {
        id: 'M9', source: 'as', target: 'ps',
        label: 'Auth token (mission intact)',
        layer: 'mission', sublayer: 'mission-access', step: 4,
        tooltip: 'AS preserves mission.s256 in aa-auth+jwt',
        detail: 'AS mints aa-auth+jwt with the mission claim intact: mission:{approver, s256} is copied from the resource token. The s256 chain is now: proposal → AAuth-Mission header → resource token → auth token.'
      }
    },
    {
      data: {
        id: 'M10', source: 'ps', target: 'agent',
        label: 'Return auth token',
        layer: 'mission', sublayer: 'mission-access', step: 5,
        tooltip: 'Relay auth token back to agent',
        detail: 'PS relays the auth token (with mission claim) back to the agent.'
      }
    },
    {
      data: {
        id: 'M11', source: 'agent', target: 'resource',
        label: 'Auth token + AAuth-Mission → 200',
        layer: 'mission', sublayer: 'mission-access', step: 6,
        tooltip: 'End-to-end s256 chain verified',
        detail: 'Agent presents the auth token with the AAuth-Mission header. Resource compares AAuth-Mission s256 with the auth token\'s mission.s256 — end-to-end chain verified. If they match, access is granted with full mission provenance.'
      }
    },

    // ─── Out-of-Bounds ───────────────────────────────────────
    {
      data: {
        id: 'M12', source: 'agent', target: 'resource',
        label: 'POST /authorize (out-of-scope) → resource token',
        layer: 'mission', sublayer: 'mission-oob', step: 1,
        tooltip: 'Resource issues token — does NOT evaluate mission scope',
        detail: 'Agent requests authorization for a scope outside the approved mission. The resource evaluates against its OWN scope policy and issues a resource token — it does not have the mission description or tool list. Only the PS has those. Mission is stamped as opaque metadata.'
      }
    },
    {
      data: {
        id: 'M13', source: 'agent', target: 'ps',
        label: 'POST resource token to PS',
        layer: 'mission', sublayer: 'mission-oob', step: 2,
        tooltip: 'PS evaluates against mission scope — detects mismatch',
        detail: 'Agent forwards the resource token to the PS. The PS evaluates the requested scope against the mission\'s approved scope and tool list. It detects the mismatch — this scope was not part of the approved mission.'
      }
    },
    {
      data: {
        id: 'M14', source: 'ps', target: 'user',
        label: '202 + consent request',
        layer: 'mission', sublayer: 'mission-oob', step: 3,
        tooltip: 'PS asks user for out-of-scope consent via interaction URL',
        detail: 'PS returns 202 with requirement=interaction, asking the user to consent to the out-of-scope access. The user sees what the agent is requesting beyond its approved mission.'
      }
    },
    {
      data: {
        id: 'M15', source: 'user', target: 'ps',
        label: 'Decline consent',
        layer: 'mission', sublayer: 'mission-oob', step: 4,
        tooltip: 'PS returns 403 access_denied; agent must propose new mission',
        detail: 'User declines the out-of-scope consent. PS returns 403 access_denied to the agent. The original mission M1 remains active for its own scope. The agent must propose a new mission M2 with a new s256 to cover the broader scope.'
      }
    },
    {
      data: {
        id: 'M16', source: 'agent', target: 'ps',
        label: 'POST /mission (new M2)',
        layer: 'mission', sublayer: 'mission-oob', step: 5,
        tooltip: 'Agent proposes new mission with broader scope and new s256',
        detail: 'Agent proposes a new mission M2 covering the broader scope. This enters the standard proposal & approval flow. If approved, M2 gets its own s256. Missions are immutable — you cannot extend an existing mission.'
      }
    },

    // ─── Completion ──────────────────────────────────────────
    {
      data: {
        id: 'M17', source: 'agent', target: 'ps',
        label: 'POST /interaction (completion) → 202',
        layer: 'mission', sublayer: 'mission-completion', step: 1,
        tooltip: 'Agent submits markdown summary referencing mission by s256',
        detail: 'Agent POSTs to the PS\'s interaction_endpoint with type="completion", a Markdown summary of what was accomplished, and the mission reference (approver + s256). PS returns 202 because user acceptance requires human interaction.'
      }
    },
    {
      data: {
        id: 'M18', source: 'ps', target: 'user',
        label: 'Present completion summary',
        layer: 'mission', sublayer: 'mission-completion', step: 2,
        tooltip: 'User reviews what the agent accomplished',
        detail: 'PS presents the agent\'s completion summary to the user. The user can accept (terminating the mission) or respond with follow-up questions via clarification, keeping the mission active.'
      }
    },
    {
      data: {
        id: 'M19', source: 'user', target: 'ps',
        label: 'Accept → mission terminated',
        layer: 'mission', sublayer: 'mission-completion', step: 3,
        tooltip: 'PS terminates mission; log retained for audit',
        detail: 'User accepts the completion. PS terminates the mission. The mission log is retained for audit. Any subsequent audit POSTs for this mission will receive 403 mission_terminated.'
      }
    },

    // ─── Audit ───────────────────────────────────────────────
    {
      data: {
        id: 'M20', source: 'agent', target: 'ps',
        label: 'POST /audit → 201',
        layer: 'mission', sublayer: 'mission-audit', step: 1,
        tooltip: 'Fire-and-forget action log; requires mission context',
        detail: 'Agent POSTs to the PS\'s audit endpoint: mission (approver + s256), action (e.g. "FeedbackReader.read"), and optional description, parameters, result. PS returns 201 Created. Fire-and-forget: agent SHOULD NOT block on the response. Audit requires a mission — there is no audit outside mission context.'
      }
    },
    {
      data: {
        id: 'M21', source: 'agent', target: 'ps',
        label: 'POST /audit (terminated) → 403',
        layer: 'mission', sublayer: 'mission-audit', step: 2,
        tooltip: 'Late audits after mission termination are rejected',
        detail: 'If the mission has been terminated (user accepted completion), any subsequent audit POSTs return 403 with error mission_terminated.'
      }
    },

    // ═══ ADVANCED PATTERNS ═══════════════════════════════════
    // Multi-resource, clarification, and interaction chaining.
    // These compose the building blocks from earlier layers.

    // ─── Call Chaining ───────────────────────────────────────
    {
      data: {
        id: 'V1', source: 'agent', target: 'resource1',
        label: 'Auth token (AS1) → R1',
        layer: 'advanced', sublayer: 'advanced-chain', step: 1,
        tooltip: 'Agent accesses R1; R1 needs data from R2',
        detail: 'Agent accesses R1 using its AS1-issued auth token (sig=jwt). R1 processes the request but needs data from R2 to fulfil it.'
      }
    },
    {
      data: {
        id: 'V2', source: 'resource1', target: 'resource2',
        label: 'R1 calls R2 → 401 + resource token',
        layer: 'advanced', sublayer: 'advanced-chain', step: 2,
        tooltip: 'R1 acts as an agent to R2',
        detail: 'R1 calls R2 as an agent. R2 returns 401 + aa-resource+jwt (aud=AS2). R1 now needs to exchange this resource token for an auth token via the PS.'
      }
    },
    {
      data: {
        id: 'V3', source: 'resource1', target: 'ps',
        label: 'R2 resource token + upstream auth to PS',
        layer: 'advanced', sublayer: 'advanced-chain', step: 3,
        tooltip: 'PS federates on R1\'s behalf',
        detail: 'R1 sends the R2 resource token plus the upstream auth token (proving the original agent\'s delegation) to the PS. The PS federates on R1\'s behalf to AS2.'
      }
    },
    {
      data: {
        id: 'V4', source: 'ps', target: 'as2',
        label: 'Federate for R2 auth token',
        layer: 'advanced', sublayer: 'advanced-chain', step: 4,
        tooltip: 'PS forwards to AS2',
        detail: 'PS forwards the R2 resource token and delegation context to AS2 for auth token issuance.'
      }
    },
    {
      data: {
        id: 'V5', source: 'as2', target: 'ps',
        label: 'Chained auth token (nested act)',
        layer: 'advanced', sublayer: 'advanced-chain', step: 5,
        tooltip: 'Auth token records full delegation chain',
        detail: 'AS2 issues a chained aa-auth+jwt with nested act claims: the current actor is R1 (act.sub = R1 identifier), acting on behalf of the original agent (act.act.sub = agent identifier). R2 can see the full delegation chain.'
      }
    },
    {
      data: {
        id: 'V6', source: 'ps', target: 'resource1',
        label: 'Return chained auth token',
        layer: 'advanced', sublayer: 'advanced-chain', step: 6,
        tooltip: 'PS relays chained auth token to R1',
        detail: 'PS relays the chained auth token back to R1.'
      }
    },
    {
      data: {
        id: 'V7', source: 'resource1', target: 'resource2',
        label: 'R1 → R2 with chained token → 200',
        layer: 'advanced', sublayer: 'advanced-chain', step: 7,
        tooltip: 'R2 sees R1 as actor, agent as original',
        detail: 'R1 accesses R2 with the chained auth token. R2 verifies the token, sees R1 as the current actor and the original agent in the delegation chain, and grants access.'
      }
    },
    {
      data: {
        id: 'V8', source: 'resource1', target: 'agent',
        label: 'Combined result → agent',
        layer: 'advanced', sublayer: 'advanced-chain', step: 8,
        tooltip: 'Agent receives merged response from R1 + R2',
        detail: 'R1 combines its own data with R2\'s response and returns the merged result to the agent.'
      }
    },

    // ─── Clarification Chat ──────────────────────────────────
    {
      data: {
        id: 'V9', source: 'agent', target: 'resource',
        label: 'Request + Capabilities: clarification → 401',
        layer: 'advanced', sublayer: 'advanced-clarification', step: 1,
        tooltip: 'Agent declares clarification capability',
        detail: 'Agent signs request with AAuth-Capabilities: clarification, signalling it can answer questions. Resource returns 401 + resource token for exchange at the AS.'
      }
    },
    {
      data: {
        id: 'V10', source: 'agent', target: 'as',
        label: 'POST resource token → 202 + clarification',
        layer: 'advanced', sublayer: 'advanced-clarification', step: 2,
        tooltip: 'AS poses a question before user consent',
        detail: 'Agent exchanges the resource token at the AS. The AS returns 202 with AAuth-Requirement: requirement=clarification, posing a question the agent must answer before the AS presents consent to the user.'
      }
    },
    {
      data: {
        id: 'V11', source: 'agent', target: 'as',
        label: 'POST clarification answer → 202',
        layer: 'advanced', sublayer: 'advanced-clarification', step: 3,
        tooltip: 'Agent answers; AS now needs user consent',
        detail: 'Agent POSTs its clarification answer. The AS now has richer context and proceeds to require user consent (requirement=interaction).'
      }
    },
    {
      data: {
        id: 'V12', source: 'as', target: 'user',
        label: 'Consent UI + clarification Q&A',
        layer: 'advanced', sublayer: 'advanced-clarification', step: 4,
        tooltip: 'User sees identity, scope, and agent\'s clarification',
        detail: 'The AS presents a consent UI to the user showing the agent\'s identity, requested scope, and the clarification question + agent\'s answer. This gives the user richer context for their consent decision.'
      }
    },
    {
      data: {
        id: 'V13', source: 'user', target: 'as',
        label: 'Approve consent',
        layer: 'advanced', sublayer: 'advanced-clarification', step: 5,
        tooltip: 'User approves with full context',
        detail: 'User approves consent having seen the clarification exchange. The AS releases the auth token on the next poll.'
      }
    },
    {
      data: {
        id: 'V14', source: 'agent', target: 'as',
        label: 'Poll → 200 + aa-auth+jwt',
        layer: 'advanced', sublayer: 'advanced-clarification', step: 6,
        tooltip: 'Agent receives auth token after user approval',
        detail: 'Agent polls the pending URL and receives the auth token after the user has approved consent.'
      }
    },

    // ─── Interaction Chaining ────────────────────────────────
    {
      data: {
        id: 'V15', source: 'agent', target: 'resource1',
        label: 'Auth token → R1 → 202 bubble',
        layer: 'advanced', sublayer: 'advanced-interaction', step: 1,
        tooltip: 'R1 needs R2 consent; bubbles 202 back to agent',
        detail: 'Agent accesses R1 with auth token. R1 needs data from R2, but R2\'s AS requires user consent. Instead of blocking, R1 returns its own 202 to the agent with a pending URL (for polling) and an interaction URL that redirects through R1 to AS2.'
      }
    },
    {
      data: {
        id: 'V16', source: 'resource1', target: 'resource2',
        label: 'R1 calls R2 → 401 + resource token',
        layer: 'advanced', sublayer: 'advanced-interaction', step: 2,
        tooltip: 'R1 acts as agent to R2',
        detail: 'R1 calls R2. R2 returns 401 + resource token (aud=AS2).'
      }
    },
    {
      data: {
        id: 'V17', source: 'resource1', target: 'as2',
        label: 'R1 → AS2 → 202 + interaction URL',
        layer: 'advanced', sublayer: 'advanced-interaction', step: 3,
        tooltip: 'AS2 requires user consent',
        detail: 'R1 submits R2\'s resource token to AS2. AS2 returns 202 with an interaction URL for user consent.'
      }
    },
    {
      data: {
        id: 'V18', source: 'user', target: 'as2',
        label: 'Interaction URL → approve at AS2',
        layer: 'advanced', sublayer: 'advanced-interaction', step: 4,
        tooltip: 'User visits R1\'s /interact, redirected to AS2 consent',
        detail: 'User visits the interaction URL (hosted at R1\'s /interact endpoint), which redirects to AS2\'s consent page. User approves R1 accessing R2 on the agent\'s behalf.'
      }
    },
    {
      data: {
        id: 'V19', source: 'resource1', target: 'as2',
        label: 'R1 polls AS2 → auth token',
        layer: 'advanced', sublayer: 'advanced-interaction', step: 5,
        tooltip: 'R1 gets chained auth token for R2',
        detail: 'R1 polls AS2. After user consent, AS2 returns the chained auth token for R2.'
      }
    },
    {
      data: {
        id: 'V20', source: 'resource1', target: 'resource2',
        label: 'R1 → R2 with chained token → 200',
        layer: 'advanced', sublayer: 'advanced-interaction', step: 6,
        tooltip: 'R1 completes R2 call',
        detail: 'R1 accesses R2 with the chained auth token. R2 grants access.'
      }
    },
    {
      data: {
        id: 'V21', source: 'agent', target: 'resource1',
        label: 'Agent polls R1 → 200 combined result',
        layer: 'advanced', sublayer: 'advanced-interaction', step: 7,
        tooltip: 'Agent gets final merged result',
        detail: 'Agent polls R1. R1 returns the combined result from both R1 and R2 data.'
      }
    }
  ];

  // ─── CONCEPT METADATA (sidebar only) ──────────────────────
  // These do NOT appear as graph nodes — they populate the
  // sidebar detail panels when edges/nodes reference them.

  const concepts = {
    http_sig: {
      label: 'HTTP Message Signatures (RFC 9421)',
      detail: 'Every AAuth request carries three headers: Signature-Key (scheme + key material), Signature-Input (covered components + params), Signature (the actual signature). AAuth requires @method, @authority, @path, and signature-key as base covered components. Algorithms: Ed25519 (MUST), ECDSA P-256 deterministic (SHOULD). Validity window: 60s default.'
    },
    schemes: {
      label: 'Signature-Key Schemes',
      detail: 'AAuth profiles 4 of 5 Signature-Key draft schemes. Pseudonymous tier: sig=hwk (inline key), sig=jkt-jwt (hardware delegation). Identity tier: sig=jwks_uri (HTTPS discovery), sig=jwt (JWT confirmation key). Not used: sig=x509 (PKI).'
    },
    dwk: {
      label: 'Well-Known Discovery (dwk)',
      detail: 'Four dwk values define key discovery endpoints: aauth-agent.json (agent server), aauth-resource.json (resource), aauth-person.json (person server), aauth-access.json (access server). Each is fetched at {iss}/.well-known/{dwk}.'
    },
    errors: {
      label: 'Error Model (Signature-Error)',
      detail: 'Verification failures return 401 + Signature-Error header. Codes: invalid_request, invalid_input (+ required_input), invalid_signature, unsupported_algorithm (+ supported_algorithms), invalid_key, unknown_key, invalid_jwt, expired_jwt. Policy denials return 403 (no Signature-Error).'
    },
    mission_blob: {
      label: 'Mission Blob',
      detail: 'The approved mission object: approver (PS URL), agent (aauth: URI), approved_at (ISO timestamp), description (Markdown), approved_tools (array of {name, description}), capabilities (e.g. interaction, clarification). The s256 = SHA-256 of the blob bytes is the immutable fingerprint.'
    },
    progressive_adoption: {
      label: 'Progressive Adoption',
      detail: 'Each access mode is independently deployable. A resource can start with Identity-Based access and later add a PS or AS without changing the agent\'s signing approach. The main change is what the resource returns in its 401 challenge and which party mints the auth token.'
    }
  };

  // ─── LAYER DEFINITIONS ─────────────────────────────────────
  const layers = {
    signing:  { label: 'Signing',  color: '#94A3B8', icon: '🔑' },
    access:   { label: 'Access',   color: '#06B6D4', icon: '🔓' },
    mission:  { label: 'Mission',  color: '#8B5CF6', icon: '🎯' },
    advanced: { label: 'Advanced', color: '#F59E0B', icon: '⚡' }
  };

  const sublayers = {
    'signing':                { label: 'All Signing',          parent: 'signing' },
    'access-identity':        { label: 'Identity-Based',       parent: 'access' },
    'access-resource':        { label: 'Resource-Managed',     parent: 'access' },
    'access-ps':              { label: 'PS-Managed',           parent: 'access' },
    'access-federated':       { label: 'Federated',            parent: 'access' },
    'access-delegation':      { label: 'User Delegation',      parent: 'access' },
    'mission-lifecycle':      { label: 'Proposal & Approval',  parent: 'mission' },
    'mission-access':         { label: 'Resource Access',      parent: 'mission' },
    'mission-oob':            { label: 'Out-of-Bounds',        parent: 'mission' },
    'mission-completion':     { label: 'Completion',           parent: 'mission' },
    'mission-audit':          { label: 'Audit',                parent: 'mission' },
    'advanced-chain':         { label: 'Call Chaining',        parent: 'advanced' },
    'advanced-clarification': { label: 'Clarification Chat',   parent: 'advanced' },
    'advanced-interaction':   { label: 'Interaction Chaining', parent: 'advanced' }
  };

  // ─── PUBLIC API ────────────────────────────────────────────
  // Cytoscape expects { nodes: [...], edges: [...] }
  return {
    nodes: [...participants, ...tokens],
    edges: edges.map(e => ({ data: { ...e.data, id: e.data.id } })),
    concepts,
    layers,
    sublayers,

    // Helpers for filter/interaction logic
    getEdgesByLayer(layer) {
      return edges.filter(e => e.data.layer === layer);
    },
    getEdgesBySublayer(sublayer) {
      return edges.filter(e => e.data.sublayer === sublayer);
    },
    getEdgesByStep(sublayer) {
      return edges
        .filter(e => e.data.sublayer === sublayer)
        .sort((a, b) => a.data.step - b.data.step);
    },
    getParticipantsForSublayer(sublayer) {
      const sub = edges.filter(e => e.data.sublayer === sublayer);
      const ids = new Set();
      sub.forEach(e => { ids.add(e.data.source); ids.add(e.data.target); });
      return [...ids];
    }
  };
})();
