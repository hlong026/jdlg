package model

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

const (
	UserIdentityTypeWechatOpenID  = "wechat_openid"
	UserIdentityTypeWechatUnionID = "wechat_unionid"
	UserIdentityTypePhone         = "phone"
	UserIdentityTypeUsername      = "username"
)

type UserIdentity struct {
	ID             int64      `json:"id" db:"id"`
	UserID         int64      `json:"user_id" db:"user_id"`
	IdentityType   string     `json:"identity_type" db:"identity_type"`
	IdentityKey    string     `json:"identity_key" db:"identity_key"`
	CredentialHash string     `json:"-" db:"credential_hash"`
	VerifiedAt     *time.Time `json:"verified_at" db:"verified_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

type UserIdentityModel struct {
	DB *sql.DB
}

func NewUserIdentityModel(db *sql.DB) *UserIdentityModel {
	return &UserIdentityModel{DB: db}
}

func (m *UserIdentityModel) InitTable() error {
	schema := `
CREATE TABLE IF NOT EXISTS user_identities (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	user_id BIGINT UNSIGNED NOT NULL,
	identity_type VARCHAR(32) NOT NULL,
	identity_key VARCHAR(191) NOT NULL,
	credential_hash VARCHAR(255) DEFAULT '',
	verified_at TIMESTAMP NULL DEFAULT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	UNIQUE KEY uk_identity_type_key (identity_type, identity_key),
	INDEX idx_user_id (user_id),
	INDEX idx_identity_type_user (identity_type, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`
	_, err := m.DB.Exec(schema)
	return err
}

func normalizeIdentityType(identityType string) string {
	return strings.TrimSpace(strings.ToLower(identityType))
}

func normalizeIdentityKey(identityType, identityKey string) string {
	normalizedType := normalizeIdentityType(identityType)
	normalizedKey := strings.TrimSpace(identityKey)
	switch normalizedType {
	case UserIdentityTypePhone:
		return normalizePhoneIdentity(normalizedKey)
	case UserIdentityTypeUsername:
		return strings.ToLower(normalizedKey)
	default:
		return normalizedKey
	}
}

func normalizePhoneIdentity(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	var builder strings.Builder
	for _, ch := range trimmed {
		if ch >= '0' && ch <= '9' {
			builder.WriteRune(ch)
		}
	}
	digits := builder.String()
	if len(digits) > 11 && strings.HasPrefix(digits, "86") {
		digits = digits[2:]
	}
	return digits
}

func NormalizePhoneForClient(raw string) string {
	return normalizePhoneIdentity(raw)
}

func (m *UserIdentityModel) GetByIdentity(identityType, identityKey string) (*UserIdentity, error) {
	identityType = normalizeIdentityType(identityType)
	identityKey = normalizeIdentityKey(identityType, identityKey)
	if identityType == "" || identityKey == "" {
		return nil, sql.ErrNoRows
	}

	identity := &UserIdentity{}
	query := `SELECT id, user_id, identity_type, identity_key, credential_hash, verified_at, created_at, updated_at
		FROM user_identities
		WHERE identity_type = ? AND identity_key = ?
		LIMIT 1`
	err := m.DB.QueryRow(query, identityType, identityKey).Scan(
		&identity.ID,
		&identity.UserID,
		&identity.IdentityType,
		&identity.IdentityKey,
		&identity.CredentialHash,
		&identity.VerifiedAt,
		&identity.CreatedAt,
		&identity.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return identity, nil
}

func (m *UserIdentityModel) ListByUserID(userID int64) ([]*UserIdentity, error) {
	rows, err := m.DB.Query(`SELECT id, user_id, identity_type, identity_key, credential_hash, verified_at, created_at, updated_at
		FROM user_identities
		WHERE user_id = ?
		ORDER BY id ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*UserIdentity
	for rows.Next() {
		item := &UserIdentity{}
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.IdentityType,
			&item.IdentityKey,
			&item.CredentialHash,
			&item.VerifiedAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (m *UserIdentityModel) Create(identity *UserIdentity) error {
	if identity == nil {
		return errors.New("identity is nil")
	}
	identity.IdentityType = normalizeIdentityType(identity.IdentityType)
	identity.IdentityKey = normalizeIdentityKey(identity.IdentityType, identity.IdentityKey)
	if identity.UserID <= 0 || identity.IdentityType == "" || identity.IdentityKey == "" {
		return errors.New("invalid identity payload")
	}

	result, err := m.DB.Exec(`INSERT INTO user_identities (user_id, identity_type, identity_key, credential_hash, verified_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
		identity.UserID,
		identity.IdentityType,
		identity.IdentityKey,
		identity.CredentialHash,
		identity.VerifiedAt,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	identity.ID = id
	return nil
}

func (m *UserIdentityModel) Upsert(identity *UserIdentity) (*UserIdentity, error) {
	if identity == nil {
		return nil, errors.New("identity is nil")
	}
	if err := m.Create(identity); err == nil {
		return identity, nil
	} else if !isDuplicateKey(err) {
		return nil, err
	}

	existing, err := m.GetByIdentity(identity.IdentityType, identity.IdentityKey)
	if err != nil {
		return nil, err
	}
	if identity.CredentialHash != "" && existing.CredentialHash != identity.CredentialHash {
		if _, err := m.DB.Exec(`UPDATE user_identities SET credential_hash = ?, verified_at = COALESCE(?, verified_at), updated_at = NOW() WHERE id = ?`,
			identity.CredentialHash, identity.VerifiedAt, existing.ID); err != nil {
			return nil, err
		}
		existing.CredentialHash = identity.CredentialHash
	}
	return existing, nil
}

func (m *UserIdentityModel) UpdateCredentialHash(userID int64, identityType, identityKey, credentialHash string) error {
	identityType = normalizeIdentityType(identityType)
	identityKey = normalizeIdentityKey(identityType, identityKey)
	if userID <= 0 || identityType == "" || identityKey == "" {
		return errors.New("invalid identity update payload")
	}
	_, err := m.DB.Exec(`UPDATE user_identities SET credential_hash = ?, verified_at = COALESCE(verified_at, NOW()), updated_at = NOW()
		WHERE user_id = ? AND identity_type = ? AND identity_key = ?`,
		credentialHash, userID, identityType, identityKey)
	return err
}

func (m *UserIdentityModel) RebindUser(fromUserID, toUserID int64) error {
	if fromUserID <= 0 || toUserID <= 0 || fromUserID == toUserID {
		return nil
	}

	identities, err := m.ListByUserID(fromUserID)
	if err != nil {
		return err
	}
	for _, identity := range identities {
		existing, err := m.GetByIdentity(identity.IdentityType, identity.IdentityKey)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if existing != nil && existing.UserID == toUserID {
			if _, err := m.DB.Exec(`DELETE FROM user_identities WHERE id = ?`, identity.ID); err != nil {
				return err
			}
			continue
		}
		if _, err := m.DB.Exec(`UPDATE user_identities SET user_id = ?, updated_at = NOW() WHERE id = ?`, toUserID, identity.ID); err != nil {
			return err
		}
	}
	return nil
}
