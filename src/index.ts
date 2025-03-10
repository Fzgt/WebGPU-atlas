import vertShader from "./shaders/vertex.wgsl?raw";
import fragShader from "./shaders/fragment.wgsl?raw";
import { hex2rgb } from "./utils/color";

interface VertexObjType {
    vertex: Float32Array;
    vertexBuffer: GPUBuffer;
}

interface ColorObjType {
    color: Float32Array;
    colorBuffer: GPUBuffer;
    group: GPUBindGroup;
}

class GPUApp {
    canvas: HTMLCanvasElement;

    #format = navigator.gpu.getPreferredCanvasFormat();

    #device!: GPUDevice;

    #context!: GPUCanvasContext;

    #pipline!: GPURenderPipeline;

    #vertexObj!: VertexObjType;

    #colorObj!: ColorObjType;

    constructor(canvas: HTMLCanvasElement) {
        const { devicePixelRatio } = window;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        this.canvas = canvas;
    }

    async initAsync() {
        await this.#initWebGPU();
        this.#pipline = await this.#createPipeline();
        this.#createVertex();
        this.#colorObj = this.#createColor();
        this.#draw(this.#pipline);
    }

    async #initWebGPU() {
        if (!navigator.gpu) throw new Error("not support WebGPU");
        const adapter = (await navigator.gpu.requestAdapter({
            powerPreference: "high-performance",
        }))!;

        const device = await adapter.requestDevice({
            requiredLimits: {
                maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            },
        });

        this.#device = device;

        const context = this.canvas.getContext("webgpu")!;
        this.#context = context;
        context.configure({
            device,
            format: this.#format,
            alphaMode: "opaque",
        });
    }

    #createVertex() {
        const vertex = new Float32Array([
            0.0, 0.5, 0,
            -0.5, -0.5, 0,
            0.5, -0.5, 0
        ]);
        const vertexBuffer = this.#device.createBuffer({
            size: vertex.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.#vertexObj = {
            vertex,
            vertexBuffer,
        };

        this.#device.queue.writeBuffer(vertexBuffer, 0, vertex);
    }

    #createColor() {
        const color = new Float32Array([1.0, 1.0, 0.0]); // 4 * 3

        const colorBuffer = this.#device.createBuffer({
            size: color.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // 64kb
        });

        this.#device.queue.writeBuffer(colorBuffer, 0, color);

        const group = this.#device.createBindGroup({
            layout: this.#pipline.getBindGroupLayout(0), // @group(0)
            entries: [
                {
                    binding: 0, // @binding(0)
                    resource: {
                        buffer: colorBuffer,
                    },
                },
            ],
        });

        return {
            color,
            colorBuffer,
            group,
        };
    }

    move(value: number) {
        this.#vertexObj.vertex[0] = 0 + value;
        this.#vertexObj.vertex[3] = -0.5 + value;
        this.#vertexObj.vertex[6] = 0.5 + value;
        this.#device.queue.writeBuffer(
            this.#vertexObj.vertexBuffer,
            0,
            this.#vertexObj.vertex
        );

        this.#draw(this.#pipline);
    }

    setColor(r: number, g: number, b: number) {
        this.#colorObj.color[0] = r;
        this.#colorObj.color[1] = g;
        this.#colorObj.color[2] = b;

        this.#device.queue.writeBuffer(
            this.#colorObj.colorBuffer,
            0,
            this.#colorObj.color
        );
        this.#draw(this.#pipline);
    }

    #createPipeline() {
        return this.#device.createRenderPipelineAsync({
            layout: "auto",
            vertex: {
                module: this.#device.createShaderModule({
                    code: vertShader,
                }),
                entryPoint: "main",
                buffers: [
                    {
                        arrayStride: 4 * 3, // 每3位分割
                        attributes: [
                            {
                                shaderLocation: 0, // @location(0)
                                format: "float32x3",
                                offset: 0,
                            },
                        ],
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
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

    #draw(pipline: GPURenderPipeline) {
        const commandEncoder = this.#device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.#context.getCurrentTexture().createView(), // 输出到canvas上
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                },
            ],
        });
        renderPass.setPipeline(pipline);
        renderPass.setVertexBuffer(0, this.#vertexObj.vertexBuffer); // 顶点插槽 vertex slot
        renderPass.setBindGroup(0, this.#colorObj.group);
        renderPass.draw(3);
        renderPass.end();

        const buffer = commandEncoder.finish();

        this.#device.queue.submit([buffer]);
    }
}

const canvas = document.querySelector<HTMLCanvasElement>("#webgpu")!;

const gpu = new GPUApp(canvas);
gpu.initAsync();

document
    .querySelector('input[type="range"]')
    ?.addEventListener("input", (e) => {
        const value = +(<HTMLInputElement>e.target).value;
        gpu.move(value);
    });

document
    .querySelector('input[type="color"]')
    ?.addEventListener("input", (e) => {
        const value = (<HTMLInputElement>e.target).value;
        gpu.setColor(...hex2rgb(value))
        console.log(value);
    });
