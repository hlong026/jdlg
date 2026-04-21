package model

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	PhoneVerificationSceneLogin = "login"
	PhoneVerificationSceneBind  = "bind_phone"
)

type PhoneVerificationCodeRedisModel struct {
	Redis *redis.Client
	ctx   context.Context
}

func NewPhoneVerificationCodeRedisModel(rdb *redis.Client) *PhoneVerificationCodeRedisModel {
	return &PhoneVerificationCodeRedisModel{
		Redis: rdb,
		ctx:   context.Background(),
	}
}

func randomSMSCode() string {
	max := big.NewInt(900000)
	value, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "123456"
	}
	return strconv.Itoa(int(value.Int64()) + 100000)
}

func phoneCodeKey(scene, phone string) string {
	return "phone_code:" + strings.TrimSpace(scene) + ":" + NormalizePhoneForClient(phone)
}

func phoneCooldownKey(scene, phone string) string {
	return "phone_code_cooldown:" + strings.TrimSpace(scene) + ":" + NormalizePhoneForClient(phone)
}

func phoneDailyCounterKey(scene, phone string, now time.Time) string {
	return fmt.Sprintf("phone_code_daily:%s:%s:%s", strings.TrimSpace(scene), NormalizePhoneForClient(phone), now.Format("20060102"))
}

func (m *PhoneVerificationCodeRedisModel) EnsureCanSend(scene, phone string, cooldownSeconds, maxDaily int64, now time.Time) error {
	if m == nil || m.Redis == nil {
		return fmt.Errorf("redis 不可用")
	}
	phone = NormalizePhoneForClient(phone)
	if phone == "" {
		return fmt.Errorf("手机号无效")
	}
	if cooldownSeconds > 0 {
		exists, err := m.Redis.Exists(m.ctx, phoneCooldownKey(scene, phone)).Result()
		if err != nil {
			return err
		}
		if exists > 0 {
			return fmt.Errorf("验证码发送过于频繁，请稍后再试")
		}
	}
	if maxDaily > 0 {
		count, err := m.Redis.Get(m.ctx, phoneDailyCounterKey(scene, phone, now)).Int64()
		if err != nil && err != redis.Nil {
			return err
		}
		if count >= maxDaily {
			return fmt.Errorf("今日验证码发送次数已达上限")
		}
	}
	return nil
}

func (m *PhoneVerificationCodeRedisModel) Create(scene, phone string, ttlSeconds, cooldownSeconds, maxDaily int64, now time.Time) (string, error) {
	if m == nil || m.Redis == nil {
		return "", fmt.Errorf("redis 不可用")
	}
	if err := m.EnsureCanSend(scene, phone, cooldownSeconds, maxDaily, now); err != nil {
		return "", err
	}

	phone = NormalizePhoneForClient(phone)
	if phone == "" {
		return "", fmt.Errorf("手机号无效")
	}
	if ttlSeconds <= 0 {
		ttlSeconds = 300
	}

	code := randomSMSCode()
	key := phoneCodeKey(scene, phone)
	payload := code + "|0"
	if err := m.Redis.Set(m.ctx, key, payload, time.Duration(ttlSeconds)*time.Second).Err(); err != nil {
		return "", err
	}
	if cooldownSeconds > 0 {
		if err := m.Redis.Set(m.ctx, phoneCooldownKey(scene, phone), "1", time.Duration(cooldownSeconds)*time.Second).Err(); err != nil {
			return "", err
		}
	}
	dailyKey := phoneDailyCounterKey(scene, phone, now)
	if err := m.Redis.Incr(m.ctx, dailyKey).Err(); err != nil {
		return "", err
	}
	_ = m.Redis.Expire(m.ctx, dailyKey, 24*time.Hour)
	return code, nil
}

func (m *PhoneVerificationCodeRedisModel) Verify(scene, phone, code string, maxAttempts int64) error {
	if m == nil || m.Redis == nil {
		return fmt.Errorf("redis 不可用")
	}
	phone = NormalizePhoneForClient(phone)
	code = strings.TrimSpace(code)
	if phone == "" || code == "" {
		return fmt.Errorf("手机号或验证码不能为空")
	}
	key := phoneCodeKey(scene, phone)
	payload, err := m.Redis.Get(m.ctx, key).Result()
	if err == redis.Nil {
		return fmt.Errorf("验证码已失效，请重新获取")
	}
	if err != nil {
		return err
	}

	parts := strings.Split(payload, "|")
	storedCode := ""
	attempts := int64(0)
	if len(parts) > 0 {
		storedCode = strings.TrimSpace(parts[0])
	}
	if len(parts) > 1 {
		if parsed, parseErr := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64); parseErr == nil {
			attempts = parsed
		}
	}

	if maxAttempts > 0 && attempts >= maxAttempts {
		_ = m.Redis.Del(m.ctx, key).Err()
		return fmt.Errorf("验证码尝试次数过多，请重新获取")
	}

	if storedCode != code {
		attempts++
		ttl, _ := m.Redis.TTL(m.ctx, key).Result()
		if ttl <= 0 {
			ttl = 5 * time.Minute
		}
		_ = m.Redis.Set(m.ctx, key, storedCode+"|"+strconv.FormatInt(attempts, 10), ttl).Err()
		if maxAttempts > 0 && attempts >= maxAttempts {
			_ = m.Redis.Del(m.ctx, key).Err()
		}
		return fmt.Errorf("验证码错误")
	}

	_ = m.Redis.Del(m.ctx, key).Err()
	return nil
}
