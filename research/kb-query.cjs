// Usage: node research/kb-query.cjs <query-name>
// Queries: summary, findings, bottlenecks, techniques, wasm, algorithms, patterns, all

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'performance-kb.db'), { readonly: true });
const query = process.argv[2] || 'summary';

const queries = {
  summary: () => {
    const counts = {};
    for (const table of ['findings', 'bottlenecks', 'techniques', 'wasm_candidates', 'benchmarks', 'algorithms', 'code_patterns', 'research_sessions']) {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
      counts[table] = row.c;
    }
    console.log('\n=== KNOWLEDGE BASE SUMMARY ===');
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n--- Findings by Category ---');
    const cats = db.prepare('SELECT category, COUNT(*) as c, AVG(impact_score) as avg_impact FROM findings GROUP BY category ORDER BY avg_impact DESC').all();
    cats.forEach(r => console.log(`  ${r.category}: ${r.c} findings (avg impact: ${r.avg_impact?.toFixed(1)})`));

    console.log('\n--- Bottlenecks by Severity ---');
    const sevs = db.prepare("SELECT severity, COUNT(*) as c FROM bottlenecks GROUP BY severity ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END").all();
    sevs.forEach(r => console.log(`  ${r.severity}: ${r.c}`));

    console.log('\n--- WASM Candidates by Feasibility ---');
    const wasm = db.prepare('SELECT feasibility, COUNT(*) as c FROM wasm_candidates GROUP BY feasibility').all();
    wasm.forEach(r => console.log(`  ${r.feasibility}: ${r.c}`));

    console.log('\n--- Top 10 Techniques by Applicability ---');
    const techs = db.prepare('SELECT name, category, applicability_score, performance_gain_estimate FROM techniques ORDER BY applicability_score DESC LIMIT 10').all();
    techs.forEach((r, i) => console.log(`  ${i+1}. [${r.applicability_score}] ${r.name} (${r.category}) - ${r.performance_gain_estimate}`));
  },

  findings: () => {
    const rows = db.prepare('SELECT * FROM findings ORDER BY impact_score DESC').all();
    console.log(`\n=== ALL FINDINGS (${rows.length}) ===`);
    rows.forEach(r => {
      console.log(`\n[${r.priority}] ${r.title} (impact: ${r.impact_score}, effort: ${r.effort_score})`);
      console.log(`  Category: ${r.category}/${r.subcategory}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  ${r.description.substring(0, 200)}...`);
    });
  },

  bottlenecks: () => {
    const rows = db.prepare('SELECT * FROM bottlenecks ORDER BY CASE severity WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 WHEN "low" THEN 4 END').all();
    console.log(`\n=== ALL BOTTLENECKS (${rows.length}) ===`);
    rows.forEach(r => {
      console.log(`\n[${r.severity.toUpperCase()}] ${r.file_path}:${r.line_start}-${r.line_end}`);
      console.log(`  Type: ${r.bottleneck_type}`);
      console.log(`  ${r.description}`);
      console.log(`  Fix: ${r.fix_description}`);
      console.log(`  Est FPS gain: +${r.estimated_fps_gain}`);
    });
  },

  techniques: () => {
    const rows = db.prepare('SELECT * FROM techniques ORDER BY applicability_score DESC').all();
    console.log(`\n=== ALL TECHNIQUES (${rows.length}) ===`);
    rows.forEach(r => {
      console.log(`\n[${r.applicability_score}] ${r.name} (${r.category})`);
      console.log(`  Gain: ${r.performance_gain_estimate}`);
      console.log(`  ${r.description.substring(0, 300)}`);
      if (r.risks) console.log(`  Risks: ${r.risks}`);
    });
  },

  wasm: () => {
    const rows = db.prepare('SELECT * FROM wasm_candidates ORDER BY feasibility DESC').all();
    console.log(`\n=== WASM CANDIDATES (${rows.length}) ===`);
    rows.forEach(r => {
      console.log(`\n[${r.feasibility}] ${r.module_name} → ${r.target_language}`);
      console.log(`  Current: ${r.current_file} (${r.current_language})`);
      console.log(`  Speedup: ${r.estimated_speedup}`);
      console.log(`  ${r.description.substring(0, 300)}`);
    });
  },

  algorithms: () => {
    const rows = db.prepare('SELECT * FROM algorithms').all();
    console.log(`\n=== ALGORITHM ALTERNATIVES (${rows.length}) ===`);
    rows.forEach(r => {
      console.log(`\n[${r.problem_domain}]`);
      console.log(`  Current: ${r.current_algorithm} ${r.time_complexity_current}`);
      console.log(`  Proposed: ${r.proposed_algorithm} ${r.time_complexity_proposed}`);
      console.log(`  ${r.description.substring(0, 300)}`);
    });
  },

  patterns: () => {
    const rows = db.prepare('SELECT * FROM code_patterns').all();
    console.log(`\n=== CODE PATTERNS (${rows.length}) ===`);
    rows.forEach(r => {
      console.log(`\n--- ${r.pattern_name} ---`);
      console.log(`  Impact: ${r.estimated_impact}`);
      console.log(`  ${r.explanation.substring(0, 200)}`);
      if (r.applicable_files) console.log(`  Files: ${r.applicable_files}`);
    });
  },

  all: () => {
    queries.summary();
    queries.findings();
    queries.bottlenecks();
    queries.techniques();
    queries.wasm();
    queries.algorithms();
    queries.patterns();
  }
};

if (queries[query]) {
  queries[query]();
} else {
  console.log('Unknown query. Available: summary, findings, bottlenecks, techniques, wasm, algorithms, patterns, all');
}

db.close();
