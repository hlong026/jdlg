package component

import (
	"fmt"
	"strings"

	tencentCommon "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	tencentProfile "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	tencentSMS "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/sms/v20210111"

	"service/config"
)

func SendTencentSMS(phone, templateID string, templateParams []string) error {
	cfg := config.Get()
	if cfg == nil {
		return fmt.Errorf("短信服务未初始化")
	}
	smsCfg := cfg.TencentSMS
	if strings.TrimSpace(smsCfg.SecretID) == "" ||
		strings.TrimSpace(smsCfg.SecretKey) == "" ||
		strings.TrimSpace(smsCfg.Region) == "" ||
		strings.TrimSpace(smsCfg.SdkAppID) == "" ||
		strings.TrimSpace(smsCfg.SignName) == "" ||
		strings.TrimSpace(templateID) == "" {
		return fmt.Errorf("腾讯云短信配置不完整")
	}

	clientProfile := tencentProfile.NewClientProfile()
	clientProfile.HttpProfile.Endpoint = "sms.tencentcloudapi.com"
	client, err := tencentSMS.NewClient(
		tencentCommon.NewCredential(smsCfg.SecretID, smsCfg.SecretKey),
		smsCfg.Region,
		clientProfile,
	)
	if err != nil {
		return fmt.Errorf("初始化腾讯云短信客户端失败: %w", err)
	}

	request := tencentSMS.NewSendSmsRequest()
	request.PhoneNumberSet = []*string{tencentCommon.StringPtr(phone)}
	request.SmsSdkAppId = tencentCommon.StringPtr(smsCfg.SdkAppID)
	request.SignName = tencentCommon.StringPtr(smsCfg.SignName)
	request.TemplateId = tencentCommon.StringPtr(templateID)
	if len(templateParams) > 0 {
		paramSet := make([]*string, 0, len(templateParams))
		for _, item := range templateParams {
			paramSet = append(paramSet, tencentCommon.StringPtr(item))
		}
		request.TemplateParamSet = paramSet
	}

	response, err := client.SendSms(request)
	if err != nil {
		return fmt.Errorf("发送短信失败: %w", err)
	}
	if response == nil || response.Response == nil || len(response.Response.SendStatusSet) == 0 {
		return fmt.Errorf("腾讯云短信返回为空")
	}
	status := response.Response.SendStatusSet[0]
	if status == nil {
		return fmt.Errorf("腾讯云短信状态为空")
	}
	code := ""
	if status.Code != nil {
		code = strings.TrimSpace(*status.Code)
	}
	message := ""
	if status.Message != nil {
		message = strings.TrimSpace(*status.Message)
	}
	if code != "Ok" {
		return fmt.Errorf("短信发送失败: %s %s", code, message)
	}
	return nil
}
