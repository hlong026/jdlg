import { get, post } from '../utils/request';
import { API_ENDPOINTS } from '../config/api';
import { tokenUtils } from '../utils/token';

// 登录请求
export interface LoginRequest {
    username: string;
    password: string;
}

// 登录响应
export interface LoginResponse {
    id: number;
    username: string;
}

// 登录
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, data);
    if (response.data) {
        // 后端使用 session cookie，不需要存储 token
        // 但为了兼容性，可以设置一个标识
        tokenUtils.setToken('session_active');
        return response.data;
    }
    throw new Error(response.msg || response.message || '登录失败');
};

// 登出
export const logout = async (): Promise<void> => {
    try {
        await post(API_ENDPOINTS.AUTH.LOGOUT);
    } finally {
        tokenUtils.removeToken();
    }
};

// 获取当前用户信息
export const getMe = async (): Promise<LoginResponse> => {
    const response = await get<LoginResponse>(API_ENDPOINTS.AUTH.ME);
    if (response.data) {
        return response.data;
    }
    throw new Error(response.msg || response.message || '获取用户信息失败');
};
