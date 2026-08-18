function Ie(e) {
  return e.tasks && e.tasks.length > 0 ? e.tasks : ["text"];
}
const Ae = ["text", "vision", "stt", "tts"];
function Q(e) {
  const t = new Set(Ie(e));
  return Ae.filter((r) => t.has(r));
}
const Ee = "onnx-community/Supertonic-TTS-2-ONNX";
function f(e = {}) {
  return {
    maxTokens: 512,
    temperature: 0,
    topP: 0.85,
    repetitionPenalty: 1.08,
    frequencyPenalty: 0.2,
    presencePenalty: 0,
    seed: 42,
    disableThinking: !1,
    ...e
  };
}
const D = {
  // Gemma 3 and current experimental Gemma 4 MLC configs can expose both values as positive
  // (for example context_window_size=4096 and sliding_window_size=512). WebLLM requires one
  // KV-cache strategy at load time, so use the fixed context-window path for this demo.
  context_window_size: 4096,
  sliding_window_size: -1,
  max_history_size: 1
}, De = {
  "gemma3-1b-it-q4f16_1-MLC": D,
  "gemma-4-E2B-it-q4f16_1-MLC": D,
  "gemma-4-E4B-it-q4f16_1-MLC": D
};
function Ge(e) {
  const t = De[e.model_id];
  return t ? {
    ...e,
    overrides: {
      ...e.overrides ?? {},
      ...t
    }
  } : e;
}
const me = [
  {
    model: "https://huggingface.co/welcoma/gemma-4-E2B-it-q4f16_1-MLC",
    model_id: "gemma-4-E2B-it-q4f16_1-MLC",
    model_lib: "https://huggingface.co/welcoma/gemma-4-E2B-it-q4f16_1-MLC/resolve/main/libs/gemma-4-E2B-it-q4f16_1-MLC-webgpu.wasm",
    vram_required_MB: 4096,
    low_resource_required: !1,
    required_features: ["shader-f16"],
    overrides: D
  },
  {
    model: "https://huggingface.co/welcoma/gemma-4-E4B-it-q4f16_1-MLC",
    model_id: "gemma-4-E4B-it-q4f16_1-MLC",
    model_lib: "https://huggingface.co/welcoma/gemma-4-E4B-it-q4f16_1-MLC/resolve/main/libs/gemma-4-E4B-it-q4f16_1-MLC-webgpu.wasm",
    vram_required_MB: 6144,
    low_resource_required: !1,
    required_features: ["shader-f16"],
    overrides: D
  }
];
new Set(me.map((e) => e.model_id));
const W = [
  {
    id: "Qwen3.5-0.8B-q4f16_1-MLC",
    label: "Qwen3.5 0.8B q4f16 — recommended tested default (~1.6 GB VRAM)",
    shortName: "Qwen3.5 0.8B",
    description: "Default browser-extraction model. It is the smallest recent WebLLM Qwen3.5 option and has worked well for deterministic JSON extraction in this app.",
    approximateDownload: "~447 MB model files plus browser cache overhead",
    vramRequiredMB: 1629.49,
    vramSource: "webllm",
    lowResourceRequired: !0,
    disableThinkingSupported: !0,
    defaultRuntime: f({ disableThinking: !0 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "recommended",
    officialRepo: "https://huggingface.co/mlc-ai/Qwen3.5-0.8B-q4f16_1-MLC"
  },
  {
    id: "Qwen3.5-2B-q4f16_1-MLC",
    label: "Qwen3.5 2B q4f16 — better quality, moderate memory (~2.2 GB VRAM)",
    shortName: "Qwen3.5 2B",
    description: "Larger Qwen3.5 option for better instruction following and JSON extraction when the device has enough GPU memory.",
    approximateDownload: "larger multi-file model download plus browser cache overhead",
    vramRequiredMB: 2245.44,
    vramSource: "webllm",
    lowResourceRequired: !1,
    disableThinkingSupported: !0,
    defaultRuntime: f({ maxTokens: 640, disableThinking: !0 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Qwen3.5-2B-q4f16_1-MLC"
  },
  {
    id: "Qwen3.5-4B-q4f16_1-MLC",
    label: "Qwen3.5 4B q4f16 — higher quality desktop option (~3.8 GB VRAM)",
    shortName: "Qwen3.5 4B",
    description: "Higher-quality Qwen3.5 option for desktop GPUs. Use when extraction quality is more important than load time and memory footprint.",
    approximateDownload: "large multi-file model download plus browser cache overhead",
    vramRequiredMB: 3867.82,
    vramSource: "webllm",
    lowResourceRequired: !1,
    disableThinkingSupported: !0,
    defaultRuntime: f({ maxTokens: 768, disableThinking: !0, repetitionPenalty: 1.06 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f16_1-MLC"
  },
  {
    id: "gemma3-1b-it-q4f16_1-MLC",
    label: "Gemma 3 1B IT q4f16 — small Google fallback (~711 MB VRAM)",
    shortName: "Gemma 3 1B",
    description: "Small official WebLLM Gemma 3 model. This build uses a fixed-context override in the app so WebLLM does not try to enable both context-window and sliding-window KV-cache modes.",
    approximateDownload: "small model download plus browser cache overhead",
    vramRequiredMB: 711.07,
    vramSource: "webllm",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 512, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/gemma3-1b-it-q4f16_1-MLC"
  },
  {
    id: "gemma-4-E2B-it-q4f16_1-MLC",
    label: "Gemma 4 E2B IT q4f16 — experimental custom WebLLM build (~4 GB VRAM est.)",
    shortName: "Gemma 4 E2B",
    description: "Smallest Gemma 4 instruction option available here. This uses a third-party custom MLC/WebLLM artifact and a fixed-context override for WebLLM KV-cache loading.",
    approximateDownload: "~2.7 GB model repo plus browser cache overhead",
    vramRequiredMB: 4096,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "custom-mlc",
    backend: "webllm",
    stability: "experimental",
    officialRepo: "https://huggingface.co/google/gemma-4-E2B-it",
    artifactRepo: "https://huggingface.co/welcoma/gemma-4-E2B-it-q4f16_1-MLC"
  },
  {
    id: "gemma-4-E4B-it-q4f16_1-MLC",
    label: "Gemma 4 E4B IT q4f16 — experimental larger Gemma 4 build (~6 GB VRAM est.)",
    shortName: "Gemma 4 E4B",
    description: "Larger Gemma 4 instruction option for desktop/high-memory testing. This uses the same fixed-context WebLLM load override as the E2B option.",
    approximateDownload: "~4.3 GB model repo plus browser cache overhead",
    vramRequiredMB: 6144,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "custom-mlc",
    backend: "webllm",
    stability: "experimental",
    officialRepo: "https://huggingface.co/google/gemma-4-E4B-it",
    artifactRepo: "https://huggingface.co/welcoma/gemma-4-E4B-it-q4f16_1-MLC"
  },
  {
    id: "onnx-community/whisper-base",
    label: "Whisper Base — multilingual speech-to-text via Transformers.js/WebGPU",
    shortName: "Whisper Base",
    description: "OpenAI Whisper base — dependable multilingual speech-to-text with punctuation and segment timestamps.",
    approximateDownload: "~145 MB (encoder fp32 + q4/q8 decoder) plus browser cache overhead",
    vramRequiredMB: 500,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "recommended",
    officialRepo: "https://huggingface.co/onnx-community/whisper-base",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt",
    brand: "OpenAI"
  },
  {
    id: "onnx-community/whisper-tiny",
    label: "Whisper Tiny — smallest multilingual speech-to-text",
    shortName: "Whisper Tiny",
    description: "Smallest Whisper. Ultra-fast multilingual transcription for low-memory devices.",
    approximateDownload: "~41 MB q8 ONNX plus browser cache overhead",
    vramRequiredMB: 250,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "stable",
    officialRepo: "https://huggingface.co/onnx-community/whisper-tiny",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt",
    brand: "OpenAI"
  },
  {
    id: "onnx-community/moonshine-base-ONNX",
    label: "Moonshine Base — fast English on-device speech-to-text",
    shortName: "Moonshine Base",
    description: "Fast English speech-to-text tuned for short, real-time clips and low-latency on-device transcription.",
    approximateDownload: "~63 MB q8 ONNX plus browser cache overhead",
    vramRequiredMB: 400,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "stable",
    officialRepo: "https://huggingface.co/onnx-community/moonshine-base-ONNX",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt",
    brand: "Moonshine"
  },
  {
    id: "onnx-community/moonshine-tiny-ONNX",
    label: "Moonshine Tiny — smallest fast English on-device speech-to-text",
    shortName: "Moonshine Tiny",
    description: "Smallest Moonshine. Ultra-low-latency English speech-to-text for short, real-time clips on low-memory devices.",
    approximateDownload: "~75 MB (fp32 encoder + q4 decoder) plus browser cache overhead",
    vramRequiredMB: 250,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "stable",
    officialRepo: "https://huggingface.co/onnx-community/moonshine-tiny-ONNX",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt",
    brand: "Moonshine"
  },
  {
    id: "onnx-community/whisper-medium_timestamped",
    label: "Whisper Medium — higher-accuracy multilingual speech-to-text (word timestamps)",
    shortName: "Whisper Medium",
    description: "OpenAI Whisper medium (~769M) with word-level timestamps. Stronger multilingual accuracy than Base/Tiny, at a much larger download and slower first load.",
    approximateDownload: "~1.7 GB (fp32 encoder + q4 decoder) plus browser cache overhead",
    vramRequiredMB: 1800,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/whisper-medium_timestamped",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt",
    brand: "OpenAI"
  },
  {
    id: "onnx-community/whisper-medium.en_timestamped",
    label: "Whisper Medium English — English-only medium speech-to-text (word timestamps)",
    shortName: "Whisper Medium EN",
    description: "English-only Whisper medium (~769M) with word-level timestamps. Tuned for English accuracy; do not use it for other languages.",
    approximateDownload: "~1.7 GB (fp32 encoder + q4 decoder) plus browser cache overhead",
    vramRequiredMB: 1800,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/whisper-medium.en_timestamped",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt",
    brand: "OpenAI"
  },
  {
    id: "onnx-community/cohere-transcribe-03-2026-ONNX",
    label: "Cohere Transcribe — multilingual speech-to-text via Transformers.js/WebGPU",
    shortName: "Cohere Transcribe",
    description: "Cohere's multilingual transcription model (14 languages). Loads via the automatic-speech-recognition pipeline with a flat q4 dtype — its fp32 encoder is multiple GB, so q4 is the documented WebGPU recipe.",
    approximateDownload: "~2.1 GB q4 ONNX (q4 encoder + q4 decoder) plus browser cache overhead",
    vramRequiredMB: 2600,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/cohere-transcribe-03-2026-ONNX",
    transformersDtype: "q4",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt",
    brand: "Cohere"
  },
  {
    id: "onnx-community/parakeet-ctc-0.6b-ONNX",
    label: "Parakeet CTC 0.6B — fast low-latency English speech-to-text (NVIDIA FastConformer)",
    shortName: "Parakeet CTC 0.6B",
    description: "NVIDIA Parakeet CTC 0.6B (FastConformer). Fast, low-latency English transcription through the CTC speech-recognition pipeline. Loads with a flat q4f16 dtype (single-module CTC model — no separate encoder/decoder).",
    approximateDownload: "~450 MB q4f16 ONNX plus browser cache overhead",
    vramRequiredMB: 1200,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/parakeet-ctc-0.6b-ONNX",
    transformersDtype: "q4f16",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "stt"
  },
  {
    id: "onnx-community/granite-speech-4.1-2b-ONNX",
    label: "IBM Granite Speech 4.1 2B — audio-LLM speech-to-text via Transformers.js/WebGPU",
    shortName: "Granite Speech 2B",
    description: "IBM Granite Speech (2B): a speech-aware LLM (Conformer encoder + Granite LLM + audio LoRA) with strong English ASR. Runs through the audio-text-to-text recipe — it generates the transcript, so there are no per-segment timestamps.",
    approximateDownload: "~1.5 GB q4f16 ONNX (audio encoder + decoder + embeddings) plus browser cache overhead",
    vramRequiredMB: 2200,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/granite-speech-4.1-2b-ONNX",
    transformersDtype: "q4f16",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "audio-text-to-text",
    brand: "IBM Granite"
  },
  {
    id: "onnx-community/Voxtral-Mini-4B-Realtime-2602-ONNX",
    label: "Voxtral Mini 4B Realtime — Mistral audio-LLM speech-to-text via Transformers.js/WebGPU",
    shortName: "Voxtral Mini 4B RT",
    description: "Mistral Voxtral Mini 4B: an audio-LLM for multilingual transcription (14 languages) built on Ministral. Runs through the audio-text-to-text recipe as a single-pass transcription. This is the realtime/streaming checkpoint and is heavy (4B), so single-pass output quality should be validated on your hardware.",
    approximateDownload: "~2.8 GB q4f16 ONNX (audio encoder + decoder + embeddings) plus browser cache overhead",
    vramRequiredMB: 4096,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602",
    artifactRepo: "https://huggingface.co/onnx-community/Voxtral-Mini-4B-Realtime-2602-ONNX",
    transformersDtype: "q4f16",
    tasks: ["stt"],
    modalityIn: ["audio"],
    modalityOut: ["text"],
    mmRuntime: "voxtral-realtime"
  },
  {
    id: "onnx-community/Kokoro-82M-v1.0-ONNX",
    label: "Kokoro 82M — natural on-device text-to-speech (kokoro-js)",
    shortName: "Kokoro 82M",
    description: "Compact, natural text-to-speech with a library of expressive voices. A browser-TTS favorite.",
    approximateDownload: "~86 MB q8 (326 MB fp32 on WebGPU) plus browser cache overhead",
    vramRequiredMB: 420,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "recommended",
    officialRepo: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX",
    tasks: ["tts"],
    modalityIn: ["text"],
    modalityOut: ["audio"],
    mmRuntime: "tts-kokoro",
    brand: "Kokoro",
    notes: "Loaded via kokoro-js from CDN; it bundles its own Transformers.js runtime and fetches weights directly from Hugging Face."
  },
  {
    id: "onnx-community/Supertonic-TTS-ONNX",
    label: "Supertonic — low-latency streaming text-to-speech (native pipeline)",
    shortName: "Supertonic",
    description: "Very low-latency on-device text-to-speech built for real-time streaming playback.",
    approximateDownload: "~fp32 ONNX plus browser cache overhead",
    vramRequiredMB: 350,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/Supertonic-TTS-ONNX",
    tasks: ["tts"],
    modalityIn: ["text"],
    modalityOut: ["audio"],
    mmRuntime: "tts-pipeline",
    brand: "Supertonic"
  },
  {
    id: "onnx-community/Supertonic-TTS-2-ONNX",
    label: "Supertonic 2 — multilingual low-latency streaming text-to-speech (native pipeline)",
    shortName: "Supertonic 2",
    description: "Second-generation Supertonic: very low-latency on-device text-to-speech for real-time streaming playback, now multilingual (English, Korean, Spanish, Portuguese, French). Same ten F1–F5 / M1–M5 speaker voices as v1.",
    approximateDownload: "~260 MB fp32 ONNX plus browser cache overhead",
    vramRequiredMB: 400,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX",
    tasks: ["tts"],
    modalityIn: ["text"],
    modalityOut: ["audio"],
    mmRuntime: "tts-pipeline",
    brand: "Supertonic"
  },
  {
    id: "HuggingFaceTB/SmolVLM-256M-Instruct",
    label: "SmolVLM 256M — tiny vision-language model via Transformers.js/WebGPU",
    shortName: "SmolVLM 256M",
    description: "Tiny vision-language model for captioning and quick image Q&A. Runs on almost any device.",
    approximateDownload: "~190 MB q4f16 ONNX plus browser cache overhead",
    vramRequiredMB: 600,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "stable",
    officialRepo: "https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct",
    transformersDtype: "q4",
    tasks: ["vision"],
    modalityIn: ["text", "image"],
    modalityOut: ["text"],
    mmRuntime: "vlm-vision2seq"
  },
  {
    id: "HuggingFaceTB/SmolVLM-500M-Instruct",
    label: "SmolVLM 500M — stronger small vision-language model",
    shortName: "SmolVLM 500M",
    description: "Small vision-language model with stronger scene and document understanding than the 256M build.",
    approximateDownload: "~250 MB q4f16 ONNX plus browser cache overhead",
    vramRequiredMB: 900,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "stable",
    officialRepo: "https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct",
    transformersDtype: "q4",
    tasks: ["vision"],
    modalityIn: ["text", "image"],
    modalityOut: ["text"],
    mmRuntime: "vlm-vision2seq"
  },
  {
    id: "onnx-community/Qwen3-VL-2B-Instruct-ONNX",
    label: "Qwen3-VL 2B — capable vision-language model via Transformers.js/WebGPU",
    shortName: "Qwen3-VL 2B",
    description: "Capable vision-language model for detailed image reasoning, charts, screenshots, and multi-step questions.",
    approximateDownload: "~1.5 GB mixed-precision ONNX plus browser cache overhead",
    vramRequiredMB: 2500,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct",
    artifactRepo: "https://huggingface.co/onnx-community/Qwen3-VL-2B-Instruct-ONNX",
    tasks: ["vision"],
    modalityIn: ["text", "image"],
    modalityOut: ["text"],
    mmRuntime: "vlm-imagetext"
  },
  {
    id: "wolfofbackstreet/GLM-OCR-ONNX-q4f16",
    label: "GLM-OCR — document OCR vision-language model via Transformers.js/WebGPU",
    shortName: "GLM-OCR",
    description: "Document-focused vision model for OCR, layout parsing, and structured text extraction from images.",
    approximateDownload: "~658 MB q4f16 ONNX plus browser cache overhead",
    vramRequiredMB: 1800,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/zai-org/GLM-OCR",
    artifactRepo: "https://huggingface.co/wolfofbackstreet/GLM-OCR-ONNX-q4f16",
    transformersDtype: "q4f16",
    tasks: ["vision"],
    modalityIn: ["text", "image"],
    modalityOut: ["text"],
    mmRuntime: "vlm-imagetext",
    brand: "Zhipu"
  },
  {
    id: "onnx-community/Qwen2.5-VL-3B-Instruct-ONNX",
    label: "Qwen2.5-VL 3B — vision-language model via Transformers.js/WebGPU",
    shortName: "Qwen2.5-VL 3B",
    description: "Qwen2.5-VL 3B for detailed image reasoning, charts, screenshots, and documents. Larger and stronger than the Qwen3-VL 2B build, at a heavier first download and higher GPU-memory needs.",
    approximateDownload: "~3.7 GB mixed-precision ONNX (fp16 vision + q4f16 decoder) plus browser cache overhead",
    vramRequiredMB: 3500,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct",
    artifactRepo: "https://huggingface.co/onnx-community/Qwen2.5-VL-3B-Instruct-ONNX",
    tasks: ["vision"],
    modalityIn: ["text", "image"],
    modalityOut: ["text"],
    mmRuntime: "vlm-imagetext"
  },
  {
    id: "onnx-community/LightOnOCR-2-1B-ONNX",
    label: "LightOnOCR-2 1B — document OCR vision-language model via Transformers.js/WebGPU",
    shortName: "LightOnOCR-2 1B",
    description: "Compact document-OCR vision model for text extraction, tables, forms, and layout parsing across 11 languages. Loads flat q4f16 like the GLM-OCR build.",
    approximateDownload: "~680 MB q4f16 ONNX plus browser cache overhead",
    vramRequiredMB: 1500,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f(),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/lightonai/LightOnOCR-2-1B",
    artifactRepo: "https://huggingface.co/onnx-community/LightOnOCR-2-1B-ONNX",
    transformersDtype: "q4f16",
    tasks: ["vision"],
    modalityIn: ["text", "image"],
    modalityOut: ["text"],
    mmRuntime: "vlm-imagetext",
    brand: "LightOn"
  },
  {
    id: "onnx-community/NVIDIA-Nemotron-3-Nano-4B-BF16-ONNX",
    label: "NVIDIA Nemotron 3 Nano 4B ONNX — experimental Transformers.js/WebGPU (~2.5 GB download)",
    shortName: "Nemotron 3 Nano 4B",
    description: "Experimental ONNX + Transformers.js backend from the WebGPU demo space. It is prompt-only JSON generation, not WebLLM schema-constrained decoding, and may require substantially more disk/GPU memory than Qwen3.5.",
    approximateDownload: "~2.5 GB browser-selected quantized ONNX artifacts, cached after first load",
    vramRequiredMB: 4096,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !0,
    defaultRuntime: f({ maxTokens: 768, topP: 0.95, repetitionPenalty: 1.05, disableThinking: !0 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16",
    artifactRepo: "https://huggingface.co/onnx-community/NVIDIA-Nemotron-3-Nano-4B-BF16-ONNX",
    transformersDtype: "q4",
    notes: "Loaded through @huggingface/transformers from CDN at runtime so the WebLLM demo remains small until this model is selected."
  },
  {
    id: "LiquidAI/LFM2.5-230M-ONNX",
    label: "Liquid LFM2.5 230M ONNX — tiny Transformers.js/WebGPU model (~300 MB class)",
    shortName: "LFM2.5 230M",
    description: "Very small LiquidAI ONNX model for browser testing. It is useful when you want a fast, low-footprint Transformers.js/WebGPU baseline for extraction prompts.",
    approximateDownload: "~300 MB class model artifacts plus browser cache overhead",
    vramRequiredMB: 768,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 384, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/LiquidAI/LFM2.5-230M",
    artifactRepo: "https://huggingface.co/LiquidAI/LFM2.5-230M-ONNX",
    transformersDtype: "q4"
  },
  {
    id: "LiquidAI/LFM2.5-350M-ONNX",
    label: "Liquid LFM2.5 350M ONNX — compact Transformers.js/WebGPU model (~700 MB class)",
    shortName: "LFM2.5 350M",
    description: "Compact LiquidAI edge model with an official ONNX/WebGPU export. Good for comparing a hybrid architecture against Qwen, Gemma, and Llama in browser extraction.",
    approximateDownload: "~700 MB class model artifacts plus browser cache overhead",
    vramRequiredMB: 1024,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 448, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/LiquidAI/LFM2.5-350M",
    artifactRepo: "https://huggingface.co/LiquidAI/LFM2.5-350M-ONNX",
    transformersDtype: "q4"
  },
  {
    id: "LiquidAI/LFM2.5-1.2B-Thinking-ONNX",
    label: "Liquid LFM2.5 1.2B Thinking ONNX — reasoning-focused browser model",
    shortName: "LFM2.5 1.2B Thinking",
    description: "Reasoning-focused LiquidAI ONNX model for Transformers.js/WebGPU. It may emit <think> traces, so extraction prompts should explicitly request final JSON only.",
    approximateDownload: "large ONNX model artifacts plus browser cache overhead",
    vramRequiredMB: 2300,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !0,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.06, disableThinking: !0 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking",
    artifactRepo: "https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking-ONNX",
    transformersDtype: "q4"
  },
  {
    id: "onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX",
    label: "Falcon H1 Tiny 90M ONNX — ultra-small Transformers.js/WebGPU smoke-test model",
    shortName: "Falcon H1 Tiny 90M",
    description: "Ultra-small hybrid Mamba/attention model. It is best as a browser compatibility smoke test; extraction quality will likely be lower than the larger models.",
    approximateDownload: "~1.1 GB model repo, but selected quantized artifacts may be smaller",
    vramRequiredMB: 512,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 256, topP: 0.9, repetitionPenalty: 1.04 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/tiiuae/Falcon-H1-Tiny-90M-Instruct",
    artifactRepo: "https://huggingface.co/onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX",
    transformersDtype: "q4"
  },
  {
    id: "onnx-community/granite-4.0-micro-ONNX-web",
    label: "IBM Granite 4.0 Micro ONNX-web — small hybrid chat model via Transformers.js/WebGPU",
    shortName: "Granite 4.0 Micro ONNX",
    description: "Small IBM Granite MoE/hybrid chat model packaged specifically for Transformers.js/WebGPU. Useful as a non-Qwen/non-Llama browser extraction comparison.",
    approximateDownload: "ONNX-web model artifacts plus tokenizer/config files",
    vramRequiredMB: 2048,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 512, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/ibm-granite/granite-4.0-micro",
    artifactRepo: "https://huggingface.co/onnx-community/granite-4.0-micro-ONNX-web",
    transformersDtype: "q4f16"
  },
  {
    id: "onnx-community/granite-4.0-350m-ONNX-web",
    label: "IBM Granite 4.0 350M ONNX-web — small Transformers.js/WebGPU model",
    shortName: "Granite 4.0 350M",
    description: "Small Granite 4.0 ONNX-web build packaged for Transformers.js/WebGPU. This is one of the safest Granite test options for lower-memory machines.",
    approximateDownload: "~350 MB q4f16 ONNX artifacts plus tokenizer/config files",
    vramRequiredMB: 1024,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 448, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/ibm-granite/granite-4.0-350m",
    artifactRepo: "https://huggingface.co/onnx-community/granite-4.0-350m-ONNX-web",
    transformersDtype: "q4f16"
  },
  {
    id: "onnx-community/granite-4.0-h-350m-ONNX",
    label: "IBM Granite 4.0 H 350M ONNX — hybrid/MoE Transformers.js/WebGPU test",
    shortName: "Granite 4.0 H 350M",
    description: "Small Granite hybrid/MoE ONNX export. Use it to compare the Granite H family against Qwen3.5 and LiquidAI in browser extraction.",
    approximateDownload: "~236 MB q4f16 ONNX data plus graph/tokenizer/config files",
    vramRequiredMB: 1024,
    vramSource: "estimated",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 448, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/ibm-granite/granite-4.0-h-350m",
    artifactRepo: "https://huggingface.co/onnx-community/granite-4.0-h-350m-ONNX",
    transformersDtype: "q4f16"
  },
  {
    id: "onnx-community/granite-4.0-1b-ONNX-web",
    label: "IBM Granite 4.0 1B ONNX-web — larger Transformers.js/WebGPU model",
    shortName: "Granite 4.0 1B",
    description: "Granite 4.0 1B ONNX-web build packaged for Transformers.js/WebGPU. Expect better extraction quality than the 350M variant and a larger first download.",
    approximateDownload: "~1.25 GB q4f16 ONNX artifacts plus tokenizer/config files",
    vramRequiredMB: 2048,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 640, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/ibm-granite/granite-4.0-1b",
    artifactRepo: "https://huggingface.co/onnx-community/granite-4.0-1b-ONNX-web",
    transformersDtype: "q4f16"
  },
  {
    id: "onnx-community/granite-4.0-h-1b-ONNX",
    label: "IBM Granite 4.0 H 1B ONNX — hybrid/MoE Transformers.js/WebGPU model",
    shortName: "Granite 4.0 H 1B",
    description: "Larger Granite H hybrid/MoE ONNX export. Use this on machines that can handle around a 1 GB quantized ONNX download plus runtime memory.",
    approximateDownload: "~925 MB q4f16 ONNX data plus graph/tokenizer/config files",
    vramRequiredMB: 2048,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 640, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/ibm-granite/granite-4.0-h-1b",
    artifactRepo: "https://huggingface.co/onnx-community/granite-4.0-h-1b-ONNX",
    transformersDtype: "q4f16"
  },
  {
    id: "onnx-community/granite-4.0-h-micro-ONNX",
    label: "IBM Granite 4.0 H Micro ONNX — larger hybrid/MoE test",
    shortName: "Granite 4.0 H Micro",
    description: "Large Granite H Micro ONNX export. It is included for testing but is not a first-load choice because the repository contains very large model variants.",
    approximateDownload: "~1.95 GB q4f16 ONNX data plus graph/tokenizer/config files",
    vramRequiredMB: 4096,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/ibm-granite/granite-4.0-h-micro",
    artifactRepo: "https://huggingface.co/onnx-community/granite-4.0-h-micro-ONNX",
    transformersDtype: "q4f16"
  },
  {
    id: "Mike0021/MiniCPM5-1B-ONNX-Web",
    label: "MiniCPM5 1B ONNX-web — community q4 Transformers.js/WebGPU export",
    shortName: "MiniCPM5 1B ONNX-web",
    description: "Browser-friendly q4 Transformers.js export of MiniCPM5 1B. The official ONNX Runtime GenAI repo is linked as the official repo; this selected artifact repo is the browser-loadable q4 export.",
    approximateDownload: "~902 MB q4 ONNX artifact plus tokenizer/config files",
    vramRequiredMB: 2048,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !0,
    defaultRuntime: f({ maxTokens: 640, topP: 0.9, repetitionPenalty: 1.05, disableThinking: !0 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/onnx-community/MiniCPM5-1B",
    artifactRepo: "https://huggingface.co/Mike0021/MiniCPM5-1B-ONNX-Web",
    transformersDtype: "q4"
  },
  {
    id: "HuggingFaceTB/SmolLM3-3B-ONNX",
    label: "SmolLM3 3B ONNX — current compact 3B model via Transformers.js/WebGPU",
    shortName: "SmolLM3 3B ONNX",
    description: "Current SmolLM3 ONNX export for Transformers.js. It is larger than the default model but useful for testing a fully open 3B browser/local model path.",
    approximateDownload: "large ONNX model artifacts plus tokenizer/config files",
    vramRequiredMB: 3072,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/HuggingFaceTB/SmolLM3-3B",
    artifactRepo: "https://huggingface.co/HuggingFaceTB/SmolLM3-3B-ONNX",
    transformersDtype: "q4"
  },
  {
    id: "onnx-community/gemma-4-E2B-it-ONNX",
    label: "Gemma 4 E2B ONNX — experimental Transformers.js/WebGPU alternative",
    shortName: "Gemma 4 E2B ONNX",
    description: "ONNX/Transformers.js route for Gemma 4 E2B. This is separate from the custom WebLLM/MLC Gemma 4 build and may be useful if the MLC artifact is not stable on a device.",
    approximateDownload: "large ONNX model artifacts plus tokenizer/config files",
    vramRequiredMB: 4096,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/google/gemma-4-E2B-it",
    artifactRepo: "https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX",
    transformersDtype: "q4f16",
    tasks: ["text", "vision", "stt"],
    modalityIn: ["text", "image", "audio"],
    modalityOut: ["text"],
    mmRuntime: "gemma-mm"
  },
  {
    id: "onnx-community/gemma-4-E4B-it-ONNX",
    label: "Gemma 4 E4B ONNX — larger multimodal Transformers.js/WebGPU build",
    shortName: "Gemma 4 E4B ONNX",
    description: "Larger ONNX/Transformers.js route for Gemma 4 E4B (~8B). Text + image + audio in one model, with stronger quality than the E2B ONNX build at a heavier first load and higher GPU-memory needs.",
    approximateDownload: "~5–6 GB q4f16 ONNX artifacts plus tokenizer/config files",
    vramRequiredMB: 6144,
    vramSource: "estimated",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "transformers-onnx",
    backend: "transformers-js",
    stability: "experimental",
    officialRepo: "https://huggingface.co/google/gemma-4-E4B-it",
    artifactRepo: "https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX",
    transformersDtype: "q4f16",
    tasks: ["text", "vision", "stt"],
    modalityIn: ["text", "image", "audio"],
    modalityOut: ["text"],
    mmRuntime: "gemma-mm"
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B Instruct q4f16 — low-memory Meta fallback (~879 MB VRAM)",
    shortName: "Llama 3.2 1B",
    description: "Compact Meta Llama instruction model. It is a useful compatibility fallback and gives you another model family to compare against Qwen3.5.",
    approximateDownload: "small model download plus browser cache overhead",
    vramRequiredMB: 879.04,
    vramSource: "webllm",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 448, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC"
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B Instruct q4f16 — stronger Meta fallback (~2.2 GB VRAM)",
    shortName: "Llama 3.2 3B",
    description: "More capable Llama option for machines that can handle a larger local browser model.",
    approximateDownload: "large model download plus browser cache overhead",
    vramRequiredMB: 2263.69,
    vramSource: "webllm",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC"
  },
  {
    id: "Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
    label: "Hermes 3 Llama 3.2 3B q4f16 — extraction/chat alternate (~2.2 GB VRAM)",
    shortName: "Hermes 3 Llama 3.2 3B",
    description: "Hermes-tuned Llama 3.2 3B variant. Useful for comparing structured-output behavior against the base Llama instruct build.",
    approximateDownload: "large model download plus browser cache overhead",
    vramRequiredMB: 2263.69,
    vramSource: "webllm",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.06 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Hermes-3-Llama-3.2-3B-q4f16_1-MLC"
  },
  {
    id: "OLMo-2-0425-1B-Instruct-q4f16_1-MLC",
    label: "OLMo 2 0425 1B Instruct q4f16 — open 1B alternate (~1.7 GB VRAM)",
    shortName: "OLMo 2 1B",
    description: "Recent small OLMo 2 instruction model compiled for WebLLM. Good for a non-Qwen, non-Llama comparison while staying near the 1B class.",
    approximateDownload: "medium model download plus browser cache overhead",
    vramRequiredMB: 1776.75,
    vramSource: "webllm",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 512, topP: 0.9, repetitionPenalty: 1.06 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/OLMo-2-0425-1B-Instruct-q4f16_1-MLC"
  },
  {
    id: "Phi-4-mini-instruct-q4f16_1-MLC",
    label: "Phi-4 mini Instruct q4f16 — capable desktop option (~3.4 GB VRAM)",
    shortName: "Phi-4 mini",
    description: "Capable compact Phi model. Use on desktop-class devices when smaller models miss fields or produce lower-quality extraction.",
    approximateDownload: "large model download plus browser cache overhead",
    vramRequiredMB: 3437.58,
    vramSource: "webllm",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Phi-4-mini-instruct-q4f16_1-MLC"
  },
  {
    id: "Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC",
    label: "Ministral 3 3B Instruct q4f16 — recent Mistral-family option (~2.8 GB VRAM)",
    shortName: "Ministral 3 3B",
    description: "Recent Mistral-family WebLLM option. Useful for comparing extraction quality against Qwen3.5/Llama/Phi on desktop-class GPUs.",
    approximateDownload: "large model download plus browser cache overhead",
    vramRequiredMB: 2863.69,
    vramSource: "webllm",
    lowResourceRequired: !0,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC"
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    label: "Mistral 7B Instruct v0.3 q4f16 — high-memory quality test (~4.5 GB VRAM)",
    shortName: "Mistral 7B v0.3",
    description: "Larger Mistral-family model. Keep this as a desktop/high-memory comparison model; it is not a first-load choice for casual users.",
    approximateDownload: "very large model download plus browser cache overhead",
    vramRequiredMB: 4573.39,
    vramSource: "webllm",
    lowResourceRequired: !1,
    disableThinkingSupported: !1,
    defaultRuntime: f({ maxTokens: 768, topP: 0.9, repetitionPenalty: 1.05 }),
    source: "webllm-prebuilt",
    backend: "webllm",
    stability: "stable",
    officialRepo: "https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC"
  }
];
function de(e) {
  return W.find((t) => t.id === e) ?? W[0];
}
function $e(e) {
  try {
    return new URL(e.artifactRepo ?? e.officialRepo).pathname.replace(/^\//, "");
  } catch {
    return e.id;
  }
}
function K(e) {
  if (Array.isArray(e))
    return e.map(K);
  if (!e || typeof e != "object")
    return e;
  const t = {};
  for (const [r, o] of Object.entries(e))
    ["description", "examples", "title", "$comment"].includes(r) || (t[r] = K(o));
  return t;
}
function je(e) {
  return {
    ...e,
    jsonMode: "schema",
    latencyBreakdown: !0
  };
}
function Xe(e, t) {
  if (e !== "none")
    return e === "json_object" ? { type: "json_object" } : {
      type: "json_object",
      schema: JSON.stringify(K(t))
    };
}
function Ue(e, t, r) {
  return Number.isFinite(e) ? Math.min(r, Math.max(t, e)) : t;
}
function fe(e) {
  return e instanceof Error ? e.message : String(e);
}
class M extends Error {
  constructor(t, r) {
    super(t, r), this.name = new.target.name;
  }
}
class V extends M {
  modelId;
  constructor(t) {
    super(`Unknown model id: ${t}`), this.modelId = t;
  }
}
class We extends M {
  /** The probe's explanation (e.g. "navigator.gpu is not available."). */
  reason;
  constructor(t) {
    super(`WebGPU unavailable: ${t}`), this.reason = t;
  }
}
class Fe extends M {
  modelId;
  constructor(t, r) {
    super(`Model load failed for ${t}: ${fe(r)}`, { cause: r }), this.modelId = t;
  }
}
class S extends M {
}
class L extends M {
  slot;
  constructor(t, r) {
    super(r ?? `No loaded model fills the "${t}" capability slot.`), this.slot = t;
  }
}
const $ = "[empty response]";
async function He(e, t, r, o, n = {}) {
  const s = performance.now();
  if (e.backend === "transformers-js") {
    if (!e.transformersGenerator)
      throw new Error("Transformers.js pipeline is not loaded.");
    const d = await Je(e, t, r, o, n.onDelta, s), m = performance.now(), y = d.text || $, h = Ye(o.id, r, d, s, m);
    return { text: y, stats: h };
  }
  if (!e.engine)
    throw new Error("WebLLM engine is not loaded.");
  n.resetChat !== !1 && await e.engine.resetChat(!1);
  const a = n.schema !== void 0 ? Xe(r.jsonMode, n.schema) : void 0, i = Ve(r, o), c = n.onDelta ? await Qe(e.engine, t, r, a, i, n.onDelta) : await ze(e.engine, t, r, a, i), l = performance.now(), u = await Ke(e, c.usage, c.finishReason, s, l, c.firstTokenMs);
  return { text: c.text || $, stats: u };
}
function Ve(e, t) {
  const r = {};
  return t.disableThinkingSupported && (r.enable_thinking = e.disableThinking === !1), e.latencyBreakdown && (r.enable_latency_breakdown = !0), Object.keys(r).length > 0 ? r : void 0;
}
async function ze(e, t, r, o, n) {
  const s = await e.chat.completions.create({
    messages: t,
    stream: !1,
    n: 1,
    temperature: r.temperature,
    top_p: r.topP,
    max_tokens: r.maxTokens,
    repetition_penalty: r.repetitionPenalty,
    frequency_penalty: r.frequencyPenalty,
    presence_penalty: r.presencePenalty,
    seed: r.seed ?? void 0,
    response_format: o,
    extra_body: n
  });
  return {
    text: s.choices[0]?.message?.content ?? "",
    finishReason: s.choices[0]?.finish_reason ?? "unknown",
    usage: s.usage
  };
}
async function Qe(e, t, r, o, n, s) {
  const a = await e.chat.completions.create({
    messages: t,
    stream: !0,
    stream_options: { include_usage: !0 },
    temperature: r.temperature,
    top_p: r.topP,
    max_tokens: r.maxTokens,
    repetition_penalty: r.repetitionPenalty,
    frequency_penalty: r.frequencyPenalty,
    presence_penalty: r.presencePenalty,
    seed: r.seed ?? void 0,
    response_format: o,
    extra_body: n
  });
  let i = "", c = "unknown", l, u;
  for await (const d of a) {
    const m = d.choices[0], y = m?.delta?.content ?? "";
    y && (u === void 0 && (u = performance.now()), i += y, s(i)), m?.finish_reason && (c = m.finish_reason), d.usage && (l = d.usage);
  }
  return { text: i, finishReason: c, usage: l, firstTokenMs: u };
}
async function Ke(e, t, r, o, n, s) {
  const a = n - o, i = t?.completion_tokens, c = typeof i == "number" && a > 0 ? i / (a / 1e3) : void 0, l = t?.extra ? { ...t.extra, latencyBreakdown: Ze(t.extra.latencyBreakdown) } : c !== void 0 || s !== void 0 ? {
    decode_tokens_per_s: c,
    e2e_latency_s: a / 1e3,
    time_to_first_token_s: s !== void 0 ? Math.max(0, (s - o) / 1e3) : void 0
  } : void 0;
  let u;
  if (e.engine && e.modelId)
    try {
      u = (await e.engine.runtimeStatsText(e.modelId)).trim() || void 0;
    } catch (m) {
      u = `unavailable: ${fe(m)}`;
    }
  const d = {
    rawText: "",
    model: e.modelId ?? "n/a",
    backend: "webllm",
    finishReason: r,
    measuredElapsedMs: a,
    promptTokens: t?.prompt_tokens,
    completionTokens: t?.completion_tokens,
    totalTokens: t?.total_tokens,
    measuredCompletionTokensPerSecond: c,
    extra: l,
    latencyBreakdown: l?.latencyBreakdown,
    legacyStats: u
  };
  return d.rawText = pe(d), d;
}
async function Je(e, t, r, o, n, s) {
  const a = e.transformersGenerator, i = e.transformersTokenizer ?? a.tokenizer ?? null, c = {
    promptTokens: et(i, t),
    tokenCallbackIntervalSeconds: [],
    tokenCallbackCount: 0,
    tokenCountSource: "unavailable"
  }, l = [], u = {
    max_new_tokens: r.maxTokens,
    do_sample: r.temperature > 0,
    top_p: r.topP,
    repetition_penalty: r.repetitionPenalty,
    return_full_text: !1
  };
  r.temperature > 0 && (u.temperature = r.temperature), r.seed !== null && (u.seed = r.seed), o.disableThinkingSupported && (u.tokenizer_encode_kwargs = { enable_thinking: !r.disableThinking });
  const d = e.transformersModule?.TextStreamer;
  let m = "";
  i && d && (u.streamer = new d(i, {
    skip_prompt: !0,
    skip_special_tokens: !0,
    callback_function: (p) => {
      typeof p == "string" && n && (m += p, n(m));
    },
    token_callback_function: (p) => {
      const g = performance.now(), _ = Math.max(1, rt(p));
      for (let b = 0; b < _; b += 1)
        l.push(g);
    }
  }));
  const y = await a(t, u), h = J(y) || $;
  if (l.length > 0)
    c.tokenCallbackCount = l.length, c.tokenCountSource = "streamer", c.completionTokens = l.length, c.firstTokenOffsetMs = Math.max(0, l[0] - s), c.tokenCallbackIntervalSeconds = l.slice(1).map((p, g) => Math.max(0, (p - l[g]) / 1e3));
  else {
    const p = tt(i, h);
    typeof p == "number" && (c.completionTokens = p, c.tokenCountSource = "tokenizer");
  }
  return { ...c, text: h };
}
function Ye(e, t, r, o, n) {
  const s = n - o, a = r.completionTokens, i = typeof a == "number" && s > 0 ? a / (s / 1e3) : void 0, c = typeof r.firstTokenOffsetMs == "number" ? Math.max(0, (s - r.firstTokenOffsetMs) / 1e3) : void 0, l = typeof a == "number" && typeof c == "number" && c > 0 ? a / c : i, u = typeof r.promptTokens == "number" && typeof r.firstTokenOffsetMs == "number" && r.firstTokenOffsetMs > 0 ? r.promptTokens / (r.firstTokenOffsetMs / 1e3) : void 0, d = r.tokenCallbackIntervalSeconds.length > 0 ? r.tokenCallbackIntervalSeconds.reduce((g, _) => g + _, 0) / r.tokenCallbackIntervalSeconds.length : typeof a == "number" && a > 0 ? s / 1e3 / a : void 0, m = typeof r.promptTokens == "number" && typeof a == "number" ? r.promptTokens + a : void 0, y = typeof a == "number" && a >= t.maxTokens ? "length (estimated)" : "stop/unknown", h = r.tokenCallbackIntervalSeconds.length > 0 ? { transformersTokenIntervalTime: r.tokenCallbackIntervalSeconds } : void 0, p = {
    rawText: "",
    model: e,
    backend: "transformers-js",
    finishReason: y,
    measuredElapsedMs: s,
    promptTokens: r.promptTokens,
    completionTokens: a,
    totalTokens: m,
    measuredCompletionTokensPerSecond: i,
    extra: {
      e2e_latency_s: s / 1e3,
      prefill_tokens_per_s: u,
      decode_tokens_per_s: l,
      time_to_first_token_s: typeof r.firstTokenOffsetMs == "number" ? r.firstTokenOffsetMs / 1e3 : void 0,
      time_per_output_token_s: d,
      latencyBreakdown: h,
      token_count_source: r.tokenCountSource
    },
    latencyBreakdown: h
  };
  return p.rawText = pe(p), p;
}
function pe(e) {
  const t = e.backend === "transformers-js" ? "Transformers.js" : e.backend === "webllm" ? "WebLLM" : "unknown", r = [
    `model: ${e.model}`,
    `backend: ${t}`,
    `finish_reason: ${e.finishReason}`,
    `measured_elapsed_ms: ${e.measuredElapsedMs.toFixed(0)}`,
    "",
    "Token usage:",
    `  prompt_tokens: ${e.promptTokens ?? "n/a"}`,
    `  completion_tokens: ${e.completionTokens ?? "n/a"}`,
    `  total_tokens: ${e.totalTokens ?? "n/a"}`,
    `  measured_completion_tokens_per_second: ${e.measuredCompletionTokensPerSecond?.toFixed(2) ?? "n/a"}`
  ];
  return e.extra ? (r.push("", e.backend === "transformers-js" ? "Transformers.js measured telemetry:" : "WebLLM usage.extra:", `  e2e_latency_s: ${I(e.extra.e2e_latency_s, 3)}`, `  prefill_tokens_per_s: ${I(e.extra.prefill_tokens_per_s, 2)}`, `  decode_tokens_per_s: ${I(e.extra.decode_tokens_per_s, 2)}`, `  time_to_first_token_s: ${I(e.extra.time_to_first_token_s, 3)}`, `  time_per_output_token_s: ${I(e.extra.time_per_output_token_s, 4)}`), typeof e.extra.grammar_init_s == "number" && r.push(`  grammar_init_s: ${e.extra.grammar_init_s.toFixed(3)}`), typeof e.extra.grammar_per_token_s == "number" && r.push(`  grammar_per_token_s: ${e.extra.grammar_per_token_s.toFixed(6)}`), e.backend === "transformers-js" && typeof e.extra.token_count_source == "string" && r.push(`  token_count_source: ${e.extra.token_count_source}`), e.latencyBreakdown && Object.keys(e.latencyBreakdown).length > 0 && r.push("", "Latency breakdown:", JSON.stringify(e.latencyBreakdown, null, 2))) : r.push("", `${t} backend telemetry: n/a`), e.error && r.push("", `error: ${e.error}`), e.legacyStats && r.push("", "Legacy WebLLM runtimeStatsText:", e.legacyStats), r.join(`
`);
}
function Ze(e) {
  if (!e || typeof e != "object")
    return;
  const t = {};
  for (const [r, o] of Object.entries(e))
    if (Array.isArray(o)) {
      const n = o.filter((s) => typeof s == "number" && Number.isFinite(s));
      n.length > 0 && (t[r] = n);
    }
  return Object.keys(t).length > 0 ? t : void 0;
}
function J(e) {
  if (typeof e == "string")
    return e;
  if (Array.isArray(e))
    return e.map(J).filter(Boolean).join(`
`);
  if (!e || typeof e != "object")
    return "";
  const t = e, r = t.generated_text;
  if (typeof r == "string")
    return r;
  if (Array.isArray(r)) {
    const n = r.filter((s) => !!s && typeof s == "object").filter((s) => s.role === "assistant" && typeof s.content == "string").at(-1);
    return typeof n?.content == "string" ? n.content : r.map(J).filter(Boolean).join(`
`);
  }
  for (const o of ["text", "content", "answer"])
    if (typeof t[o] == "string")
      return t[o];
  return JSON.stringify(e, null, 2);
}
function et(e, t) {
  if (e) {
    try {
      if (typeof e.apply_chat_template == "function") {
        const r = e.apply_chat_template(t, { tokenize: !0, add_generation_prompt: !0 }), o = T(r);
        if (typeof o == "number")
          return o;
      }
    } catch {
    }
    try {
      const r = t.map((o) => `${o.role}: ${o.content}`).join(`

`) + `

assistant:`;
      if (typeof e.encode == "function") {
        const o = T(e.encode(r, { add_special_tokens: !0 }));
        if (typeof o == "number")
          return o;
      }
      return T(e(r, { add_special_tokens: !0 }));
    } catch {
      return;
    }
  }
}
function tt(e, t) {
  if (!(!e || !t || t === $))
    try {
      return typeof e.encode == "function" ? T(e.encode(t, { add_special_tokens: !1 })) : T(e(t, { add_special_tokens: !1 }));
    } catch {
      return;
    }
}
function rt(e) {
  return T(e) ?? 1;
}
function T(e) {
  if (e == null)
    return;
  if (typeof e == "number" || typeof e == "bigint")
    return 1;
  if (ArrayBuffer.isView(e))
    return e.length;
  if (Array.isArray(e)) {
    if (e.length === 0)
      return 0;
    if (e.every((n) => typeof n == "number" || typeof n == "bigint"))
      return e.length;
    const o = e.map(T).filter((n) => typeof n == "number");
    return o.length > 0 ? o.reduce((n, s) => n + s, 0) : e.length;
  }
  if (typeof e != "object")
    return;
  const t = e;
  for (const o of ["input_ids", "data", "tokens", "ids"]) {
    const n = T(t[o]);
    if (typeof n == "number")
      return n;
  }
  const r = t.dims;
  if (Array.isArray(r) && r.every((o) => typeof o == "number"))
    return r.reduce((o, n) => o * n, 1);
}
function I(e, t) {
  return typeof e == "number" && Number.isFinite(e) ? e.toFixed(t) : "n/a";
}
const F = 16e3;
function ot(e, t) {
  if (t === 1 || e.length === 0)
    return e;
  const r = 1024, o = r / 4, n = new Float32Array(e.length), s = new Float32Array(e.length), a = new Float32Array(r);
  for (let i = 0; i < r; i += 1)
    a[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (r - 1));
  for (let i = 0; i + r <= n.length; i += o)
    for (let c = 0; c < r; c += 1) {
      const l = i + c * t, u = Math.floor(l);
      if (u + 1 >= e.length)
        break;
      const d = l - u, m = e[u] * (1 - d) + e[u + 1] * d;
      n[i + c] += m * a[c], s[i + c] += a[c];
    }
  for (let i = 0; i < n.length; i += 1)
    s[i] > 1e-6 && (n[i] /= s[i]);
  return n;
}
function nt(e, t) {
  const r = new ArrayBuffer(44 + e.length * 2), o = new DataView(r), n = (a, i) => {
    for (let c = 0; c < i.length; c += 1)
      o.setUint8(a + c, i.charCodeAt(c));
  };
  n(0, "RIFF"), o.setUint32(4, 36 + e.length * 2, !0), n(8, "WAVE"), n(12, "fmt "), o.setUint32(16, 16, !0), o.setUint16(20, 1, !0), o.setUint16(22, 1, !0), o.setUint32(24, t, !0), o.setUint32(28, t * 2, !0), o.setUint16(32, 2, !0), o.setUint16(34, 16, !0), n(36, "data"), o.setUint32(40, e.length * 2, !0);
  let s = 44;
  for (let a = 0; a < e.length; a += 1) {
    const i = Math.max(-1, Math.min(1, e[a]));
    o.setInt16(s, i < 0 ? i * 32768 : i * 32767, !0), s += 2;
  }
  return new Blob([r], { type: "audio/wav" });
}
const st = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm", at = 1048576;
function it(e, t) {
  const r = t && /^[FM][1-5]$/.test(t) ? t : "F1";
  return `https://huggingface.co/${e}/resolve/main/voices/${r}.bin`;
}
function ct(e) {
  if (e == null)
    return 0;
  if (ArrayBuffer.isView(e))
    return e.length ?? 1;
  if (Array.isArray(e))
    return e.length;
  const t = e;
  return t?.data && typeof t.data.length == "number" ? t.data.length : Array.isArray(t?.dims) ? t.dims.reduce((r, o) => r * o, 1) : typeof t?.size == "number" ? t.size : 1;
}
function j(e, t, r, o) {
  return new e(t, {
    skip_prompt: !0,
    skip_special_tokens: !0,
    callback_function: (n) => {
      typeof n == "string" && (o.firstTokenMs === void 0 && (o.firstTokenMs = performance.now()), o.text += n, r?.(o.text));
    },
    token_callback_function: (n) => {
      o.completionTokens += ct(n);
    }
  });
}
function lt(e, t) {
  return t === "vlm-vision2seq" ? { embed_tokens: "fp16", vision_encoder: "q4", decoder_model_merged: "q4" } : e.transformersDtype ? e.transformersDtype : { embed_tokens: "fp16", vision_encoder: "fp16", decoder_model_merged: "q4f16" };
}
async function oe(e, t, r) {
  const o = await t.AutoProcessor.from_pretrained(e.id, { progress_callback: r }), n = e.transformersDtype ?? "q4f16", s = await t.AutoModelForAudioTextToText.from_pretrained(e.id, { device: "webgpu", dtype: n, progress_callback: r });
  return { processor: o, model: s, Streamer: t.TextStreamer };
}
async function ut(e, t, r, o, n = {}) {
  const s = e.mmRuntime;
  if (!s)
    throw new Error(`Model ${e.shortName} has no multimodal runtime.`);
  switch (s) {
    case "stt": {
      const a = e.transformersDtype ?? (r === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : { encoder_model: "fp32", decoder_model_merged: "q8" });
      return { kind: "stt", transcriber: await t.pipeline("automatic-speech-recognition", e.id, { device: r, dtype: a, progress_callback: o }) };
    }
    case "tts-pipeline":
      return { kind: "tts-pipeline", synth: await t.pipeline("text-to-speech", e.id, { device: r, dtype: "fp32", progress_callback: o }), modelId: e.id };
    case "tts-kokoro": {
      const a = await mt(n.kokoro);
      return { kind: "tts-kokoro", tts: await a.KokoroTTS.from_pretrained(e.id, {
        dtype: r === "webgpu" ? "fp32" : "q8",
        device: r,
        progress_callback: o
      }), TextSplitterStream: a.TextSplitterStream };
    }
    case "vlm-vision2seq":
    case "vlm-imagetext": {
      const a = await t.AutoProcessor.from_pretrained(e.id, { progress_callback: o }), c = await (s === "vlm-vision2seq" ? t.AutoModelForVision2Seq : t.AutoModelForImageTextToText).from_pretrained(e.id, { device: "webgpu", dtype: lt(e, s), progress_callback: o });
      return {
        kind: "vlm",
        processor: a,
        model: c,
        Streamer: t.TextStreamer,
        loadImage: t.load_image,
        maxPixels: s === "vlm-imagetext" ? at : 0,
        imageArray: s === "vlm-vision2seq",
        // Generous caps so descriptions/OCR are not truncated mid-output (any OCR model → 2048).
        maxNewTokens: e.id.toLowerCase().includes("ocr") ? 2048 : 1024
      };
    }
    case "gemma-mm": {
      const a = await t.AutoProcessor.from_pretrained(e.id, { progress_callback: o }), i = await t.Gemma4ForConditionalGeneration.from_pretrained(e.id, { device: "webgpu", dtype: "q4f16", progress_callback: o });
      return { kind: "gemma", processor: a, model: i, Streamer: t.TextStreamer, loadImage: t.load_image };
    }
    case "audio-text-to-text":
      return { kind: "audiolm", ...await oe(e, t, o) };
    case "voxtral-realtime":
      return { kind: "audiolm-stream", ...await oe(e, t, o) };
    default:
      throw new Error(`Unsupported multimodal runtime: ${s}`);
  }
}
async function mt(e) {
  return e?.load ? e.load() : await import(e?.url ?? st);
}
async function dt(e) {
  if (!e)
    return;
  const t = e.model;
  try {
    typeof t?.dispose == "function" && await t.dispose();
  } catch {
  }
}
const ft = 30, pt = 720, ne = "Transcribe this audio verbatim.";
function ht(e) {
  const t = ft * F, r = pt * F, o = Math.min(Math.max(0, Math.floor(e)), r), n = [];
  for (let s = 0; s < o; s += t)
    n.push({ start: s, end: Math.min(s + t, o) });
  return n;
}
async function gt(e, t, r) {
  if (typeof t == "string" && e.kind !== "stt")
    throw new Error("URL audio input is only supported by ASR-pipeline models (Whisper/Moonshine). Decode to 16 kHz mono PCM first (decodeAudioTo16kMono).");
  if (e.kind === "gemma")
    return yt(e, t, r);
  if (e.kind === "audiolm")
    return bt(e, t, r);
  if (e.kind === "audiolm-stream")
    return xt(e, t, r);
  if (e.kind !== "stt")
    throw new Error("Loaded model cannot transcribe audio.");
  let o;
  try {
    o = await e.transcriber(t, { return_timestamps: !0, chunk_length_s: 30, stride_length_s: 5 });
  } catch {
    o = await e.transcriber(t);
  }
  const n = String(o?.text ?? "").trim(), a = (Array.isArray(o?.chunks) ? o.chunks : []).filter((i) => Array.isArray(i.timestamp)).map((i) => ({ start: i.timestamp[0] ?? 0, end: i.timestamp[1] ?? 0, text: String(i.text ?? "").trim() })).filter((i) => i.text.length > 0);
  return { text: n, segments: a };
}
async function yt(e, t, r) {
  const o = ht(t.length);
  if (o.length <= 1) {
    const l = o[0] ? t.subarray(o[0].start, o[0].end) : t, u = await Y(e, { audio: l, prompt: ne }, r);
    return { text: u.text, segments: [], gen: u };
  }
  const n = [], s = [], a = performance.now();
  let i = 0, c;
  for (const l of o) {
    const u = s.join(" "), d = await Y(e, { audio: t.subarray(l.start, l.end), prompt: ne }, (y) => {
      r?.(u ? `${u} ${y}` : y);
    }), m = d.text.trim();
    m && (n.push({ start: l.start / F, end: l.end / F, text: m }), s.push(m), r?.(s.join(" "))), i += d.completionTokens, c === void 0 && d.firstTokenMs !== void 0 && (c = d.firstTokenMs);
  }
  return { text: s.join(" "), segments: n, gen: { completionTokens: i, firstTokenMs: c, startedMs: a, endedMs: performance.now() } };
}
const wt = "Transcribe this audio verbatim.";
async function bt(e, t, r) {
  const o = await kt(e, t, wt, r);
  return { text: o.text, segments: [], gen: o };
}
async function kt(e, t, r, o) {
  const s = [{ role: "user", content: `${e.processor?.config?.audio_token ?? "<|audio|>"}${r}` }], a = e.processor.apply_chat_template(s, { add_generation_prompt: !0, tokenize: !1 }), i = await e.processor(a, t), c = { text: "", completionTokens: 0, firstTokenMs: void 0 }, l = performance.now(), u = j(e.Streamer, e.processor.tokenizer, o, c);
  return await e.model.generate({ ...i, max_new_tokens: 1024, do_sample: !1, streamer: u }), { text: c.text.trim(), completionTokens: c.completionTokens, firstTokenMs: c.firstTokenMs, startedMs: l, endedMs: performance.now() };
}
async function xt(e, t, r) {
  const o = await Mt(e, t, r);
  return { text: o.text, segments: [], gen: o };
}
async function Mt(e, t, r) {
  const o = e.processor, n = o.feature_extractor.config.hop_length, s = Math.floor(o.feature_extractor.config.n_fft / 2), a = o.num_samples_first_audio_chunk, i = o.num_samples_per_audio_chunk, c = o.num_mel_frames_first_audio_chunk, l = o.audio_length_per_tok, u = o.raw_audio_length_per_tok, d = o.num_right_pad_tokens * u, m = new Float32Array(t.length + d);
  m.set(t);
  const y = await o(m.subarray(0, a), { is_streaming: !0, is_first_audio_chunk: !0 });
  async function* h() {
    yield (await o(m.subarray(0, a), { is_streaming: !0, is_first_audio_chunk: !0 })).input_features;
    let R = c, v = R * n - s;
    for (; v + i < m.length; ) {
      const H = v + i;
      yield (await o(m.slice(v, H), { is_streaming: !0, is_first_audio_chunk: !1 })).input_features, R += l, v = R * n - s;
    }
  }
  const p = Math.max(256, Math.ceil(m.length / u) + 128), g = { text: "", completionTokens: 0, firstTokenMs: void 0 }, _ = performance.now(), b = j(e.Streamer, o.tokenizer, r, g);
  return await e.model.generate({
    input_ids: y.input_ids,
    input_features: h(),
    max_new_tokens: p,
    streamer: b
  }), { text: g.text.trim(), completionTokens: g.completionTokens, firstTokenMs: g.firstTokenMs, startedMs: _, endedMs: performance.now() };
}
async function he(e, t, r) {
  if (e.kind === "tts-kokoro")
    return e.tts.generate(t, { voice: r.voice, speed: r.speed ?? 1 });
  if (e.kind === "tts-pipeline") {
    const o = { speaker_embeddings: it(e.modelId, r.voice) };
    let n = t;
    return e.modelId === Ee && (n = `<en>${t}</en>`, o.num_inference_steps = 16), e.synth(n, o);
  }
  throw new Error("Loaded model cannot synthesize speech.");
}
function se(e) {
  return e?.kind === "tts-kokoro";
}
function _t(e, t) {
  if (e.kind !== "tts-kokoro")
    throw new Error("Streaming TTS requires a Kokoro model.");
  const r = new e.TextSplitterStream(), o = e.tts.stream(r, { voice: t.voice, speed: t.speed ?? 1 });
  async function* n() {
    for await (const s of o)
      yield s.audio;
  }
  return { splitter: r, chunks: n() };
}
async function Rt(e, t, r, o) {
  if (e.kind === "gemma")
    return Y(e, { imageSrc: t, prompt: r }, o);
  if (e.kind !== "vlm")
    throw new Error("Loaded model cannot analyze images.");
  const n = [{ role: "user", content: [{ type: "image" }, { type: "text", text: r }] }], s = e.processor.apply_chat_template(n, { add_generation_prompt: !0 }), a = e.maxPixels ? await Bt(t, e.maxPixels) : t, i = await e.loadImage(a), c = e.imageArray ? await e.processor(s, [i], {}) : await e.processor(s, i), l = { text: "", completionTokens: 0, firstTokenMs: void 0 }, u = performance.now(), d = j(e.Streamer, e.processor.tokenizer, o, l);
  return await e.model.generate({ ...c, max_new_tokens: e.maxNewTokens, do_sample: !1, streamer: d }), { text: l.text.trim(), completionTokens: l.completionTokens, firstTokenMs: l.firstTokenMs, startedMs: u, endedMs: performance.now() };
}
async function Y(e, t, r) {
  const o = [];
  t.imageSrc && o.push({ type: "image" }), t.audio && o.push({ type: "audio" }), o.push({ type: "text", text: t.prompt });
  const n = e.processor.apply_chat_template([{ role: "user", content: o }], { enable_thinking: !1, add_generation_prompt: !0 }), s = t.imageSrc ? await e.loadImage(t.imageSrc) : null, a = await e.processor(n, s, t.audio ?? null, { add_special_tokens: !1 }), i = { text: "", completionTokens: 0, firstTokenMs: void 0 }, c = performance.now(), l = j(e.Streamer, e.processor.tokenizer, r, i);
  return await e.model.generate({ ...a, max_new_tokens: 1024, do_sample: !1, streamer: l }), { text: i.text.trim(), completionTokens: i.completionTokens, firstTokenMs: i.firstTokenMs, startedMs: c, endedMs: performance.now() };
}
function Tt(e) {
  const t = [];
  let r = "";
  for (const o of e) {
    if (o.role === "system") {
      r += (r ? `

` : "") + o.content;
      continue;
    }
    let n = o.content;
    o.role === "user" && r && (n = `${r}

${n}`, r = ""), t.push({ role: o.role, content: [{ type: "text", text: n }] });
  }
  return r && t.unshift({ role: "user", content: [{ type: "text", text: r }] }), t;
}
async function St(e, t, r = {}) {
  const o = e.processor.apply_chat_template(Tt(t), { enable_thinking: !1, add_generation_prompt: !0 }), n = await e.processor(o, null, null, { add_special_tokens: !1 }), s = { text: "", completionTokens: 0, firstTokenMs: void 0 }, a = performance.now(), i = j(e.Streamer, e.processor.tokenizer, r.onDelta, s), c = (r.temperature ?? 0) > 0, l = { ...n, max_new_tokens: r.maxNewTokens ?? 1024, do_sample: c, streamer: i };
  return c && r.temperature !== void 0 && (l.temperature = r.temperature), r.topP !== void 0 && (l.top_p = r.topP), r.repetitionPenalty !== void 0 && (l.repetition_penalty = r.repetitionPenalty), await e.model.generate(l), { text: s.text.trim(), completionTokens: s.completionTokens, firstTokenMs: s.firstTokenMs, startedMs: a, endedMs: performance.now() };
}
function Nt(e) {
  return new Promise((t, r) => {
    const o = new Image();
    o.crossOrigin = "anonymous", o.onload = () => t(o), o.onerror = () => r(new Error("image load failed")), o.src = e;
  });
}
async function Bt(e, t) {
  if (!t)
    return e;
  const r = await Nt(e), o = r.naturalWidth * r.naturalHeight;
  if (o <= t)
    return e;
  const n = Math.sqrt(t / o), s = Math.max(1, Math.round(r.naturalWidth * n)), a = Math.max(1, Math.round(r.naturalHeight * n)), i = document.createElement("canvas");
  return i.width = s, i.height = a, i.getContext("2d")?.drawImage(r, 0, 0, s, a), i.toDataURL("image/png");
}
const vt = 4096;
function Lt(e = {}) {
  const t = typeof globalThis.location < "u" && typeof globalThis.location.origin == "string" ? globalThis.location.origin : null;
  return {
    modelSource: e.modelSource ?? "direct",
    proxyOrigin: e.proxyOrigin ?? t,
    verifyProxy: e.verifyProxy ?? !0,
    cacheBackend: e.cacheBackend ?? "indexeddb",
    webllm: e.webllm ?? {},
    kokoro: e.kokoro ?? {},
    tts: { voice: "af_heart", speed: 1, pitch: 1, ...e.tts },
    history: e.history ?? {}
  };
}
const qt = "huggingface.co", Ot = "raw.githubusercontent.com", Pt = "transformers-cache";
function Ct(e, t, r, o) {
  const n = It(e.prebuiltAppConfig);
  return {
    ...t === "direct" ? n : At(n, r),
    cacheBackend: o
  };
}
function It(e) {
  const t = new Set(e.model_list.map((n) => n.model_id)), r = me.filter((n) => !t.has(n.model_id)), o = [...e.model_list, ...r].map(Ge);
  return {
    ...e,
    model_list: o
  };
}
function At(e, t) {
  const r = e.model_list.map((o) => Et(o, t));
  return {
    ...e,
    model_list: r
  };
}
function Et(e, t) {
  return {
    ...e,
    model: ge(e.model, t),
    // WebLLM's bundled model_lib values usually point at raw.githubusercontent.com, while custom
    // MLC builds may point at Hugging Face. Proxy both forms so hosted Worker deployments stay
    // same-origin and avoid CORS/cache differences.
    model_lib: Dt(e.model_lib, t)
  };
}
function Dt(e, t) {
  return Gt(ge(e, t), t);
}
function ge(e, t) {
  let r;
  try {
    r = new URL(e);
  } catch {
    return e;
  }
  if (r.hostname !== qt)
    return e;
  const o = r.pathname.split("/").filter(Boolean), [n, s, ...a] = o;
  if (!n || !s)
    return e;
  const i = ["hf", n, s, ...a].map(encodeURIComponent).join("/"), c = new URL(`/${i}`, t);
  return c.search = r.search, c.href;
}
function Gt(e, t) {
  let r;
  try {
    r = new URL(e);
  } catch {
    return e;
  }
  if (r.hostname !== Ot)
    return e;
  const o = r.pathname.split("/").filter(Boolean), [n, s, a, ...i] = o;
  if (!n || !s || !a || i.length === 0)
    return e;
  const c = ["gh-raw", n, s, a, ...i].map(encodeURIComponent).join("/"), l = new URL(`/${c}`, t);
  return l.search = r.search, l.href;
}
function $t(e, t, r) {
  return r === null ? e : {
    ...e,
    model_list: e.model_list.map((o) => o.model_id === t ? { ...o, overrides: { ...o.overrides ?? {}, context_window_size: r } } : o)
  };
}
const jt = ["browserai-proxy/", "browser-json-llm-app/"];
async function ye(e) {
  const t = await fetch(new URL("/__worker-health", e), { cache: "no-store" });
  if (!t.ok)
    throw new S(`Proxy Worker is not active: ${e}/__worker-health returned ${t.status}. Deploy the worker-template with \`npx wrangler deploy\`.`);
  return t;
}
async function Xt(e, t, r) {
  const o = await ye(e), n = await o.text().catch(() => "");
  let s = n;
  try {
    s = JSON.parse(n);
  } catch {
  }
  const a = o.headers.get("X-Proxy-Worker") ?? "", i = typeof s == "object" && s !== null ? s : {};
  if (!(jt.some((h) => a.startsWith(h)) || i.ok === !0 && typeof i.version == "string"))
    throw new S(`Proxy Worker health check did not look like a compatible Worker. Status ${o.status}, X-Proxy-Worker: ${a || "missing"}.`);
  const l = r.model_list.find((h) => h.model_id === t);
  if (!l)
    throw new S(`Model ${t} is not present in the WebLLM AppConfig.`);
  const u = Ut(l, e);
  u.searchParams.set("probe", String(Date.now()));
  const d = await fetch(u, { cache: "no-store" }), m = d.headers.get("X-Proxy-Worker");
  if (!d.ok || u.origin === new URL(e).origin && !m)
    throw new S(`Proxy /hf model-config probe failed for ${t}: ${d.status}. URL: ${u.pathname}. ${await Ft(d)}`);
  const y = l.model_lib;
  if (y && y.startsWith(e)) {
    const h = new URL(y);
    h.searchParams.set("probe", String(Date.now()));
    const p = await fetch(h, { method: "HEAD", cache: "no-store" }), g = p.headers.get("X-Proxy-Worker");
    if (!p.ok || !g)
      throw new S(`Proxy model-library probe failed for ${t}: ${p.status}. URL: ${h.pathname}.`);
  }
}
function Ut(e, t) {
  const r = new URL(e.model, t), o = r.pathname.replace(/\/+$/, "");
  if (/\/resolve\/[^/]+(?:\/|$)/.test(o)) {
    const n = new URL(r.href.endsWith("/") ? r.href : `${r.href}/`);
    return new URL("mlc-chat-config.json", n);
  }
  return new URL(`${o}/resolve/main/mlc-chat-config.json`, r.origin);
}
async function ae(e, t) {
  await ye(e);
  const { owner: r, repo: o } = Wt(t);
  let n = "not fetched";
  for (const s of ["generation_config.json", "config.json"]) {
    const a = new URL(`/hf-transformers/${encodeURIComponent(r)}/${encodeURIComponent(o)}/resolve/main/${s}`, e);
    a.searchParams.set("probe", String(Date.now()));
    const i = await fetch(a, { method: "HEAD", cache: "no-store" }), c = i.headers.get("X-Proxy-Worker");
    if (n = `${a.pathname}: ${i.status}, X-Proxy-Worker=${c ?? "missing"}`, i.ok && c)
      return;
  }
  throw new S(`Proxy Transformers.js probe failed for ${t}. Last status: ${n}`);
}
function Wt(e) {
  const t = e.split("/");
  if (t.length < 2)
    throw new S(`Expected a Hugging Face repo ID in owner/repo form, got ${e}`);
  return { owner: t[0], repo: t.slice(1).join("/") };
}
async function Ft(e) {
  const t = await e.text().catch(() => "");
  if (!t)
    return `${e.status} ${e.statusText}`;
  try {
    return JSON.stringify(JSON.parse(t));
  } catch {
    return t.slice(0, 300);
  }
}
const Ht = [
  "maxBufferSize",
  "maxStorageBufferBindingSize",
  "maxComputeInvocationsPerWorkgroup",
  "maxComputeWorkgroupSizeX",
  "maxComputeWorkgroupSizeY",
  "maxComputeWorkgroupsPerDimension",
  "maxBindGroups",
  "maxBindingsPerBindGroup",
  "maxStorageBuffersPerShaderStage",
  "maxUniformBuffersPerShaderStage",
  "maxTextureDimension2D"
];
async function ie() {
  const e = navigator, t = globalThis, r = {
    webgpuSupported: !1,
    webgpuReason: "navigator.gpu is not available.",
    features: [],
    limits: {},
    deviceMemoryGB: e.deviceMemory,
    logicalProcessors: e.hardwareConcurrency,
    secureContext: t.isSecureContext === !0,
    crossOriginIsolated: t.crossOriginIsolated === !0,
    userAgent: navigator.userAgent,
    platform: e.userAgentData?.platform ?? navigator.platform
  };
  try {
    const o = await navigator.storage?.estimate?.();
    r.storageQuotaBytes = o?.quota, r.storageUsageBytes = o?.usage;
  } catch {
  }
  if (!("gpu" in navigator))
    return r;
  try {
    const o = await navigator.gpu.requestAdapter();
    if (!o)
      return { ...r, webgpuReason: "WebGPU exists, but no adapter was returned." };
    const n = o.limits, s = {};
    for (const c of Ht)
      typeof n[c] == "number" && (s[c] = n[c]);
    let a = !1;
    try {
      const c = await o.requestDevice();
      a = !0, c.destroy();
    } catch {
      a = !1;
    }
    const i = o.info;
    return {
      ...r,
      webgpuSupported: a,
      webgpuReason: a ? "WebGPU adapter and device are available." : "Adapter exists, but requestDevice() failed.",
      adapterInfo: i,
      features: Array.from(o.features).sort(),
      limits: s
    };
  } catch (o) {
    return {
      ...r,
      webgpuReason: o instanceof Error ? o.message : String(o)
    };
  }
}
const O = [
  "webllm/model",
  "webllm/config",
  "webllm/wasm"
], A = "tvmjs-opfs-store";
async function B() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? {
      usage: typeof e.usage == "number" ? e.usage : void 0,
      quota: typeof e.quota == "number" ? e.quota : void 0
    } : void 0;
  } catch {
    return;
  }
}
async function Vt() {
  const e = await B(), t = [];
  for (const n of O)
    t.push(await we(n));
  for (const n of O)
    t.push(await zt(n));
  t.push(await Qt()), await new Promise((n) => setTimeout(n, 250));
  const r = await B(), o = typeof e?.usage == "number" && typeof r?.usage == "number" ? Math.max(0, e.usage - r.usage) : void 0;
  return { before: e, after: r, freedBytes: o, scopes: t };
}
async function we(e) {
  if (!("caches" in globalThis))
    return {
      kind: "cache-storage",
      name: e,
      supported: !1,
      cleared: !1,
      error: "Cache Storage API is unavailable."
    };
  try {
    const t = await caches.delete(e);
    return { kind: "cache-storage", name: e, supported: !0, cleared: t };
  } catch (t) {
    return {
      kind: "cache-storage",
      name: e,
      supported: !0,
      cleared: !1,
      error: X(t)
    };
  }
}
async function zt(e) {
  return "indexedDB" in globalThis ? new Promise((t) => {
    let r = !1, o = !1;
    const n = indexedDB.deleteDatabase(e), s = (i) => {
      r || (r = !0, clearTimeout(a), t(i));
    }, a = setTimeout(() => {
      s({
        kind: "indexeddb",
        name: e,
        supported: !0,
        cleared: !1,
        error: o ? "Deletion is blocked by an open IndexedDB connection. Close other tabs for this site and try again." : "IndexedDB deletion timed out. Close other tabs for this site and try again."
      });
    }, 5e3);
    n.onblocked = () => {
      o = !0;
    }, n.onsuccess = () => {
      s({ kind: "indexeddb", name: e, supported: !0, cleared: !0 });
    }, n.onerror = () => {
      s({
        kind: "indexeddb",
        name: e,
        supported: !0,
        cleared: !1,
        error: n.error?.message ?? "Unknown IndexedDB error."
      });
    };
  }) : {
    kind: "indexeddb",
    name: e,
    supported: !1,
    cleared: !1,
    error: "IndexedDB is unavailable."
  };
}
async function Qt() {
  try {
    const e = navigator.storage;
    return typeof e?.getDirectory != "function" ? {
      kind: "opfs",
      name: A,
      supported: !1,
      cleared: !1,
      error: "OPFS is unavailable."
    } : (await (await e.getDirectory()).removeEntry(A, { recursive: !0 }), {
      kind: "opfs",
      name: A,
      supported: !0,
      cleared: !0
    });
  } catch (e) {
    return e instanceof DOMException && e.name === "NotFoundError" ? {
      kind: "opfs",
      name: A,
      supported: !0,
      cleared: !1
    } : {
      kind: "opfs",
      name: A,
      supported: !0,
      cleared: !1,
      error: X(e)
    };
  }
}
async function Kt() {
  return we(N);
}
function X(e) {
  return e instanceof Error ? e.message : String(e);
}
const N = "transformers-cache";
async function be(e) {
  const [t, r, o] = await Promise.all([
    er(e),
    tr(e),
    Yt(e)
  ]), n = [...t, ...r, ...o], s = Array.from(new Set(n.map((a) => a.kind)));
  return {
    downloaded: n.length > 0,
    matchedEntries: n.length,
    storageKinds: s,
    sampleKeys: n.slice(0, 5).map((a) => a.key)
  };
}
async function Jt(e) {
  const t = await B(), r = await be(e), o = [];
  for (const a of O)
    o.push(...await rr(a, e));
  for (const a of O)
    o.push(...await or(a, e));
  o.push(...await Zt(e)), await new Promise((a) => setTimeout(a, 250));
  const n = await B(), s = typeof t?.usage == "number" && typeof n?.usage == "number" ? Math.max(0, t.usage - n.usage) : void 0;
  return {
    targetModelId: e.modelId,
    before: t,
    after: n,
    freedBytes: s,
    scopes: o,
    deletedEntries: o,
    matchedBefore: r
  };
}
async function Yt(e) {
  if (!("caches" in globalThis))
    return [];
  try {
    return (await (await caches.open(N)).keys()).filter((o) => P(o.url, e)).map((o) => ({
      kind: "transformers-cache",
      scope: N,
      key: o.url
    }));
  } catch {
    return [];
  }
}
async function Zt(e) {
  if (!("caches" in globalThis))
    return [
      {
        kind: "transformers-cache",
        name: N,
        supported: !1,
        cleared: !1,
        error: "Cache Storage API is unavailable."
      }
    ];
  const t = [];
  try {
    const r = await caches.open(N), o = await r.keys();
    for (const n of o) {
      if (!P(n.url, e))
        continue;
      const s = await r.delete(n);
      t.push({
        kind: "transformers-cache",
        name: `${N}:${n.url}`,
        supported: !0,
        cleared: s
      });
    }
  } catch (r) {
    t.push({
      kind: "transformers-cache",
      name: N,
      supported: !0,
      cleared: !1,
      error: X(r)
    });
  }
  return t;
}
async function er(e) {
  if (!("caches" in globalThis))
    return [];
  const t = [];
  for (const r of O)
    try {
      const n = await (await caches.open(r)).keys();
      for (const s of n)
        P(s.url, e) && t.push({ kind: "cache-storage", scope: r, key: s.url });
    } catch {
    }
  return t;
}
async function tr(e) {
  if (!("indexedDB" in globalThis))
    return [];
  const t = [];
  for (const r of O)
    try {
      const o = await ke(r);
      for (const n of o)
        P(n, e) && t.push({ kind: "indexeddb", scope: r, key: n });
    } catch {
    }
  return t;
}
async function rr(e, t) {
  if (!("caches" in globalThis))
    return [
      {
        kind: "cache-storage",
        name: e,
        supported: !1,
        cleared: !1,
        error: "Cache Storage API is unavailable."
      }
    ];
  const r = [];
  try {
    const o = await caches.open(e), n = await o.keys();
    for (const s of n) {
      if (!P(s.url, t))
        continue;
      const a = await o.delete(s);
      r.push({
        kind: "cache-storage",
        name: `${e}:${s.url}`,
        supported: !0,
        cleared: a
      });
    }
  } catch (o) {
    r.push({
      kind: "cache-storage",
      name: e,
      supported: !0,
      cleared: !1,
      error: X(o)
    });
  }
  return r;
}
async function or(e, t) {
  if (!("indexedDB" in globalThis))
    return [
      {
        kind: "indexeddb",
        name: e,
        supported: !1,
        cleared: !1,
        error: "IndexedDB is unavailable."
      }
    ];
  const r = [];
  try {
    const o = await ke(e);
    for (const n of o)
      P(n, t) && (await nr(e, n), r.push({
        kind: "indexeddb",
        name: `${e}:${n}`,
        supported: !0,
        cleared: !0
      }));
  } catch (o) {
    r.push({
      kind: "indexeddb",
      name: e,
      supported: !0,
      cleared: !1,
      error: X(o)
    });
  }
  return r;
}
function ke(e) {
  return new Promise((t, r) => {
    const o = indexedDB.open(e, 1);
    o.onupgradeneeded = () => {
      o.transaction?.abort(), t([]);
    }, o.onerror = () => {
      o.error?.name !== "AbortError" && r(o.error ?? new Error(`Could not open ${e}`));
    }, o.onsuccess = () => {
      const n = o.result;
      if (!n.objectStoreNames.contains("urls")) {
        n.close(), t([]);
        return;
      }
      const i = n.transaction("urls", "readonly").objectStore("urls").getAllKeys();
      i.onsuccess = () => {
        n.close(), t(i.result.map((c) => String(c)));
      }, i.onerror = () => {
        n.close(), r(i.error ?? new Error(`Could not list keys for ${e}`));
      };
    };
  });
}
function nr(e, t) {
  return new Promise((r, o) => {
    const n = indexedDB.open(e, 1);
    n.onerror = () => o(n.error ?? new Error(`Could not open ${e}`)), n.onsuccess = () => {
      const s = n.result;
      if (!s.objectStoreNames.contains("urls")) {
        s.close(), r();
        return;
      }
      const c = s.transaction("urls", "readwrite").objectStore("urls").delete(t);
      c.onsuccess = () => {
        s.close(), r();
      }, c.onerror = () => {
        s.close(), o(c.error ?? new Error(`Could not delete ${t}`));
      };
    };
  });
}
function P(e, t) {
  const r = ce(e), o = /* @__PURE__ */ new Set([
    t.modelId,
    ...t.repoLabels,
    ...t.artifactUrls,
    ...t.artifactUrls.map((n) => ce(n))
  ]);
  for (const n of o) {
    const s = n.trim();
    if (s && r.includes(s))
      return !0;
  }
  return !1;
}
function ce(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e;
  }
}
const sr = "browserai:v1:history", ar = 200, ir = /* @__PURE__ */ new Set([
  "qwen",
  "google",
  "meta",
  "openai",
  "ibm",
  "microsoft",
  "nvidia",
  "liquid",
  "huggingface",
  "mistral",
  "other"
]);
function cr() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
function lr(e) {
  return typeof e == "number" && Number.isFinite(e);
}
function ur(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, r = ["ts", "promptTokens", "completionTokens", "decode", "ttft", "totalMs", "measured"];
  for (const o of r)
    if (!lr(t[o]))
      return null;
  return typeof t.model != "string" || typeof t.case != "string" || t.case.length === 0 ? null : {
    ts: t.ts,
    model: t.model,
    vendor: ir.has(t.vendor) ? t.vendor : "other",
    backend: t.backend === "transformers-js" ? "transformers-js" : "webllm",
    case: t.case,
    promptTokens: t.promptTokens,
    completionTokens: t.completionTokens,
    decode: t.decode,
    ttft: t.ttft,
    totalMs: t.totalMs,
    measured: t.measured
  };
}
class mr {
  #e;
  #t;
  #a;
  #r;
  constructor(t = {}) {
    this.#e = t.storage === void 0 ? cr() : t.storage, this.#t = t.key ?? sr, this.#a = t.maxRecords ?? ar, this.#r = this.#s();
  }
  /** The in-memory records, newest first. */
  get records() {
    return this.#r;
  }
  /** Prepend a record and persist. Returns the updated list. */
  append(t) {
    return this.#r = [t, ...this.#r].slice(0, this.#a), this.#i(this.#r), this.#r;
  }
  /** Overwrite the history (e.g. after deleting selected rows). */
  replace(t) {
    this.#r = t.slice(0, this.#a), this.#i(this.#r);
  }
  clear() {
    this.#r = [];
    try {
      this.#e?.removeItem(this.#t);
    } catch {
    }
  }
  aggregateByModel(t = "all") {
    return fr(this.#r, t);
  }
  #s() {
    if (!this.#e)
      return [];
    try {
      const t = this.#e.getItem(this.#t);
      if (!t)
        return [];
      const r = JSON.parse(t);
      return Array.isArray(r) ? r.map(ur).filter((o) => o !== null) : [];
    } catch {
      return [];
    }
  }
  #i(t) {
    if (this.#e)
      try {
        this.#e.setItem(this.#t, JSON.stringify(t));
      } catch {
      }
  }
}
function dr(e) {
  const t = `${e.id} ${e.shortName}`.toLowerCase();
  return t.includes("qwen") ? "qwen" : t.includes("gemma") ? "google" : t.includes("llama") || t.includes("hermes") ? "meta" : t.includes("whisper") ? "openai" : t.includes("granite") ? "ibm" : t.includes("phi") ? "microsoft" : t.includes("nemotron") || t.includes("parakeet") ? "nvidia" : t.includes("lfm") || t.includes("liquid") ? "liquid" : t.includes("smollm") || t.includes("smolvlm") ? "huggingface" : t.includes("mistral") || t.includes("ministral") || t.includes("voxtral") ? "mistral" : (t.includes("olmo") || t.includes("minicpm"), "other");
}
function fr(e, t) {
  const r = /* @__PURE__ */ new Map();
  for (const o of e) {
    if (t !== "all" && o.case !== t)
      continue;
    const n = r.get(o.model) ?? { vendor: o.vendor, runs: 0, decode: 0, ttft: 0, totalMs: 0, measured: 0 };
    n.runs += 1, n.decode += o.decode, n.ttft += o.ttft, n.totalMs += o.totalMs, n.measured += o.measured, r.set(o.model, n);
  }
  return Array.from(r.entries()).map(([o, n]) => ({
    model: o,
    vendor: n.vendor,
    runs: n.runs,
    decode: n.decode / n.runs,
    ttft: n.ttft / n.runs,
    totalMs: n.totalMs / n.runs,
    measured: n.measured / n.runs
  }));
}
function pr(e, t) {
  const r = Math.max(0, e.endedMs - e.startedMs), o = e.completionTokens > 0 ? e.completionTokens : void 0, n = e.firstTokenMs !== void 0 ? Math.max(0, (e.firstTokenMs - e.startedMs) / 1e3) : void 0, s = e.firstTokenMs !== void 0 ? Math.max(1e-3, (e.endedMs - e.firstTokenMs) / 1e3) : r / 1e3, a = o !== void 0 && r > 0 ? o / (r / 1e3) : void 0;
  return {
    rawText: "",
    model: t,
    backend: "transformers-js",
    finishReason: "stop",
    measuredElapsedMs: r,
    completionTokens: o,
    totalTokens: o,
    measuredCompletionTokensPerSecond: a,
    extra: {
      e2e_latency_s: r / 1e3,
      decode_tokens_per_s: o !== void 0 ? o / s : void 0,
      time_to_first_token_s: n
    }
  };
}
function hr(e, t) {
  if (!t.model || t.model === "n/a")
    return null;
  const r = de(t.model), o = t.extra;
  return {
    ts: Date.now(),
    model: r.shortName,
    vendor: dr(r),
    backend: t.backend === "transformers-js" ? "transformers-js" : "webllm",
    case: e,
    promptTokens: t.promptTokens ?? 0,
    completionTokens: t.completionTokens ?? 0,
    decode: o?.decode_tokens_per_s ?? t.measuredCompletionTokensPerSecond ?? 0,
    ttft: o?.time_to_first_token_s ?? 0,
    totalMs: t.measuredElapsedMs,
    measured: t.measuredCompletionTokensPerSecond ?? 0
  };
}
class gr {
  #e = /* @__PURE__ */ new Map();
  /** Subscribe. Returns an unsubscribe function. */
  on(t, r) {
    let o = this.#e.get(t);
    return o || (o = /* @__PURE__ */ new Set(), this.#e.set(t, o)), o.add(r), () => this.off(t, r);
  }
  /** Subscribe for a single emission. Returns an unsubscribe function. */
  once(t, r) {
    const o = this.on(t, (n) => {
      o(), r(n);
    });
    return o;
  }
  off(t, r) {
    this.#e.get(t)?.delete(r);
  }
  emit(t, r) {
    const o = this.#e.get(t);
    if (o)
      for (const n of [...o])
        try {
          n(r);
        } catch {
        }
  }
  /** Remove every listener (all events). */
  removeAllListeners() {
    this.#e.clear();
  }
}
async function yr(e, t, r) {
  const o = await he(e, t, { voice: r.voice, speed: r.speed ?? 1 });
  return wr(o, r.pitch ?? 1, r.createUrl ?? !0);
}
function wr(e, t, r = !0) {
  const o = e.audio, n = e.sampling_rate, s = ot(o, t), a = t === 1 ? e.toBlob() : nt(s, n);
  return {
    url: r ? URL.createObjectURL(a) : null,
    blob: a,
    samples: o,
    sampleRate: n,
    durationSec: s.length / n
  };
}
const br = /* @__PURE__ */ new Set(["stt", "tts-pipeline", "tts-kokoro"]);
class kr extends gr {
  config;
  #e = [];
  #t = !1;
  #a = /* @__PURE__ */ new WeakMap();
  #r = 0;
  #s = null;
  #i = null;
  constructor(t = {}) {
    super(), this.config = Lt(t);
  }
  /* ------------------------------------------------------------------ */
  /* Catalog + slots                                                     */
  /* ------------------------------------------------------------------ */
  /** The full model catalog. */
  get presets() {
    return W;
  }
  /** Catalog lookup without fallback. */
  getPreset(t) {
    return W.find((r) => r.id === t);
  }
  /** Currently loaded models (read-only snapshot). */
  get loadedModels() {
    return this.#e;
  }
  /** The loaded model occupying `task`, if any (≤1 owner per slot — enforced at load). */
  slotOwner(t) {
    return this.#e.find((r) => r.slots.includes(t));
  }
  textModel() {
    return this.slotOwner("text");
  }
  visionModel() {
    return this.slotOwner("vision");
  }
  sttModel() {
    return this.slotOwner("stt");
  }
  ttsModel() {
    return this.slotOwner("tts");
  }
  /** Every capability slot currently filled by a loaded model. */
  occupiedSlots() {
    const t = /* @__PURE__ */ new Set();
    for (const r of this.#e)
      for (const o of r.slots)
        t.add(o);
    return t;
  }
  /** Whether `preset` can load without evicting anything (all its slots are free). */
  isLoadable(t) {
    const r = this.occupiedSlots();
    return Q(t).every((o) => !r.has(o));
  }
  /** True while a load/unload/delete is in flight or any generation run is executing. */
  isBusy() {
    return this.#t || this.#r > 0;
  }
  /** True while a load/unload/cache-delete lifecycle operation is in flight. */
  get loading() {
    return this.#t;
  }
  /** The most recent hardware probe (from the last load), if any. */
  get lastHardwareSnapshot() {
    return this.#s;
  }
  /** Probe WebGPU + hardware now (also refreshes {@link lastHardwareSnapshot}). */
  async probeHardware() {
    return this.#s = await ie(), this.#s;
  }
  /** The run log configured by `config.history` (created lazily; localStorage-backed by default). */
  get history() {
    return this.#i ??= new mr(this.config.history), this.#i;
  }
  /**
   * Map a run's stats to a {@link RunRecord} and append it to {@link history}. Returns the record,
   * or null for stats without a model (error placeholders are never logged).
   */
  logRun(t, r) {
    const o = hr(t, r);
    return o && this.history.append(o), o;
  }
  /* ------------------------------------------------------------------ */
  /* Load / unload                                                       */
  /* ------------------------------------------------------------------ */
  /**
   * Load a model by catalog id. Evicts any loaded models occupying the slots this one needs
   * (whole-model eviction: a multi-slot owner is fully released even for a one-slot conflict).
   * Single-flight: a second load while one is in flight throws.
   *
   * @throws {UnknownModelError} for an id not in the catalog.
   * @throws {WebGPUUnavailableError} when WebGPU is required and unavailable. Only ASR-pipeline and
   *   TTS presets fall back to wasm; text, vision, Gemma and audio-LLM presets require WebGPU.
   * @throws {ModelLoadError} wrapping any backend load failure.
   */
  async load(t, r = {}) {
    const o = this.getPreset(t);
    if (!o)
      throw new V(t);
    if (this.#t)
      throw new M("Another load/unload is already in progress.");
    this.#t = !0;
    try {
      this.#s = await ie();
      let n = "webgpu";
      if (!this.#s.webgpuSupported)
        if (o.mmRuntime && br.has(o.mmRuntime))
          n = "wasm";
        else
          throw new We(this.#s.webgpuReason);
      const s = Q(o), a = this.#e.filter((u) => u.slots.some((d) => s.includes(d)));
      for (const u of a)
        await this.#o(u, () => this.#c(u));
      const i = performance.now(), c = (u) => {
        const d = { modelId: o.id, ...u };
        this.emit("loadprogress", d), r.onProgress?.(d);
      };
      let l;
      try {
        o.mmRuntime ? l = await this.#g(o, n, c) : o.backend === "transformers-js" ? l = await this.#h(o, c) : l = await this.#p(o, r, c);
      } catch (u) {
        throw u instanceof M ? u : new Fe(o.id, u);
      }
      return this.#e.push(l), this.#n(`Loaded ${o.shortName} in ${((performance.now() - i) / 1e3).toFixed(1)}s.`), this.emit("modelloaded", { model: l }), l;
    } finally {
      this.#t = !1;
    }
  }
  /** Unload one model, waiting out its in-flight runs. No-op when the id is not loaded. */
  async unload(t) {
    const r = this.#e.find((o) => o.modelId === t);
    if (r) {
      if (this.#t)
        throw new M("Another load/unload is already in progress.");
      this.#t = !0;
      try {
        await this.#o(r, () => this.#c(r));
      } finally {
        this.#t = !1;
      }
    }
  }
  /** Unload every loaded model. */
  async unloadAll() {
    if (this.#t)
      throw new M("Another load/unload is already in progress.");
    this.#t = !0;
    try {
      await this.#m();
    } finally {
      this.#t = !1;
    }
  }
  async #m() {
    for (const t of [...this.#e])
      await this.#o(t, () => this.#c(t));
  }
  /** Tear an engine down: WebLLM unload, Transformers dispose, multimodal dispose, worker terminate. */
  async #c(t) {
    try {
      try {
        await t.engine?.unload();
      } catch {
      }
      await Mr(t.transformersGenerator), await dt(t.multimodal);
    } finally {
      t.worker?.terminate(), this.#e = this.#e.filter((r) => r !== t), this.emit("modelunloaded", { modelId: t.modelId });
    }
  }
  /* ------------------------------------------------------------------ */
  /* Backend loaders                                                     */
  /* ------------------------------------------------------------------ */
  #l() {
    return this.config.modelSource === "proxy" ? "same-origin-proxy" : "direct";
  }
  #u() {
    const t = this.config.proxyOrigin;
    if (!t)
      throw new M('modelSource is "proxy" but no proxyOrigin is configured and no page origin is available.');
    return t;
  }
  async #p(t, r, o) {
    this.#n(`Loading ${t.shortName}… First load downloads and caches the model, so it can take a while.`);
    const n = await import("./index-CRTSj85G.js"), s = this.#l(), a = s === "same-origin-proxy" ? this.#u() : "https://invalid.example";
    let i = Ct(n, s, a, this.config.cacheBackend);
    i = $t(i, t.id, _r(r.contextLength)), s === "same-origin-proxy" && this.config.verifyProxy && (this.#n("Checking model proxy…"), await Xt(a, t.id, i));
    const c = {
      appConfig: i,
      logLevel: this.config.webllm.logLevel ?? "INFO",
      initProgressCallback: (d) => {
        o({ progress: Number.isFinite(d.progress) ? d.progress : 0, status: d.text || `Loading ${t.shortName}…` }), this.#n(d.text || `Loading ${t.shortName}…`);
      }
    };
    let l, u = null;
    if (this.config.webllm.worker) {
      u = this.config.webllm.worker();
      try {
        l = await n.CreateWebWorkerMLCEngine(u, t.id, c);
      } catch (d) {
        throw u.terminate(), d;
      }
    } else
      l = await n.CreateMLCEngine(t.id, c);
    return o({ progress: 1 }), { ...z(t), engine: l, worker: u };
  }
  async #h(t, r) {
    this.#n(`Loading ${t.shortName} with Transformers.js/WebGPU…`), r({ progress: 0.05 });
    const o = await import("./transformers.web-CFXccXZm.js");
    this.#f(o), this.#l() === "same-origin-proxy" && this.config.verifyProxy && (this.#n("Checking Transformers.js model proxy…"), await ae(this.#u(), t.id));
    const n = await o.pipeline("text-generation", t.id, {
      dtype: t.transformersDtype ?? "q4",
      device: "webgpu",
      progress_callback: this.#d(r)
    });
    return r({ progress: 1 }), {
      ...z(t),
      transformersGenerator: n,
      transformersTokenizer: n.tokenizer ?? null,
      transformersModule: o
    };
  }
  async #g(t, r, o) {
    this.#n(`Loading ${t.shortName} with Transformers.js/WebGPU…`), o({ progress: 0.05 });
    const n = await import("./transformers.web-CFXccXZm.js");
    this.#f(n), this.#l() === "same-origin-proxy" && this.config.verifyProxy && t.mmRuntime !== "tts-kokoro" && (this.#n("Checking Transformers.js model proxy…"), await ae(this.#u(), t.id));
    const s = await ut(t, n, r, this.#d(o), {
      kokoro: this.config.kokoro
    });
    return o({ progress: 1 }), { ...z(t), multimodal: s, mmModule: n };
  }
  /**
   * Adapt Transformers.js progress callbacks (percentages 0–100 interleaved with status-only
   * initiate/download/done events) to the SDK's 0–1 loadprogress. Status-only events re-emit the
   * last numeric value instead of snapping the reported progress back to zero.
   */
  #d(t) {
    let r = 0;
    return (o) => {
      const n = o, s = [n.status, n.file].filter(Boolean).join(" ");
      typeof n.progress == "number" ? (r = Math.max(0, Math.min(1, n.progress / 100)), t({ progress: r, status: n.status, file: n.file })) : s && t({ progress: r, status: n.status, file: n.file }), s && this.#n(s);
    };
  }
  #f(t) {
    const r = t.env;
    r && (r.allowLocalModels = !1, r.allowRemoteModels = !0, r.useBrowserCache = !0, r.useFSCache = !1, r.cacheKey = Pt, this.#l() === "same-origin-proxy" ? (r.remoteHost = `${this.#u()}/hf-transformers/`, r.remotePathTemplate = "{model}/resolve/{revision}/") : (r.remoteHost = "https://huggingface.co/", r.remotePathTemplate = "{model}/resolve/{revision}/"));
  }
  /* ------------------------------------------------------------------ */
  /* Inference façade                                                    */
  /* ------------------------------------------------------------------ */
  /**
   * Run one text generation against the loaded Text-slot model. A Gemma-4 multimodal handle has no
   * WebLLM engine or Transformers.js LM pipeline, so it routes through the Gemma text path;
   * everything else goes to the shared backend-agnostic generator. Runtime parameters default to
   * the loaded model's preset defaults, with `options.runtime` merged on top.
   */
  async generateText(t, r = {}) {
    const o = this.textModel();
    if (!o)
      throw new L("text");
    const n = de(o.modelId), s = { ...je(n.defaultRuntime), ...r.runtime };
    return this.#o(o, async () => {
      const a = o.multimodal;
      if (a && a.kind === "gemma") {
        const i = await St(a, t, {
          maxNewTokens: s.maxTokens,
          temperature: s.temperature,
          topP: s.topP,
          repetitionPenalty: s.repetitionPenalty,
          onDelta: r.onDelta
        }), c = pr(i, o.modelId);
        return c.finishReason = i.completionTokens >= s.maxTokens ? "length" : "stop", { text: i.text || $, stats: c };
      }
      return He(xr(o), t, s, n, {
        schema: r.schema,
        onDelta: r.onDelta,
        resetChat: r.resetChat
      });
    });
  }
  /** Reset the WebLLM KV cache of the loaded text model (e.g. for a "new chat"). Queues behind in-flight runs. */
  async resetTextChat() {
    const t = this.textModel();
    t?.engine && await this.#o(t, async () => {
      await t.engine?.resetChat(!1);
    });
  }
  /** Transcribe 16 kHz mono PCM (or a URL) with the loaded Transcription-slot model. */
  async transcribe(t, r) {
    const o = this.sttModel();
    if (!o?.multimodal)
      throw new L("stt");
    const n = o.multimodal;
    return this.#o(o, () => gt(n, t, r));
  }
  /** Synthesize speech with the loaded Speech-slot model. Returns the raw model audio. */
  async synthesize(t, r = {}) {
    const o = this.ttsModel();
    if (!o?.multimodal)
      throw new L("tts");
    const n = o.multimodal, { voice: s, speed: a } = { ...this.config.tts, ...r };
    return this.#o(o, () => he(n, t, { voice: s, speed: a }));
  }
  /**
   * Synthesize speech and package it as a playable clip (pitch baked into the blob, original PCM
   * kept for re-pitching). Voice/speed/pitch default to the client's TTS config.
   */
  async synthesizeToClip(t, r = {}) {
    const o = this.ttsModel();
    if (!o?.multimodal)
      throw new L("tts");
    const n = o.multimodal, { voice: s, speed: a, pitch: i } = { ...this.config.tts, ...r };
    return this.#o(o, () => yr(n, t, { voice: s, speed: a, pitch: i, createUrl: r.createUrl }));
  }
  /** Whether the loaded Speech-slot model supports sentence-streaming synthesis (Kokoro). */
  supportsStreamingTts() {
    return se(this.ttsModel()?.multimodal);
  }
  /**
   * Begin a streaming TTS session on the loaded Kokoro model: push LLM deltas into `splitter`,
   * consume `chunks` (one RawAudio per sentence), then call `release()` when done. The session
   * holds the TTS model's serialization lock until released so no other speech run interleaves —
   * the returned promise resolves only once the lock is actually held (queued behind in-flight
   * speech runs), and the Kokoro stream is created after that point.
   * @throws {MissingModelError} when no Speech model is loaded or it cannot stream.
   */
  async createStreamingTts(t = {}) {
    const r = this.ttsModel(), o = r?.multimodal;
    if (!r || !se(o))
      throw new L("tts", "Streaming TTS requires a loaded Kokoro speech model.");
    const { voice: n, speed: s } = { ...this.config.tts, ...t };
    let a;
    const i = new Promise((m) => {
      a = m;
    });
    await new Promise((m) => {
      this.#o(r, () => (m(), i));
    });
    const { splitter: l, chunks: u } = _t(o, { voice: n, speed: s });
    let d = !1;
    return {
      splitter: l,
      chunks: u,
      release: () => {
        d || (d = !0, a());
      }
    };
  }
  /** Ask a question about an image with the loaded Image-slot model (VLM or Gemma). */
  async describeImage(t, r, o) {
    const n = this.visionModel();
    if (!n?.multimodal)
      throw new L("vision");
    const s = n.multimodal;
    return this.#o(n, () => Rt(s, t, r, o));
  }
  /* ------------------------------------------------------------------ */
  /* Cache management                                                    */
  /* ------------------------------------------------------------------ */
  /** Whether a model's artifacts are present in browser storage (Cache API / IndexedDB). */
  async cacheStatus(t) {
    const r = this.getPreset(t);
    if (!r)
      throw new V(t);
    return be(le(r));
  }
  /** Origin-wide storage usage/quota estimate (browser-rounded). */
  estimateStorage() {
    return B();
  }
  /**
   * Delete one model's downloaded artifacts. If the model is loaded it is released first (its
   * in-flight runs are awaited). Targets model artifact storage only.
   */
  async deleteModelArtifacts(t) {
    const r = this.getPreset(t);
    if (!r)
      throw new V(t);
    if (this.#t)
      throw new M("Another load/unload is already in progress.");
    this.#t = !0;
    try {
      const o = this.#e.find((n) => n.modelId === t);
      return o && await this.#o(o, () => this.#c(o)), await Jt(le(r));
    } finally {
      this.#t = !1;
    }
  }
  /** Delete ALL downloaded model artifacts (WebLLM + Transformers.js), releasing loaded models first. */
  async deleteAllModelArtifacts() {
    if (this.#t)
      throw new M("Another load/unload is already in progress.");
    this.#t = !0;
    try {
      const t = await B();
      await this.#m();
      const r = await Vt(), o = await Kt();
      await new Promise((a) => setTimeout(a, 250));
      const n = await B(), s = typeof t?.usage == "number" && typeof n?.usage == "number" ? Math.max(0, t.usage - n.usage) : void 0;
      return { before: t, after: n, freedBytes: s, scopes: [...r.scopes, o] };
    } finally {
      this.#t = !1;
    }
  }
  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */
  /** Serialize work per loaded model: a run (or teardown) waits for prior runs on the same model. */
  #o(t, r) {
    const n = (this.#a.get(t) ?? Promise.resolve()).then(async () => {
      this.#r += 1;
      try {
        return await r();
      } finally {
        this.#r -= 1;
      }
    });
    return this.#a.set(t, n.then(() => {
    }, () => {
    })), n;
  }
  #n(t) {
    this.emit("status", { message: t });
  }
}
function z(e) {
  return {
    modelId: e.id,
    slots: Q(e),
    backend: e.backend,
    engine: null,
    worker: null,
    transformersGenerator: null,
    transformersTokenizer: null,
    transformersModule: null,
    multimodal: null,
    mmModule: null
  };
}
function xr(e) {
  return {
    engine: e.engine,
    transformersGenerator: e.transformersGenerator,
    transformersTokenizer: e.transformersTokenizer,
    transformersModule: e.transformersModule,
    backend: e.backend,
    modelId: e.modelId
  };
}
async function Mr(e) {
  if (e)
    try {
      if (typeof e.dispose == "function") {
        await e.dispose();
        return;
      }
      e.model && typeof e.model.dispose == "function" && await e.model.dispose();
    } catch {
    }
}
function _r(e) {
  return e == null || !Number.isFinite(e) || e <= 0 || e === vt ? null : Ue(e, 512, 32768);
}
function le(e) {
  const t = /* @__PURE__ */ new Set([e.id, $e(e)]);
  for (const r of [e.officialRepo, e.artifactRepo].filter(Boolean))
    try {
      t.add(new URL(r).pathname.replace(/^\//, ""));
    } catch {
    }
  return {
    modelId: e.id,
    repoLabels: Array.from(t),
    artifactUrls: [e.officialRepo, e.artifactRepo, e.id].filter(Boolean)
  };
}
const Rr = "local-llm-agent", Tr = 1, G = "messages", q = "memories", Sr = 40;
function Nr() {
  return new Promise((e, t) => {
    const r = indexedDB.open(Rr, Tr);
    r.onupgradeneeded = () => {
      const o = r.result;
      o.objectStoreNames.contains(G) || o.createObjectStore(G, { keyPath: "id", autoIncrement: !0 }).createIndex("timestamp", "timestamp"), o.objectStoreNames.contains(q) || o.createObjectStore(q, { keyPath: "key" });
    }, r.onsuccess = () => e(r.result), r.onerror = () => t(r.error);
  });
}
function E(e, t, r, o) {
  return new Promise((n, s) => {
    const a = e.transaction(t, r).objectStore(t), i = o(a);
    i.onsuccess = () => n(i.result), i.onerror = () => s(i.error);
  });
}
const Br = {
  async init() {
    this._db = await Nr();
  },
  async getAll(e) {
    return E(this._db, e, "readonly", (t) => t.getAll());
  },
  async add(e, t) {
    return E(this._db, e, "readwrite", (r) => r.add(t));
  },
  async put(e, t) {
    return E(this._db, e, "readwrite", (r) => r.put(t));
  },
  async delete(e, t) {
    return E(this._db, e, "readwrite", (r) => r.delete(t));
  },
  async clear(e) {
    return E(this._db, e, "readwrite", (t) => t.clear());
  }
};
class ue {
  constructor(t = null) {
    this.adapter = t ?? Br;
  }
  async init() {
    await this.adapter.init();
  }
  // --- 对话历史 ---
  /** 全部历史消息（按时间升序） */
  async getHistory() {
    return (await this.adapter.getAll(G)).sort((r, o) => r.timestamp - o.timestamp);
  }
  /** 最近 n 条消息（按时间升序返回） */
  async getRecent(t = Sr) {
    return (await this.getHistory()).slice(-t);
  }
  async addMessage(t, r) {
    const o = { role: t, content: r, timestamp: Date.now() };
    return this.adapter.add(G, o);
  }
  async clearHistory() {
    return this.adapter.clear(G);
  }
  /** 最近一条用户消息（"记住上一轮对话"的校验点） */
  async lastUserMessage() {
    const t = await this.getHistory();
    for (let r = t.length - 1; r >= 0; r--)
      if (t[r].role === "user") return t[r];
    return null;
  }
  // --- 长期记忆 ---
  async saveMemory(t, r) {
    return this.adapter.put(q, { key: t, value: r, timestamp: Date.now() });
  }
  async getMemories() {
    return this.adapter.getAll(q);
  }
  async deleteMemory(t) {
    return this.adapter.delete(q, t);
  }
  async clearMemories() {
    return this.adapter.clear(q);
  }
  /** 简单关键词检索：返回与 query 相关的记忆条目 */
  async recall(t) {
    const r = await this.getMemories(), o = String(t ?? "").toLowerCase().trim();
    if (!o) return r;
    const n = o.split(/[\s,，。；;]+/).filter(Boolean);
    return r.filter((s) => {
      const a = `${s.key} ${s.value}`.toLowerCase();
      return n.some((i) => a.includes(i));
    });
  }
}
const vr = [
  { id: "Qwen3.5-0.8B-q4f16_1-MLC", label: "Qwen3.5 0.8B（官方推荐，~447MB 下载 / 1.6GB 显存）" },
  { id: "gemma3-1b-it-q4f16_1-MLC", label: "Gemma 3 1B（真 1B 参数，~711MB 显存，更低门槛）" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B（Meta 1B 指令模型）" },
  { id: "OLMo-2-0425-1B-Instruct-q4f16_1-MLC", label: "OLMo 2 1B（AI2 开放模型）" },
  { id: "onnx-community/granite-4.0-1b-ONNX-web", label: "Granite 4.0 1B ONNX（Transformers.js 后端）" }
], xe = "Qwen3.5-0.8B-q4f16_1-MLC";
function Jr() {
  return vr;
}
function Lr() {
  return xe;
}
function qr({ browserAI: e, onEvent: t = () => {
} }) {
  let r = null, o = !1, n = 0;
  const s = [
    e.on("loadprogress", ({ progress: m, status: y, file: h, modelId: p }) => {
      typeof m == "number" && Number.isFinite(m) ? (n = Math.max(0, Math.min(1, m)), t({ type: "progress", progress: n, status: y, file: h, modelId: p })) : t({ type: "progress", progress: n, status: y, file: h, modelId: p });
    }),
    e.on("status", ({ message: m }) => {
      t({ type: "status", message: m }), console.log(`[model-loader] ${m}`);
    }),
    e.on("modelloaded", ({ model: m }) => {
      r = m.modelId, o = !1, console.log(`✅ 模型已就绪: ${m.modelId}`), t({ type: "ready", modelId: m.modelId });
    }),
    e.on("modelunloaded", ({ modelId: m }) => {
      r === m && (r = null), console.log(`[model-loader] 已卸载: ${m}`);
    })
  ];
  async function a() {
    const m = await e.probeHardware();
    if (t({ type: "hardware", snapshot: m }), !m.webgpuSupported)
      throw new Error(
        `当前浏览器不支持 WebGPU（${m.webgpuReason ?? "未知原因"}）。请使用最新版 Chrome / Edge 并开启硬件加速。`
      );
    return m;
  }
  async function i(m = xe) {
    if (o) throw new Error("已有加载任务正在进行");
    o = !0, n = 0, t({ type: "progress", progress: 0, status: "准备加载…", modelId: m }), console.log(`[model-loader] 开始加载模型: ${m}`);
    try {
      return await a(), t({ type: "status", message: `开始下载并加载 ${m}（首次加载需下载，之后走浏览器缓存）…` }), await e.load(m, {
        onProgress: ({ progress: y, status: h, file: p }) => {
          typeof y == "number" && (n = Math.max(0, Math.min(1, y))), t({ type: "progress", progress: n, status: h, file: p, modelId: m });
        }
      }), e.textModel();
    } catch (y) {
      throw o = !1, console.error("[model-loader] 加载失败:", y), t({ type: "error", error: y }), y;
    }
  }
  async function c() {
    e.loadedModels.length > 0 && await e.unloadAll();
  }
  function l() {
    return o;
  }
  function u() {
    return r;
  }
  function d() {
    s.forEach((m) => m());
  }
  return { load: i, unload: c, isBusy: l, getLoadedModelId: u, checkHardware: a, dispose: d };
}
class k extends Error {
}
const Or = 20, Pr = 32;
function Cr(e) {
  const t = [];
  let r = 0;
  for (; r < e.length; ) {
    const o = e[r];
    if (/\s/.test(o)) {
      r++;
      continue;
    }
    if (/[0-9.]/.test(o)) {
      let n = r, s = 0;
      for (; n < e.length && /[0-9.]/.test(e[n]); ) {
        if (e[n] === "." && s++, s > 1) throw new k(`数字格式错误: "${e.slice(r, n + 1)}"`);
        n++;
      }
      if (n - r > Or) throw new k("数字过长");
      const a = e.slice(r, n);
      a === "." || a.endsWith(".") || a.startsWith("."), t.push({ type: "num", value: Number(a) }), r = n;
      continue;
    }
    if ("+-*/()".includes(o)) {
      t.push({ type: o, value: o }), r++;
      continue;
    }
    if (o === "*" && e[r + 1] === "*") {
      t.push({ type: "**", value: "**" }), r += 2;
      continue;
    }
    throw new k(`不支持的字符: "${o}"`);
  }
  return t;
}
class Ir {
  constructor(t) {
    this.tokens = t, this.pos = 0;
  }
  peek() {
    return this.tokens[this.pos];
  }
  next() {
    return this.tokens[this.pos++];
  }
  expect(t) {
    const r = this.next();
    if (!r || r.type !== t) throw new k(`期望 "${t}"，实际 ${r ? r.value : "表达式结束"}`);
    return r;
  }
  parseExpression() {
    return this.parseAdditive();
  }
  parseAdditive() {
    let t = this.parseMultiplicative();
    for (; this.peek() && (this.peek().type === "+" || this.peek().type === "-"); ) {
      const r = this.next().type, o = this.parseMultiplicative();
      t = r === "+" ? t + o : t - o;
    }
    return t;
  }
  parseMultiplicative() {
    let t = this.parsePower();
    for (; this.peek() && (this.peek().type === "*" || this.peek().type === "/"); ) {
      const r = this.next().type, o = this.parsePower();
      if (r === "/" && o === 0) throw new k("除数不能为 0");
      t = r === "*" ? t * o : t / o;
    }
    return t;
  }
  parsePower() {
    const t = this.parseUnary();
    if (this.peek() && this.peek().type === "**") {
      this.next();
      const r = this.parsePower(), o = Math.pow(t, r);
      if (!Number.isFinite(o)) throw new k("结果超出可表示范围");
      return o;
    }
    return t;
  }
  parseUnary() {
    if (this.peek() && (this.peek().type === "+" || this.peek().type === "-")) {
      const t = this.next().type, r = this.parseUnary();
      return t === "-" ? -r : r;
    }
    return this.parsePrimary();
  }
  parsePrimary() {
    let t = 0;
    const r = this.peek();
    if (!r) throw new k("表达式不完整");
    if (r.type === "num")
      return this.next(), r.value;
    if (r.type === "(") {
      let o = this.pos;
      for (; o < this.tokens.length && (this.tokens[o].type === "(" && t++, this.tokens[o].type === ")" && t--, t !== 0); )
        o++;
      if (t !== 0) throw new k("括号不匹配");
      if (o - this.pos > Pr) throw new k("括号嵌套过深");
      this.next();
      const n = this.parseAdditive();
      return this.expect(")"), n;
    }
    throw new k(`意外的符号: "${r.value}"`);
  }
}
function Ar(e) {
  if (typeof e != "string" || e.trim().length === 0)
    throw new k("表达式为空");
  if (e.length > 200) throw new k("表达式过长");
  const t = Cr(e);
  if (t.length === 0) throw new k("表达式为空");
  const r = new Ir(t), o = r.parseExpression();
  if (r.peek()) throw new k(`表达式末尾有多余内容: "${r.peek().value}"`);
  if (!Number.isFinite(o)) throw new k("结果不是有效数字");
  return Math.round(o * 1e10) / 1e10;
}
async function Me(e, t = 8e3) {
  const r = new AbortController(), o = setTimeout(() => r.abort(), t);
  try {
    const n = await fetch(e, { signal: r.signal, headers: { accept: "application/json" } });
    if (!n.ok) throw new Error(`HTTP ${n.status}`);
    return await n.json();
  } finally {
    clearTimeout(o);
  }
}
async function Er(e) {
  const t = await Me(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(e)}&format=json&no_html=1&skip_disambig=1`
  ), r = [];
  t.AbstractText && r.push(`摘要: ${t.AbstractText}`), t.Answer && r.push(`答案: ${t.Answer}`);
  for (const o of t.RelatedTopics ?? [])
    if (o.Text && r.push(`- ${o.Text}`), r.length >= 5) break;
  return r;
}
async function Dr(e) {
  return ((await Me(
    `https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(
      e
    )}&srlimit=3&utf8=1`
  )).query?.search ?? []).map((o, n) => `${n + 1}. ${o.title}：${o.snippet?.replace(/<[^>]+>/g, "") ?? ""}`);
}
async function Gr(e) {
  const t = [], r = [
    ["DuckDuckGo", Er],
    ["维基百科", Dr]
  ];
  for (const [o, n] of r)
    try {
      const s = await n(e);
      if (s && s.length > 0)
        return `搜索"${e}"结果（来源 ${o}）：
${s.join(`
`)}`;
      t.push(`${o} 无结果`);
    } catch (s) {
      t.push(`${o} 失败: ${s.message}`);
    }
  return `搜索"${e}"未能获取结果。${t.join("；")}`;
}
const U = {
  get_current_time: {
    description: "获取当前日期和时间（本地时区）。无需参数。",
    parameters: {},
    requiresContext: !1
  },
  calculate: {
    description: "执行数学计算。支持 + - * / 和括号，例如 12+34、45*67。传入 expression 参数。",
    parameters: { expression: '要计算的数学表达式字符串，如 "12+34"' },
    requiresContext: !1
  },
  web_search: {
    description: "在网络上搜索信息。传入 query 参数。",
    parameters: { query: "搜索关键词" },
    requiresContext: !1
  },
  save_memory: {
    description: "记住用户告知的重要事实（如名字、偏好）。传入 key 和 value 参数。",
    parameters: { key: "记忆键名（如 name、preference）", value: "记忆内容（如 小明、喜欢咖啡）" },
    requiresContext: !1
  },
  recall_memory: {
    description: "回忆此前记住的事实。传入 query 参数，例如用户名字。",
    parameters: { query: "要回忆的关键词" },
    requiresContext: !1
  }
}, Z = Object.keys(U);
function $r() {
  return Z.map(
    (e) => `- ${e}: ${U[e].description}` + (Object.keys(U[e].parameters).length ? ` 参数: ${Object.entries(U[e].parameters).map(([t, r]) => `"${t}": ${r}`).join(", ")}` : "")
  ).join(`
`);
}
async function jr(e, t, r = {}) {
  const o = (s) => t && typeof t == "object" ? t[s] : void 0, n = (typeof t == "string" ? t : o("input")) ?? void 0;
  switch (e) {
    case "get_current_time": {
      const s = /* @__PURE__ */ new Date(), a = ["日", "一", "二", "三", "四", "五", "六"], i = (c) => String(c).padStart(2, "0");
      return `当前时间：${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 星期${a[s.getDay()]} ${i(s.getHours())}:${i(s.getMinutes())}:${i(s.getSeconds())} （时区 ${Intl.DateTimeFormat().resolvedOptions().timeZone}）`;
    }
    case "calculate": {
      const s = o("expression") ?? n;
      if (typeof s != "string" || !s.trim())
        return '计算失败：缺少 expression 参数，例如 {"expression": "12+34"}';
      try {
        const a = Ar(s);
        return `${s} = ${a}`;
      } catch (a) {
        return `计算失败：${a.message}`;
      }
    }
    case "web_search": {
      const s = o("query") ?? n;
      return s ? Gr(String(s)) : "搜索失败：缺少 query 参数";
    }
    case "save_memory": {
      const s = o("key") ?? t?.key, a = o("value") ?? t?.value;
      return !s || a === void 0 ? "记忆失败：需要 key 和 value 参数" : r.memory ? (await r.memory.saveMemory(String(s), String(a)), `已记住：${s} = ${a}`) : "记忆失败：记忆系统不可用";
    }
    case "recall_memory": {
      const s = o("query") ?? n;
      if (!r.memory) return "记忆失败：记忆系统不可用";
      const a = await r.memory.recall(s);
      return a.length === 0 ? "没有找到相关记忆" : a.map((i) => `${i.key} = ${i.value}`).join(`
`);
    }
    default:
      return `未知工具：${e}`;
  }
}
const Xr = 5, Ur = 8;
function Wr({ toolsDescription: e, memoryContext: t = "" } = {}) {
  const r = t ? `
你记得以下事实（来自长期记忆）：
${t}
` : "";
  return `你是运行在浏览器本地的智能助手，通过"思考-行动-观察"循环使用工具完成任务。

你必须严格按以下格式输出，每次只输出一步，不要多余内容：

Thought: 你对当前情况的简短思考
Action: 工具名
Action Input: {"参数名": "参数值"}

工具执行结果会以 "Observation: 结果" 的形式提供给你。拿到结果后，要么继续输出
Thought/Action 调用下一个工具，要么直接给出最终答复：

Final: 你的最终答复（面向用户的完整中文回答）

可用工具：
${e}
${r}
输出示例（用户问"现在几点"）：
Thought: 用户想知道当前时间，我需要调用时间工具。
Action: get_current_time
Action Input: {}
Final: 现在是 15 点 30 分。`;
}
function ee(e) {
  return e.replace(/：/g, ":").replace(/，/g, ",").replace(/（/g, "(").replace(/）/g, ")");
}
function Fr(e) {
  const r = [...ee(e).matchAll(/Final\s*:\s*([\s\S]*?)(?=\n\s*(?:Thought|Action|Final)\s*:|\s*$)/gi)];
  return r.length === 0 ? null : r[r.length - 1][1].trim().replace(/\s+$/g, "").trim();
}
function Hr(e) {
  const t = ee(e), r = t.match(/Action\s*:\s*([\w.-]+)[\s\S]*?Action\s+Input\s*:/i);
  if (r) return r[1].trim();
  const o = t.match(/^[ \t]*Action[ \t]*:[ \t]*([\w.-]+)[ \t]*$/gim);
  return o ? o[o.length - 1].match(/:[\s]*([\w.-]+)/)[1].trim() : null;
}
function Vr(e) {
  const t = ee(e), r = t.search(/Action\s+Input\s*:/i);
  if (r === -1) return null;
  let o = t.slice(r).replace(/^Action\s+Input\s*:\s*/i, "");
  if (o = o.replace(/\n\s*(?:Thought|Observation|Final)\s*:/i, "").trim(), o.startsWith("{")) {
    let s = 0;
    for (let a = 0; a < o.length; a++)
      if (o[a] === "{") s++;
      else if (o[a] === "}" && (s--, s === 0))
        return o.slice(0, a + 1);
    return o;
  }
  const n = o.match(/^\(([\s\S]*)\)\s*$/);
  if (n) {
    const s = n[1].trim();
    return s.startsWith("{") || s.includes(":") ? s.startsWith("{") ? s : `{${s}}` : s;
  }
  return o || null;
}
function zr(e) {
  if (!e || typeof e != "string") return { type: "unknown", text: String(e ?? "") };
  const t = Fr(e), r = e.match(/```json\s*([\s\S]*?)```|(\{[^{}]*"(?:action|name|tool)"[^{}]*\})/i);
  if (r) {
    const n = (r[1] ?? r[2]).trim();
    try {
      const s = JSON.parse(n), a = s.action ?? s.name ?? s.tool;
      if (a && Z.includes(String(a)))
        return { type: "action", name: String(a), input: s.action_input ?? s.input ?? s.arguments ?? s.parameters ?? {} };
    } catch {
    }
  }
  const o = Hr(e);
  if (o) {
    const n = o.trim();
    if (Z.includes(n)) {
      let s = null;
      try {
        const a = Vr(e);
        a && (a.trim().startsWith("{") ? s = JSON.parse(a.trim()) : s = { input: a.trim() });
      } catch {
        s = null;
      }
      return s !== null ? { type: "action", name: n, input: s } : n === "get_current_time" ? { type: "action", name: n, input: {} } : { type: "unknown", text: t ?? e };
    }
    return { type: "unknown", text: t ?? e };
  }
  return t ? { type: "final", text: t } : { type: "unknown", text: e.trim() };
}
async function Qr({ userInput: e, memory: t, generate: r, onStep: o = () => {
}, maxSteps: n = Xr }) {
  const s = [], a = [], i = (h) => {
    s.push(h), o(h);
  };
  let c = "";
  try {
    const h = await t.recall("");
    h && h.length > 0 && (c = h.map((p) => `- ${p.key}: ${p.value}`).join(`
`));
  } catch {
  }
  const l = Wr({ toolsDescription: $r(), memoryContext: c });
  let u = [];
  try {
    u = await t.getRecent(Ur);
  } catch {
    u = [];
  }
  const d = [
    { role: "system", content: l },
    ...u.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: e }
  ];
  let m = null, y = 0;
  for (let h = 0; h < n; h++) {
    let p;
    try {
      p = (await r(d, {
        onDelta: (x) => i({ type: "stream", text: x })
      })).text ?? "";
    } catch (b) {
      return i({ type: "error", message: `模型生成失败: ${b?.message ?? b}` }), { answer: `抱歉，模型生成时出错：${b?.message ?? b}`, rawTexts: a, steps: s };
    }
    a.push(p);
    const g = zr(p);
    if (i({ type: "raw", text: p }), g.type === "action") {
      const b = `${g.name}:${JSON.stringify(g.input)}`;
      if (b === m ? y++ : y = 0, m = b, y >= 2)
        return i({ type: "action", name: g.name, input: g.input }), { answer: `我在尝试"${g.name}"时陷入了循环，无法完成任务。请换一种说法试试。`, rawTexts: a, steps: s };
      i({ type: "action", name: g.name, input: g.input });
      let x;
      try {
        x = await jr(g.name, g.input, { memory: t }), i({ type: "observation", name: g.name, result: x });
      } catch (R) {
        x = `工具执行出错: ${R?.message ?? R}`, i({ type: "observation", name: g.name, result: x, error: !0 });
      }
      d.push({ role: "assistant", content: p }), d.push({ role: "user", content: `Observation: ${x}` });
      continue;
    }
    const _ = g.type === "final" ? g.text : p.trim();
    return i({ type: "final", text: _ }), { answer: _, rawTexts: a, steps: s };
  }
  return i({ type: "error", message: `超过最大步数（${n}），终止循环` }), { answer: "我尝试了多次但未能完成这个请求，请简化一下问题或换种说法。", rawTexts: a, steps: s };
}
const Kr = ["localhost", "127.0.0.1", "::1"];
function Yr(e = {}) {
  const {
    modelId: t = Lr(),
    modelSource: r = "proxy",
    proxyOrigin: o,
    verifyProxy: n,
    maxSteps: s = 5,
    memoryAdapter: a = null,
    onEvent: i,
    onProgress: c,
    onStatus: l,
    onReady: u,
    onError: d
  } = e, m = (w) => {
    switch (i?.(w), w.type) {
      case "progress":
        c?.({ progress: w.progress, status: w.status, file: w.file, modelId: w.modelId });
        break;
      case "status":
        l?.(w.message);
        break;
      case "ready":
        u?.({ modelId: w.modelId });
        break;
      case "error":
        d?.(w.error);
        break;
    }
  }, y = typeof location < "u" && Kr.includes(location.hostname), h = new kr({
    modelSource: r,
    proxyOrigin: o,
    verifyProxy: n ?? (r === "proxy" ? y : !0),
    cacheBackend: "indexeddb",
    webllm: { logLevel: "INFO" }
  }), p = a ? new ue(a) : new ue(), g = qr({ browserAI: h, onEvent: m });
  let _ = !1, b = null, x = !1;
  async function R() {
    if (!_)
      return b || (b = (async () => {
        await p.init(), _ = !0;
        try {
          const w = await h.probeHardware();
          if (m({ type: "hardware", snapshot: w }), !w.webgpuSupported) {
            const C = new Error(
              `当前浏览器不支持 WebGPU（${w.webgpuReason ?? "未知原因"}），无法运行本地模型。`
            );
            m({ type: "error", error: C });
          }
        } catch (w) {
          console.warn("[embed] WebGPU 预检失败:", w);
        }
        console.log("[embed] 本地智能体已初始化 ✅");
      })(), b);
  }
  async function v(w) {
    return await R(), g.load(w ?? t);
  }
  function H() {
    return !!g.getLoadedModelId();
  }
  function te() {
    return g.getLoadedModelId();
  }
  async function _e(w, { onStep: C, onDelta: Oe } = {}) {
    if (typeof w != "string" || !w.trim()) throw new Error("chat: 输入不能为空");
    if (x) throw new Error("chat: 已有对话正在进行");
    if (!g.getLoadedModelId())
      throw new Error("模型尚未加载，请先调用 load()");
    x = !0;
    try {
      await p.addMessage("user", w);
      const re = await Qr({
        userInput: w,
        memory: p,
        maxSteps: s,
        generate: async (Pe, Ce) => h.generateText(Pe, {
          runtime: { maxTokens: 768 },
          onDelta: Ce.onDelta ?? Oe
        }),
        onStep: C
      });
      return await p.addMessage("assistant", re.answer), re;
    } finally {
      x = !1;
    }
  }
  const Re = () => p.getHistory(), Te = () => p.clearHistory(), Se = () => p.getMemories(), Ne = (w, C) => p.saveMemory(w, C), Be = (w) => p.recall(w), ve = () => p.clearMemories();
  async function Le() {
    await g.unload();
  }
  async function qe() {
    await g.unload(), g.dispose();
  }
  return {
    ready: R,
    load: v,
    unload: Le,
    dispose: qe,
    chat: _e,
    isModelLoaded: H,
    getLoadedModelId: te,
    getHistory: Re,
    clearHistory: Te,
    getMemories: Se,
    saveMemory: Ne,
    recallMemory: Be,
    clearMemories: ve,
    // 高级用法：暴露底层实例
    _ai: h,
    _memory: p
  };
}
export {
  kr as BrowserAI,
  Yr as createLocalAgent,
  Lr as getDefaultModelId,
  Jr as getModelOptions,
  Ar as safeEvaluate
};
