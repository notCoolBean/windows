<template>
  <main class="offline-page">
    <h1>离线模型</h1>
    <p>完整版已随附文字、视觉和中文向量模型，首次启动会自动连接。也可导入其他 GGUF 模型，所有推理在本机完成。</p>
    <div class="import-actions">
      <t-button :disabled="busy || !bridge" @click="importModel('KnowledgeQA')">导入文字模型</t-button>
      <t-button variant="outline" :disabled="busy || !bridge" @click="importModel('Embedding')">导入向量模型</t-button>
      <t-button variant="outline" :disabled="busy || !bridge" @click="importModel('VLLM')">导入视觉模型</t-button>
    </div>
    <p role="status" :class="{ error: failed }">{{ status }}</p>
    <p v-if="!bridge">请从安装后的桌面应用打开此页面。</p>
    <article v-for="model in catalog?.models" :key="model.id">
      <div><strong>{{ model.name }}</strong><p>{{ labels[model.kind] }} · {{ (model.size / 1024 ** 3).toFixed(2) }} GB<span v-if="model.dimension"> · {{ model.dimension }} 维</span></p></div>
      <t-button v-if="model.kind === 'KnowledgeQA'" variant="outline" :disabled="busy || model.id === catalog?.primary" @click="setPrimary(model.id)">
        {{ model.id === catalog?.primary ? '办公功能当前模型' : '用于办公功能' }}
      </t-button>
    </article>
    <section>
      <h2>开始使用</h2>
      <p>文字模型用于对话、仿写和校对。向量模型用于知识库检索，导入时会自动检测维度。视觉模型还需选择配套的 mmproj 文件。</p>
      <p>导入文字和向量模型后，在知识库中选择这两个模型，再上传资料。已有知识库继续使用原来的向量模型；更换时请新建知识库并重新导入资料。</p>
      <t-button variant="text" @click="router.push('/platform/knowledge-bases')">进入知识库</t-button>
    </section>
  </main>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { offlineBridge, syncOfflineModels, type OfflineCatalog } from '@/utils/offlineModels'
const bridge = offlineBridge()
const router = useRouter()
const catalog = ref<OfflineCatalog>()
const busy = ref(false)
const failed = ref(false)
const status = ref('')
const labels = { KnowledgeQA: '文字模型', Embedding: '向量模型', VLLM: '视觉模型' }
onMounted(async () => { try { catalog.value = await bridge?.GetOfflineModels() } catch (e) { failed.value = true; status.value = String(e) } })
async function importModel(kind: string) {
  if (!bridge) return
  busy.value = true; failed.value = false
  status.value = '请选择模型文件。复制及加载检查可能需要几分钟，请保持应用打开。'
  try { catalog.value = await syncOfflineModels(await bridge.ImportOfflineModel(kind)); status.value = '模型列表已同步，可以开始使用。' }
  catch (e) { failed.value = true; status.value = String(e) }
  finally { busy.value = false }
}
async function setPrimary(id: string) {
  if (!bridge) return
  busy.value = true
  try { await bridge.SetOfflinePrimary(id); catalog.value = await bridge.GetOfflineModels(); status.value = '办公功能模型已切换。' }
  catch (e) { failed.value = true; status.value = String(e) }
  finally { busy.value = false }
}
</script>
<style scoped>
.offline-page { padding: 36px; overflow: auto; height: 100%; box-sizing: border-box; color: var(--td-text-color-primary); background: var(--td-bg-color-container); }
h1 { font-size: 26px; margin: 0 0 12px; } h2 { font-size: 19px; }
p { font-size: 15px; line-height: 1.8; color: var(--td-text-color-secondary); }
.import-actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 24px 0; }
article { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 0; border-bottom: 1px solid var(--td-component-stroke); }
article p { margin: 4px 0 0; } section { max-width: 820px; margin-top: 32px; }
.error { color: var(--td-error-color); }
</style>
