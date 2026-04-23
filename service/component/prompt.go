package component

import (
	"regexp"
	"strings"
)

const (
	AIDrawPromptPrefix = "请根据以下要求生成高质量图片，以用户上传的参考图为准，保持核心结构与空间逻辑不变，提升画面表达质量。"
)

// 支持的纵横比（来自 ai绘图api.md）
var supportedAspectRatios = map[string]bool{
	"1:1":  true,
	"16:9": true,
	"9:16": true,
	"4:3":  true,
	"3:4":  true,
	"21:9": true,
	"3:2":  true,
	"2:3":  true,
	"5:4":  true,
	"4:5":  true,
}

// BuildAIDrawPrompt 若 prompt 未带前缀或后缀，则补全：前缀「请帮我生成图片，」+ 后缀「画面风格、清晰度、画布大小」
// payload 可含 prompt, style, quality, canvas
func BuildAIDrawPrompt(payload map[string]interface{}) string {
	prompt, _ := payload["prompt"].(string)
	sceneDirection, _ := payload["scene_direction"].(string)
	style, _ := payload["style"].(string)
	quality, _ := payload["quality"].(string)
	qualityLabel := quality
	switch quality {
	case "standard":
		qualityLabel = "标准"
	case "hd":
		qualityLabel = "高清"
	case "uhd":
		qualityLabel = "超高清"
	default:
		if qualityLabel == "" {
			qualityLabel = "高清"
		}
	}
	canvas, _ := payload["canvas"].(string)
	if canvas == "" {
		canvas = "16:9"
	}
	prompt = StripUserPromptFromAIDraw(prompt)
	if prompt == "" {
		prompt = "生成一张设计图"
	}
	suffixParts := make([]string, 0, 4)
	if strings.TrimSpace(sceneDirection) != "" {
		suffixParts = append(suffixParts, "生成方向："+strings.TrimSpace(sceneDirection))
	}
	if strings.TrimSpace(style) != "" {
		suffixParts = append(suffixParts, "画面风格："+style)
	}
	suffixParts = append(suffixParts, "画面清晰度："+qualityLabel, "画布大小："+canvas)
	suffix := ""
	if len(suffixParts) > 0 {
		suffix = "，" + strings.Join(suffixParts, "，")
	}
	return AIDrawPromptPrefix + prompt + suffix
}

// GetAspectRatioFromPayload 从 payload 中提取并规范化纵横比
// 优先使用 aspect_ratio，其次使用 canvas；若不在支持列表内则回退到 16:9
func GetAspectRatioFromPayload(payload map[string]interface{}) string {
	getStr := func(key string) string {
		if v, ok := payload[key]; ok {
			if s, ok2 := v.(string); ok2 {
				return strings.TrimSpace(s)
			}
		}
		return ""
	}

	ratio := getStr("aspect_ratio")
	if ratio == "" {
		ratio = getStr("canvas")
	}
	if supportedAspectRatios[ratio] {
		return ratio
	}
	// 默认使用 16:9
	return "16:9"
}

// GetImageSizeFromPayload 从 payload 中提取清晰度/分辨率
// 优先使用 image_size 或 resolution，其次根据 quality 映射到 1K/2K/4K
func GetImageSizeFromPayload(payload map[string]interface{}) string {
	getStr := func(key string) string {
		if v, ok := payload[key]; ok {
			if s, ok2 := v.(string); ok2 {
				return strings.TrimSpace(s)
			}
		}
		return ""
	}

	if v := getStr("image_size"); v != "" {
		return v
	}
	if v := getStr("resolution"); v != "" {
		return v
	}

	quality := getStr("quality")
	switch quality {
	case "standard":
		return "1K"
	case "hd":
		return "2K"
	case "uhd":
		return "4K"
	default:
		if quality != "" {
			// 如果前端直接传了 1K/2K/4K 之类的值，也允许透传
			return quality
		}
	}

	// 默认使用 2K
	return "2K"
}

var seedreamPixelSizeMap = map[string]map[string]string{
	"1K": {
		"1:1":  "1024x1024",
		"3:4":  "864x1152",
		"4:3":  "1152x864",
		"16:9": "1312x736",
		"9:16": "736x1312",
		"2:3":  "832x1248",
		"3:2":  "1248x832",
		"21:9": "1568x672",
	},
	"2K": {
		"1:1":  "2048x2048",
		"3:4":  "1728x2304",
		"4:3":  "2304x1728",
		"16:9": "2848x1600",
		"9:16": "1600x2848",
		"2:3":  "1664x2496",
		"3:2":  "2496x1664",
		"21:9": "3136x1344",
	},
	"4K": {
		"1:1":  "4096x4096",
		"3:4":  "3520x4704",
		"4:3":  "4704x3520",
		"16:9": "5504x3040",
		"9:16": "3040x5504",
		"2:3":  "3328x4992",
		"3:2":  "4992x3328",
		"21:9": "6240x2656",
	},
}

func GetSeedreamImageSizeFromPayload(payload map[string]interface{}) string {
	imageSize := strings.ToUpper(GetImageSizeFromPayload(payload))
	if _, ok := seedreamPixelSizeMap[imageSize]; !ok {
		return imageSize
	}

	aspectRatio := GetAspectRatioFromPayload(payload)
	if size, ok := seedreamPixelSizeMap[imageSize][aspectRatio]; ok {
		return size
	}

	return imageSize
}

// StripUserPromptFromAIDraw 从完整 prompt 中去掉前缀和后缀，只保留用户输入部分
func StripUserPromptFromAIDraw(fullPrompt string) string {
	s := fullPrompt
	if strings.HasPrefix(s, AIDrawPromptPrefix) {
		s = s[len(AIDrawPromptPrefix):]
	}
	re := regexp.MustCompile(`，(?:生成方向：[^，]+，)?(?:画面风格：[^，]+，)?画面清晰度：[^，]+，画布大小：[^，]*$`)
	s = re.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}
