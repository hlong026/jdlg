package component

import "testing"

func TestToAPIsFallbackConfigsStayInToAPIs(t *testing.T) {
	primary := &AIAPIConfigData{
		TaskType:       "ai_draw",
		ProviderCode:   "toapis",
		ProviderName:   "ToAPIs",
		ProtocolType:   "toapis_async",
		APIEndpoint:    "https://toapis.com/v1/images/generations",
		Method:         "POST",
		APIKey:         "test-key",
		APIKeyLocation: "header_bearer",
		APIKeyName:     "Authorization",
		Headers:        `{"Content-Type":"application/json"}`,
		BodyTemplate:   `{"model":"gemini-3-pro-image-preview","prompt":"{{prompt}}","size":"{{aspect_ratio}}","n":1,"metadata":{"resolution":"{{image_size}}"}}`,
	}

	fallbacks := (&AITaskProcessor{}).getFallbackAIConfigs("ai_draw", true, primary)
	if len(fallbacks) != 2 {
		t.Fatalf("fallback count = %d, want 2", len(fallbacks))
	}

	wantModels := []string{"gemini-3.1-flash-image-preview", "gpt-image-2"}
	for i, fallback := range fallbacks {
		if fallback.ProviderCode != "toapis" {
			t.Fatalf("fallback[%d].ProviderCode = %q, want toapis", i, fallback.ProviderCode)
		}
		if fallback.ProtocolType != "toapis_async" {
			t.Fatalf("fallback[%d].ProtocolType = %q, want toapis_async", i, fallback.ProtocolType)
		}
		if fallback.APIEndpoint != primary.APIEndpoint {
			t.Fatalf("fallback[%d].APIEndpoint = %q, want primary endpoint", i, fallback.APIEndpoint)
		}
		if fallback.APIKey != primary.APIKey {
			t.Fatalf("fallback[%d].APIKey was not copied", i)
		}
		if got := resolveConfiguredModel(fallback); got != wantModels[i] {
			t.Fatalf("fallback[%d] model = %q, want %q", i, got, wantModels[i])
		}
	}
}

func TestBuildToAPIsGeminiRequestBody(t *testing.T) {
	ctx := &AITaskContext{
		TaskType: "ai_draw",
		APIConfig: &AIAPIConfigData{
			ProviderCode: "toapis",
			ProtocolType: "toapis_async",
			APIEndpoint:  "https://toapis.com/v1/images/generations",
			BodyTemplate: getToAPIsGeminiFlashDrawBodyTemplate(),
		},
		Payload: map[string]interface{}{
			"aspect_ratio": "9:16",
			"image_size":   "4K",
		},
		Prompt:    "make a poster",
		ImageURLs: []string{"https://example.com/a.png", "https://example.com/b.jpg"},
	}

	body, err := (&RequestPool{}).buildRequestBody(ctx)
	if err != nil {
		t.Fatalf("buildRequestBody returned error: %v", err)
	}
	if body["size"] != "9:16" {
		t.Fatalf("size = %v, want 9:16", body["size"])
	}
	metadata, ok := body["metadata"].(map[string]interface{})
	if !ok {
		t.Fatalf("metadata missing or wrong type: %#v", body["metadata"])
	}
	if metadata["resolution"] != "4K" {
		t.Fatalf("metadata.resolution = %v, want 4K", metadata["resolution"])
	}
	imageURLs, ok := body["image_urls"].([]interface{})
	if !ok || len(imageURLs) != 2 {
		t.Fatalf("image_urls = %#v, want 2 object items", body["image_urls"])
	}
	if _, exists := body["reference_images"]; exists {
		t.Fatalf("reference_images should not be set for Gemini ToAPIs body")
	}
	if _, exists := body["image_size"]; exists {
		t.Fatalf("image_size should not be kept as a top-level ToAPIs field")
	}
}

func TestBuildToAPIsGPTImage2RequestBody(t *testing.T) {
	ctx := &AITaskContext{
		TaskType: "ai_draw",
		APIConfig: &AIAPIConfigData{
			ProviderCode: "toapis",
			ProtocolType: "toapis_async",
			APIEndpoint:  "https://toapis.com/v1/images/generations",
			BodyTemplate: getToAPIsGPTImage2DrawBodyTemplate(),
		},
		Payload: map[string]interface{}{
			"aspect_ratio": "1:1",
			"image_size":   "2K",
		},
		Prompt:    "make a clean product image",
		ImageURLs: []string{"https://example.com/ref.png"},
	}

	body, err := (&RequestPool{}).buildRequestBody(ctx)
	if err != nil {
		t.Fatalf("buildRequestBody returned error: %v", err)
	}
	if body["size"] != "1:1" {
		t.Fatalf("size = %v, want 1:1", body["size"])
	}
	if body["resolution"] != "2K" {
		t.Fatalf("resolution = %v, want 2K", body["resolution"])
	}
	referenceImages, ok := body["reference_images"].([]string)
	if !ok || len(referenceImages) != 1 || referenceImages[0] != "https://example.com/ref.png" {
		t.Fatalf("reference_images = %#v, want URL string array", body["reference_images"])
	}
	if _, exists := body["image_urls"]; exists {
		t.Fatalf("image_urls should not be set for GPT-Image-2 ToAPIs body")
	}
}
