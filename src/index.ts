import vertShader from './shaders/vertex.wgsl?raw';
import fragShader from './shaders/fragment.wgsl?raw';


interface VertexObjType {
    vertex: Float32Array,
    vertexBuffer: GPUBuffer,
}

class GPUApp {
    canvas: HTMLCanvasElement;

    #format = navigator.gpu.getPreferredCanvasFormat();
    #device: GPUDevice | null = null;
    #context: GPUCanvasContext | null = null;
    #vertexObj!: VertexObjType;
    #pipeline: GPURenderPipeline | null = null;

    constructor(canvas: HTMLCanvasElement) {
        const { devicePixelRatio } = window;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        this.canvas = canvas;
        this.initAsync();
    }

    async initAsync() {
        await this.#initWebGPU();
        this.#pipeline = await this.#createPipeline()!;
        this.#createVertex();
        this.#draw(this.#pipeline);
    }

    async #initWebGPU() {
        if (!navigator.gpu) throw new Error('not supported webgpu');
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance' // 独显或者大核，如果low-power则是集显或者小核
        })!;

        // console.log(adapter);
        const device = await adapter!.requestDevice({
            requiredLimits: {
                maxStorageBuffersPerShaderStage: adapter?.limits.maxStorageBuffersPerShaderStage,
            }
        });
        this.#device = device;

        const context = this.canvas.getContext('webgpu')!;
        this.#context = context;
        context.configure({
            device,
            format: this.#format,
            alphaMode: 'opaque',
        })
        // console.log(device);
    }

    #createVertex() {
        const vertex = new Float32Array([
            0.0, 0.5, 0,
            -0.5, -0.5, 0,
            0.5, -0.5, 0
        ]);
        const vertexBuffer = this.#device?.createBuffer({
            size: vertex.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })!;

        this.#vertexObj = {
            vertex,
            vertexBuffer,
        }

        this.#device?.queue.writeBuffer(vertexBuffer, 0, vertex);
    }

    move(value: number) {
        this.#vertexObj.vertex[0] = 0 + value;
        this.#vertexObj.vertex[3] = -0.5 + value;
        this.#vertexObj.vertex[6] = 0.5 + value;
        this.#device?.queue.writeBuffer(this.#vertexObj.vertexBuffer, 0, this.#vertexObj.vertex)
        this.#draw(this.#pipeline!);
    }

    #createPipeline() {
        return this.#device?.createRenderPipelineAsync({
            layout: 'auto',
            vertex: {
                module: this.#device.createShaderModule({
                    code: vertShader,
                }),
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 4 * 3, // 每三位分割
                        attributes: [{
                            shaderLocation: 0,
                            format: 'float32x3',
                            offset: 0,
                        }]
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list',
            },
            fragment: {
                module: this.#device.createShaderModule({
                    code: fragShader,
                }),
                entryPoint: "main",
                targets: [{ format: this.#format }],
            },
        });
    }


    #draw(pipeline: GPURenderPipeline) {
        const commandEncoder = this.#device?.createCommandEncoder();
        const renderPass = commandEncoder?.beginRenderPass({
            colorAttachments: [{
                view: this.#context?.getCurrentTexture().createView()!, // 输出到canvas上
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            }]
        })

        renderPass?.setPipeline(pipeline);
        renderPass?.setVertexBuffer(0, this.#vertexObj!.vertexBuffer);
        renderPass?.draw(3);
        renderPass?.end();

        const buffer = commandEncoder?.finish();

        this.#device?.queue.submit([buffer!]);
    }
}

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const gpu = new GPUApp(canvas);
gpu.initAsync();

document.querySelector('input[type="range"]')?.addEventListener('input', (e) => {
    const value = +(<HTMLInputElement>e.target).value;
    gpu.move(value);
});