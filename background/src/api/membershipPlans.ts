import { get, post, del } from '../utils/request';
import { API_ENDPOINTS } from '../config/api';

export interface MembershipPlanItem {
    id: number;
    plan_code: string;
    title: string;
    description: string;
    badge_text: string;
    recharge_amount_fen: number;
    duration_days: number;
    template_download_enabled: boolean;
    is_enabled: boolean;
    sort_order: number;
    benefit_text?: string;
    created_at?: string;
    updated_at?: string;
}

export const getMembershipPlanList = async () => {
    const res = await get<{ list: MembershipPlanItem[] }>(API_ENDPOINTS.MEMBERSHIP_PLANS.LIST);
    return res.data!.list;
};

export const getMembershipPlan = async (id: string) => {
    const res = await get<MembershipPlanItem>(API_ENDPOINTS.MEMBERSHIP_PLANS.DETAIL(id));
    return res.data!;
};

export const createOrUpdateMembershipPlan = async (data: Partial<MembershipPlanItem>) => {
    const res = await post<MembershipPlanItem>(API_ENDPOINTS.MEMBERSHIP_PLANS.CREATE_OR_UPDATE, data);
    return res.data!;
};

export const deleteMembershipPlan = async (id: string) => {
    await del(API_ENDPOINTS.MEMBERSHIP_PLANS.DELETE(id));
};
