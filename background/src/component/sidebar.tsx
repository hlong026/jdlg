import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    FiHome,
    FiUsers,
    FiCompass,
    FiFileText,
    FiActivity,
    FiShare2,
    FiSettings,
    FiCloud,
    FiLayers,
    FiDollarSign,
    FiTool,
    FiUserCheck,
    FiImage,
    FiShield,
    FiBarChart2,
} from 'react-icons/fi';
import './sidebar.scss';

interface SidebarProps {
    collapsed?: boolean;
    mobile?: boolean;
    onNavigate?: () => void;
}

const menuSections = [
    {
        title: '经营驾驶舱',
        items: [
            { path: '/dashboard', label: '后台总控台', icon: FiHome },
            { path: '/users', label: '用户管理', icon: FiUsers },
            { path: '/user-workbench', label: '用户360工作台', icon: FiCompass },
            { path: '/recharge', label: '订单中心', icon: FiDollarSign },
            { path: '/ai-tasks', label: 'AI任务中心', icon: FiActivity },
            { path: '/support-tickets', label: '异常工单中心', icon: FiFileText },
        ],
    },
    {
        title: '用户与内容运营',
        items: [
            { path: '/certification', label: '资质认证与审核', icon: FiUserCheck },
            { path: '/designer-center', label: '设计师中心', icon: FiUsers },
            { path: '/membership-operations', label: '用户会员运营', icon: FiUserCheck },
            { path: '/distribution', label: '分销邀请中心', icon: FiShare2 },
            { path: '/templates', label: '模板广场管理', icon: FiLayers },
            { path: '/inspirations', label: '灵感素材审核', icon: FiImage },
            { path: '/content-analytics', label: '内容运营分析', icon: FiActivity },
        ],
    },
    {
        title: '风险与追踪',
        items: [
            { path: '/risk-control', label: '风控台', icon: FiShield },
            { path: '/report-center', label: '报表导出中心', icon: FiBarChart2 },
            { path: '/logs', label: '日志管理', icon: FiFileText },
        ],
    },
    {
        title: '低频配置',
        items: [
            { path: '/ai-config', label: 'AI配置', icon: FiSettings },
            { path: '/ai-tools', label: 'AI工具管理', icon: FiLayers },
            { path: '/recharge-config', label: '充值配置', icon: FiDollarSign },
            { path: '/membership-plans', label: '会员计划', icon: FiDollarSign },
            { path: '/oss', label: 'OSS管理', icon: FiCloud },
            { path: '/utility-tools', label: '实用工具管理', icon: FiTool },
        ],
    },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, mobile = false, onNavigate }) => {
    return (
        <aside className={`layout-sidebar ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile' : ''} ${mobile && !collapsed ? 'open' : ''}`}>
            <div className="sidebar-logo">
                <span className="logo-mark">AI</span>
                {!collapsed && <span className="logo-text">管理后台</span>}
            </div>

            <nav className="sidebar-menu">
                {menuSections.map((section) => (
                    <div key={section.title} className="sidebar-section">
                        {!collapsed && <div className="sidebar-section-title">{section.title}</div>}
                        <div className="sidebar-section-items">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <NavLink key={item.path} to={item.path} className="sidebar-item" onClick={onNavigate}>
                                        <Icon className="sidebar-icon" />
                                        {!collapsed && <span className="sidebar-label">{item.label}</span>}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
};

export default Sidebar;

