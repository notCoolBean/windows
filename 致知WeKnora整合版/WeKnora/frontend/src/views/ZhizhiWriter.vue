<template>
  <main class="writer-page">
    <p v-if="busy" role="status">正在打开文章仿写…</p>
    <div v-else-if="error" class="error">
      <p role="alert">{{ error }}</p>
      <t-button @click="open">重新打开</t-button>
    </div>
    <iframe v-if="url" :src="url" title="文章仿写：输入或上传范文，生成同风格新稿"></iframe>
  </main>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { offlineBridge } from '@/utils/offlineModels'

const url = ref('')
const error = ref('')
const busy = ref(true)
async function open() {
  busy.value = true; error.value = ''
  try {
    const bridge = offlineBridge()
    if (!bridge) throw new Error('请在安装后的桌面应用中使用文章仿写。')
    url.value = await bridge.OpenOffice('writer')
  } catch (e) { error.value = String(e) }
  finally { busy.value = false }
}
onMounted(open)
</script>
<style scoped>
.writer-page { display: flex; flex-direction: column; height: 100%; background: var(--td-bg-color-container); }
.writer-page > p, .error { padding: 16px 24px; }
iframe { flex: 1; width: 100%; min-height: 0; border: 0; }
</style>
