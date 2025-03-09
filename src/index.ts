import vertShader from './shaders/vertex.wgsl?raw';
import fragShader from './shaders/fragment.wgsl?raw';

class GPUApp {
    canvas: HTMLCanvasElement;

    #format = navigator.gpu.getPreferredCanvasFormat();
    #device: GPUDevice | null = null;
    #context: GPUCanvasContext | null = null;

    constructor(canvas: HTMLCanvasElement) {

        this.canvas = canvas;
        this.initAsync();
    }

    async initAsync() {
        await this.#initWebGPU();
        const pipeline = await this.#createPipeline();
        this.#draw(pipeline);
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


    #createPipeline() {
        return this.#device?.createRenderPipelineAsync({
            layout: 'auto',
            vertex: {
                module: this.#device.createShaderModule({
                    code: vertShader,
                }),
                entryPoint: 'main',
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
        renderPass?.draw(3);
        renderPass?.end();

        const buffer = commandEncoder?.finish();

        this.#device?.queue.submit([buffer!]);
    }
}

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const gpu = new GPUApp(canvas);
gpu.initAsync();