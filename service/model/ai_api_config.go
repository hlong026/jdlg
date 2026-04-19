package model

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// AIAPIConfig AI API配置
type AIAPIConfig struct {
	ID                       int64     `json:"id" db:"id"`
	TaskType                 string    `json:"task_type" db:"task_type"`                               // ai_draw 或 ai_chat
	APIEndpoint              string    `json:"api_endpoint" db:"api_endpoint"`                         // API接口地址
	Method                   string    `json:"method" db:"method"`                                     // GET, POST, PUT等
	APIKey                   string    `json:"api_key" db:"api_key"`                                   // API Key
	APIKeyLocation           string    `json:"api_key_location" db:"api_key_location"`                 // API Key 发送位置: header_bearer, header_custom, query, body, none
	APIKeyName               string    `json:"api_key_name" db:"api_key_name"`                         // API Key 名称
	Headers                  string    `json:"headers" db:"headers"`                                   // JSON格式的请求头
	BodyTemplate             string    `json:"body_template" db:"body_template"`                       // JSON格式的请求体模板
	PromptPath               string    `json:"prompt_path" db:"prompt_path"`                           // 提示词在JSON中的路径，如 "prompt" 或 "data.prompt"
	EnablePromptOptimization bool      `json:"enable_prompt_optimization" db:"enable_prompt_optimization"` // 是否开启提示词优化
	ImagePath                string    `json:"image_path" db:"image_path"`                             // 用户图片在JSON中的路径，如 "image" 或 "data.images[0]"
	CreatedAt                time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time `json:"updated_at" db:"updated_at"`
}

// AIAPIConfigModel AI API配置数据访问层
type AIAPIConfigModel struct {
	DB    *sql.DB
	Redis *redis.Client
	ctx   context.Context
}

type aiAPIConfigScanner interface {
	Scan(dest ...interface{}) error
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func scanAIAPIConfig(scanner aiAPIConfigScanner) (*AIAPIConfig, error) {
	config := &AIAPIConfig{}
	var apiKey sql.NullString
	var apiKeyLocation sql.NullString
	var apiKeyName sql.NullString
	var headers sql.NullString
	var bodyTemplate sql.NullString
	var promptPath sql.NullString
	var imagePath sql.NullString
	err := scanner.Scan(
		&config.ID,
		&config.TaskType,
		&config.APIEndpoint,
		&config.Method,
		&apiKey,
		&apiKeyLocation,
		&apiKeyName,
		&headers,
		&bodyTemplate,
		&promptPath,
		&config.EnablePromptOptimization,
		&imagePath,
		&config.CreatedAt,
		&config.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	config.APIKey = nullStringValue(apiKey)
	config.APIKeyLocation = nullStringValue(apiKeyLocation)
	config.APIKeyName = nullStringValue(apiKeyName)
	config.Headers = nullStringValue(headers)
	config.BodyTemplate = nullStringValue(bodyTemplate)
	config.PromptPath = nullStringValue(promptPath)
	config.ImagePath = nullStringValue(imagePath)
	return config, nil
}

// NewAIAPIConfigModel 创建AI API配置模型
func NewAIAPIConfigModel(db *sql.DB, rdb *redis.Client) *AIAPIConfigModel {
	return &AIAPIConfigModel{
		DB:    db,
		Redis: rdb,
		ctx:   context.Background(),
	}
}

// GetByTaskType 根据任务类型获取API配置（优先从Redis读取）
func (m *AIAPIConfigModel) GetByTaskType(taskType string) (*AIAPIConfig, error) {
	// 先尝试从Redis读取
	key := "ai_api_config:task_type:" + taskType
	val, err := m.Redis.Get(m.ctx, key).Result()
	if err == nil {
		var config AIAPIConfig
		if err := json.Unmarshal([]byte(val), &config); err == nil {
			return &config, nil
		}
	}

	// Redis中没有，从MySQL读取
	query := `SELECT id, task_type, api_endpoint, method, api_key, api_key_location, api_key_name, headers, body_template, prompt_path, enable_prompt_optimization, image_path, created_at, updated_at 
	          FROM ai_api_config WHERE task_type = ?`
	config, err := scanAIAPIConfig(m.DB.QueryRow(query, taskType))
	if err != nil {
		return nil, err
	}

	// 写入Redis缓存
	data, _ := json.Marshal(config)
	m.Redis.Set(m.ctx, key, data, time.Hour*24)

	return config, nil
}

// GetAll 获取所有API配置
func (m *AIAPIConfigModel) GetAll() ([]*AIAPIConfig, error) {
	query := `SELECT id, task_type, api_endpoint, method, api_key, api_key_location, api_key_name, headers, body_template, prompt_path, enable_prompt_optimization, image_path, created_at, updated_at 
	          FROM ai_api_config ORDER BY task_type`
	rows, err := m.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []*AIAPIConfig
	for rows.Next() {
		config, err := scanAIAPIConfig(rows)
		if err != nil {
			continue
		}
		configs = append(configs, config)
	}
	return configs, nil
}

// Upsert 创建或更新API配置
func (m *AIAPIConfigModel) Upsert(config *AIAPIConfig) error {
	query := `INSERT INTO ai_api_config (task_type, api_endpoint, method, api_key, api_key_location, api_key_name, headers, body_template, prompt_path, enable_prompt_optimization, image_path, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
	          ON DUPLICATE KEY UPDATE 
	          api_endpoint = VALUES(api_endpoint),
	          method = VALUES(method),
	          api_key = VALUES(api_key),
	          api_key_location = VALUES(api_key_location),
	          api_key_name = VALUES(api_key_name),
	          headers = VALUES(headers),
	          body_template = VALUES(body_template),
	          prompt_path = VALUES(prompt_path),
	          enable_prompt_optimization = VALUES(enable_prompt_optimization),
	          image_path = VALUES(image_path),
	          updated_at = NOW()`
	
	_, err := m.DB.Exec(query, config.TaskType, config.APIEndpoint, config.Method, 
		config.APIKey, config.APIKeyLocation, config.APIKeyName,
		config.Headers, config.BodyTemplate, config.PromptPath, config.EnablePromptOptimization, config.ImagePath)
	if err != nil {
		return err
	}

	// 清除Redis缓存
	key := "ai_api_config:task_type:" + config.TaskType
	m.Redis.Del(m.ctx, key)

	return nil
}

// InitTable 初始化ai_api_config表
func (m *AIAPIConfigModel) InitTable() error {
	schema := `
CREATE TABLE IF NOT EXISTS ai_api_config (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	task_type VARCHAR(32) NOT NULL UNIQUE COMMENT '任务类型：ai_draw（AI绘画）或 ai_chat（AI聊天）',
	api_endpoint VARCHAR(512) NOT NULL COMMENT 'API接口地址',
	method VARCHAR(16) NOT NULL DEFAULT 'POST' COMMENT '请求方法：GET, POST, PUT等',
	api_key VARCHAR(256) DEFAULT NULL COMMENT 'API Key',
	api_key_location VARCHAR(32) DEFAULT 'header_bearer' COMMENT 'API Key发送位置：header_bearer, header_custom, query, body, none',
	api_key_name VARCHAR(64) DEFAULT 'Authorization' COMMENT 'API Key名称',
	headers TEXT COMMENT '请求头（JSON格式）',
	body_template TEXT COMMENT '请求体模板（JSON格式）',
	prompt_path VARCHAR(128) DEFAULT NULL COMMENT '提示词在JSON中的路径，如 "prompt" 或 "data.prompt"',
	enable_prompt_optimization TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否开启提示词优化：0-否，1-是',
	image_path VARCHAR(128) DEFAULT NULL COMMENT '用户图片在JSON中的路径，如 "image" 或 "data.images[0]"',
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	INDEX idx_task_type (task_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`
	_, err := m.DB.Exec(schema)
	if err != nil {
		return err
	}

	// 检查并添加新字段（如果表已存在但缺少新字段）
	addColumnIfNotExists := func(columnName, columnDef string) {
		var exists bool
		m.DB.QueryRow(`
			SELECT COUNT(*) > 0 
			FROM information_schema.COLUMNS 
			WHERE TABLE_SCHEMA = DATABASE() 
			AND TABLE_NAME = 'ai_api_config' 
			AND COLUMN_NAME = ?
		`, columnName).Scan(&exists)
		if !exists {
			m.DB.Exec(`ALTER TABLE ai_api_config ADD COLUMN ` + columnDef)
		}
	}

	addColumnIfNotExists("prompt_path", "prompt_path VARCHAR(128) DEFAULT NULL COMMENT '提示词在JSON中的路径'")
	addColumnIfNotExists("enable_prompt_optimization", "enable_prompt_optimization TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否开启提示词优化'")
	addColumnIfNotExists("image_path", "image_path VARCHAR(128) DEFAULT NULL COMMENT '用户图片在JSON中的路径'")
	addColumnIfNotExists("api_key", "api_key VARCHAR(256) DEFAULT NULL COMMENT 'API Key'")
	addColumnIfNotExists("api_key_location", "api_key_location VARCHAR(32) DEFAULT 'header_bearer' COMMENT 'API Key发送位置'")
	addColumnIfNotExists("api_key_name", "api_key_name VARCHAR(64) DEFAULT 'Authorization' COMMENT 'API Key名称'")

	return nil
}

// InitDefaultConfigs 初始化默认AI API配置（如果不存在则插入）
// 这里使用老张平台的 API Key，调用方建议传入 cfg.AI.LaoZhangAPIKey（为空时保留空值，等待管理后台补齐）
func (m *AIAPIConfigModel) InitDefaultConfigs(laoZhangKey string) error {
	apiKey := laoZhangKey

	// 默认配置列表
	defaultConfigs := []AIAPIConfig{
		{
			TaskType:       "ai_draw",
			// 默认使用新的 v1beta generateContent 接口
			APIEndpoint:    "https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent",
			Method:         "POST",
			APIKey:         apiKey,
			APIKeyLocation: "header_bearer",
			APIKeyName:     "Authorization",
			Headers:        `{"Content-Type": "application/json"}`,
			// 纯文字生图模板（带比例和清晰度占位符）
			// 占位符：
			//   {{prompt}}        -> 文本提示词
			//   {{aspect_ratio}}  -> 比例（如 1:1, 16:9 等）
			//   {{image_size}}    -> 清晰度/分辨率（如 1K, 2K, 4K）
			BodyTemplate: `{
  "contents": [{
    "parts": [
      { "text": "{{prompt}}" }
    ]
  }],
  "generationConfig": {
    "responseModalities": ["IMAGE"],
    "imageConfig": {
      "aspectRatio": "{{aspect_ratio}}",
      "imageSize": "{{image_size}}"
    }
  }
}`,
			EnablePromptOptimization: false,
		},
		{
			TaskType:       "ai_chat",
			APIEndpoint:    "https://api.laozhang.ai/v1/chat/completions",
			Method:         "POST",
			APIKey:         apiKey,
			APIKeyLocation: "header_bearer",
			APIKeyName:     "Authorization",
			Headers:        `{"Content-Type": "application/json"}`,
			BodyTemplate:             `{"model":"gemini-3-pro-image-preview","stream":false,"messages":[{"role":"user","content":"{{prompt}}"}]}`,
			EnablePromptOptimization: false,
		},
	}

	for _, config := range defaultConfigs {
		// 检查是否已存在
		var exists bool
		m.DB.QueryRow(`SELECT COUNT(*) > 0 FROM ai_api_config WHERE task_type = ?`, config.TaskType).Scan(&exists)
		if exists {
			log.Printf("[AIAPIConfig] %s 配置已存在，跳过初始化", config.TaskType)
			continue
		}

		// 插入默认配置
		query := `INSERT INTO ai_api_config (task_type, api_endpoint, method, api_key, api_key_location, api_key_name, headers, body_template, enable_prompt_optimization, created_at, updated_at) 
		          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`
		_, err := m.DB.Exec(query, 
			config.TaskType, 
			config.APIEndpoint, 
			config.Method,
			config.APIKey,
			config.APIKeyLocation,
			config.APIKeyName,
			config.Headers, 
			config.BodyTemplate, 
			config.EnablePromptOptimization,
		)
		if err != nil {
			log.Printf("[AIAPIConfig] 插入 %s 默认配置失败: %v", config.TaskType, err)
			return err
		}
		log.Printf("[AIAPIConfig] ✓ 已插入 %s 默认配置", config.TaskType)
	}

	return nil
}
