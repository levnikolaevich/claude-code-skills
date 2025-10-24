/**
 * Build Script for HTML Presentation
 *
 * Reads modular HTML components and creates standalone presentation_final.html
 * by inlining CSS, JavaScript, and all tab content.
 *
 * Usage: node build-presentation.js (run from assets/ directory)
 * Output: ../presentation_final.html
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Building presentation...\n');

// 1. Read base template
console.log('📄 Reading presentation_template.html...');
let html = fs.readFileSync('presentation_template.html', 'utf-8');

// 2. Read and inject tab content
const tabs = ['overview', 'requirements', 'architecture', 'technical_spec', 'roadmap', 'guides'];
console.log('📑 Injecting tab content...');

tabs.forEach(tab => {
  const tabFile = path.join('tabs', `tab_${tab}.html`);
  if (fs.existsSync(tabFile)) {
    const tabContent = fs.readFileSync(tabFile, 'utf-8');
    const placeholder = `<!--TAB_${tab.toUpperCase()}-->`;
    html = html.replace(placeholder, tabContent);
    console.log(`   ✓ ${tab}`);
  } else {
    console.log(`   ⚠ ${tab} (file not found, skipping)`);
  }
});

// 3. Inline CSS
console.log('🎨 Inlining styles.css...');
if (fs.existsSync('styles.css')) {
  const css = fs.readFileSync('styles.css', 'utf-8');
  html = html.replace('<!--STYLES-->', `<style>\n${css}\n</style>`);
  console.log('   ✓ CSS inlined');
} else {
  console.log('   ⚠ styles.css not found');
}

// 4. Inline JavaScript
console.log('⚡ Inlining scripts.js...');
if (fs.existsSync('scripts.js')) {
  const js = fs.readFileSync('scripts.js', 'utf-8');
  html = html.replace('<!--SCRIPTS-->', `<script>\n${js}\n</script>`);
  console.log('   ✓ JS inlined');
} else {
  console.log('   ⚠ scripts.js not found');
}

// 5. Write final presentation
const outputPath = path.join('..', 'presentation_final.html');
console.log(`\n📦 Writing ${outputPath}...`);
fs.writeFileSync(outputPath, html, 'utf-8');

// 6. Calculate file size
const stats = fs.statSync(outputPath);
const sizeKB = (stats.size / 1024).toFixed(2);
console.log(`   ✓ File size: ${sizeKB} KB`);

console.log('\n✅ Build complete!');
console.log(`   Open: ${outputPath}`);
