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

export const DEFAULT_DEFORMATION_SCALE = 10;

export const useFEAStore = defineStore('fea', () => {
  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  // 当前生效的变形显示状态：仅在有求解结果时才可能为 true
  const showDeformed = ref(false);
  const deformationScale = ref(DEFAULT_DEFORMATION_SCALE);
  // 记住用户最后一次的选择，重新求解后恢复
  const lastShowDeformed = ref(false);
  const lastDeformationScale = ref(DEFAULT_DEFORMATION_SCALE);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');

  const hasResult = computed(() => result.value !== null);

  // ─── Actions ──────────────────────────────────────────────────────────────
  function loadPreset(name: string) {
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    // 切换算例：变形显示与缩放一起归位到默认，残留的缩放不能带到新模型
    showDeformed.value = false;
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
    // 重新计算后恢复用户最后的选择
    showDeformed.value = lastShowDeformed.value;
    deformationScale.value = lastDeformationScale.value;
  }

  function toggleDeformed() {
    // 没有结果时开关不生效，勾选状态必须与画布实际显示保持一致
    if (!result.value) {
      showDeformed.value = false;
      return;
    }
    showDeformed.value = !showDeformed.value;
    lastShowDeformed.value = showDeformed.value;
  }

  function setDeformationScale(value: number) {
    if (!result.value) return;
    deformationScale.value = value;
    lastDeformationScale.value = value;
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
    selectedElement,
    heatmapMode,
    hasResult,
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
