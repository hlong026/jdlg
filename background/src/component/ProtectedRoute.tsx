import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { tokenUtils } from '../utils/token';
import { getMe } from '../api/auth';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            // 如果没有 token 标识，直接跳转
            if (!tokenUtils.hasToken()) {
                setIsAuthenticated(false);
                return;
            }

            // 尝试获取用户信息验证 session
            try {
                await getMe();
                setIsAuthenticated(true);
            } catch (error) {
                // Session 无效，清除 token 并跳转登录
                tokenUtils.removeToken();
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

    // 等待验证完成
    if (isAuthenticated === null) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>验证中...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
