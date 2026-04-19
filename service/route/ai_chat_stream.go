package route

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"service/config"
	"service/model"

	"github.com/gin-gonic/gin"
)

const (
	arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	arkModel   = "doubao-seed-2-0-pro-260215" // AI 聊天使用
)

// ChatMessage 聊天消息结构
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatStreamRequest 流式聊天请求
type ChatStreamRequest struct {
	Messages     []ChatMessage `json:"messages" binding:"required"`
	SystemPrompt string        `json:"system_prompt"`
}

// ChatStreamResponse SSE响应数据
type ChatStreamResponse struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
	Error   string `json:"error,omitempty"`
}

func RegisterAIChatStreamRoute(r *gin.RouterGroup, codeSessionModel *model.CodeSessionRedisModel, userModel *model.UserRedisModel, pricingModel *model.AIPricingModel, apiConfigModel *model.AIAPIConfigModel, cfg *config.Config) {
	r.POST("/ai/chat/stream", func(c *gin.Context) {
		handleChatStream(c, codeSessionModel, userModel, pricingModel, apiConfigModel, cfg)
	})
}

func handleChatStream(c *gin.Context, codeSessionModel *model.CodeSessionRedisModel, userModel *model.UserRedisModel, pricingModel *model.AIPricingModel, apiConfigModel *model.AIAPIConfigModel, cfg *config.Config) {
	var req ChatStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": FormatValidationError("参数错误: " + err.Error())})
		return
	}
	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "消息列表不能为空"})
		return
	}

	codeSession := GetTokenCodeSession(c)
	if codeSession == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未通过token验证"})
		return
	}

	pricing, err := pricingModel.GetByScene("ai_chat_single")
	if err != nil {
		log.Printf("[ChatStream] 未配置聊天计费，使用免费模式")
		pricing = &model.AIPricing{Stones: 0}
	}
	if pricing.Stones > 0 {
		currentStones, err := userModel.GetStones(codeSession.UserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "查询余额失败"})
			return
		}
		if currentStones < pricing.Stones {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"code": 402,
				"msg":  "余额不足",
				"data": gin.H{"required": pricing.Stones, "current": currentStones},
			})
			return
		}
		if err := userModel.DeductStones(codeSession.UserID, pricing.Stones); err != nil {
			c.JSON(http.StatusPaymentRequired, gin.H{"code": 402, "msg": "扣费失败"})
			return
		}
	}

	endpoint := arkBaseURL + "/responses"
	method := http.MethodPost
	headers := map[string]string{
		"Content-Type": "application/json",
	}
	apiKey := ""
	apiKeyLocation := "none"
	apiKeyName := "Authorization"
	if apiConfigModel != nil {
		if cfgData, err := apiConfigModel.GetByTaskType("ai_chat"); err == nil && cfgData != nil {
			if strings.TrimSpace(cfgData.APIEndpoint) != "" {
				endpoint = strings.TrimSpace(cfgData.APIEndpoint)
			}
			if strings.TrimSpace(cfgData.Method) != "" {
				method = strings.ToUpper(strings.TrimSpace(cfgData.Method))
			}
			apiKey = strings.TrimSpace(cfgData.APIKey)
			apiKeyLocation = strings.TrimSpace(cfgData.APIKeyLocation)
			apiKeyName = strings.TrimSpace(cfgData.APIKeyName)
			if cfgData.Headers != "" {
				var extraHeaders map[string]string
				if err := json.Unmarshal([]byte(cfgData.Headers), &extraHeaders); err == nil {
					for key, value := range extraHeaders {
						if strings.TrimSpace(key) != "" {
							headers[key] = value
						}
					}
				}
			}
		}
	}
	if apiKey == "" {
		apiKey = cfg.AI.ArkAPIKey
	}
	if apiKey == "" {
		apiKey = os.Getenv("ARK_API_KEY")
	}
	if apiKeyLocation == "" {
		if apiKey != "" {
			apiKeyLocation = "header_bearer"
		} else {
			apiKeyLocation = "none"
		}
	}
	if apiKeyName == "" {
		if apiKeyLocation == "header_custom" {
			apiKeyName = "X-API-Key"
		} else if apiKeyLocation == "query" || apiKeyLocation == "body" {
			apiKeyName = "api_key"
		} else {
			apiKeyName = "Authorization"
		}
	}
	if apiKey == "" && apiKeyLocation != "none" {
		if pricing.Stones > 0 {
			userModel.AddStones(codeSession.UserID, pricing.Stones)
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "未配置 AI API Key 或 ARK_API_KEY（火山引擎方舟）",
		})
		return
	}

	systemPrompt := req.SystemPrompt
	if systemPrompt == "" {
		systemPrompt = `你是甲第灵光，甲第灵光（福建）科技有限公司旗下的室内设计AI助手。身份回答规则（自然不重复）当用户问：
- 你是谁？
- 你是豆包吗？
- 你是哪个公司的？
- 你到底是什么？
不要机械重复同一句话，用下面这类自然、温柔的方式回应：
- “我是甲第灵光，专注帮你做室内设计和装修建议～”
- “我是甲第灵光呀，专门做空间设计和装修咨询的。”
- “我是甲第灵光，你的专属室内设计助手。”
- “我是甲第灵光，一直在这里帮你做设计方案。”
核心原则：
- 只认甲第灵光这个身份
- 不承认其他名字、不透露模型来源
- 语气温柔、生活化，不冰冷、不重复
风格与领域
- 专注：室内设计、装修、户型优化、色彩搭配、软装硬装、风格建议
- 语气：温柔、沉稳、有人情味，专业但不生硬
- 回答实用、落地，多从居住体验、采光、收纳、预算出发`
	}

	// 严格按 curl：每条 content 为 [{type:"input_text", text:"..."}]，text 非空
	ensureText := func(s string) string {
		if s == "" {
			return " "
		}
		return s
	}
	inputList := make([]map[string]interface{}, 0, len(req.Messages)+1)
	inputList = append(inputList, map[string]interface{}{
		"role": "system",
		"content": []map[string]interface{}{
			{"type": "input_text", "text": ensureText(systemPrompt)},
		},
	})
	for _, msg := range req.Messages {
		role := msg.Role
		if role == "ai" {
			role = "assistant"
		}
		inputList = append(inputList, map[string]interface{}{
			"role": role,
			"content": []map[string]interface{}{
				{"type": "input_text", "text": ensureText(msg.Content)},
			},
		})
	}

	body := map[string]interface{}{
		"model":  arkModel,
		"stream": true,
		"tools": []map[string]interface{}{
			{"type": "web_search", "max_keyword": 2},
		},
		"input": inputList,
	}
	if apiKey != "" && apiKeyLocation == "body" {
		body[apiKeyName] = apiKey
	}
	requestJSON, err := json.Marshal(body)
	if err != nil {
		if pricing.Stones > 0 {
			userModel.AddStones(codeSession.UserID, pricing.Stones)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "构建请求失败"})
		return
	}
	// 调试：若仍报 input.content.text 缺失，可查看实际发送的 input 结构
	inputJSON, _ := json.Marshal(inputList)
	if len(inputJSON) < 1500 {
		log.Printf("[ChatStream] 请求 input 示例: %s", string(inputJSON))
	} else {
		log.Printf("[ChatStream] 请求 input 条数: %d, 首 500 字符: %s", len(inputList), string(inputJSON[:500]))
	}

	log.Printf("[ChatStream] 用户 %d 发起流式聊天（豆包+联网搜索），消息数: %d", codeSession.UserID, len(req.Messages))

	if apiKey != "" && apiKeyLocation == "query" {
		separator := "?"
		if strings.Contains(endpoint, "?") {
			separator = "&"
		}
		endpoint = endpoint + separator + apiKeyName + "=" + apiKey
	}
	httpReq, err := http.NewRequest(method, endpoint, bytes.NewBuffer(requestJSON))
	if err != nil {
		if pricing.Stones > 0 {
			userModel.AddStones(codeSession.UserID, pricing.Stones)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "创建请求失败"})
		return
	}
	for key, value := range headers {
		httpReq.Header.Set(key, value)
	}
	if apiKey != "" {
		switch apiKeyLocation {
		case "header_bearer":
			httpReq.Header.Set("Authorization", "Bearer "+apiKey)
		case "header_custom":
			httpReq.Header.Set(apiKeyName, apiKey)
		}
	}

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("[ChatStream] 方舟 API 请求失败: %v", err)
		if pricing.Stones > 0 {
			userModel.AddStones(codeSession.UserID, pricing.Stones)
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "AI服务请求失败: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[ChatStream] 方舟 API 返回错误: %d, %s", resp.StatusCode, string(bodyBytes))
		if pricing.Stones > 0 {
			userModel.AddStones(codeSession.UserID, pricing.Stones)
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  fmt.Sprintf("AI服务返回错误: %d", resp.StatusCode),
		})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("X-Accel-Buffering", "no")
	c.Writer.Flush()

	reader := bufio.NewReader(resp.Body)
	var fullLen int
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			log.Printf("[ChatStream] 读取流失败: %v", err)
			break
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			sendSSEMessage(c, ChatStreamResponse{Type: "done"})
			break
		}
		var evt map[string]interface{}
		if err := json.Unmarshal([]byte(data), &evt); err != nil {
			continue
		}
		t, _ := evt["type"].(string)
		if strings.Contains(t, "output_text") && strings.Contains(t, "delta") {
			if d, _ := evt["delta"].(string); d != "" {
				fullLen += len([]rune(d))
				sendSSEMessage(c, ChatStreamResponse{Type: "content", Content: d})
			}
		}
	}
	sendSSEMessage(c, ChatStreamResponse{Type: "done"})
	log.Printf("[ChatStream] 用户 %d 流式聊天完成，总字数: %d", codeSession.UserID, fullLen)
}

func sendSSEMessage(c *gin.Context, data ChatStreamResponse) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return
	}
	c.Writer.Write([]byte("data: "))
	c.Writer.Write(jsonData)
	c.Writer.Write([]byte("\n\n"))
	c.Writer.Flush()
}
