// js/graph.js
// Cytoscape initialization, styling, and layout
// Consumes AAuthGraph from data/graph.js

const GraphEngine = (() => {
  let cy = null;

  // ─── Preset positions ──────────────────────────────────────
  // Mirrors AAuth spec diagrams: Agent left, Resource center,
  // PS/AS right, User top. Token nodes orbit their issuers.
  // Advanced nodes positioned below core when active.

  const POSITIONS = {
    // Core participants
    agent:        { x: 200,  y: 350 },
    resource:     { x: 500,  y: 350 },
    ps:           { x: 800,  y: 350 },
    as:           { x: 1050, y: 350 },
    user:         { x: 800,  y: 120 },

    // Signing-specific
    agent_server: { x: 200,  y: 550 },
    delegate:     { x: 350,  y: 550 },

    // Tokens (orbit their issuers)
    token_agent:    { x: 200,  y: 200 },
    token_resource: { x: 500,  y: 200 },
    token_auth:     { x: 1050, y: 200 },
    token_opaque:   { x: 500,  y: 500 },

    // Advanced participants
    resource1: { x: 400, y: 550 },
    resource2: { x: 650, y: 550 },
    as1:       { x: 900, y: 550 },
    as2:       { x: 1100, y: 550 }
  };

  // ─── Cytoscape Style ──────────────────────────────────────
  // Trust-domain colours map to AAuth's participant roles.
  // Edges are coloured by protocol layer.

  const STYLE = [

    // --- Base node ---
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 10,
        'font-family': 'Inter, sans-serif',
        'font-size': 12,
        'font-weight': 500,
        'color': '#94A3B8',
        'text-outline-color': '#0F172A',
        'text-outline-width': 2,
        'min-zoomed-font-size': 10,
        'transition-property': 'opacity, width, height, border-width',
        'transition-duration': '0.3s'
      }
    },

    // --- Participant nodes ---
    {
      selector: 'node[type="participant"]',
      style: {
        'width': 42,
        'height': 42,
        'shape': 'ellipse',
        'background-color': '#1E293B',
        'border-width': 2,
        'border-color': '#64748B',
        'font-size': 10,
        'font-weight': 600
      }
    },

    // Participant colours (trust domains)
    {
      selector: 'node[id="agent"], node[id="delegate"]',
      style: {
        'border-color': '#06B6D4',
        'color': '#06B6D4',
        'background-color': 'rgba(6, 182, 212, 0.1)'
      }
    },
    {
      selector: 'node[id="resource"], node[id="resource1"], node[id="resource2"]',
      style: {
        'border-color': '#10B981',
        'color': '#10B981',
        'background-color': 'rgba(16, 185, 129, 0.1)'
      }
    },
    {
      selector: 'node[id="ps"]',
      style: {
        'border-color': '#8B5CF6',
        'color': '#8B5CF6',
        'background-color': 'rgba(139, 92, 246, 0.1)'
      }
    },
    {
      selector: 'node[id="as"], node[id="as1"], node[id="as2"]',
      style: {
        'border-color': '#F59E0B',
        'color': '#F59E0B',
        'background-color': 'rgba(245, 158, 11, 0.1)'
      }
    },
    {
      selector: 'node[id="user"]',
      style: {
        'border-color': '#14B8A6',
        'color': '#14B8A6',
        'background-color': 'rgba(20, 184, 166, 0.1)'
      }
    },
    {
      selector: 'node[id="agent_server"]',
      style: {
        'border-color': '#6366F1',
        'color': '#6366F1',
        'background-color': 'rgba(99, 102, 241, 0.1)'
      }
    },

    // --- Token nodes (smaller, distinctive shape) ---
    {
      selector: 'node[type="token"]',
      style: {
        'width': 28,
        'height': 28,
        'shape': 'round-rectangle',
        'border-width': 2,
        'background-color': '#1E293B',
        'font-size': 9,
        'font-weight': 500
      }
    },
    {
      selector: 'node[id="token_agent"]',
      style: { 'border-color': '#22D3EE', 'color': '#22D3EE', 'background-color': 'rgba(34,211,238,0.1)' }
    },
    {
      selector: 'node[id="token_resource"]',
      style: { 'border-color': '#34D399', 'color': '#34D399', 'background-color': 'rgba(52,211,153,0.1)' }
    },
    {
      selector: 'node[id="token_auth"]',
      style: { 'border-color': '#FBBF24', 'color': '#FBBF24', 'background-color': 'rgba(251,191,36,0.1)' }
    },
    {
      selector: 'node[id="token_opaque"]',
      style: { 'border-color': '#64748B', 'color': '#64748B', 'background-color': 'rgba(100,116,139,0.1)' }
    },

    // --- Concept nodes (reference, smallest) ---
    {
      selector: 'node[type="concept"]',
      style: {
        'width': 36,
        'height': 36,
        'shape': 'diamond',
        'border-width': 1,
        'border-color': '#475569',
        'background-color': 'rgba(71, 85, 105, 0.15)',
        'font-size': 9,
        'color': '#64748B'
      }
    },

    // --- Active / highlighted node ---
    {
      selector: 'node.active',
      style: {
        'border-width': 3,
        'width': 52,
        'height': 52,
        'z-index': 10
      }
    },
    {
      selector: 'node[type="token"].active',
      style: {
        'width': 38,
        'height': 38
      }
    },

    // --- Dimmed node (not in current filter) ---
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.15
      }
    },

    // --- Base edge ---
    {
      selector: 'edge',
      style: {
        'width': 2,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#475569',
        'line-color': '#475569',
        'arrow-scale': 0.8,
        'opacity': 0.6,
        'label': 'data(label)',
        'font-family': 'Inter, sans-serif',
        'font-size': 9,
        'font-weight': 500,
        'color': '#64748B',
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'text-outline-color': '#0F172A',
        'text-outline-width': 2,
        'min-zoomed-font-size': 9,
        'transition-property': 'opacity, line-color, width',
        'transition-duration': '0.3s'
      }
    },

    // --- Layer-coloured edges ---
    {
      selector: 'edge[layer="signing"]',
      style: { 'line-color': '#94A3B8', 'target-arrow-color': '#94A3B8' }
    },
    {
      selector: 'edge[layer="access"]',
      style: { 'line-color': '#06B6D4', 'target-arrow-color': '#06B6D4' }
    },
    {
      selector: 'edge[layer="mission"]',
      style: { 'line-color': '#8B5CF6', 'target-arrow-color': '#8B5CF6' }
    },
    {
      selector: 'edge[layer="advanced"]',
      style: { 'line-color': '#F59E0B', 'target-arrow-color': '#F59E0B' }
    },

    // --- Active edge (current step in interactive mode) ---
    {
      selector: 'edge.active',
      style: {
        'width': 3,
        'opacity': 1,
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4],
        'z-index': 10
      }
    },

    // --- Dimmed edge ---
    {
      selector: 'edge.dimmed',
      style: {
        'opacity': 0.08
      }
    },

    // --- Highlighted edge (hover) ---
    {
      selector: 'edge.highlighted',
      style: {
        'width': 3,
        'opacity': 1
      }
    }
  ];

  // ─── Init ──────────────────────────────────────────────────

  function init(containerId) {
    cy = cytoscape({
      container: document.getElementById(containerId),
      elements: {
        nodes: AAuthGraph.nodes.map(n => ({
          data: n.data,
          position: POSITIONS[n.data.id] || { x: 600, y: 400 },
          classes: n.classes || ''
        })),
        edges: AAuthGraph.edges
      },
      style: STYLE,
      layout: { name: 'preset' },

      // Interaction defaults
      minZoom: 0.3,
      maxZoom: 2.5,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: false,
      autounselectify: false,

      // Performance
      textureOnViewport: false,
      hideEdgesOnViewport: false,
      motionBlur: false
    });

    // Fit with padding
    cy.fit(undefined, 60);

    // Initially hide advanced participants (shown when layer activates)
    const advancedNodes = ['resource1', 'resource2', 'as1', 'as2'];
    advancedNodes.forEach(id => {
      const node = cy.getElementById(id);
      if (node.length) node.style('display', 'none');
    });

    return cy;
  }

  // ─── Layout helpers ────────────────────────────────────────

  function showNodesForSublayer(sublayer) {
    const participantIds = AAuthGraph.getParticipantsForSublayer(sublayer);

    // Show all relevant nodes, hide others
    cy.nodes().forEach(node => {
      const id = node.data('id');
      const type = node.data('type');

      if (participantIds.includes(id)) {
        node.style('display', 'element');
        node.removeClass('dimmed');
      } else if (type === 'concept') {
        node.style('display', 'none');
      } else {
        node.removeClass('active');
        node.addClass('dimmed');
      }
    });
  }

  function showAllNodes() {
    cy.nodes().forEach(node => {
      node.style('display', 'element');
      node.removeClass('dimmed active');
    });
  }

  function highlightEdges(sublayer) {
    cy.edges().forEach(edge => {
      if (edge.data('sublayer') === sublayer) {
        edge.removeClass('dimmed');
        edge.style('display', 'element');
      } else {
        edge.addClass('dimmed');
      }
    });
  }

  function highlightLayer(layer) {
    cy.edges().forEach(edge => {
      if (edge.data('layer') === layer) {
        edge.removeClass('dimmed');
      } else {
        edge.addClass('dimmed');
      }
    });
  }

  function showAllEdges() {
    cy.edges().forEach(edge => {
      edge.style('display', 'element');
      edge.removeClass('dimmed active highlighted');
    });
  }

  function highlightStep(sublayer, step) {
    cy.edges().forEach(edge => {
      const d = edge.data();
      if (d.sublayer === sublayer && d.step === step) {
        edge.removeClass('dimmed');
        edge.addClass('active');
        // Also activate source + target nodes
        cy.getElementById(d.source).addClass('active').removeClass('dimmed');
        cy.getElementById(d.target).addClass('active').removeClass('dimmed');
      } else if (d.sublayer === sublayer && d.step < step) {
        edge.removeClass('dimmed active');
        edge.addClass('highlighted');
      } else {
        edge.removeClass('active highlighted');
        edge.addClass('dimmed');
      }
    });
  }

  function clearHighlights() {
    cy.elements().removeClass('active dimmed highlighted');
  }

  function fitView(padding = 60) {
    cy.fit(undefined, padding);
  }

  // ─── Public API ────────────────────────────────────────────

  return {
    init,
    getCy: () => cy,
    showNodesForSublayer,
    showAllNodes,
    highlightEdges,
    highlightLayer,
    showAllEdges,
    highlightStep,
    clearHighlights,
    fitView,
    POSITIONS
  };
})();
