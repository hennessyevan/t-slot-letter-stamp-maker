import GUI from 'lil-gui'
import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  ExtrudeGeometry,
  GridHelper,
  LoadingManager,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  PointLightHelper,
  Scene,
  WebGPURenderer,
  type Shape,
} from 'three/webgpu'
import { DragControls } from 'three/addons/controls/DragControls.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Font, STLExporter, TTFLoader } from 'three/examples/jsm/Addons.js'
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
let fontLoader: TTFLoader
let font: Font
let fontShapes: Shape[]
let fontMeshes: Mesh[] = []
let textToExtrude = 'ABCDE'
let textDepth = 0.5
let tslotHolderHeight = 1.25
let exporter: STLExporter

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
    fontLoader = new TTFLoader()
    const data = await fontLoader.loadAsync('/Bookman Sans.ttf')
    font = new Font(data)

    fontShapes = font.generateShapes(textToExtrude, 1)
    fontShapes.forEach((shape) => {
      const geometry = new ExtrudeGeometry(shape, {
        depth: textDepth,
        bevelEnabled: false,
      })

      // trying to make a stamp so we need a box around the letter shape
      const material = new MeshPhysicalMaterial({ color: 'white' })
      geometry.computeBoundingBox()

      const bbox = geometry.boundingBox!

      const letter = new Mesh(geometry, material)

      // The slot base fits into the tslot holder
      const slotBaseWidth = bbox.max.x - bbox.min.x
      const slotBaseHeight = tslotHolderHeight + 0.3
      const slotBaseDepth = 0.15
      const slotBaseGeometry = new BoxGeometry(
        slotBaseWidth,
        slotBaseHeight,
        slotBaseDepth,
      )
      const slotBaseMaterial = new MeshPhysicalMaterial({ color: 'white' })
      const slotBaseMesh = new Mesh(slotBaseGeometry, slotBaseMaterial)
      slotBaseMesh.position.x = (bbox.max.x + bbox.min.x) / 2
      slotBaseMesh.position.y = (bbox.max.y + bbox.min.y) / 2
      slotBaseMesh.position.z = 0

      // attach the letter to a quad box that is uniform in height
      const quadWidth = bbox.max.x - bbox.min.x
      const quadHeight = tslotHolderHeight
      const quadDepth = 0.25
      const quadGeometry = new BoxGeometry(quadWidth, quadHeight, quadDepth)
      const quadMaterial = new MeshPhysicalMaterial({
        color: 'white',
      })
      const quadMesh = new Mesh(quadGeometry, quadMaterial)
      quadMesh.position.x = (bbox.max.x + bbox.min.x) / 2
      quadMesh.position.y = (bbox.max.y + bbox.min.y) / 2
      quadMesh.position.z = slotBaseDepth

      letter.add(quadMesh)
      letter.add(slotBaseMesh)
      ;[slotBaseMesh, quadMesh, letter].forEach((mesh) => {
        mesh.receiveShadow = true
        mesh.castShadow = true
      })

      letter.rotateX(-Math.PI / 2)
      letter.position.y += quadDepth / 2

      fontMeshes.push(letter)

      scene.add(letter)
    })
    centerTextMeshes()
  }

  function clearTextMeshes() {
    fontMeshes.forEach((mesh) => {
      scene.remove(mesh)
    })
    fontMeshes = []
  }

  function centerTextMeshes() {
    // compute the center point of all text meshes and center them around it
    const overallBBox = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
    }

    fontMeshes.forEach((mesh) => {
      mesh.geometry.computeBoundingBox()
      const bbox = mesh.geometry.boundingBox!
      overallBBox.min.x = Math.min(
        overallBBox.min.x,
        bbox.min.x + mesh.position.x,
      )
      // overallBBox.min.y = Math.min(
      //   overallBBox.min.y,
      //   bbox.min.y + mesh.position.y,
      // )
      overallBBox.min.z = Math.min(
        overallBBox.min.z,
        bbox.min.z + mesh.position.z,
      )
      overallBBox.max.x = Math.max(
        overallBBox.max.x,
        bbox.max.x + mesh.position.x,
      )
      // overallBBox.max.y = Math.max(
      //   overallBBox.max.y,
      //   bbox.max.y + mesh.position.y,
      // )
      overallBBox.max.z = Math.max(
        overallBBox.max.z,
        bbox.max.z + mesh.position.z,
      )
    })

    const centerX = (overallBBox.min.x + overallBBox.max.x) / 2
    // const centerY = (overallBBox.min.y + overallBBox.max.y) / 2
    const centerZ = (overallBBox.min.z + overallBBox.max.z) / 2

    fontMeshes.forEach((mesh) => {
      mesh.position.x -= centerX
      // mesh.position.y -= centerY
      mesh.position.z -= centerZ
    })
  }

  // ===== EXPORTER =====
  {
    exporter = new STLExporter()
    // TODO: add export button to GUI that exports current text meshes as STLs, zips them, and downloads
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
    ambientLight = new AmbientLight('white', 0.4)
    pointLight = new PointLight('white', 20, 100)
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

    const gridHelper = new GridHelper(20, 20, 'teal', 'darkgray')
    gridHelper.position.y = -0.01
    scene.add(gridHelper)
  }

  // ==== 🐞 DEBUG GUI ====
  {
    gui = new GUI({ title: '🐞 Debug GUI', width: 300 })

    const textFolder = gui.addFolder('Text')
    textFolder
      .add({ text: 'ABCDE' }, 'text')
      .name('text to extrude')
      .onChange((value: string) => {
        textToExtrude = value
        clearTextMeshes()
        renderText()
      })

    const controlsFolder = gui.addFolder('Controls')
    controlsFolder.add(dragControls, 'enabled').name('drag controls')

    const lightsFolder = gui.addFolder('Lights')
    lightsFolder.add(pointLight, 'visible').name('point light')
    lightsFolder.add(ambientLight, 'visible').name('ambient light')

    const helpersFolder = gui.addFolder('Helpers')
    helpersFolder.add(axesHelper, 'visible').name('axes')
    helpersFolder.add(pointLightHelper, 'visible').name('pointLight')

    const cameraFolder = gui.addFolder('Camera')
    cameraFolder.add(cameraControls, 'autoRotate')

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
    }
    gui.add({ resetGui }, 'resetGui').name('RESET')

    gui.close()
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

  renderer.render(scene, camera)
}
