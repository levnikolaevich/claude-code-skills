# Mermaid.js Guidelines for x-html-builder

This guide provides best practices for working with Mermaid.js diagrams in HTML presentations with tab-based navigation.

## Version and CDN

**Current Version:** Mermaid v11.12.1 (latest stable as of 2025)

**Recommended CDN:**
```html
<!-- Standard version -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>

<!-- ESM version (modern browsers) -->
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
</script>
```

**Why v11?**
- Latest features and bug fixes
- Improved performance
- Better error handling
- `mermaid.init()` deprecated (use `mermaid.run()` instead)

---

## Initialization for Tab-Based Presentations

**Critical Setting:** `startOnLoad: false`

**Why?**
- Tabs with `display: none` prevent diagrams from rendering correctly
- Diagrams need manual rendering when tab becomes visible
- Allows precise control over rendering timing

**Configuration:**
```javascript
mermaid.initialize({
  startOnLoad: false,      // Manual control for tab switching
  theme: 'default',        // or 'dark', 'forest', 'neutral'
  securityLevel: 'loose',  // For trusted content (allows HTML labels)
  logLevel: 1,             // 0=none, 1=error, 2=warn, 3=info
  flowchart: {
    useMaxWidth: true,     // Responsive diagrams
    htmlLabels: true       // Rich text support
  }
});
```

---

## Rendering Strategies

### Strategy 1: Render Once Per Tab (Recommended)

**Best for:** Static content with tab navigation

```javascript
document.addEventListener('DOMContentLoaded', async function() {
  // Initialize Mermaid
  mermaid.initialize({ startOnLoad: false });

  // Render initially active tab
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab && !activeTab.dataset.mermaidRendered) {
    await mermaid.run({
      nodes: activeTab.querySelectorAll('.mermaid'),
      suppressErrors: true
    });
    activeTab.dataset.mermaidRendered = 'true'; // Mark as rendered
  }
});

async function switchTab(tabName) {
  // ... tab switching logic ...

  // Render diagrams only if not already rendered
  const activeTab = document.getElementById(`${tabName}-tab`);
  if (activeTab && !activeTab.dataset.mermaidRendered) {
    await mermaid.run({
      nodes: activeTab.querySelectorAll('.mermaid'),
      suppressErrors: true
    });
    activeTab.dataset.mermaidRendered = 'true';
  }
}
```

**Benefits:**
- ✅ Performance: Each tab rendered only once
- ✅ No duplicate diagrams
- ✅ Minimal re-rendering overhead

### Strategy 2: Render All on Load

**Best for:** Small number of tabs (<5), simple diagrams

```javascript
document.addEventListener('DOMContentLoaded', async function() {
  mermaid.initialize({ startOnLoad: false });

  // Render ALL diagrams at once
  await mermaid.run({
    querySelector: '.mermaid',
    suppressErrors: true
  });
});
```

**Benefits:**
- ✅ Simple implementation
- ✅ No tab-switch delays
- ❌ Slower initial load for many diagrams

### Strategy 3: Manual Rendering API

**Best for:** Dynamic content from API, programmatic diagram generation

```javascript
const graphDefinition = `
  graph TD
    A[Client] --> B[Load Balancer]
    B --> C[Server1]
    B --> D[Server2]
`;

const { svg } = await mermaid.render('uniqueId', graphDefinition);
document.getElementById('diagram-container').innerHTML = svg;
```

**Benefits:**
- ✅ Full control over rendering
- ✅ Can modify SVG before insertion
- ✅ Works with dynamic content

---

## Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| **Diagrams not rendering in hidden tabs** | `startOnLoad: true` + `display: none` | Use `startOnLoad: false` + `mermaid.run()` on tab switch |
| **Duplicate diagrams** | Re-rendering already rendered content | Cache rendered tabs with `data-mermaid-rendered` attribute |
| **"mermaid.init is deprecated"** | Using old API | Replace `mermaid.init()` with `mermaid.run()` |
| **SVG sizing issues** | Rendering while element is hidden | Add `setTimeout(... , 50)` before rendering to ensure tab is visible |
| **Parsing errors break page** | Invalid Mermaid syntax | Use `suppressErrors: true` in `mermaid.run()` |
| **Fonts not loaded** | Rendering before fonts ready | Wait for `DOMContentLoaded` + small delay (50-100ms) |
| **Different themes on tabs** | Theme not applied to new renders | Re-initialize theme before rendering: `mermaid.initialize({ theme: 'dark' })` |

---

## Performance Optimization

### 1. Lazy Rendering
Only render diagrams when tab becomes visible (Strategy 1).

### 2. Caching
Use `data-mermaid-rendered` attribute to avoid re-rendering:
```javascript
if (!element.dataset.mermaidRendered) {
  await mermaid.run({ nodes: [element] });
  element.dataset.mermaidRendered = 'true';
}
```

### 3. Batch Rendering
Render multiple diagrams in one `mermaid.run()` call:
```javascript
// Good: One call for all diagrams in tab
await mermaid.run({ nodes: tab.querySelectorAll('.mermaid') });

// Bad: Multiple calls
diagrams.forEach(d => mermaid.run({ nodes: [d] }));
```

### 4. Error Suppression (Production)
Prevent parsing errors from breaking the page:
```javascript
await mermaid.run({ suppressErrors: true });
```

### 5. Async/Await
Always use async/await for predictable rendering:
```javascript
async function renderDiagrams() {
  await mermaid.run({ ... }); // Wait for completion
  console.log('Rendering complete');
}
```

---

## Security Levels

**Choose based on content trust level:**

### `loose` (Recommended for Documentation)
```javascript
mermaid.initialize({ securityLevel: 'loose' });
```
- Allows HTML labels
- Allows some scripts in labels
- **Use for:** Internal docs, trusted content

### `strict` (User-Generated Content)
```javascript
mermaid.initialize({ securityLevel: 'strict' });
```
- Blocks all scripts
- Sanitizes HTML
- **Use for:** User-submitted diagrams, public content

### `antiscript` (Middle Ground)
```javascript
mermaid.initialize({ securityLevel: 'antiscript' });
```
- Removes scripts from output
- Allows safe HTML

---

## Code Examples

### Complete Tab-Based Implementation

```javascript
document.addEventListener('DOMContentLoaded', async function() {
  // Initialize Mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      logLevel: 1,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true
      }
    });

    // Render initially active tab
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

  // Tab switching
  async function switchTab(tabName) {
    // ... tab activation logic ...

    // Render diagrams if not already rendered
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
  }
});
```

### Error Handling with Fallback

```javascript
async function renderMermaidSafe(element) {
  try {
    await mermaid.run({ nodes: [element] });
  } catch (err) {
    console.error('Mermaid error:', err);
    element.innerHTML = `
      <div style="color: red; padding: 10px; border: 1px solid red;">
        ⚠️ Diagram rendering failed. Check syntax.
      </div>
    `;
  }
}
```

---

## Migration Notes: v10 → v11

**Breaking Changes:**
- ❌ `mermaid.init()` is deprecated → Use `mermaid.run()`
- ⚠️ Some theme options renamed (check docs)

**Recommended Changes:**
```javascript
// Old (v10)
mermaid.init(undefined, '.mermaid');

// New (v11)
await mermaid.run({ querySelector: '.mermaid' });
```

**CDN Update:**
```html
<!-- v10 -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

<!-- v11 -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
```

**Compatibility:**
- ✅ All diagram types (flowchart, sequence, class, ER, etc.) work in v11
- ✅ Themes are compatible
- ✅ Configuration options mostly unchanged

---

## Troubleshooting Checklist

When diagrams don't render:

1. **Check CDN loading:**
   ```javascript
   console.log(typeof mermaid); // Should be 'object', not 'undefined'
   ```

2. **Check initialization:**
   ```javascript
   console.log(mermaid.initialize); // Should be a function
   ```

3. **Check element visibility:**
   ```javascript
   const el = document.querySelector('.mermaid');
   console.log(window.getComputedStyle(el).display); // Should NOT be 'none'
   ```

4. **Check for syntax errors:**
   - Open browser console
   - Look for Mermaid parsing errors
   - Validate syntax at https://mermaid.live

5. **Check timing:**
   - Are you rendering before DOM is ready?
   - Is element visible when rendering?
   - Try adding `setTimeout(... , 100)` delay

---

## Best Practices Summary

✅ **DO:**
- Use `startOnLoad: false` for tab-based layouts
- Cache rendered tabs with `data-mermaid-rendered`
- Use async/await for predictable rendering
- Add error handling with `suppressErrors: true`
- Wait for element visibility before rendering
- Use `mermaid.run()` (not deprecated `init()`)

❌ **DON'T:**
- Use `startOnLoad: true` with hidden tabs
- Re-render already rendered diagrams
- Render while element has `display: none`
- Use `mermaid.init()` (deprecated)
- Ignore parsing errors in production
- Mix rendering strategies

---

**Version:** 1.0.0
**Last Updated:** 2025-11-06
**Mermaid Version:** v11.12.1
**Compatible with:** x-html-builder v2.3.1+
