<template>
  <div class="stage-chain">
    <div v-for="(s, i) in stages" :key="s.id" class="chain-item">
      <div class="chain-step" :class="stepClass(s.id)">
        <span class="step-idx">{{ i + 1 }}</span>
        <span class="step-body">
          <span class="step-label">{{ s.label }}</span>
          <span class="step-sub">{{ s.sub }}</span>
        </span>
        <span v-if="s.id === current" class="step-current">当前</span>
      </div>
      <div v-if="i < stages.length - 1" class="chain-arrow">↓</div>
    </div>
    <div v-if="round > 1" class="chain-round">第 {{ round }} 轮复评</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 样件评审模板 · 两段式阶段链（配置驱动）
 *
 * 渲染源唯一：`SAMPLE_REVIEW_STAGES` 数据定义；当前阶段高亮由入参 `current` 决定，
 * 组件内不硬编码 7 项评审项名、阶段名或任何业务判定（判定在 templateVerdictOf）。
 */
import { computed } from 'vue'
import { SAMPLE_REVIEW_STAGES, type ReviewTemplateStage } from '@/domain/sampleReviewTemplate'

const props = withDefaults(
  defineProps<{
    /** 当前业务阶段（唯一权威来自 templateVerdictOf().stage） */
    current: ReviewTemplateStage
    /** 复评轮次（>1 时展示轮次提示） */
    round?: number
  }>(),
  { round: 1 }
)

/** 数据定义：两段式流程链（评审 → 审批 → 归档） */
const stages = SAMPLE_REVIEW_STAGES

const currentOrder = computed<number>(
  () => stages.find((s) => s.id === props.current)?.order ?? 1
)

/** 阶段显隐求值：已完成 / 当前 / 未开始（不做业务判定，仅渲染高亮） */
function stepClass(id: ReviewTemplateStage): string {
  const s = stages.find((x) => x.id === id)
  if (!s) return ''
  if (s.order < currentOrder.value) return 'done'
  if (s.order === currentOrder.value) return 'active'
  return ''
}
</script>

<style scoped>
.stage-chain { display: flex; flex-direction: column; gap: 2px; }
.chain-item { display: flex; flex-direction: column; }
.chain-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--panel-bg, #0f1a2a);
}
.chain-step .step-idx {
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 50%;
  background: #16233a;
  font-size: 11px;
}
.step-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.step-label { color: var(--text-1); font-weight: 600; }
.step-sub { font-size: 11px; color: var(--text-3); }
.step-current { margin-left: auto; font-size: 10px; color: #93c5fd; border: 1px solid #1d3a5f; border-radius: 999px; padding: 1px 7px; }
.chain-step.active { border-color: #1d3a5f; color: #93c5fd; }
.chain-step.active .step-idx { background: #1d3a5f; color: #fff; }
.chain-step.done { border-color: #1d4a2e; color: #8ee6b0; }
.chain-step.done .step-idx { background: #1d4a2e; color: #fff; }
.chain-arrow { color: var(--text-3); font-size: 12px; line-height: 1; padding-left: 18px; }
.chain-round { margin-top: 6px; font-size: 11px; color: #ffd79a; }
</style>
