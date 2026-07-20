<script setup lang="ts" generic="T">
export interface ColumnaTabla {
  key: string
  header: string
  width?: string
  align?: 'left' | 'right' | 'center'
}

withDefaults(
  defineProps<{
    columns: ColumnaTabla[]
    rows: T[]
    rowKey: (row: T) => string
    empty?: string
    clickable?: boolean
  }>(),
  { empty: 'Sin registros.', clickable: false },
)

const emit = defineEmits<{ rowClick: [row: T] }>()
</script>

<template>
  <div
    class="overflow-x-auto"
    :style="{
      border: 'var(--border-width) solid var(--cream-300)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--cream-50)',
    }"
  >
    <table class="w-full border-collapse" :style="{ font: 'var(--text-body) var(--font-sans)' }">
      <thead>
        <tr :style="{ background: 'var(--green-700)' }">
          <th
            v-for="columna in columns"
            :key="columna.key"
            class="whitespace-nowrap"
            :style="{
              textAlign: columna.align ?? 'left',
              padding: '14px 18px',
              font: '700 var(--text-sm)/1.2 var(--font-sans)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--cream-100)',
              width: columna.width,
            }"
          >
            {{ columna.header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td
            :colspan="columns.length"
            class="text-center"
            :style="{ padding: '32px', color: 'var(--clay-500)' }"
          >
            {{ empty }}
          </td>
        </tr>
        <tr
          v-for="row in rows"
          :key="rowKey(row)"
          class="fila-tabla"
          :style="{ cursor: clickable ? 'pointer' : 'default' }"
          @click="clickable && emit('rowClick', row)"
        >
          <td
            v-for="columna in columns"
            :key="columna.key"
            :style="{
              textAlign: columna.align ?? 'left',
              padding: '15px 18px',
              color: 'var(--green-900)',
              verticalAlign: 'middle',
            }"
          >
            <slot :name="`cell-${columna.key}`" :row="row">{{ (row as Record<string, unknown>)[columna.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.fila-tabla {
  border-top: 1px solid var(--cream-200);
  transition: background var(--duration-fast);
}
.fila-tabla:hover {
  background: var(--cream-100);
}
</style>
