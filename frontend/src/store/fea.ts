import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FEAModel, FEAResult } from '../types';
import {
  solve as feaSolve,
  presetCantileverBeam,
  presetBridgeTruss,
  presetSimpleFrame,
  jetColormap,
} from '../utils/fea-solver';

export const useFEAStore = defineStore('fea', () => {
  const DEFAULT_SHOW_DEFORMED = false;
  const DEFAULT_DEFORMATION_SCALE = 10;

  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  // 当前生效的变形显示状态：只有存在计算结果时才可能为 true
  const showDeformed = ref(false);
  const deformationScale = ref(DEFAULT_DEFORMATION_SCALE);
  // 用户最后一次选择的偏好：重新求解后恢复
  const lastShowDeformed = ref(DEFAULT_SHOW_DEFORMED);
  const lastDeformationScale = ref(DEFAULT_DEFORMATION_SCALE);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');

  const hasResult = computed(() => result.value !== null);

  // ─── Actions ──────────────────────────────────────────────────────────────
  function loadPreset(name: string) {
    // 记住用户最后的变形偏好，供重新求解后恢复
    lastShowDeformed.value = showDeformed.value;
    lastDeformationScale.value = deformationScale.value;
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    // 切换算例：变形显示与缩放一起归位到默认（新模型尚无结果）
    showDeformed.value = DEFAULT_SHOW_DEFORMED;
    deformationScale.value = DEFAULT_DEFORMATION_SCALE;
    switch (name) {
      case 'cantilever':
        model.value = presetCantileverBeam();
        break;
      case 'bridge':
        model.value = presetBridgeTruss();
        break;
      case 'frame':
        model.value = presetSimpleFrame();
        break;
      default:
        model.value = presetCantileverBeam();
    }
  }

  function solve() {
    result.value = feaSolve(model.value);
    // 重新计算完成后恢复用户最后的变形选择与缩放
    showDeformed.value = lastShowDeformed.value;
    deformationScale.value = lastDeformationScale.value;
  }

  function toggleDeformed() {
    // 没有计算结果时变形网格无从显示，按结果状态忽略切换
    if (!result.value) return;
    showDeformed.value = !showDeformed.value;
    lastShowDeformed.value = showDeformed.value;
  }

  function setDeformationScale(value: number) {
    deformationScale.value = value;
    if (result.value) lastDeformationScale.value = value;
  }

  function selectElement(id: number | null) {
    selectedElement.value = id;
  }

  function setHeatmapMode(mode: 'stress' | 'strain' | 'force') {
    heatmapMode.value = mode;
  }

  function addLoad(nodeId: number, fx: number, fy: number) {
    model.value.loads.push({ nodeId, fx, fy });
  }

  function toggleFixed(nodeId: number) {
    const node = model.value.nodes.find((n) => n.id === nodeId);
    if (node) node.fixed = !node.fixed;
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const maxStress = computed(() => {
    if (!result.value) return 0;
    return result.value.maxStress;
  });

  const maxDisplacement = computed(() => {
    if (!result.value) return 0;
    return result.value.maxDisplacement;
  });

  const elementColors = computed(() => {
    const colors = new Map<number, string>();
    if (!result.value || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = result.value.stresses.map(Math.abs);
        break;
      case 'strain':
        values = result.value.strains.map(Math.abs);
        break;
      case 'force':
        values = model.value.elements.map((e) => Math.abs(e.force));
        break;
      default:
        values = result.value.stresses.map(Math.abs);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  });

  return {
    model,
    result,
    selectedPreset,
    showDeformed,
    deformationScale,
    hasResult,
    selectedElement,
    heatmapMode,
    maxStress,
    maxDisplacement,
    elementColors,
    loadPreset,
    solve,
    toggleDeformed,
    setDeformationScale,
    selectElement,
    setHeatmapMode,
    addLoad,
    toggleFixed,
  };
});
