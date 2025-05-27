<template>
  <div>
    <input
      type="file"
      @change="onFileChange"
    >
    <span v-if="fileName">已选择: {{ fileName }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['file-selected'])
const fileName = ref('')

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    emit('file-selected', new Uint8Array(reader.result))
  }
  reader.readAsArrayBuffer(file)
}
</script>
