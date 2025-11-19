# Backup Service Evaluation: google/nano-banana vs stability-ai/stable-diffusion-3.5-large

## Selected Backup Service

**Primary:** stability-ai/stable-diffusion-3.5-large  
**Backup:** google/nano-banana

## API Comparison

### Primary Service: stability-ai/stable-diffusion-3.5-large

```json
{
  "model": "stability-ai/stable-diffusion-3.5-large",
  "input": {
    "prompt": "required string",
    "cfg": "number (default: 5)",
    "aspect_ratio": "string (default: 1:1)",
    "output_format": "string (default: webp)",
    "seed": "optional number",
    "negative_prompt": "optional string"
  },
  "output": {
    "type": "image_url",
    "format": ["webp", "jpg", "png"],
    "quality": "0-100"
  },
  "pricing": "$0.065 per image",
  "hardware": "H100",
  "timeout_recommended": "60s"
}
```

### Backup Service: google/nano-banana

```json
{
  "model": "google/nano-banana",
  "input": {
    "prompt": "required string",
    "image_input": "optional array of images",
    "aspect_ratio": "string options: 1:1, 16:9, etc",
    "output_format": "string (default: jpg)"
  },
  "output": {
    "type": "image_url",
    "format": ["jpg", "png"],
    "watermark": "SynthID invisible watermark"
  },
  "pricing": "$0.039 per image",
  "hardware": "CPU",
  "timeout_recommended": "45s"
}
```

## Integration Strategy

### Failover Logic

1. Primary API call to stability-ai/stable-diffusion-3.5-large
2. If primary fails → fallback to google/nano-banana
3. Adapt prompt format for nano-banana (simpler, no negative prompts)

### Cost Analysis

- Primary: $0.065/image (67% more expensive)
- Backup: $0.039/image (40% less expensive)
- Estimated savings on failover: ~$0.026 per failed generation

### Technical Considerations

- **Timeout Strategy:** 60s primary → 45s backup
- **Format Mapping:** webp (primary) → jpg (backup)
- **Prompt Adaptation:** Remove negative_prompt for nano-banana
- **Hardware:** H100 (primary) vs CPU (backup) - expect quality differences

## Test Requirements Completed ✅

- [x] API endpoint accessibility verified
- [x] Request/response format documented
- [x] Pricing comparison completed
- [x] Integration strategy defined
- [x] Timeout recommendations established
