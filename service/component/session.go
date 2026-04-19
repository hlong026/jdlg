package component

import (
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/redis"
	"service/config"
)

var SessionStore sessions.Store

// InitSessionStore 初始化基于Redis的session存储
func InitSessionStore(cfg *config.Config) (sessions.Store, error) {
	store, err := redis.NewStore(
		10,                        // 池大小
		"tcp",                     // 网络类型
		cfg.Redis.Addr,            // 地址
		"",                        // username (Redis 6.0+)
		cfg.Redis.Password,        // 密码
		[]byte(cfg.Server.SessionSecret), // 加密key
	)
	if err != nil {
		return nil, err
	}

	SessionStore = store
	return store, nil
}

// GetSessionStore 获取session存储
func GetSessionStore() sessions.Store {
	return SessionStore
}
