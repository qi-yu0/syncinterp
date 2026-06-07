<template>
  <transition name="fade">
    <div v-if="message" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
      {{ message }}
    </div>
  </transition>
</template>

<script setup>
defineProps({
  message: String
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>