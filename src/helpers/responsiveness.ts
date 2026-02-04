import type { WebGPURenderer } from 'three/webgpu'

export function resizeRendererToDisplaySize(renderer: WebGPURenderer) {
  const canvas = renderer.domElement
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const needResize = canvas.width !== width || canvas.height !== height
  if (needResize) {
    renderer.setSize(width, height, false)
  }
  return needResize
}
