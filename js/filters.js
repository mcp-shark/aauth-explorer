// js/filters.js
// Layer filter toolbar + view toggle + step navigation
// Orchestrates GraphEngine visibility based on user selection

const Filters = (() => {
  let currentLayer = null;
  let currentSublayer = null;
  let currentStep = 0;
  let maxStep = 0;
  let isFullView = false;

  // ─── Init ──────────────────────────────────────────────────

  function init() {
    setupLayerButtons();
    setupSublayerButtons();
    setupViewToggle();
    setupStepControls();

    // Default state: full view, all visible
    showAll();
  }

  // ─── Layer buttons ─────────────────────────────────────────
  // Each maps to an AAuth protocol layer.
  // Clicking a layer: highlights that layer's edges,
  // expands sub-filter options, dims everything else.

  function setupLayerButtons() {
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;

        if (currentLayer === layer) {
          // Toggle off — show all
          clearLayerSelection();
          showAll();
          return;
        }

        // Activate this layer
        currentLayer = layer;
        currentSublayer = null;
        currentStep = 0;

        // UI: update button states
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // UI: show sublayer options for this layer
        showSublayersFor(layer);

        // Graph: highlight this layer
        if (isFullView) {
          GraphEngine.showAllNodes();
          GraphEngine.highlightLayer(layer);
        } else {
          GraphEngine.showAllNodes();
          GraphEngine.highlightLayer(layer);
        }

        // Hide step controls until sublayer is chosen
        hideStepControls();

        GraphEngine.fitView();
      });
    });
  }

  // ─── Sublayer buttons ──────────────────────────────────────
  // Progressive disclosure: Identity-Based → Resource-Managed
  // → PS-Managed → Federated → User Delegation mirrors
  // AAuth's progressive adoption path.

  function setupSublayerButtons() {
    document.querySelectorAll('.sublayer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sublayer = btn.dataset.sublayer;

        if (currentSublayer === sublayer) {
          // Toggle off — go back to layer level
          currentSublayer = null;
          currentStep = 0;
          document.querySelectorAll('.sublayer-btn').forEach(b => b.classList.remove('active'));

          if (currentLayer) {
            GraphEngine.showAllNodes();
            GraphEngine.highlightLayer(currentLayer);
          }
          hideStepControls();
          return;
        }

        // Activate this sublayer
        currentSublayer = sublayer;

        // UI: update sublayer button states
        document.querySelectorAll('.sublayer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Graph: show only relevant nodes + edges
        GraphEngine.showNodesForSublayer(sublayer);
        GraphEngine.highlightEdges(sublayer);

        // Interactive mode: set up step navigation
        if (!isFullView) {
          const steps = AAuthGraph.getEdgesByStep(sublayer);
          maxStep = steps.length > 0 ? Math.max(...steps.map(e => e.data.step)) : 0;
          currentStep = 0;

          if (maxStep > 0) {
            showStepControls();
            // Start at step 1
            goToStep(1);
          }
        }

        GraphEngine.fitView();
      });
    });
  }

  // ─── Sublayer panel visibility ─────────────────────────────

  function showSublayersFor(layer) {
    document.querySelectorAll('.sublayer-group').forEach(g => {
      if (g.dataset.layer === layer) {
        g.classList.add('visible');
      } else {
        g.classList.remove('visible');
      }
    });
    // Clear sublayer selection
    document.querySelectorAll('.sublayer-btn').forEach(b => b.classList.remove('active'));
  }

  function hideAllSublayers() {
    document.querySelectorAll('.sublayer-group').forEach(g => g.classList.remove('visible'));
  }

  // ─── View toggle ───────────────────────────────────────────
  // Full view: all edges visible, layer filter highlights.
  // Interactive view: sublayer step-through with animated flow.

  function setupViewToggle() {
    const toggle = document.getElementById('view-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      isFullView = !isFullView;
      toggle.classList.toggle('active', isFullView);

      // Update label
      const label = document.getElementById('view-label');
      if (label) label.textContent = isFullView ? 'FULL' : 'INTERACTIVE';

      if (isFullView) {
        // Full view: show everything, highlight current layer if set
        GraphEngine.showAllNodes();
        GraphEngine.showAllEdges();
        hideStepControls();

        if (currentLayer) {
          GraphEngine.highlightLayer(currentLayer);
        }
        if (currentSublayer) {
          GraphEngine.highlightEdges(currentSublayer);
        }
      } else {
        // Interactive: if sublayer selected, go to step mode
        if (currentSublayer) {
          GraphEngine.showNodesForSublayer(currentSublayer);
          GraphEngine.highlightEdges(currentSublayer);
          const steps = AAuthGraph.getEdgesByStep(currentSublayer);
          maxStep = steps.length > 0 ? Math.max(...steps.map(e => e.data.step)) : 0;
          if (maxStep > 0) {
            showStepControls();
            goToStep(1);
          }
        } else if (currentLayer) {
          GraphEngine.highlightLayer(currentLayer);
        }
      }

      GraphEngine.fitView();
    });
  }

  // ─── Step controls ─────────────────────────────────────────
  // Step-through navigation for interactive mode.
  // Maps to AAuth Explorer's own "1 / 5 Play" step UI.

  function setupStepControls() {
    const prevBtn = document.getElementById('step-prev');
    const nextBtn = document.getElementById('step-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentStep > 1) goToStep(currentStep - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentStep < maxStep) goToStep(currentStep + 1);
      });
    }
  }

  function goToStep(step) {
    if (!currentSublayer) return;

    currentStep = step;
    GraphEngine.highlightStep(currentSublayer, step);
    updateStepIndicator();

    // Show step detail in sidebar
    const edges = AAuthGraph.getEdgesByStep(currentSublayer);
    const stepEdge = edges.find(e => e.data.step === step);
    if (stepEdge) {
      // Trigger edge sidebar via Interactions module
      const cyEdge = GraphEngine.getCy().getElementById(stepEdge.data.id);
      if (cyEdge.length) {
        cyEdge.trigger('tap');
      }
    }
  }

  function updateStepIndicator() {
    const indicator = document.getElementById('step-indicator');
    if (indicator) indicator.textContent = `${currentStep} / ${maxStep}`;

    const prevBtn = document.getElementById('step-prev');
    const nextBtn = document.getElementById('step-next');
    if (prevBtn) prevBtn.disabled = currentStep <= 1;
    if (nextBtn) nextBtn.disabled = currentStep >= maxStep;
  }

  function showStepControls() {
    const controls = document.querySelector('.step-controls');
    if (controls) controls.classList.remove('hidden');
    updateStepIndicator();
  }

  function hideStepControls() {
    const controls = document.querySelector('.step-controls');
    if (controls) controls.classList.add('hidden');
    currentStep = 0;
  }

  // ─── Reset ─────────────────────────────────────────────────

  function showAll() {
    GraphEngine.clearHighlights();
    GraphEngine.showAllNodes();
    GraphEngine.showAllEdges();
    GraphEngine.fitView();
  }

  function clearLayerSelection() {
    currentLayer = null;
    currentSublayer = null;
    currentStep = 0;
    document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sublayer-btn').forEach(b => b.classList.remove('active'));
    hideAllSublayers();
    hideStepControls();
  }

  // ─── Keyboard shortcuts ────────────────────────────────────

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Arrow right / left for step navigation
      if (e.key === 'ArrowRight' && currentStep < maxStep) {
        goToStep(currentStep + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 1) {
        goToStep(currentStep - 1);
      }
      // Escape to clear selection
      else if (e.key === 'Escape') {
        clearLayerSelection();
        showAll();
        Interactions.closeSidebar();
      }
      // 1-4 for layer shortcuts
      else if (e.key === '1') clickLayerButton('signing');
      else if (e.key === '2') clickLayerButton('access');
      else if (e.key === '3') clickLayerButton('mission');
      else if (e.key === '4') clickLayerButton('advanced');
    });
  }

  function clickLayerButton(layer) {
    const btn = document.querySelector(`.layer-btn[data-layer="${layer}"]`);
    if (btn) btn.click();
  }

  // ─── Public API ────────────────────────────────────────────

  return {
    init,
    initKeyboard,
    showAll,
    clearLayerSelection,
    getCurrentLayer: () => currentLayer,
    getCurrentSublayer: () => currentSublayer,
    getCurrentStep: () => currentStep,
    isFullView: () => isFullView
  };
})();
