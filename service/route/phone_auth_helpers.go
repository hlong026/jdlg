package route

import (
	"context"
	"fmt"
	"strings"
	"time"

	"service/component"
	"service/config"
	"service/model"
)

func normalizeCNPhoneWithPrefix(phone string) (string, error) {
	normalized := model.NormalizePhoneForClient(phone)
	if len(normalized) != 11 {
		return "", fmt.Errorf("手机号格式不正确")
	}
	return "+86" + normalized, nil
}

func sendPhoneVerificationCode(scene, phone string) error {
	cfg := config.Get()
	if cfg == nil {
		return fmt.Errorf("系统配置未初始化")
	}
	templateID := strings.TrimSpace(cfg.TencentSMS.LoginTemplateID)
	if scene == model.PhoneVerificationSceneBind && strings.TrimSpace(cfg.TencentSMS.BindPhoneTemplateID) != "" {
		templateID = strings.TrimSpace(cfg.TencentSMS.BindPhoneTemplateID)
	}
	if templateID == "" {
		return fmt.Errorf("短信模板未配置")
	}

	codeStore := model.NewPhoneVerificationCodeRedisModel(component.GetRedis())
	code, err := codeStore.Create(
		scene,
		phone,
		cfg.TencentSMS.CodeTTLSeconds,
		cfg.TencentSMS.SendCooldownSeconds,
		cfg.TencentSMS.MaxDailySendPerPhone,
		time.Now(),
	)
	if err != nil {
		return err
	}

	fullPhone, err := normalizeCNPhoneWithPrefix(phone)
	if err != nil {
		return err
	}
	expireMinutes := cfg.TencentSMS.CodeTTLSeconds / 60
	if expireMinutes <= 0 {
		expireMinutes = 5
	}
	if err := component.SendTencentSMS(fullPhone, templateID, []string{code, fmt.Sprintf("%d", expireMinutes)}); err != nil {
		if redisClient := component.GetRedis(); redisClient != nil {
			ctx := context.Background()
			_ = redisClient.Del(ctx, "phone_code:"+scene+":"+phone).Err()
			_ = redisClient.Del(ctx, "phone_code_cooldown:"+scene+":"+phone).Err()
		}
		return err
	}
	return nil
}

func verifyPhoneVerificationCode(scene, phone, code string) error {
	cfg := config.Get()
	if cfg == nil {
		return fmt.Errorf("系统配置未初始化")
	}
	codeStore := model.NewPhoneVerificationCodeRedisModel(component.GetRedis())
	return codeStore.Verify(scene, phone, code, cfg.TencentSMS.MaxVerifyAttempts)
}
