<template>
  <main class="office-page">
    <header>
      <h1>致知办公</h1>
      <t-button :variant="tool === 'writer' ? 'base' : 'outline'" :disabled="busy" @click="open('writer')">文章仿写</t-button>
      <t-button :variant="tool === 'office' ? 'base' : 'outline'" :disabled="busy" @click="open('office')">起草、校对与表格</t-button>
      <t-button v-for="item in legacyTools" :key="item.id" :variant="tool === item.id ? 'base' : 'outline'" :disabled="busy" @click="open(item.id)">{{ item.name }}</t-button>
      <t-button variant="text" @click="router.push('/platform/offline-models')">管理离线模型</t-button>
    </header>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">正在打开办公组件…</p>
    <iframe v-if="url" :key="url" :src="url" title="致知办公工具"></iframe>
    <p v-else-if="!busy">选择一项办公功能。文字生成使用「离线模型」中选定的办公模型，范文与编辑记录保存在本机。</p>
  </main>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { offlineBridge } from '@/utils/offlineModels'
const router = useRouter()
const tool = ref('')
const url = ref('')
const error = ref('')
const busy = ref(false)
const legacyTools = [{ id: 'analysis', name: '多维分析' }, { id: 'notes', name: '致知笔记' }, { id: 'notepad', name: '记事本' }, { id: 'query', name: '资料查询' }]
async function open(name: string) {
  busy.value = true; error.value = ''
  try {
    const bridge = offlineBridge()
    if (!bridge) throw new Error('请在安装后的桌面应用中使用。')
    url.value = await bridge.OpenOffice(name); tool.value = name
  } catch (e) { error.value = String(e) }
  finally { busy.value = false }
}
</script>
<style scoped>
.office-page { display: flex; flex-direction: column; height: 100%; background: var(--td-bg-color-container); }
header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--td-component-stroke); }
h1 { font-size: 20px; margin: 0 16px 0 0; } p { padding: 16px 24px; }
iframe { flex: 1; width: 100%; border: 0; min-height: 500px; }
</style>
