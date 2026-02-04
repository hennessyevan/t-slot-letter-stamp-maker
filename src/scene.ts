import JSZip from 'jszip'
import GUI from 'lil-gui'
import { DragControls } from 'three/addons/controls/DragControls.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  FontLoader,
  STLExporter,
  TextGeometry,
  TTFLoader,
} from 'three/examples/jsm/Addons.js'
import {
  AmbientLight,
  AxesHelper,
  Box3,
  BoxGeometry,
  GridHelper,
  Group,
  LoadingManager,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  PointLightHelper,
  Scene,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu'
import { requestFlexLayout } from 'troika-flex-layout'
import { toggleFullScreen } from './helpers/fullscreen'
import { resizeRendererToDisplaySize } from './helpers/responsiveness'

import './style.css'

const CANVAS_ID = 'scene'

let canvas: HTMLElement
let renderer: WebGPURenderer
let scene: Scene
let loadingManager: LoadingManager
let ambientLight: AmbientLight
let pointLight: PointLight
let centerPoint: Mesh
let camera: PerspectiveCamera
let cameraControls: OrbitControls
let dragControls: DragControls
let axesHelper: AxesHelper
let pointLightHelper: PointLightHelper
let gui: GUI
let gridHelper: GridHelper
let ttfLoader = new TTFLoader()
let fontBuffer: ArrayBuffer
let fontLoader = new FontLoader()
let characters: Group[] = []
let textToExtrude = 'ABCDE'
let exporter: STLExporter

let textDepth = 0.35
let textHeight = 1
let tslotHolderHeight = 1.25
let tslotBaseDepth = 0.15
let tslotBaseNotchHeight = 0.3

const animation = { enabled: true, play: true }

init()
animate()

function init() {
  // ===== 🖼️ CANVAS, RENDERER, & SCENE =====
  {
    renderer = new WebGPURenderer()
    renderer.setSize(document.body.clientWidth, document.body.clientHeight)
    renderer.alpha = true
    canvas = renderer.domElement
    canvas.id = CANVAS_ID
    document.body.appendChild(canvas)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFSoftShadowMap
    scene = new Scene()
  }

  // ===== FONT LOADER =====
  async function renderText() {
    clearTextMeshes()
    if (!fontBuffer) {
      fontBuffer = await fetch('/Bookman Sans.ttf').then((res) =>
        res.arrayBuffer(),
      )
    }
    const fontData = ttfLoader.parse(fontBuffer)
    const font = fontLoader.parse(fontData)

    const textGeometries = textToExtrude.split('').map((char) => {
      if (char === ' ') {
        // create a space geometry
        const spaceWidth = font.data.glyphs[' '].ha / 1000
        const geometry = new BoxGeometry(spaceWidth, 0.01, 0.01)
        return geometry
      } else {
        return new TextGeometry(char, {
          font,
          size: 1,
          depth: textDepth,
          curveSegments: 12,
          bevelEnabled: false,
        })
      }
    })

    // set tslot holder height based on tallest letter, extending the bottom down if there are descenders
    tslotHolderHeight = textHeight + 0.85 + font.data.descender / 1000

    textGeometries.forEach((geometry, i) => {
      // trying to make a stamp so we need a box around the letter shape
      const material = new MeshPhysicalMaterial({ color: 'white' })
      geometry.computeBoundingBox()
      geometry.name = 'LetterGeometry - ' + textToExtrude.charAt(i - 1)

      const bbox = geometry.boundingBox!

      const letter = new Mesh(geometry, material)

      // attach the letter to a quad box that is uniform in height, the letter should fit within this box with some padding on the top and bottom, especially for descenders
      const quadWidth = bbox.max.x - bbox.min.x
      const quadHeight = tslotHolderHeight
      const quadDepth = 0.125
      const quadGeometry = new BoxGeometry(quadWidth, quadHeight, quadDepth)
      const quadMaterial = new MeshPhysicalMaterial({
        color: 'pink',
      })
      const quadMesh = new Mesh(quadGeometry, quadMaterial)
      quadMesh.position.x = (bbox.max.x + bbox.min.x) / 2
      quadMesh.position.y = quadHeight / 2
      quadMesh.position.z = -quadDepth / 2

      // flip letter so that it is reversed for stamping
      letter.scale.x = -1
      // center letter geometry
      letter.position.x = bbox.max.x + bbox.min.x

      letter.position.y = quadMesh.position.y + font.data.descender / 1000
      letter.position.z = 0.01 // slight offset to avoid z-fighting

      // The slot base fits into the tslot holder
      const slotBaseWidth = quadWidth
      const slotBaseHeight = tslotBaseNotchHeight + quadHeight
      const slotBaseDepth = tslotBaseDepth
      const slotBaseGeometry = new BoxGeometry(
        slotBaseWidth,
        slotBaseHeight,
        slotBaseDepth,
      )
      const slotBaseMaterial = new MeshPhysicalMaterial({ color: 'cyan' })
      const slotBaseMesh = new Mesh(slotBaseGeometry, slotBaseMaterial)
      slotBaseMesh.position.x = (bbox.max.x + bbox.min.x) / 2
      slotBaseMesh.position.y = quadMesh.position.y
      slotBaseMesh.position.z =
        quadMesh.position.z - (quadDepth + slotBaseDepth) / 2
      ;[slotBaseMesh, quadMesh, letter].forEach((mesh) => {
        mesh.receiveShadow = true
        mesh.castShadow = true
      })

      // group all meshes for this letter
      const group = new Group()
      group.add(letter)
      group.add(quadMesh)
      group.add(slotBaseMesh)

      group.rotateX(-Math.PI / 2)

      characters.push(group)

      scene.add(group)
    })

    centerAndSpaceTextMeshes()
  }

  function clearTextMeshes() {
    characters.forEach((mesh) => {
      scene.remove(mesh)
    })
    characters = []
  }

  function centerAndSpaceTextMeshes() {
    requestFlexLayout(
      {
        id: 'root',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        children: characters.map((mesh) => {
          const size = new Box3().setFromObject(mesh).getSize(new Vector3())

          return {
            id: mesh.uuid,
            width: size.x + 0.2, // add some spacing  between letters
            height: size.y,
            children: [],
          }
        }),
      },
      (result) => {
        characters.forEach((mesh) => {
          const layout = Object.entries(result).find(
            ([id]) => id === mesh.uuid,
          )?.[1]

          if (layout) {
            mesh.position.x = layout.left - result.root.width / 2
          }
        })
      },
    )
  }

  // ===== EXPORTER =====
  {
    exporter = new STLExporter()

    async function exportMeshes() {
      if (characters.length === 0) {
        console.warn('No meshes to export')
        return
      }

      const zip = new JSZip()

      // Export each mesh as an STL file
      characters.forEach((mesh, index) => {
        const stlString = exporter.parse(mesh, { binary: false })
        const char = textToExtrude.charAt(index)
        const fileName = char ? `${char}.stl` : `letter_${index + 1}.stl`
        zip.file(fileName, stlString)
      })

      // Generate the zip file
      const blob = await zip.generateAsync({ type: 'blob' })

      // Create a download link and trigger it
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `stamps.zip`
      link.click()

      // Clean up the object URL
      URL.revokeObjectURL(link.href)
    }

    // Store function for GUI access
    ;(window as any).exportMeshes = exportMeshes
  }

  // ===== 👨🏻‍💼 LOADING MANAGER =====
  {
    loadingManager = new LoadingManager()

    loadingManager.onStart = () => {
      console.log('loading started')
    }
    loadingManager.onProgress = (url, loaded, total) => {
      console.log('loading in progress:')
      console.log(`${url} -> ${loaded} / ${total}`)
    }
    loadingManager.onLoad = () => {
      console.log('loaded!')
    }
    loadingManager.onError = () => {
      console.log('❌ error while loading')
    }
  }

  // ===== 💡 LIGHTS =====
  {
    ambientLight = new AmbientLight('white', 1)
    pointLight = new PointLight('white', 30, 100)
    pointLight.position.set(-2, 2, 2)
    pointLight.castShadow = true
    pointLight.shadow.radius = 4
    pointLight.shadow.camera.near = 0.1
    pointLight.shadow.camera.far = 1000
    pointLight.shadow.mapSize.width = 2048
    pointLight.shadow.mapSize.height = 2048
    scene.add(ambientLight)
    scene.add(pointLight)
  }

  // ===== 📦 OBJECTS =====
  {
    const sideLength = 1
    const cubeGeometry = new BoxGeometry(sideLength, sideLength, sideLength)
    centerPoint = new Mesh(cubeGeometry)
    centerPoint.castShadow = true
    centerPoint.position.y = 0.5
  }

  // ===== 🎥 CAMERA =====
  {
    camera = new PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      1,
      10_000,
    )
    camera.position.set(2, 2, 5)
  }

  // ===== 🕹️ CONTROLS =====
  {
    cameraControls = new OrbitControls(camera, canvas)
    cameraControls.target = centerPoint.position.clone()
    cameraControls.enableDamping = true
    cameraControls.autoRotate = false
    cameraControls.update()

    dragControls = new DragControls([centerPoint], camera, renderer.domElement)
    dragControls.addEventListener('hoveron', (event) => {
      const mesh = event.object as Mesh
      const material = mesh.material as MeshStandardMaterial
      material.emissive.set('green')
    })
    dragControls.addEventListener('hoveroff', (event) => {
      const mesh = event.object as Mesh
      const material = mesh.material as MeshStandardMaterial
      material.emissive.set('black')
    })
    dragControls.addEventListener('dragstart', (event) => {
      const mesh = event.object as Mesh
      const material = mesh.material as MeshStandardMaterial
      cameraControls.enabled = false
      animation.play = false
      material.emissive.set('orange')
      material.opacity = 0.7
      material.needsUpdate = true
    })
    dragControls.addEventListener('dragend', (event) => {
      cameraControls.enabled = true
      animation.play = true
      const mesh = event.object as Mesh
      const material = mesh.material as MeshStandardMaterial
      material.emissive.set('black')
      material.opacity = 1
      material.needsUpdate = true
    })
    dragControls.enabled = false

    // Full screen
    window.addEventListener('dblclick', (event) => {
      if (event.target === canvas) {
        toggleFullScreen(canvas)
      }
    })
  }

  // ===== 🪄 HELPERS =====
  {
    axesHelper = new AxesHelper(4)
    axesHelper.visible = true
    scene.add(axesHelper)

    pointLightHelper = new PointLightHelper(pointLight, undefined, 'orange')
    pointLightHelper.visible = false
    scene.add(pointLightHelper)

    gridHelper = new GridHelper(20, 20, 'teal', 'darkgray')
    gridHelper.position.y = -0.01
    scene.add(gridHelper)
  }

  // ==== 🐞 DEBUG GUI ====
  {
    gui = new GUI({ title: 'CONTROLS', width: 300 })

    const textFolder = gui.addFolder('Text')
    textFolder
      .add({ text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ&. ' }, 'text')
      .name('text to extrude')
      .onChange((value: string) => {
        textToExtrude = value
        renderText()
      })

    textFolder
      .add({ depth: textDepth }, 'depth', 0.1, 1, 0.05)
      .name('text depth (mm)')
      .onChange((value: number) => {
        textDepth = value
        renderText()
      })

    const helpersFolder = gui.addFolder('Helpers')
    helpersFolder.add(axesHelper, 'visible').name('axes')

    // persist GUI state in local storage on changes
    gui.onFinishChange(() => {
      const guiState = gui.save()
      localStorage.setItem('guiState', JSON.stringify(guiState))
    })

    // load GUI state if available in local storage
    const guiState = localStorage.getItem('guiState')
    if (guiState) gui.load(JSON.parse(guiState))

    // reset GUI state button
    const resetGui = () => {
      localStorage.removeItem('guiState')
      gui.reset()
      renderText()
    }
    gui.add({ resetGui }, 'resetGui').name('RESET')

    // export button
    const exportStamps = () => {
      ;(window as any).exportMeshes()
    }
    gui.add({ exportStamps }, 'exportStamps').name('📦 EXPORT STLs')
  }
}

function animate() {
  requestAnimationFrame(animate)

  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    camera.updateProjectionMatrix()
  }

  cameraControls.update()

  renderer.renderAsync(scene, camera)
}
