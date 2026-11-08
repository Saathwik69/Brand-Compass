import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReport,renderCSV} from '../src/reports.mjs';
import {reviewContent} from '../src/engine.mjs';
import {seedState,demoDraft} from '../src/seed.mjs';
const review={...demoDraft,title:'<script>alert(1)</script>',status:'draft',version:1,analysis:reviewContent(demoDraft,seedState())};
test('readable report escapes hostile markup and states the actual approval status',()=>{const html=renderReport(review);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.match(html,/has not been approved/);assert.match(html,/Verdant Brand Handbook/);});
test('CSV guards formula prefixes even after leading whitespace',()=>{const r=structuredClone(review);r.analysis.findings[0].title='  =1+1';const csv=renderCSV(r);assert.ok(csv.includes('"\'  =1+1"'));assert.ok(csv.includes('"Category","Severity"'));});
