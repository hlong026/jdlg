import React, { useEffect, useState } from 'react';
import { FiMessageCircle, FiRefreshCw, FiSearch, FiUserCheck } from 'react-icons/fi';
import Layout from '../component/layout';
import {
    getCustomerLeadList,
    getCustomerLeadOverview,
    updateCustomerLeadStatus,
    type CustomerLeadItem,
    type CustomerLeadOverview,
} from '../api/customerLeads';
import './customerLeads.scss';

const FiSearchIcon = FiSearch as unknown as React.ComponentType<any>;
const FiRefreshCwIcon = FiRefreshCw as unknown as React.ComponentType<any>;
const FiMessageCircleIcon = FiMessageCircle as unknown as React.ComponentType<any>;
const FiUserCheckIcon = FiUserCheck as unknown as React.ComponentType<any>;

const defaultOverview: CustomerLeadOverview = {
    total_count: 0,
    new_count: 0,
    contacted_count: 0,
    high_intent_count: 0,
    converted_count: 0,
};

const statusLabelMap: Record<string, string> = {
    new: '新线索',
    contacted: '已联系',
    converted: '已成交',
    invalid: '无效',
};

const intentLabelMap: Record<string, string> = {
    low: '低意向',
    medium: '中意向',
    high: '高意向',
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN');
};

const getDisplayName = (item: CustomerLeadItem) => {
    return item.name?.trim() || (item.user_id ? `用户${item.user_id}` : '匿名用户');
};

const CustomerLeads: React.FC = () => {
    const [overview, setOverview] = useState<CustomerLeadOverview>(defaultOverview);
    const [list, setList] = useState<CustomerLeadItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [intentFilter, setIntentFilter] = useState('all');
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = {
                page: 1,
                page_size: 50,
                keyword,
                status: statusFilter === 'all' ? undefined : statusFilter,
                intent_level: intentFilter === 'all' ? undefined : intentFilter,
            };
            const [overviewData, listData] = await Promise.all([
                getCustomerLeadOverview(),
                getCustomerLeadList(params),
            ]);
            setOverview(overviewData);
            setList(listData.list || []);
        } catch (error) {
            console.error('加载客服线索失败', error);
            window.alert(error instanceof Error ? error.message : '加载客服线索失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [keyword, statusFilter, intentFilter]);

    const handleSearch = () => {
        setKeyword(searchInput.trim());
    };

    const handleStatusChange = async (item: CustomerLeadItem, status: string) => {
        setUpdatingId(item.id);
        try {
            await updateCustomerLeadStatus(String(item.id), status);
            await loadData();
        } catch (error) {
            console.error('更新线索状态失败', error);
            window.alert(error instanceof Error ? error.message : '更新线索状态失败');
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <Layout title="客服线索">
            <div className="customer-lead-page">
                <div className="customer-lead-stats">
                    <div className="customer-lead-stat">
                        <FiMessageCircleIcon />
                        <span>总线索</span>
                        <strong>{overview.total_count}</strong>
                    </div>
                    <div className="customer-lead-stat">
                        <FiUserCheckIcon />
                        <span>新线索</span>
                        <strong>{overview.new_count}</strong>
                    </div>
                    <div className="customer-lead-stat">
                        <FiMessageCircleIcon />
                        <span>高意向</span>
                        <strong>{overview.high_intent_count}</strong>
                    </div>
                    <div className="customer-lead-stat">
                        <FiUserCheckIcon />
                        <span>已成交</span>
                        <strong>{overview.converted_count}</strong>
                    </div>
                </div>

                <section className="customer-lead-panel">
                    <div className="customer-lead-toolbar">
                        <div className="customer-lead-search">
                            <FiSearchIcon />
                            <input
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleSearch();
                                }}
                                placeholder="搜索用户名、需求、微信、电话"
                            />
                        </div>
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="all">全部状态</option>
                            <option value="new">新线索</option>
                            <option value="contacted">已联系</option>
                            <option value="converted">已成交</option>
                            <option value="invalid">无效</option>
                        </select>
                        <select value={intentFilter} onChange={(event) => setIntentFilter(event.target.value)}>
                            <option value="all">全部意向</option>
                            <option value="high">高意向</option>
                            <option value="medium">中意向</option>
                            <option value="low">低意向</option>
                        </select>
                        <button type="button" className="customer-lead-btn" onClick={handleSearch}>
                            <FiSearchIcon />
                            查询
                        </button>
                        <button type="button" className="customer-lead-btn secondary" onClick={loadData} disabled={loading}>
                            <FiRefreshCwIcon />
                            刷新
                        </button>
                    </div>

                    <div className="customer-lead-table-wrap">
                        <table className="customer-lead-table">
                            <thead>
                                <tr>
                                    <th>用户</th>
                                    <th>需求摘要</th>
                                    <th>来源</th>
                                    <th>意向</th>
                                    <th>状态</th>
                                    <th>创建时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <strong>{getDisplayName(item)}</strong>
                                            <span>ID：{item.user_id || '-'}</span>
                                        </td>
                                        <td className="customer-lead-demand">
                                            <strong>{item.demand_summary || '暂无需求摘要'}</strong>
                                            {item.wechat || item.enterprise_wechat_contact || item.phone ? (
                                                <span>{[item.wechat, item.enterprise_wechat_contact, item.phone].filter(Boolean).join(' / ')}</span>
                                            ) : null}
                                        </td>
                                        <td>
                                            <strong>{item.source || '-'}</strong>
                                            <span>{item.source_task_no || item.session_no || '-'}</span>
                                        </td>
                                        <td>
                                            <span className={`intent-tag intent-${item.intent_level}`}>
                                                {intentLabelMap[item.intent_level] || item.intent_level || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-tag status-${item.status}`}>
                                                {statusLabelMap[item.status] || item.status || '-'}
                                            </span>
                                        </td>
                                        <td>{formatDateTime(item.created_at)}</td>
                                        <td>
                                            <select
                                                value={item.status || 'new'}
                                                disabled={updatingId === item.id}
                                                onChange={(event) => handleStatusChange(item, event.target.value)}
                                            >
                                                <option value="new">新线索</option>
                                                <option value="contacted">已联系</option>
                                                <option value="converted">已成交</option>
                                                <option value="invalid">无效</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && list.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="customer-lead-empty">暂无客服线索</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </Layout>
    );
};

export default CustomerLeads;
