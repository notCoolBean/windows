import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { getAgentNotReadyReasonKeys } from './agent-readiness.ts'

// Run the actual startup reconciliation with isolated API/store boundaries.
const exportsByModule = {
  '@/api/model': ['createModel', 'listModels', 'updateModel', 'putModelCredentials'],
  '@/api/agent': ['getAgentById', 'updateAgent'],
  '@/stores/chatResources': ['useChatResourcesStore'],
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('./offlineModels.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'offline-api-fixtures', setup(build) {
    build.onResolve({ filter: /^@\// }, args => {
      if (args.path in exportsByModule) return { path: args.path, namespace: 'fixture' }
    })
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents:
      "export const BUILTIN_QUICK_ANSWER_ID = 'builtin-quick-answer';\n" +
      exportsByModule[args.path].map(name =>
        `export const ${name} = (...args) => globalThis.offlineFixture.${name}(...args);`,
      ).join('\n'),
    }))
  } }],
})
const { syncOfflineModels } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))

function fixture(config = {}) {
  const state = { models: [], writes: 0, snapshot: null,
    agent: { id: 'builtin-quick-answer', name: '快速问答', config: { agent_mode: 'quick-answer', ...config } },
    catalog: { primary: 'text', base_url: 'http://127.0.0.1:1234', key: 'local-test-key', models: [
      { id: 'text', name: 'Qwen.gguf', kind: 'KnowledgeQA' },
      { id: 'embed', name: 'BGE.gguf', kind: 'Embedding', dimension: 512 },
    ] },
  }
  globalThis.window = { go: { main: { App: { GetOfflineModels: async () => state.catalog } } } }
  globalThis.offlineFixture = {
    listModels: async () => structuredClone(state.models),
    createModel: async model => state.models.push({ ...model, id: `model-${state.models.length}` }),
    updateModel: async (id, config) => Object.assign(state.models.find(model => model.id === id), config),
    putModelCredentials: async () => {},
    getAgentById: async id => { assert.equal(id, state.agent.id); return { data: structuredClone(state.agent) } },
    updateAgent: async (id, config) => { assert.equal(id, state.agent.id); state.writes++; Object.assign(state.agent, config) },
    useChatResourcesStore: () => ({
      replaceModels: models => { state.visibleModels = models },
      ensureAgents: async force => { assert.equal(force, true); state.snapshot = structuredClone(state.agent) },
    }),
  }
  return state
}

test('fresh offline startup binds quick-answer and refreshes the send-time readiness snapshot', async () => {
  const state = fixture({ temperature: 0.2, system_prompt: '保留提示词' })
  await syncOfflineModels()
  assert.equal(state.snapshot.config.model_id, 'model-0')
  assert.equal(state.snapshot.config.system_prompt, '保留提示词')
  assert.equal(state.snapshot.config.temperature, 0.2)
  assert.deepEqual(getAgentNotReadyReasonKeys(state.snapshot.config, state.visibleModels,
    { isAgentMode: false, isSharedAgent: false }), [])
  await syncOfflineModels()
  assert.equal(state.writes, 1, 'restart must not rewrite an already valid binding')
  assert.equal(state.models.length, 2)
})

test('preserves an existing user-selected chat model', async () => {
  const state = fixture({ model_id: 'user-model' })
  state.models.push({ id: 'user-model', type: 'KnowledgeQA' })
  await syncOfflineModels()
  assert.equal(state.snapshot.config.model_id, 'user-model')
  assert.equal(state.writes, 0)
})

test('repairs a deleted model binding using the preferred offline text model', async () => {
  const state = fixture({ model_id: 'deleted' })
  state.catalog.models.push({ id: 'preferred', name: 'Other.gguf', kind: 'KnowledgeQA' })
  state.catalog.primary = 'preferred'
  await syncOfflineModels()
  assert.equal(state.snapshot.config.model_id, 'model-2')
})

test('does not bind an embedding or vision model as the chat model', async () => {
  const state = fixture()
  state.catalog.models = [{ id: 'vision', name: 'Vision.gguf', kind: 'VLLM' }]
  state.catalog.primary = 'vision'
  await syncOfflineModels()
  assert.equal(state.writes, 0)
})

test('a failed binding keeps startup in its retryable error path', async () => {
  fixture()
  globalThis.offlineFixture.updateAgent = async () => { throw new Error('save failed') }
  await assert.rejects(syncOfflineModels(), /save failed/)
})
