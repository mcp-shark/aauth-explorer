// js/interactions.js
// Click, hover, tooltip, and sidebar logic
// Reads detail/tooltip from AAuthGraph data layer

const Interactions = (() => {
  let cy = null;
  let tooltipEl = null;
  let sidebarEl = null;
  let sidebarBodyEl = null;
  let sidebarTitleEl = null;

  // ─── Init ──────────────────────────────────────────────────

  function init(cyInstance) {
    cy = cyInstance;
    tooltipEl = document.getElementById('tooltip');
    sidebarEl = document.getElementById('sidebar');
    sidebarBodyEl = document.querySelector('.sidebar-body');
    sidebarTitleEl = document.querySelector('.sidebar-title');

    setupNodeEvents();
    setupEdgeEvents();
    setupSidebarClose();
    setupCanvasClick();
  }

  // ─── Node events ───────────────────────────────────────────

  function setupNodeEvents() {
    // Hover → tooltip
    cy.on('mouseover', 'node', (e) => {
      const node = e.target;
      const d = node.data();
      showTooltip(e.renderedPosition, d.label, d.tooltip);
      node.style('cursor', 'pointer');
    });

    cy.on('mouseout', 'node', () => {
      hideTooltip();
    });

    // Click → sidebar detail
    cy.on('tap', 'node', (e) => {
      e.stopPropagation();
      const node = e.target;
      const d = node.data();

      // Highlight this node
      cy.nodes().removeClass('active');
      node.addClass('active');

      // Build sidebar content based on node type
      if (d.type === 'participant') {
        showParticipantSidebar(d);
      } else if (d.type === 'token') {
        showTokenSidebar(d);
      } else if (d.type === 'concept') {
        showConceptSidebar(d);
      }
    });
  }

  // ─── Edge events ───────────────────────────────────────────

  function setupEdgeEvents() {
    // Hover → tooltip
    cy.on('mouseover', 'edge', (e) => {
      const edge = e.target;
      const d = edge.data();
      const midpoint = edge.renderedMidpoint();
      showTooltip(midpoint, d.label, d.tooltip);
      edge.addClass('highlighted');
    });

    cy.on('mouseout', 'edge', (e) => {
      hideTooltip();
      e.target.removeClass('highlighted');
    });

    // Click → sidebar with full protocol step detail
    cy.on('tap', 'edge', (e) => {
      e.stopPropagation();
      const edge = e.target;
      const d = edge.data();

      // Highlight edge + connected nodes
      cy.edges().removeClass('active');
      cy.nodes().removeClass('active');
      edge.addClass('active');
      cy.getElementById(d.source).addClass('active');
      cy.getElementById(d.target).addClass('active');

      showEdgeSidebar(d);
    });
  }

  // ─── Canvas click (deselect) ───────────────────────────────

  function setupCanvasClick() {
    cy.on('tap', (e) => {
      if (e.target === cy) {
        cy.elements().removeClass('active');
        closeSidebar();
      }
    });
  }

  // ─── Tooltip ───────────────────────────────────────────────

  function showTooltip(pos, label, desc) {
    if (!tooltipEl || !desc) return;

    tooltipEl.innerHTML = `
      <div class="tt-label">${escHtml(label)}</div>
      <div class="tt-desc">${escHtml(desc)}</div>
    `;

    // Position near cursor but within viewport
    const rect = cy.container().getBoundingClientRect();
    let x = rect.left + pos.x + 15;
    let y = rect.top + pos.y + 15;

    // Keep within viewport
    const ttRect = tooltipEl.getBoundingClientRect();
    if (x + 280 > window.innerWidth) x = x - 300;
    if (y + 100 > window.innerHeight) y = y - 100;

    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
    tooltipEl.classList.add('visible');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  // ─── Sidebar: Participant ──────────────────────────────────
  // Shows: role description, which layers they appear in,
  // connected edges (flows they participate in)

  function showParticipantSidebar(d) {
    const connectedEdges = cy.getElementById(d.id).connectedEdges();
    const layers = [...new Set(connectedEdges.map(e => e.data('layer')))];
    const icon = d.icon || '●';

    // Determine colour class
    const colorClass = getParticipantClass(d.id);

    let html = `
      <div class="sidebar-section">
        <div class="sidebar-section-label">Participant</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:24px">${icon}</span>
          <span class="participant-badge ${colorClass}">${escHtml(d.label)}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Role</div>
        <div class="sidebar-detail">${escHtml(d.detail)}</div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Active in layers</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${layers.map(l => `<span class="layer-tag ${l}">${escHtml(AAuthGraph.layers[l]?.label || l)}</span>`).join('')}
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Protocol flows (${connectedEdges.length})</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${connectedEdges.map(e => {
            const ed = e.data();
            const dir = ed.source === d.id ? '→' : '←';
            const other = ed.source === d.id ? ed.target : ed.source;
            return `<div class="sidebar-detail" style="padding:6px 8px;background:rgba(15,23,42,0.5);border-radius:6px;cursor:pointer;font-size:12px;"
                      data-edge-id="${ed.id}">
              <span class="mono" style="color:var(--edge-${ed.layer})">${ed.id}</span>
              ${dir} <strong>${escHtml(other)}</strong>: ${escHtml(ed.label)}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    openSidebar(d.label, html);

    // Make flow items clickable
    sidebarBodyEl.querySelectorAll('[data-edge-id]').forEach(el => {
      el.addEventListener('click', () => {
        const edgeId = el.dataset.edgeId;
        const edge = cy.getElementById(edgeId);
        if (edge.length) {
          cy.edges().removeClass('active');
          edge.addClass('active');
          showEdgeSidebar(edge.data());
        }
      });
    });
  }

  // ─── Sidebar: Token ────────────────────────────────────────
  // Shows: JWT type, claims, example payload

  function showTokenSidebar(d) {
    const icon = d.icon || '🎫';

    let html = `
      <div class="sidebar-section">
        <div class="sidebar-section-label">Token</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:24px">${icon}</span>
          <span class="mono" style="font-size:14px;color:var(--text-bright)">${escHtml(d.label)}</span>
        </div>
        <span class="mono" style="font-size:11px;color:var(--text-muted)">${escHtml(d.tokenType || d.typ || '')}</span>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Description</div>
        <div class="sidebar-detail">${escHtml(d.detail)}</div>
      </div>
    `;

    if (d.example) {
      let formatted;
      try {
        formatted = JSON.stringify(JSON.parse(d.example), null, 2);
      } catch {
        formatted = d.example;
      }
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-label">Example payload</div>
          <div class="sidebar-code">${escHtml(formatted)}</div>
        </div>
      `;
    }

    openSidebar(d.label, html);
  }

  // ─── Sidebar: Concept ──────────────────────────────────────

  function showConceptSidebar(d) {
    const icon = d.icon || '📖';

    let html = `
      <div class="sidebar-section">
        <div class="sidebar-section-label">Concept</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:24px">${icon}</span>
          <span style="font-size:14px;color:var(--text-bright);font-weight:600">${escHtml(d.label)}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Detail</div>
        <div class="sidebar-detail">${escHtml(d.detail)}</div>
      </div>
    `;

    openSidebar(d.label, html);
  }

  // ─── Sidebar: Edge (Protocol Step) ─────────────────────────
  // This is the richest panel — shows the full protocol step
  // detail including source→target, layer, step number, and
  // the detailed technical description.

  function showEdgeSidebar(d) {
    const sourceNode = cy.getElementById(d.source).data();
    const targetNode = cy.getElementById(d.target).data();
    const sourceClass = getParticipantClass(d.source);
    const targetClass = getParticipantClass(d.target);
    const sublayerInfo = AAuthGraph.sublayers[d.sublayer] || {};
    const layerInfo = AAuthGraph.layers[d.layer] || {};

    // Get related concept if available
    const conceptKey = getRelatedConcept(d);
    const concept = conceptKey ? AAuthGraph.concepts[conceptKey] : null;

    let html = `
      <div class="sidebar-section">
        <div class="sidebar-section-label">Protocol Step</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span class="mono" style="font-size:16px;color:var(--edge-${d.layer});font-weight:700">${escHtml(d.id)}</span>
          <span class="layer-tag ${d.layer}">${escHtml(layerInfo.label || d.layer)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">
          ${escHtml(sublayerInfo.label || d.sublayer)} · Step ${d.step}
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Flow</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="participant-badge ${sourceClass}">${sourceNode.icon || '●'} ${escHtml(sourceNode.label)}</span>
          <span style="color:var(--edge-${d.layer});font-size:18px">→</span>
          <span class="participant-badge ${targetClass}">${targetNode.icon || '●'} ${escHtml(targetNode.label)}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">What happens</div>
        <div class="sidebar-detail">${escHtml(d.detail)}</div>
      </div>
    `;

    // Explorer link
if (d.url) {
  html += `
    <div class="sidebar-section">
      <a href="${d.url}" target="_blank" rel="noopener"
         style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;
                border-radius:8px;background:rgba(6,182,212,0.1);
                border:1px solid rgba(6,182,212,0.3);color:var(--agent-color);
                font-size:12px;font-weight:500;text-decoration:none;">
        View in AAuth Explorer ↗
      </a>
    </div>
  `;
}


    // Add related concept if found
    if (concept) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-label">Related concept</div>
          <div class="sidebar-detail">
            <strong>${escHtml(concept.label)}</strong><br>
            ${escHtml(concept.detail)}
          </div>
        </div>
      `;
    }

    openSidebar(d.label, html);
  }

  // ─── Sidebar open/close ────────────────────────────────────

  function openSidebar(title, contentHtml) {
    sidebarTitleEl.textContent = title;
    sidebarBodyEl.innerHTML = contentHtml;
    sidebarEl.classList.add('open');
  }

  function closeSidebar() {
    sidebarEl.classList.remove('open');
  }

  function setupSidebarClose() {
    const closeBtn = document.querySelector('.sidebar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closeSidebar();
        cy.elements().removeClass('active');
      });
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  function getParticipantClass(id) {
    if (['agent', 'delegate'].includes(id)) return 'agent';
    if (['resource', 'resource1', 'resource2'].includes(id)) return 'resource';
    if (id === 'ps') return 'ps';
    if (['as', 'as1', 'as2'].includes(id)) return 'as';
    if (id === 'user') return 'user';
    if (id === 'agent_server') return 'agentserver';
    return '';
  }

  // Map edge IDs to related concepts for sidebar enrichment
  function getRelatedConcept(edgeData) {
    const id = edgeData.id;
    if (['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].includes(id)) return 'http_sig';
    if (['S2'].includes(id)) return 'schemes';
    if (['M2', 'M5', 'M6', 'M11'].includes(id)) return 'mission_blob';
    if (['A1', 'A2', 'A5', 'A9', 'A15'].includes(id)) return 'dwk';
    return null;
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Public API ────────────────────────────────────────────

  return {
    init,
    openSidebar,
    closeSidebar,
    hideTooltip
  };
})();
