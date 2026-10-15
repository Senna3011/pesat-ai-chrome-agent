const test = require('node:test');
const assert = require('node:assert/strict');
const Agent = require('../extension/agent-engine.js');
const Registry = require('../extension/skills/skill-registry.js');

test('TaskSpec classifier keeps simple direct navigation off planner', () => {
  const task = Agent.createTaskSpec({ goal: 'buka https://example.com' });
  assert.equal(task.mode, 'execute');
  assert.equal(task.schemaVersion, 1);
  assert.equal(Agent.isSimpleDirectTask(task.goal), true);
  assert.equal(Agent.shouldUsePlanner(task.goal), false);
  assert.equal(Agent.shouldUsePlanner('riset tiga sumber lalu buat laporan'), true);
});

test('plan validation enforces ordering, tools, criteria, and budget', () => {
  const valid = Agent.validatePlan({ plan: [
    { id: 'r', objective: 'Cari sumber', kind: 'retrieve', tool: 'search_knowledge', successCriteria: [], sideEffect: 'none', risk: 'low' },
    { id: 'a', objective: 'Buka hasil', kind: 'act', dependencies: ['r'], tool: 'navigate_to', successCriteria: [{ type: 'url_matches', pattern: 'example' }], sideEffect: 'local', risk: 'medium' }
  ] }, { availableTools: ['search_knowledge', 'navigate_to'], maxSteps: 3, taskRisk: 'medium' });
  assert.equal(valid.valid, true, valid.errors.join('; '));

  const invalid = Agent.validatePlan({ plan: [
    { id: 'a', objective: 'Aksi', kind: 'act', dependencies: ['later'], tool: 'missing', successCriteria: [], sideEffect: 'external', risk: 'high' },
    { id: 'later', objective: 'Nanti', kind: 'analyze' }
  ] }, { availableTools: [], maxSteps: 2, taskRisk: 'low' });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /tool tidak tersedia|dependency harus mendahului|successCriteria|risk/);
});

test('strict parser fails closed', () => {
  assert.deepEqual(Agent.parseStrictJSON('```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => Agent.parseStrictJSON('penjelasan {"action":"click"}'), { code: 'PARSE_ERROR' });
  assert.throws(() => Agent.parseStrictJSON('{bad json}'), { code: 'PARSE_ERROR' });
});

test('JSON schema subset validates nested objects and rejects extras', () => {
  const schema = {
    type: 'object',
    properties: {
      fields: {
        type: 'array', minItems: 1, maxItems: 2,
        items: { type: 'object', properties: { identifier: { type: 'string', minLength: 1 }, value: { type: 'string' } }, required: ['identifier', 'value'], additionalProperties: false }
      }
    },
    required: ['fields'], additionalProperties: false
  };
  assert.equal(Agent.validateToolArguments({ fields: [{ identifier: 'email', value: 'a@b.co' }] }, schema).valid, true);
  const invalid = Agent.validateToolArguments({ fields: [{ identifier: '', value: 'x', leaked: true }] }, schema);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /terlalu pendek|tidak diizinkan/);
});

test('registry metadata validates and redacts native tool input', () => {
  const metadata = Registry.getToolMetadata('type_text');
  assert.equal(metadata.sideEffect, 'local');
  assert.equal(metadata.risk, 'medium');
  assert.equal(Registry.validateToolCall('type_text', { text: 'secret', pressEnter: true }).valid, true);
  assert.equal(Registry.validateToolCall('type_text', { pressEnter: true }).valid, false);
  assert.deepEqual(Registry.redactToolInput('type_text', { text: 'secret', password: 'hunter2' }), { text: '[REDACTED]', password: '[REDACTED]' });
});

test('structured ActionReceipt records safe input and error taxonomy', () => {
  const receipt = Agent.createActionReceipt({ stepId: 'step-1', tool: 'type_text', validatedInput: { text: '[REDACTED]' }, success: false, errorType: 'INVALID_INPUT' });
  assert.equal(receipt.stepId, 'step-1');
  assert.equal(receipt.success, false);
  assert.equal(receipt.errorType, 'INVALID_INPUT');
  assert.equal(receipt.schemaVersion, 1);
});

test('deterministic verifier is conclusive before LLM and fails closed', () => {
  const passed = Agent.verifyDeterministically({
    action: { action: 'navigate', url: 'https://example.com/a' },
    result: { success: true },
    beforeState: { url: 'https://old.test' },
    afterState: { url: 'https://example.com/a' }
  });
  assert.equal(passed.conclusive, true);
  assert.equal(passed.passed, true);

  const failed = Agent.verifyDeterministically({ action: { action: 'click' }, result: { success: false, error: 'not found' } });
  assert.equal(failed.passed, false);
  assert.equal(failed.errorType, 'EXECUTION_FAILED');

  const inconclusive = Agent.verifyDeterministically({ action: { action: 'click' }, result: { success: true, stateChanged: false } });
  assert.equal(inconclusive.conclusive, false);
});
