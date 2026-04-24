package route

import (
	"github.com/gin-gonic/gin"
	"service/component"
	"service/config"
	"service/model"
	"service/processor"
)

// RegisterRoutes 注册所有路由
func RegisterRoutes(r *gin.Engine, authProcessor *processor.AuthProcessor,
	codeSessionModel *model.CodeSessionRedisModel,
	userModel *model.UserRedisModel,
	pricingModel *model.AIPricingModel,
	taskModel *model.AITaskModel,
	apiConfigModel *model.AIAPIConfigModel,
	templateModel *model.TemplateModel,
	inspirationModel *model.InspirationAssetModel,
	templateCategoryModel *model.TemplateCategoryModel,
	templateSquareConfigModel *model.TemplateSquareConfigModel,
	templateUnlockModel *model.TemplateUnlockModel,
	templateLikeModel *model.TemplateLikeModel,
	templateCommentModel *model.TemplateCommentModel,
	templateShareModel *model.TemplateShareModel,
	userProfileModel *model.UserProfileModel,
	stoneRecordModel *model.StoneRecordModel,
	userOrderModel *model.UserOrderModel,
	inviteRelationModel *model.InviteRelationModel,
	userInviteCodeModel *model.UserInviteCodeModel,
	featuredCaseGroupModel *model.FeaturedCaseGroupModel,
	utilityToolModel *model.UtilityToolModel,
	aiToolModel *model.AIToolModel,
	rechargeConfigModel *model.RechargeConfigModel,
	membershipPlanModel *model.MembershipPlanModel,
	userMembershipModel *model.UserMembershipModel,
	supportTicketModel *model.SupportTicketModel,
	videoTaskModel *model.AIVideoTaskModel,
	certificationApplicationModel *model.CertificationApplicationModel,
	designerReviewModel *model.DesignerReviewModel,
	designerFollowModel *model.DesignerFollowModel,
	cfg *config.Config) {
	// 健康检查
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"code": 0,
			"msg":  "ok",
		})
	})

	// API v1路由组
	v1 := r.Group("/api/v1")
	{
		// 用户DB模型（共用）
		userDBModel := model.NewUserModel(component.GetDB())
		userFavoriteModel := model.NewUserFavoriteModel(component.GetDB())
		_ = userFavoriteModel.InitTable()
		setSharedTemplateSquareConfigModel(templateSquareConfigModel)

		// 小程序API
		miniprogram := v1.Group("/miniprogram")
		RegisterMiniprogramRoutes(miniprogram, authProcessor, codeSessionModel, userModel, stoneRecordModel, inviteRelationModel, userDBModel, userInviteCodeModel, userProfileModel, aiToolModel, templateSquareConfigModel)
		RegisterAIPublicRoutes(miniprogram, pricingModel)
		// 签到接口（简化token认证）
		checkinModel := model.NewCheckinModel(component.GetDB())
		RegisterCheckinRoutes(miniprogram, codeSessionModel, checkinModel, userModel, stoneRecordModel)
		// AI接口（需要token验证）
		miniprogramAI := miniprogram.Group("")
		miniprogramAI.Use(TokenAuthRequired(codeSessionModel))
		RegisterAIRoutes(miniprogramAI, codeSessionModel, userModel, pricingModel, taskModel, stoneRecordModel, userOrderModel, inviteRelationModel, aiToolModel, templateModel, templateUnlockModel)
		RegisterRuralVillaDesignRoutes(miniprogramAI, codeSessionModel, userModel, pricingModel, taskModel, stoneRecordModel, userOrderModel, inviteRelationModel)
		RegisterAllroundDesignRoutes(miniprogramAI, codeSessionModel, userModel, pricingModel, taskModel, stoneRecordModel, userOrderModel, inviteRelationModel)
		RegisterBuildingReplacementRoutes(miniprogramAI, codeSessionModel, userModel, pricingModel, taskModel, stoneRecordModel, userOrderModel, inviteRelationModel)
		RegisterParentChildDesignRoutes(miniprogramAI, codeSessionModel, userModel, pricingModel, taskModel, stoneRecordModel, userOrderModel, inviteRelationModel)
		// AI造价接口（需要token验证）
		RegisterAICostRoutes(miniprogramAI, codeSessionModel, userModel, pricingModel, taskModel, stoneRecordModel, userOrderModel, inviteRelationModel, cfg)
		// AI任务信息接口（需要token验证）
		RegisterAITaskInfoRoutes(miniprogramAI, codeSessionModel, taskModel)
		// AI流式聊天接口（需要token验证）
		RegisterAIChatStreamRoute(miniprogramAI, codeSessionModel, userModel, pricingModel, apiConfigModel, cfg)
		// 任务状态轮询接口（需要token验证）
		RegisterTaskStatusRoute(miniprogramAI, codeSessionModel, userModel, pricingModel, taskModel, videoTaskModel, stoneRecordModel, aiToolModel, cfg)
		// AI 生成视频：发起、轮询、查询（结果存自家 OSS）
		RegisterAIVideoRoutes(miniprogramAI, codeSessionModel, userModel, pricingModel, stoneRecordModel, videoTaskModel, supportTicketModel, cfg)
		// 微信支付：JSAPI 预支付（需 token）、提现（需 token）、支付结果回调（v1 组下无需 token，含认证费回调）
		RegisterWechatPayRoutes(miniprogramAI, v1, cfg, userOrderModel, stoneRecordModel, userModel, userDBModel, certificationApplicationModel, membershipPlanModel, userMembershipModel)
		// 认证申请（个人设计师/企业）：提交时支付认证费，支付成功后工单进入管理员审核
		RegisterCertificationRoutes(miniprogramAI, codeSessionModel, userDBModel, certificationApplicationModel, cfg, userOrderModel)
		// 用户数据接口（简化token认证，不需要签名参数）
		RegisterUserDataRoutes(miniprogram, codeSessionModel, userModel, pricingModel, taskModel, videoTaskModel, stoneRecordModel, userOrderModel, inviteRelationModel, userDBModel, templateModel, userProfileModel, userInviteCodeModel, certificationApplicationModel, designerReviewModel, designerFollowModel, aiToolModel, cfg)
		// 模板接口（公开接口，部分需要token验证）
		RegisterTemplateRoutes(miniprogram, templateModel, templateCategoryModel, templateSquareConfigModel, templateUnlockModel, templateLikeModel, templateCommentModel, templateShareModel, codeSessionModel, userModel, pricingModel, stoneRecordModel, userOrderModel, userProfileModel, userMembershipModel, userDBModel, featuredCaseGroupModel, taskModel, aiToolModel)
		RegisterInspirationRoutes(miniprogram, inspirationModel)
		RegisterFavoriteRoutes(miniprogram, codeSessionModel, userFavoriteModel, templateLikeModel, templateModel, inspirationModel, aiToolModel, userProfileModel, userDBModel)
		// 用户信息修改接口
		RegisterUserProfileRoutes(miniprogram, codeSessionModel, userDBModel, userProfileModel)
		// 充值配置接口（公开接口）
		RegisterRechargeConfigRoutes(miniprogram, rechargeConfigModel, membershipPlanModel, cfg)
		RegisterMembershipRoutes(miniprogram, codeSessionModel, membershipPlanModel, userMembershipModel, userOrderModel)
		RegisterAIToolRoutes(miniprogram, aiToolModel)

		// 管理后台API
		management := v1.Group("/management")
		// 登录接口不需要认证
		RegisterManagementRoutes(management, authProcessor, userDBModel, userModel, userProfileModel, stoneRecordModel)

		// 需要认证的管理接口
		managementAuth := management.Group("")
		managementAuth.Use(AuthRequired)
		RegisterDashboardManagementRoutes(managementAuth, userDBModel)
		RegisterAIManagementRoutes(managementAuth, pricingModel, apiConfigModel)
		RegisterAITaskManagementRoutes(managementAuth, pricingModel, taskModel, videoTaskModel, supportTicketModel)
		RegisterUserWorkbenchManagementRoutes(managementAuth, userDBModel, userModel, userProfileModel, stoneRecordModel, userOrderModel, userMembershipModel, taskModel, videoTaskModel, pricingModel)
		RegisterOrderManagementRoutes(managementAuth, userOrderModel, userDBModel, certificationApplicationModel, userMembershipModel, supportTicketModel)
		RegisterDesignerManagementRoutes(managementAuth, userDBModel, templateModel, userProfileModel, certificationApplicationModel, stoneRecordModel, userOrderModel, designerReviewModel, designerFollowModel)
		RegisterDistributionManagementRoutes(managementAuth, userDBModel, inviteRelationModel, userInviteCodeModel, stoneRecordModel, userOrderModel)
		RegisterContentAnalyticsManagementRoutes(managementAuth, templateModel)
		RegisterRiskControlManagementRoutes(managementAuth, userDBModel)
		RegisterReportCenterManagementRoutes(managementAuth, userDBModel)
		RegisterTemplateManagementRoutes(managementAuth, templateModel, templateCategoryModel, templateSquareConfigModel, featuredCaseGroupModel)
		RegisterInspirationManagementRoutes(managementAuth, inspirationModel)
		RegisterUtilityToolManagementRoutes(managementAuth, utilityToolModel)
		RegisterAIToolManagementRoutes(managementAuth, aiToolModel, taskModel)
		RegisterRechargeConfigManagementRoutes(managementAuth, rechargeConfigModel)
		RegisterMembershipManagementRoutes(managementAuth, membershipPlanModel)
		RegisterMembershipOperationsManagementRoutes(managementAuth, userDBModel, userProfileModel, userMembershipModel, userOrderModel)
		RegisterSupportTicketManagementRoutes(managementAuth, supportTicketModel)
		// 认证工单管理：列表、详情、审核（通过/拒绝），通过后更新用户 can_withdraw
		RegisterCertificationManagementRoutes(managementAuth, certificationApplicationModel, userDBModel, userProfileModel)

		// 小程序实用工具接口（公开接口）
		RegisterUtilityToolRoutes(miniprogram, utilityToolModel)
	}
}
