import { createModel, listModels, updateModel, putModelCredentials, type ModelConfig } from '@/api/model'
import { BUILTIN_QUICK_ANSWER_ID, getAgentById, updateAgent } from '@/api/agent'
import { useChatResourcesStore } from '@/stores/chatResources'
import { agentHasConfiguredChatModel } from './agent-readiness'

export interface OfflineModel {
  id: string
  name: string
  kind: 'KnowledgeQA' | 'Embedding' | 'VLLM'
  size: number
  dimension: number
}
export interface OfflineCatalog {
  models: OfflineModel[]
  primary: string
  base_url: string
  key: string
}
interface OfflineBridge {
  GetOfflineModels(): Promise<OfflineCatalog>
  InstallBundledModels(): Promise<OfflineCatalog>
  ImportOfflineModel(kind: string): Promise<OfflineCatalog>
  SetOfflinePrimary(id: string): Promise<void>
  OpenOffice(tool: string): Promise<string>
}
export const offlineBridge = (): OfflineBridge | undefined =>
  (window as any).go?.main?.App?.GetOfflineModels ? (window as any).go.main.App : undefined

// Ports and credentials are fresh on each launch; reconcile before any view
// can query an existing knowledge base. A model's identity never changes.
export async function syncOfflineModels(catalog?: OfflineCatalog): Promise<OfflineCatalog | undefined> {
  const bridge = offlineBridge()
  if (!bridge) return
  catalog ??= await bridge.GetOfflineModels()
  if (!catalog.models.length) return catalog
  const existing = await listModels()
  for (const model of catalog.models) {
    const description = `zhizhi-offline:${model.id}`
    const config: ModelConfig = {
      name: 'local', display_name: `离线 · ${model.name}`, type: model.kind,
      source: 'remote', description,
      parameters: {
        base_url: `${catalog.base_url}/${model.id}/v1`, provider: 'generic',
        context_window: 8192, max_concurrency: 1,
        ...(model.kind === 'Embedding' ? { embedding_parameters: { dimension: model.dimension } } : {}),
        ...(model.kind === 'VLLM' ? { interface_type: 'openai', supports_vision: true } : {}),
      },
    }
    const previous = existing.find(row => row.description === description)
    if (previous?.id) {
      await updateModel(previous.id, config)
      await putModelCredentials(previous.id, { api_key: catalog.key })
    } else {
      await createModel({ ...config, parameters: { ...config.parameters, api_key: catalog.key } })
    }
  }
  const models = await listModels()
  const resources = useChatResourcesStore()
  resources.replaceModels(models)
  const textModel = catalog.models.find(model => model.kind === 'KnowledgeQA' && model.id === catalog.primary)
    ?? catalog.models.find(model => model.kind === 'KnowledgeQA')
  const chatModel = textModel && models.find(model => model.description === `zhizhi-offline:${textModel.id}`)
  if (chatModel?.id) {
    const { data: agent } = await getAgentById(BUILTIN_QUICK_ANSWER_ID)
    // Registration alone does not make quick-answer ready: it needs an
    // explicit model binding. Preserve any existing usable user choice.
    if (!agentHasConfiguredChatModel(agent.config, models)) {
      await updateAgent(agent.id, {
        name: agent.name, description: agent.description,
        config: { ...agent.config, model_id: chatModel.id },
      })
    }
    await resources.ensureAgents(true)
  }
  return catalog
}
