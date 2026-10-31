<script>
// A filter that can hold several values (clusters, namespaces). Picking an option applies it
// and closes the menu, like Rancher's own selects; a click outside or Esc closes it too. Open it
// again to add another. Options stay listed whatever is picked.
export default {
  name: 'MultiPick',

  props: {
    label:     { type: String, required: true },
    // [{ value, label }]
    options:   { type: Array, default: () => [] },
    value:     { type: Array, default: () => [] },
    allText:   { type: String, required: true },
    clearText: { type: String, required: true },
    // Shown in the search box when the list is long.
    findText:  { type: String, default: '' },
  },

  emits: ['change'],

  data() {
    return {
      open: false, find: '', at: null
    };
  },

  computed: {
    picked() {
      return this.options.filter((o) => this.value.includes(o.value));
    },
    summary() {
      if (!this.value.length) {
        return this.allText;
      }
      const names = this.value.map((v) => this.options.find((o) => o.value === v)?.label || v);

      return names.length > 2 ? `${ names.slice(0, 2).join('、') } +${ names.length - 2 }` : names.join('、');
    },
    shown() {
      const f = this.find.trim().toLowerCase();

      return f ? this.options.filter((o) => o.label.toLowerCase().includes(f) || String(o.value).toLowerCase().includes(f)) : this.options;
    },
  },

  beforeUnmount() {
    this.unlisten();
  },

  methods: {
    toggleMenu() {
      if (this.open) {
        this.close();
      } else {
        this.openMenu();
      }
    },
    openMenu() {
      // Placed against the window, not inside the toolbar: the toolbar clips what overflows it.
      const r = this.$refs.btn.getBoundingClientRect();

      this.at = { top: `${ r.bottom + 4 }px`, left: `${ r.left }px` };
      this.open = true;
      this.find = '';
      document.addEventListener('mousedown', this.outside, true);
      document.addEventListener('keydown', this.onKey, true);
      window.addEventListener('resize', this.close);
    },
    close() {
      this.open = false;
      this.unlisten();
    },
    unlisten() {
      document.removeEventListener('mousedown', this.outside, true);
      document.removeEventListener('keydown', this.onKey, true);
      window.removeEventListener('resize', this.close);
    },
    outside(e) {
      if (!this.$el.contains(e.target)) {
        this.close();
      }
    },
    onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    },
    pick(v) {
      const cur = this.value;

      this.$emit('change', cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
      this.close();
    },
    clear() {
      this.$emit('change', []);
      this.close();
    },
  },
};
</script>

<template>
  <div
    class="mpick"
    :class="{open}"
  >
    <button
      ref="btn"
      type="button"
      class="mpick-btn"
      :aria-expanded="String(open)"
      :title="value.length ? summary : null"
      @click="toggleMenu"
    >
      <span class="mpick-label">{{ label }}</span>
      <b>{{ summary }}</b>
      <span
        class="mpick-caret"
        aria-hidden="true"
      >▾</span>
    </button>
    <div
      v-if="open"
      class="mpick-pop"
      :style="at"
      role="listbox"
      aria-multiselectable="true"
    >
      <input
        v-if="options.length > 8"
        v-model="find"
        class="mpick-find"
        type="search"
        :placeholder="findText"
        :aria-label="findText"
      >
      <button
        type="button"
        class="mpick-opt"
        :class="{on: !value.length}"
        @click="clear"
      >
        <span class="box">{{ !value.length ? '✓' : '' }}</span> {{ allText }}
      </button>
      <button
        v-for="o in shown"
        :key="o.value"
        type="button"
        role="option"
        class="mpick-opt"
        :class="{on: value.includes(o.value)}"
        :aria-selected="String(value.includes(o.value))"
        :title="o.label !== o.value ? o.value : null"
        @click="pick(o.value)"
      >
        <span class="box">{{ value.includes(o.value) ? '✓' : '' }}</span> {{ o.label }}
      </button>
      <button
        v-if="value.length"
        type="button"
        class="mpick-opt clear"
        @click="clear"
      >
        {{ clearText }}
      </button>
    </div>
  </div>
</template>

<style lang="scss">
.al5 .mpick { position: relative; display: inline-block; }
.al5 .mpick-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px;
  border: 1px solid var(--al-border); border-radius: 4px; background: var(--al-surface); color: inherit; cursor: pointer;
  max-width: 260px;
}
.al5 .mpick-btn b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.al5 .mpick-label { color: var(--al-muted); }
.al5 .mpick-caret { color: var(--al-muted); font-size: 11px; }
.al5 .mpick-pop {
  position: fixed; z-index: 40; min-width: 220px; max-height: 320px; overflow: auto;
  background: var(--al-surface); border: 1px solid var(--al-border); border-radius: 4px; padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, .25);
}
.al5 .mpick-find { width: 100%; margin-bottom: 4px; }
.al5 .mpick-opt {
  display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; padding: 5px 6px;
  border: 0; background: none; color: inherit; cursor: pointer; border-radius: 3px; white-space: nowrap;
}
.al5 .mpick-opt:hover { background: var(--al-hover, rgba(127, 127, 127, .15)); }
.al5 .mpick-opt .box { display: inline-block; width: 14px; text-align: center; color: var(--al-accent, #30ba78); }
.al5 .mpick-opt.clear { color: var(--al-muted); border-top: 1px solid var(--al-border); border-radius: 0; margin-top: 4px; }
</style>
