package route

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"service/model"
)

func parseCustomerLeadPageParams(c *gin.Context) (int, int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize, (page - 1) * pageSize
}

func RegisterCustomerServiceRoutes(r *gin.RouterGroup, customerServiceModel *model.CustomerServiceModel) {
	group := r.Group("/customer-service")

	group.POST("/events", func(c *gin.Context) {
		if customerServiceModel == nil || customerServiceModel.DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "智能客服服务不可用"})
			return
		}
		codeSession := GetTokenCodeSession(c)
		if codeSession == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未通过token验证"})
			return
		}
		var req struct {
			LeadID        int64                  `json:"lead_id"`
			SessionNo     string                 `json:"session_no"`
			EventType     string                 `json:"event_type" binding:"required"`
			Source        string                 `json:"source"`
			SourceTaskNo  string                 `json:"source_task_no"`
			IntentLevel   string                 `json:"intent_level"`
			DemandSummary string                 `json:"demand_summary"`
			Payload       map[string]interface{} `json:"payload"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": FormatValidationError("参数错误: " + err.Error())})
			return
		}
		id, err := customerServiceModel.CreateEvent(&model.CustomerServiceEventCreateInput{
			UserID:        codeSession.UserID,
			LeadID:        req.LeadID,
			SessionNo:     req.SessionNo,
			EventType:     req.EventType,
			Source:        req.Source,
			SourceTaskNo:  req.SourceTaskNo,
			IntentLevel:   req.IntentLevel,
			DemandSummary: req.DemandSummary,
			Payload:       req.Payload,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "记录智能客服事件失败: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": gin.H{"id": id}})
	})

	group.POST("/leads", func(c *gin.Context) {
		if customerServiceModel == nil || customerServiceModel.DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "智能客服服务不可用"})
			return
		}
		codeSession := GetTokenCodeSession(c)
		if codeSession == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未通过token验证"})
			return
		}
		var req struct {
			Name                    string                 `json:"name"`
			Phone                   string                 `json:"phone"`
			Wechat                  string                 `json:"wechat"`
			EnterpriseWechatContact string                 `json:"enterprise_wechat_contact"`
			DemandSummary           string                 `json:"demand_summary" binding:"required"`
			HouseFloors             string                 `json:"house_floors"`
			HouseStyle              string                 `json:"house_style"`
			LandWidth               string                 `json:"land_width"`
			LandDepth               string                 `json:"land_depth"`
			RoomRequirement         string                 `json:"room_requirement"`
			Source                  string                 `json:"source"`
			SourceTaskNo            string                 `json:"source_task_no"`
			IntentLevel             string                 `json:"intent_level"`
			Status                  string                 `json:"status"`
			Remark                  string                 `json:"remark"`
			SessionNo               string                 `json:"session_no"`
			Payload                 map[string]interface{} `json:"payload"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": FormatValidationError("参数错误: " + err.Error())})
			return
		}
		source := strings.TrimSpace(req.Source)
		if source == "" {
			source = "customer_service"
		}
		id, err := customerServiceModel.CreateLead(&model.CustomerLeadCreateInput{
			UserID:                  codeSession.UserID,
			Name:                    req.Name,
			Phone:                   req.Phone,
			Wechat:                  req.Wechat,
			EnterpriseWechatContact: req.EnterpriseWechatContact,
			DemandSummary:           req.DemandSummary,
			HouseFloors:             req.HouseFloors,
			HouseStyle:              req.HouseStyle,
			LandWidth:               req.LandWidth,
			LandDepth:               req.LandDepth,
			RoomRequirement:         req.RoomRequirement,
			Source:                  source,
			SourceTaskNo:            req.SourceTaskNo,
			IntentLevel:             req.IntentLevel,
			Status:                  req.Status,
			Remark:                  req.Remark,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "创建客服线索失败: " + err.Error()})
			return
		}
		_, _ = customerServiceModel.CreateEvent(&model.CustomerServiceEventCreateInput{
			UserID:        codeSession.UserID,
			LeadID:        id,
			SessionNo:     req.SessionNo,
			EventType:     "lead_submit",
			Source:        source,
			SourceTaskNo:  req.SourceTaskNo,
			IntentLevel:   req.IntentLevel,
			DemandSummary: req.DemandSummary,
			Payload:       req.Payload,
		})
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": gin.H{"id": id}})
	})
}

func RegisterCustomerLeadManagementRoutes(r *gin.RouterGroup, customerServiceModel *model.CustomerServiceModel) {
	leads := r.Group("/customer-leads")

	leads.GET("/overview", func(c *gin.Context) {
		if customerServiceModel == nil || customerServiceModel.DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "客服线索服务不可用"})
			return
		}
		overview, err := customerServiceModel.Overview()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "获取客服线索概览失败: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": overview})
	})

	leads.GET("", func(c *gin.Context) {
		if customerServiceModel == nil || customerServiceModel.DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "客服线索服务不可用"})
			return
		}
		page, pageSize, offset := parseCustomerLeadPageParams(c)
		list, total, err := customerServiceModel.ListLeads(model.CustomerLeadListParams{
			Keyword:     c.Query("keyword"),
			Status:      c.DefaultQuery("status", "all"),
			IntentLevel: c.DefaultQuery("intent_level", "all"),
			Source:      c.DefaultQuery("source", "all"),
			Limit:       pageSize,
			Offset:      offset,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "获取客服线索列表失败: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": gin.H{"list": list, "total": total, "page": page, "page_size": pageSize}})
	})

	leads.POST("/:id/status", func(c *gin.Context) {
		if customerServiceModel == nil || customerServiceModel.DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "客服线索服务不可用"})
			return
		}
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效的线索ID"})
			return
		}
		var req struct {
			Status string `json:"status" binding:"required"`
			Remark string `json:"remark"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": FormatValidationError("参数错误: " + err.Error())})
			return
		}
		if err := customerServiceModel.UpdateLeadStatus(id, req.Status, req.Remark); err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "线索不存在"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "更新客服线索状态失败: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success"})
	})
}
