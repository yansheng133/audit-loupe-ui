<script>
import { stateLabel } from '../../lib/v5';

// One audit state label (look / unclear / blind / clear). The tooltip says why (spec §2).
export default {
  name:  'AlStateTag',
  props: {
    T:        { type: Object, required: true },
    state:    { type: String, default: '' },
    severity: { type: String, default: '' },
    reason:   { type: String, default: '' },
    // Overrides the state's own name, e.g. "normal" for a collector.
    label:    { type: String, default: '' },
    count:    { type: [Number, String], default: null },
    active:   { type: Boolean, default: false },
    clickable: { type: Boolean, default: false },
  },
  emits:    ['click'],
  computed: {
    text() {
      const l = this.label || stateLabel(this.T, this.state, this.severity);

      return this.count === null ? l : `${ l } ${ this.count }`;
    },
    title() {
      return [this.T.stateHint[this.state], this.reason].filter(Boolean).join('：');
    },
  },
};
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    class="stp"
    :class="[state, { active }]"
    :title="title"
    :aria-pressed="clickable ? String(active) : undefined"
    @click="clickable && $emit('click')"
  >{{ text }}</component>
</template>
