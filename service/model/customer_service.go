package model

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"
)

const (
	CustomerLeadStatusNew       = "new"
	CustomerLeadStatusContacted = "contacted"
	CustomerLeadStatusConverted = "converted"
	CustomerLeadStatusInvalid   = "invalid"

	CustomerIntentLevelLow    = "low"
	CustomerIntentLevelMedium = "medium"
	CustomerIntentLevelHigh   = "high"
)

type CustomerLead struct {
	ID                      int64     `json:"id"`
	UserID                  int64     `json:"user_id"`
	Name                    string    `json:"name"`
	Phone                   string    `json:"phone"`
	Wechat                  string    `json:"wechat"`
	EnterpriseWechatContact string    `json:"enterprise_wechat_contact"`
	DemandSummary           string    `json:"demand_summary"`
	HouseFloors             string    `json:"house_floors"`
	HouseStyle              string    `json:"house_style"`
	LandWidth               string    `json:"land_width"`
	LandDepth               string    `json:"land_depth"`
	RoomRequirement         string    `json:"room_requirement"`
	Source                  string    `json:"source"`
	SourceTaskNo            string    `json:"source_task_no"`
	IntentLevel             string    `json:"intent_level"`
	Status                  string    `json:"status"`
	AssignedTo              string    `json:"assigned_to"`
	Remark                  string    `json:"remark"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

type CustomerLeadCreateInput struct {
	UserID                  int64
	Name                    string
	Phone                   string
	Wechat                  string
	EnterpriseWechatContact string
	DemandSummary           string
	HouseFloors             string
	HouseStyle              string
	LandWidth               string
	LandDepth               string
	RoomRequirement         string
	Source                  string
	SourceTaskNo            string
	IntentLevel             string
	Status                  string
	Remark                  string
}

type CustomerLeadListParams struct {
	Keyword     string
	Status      string
	IntentLevel string
	Source      string
	Limit       int
	Offset      int
}

type CustomerLeadOverview struct {
	TotalCount      int64 `json:"total_count"`
	NewCount        int64 `json:"new_count"`
	ContactedCount  int64 `json:"contacted_count"`
	HighIntentCount int64 `json:"high_intent_count"`
	ConvertedCount  int64 `json:"converted_count"`
}

type CustomerServiceEventCreateInput struct {
	UserID        int64
	LeadID        int64
	SessionNo     string
	EventType     string
	Source        string
	SourceTaskNo  string
	IntentLevel   string
	DemandSummary string
	Payload       map[string]interface{}
}

type CustomerServiceModel struct {
	DB *sql.DB
}

func NewCustomerServiceModel(db *sql.DB) *CustomerServiceModel {
	return &CustomerServiceModel{DB: db}
}

func NormalizeCustomerLeadStatus(status string) string {
	switch strings.TrimSpace(status) {
	case CustomerLeadStatusNew, CustomerLeadStatusContacted, CustomerLeadStatusConverted, CustomerLeadStatusInvalid:
		return strings.TrimSpace(status)
	default:
		return CustomerLeadStatusNew
	}
}

func NormalizeCustomerIntentLevel(level string) string {
	switch strings.TrimSpace(level) {
	case CustomerIntentLevelLow, CustomerIntentLevelMedium, CustomerIntentLevelHigh:
		return strings.TrimSpace(level)
	default:
		return CustomerIntentLevelMedium
	}
}

func (m *CustomerServiceModel) InitTable() error {
	if _, err := m.DB.Exec(`
CREATE TABLE IF NOT EXISTS customer_leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  name VARCHAR(64) NOT NULL DEFAULT '',
  phone VARCHAR(32) NOT NULL DEFAULT '',
  wechat VARCHAR(128) NOT NULL DEFAULT '',
  enterprise_wechat_contact VARCHAR(128) NOT NULL DEFAULT '',
  demand_summary TEXT,
  house_floors VARCHAR(64) NOT NULL DEFAULT '',
  house_style VARCHAR(64) NOT NULL DEFAULT '',
  land_width VARCHAR(64) NOT NULL DEFAULT '',
  land_depth VARCHAR(64) NOT NULL DEFAULT '',
  room_requirement VARCHAR(255) NOT NULL DEFAULT '',
  source VARCHAR(64) NOT NULL DEFAULT '',
  source_task_no VARCHAR(128) NOT NULL DEFAULT '',
  intent_level VARCHAR(32) NOT NULL DEFAULT 'medium',
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  assigned_to VARCHAR(64) NOT NULL DEFAULT '',
  remark TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_intent_level (intent_level),
  INDEX idx_source_task_no (source_task_no),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`); err != nil {
		return err
	}

	if _, err := m.DB.Exec(`
CREATE TABLE IF NOT EXISTS customer_service_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  lead_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  session_no VARCHAR(128) NOT NULL DEFAULT '',
  event_type VARCHAR(64) NOT NULL DEFAULT '',
  source VARCHAR(64) NOT NULL DEFAULT '',
  source_task_no VARCHAR(128) NOT NULL DEFAULT '',
  intent_level VARCHAR(32) NOT NULL DEFAULT 'medium',
  demand_summary TEXT,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_lead_id (lead_id),
  INDEX idx_event_type (event_type),
  INDEX idx_source_task_no (source_task_no),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`); err != nil {
		return err
	}

	return nil
}

func (m *CustomerServiceModel) CreateLead(input *CustomerLeadCreateInput) (int64, error) {
	result, err := m.DB.Exec(`
		INSERT INTO customer_leads (
			user_id, name, phone, wechat, enterprise_wechat_contact, demand_summary,
			house_floors, house_style, land_width, land_depth, room_requirement,
			source, source_task_no, intent_level, status, assigned_to, remark,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, NOW(), NOW())
	`,
		input.UserID,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Phone),
		strings.TrimSpace(input.Wechat),
		strings.TrimSpace(input.EnterpriseWechatContact),
		strings.TrimSpace(input.DemandSummary),
		strings.TrimSpace(input.HouseFloors),
		strings.TrimSpace(input.HouseStyle),
		strings.TrimSpace(input.LandWidth),
		strings.TrimSpace(input.LandDepth),
		strings.TrimSpace(input.RoomRequirement),
		strings.TrimSpace(input.Source),
		strings.TrimSpace(input.SourceTaskNo),
		NormalizeCustomerIntentLevel(input.IntentLevel),
		NormalizeCustomerLeadStatus(input.Status),
		strings.TrimSpace(input.Remark),
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (m *CustomerServiceModel) CreateEvent(input *CustomerServiceEventCreateInput) (int64, error) {
	payload, err := marshalCustomerServicePayload(input.Payload)
	if err != nil {
		return 0, err
	}
	result, err := m.DB.Exec(`
		INSERT INTO customer_service_events (
			user_id, lead_id, session_no, event_type, source, source_task_no,
			intent_level, demand_summary, payload, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
	`,
		input.UserID,
		input.LeadID,
		strings.TrimSpace(input.SessionNo),
		strings.TrimSpace(input.EventType),
		strings.TrimSpace(input.Source),
		strings.TrimSpace(input.SourceTaskNo),
		NormalizeCustomerIntentLevel(input.IntentLevel),
		strings.TrimSpace(input.DemandSummary),
		payload,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (m *CustomerServiceModel) ListLeads(params CustomerLeadListParams) ([]*CustomerLead, int64, error) {
	limit := params.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	where := []string{"1=1"}
	args := make([]interface{}, 0)
	if keyword := strings.TrimSpace(params.Keyword); keyword != "" {
		likeKeyword := "%" + keyword + "%"
		where = append(where, `(name LIKE ? OR phone LIKE ? OR wechat LIKE ? OR enterprise_wechat_contact LIKE ? OR demand_summary LIKE ? OR source_task_no LIKE ?)`)
		args = append(args, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword)
	}
	if status := strings.TrimSpace(params.Status); status != "" && status != "all" {
		where = append(where, `status = ?`)
		args = append(args, NormalizeCustomerLeadStatus(status))
	}
	if level := strings.TrimSpace(params.IntentLevel); level != "" && level != "all" {
		where = append(where, `intent_level = ?`)
		args = append(args, NormalizeCustomerIntentLevel(level))
	}
	if source := strings.TrimSpace(params.Source); source != "" && source != "all" {
		where = append(where, `source = ?`)
		args = append(args, source)
	}

	whereSQL := strings.Join(where, " AND ")
	var total int64
	if err := m.DB.QueryRow(`SELECT COUNT(*) FROM customer_leads WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, user_id, name, phone, wechat, enterprise_wechat_contact,
		       COALESCE(demand_summary, ''), house_floors, house_style, land_width, land_depth,
		       room_requirement, source, source_task_no, intent_level, status, assigned_to,
		       COALESCE(remark, ''), created_at, updated_at
		FROM customer_leads
		WHERE ` + whereSQL + `
		ORDER BY FIELD(status, 'new', 'contacted', 'converted', 'invalid'), FIELD(intent_level, 'high', 'medium', 'low'), created_at DESC
		LIMIT ? OFFSET ?`
	queryArgs := append(append([]interface{}{}, args...), limit, offset)
	rows, err := m.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	list := make([]*CustomerLead, 0, limit)
	for rows.Next() {
		item := &CustomerLead{}
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Name,
			&item.Phone,
			&item.Wechat,
			&item.EnterpriseWechatContact,
			&item.DemandSummary,
			&item.HouseFloors,
			&item.HouseStyle,
			&item.LandWidth,
			&item.LandDepth,
			&item.RoomRequirement,
			&item.Source,
			&item.SourceTaskNo,
			&item.IntentLevel,
			&item.Status,
			&item.AssignedTo,
			&item.Remark,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (m *CustomerServiceModel) Overview() (*CustomerLeadOverview, error) {
	overview := &CustomerLeadOverview{}
	query := `
		SELECT
			COUNT(*) AS total_count,
			COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS new_count,
			COALESCE(SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END), 0) AS contacted_count,
			COALESCE(SUM(CASE WHEN intent_level = 'high' THEN 1 ELSE 0 END), 0) AS high_intent_count,
			COALESCE(SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END), 0) AS converted_count
		FROM customer_leads`
	if err := m.DB.QueryRow(query).Scan(
		&overview.TotalCount,
		&overview.NewCount,
		&overview.ContactedCount,
		&overview.HighIntentCount,
		&overview.ConvertedCount,
	); err != nil {
		return nil, err
	}
	return overview, nil
}

func (m *CustomerServiceModel) UpdateLeadStatus(id int64, status string, remark string) error {
	result, err := m.DB.Exec(`UPDATE customer_leads SET status = ?, remark = ?, updated_at = NOW() WHERE id = ?`, NormalizeCustomerLeadStatus(status), strings.TrimSpace(remark), id)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func marshalCustomerServicePayload(payload map[string]interface{}) (interface{}, error) {
	if len(payload) == 0 {
		return nil, nil
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}
