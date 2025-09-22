<template>
  <div class="morse-border">
    <svg
      :width="width"
      :height="height"
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      class="morse-svg"
    >
      <g>
        <path
          :d="morsePattern"
          stroke="currentColor"
          :stroke-width="strokeWidth"
          fill="none"
          stroke-linecap="butt"
          stroke-linejoin="miter"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
  text?: string;
  height?: number;
  width?: string;
  strokeWidth?: number;
  dotLength?: number;
  dashLength?: number;
  spacing?: number;
  letterSpacing?: number;
}

const props = withDefaults(defineProps<Props>(), {
  text: 'BEGGAR SOCKET',
  height: 2,
  width: '100%',
  strokeWidth: 0.5,
  dotLength: 1,
  dashLength: 3,
  spacing: 1,
  letterSpacing: 4,
});

// 摩尔斯代码映射表
const morseCodeMap: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  ' ': ' ',
};

/**
 * 将文本转换为摩尔斯代码
 */
const morseCode = computed(() => {
  return props.text
    .toUpperCase()
    .split('')
    .map(char => morseCodeMap[char] || '')
    .filter(code => code !== '')
    .join(' ');
});

/**
 * 生成SVG路径
 */
const morsePattern = computed(() => {
  const code = morseCode.value;
  let x = 0;
  const y = 2; // 居中在viewBox高度4的中间
  const pathSegments: string[] = [];

  for (const char of code) {
    if (char === '.') {
      // 点：短线段
      pathSegments.push(`M ${x} ${y} L ${x + props.dotLength} ${y}`);
      x += props.dotLength + props.spacing;
    } else if (char === '-') {
      // 横：长线段
      pathSegments.push(`M ${x} ${y} L ${x + props.dashLength} ${y}`);
      x += props.dashLength + props.spacing;
    } else if (char === ' ') {
      // 字符间距
      x += props.letterSpacing;
    }
  }

  // 将路径缩放到适应viewBox
  const totalLength = x;
  if (totalLength > 0 && pathSegments.length > 0) {
    const scale = 100 / totalLength;
    const scaledSegments = pathSegments.map(segment => {
      // 分别处理X和Y坐标
      return segment.replace(/M (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) L (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g,
        (match: string, x1: string, y1: string, x2: string, y2: string) => {
          const scaledX1 = (parseFloat(x1) * scale).toFixed(2);
          const scaledX2 = (parseFloat(x2) * scale).toFixed(2);
          return `M ${scaledX1} ${y1} L ${scaledX2} ${y2}`;
        });
    });
    return scaledSegments.join(' ');
  }

  return 'M 0 2 L 100 2'; // 默认返回一条居中的直线
});
</script>

<style lang="scss" scoped>
@use '@/styles/mixins' as mixins;

.morse-border {
  width: 100%;
  height: 100%;
  position: relative;
  display: block;
  overflow: hidden;

  .morse-svg {
    display: block;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    color: var(--color-border, #d1d5db);
    @include mixins.transition(color, 0.3s, ease);

    path {
      stroke: currentColor;
      fill: none;
      vector-effect: non-scaling-stroke;
    }

    &:hover {
      color: var(--color-primary, #42b883);
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
    }
  }
}
</style>
