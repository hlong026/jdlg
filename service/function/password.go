package function

import (
	"crypto/md5"
	"encoding/hex"
)

// HashPassword 密码加密（使用MD5，生产环境建议使用bcrypt）
func HashPassword(password string) string {
	hash := md5.Sum([]byte(password + "jiadilinguang_salt"))
	return hex.EncodeToString(hash[:])
}

// VerifyPassword 验证密码
func VerifyPassword(password, hashedPassword string) bool {
	return HashPassword(password) == hashedPassword
}
