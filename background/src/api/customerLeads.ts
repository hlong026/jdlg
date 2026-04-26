import { get, post } from '../utils/request';
import { API_ENDPOINTS } from '../config/api';

export interface CustomerLeadOverview {
    total_count: number;
    new_count: number;
    contacted_count: number;
    high_intent_count: number;
    converted_count: number;
}

export interface CustomerLeadItem {
    id: number;
    user_id: number;
    name?: string;
    phone?: string;
    wechat?: string;
    enterprise_wechat_contact?: string;
    session_no: string;
    source: string;
    source_task_no?: string;
    demand_summary: string;
    intent_level: 'low' | 'medium' | 'high' | string;
    status: 'new' | 'contacted' | 'converted' | 'invalid' | string;
    remark?: string;
    created_at: string;
    updated_at: string;
}

export interface CustomerLeadListParams {
    keyword?: string;
    status?: string;
    intent_level?: string;
    page?: number;
    page_size?: number;
}

export interface CustomerLeadListResponse {
    list: CustomerLeadItem[];
    total: number;
    page: number;
    page_size: number;
}

export const getCustomerLeadOverview = async (): Promise<CustomerLeadOverview> => {
    const response = await get<CustomerLeadOverview>(API_ENDPOINTS.CUSTOMER_LEADS.OVERVIEW);
    if (!response.data) {
        throw new Error('获取客服线索概览失败');
    }
    return response.data;
};

export const getCustomerLeadList = async (params?: CustomerLeadListParams): Promise<CustomerLeadListResponse> => {
    const response = await get<CustomerLeadListResponse>(API_ENDPOINTS.CUSTOMER_LEADS.LIST, params as Record<string, any>);
    if (!response.data) {
        throw new Error('获取客服线索列表失败');
    }
    return response.data;
};

export const updateCustomerLeadStatus = async (id: string, status: string): Promise<void> => {
    await post(API_ENDPOINTS.CUSTOMER_LEADS.STATUS(id), { status });
};
