#!/usr/bin/env node
// Checks marketplace.json skill count for a given plugin name.
// Usage: node check_marketplace.mjs <plugin-name>
// Returns: skill count (number) to stdout

import { readFileSync } from 'fs';

const plugin = process.argv[2];
if (!plugin) { console.log(0); process.exit(0); }

const manifest = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
const entry = manifest.plugins.find(p => p.name === plugin);
console.log(entry ? entry.skills.length : 0);
