<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

navigateTo('/admin/games?tab=trash', { redirectCode: 301 })
</script>
