// Plan operations utility for agents
// Usage: node research/plan-ops.cjs <operation> [args...]
//
// Operations:
//   list-tasks                                    - List all tasks
//   get-task <task_id>                            - Get task details
//   create-iteration <task_id> <iter_num> <agent> - Create new iteration
//   add-step <json>                               - Add step to iteration
//   add-vote <json>                               - Add vote
//   add-test <json>                               - Add test spec
//   accept-iteration <iteration_id>               - Mark iteration accepted
//   get-plan <task_id> [iter_num]                 - Get full plan (latest if no iter)
//   convergence <task_id>                         - Check convergence trend
//   link-research <step_id> <json>                - Link step to research
//   update-step-status <step_id> <status>         - Update step status
//   summary                                       - Overall summary

const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const op = process.argv[2];
const args = process.argv.slice(3);

const ops = {
  'list-tasks': () => {
    const rows = db.prepare('SELECT id, title, priority, status, target_fps_gain FROM tasks ORDER BY priority, id').all();
    console.log(JSON.stringify(rows, null, 2));
  },

  'get-task': () => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(args[0]);
    const iters = db.prepare('SELECT id, iteration_number, status, overall_score, convergence_delta, total_step_count FROM plan_iterations WHERE task_id = ? ORDER BY iteration_number').all(args[0]);
    console.log(JSON.stringify({ task, iterations: iters }, null, 2));
  },

  'create-iteration': () => {
    const [taskId, iterNum, agent] = args;
    const result = db.prepare(
      'INSERT INTO plan_iterations (task_id, iteration_number, agent_id) VALUES (?, ?, ?)'
    ).run(taskId, iterNum, agent || 'planner');
    console.log(JSON.stringify({ iteration_id: result.lastInsertRowid }));
  },

  'add-step': () => {
    const data = JSON.parse(args[0]);
    const cols = Object.keys(data);
    const stmt = db.prepare(
      `INSERT INTO plan_steps (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    );
    const result = stmt.run(...cols.map(c => data[c]));
    console.log(JSON.stringify({ step_id: result.lastInsertRowid }));
  },

  'add-steps-batch': () => {
    const steps = JSON.parse(args[0]);
    const insert = db.transaction((stepsArr) => {
      const ids = [];
      for (const data of stepsArr) {
        const cols = Object.keys(data);
        const stmt = db.prepare(
          `INSERT INTO plan_steps (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
        );
        const result = stmt.run(...cols.map(c => data[c]));
        ids.push(result.lastInsertRowid);
      }
      return ids;
    });
    const ids = insert(steps);
    console.log(JSON.stringify({ step_ids: ids }));
  },

  'add-vote': () => {
    const data = JSON.parse(args[0]);
    const cols = Object.keys(data);
    const stmt = db.prepare(
      `INSERT INTO plan_votes (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    );
    const result = stmt.run(...cols.map(c => data[c]));
    // Update cached score on iteration
    if (data.iteration_id) {
      db.prepare(`
        UPDATE plan_iterations SET
          overall_score = (SELECT AVG(score) FROM plan_votes WHERE iteration_id = ? AND score IS NOT NULL),
          vote_count = (SELECT COUNT(*) FROM plan_votes WHERE iteration_id = ?)
        WHERE id = ?
      `).run(data.iteration_id, data.iteration_id, data.iteration_id);
    }
    console.log(JSON.stringify({ vote_id: result.lastInsertRowid }));
  },

  'add-test': () => {
    const data = JSON.parse(args[0]);
    const cols = Object.keys(data);
    const stmt = db.prepare(
      `INSERT INTO test_specs (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    );
    const result = stmt.run(...cols.map(c => data[c]));
    console.log(JSON.stringify({ test_id: result.lastInsertRowid }));
  },

  'add-tests-batch': () => {
    const tests = JSON.parse(args[0]);
    const insert = db.transaction((testsArr) => {
      const ids = [];
      for (const data of testsArr) {
        const cols = Object.keys(data);
        const stmt = db.prepare(
          `INSERT INTO test_specs (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
        );
        const result = stmt.run(...cols.map(c => data[c]));
        ids.push(result.lastInsertRowid);
      }
      return ids;
    });
    const ids = insert(tests);
    console.log(JSON.stringify({ test_ids: ids }));
  },

  'accept-iteration': () => {
    const iterationId = args[0];
    const iter = db.prepare('SELECT task_id FROM plan_iterations WHERE id = ?').get(iterationId);
    if (iter) {
      db.prepare("UPDATE plan_iterations SET status = 'superseded' WHERE task_id = ? AND status = 'accepted'").run(iter.task_id);
      db.prepare("UPDATE plan_iterations SET status = 'accepted' WHERE id = ?").run(iterationId);
      console.log(JSON.stringify({ accepted: true }));
    }
  },

  'get-plan': () => {
    const taskId = args[0];
    const iterNum = args[1];
    let iter;
    if (iterNum) {
      iter = db.prepare('SELECT * FROM plan_iterations WHERE task_id = ? AND iteration_number = ?').get(taskId, iterNum);
    } else {
      iter = db.prepare("SELECT * FROM plan_iterations WHERE task_id = ? ORDER BY iteration_number DESC LIMIT 1").get(taskId);
    }
    if (!iter) { console.log('No iterations found'); return; }

    const steps = db.prepare(
      'SELECT * FROM plan_steps WHERE iteration_id = ? ORDER BY resolution, sequence_number'
    ).all(iter.id);
    const tests = db.prepare(
      'SELECT ts.* FROM test_specs ts JOIN plan_steps ps ON ts.step_id = ps.id WHERE ps.iteration_id = ?'
    ).all(iter.id);
    console.log(JSON.stringify({ iteration: iter, steps, tests }, null, 2));
  },

  'convergence': () => {
    const rows = db.prepare(
      'SELECT iteration_number, convergence_delta, overall_score, changed_step_count, total_step_count FROM plan_iterations WHERE task_id = ? ORDER BY iteration_number'
    ).all(args[0]);
    console.log(JSON.stringify(rows, null, 2));
  },

  'update-convergence': () => {
    const [iterationId, delta, changed, total] = args;
    db.prepare(
      'UPDATE plan_iterations SET convergence_delta = ?, changed_step_count = ?, total_step_count = ? WHERE id = ?'
    ).run(delta, changed, total, iterationId);
    console.log(JSON.stringify({ updated: true }));
  },

  'link-research': () => {
    const data = JSON.parse(args[1]);
    data.step_id = parseInt(args[0]);
    const cols = Object.keys(data);
    const stmt = db.prepare(
      `INSERT INTO plan_research_links (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    );
    stmt.run(...cols.map(c => data[c]));
    console.log(JSON.stringify({ linked: true }));
  },

  'update-step-status': () => {
    db.prepare('UPDATE plan_steps SET status = ? WHERE id = ?').run(args[1], args[0]);
    console.log(JSON.stringify({ updated: true }));
  },

  'summary': () => {
    const taskCount = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
    const iterCount = db.prepare('SELECT COUNT(*) as c FROM plan_iterations').get().c;
    const stepCount = db.prepare('SELECT COUNT(*) as c FROM plan_steps').get().c;
    const testCount = db.prepare('SELECT COUNT(*) as c FROM test_specs').get().c;
    const voteCount = db.prepare('SELECT COUNT(*) as c FROM plan_votes').get().c;

    const byStatus = db.prepare("SELECT status, COUNT(*) as c FROM tasks GROUP BY status").all();
    const converged = db.prepare("SELECT COUNT(DISTINCT task_id) as c FROM plan_iterations WHERE convergence_delta < 0.05 AND convergence_delta IS NOT NULL").get();

    console.log(JSON.stringify({
      tasks: taskCount, iterations: iterCount, steps: stepCount,
      tests: testCount, votes: voteCount,
      tasks_by_status: byStatus,
      converged_tasks: converged?.c || 0
    }, null, 2));
  }
};

if (ops[op]) {
  ops[op]();
} else {
  console.log('Unknown operation. Available:', Object.keys(ops).join(', '));
}
db.close();
