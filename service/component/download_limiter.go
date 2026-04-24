package component

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"service/model"
)

// DownloadLimiter 模板下载限制检查器
type DownloadLimiter struct {
	DB  *model.MembershipPlanModel
	RDB *redis.Client
}

// NewDownloadLimiter 创建下载限制器
func NewDownloadLimiter(planModel *model.MembershipPlanModel, rdb *redis.Client) *DownloadLimiter {
	return &DownloadLimiter{DB: planModel, RDB: rdb}
}

// CheckDownloadAccess 检查用户是否可以下载模板
// 返回: (allowed bool, reason string, err error)
func (dl *DownloadLimiter) CheckDownloadAccess(userID int64, activeMembership *model.UserMembership) (bool, string, error) {
	if dl.RDB == nil || dl.DB == nil {
		return true, "", nil // 没有配置限制器时默认放行
	}
	if activeMembership == nil {
		return true, "", nil // 无会员时走原有逻辑，不额外限制
	}

	// 获取套餐配置
	plan, err := dl.DB.GetByCode(activeMembership.PlanCode)
	if err != nil || plan == nil {
		return true, "", nil // 找不到套餐配置时默认放行
	}

	ctx := context.Background()

	// 1. 检查下载有效期
	if plan.DownloadValidityDays > 0 && !activeMembership.GrantedAt.IsZero() {
		expiry := activeMembership.GrantedAt.Add(time.Duration(plan.DownloadValidityDays) * 24 * time.Hour)
		if time.Now().After(expiry) {
			return false, "下载有效期已过期", nil
		}
	}

	// 2. 检查累计下载量（查 template_unlocks 表计数）
	if plan.MaxTotalDownloads > 0 {
		count, err := dl.countUserUnlocks(userID)
		if err != nil {
			return false, "", fmt.Errorf("查询下载记录失败: %w", err)
		}
		if count >= int64(plan.MaxTotalDownloads) {
			return false, "累计下载次数已用完", nil
		}
	}

	// 3. 检查每日上限
	if plan.DailyDownloadLimit > 0 {
		today := time.Now().Format("20060102")
		dailyKey := fmt.Sprintf("template:dl:%d:%s", userID, today)
		count, err := dl.RDB.Get(ctx, dailyKey).Int64()
		if err != nil && err != redis.Nil {
			return false, "", fmt.Errorf("查询每日下载次数失败: %w", err)
		}
		if count >= int64(plan.DailyDownloadLimit) {
			return false, "今日下载次数已达上限", nil
		}
	}

	// 4. 频控（每分钟限制）
	if plan.RateLimitPerMinute > 0 {
		minuteKey := fmt.Sprintf("template:rl:%d:%d", userID, time.Now().Unix()/60)
		count, err := dl.RDB.Get(ctx, minuteKey).Int64()
		if err != nil && err != redis.Nil {
			return false, "", fmt.Errorf("查询请求频率失败: %w", err)
		}
		if count >= int64(plan.RateLimitPerMinute) {
			return false, "请求过于频繁，请稍后再试", nil
		}
	}

	return true, "", nil
}

// RecordDownload 记录一次下载（更新 Redis 计数器）
func (dl *DownloadLimiter) RecordDownload(userID int64) {
	if dl.RDB == nil {
		return
	}
	ctx := context.Background()

	// 每日计数器
	today := time.Now().Format("20060102")
	dailyKey := fmt.Sprintf("template:dl:%d:%s", userID, today)
	dl.RDB.Incr(ctx, dailyKey)
	// 设置过期时间到今天结束
	now := time.Now()
	endOfDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
	dl.RDB.Expire(ctx, dailyKey, endOfDay.Sub(now)+time.Second)

	// 每分钟计数器
	minuteKey := fmt.Sprintf("template:rl:%d:%d", userID, time.Now().Unix()/60)
	dl.RDB.Incr(ctx, minuteKey)
	dl.RDB.Expire(ctx, minuteKey, 2*time.Minute)
}

// countUserUnlocks 查询用户累计解锁/下载次数
func (dl *DownloadLimiter) countUserUnlocks(userID int64) (int64, error) {
	db := GetDB()
	if db == nil {
		return 0, nil
	}
	var count int64
	err := db.QueryRow("SELECT COUNT(*) FROM template_unlocks WHERE user_id = ?", userID).Scan(&count)
	return count, err
}

// parseDownloadCount 从 template_unlocks 表查询计数（辅助方法）
func parseDownloadCount(s string) int64 {
	n, _ := strconv.ParseInt(s, 10, 64)
	return n
}
