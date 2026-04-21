package model

import (
	"database/sql"
	"strings"
	"time"
)

type AccountMergeService struct {
	DB                  *sql.DB
	UserIdentityModel   *UserIdentityModel
	UserProfileModel    *UserProfileModel
	UserInviteCodeModel *UserInviteCodeModel
	UserMembershipModel *UserMembershipModel
}

func NewAccountMergeService(db *sql.DB) *AccountMergeService {
	return &AccountMergeService{
		DB:                  db,
		UserIdentityModel:   NewUserIdentityModel(db),
		UserProfileModel:    NewUserProfileModel(db),
		UserInviteCodeModel: NewUserInviteCodeModel(db),
		UserMembershipModel: NewUserMembershipModel(db),
	}
}

func (s *AccountMergeService) MergeUsers(masterUserID, sourceUserID int64, reason string) error {
	if masterUserID <= 0 || sourceUserID <= 0 || masterUserID == sourceUserID {
		return nil
	}
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.mergeUserOrders(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeUserBalances(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE stone_records SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE ai_tasks SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE ai_video_tasks SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE templates SET creator_user_id = ? WHERE creator_user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE template_comments SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE template_shares SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeTemplateLikes(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeTemplateUnlocks(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeDesignerFollows(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE designer_reviews
		SET designer_user_id = CASE WHEN designer_user_id = ? THEN ? ELSE designer_user_id END,
		    reviewer_user_id = CASE WHEN reviewer_user_id = ? THEN ? ELSE reviewer_user_id END
		WHERE designer_user_id = ? OR reviewer_user_id = ?`,
		sourceUserID, masterUserID, sourceUserID, masterUserID, sourceUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeInviteRelations(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeMembership(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeInviteCode(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeProfile(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE certification_applications SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE code_sessions SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE users SET merge_status = 'merged_target', merged_to_user_id = NULL, updated_at = NOW() WHERE id = ?`, masterUserID); err != nil {
		return err
	}
	if err = s.exec(tx, `UPDATE users SET merge_status = 'merged_source', merged_to_user_id = ?, updated_at = NOW() WHERE id = ?`, masterUserID, sourceUserID); err != nil {
		return err
	}
	if err = s.mergeIdentities(tx, masterUserID, sourceUserID); err != nil {
		return err
	}
	if reason != "" {
		if err = s.exec(tx, `UPDATE users SET updated_at = NOW() WHERE id IN (?, ?)`, masterUserID, sourceUserID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *AccountMergeService) mergeUserBalances(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	var masterStones int64
	var sourceStones int64
	var masterCanWithdraw int
	var sourceCanWithdraw int
	var masterPassword string
	var sourcePassword string
	if err := tx.QueryRow(`SELECT COALESCE(stones, 0), COALESCE(can_withdraw, 0), COALESCE(NULLIF(password, ''), '') FROM users WHERE id = ?`, masterUserID).
		Scan(&masterStones, &masterCanWithdraw, &masterPassword); err != nil {
		return err
	}
	if err := tx.QueryRow(`SELECT COALESCE(stones, 0), COALESCE(can_withdraw, 0), COALESCE(NULLIF(password, ''), '') FROM users WHERE id = ?`, sourceUserID).
		Scan(&sourceStones, &sourceCanWithdraw, &sourcePassword); err != nil {
		return err
	}
	targetPassword := masterPassword
	if strings.TrimSpace(targetPassword) == "" && strings.TrimSpace(sourcePassword) != "" {
		targetPassword = sourcePassword
	}
	targetCanWithdraw := masterCanWithdraw
	if sourceCanWithdraw > targetCanWithdraw {
		targetCanWithdraw = sourceCanWithdraw
	}
	if _, err := tx.Exec(`UPDATE users SET stones = ?, can_withdraw = ?, password = CASE WHEN ? <> '' THEN ? ELSE password END, updated_at = NOW() WHERE id = ?`,
		masterStones+sourceStones, targetCanWithdraw, targetPassword, targetPassword, masterUserID); err != nil {
		return err
	}
	_, err := tx.Exec(`UPDATE users SET stones = 0, updated_at = NOW() WHERE id = ?`, sourceUserID)
	return err
}

func (s *AccountMergeService) mergeIdentities(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	rows, err := tx.Query(`SELECT id, identity_type, identity_key, credential_hash, verified_at
		FROM user_identities
		WHERE user_id = ?`, sourceUserID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type identityRow struct {
		id             int64
		identityType   string
		identityKey    string
		credentialHash string
		verifiedAt     sql.NullTime
	}
	identities := make([]identityRow, 0)
	for rows.Next() {
		var item identityRow
		if err := rows.Scan(&item.id, &item.identityType, &item.identityKey, &item.credentialHash, &item.verifiedAt); err != nil {
			return err
		}
		identities = append(identities, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, identity := range identities {
		var existingID int64
		var existingHash string
		queryErr := tx.QueryRow(`SELECT id, credential_hash FROM user_identities WHERE user_id = ? AND identity_type = ? AND identity_key = ? LIMIT 1`,
			masterUserID, identity.identityType, identity.identityKey).Scan(&existingID, &existingHash)
		if queryErr == nil {
			if strings.TrimSpace(existingHash) == "" && strings.TrimSpace(identity.credentialHash) != "" {
				if _, err := tx.Exec(`UPDATE user_identities SET credential_hash = ?, verified_at = COALESCE(verified_at, ?), updated_at = NOW() WHERE id = ?`,
					identity.credentialHash, nullTimeValue(identity.verifiedAt), existingID); err != nil {
					return err
				}
			}
			if _, err := tx.Exec(`DELETE FROM user_identities WHERE id = ?`, identity.id); err != nil {
				return err
			}
			continue
		}
		if queryErr != sql.ErrNoRows {
			return queryErr
		}
		if _, err := tx.Exec(`UPDATE user_identities SET user_id = ?, updated_at = NOW() WHERE id = ?`, masterUserID, identity.id); err != nil {
			return err
		}
	}
	return nil
}

func nullTimeValue(value sql.NullTime) interface{} {
	if value.Valid {
		return value.Time
	}
	return nil
}

func (s *AccountMergeService) exec(tx *sql.Tx, query string, args ...interface{}) error {
	_, err := tx.Exec(query, args...)
	return err
}

func (s *AccountMergeService) mergeUserOrders(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	_, err := tx.Exec(`UPDATE user_orders
		SET user_id = CASE WHEN user_id = ? THEN ? ELSE user_id END,
		    designer_user_id = CASE WHEN designer_user_id = ? THEN ? ELSE designer_user_id END
		WHERE user_id = ? OR designer_user_id = ?`,
		sourceUserID, masterUserID, sourceUserID, masterUserID, sourceUserID, sourceUserID)
	return err
}

func (s *AccountMergeService) mergeTemplateLikes(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	if _, err := tx.Exec(`INSERT IGNORE INTO template_likes (user_id, template_id, created_at)
		SELECT ?, template_id, MIN(created_at)
		FROM template_likes
		WHERE user_id = ?
		GROUP BY template_id`, masterUserID, sourceUserID); err != nil {
		return err
	}
	_, err := tx.Exec(`DELETE FROM template_likes WHERE user_id = ?`, sourceUserID)
	return err
}

func (s *AccountMergeService) mergeTemplateUnlocks(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	if _, err := tx.Exec(`INSERT IGNORE INTO template_unlocks (user_id, template_id, created_at)
		SELECT ?, template_id, MIN(created_at)
		FROM template_unlocks
		WHERE user_id = ?
		GROUP BY template_id`, masterUserID, sourceUserID); err != nil {
		return err
	}
	_, err := tx.Exec(`DELETE FROM template_unlocks WHERE user_id = ?`, sourceUserID)
	return err
}

func (s *AccountMergeService) mergeDesignerFollows(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	if _, err := tx.Exec(`INSERT IGNORE INTO designer_follows (follower_user_id, designer_user_id, created_at)
		SELECT
		  CASE WHEN follower_user_id = ? THEN ? ELSE follower_user_id END,
		  CASE WHEN designer_user_id = ? THEN ? ELSE designer_user_id END,
		  MIN(created_at)
		FROM designer_follows
		WHERE follower_user_id = ? OR designer_user_id = ?
		GROUP BY
		  CASE WHEN follower_user_id = ? THEN ? ELSE follower_user_id END,
		  CASE WHEN designer_user_id = ? THEN ? ELSE designer_user_id END`,
		sourceUserID, masterUserID, sourceUserID, masterUserID,
		sourceUserID, sourceUserID,
		sourceUserID, masterUserID, sourceUserID, masterUserID); err != nil {
		return err
	}
	_, err := tx.Exec(`DELETE FROM designer_follows WHERE follower_user_id = ? OR designer_user_id = ?`, sourceUserID, sourceUserID)
	return err
}

func (s *AccountMergeService) mergeInviteRelations(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	rows, err := tx.Query(`SELECT inviter_user_id, invitee_user_id, invited_at, first_recharge_done
		FROM invite_relations
		WHERE inviter_user_id = ? OR invitee_user_id = ?`, sourceUserID, sourceUserID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type relationRow struct {
		inviter  int64
		invitee  int64
		invited  time.Time
		firstPay int
	}
	items := make([]relationRow, 0)
	for rows.Next() {
		var item relationRow
		if err := rows.Scan(&item.inviter, &item.invitee, &item.invited, &item.firstPay); err != nil {
			return err
		}
		if item.inviter == sourceUserID {
			item.inviter = masterUserID
		}
		if item.invitee == sourceUserID {
			item.invitee = masterUserID
		}
		if item.inviter == item.invitee {
			continue
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, item := range items {
		if _, err := tx.Exec(`INSERT INTO invite_relations (inviter_user_id, invitee_user_id, invited_at, first_recharge_done)
			VALUES (?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
			  inviter_user_id = VALUES(inviter_user_id),
			  invited_at = LEAST(invited_at, VALUES(invited_at)),
			  first_recharge_done = GREATEST(first_recharge_done, VALUES(first_recharge_done))`,
			item.inviter, item.invitee, item.invited, item.firstPay); err != nil {
			return err
		}
	}
	_, err = tx.Exec(`DELETE FROM invite_relations WHERE inviter_user_id = ? OR invitee_user_id = ?`, sourceUserID, sourceUserID)
	return err
}

func membershipWeight(item *UserMembership) int64 {
	if item == nil {
		return 0
	}
	score := item.ExpiredAt.Unix()
	if item.Status == "active" {
		score += 1_000_000_000_000
	}
	if item.TemplateDownloadEnabled {
		score += 100_000_000_000
	}
	if IsLifetimeMembership(item) {
		score += 10_000_000_000_000
	}
	return score
}

func (s *AccountMergeService) mergeMembership(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	master, masterErr := s.UserMembershipModel.GetByUserID(masterUserID)
	if masterErr != nil && masterErr != sql.ErrNoRows {
		return masterErr
	}
	source, sourceErr := s.UserMembershipModel.GetByUserID(sourceUserID)
	if sourceErr != nil && sourceErr != sql.ErrNoRows {
		return sourceErr
	}
	if source == nil {
		return nil
	}
	chosen := source
	if membershipWeight(master) >= membershipWeight(source) {
		chosen = master
	}
	if chosen != nil {
		templateDownloadEnabled := 0
		if chosen.TemplateDownloadEnabled {
			templateDownloadEnabled = 1
		}
		if _, err := tx.Exec(`INSERT INTO user_memberships (user_id, plan_id, plan_code, plan_title, source_order_no, status, template_download_enabled, started_at, granted_at, expired_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
			  plan_id = VALUES(plan_id),
			  plan_code = VALUES(plan_code),
			  plan_title = VALUES(plan_title),
			  source_order_no = VALUES(source_order_no),
			  status = VALUES(status),
			  template_download_enabled = VALUES(template_download_enabled),
			  started_at = VALUES(started_at),
			  granted_at = VALUES(granted_at),
			  expired_at = VALUES(expired_at),
			  updated_at = NOW()`,
			masterUserID, chosen.PlanID, chosen.PlanCode, chosen.PlanTitle, chosen.SourceOrderNo, chosen.Status, templateDownloadEnabled, chosen.StartedAt, chosen.GrantedAt, chosen.ExpiredAt); err != nil {
			return err
		}
	}
	_, err := tx.Exec(`DELETE FROM user_memberships WHERE user_id = ?`, sourceUserID)
	return err
}

func (s *AccountMergeService) mergeInviteCode(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	masterCode, err := s.UserInviteCodeModel.GetByUserID(masterUserID)
	if err != nil {
		return err
	}
	sourceCode, err := s.UserInviteCodeModel.GetByUserID(sourceUserID)
	if err != nil {
		return err
	}
	if masterCode == nil && sourceCode != nil {
		if _, err := tx.Exec(`UPDATE user_invite_codes SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
			return err
		}
		return nil
	}
	_, err = tx.Exec(`DELETE FROM user_invite_codes WHERE user_id = ?`, sourceUserID)
	return err
}

func (s *AccountMergeService) mergeProfile(tx *sql.Tx, masterUserID, sourceUserID int64) error {
	master, masterErr := s.UserProfileModel.GetByUserID(masterUserID)
	if masterErr != nil && masterErr != sql.ErrNoRows {
		return masterErr
	}
	source, sourceErr := s.UserProfileModel.GetByUserID(sourceUserID)
	if sourceErr != nil && sourceErr != sql.ErrNoRows {
		return sourceErr
	}
	if source == nil {
		return nil
	}
	if master == nil {
		if _, err := tx.Exec(`UPDATE user_profiles SET user_id = ? WHERE user_id = ?`, masterUserID, sourceUserID); err != nil {
			return err
		}
		return nil
	}

	nickname := strings.TrimSpace(master.Nickname)
	if nickname == "" {
		nickname = strings.TrimSpace(source.Nickname)
	}
	avatar := strings.TrimSpace(master.Avatar)
	if avatar == "" {
		avatar = strings.TrimSpace(source.Avatar)
	}
	designerBio := strings.TrimSpace(master.DesignerBio)
	if designerBio == "" {
		designerBio = strings.TrimSpace(source.DesignerBio)
	}
	specialtyStyles := strings.TrimSpace(master.SpecialtyStyles)
	if specialtyStyles == "" {
		specialtyStyles = strings.TrimSpace(source.SpecialtyStyles)
	}
	serviceTitle := strings.TrimSpace(master.ServiceTitle)
	if serviceTitle == "" {
		serviceTitle = strings.TrimSpace(source.ServiceTitle)
	}
	serviceQuote := master.ServiceQuote
	if serviceQuote <= 0 && source.ServiceQuote > 0 {
		serviceQuote = source.ServiceQuote
	}
	serviceIntro := strings.TrimSpace(master.ServiceIntro)
	if serviceIntro == "" {
		serviceIntro = strings.TrimSpace(source.ServiceIntro)
	}
	designerExperienceYears := master.DesignerExperienceYears
	if designerExperienceYears <= 0 && source.DesignerExperienceYears > 0 {
		designerExperienceYears = source.DesignerExperienceYears
	}
	designerVisible := master.DesignerVisible || source.DesignerVisible
	serviceEnabled := master.ServiceEnabled || source.ServiceEnabled
	hasPassword := master.HasPassword || source.HasPassword
	enterpriseWechatVerified := master.EnterpriseWechatVerified || source.EnterpriseWechatVerified
	phone := strings.TrimSpace(master.Phone)
	if phone == "" {
		phone = strings.TrimSpace(source.Phone)
	}
	enterpriseWechatContact := strings.TrimSpace(master.EnterpriseWechatContact)
	if enterpriseWechatContact == "" {
		enterpriseWechatContact = strings.TrimSpace(source.EnterpriseWechatContact)
	}
	var enterpriseWechatVerifiedAt interface{}
	if master.EnterpriseWechatVerifiedAt != nil {
		enterpriseWechatVerifiedAt = *master.EnterpriseWechatVerifiedAt
	} else if source.EnterpriseWechatVerifiedAt != nil {
		enterpriseWechatVerifiedAt = *source.EnterpriseWechatVerifiedAt
	}

	if _, err := tx.Exec(`UPDATE user_profiles
		SET nickname = ?, avatar = ?, designer_bio = ?, specialty_styles = ?, designer_experience_years = ?,
		    service_title = ?, service_quote = ?, service_intro = ?, service_enabled = ?, designer_visible = ?,
		    enterprise_wechat_verified = ?, enterprise_wechat_verified_at = ?, phone = ?, enterprise_wechat_contact = ?, has_password = ?, updated_at = NOW()
		WHERE user_id = ?`,
		nickname, avatar, designerBio, specialtyStyles, designerExperienceYears,
		serviceTitle, serviceQuote, serviceIntro, designerVisibleBoolToInt(serviceEnabled), designerVisibleBoolToInt(designerVisible),
		designerVisibleBoolToInt(enterpriseWechatVerified), enterpriseWechatVerifiedAt, phone, enterpriseWechatContact, designerVisibleBoolToInt(hasPassword), masterUserID); err != nil {
		return err
	}
	_, err := tx.Exec(`DELETE FROM user_profiles WHERE user_id = ?`, sourceUserID)
	return err
}

func designerVisibleBoolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
