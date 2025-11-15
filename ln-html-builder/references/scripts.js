/**
 * Presentation Scripts
 *
 * Features:
 * - Tab switching with state persistence (localStorage)
 * - Collapsible sections
 * - Mermaid diagram initialization
 * - Smooth scrolling
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Mermaid with manual control for tab switching
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: false, // Manual control for better tab switching
            theme: 'default',
            securityLevel: 'loose',
            logLevel: 1, // Only show errors
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            }
        });

        // Render diagrams in the initially active tab (only once)
        setTimeout(async () => {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && !activeTab.dataset.mermaidRendered) {
                try {
                    await mermaid.run({
                        nodes: activeTab.querySelectorAll('.mermaid'),
                        suppressErrors: true
                    });
                    activeTab.dataset.mermaidRendered = 'true';
                } catch (err) {
                    console.error('Mermaid rendering error:', err);
                }
            }
        }, 100);
    }

    // Tab Switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-content');

    // Load saved tab from localStorage
    const savedTab = localStorage.getItem('activeTab') || 'overview';
    switchTab(savedTab);

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    async function switchTab(tabName) {
        // Update buttons
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        // Update panes
        tabPanes.forEach(pane => {
            pane.classList.remove('active');
            if (pane.id === `${tabName}-tab`) {
                pane.classList.add('active');
            }
        });

        // Save to localStorage
        localStorage.setItem('activeTab', tabName);

        // Render Mermaid diagrams in newly activated tab (only once per tab)
        if (typeof mermaid !== 'undefined') {
            const activeTab = document.getElementById(`${tabName}-tab`);
            if (activeTab && !activeTab.dataset.mermaidRendered) {
                setTimeout(async () => {
                    try {
                        await mermaid.run({
                            nodes: activeTab.querySelectorAll('.mermaid'),
                            suppressErrors: true
                        });
                        activeTab.dataset.mermaidRendered = 'true';
                    } catch (err) {
                        console.error('Mermaid rendering error on tab switch:', err);
                    }
                }, 50);
            }
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Make switchTab available globally for inline onclick handlers
    window.switchTab = switchTab;

    // Search functionality
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            // Basic search implementation - can be enhanced
            if (query.length > 2) {
                console.log('Searching for:', query);
                // TODO: Implement search across all tabs
            }
        });
    }

    // Collapsible sections (details/summary elements)
    document.querySelectorAll('details').forEach(detail => {
        detail.addEventListener('toggle', function() {
            if (this.open) {
                // Scroll into view when expanded
                this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });
});
