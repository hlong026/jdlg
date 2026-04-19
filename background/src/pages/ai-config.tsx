import React, { useMemo, useState, useEffect } from 'react';
import { FiSave, FiPlus, FiEdit, FiTrash2, FiSettings, FiX, FiClipboard, FiSearch } from 'react-icons/fi';
import Layout from '../component/layout';
import { getAIPricingList, saveAIPricing, getAIAPIConfigList, saveAIAPIConfig, type AIPricing, type AIAPIConfig } from '../api/ai';
import ManagementSearchPanel from '../component/managementSearchPanel';
import JSONTreeEditor from '../component/json-tree-editor';
import './ai-config.scss';

const AIConfig: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pricing' | 'api'>('pricing');
    const [pricings, setPricings] = useState<AIPricing[]>([]);
    const [apiConfigs, setApiConfigs] = useState<AIAPIConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [showAPIModal, setShowAPIModal] = useState(false);
    const [editingPricing, setEditingPricing] = useState<AIPricing | null>(null);
    const [editingAPIConfig, setEditingAPIConfig] = useState<AIAPIConfig | null>(null);

    // 加载数据
    useEffect(() => {
        loadPricings();
        loadAPIConfigs();
    }, []);

    const loadPricings = async () => {
        try {
            const data = await getAIPricingList();
            setPricings(data);
        } catch (error) {
            console.error('加载计费配置失败:', error);
            alert('加载计费配置失败');
        }
    };

    const loadAPIConfigs = async () => {
        try {
            const data = await getAIAPIConfigList();
            setApiConfigs(data);
        } catch (error) {
            console.error('加载API配置失败:', error);
            alert('加载API配置失败');
        }
    };

    const handleSavePricing = async (pricing: AIPricing) => {
        setLoading(true);
        try {
            await saveAIPricing(pricing);
            await loadPricings();
            setShowPricingModal(false);
            setEditingPricing(null);
            alert('保存成功');
        } catch (error: any) {
            alert('保存失败: ' + (error.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAPIConfig = async (config: AIAPIConfig) => {
        setLoading(true);
        try {
            await saveAIAPIConfig(config);
            await loadAPIConfigs();
            setShowAPIModal(false);
            setEditingAPIConfig(null);
            alert('保存成功');
        } catch (error: any) {
            alert('保存失败: ' + (error.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const filteredPricings = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) {
            return pricings;
        }
        return pricings.filter((item) => {
            const extraConfigText = typeof item.extra_config === 'string'
                ? item.extra_config
                : JSON.stringify(item.extra_config || {});
            return [item.scene, String(item.stones), extraConfigText]
                .some((field) => String(field || '').toLowerCase().includes(keyword));
        });
    }, [pricings, searchKeyword]);

    const filteredApiConfigs = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) {
            return apiConfigs;
        }
        return apiConfigs.filter((item) => {
            return [item.task_type, item.api_endpoint, item.method, item.prompt_path, item.image_path]
                .some((field) => String(field || '').toLowerCase().includes(keyword));
        });
    }, [apiConfigs, searchKeyword]);

    const handleSearch = () => {
        setSearchKeyword(searchInput.trim());
    };

    const handleReset = () => {
        setSearchInput('');
        setSearchKeyword('');
    };

    return (
        <Layout title="AI配置">
            <div className="ai-config-container">
                <ManagementSearchPanel
                    title={activeTab === 'pricing' ? 'AI 计费检索' : 'AI 接口检索'}
                    description={activeTab === 'pricing'
                        ? '按场景、灵石数量或额外配置快速找到需要调整的计费项。'
                        : '按任务类型、接口地址、请求方法或字段路径快速找到接口配置。'}
                    actions={(
                        <>
                            <button className="btn-secondary" onClick={handleReset}>重置筛选</button>
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    if (activeTab === 'pricing') {
                                        setEditingPricing(null);
                                        setShowPricingModal(true);
                                    } else {
                                        setEditingAPIConfig(null);
                                        setShowAPIModal(true);
                                    }
                                }}
                            >
                                <FiPlus />
                                {activeTab === 'pricing' ? '添加计费配置' : '添加接口配置'}
                            </button>
                        </>
                    )}
                    controls={(
                        <>
                            <div className="management-search-searchbox">
                                <FiSearch className="management-search-searchicon" />
                                <input
                                    type="text"
                                    className="management-search-input"
                                    placeholder={activeTab === 'pricing' ? '搜索场景、灵石数量、额外配置...' : '搜索任务类型、接口地址、方法、路径...'}
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                />
                            </div>
                            <button className="btn-primary" onClick={handleSearch}>搜索配置</button>
                        </>
                    )}
                    summary={(
                        <>
                            <div>
                                当前显示 <strong>{activeTab === 'pricing' ? filteredPricings.length : filteredApiConfigs.length}</strong> 条记录
                            </div>
                            <div className="management-search-tags">
                                <span className="management-search-tag">当前页：{activeTab === 'pricing' ? '计费配置' : '接口配置'}</span>
                                {searchKeyword ? <span className="management-search-tag">关键词：{searchKeyword}</span> : null}
                            </div>
                        </>
                    )}
                />

                <div className="config-tabs">
                    <button
                        className={`tab-button ${activeTab === 'pricing' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pricing')}
                    >
                        <FiSettings />
                        计费配置
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'api' ? 'active' : ''}`}
                        onClick={() => setActiveTab('api')}
                    >
                        <FiSettings />
                        API配置
                    </button>
                </div>

                {activeTab === 'pricing' && (
                    <div className="config-content">
                        <div className="config-header">
                            <h3>AI计费配置</h3>
                        </div>

                        <div className="config-table-container">
                            <table className="config-table">
                                <thead>
                                    <tr>
                                        <th>场景</th>
                                        <th>灵石数量</th>
                                        <th>额外配置</th>
                                        <th>更新时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPricings.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="empty-state">
                                                暂无配置，请添加
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPricings.map((pricing) => (
                                            <tr key={pricing.scene}>
                                                <td>{pricing.scene}</td>
                                                <td>{pricing.stones}</td>
                                                <td>
                                                    {pricing.extra_config ? (
                                                        <pre className="config-json">
                                                            {typeof pricing.extra_config === 'string'
                                                                ? pricing.extra_config
                                                                : JSON.stringify(pricing.extra_config, null, 2)}
                                                        </pre>
                                                    ) : '-'}
                                                </td>
                                                <td>{pricing.updated_at ? new Date(pricing.updated_at).toLocaleString('zh-CN') : '-'}</td>
                                                <td>
                                                    <button
                                                        className="btn-action btn-edit"
                                                        onClick={() => {
                                                            setEditingPricing(pricing);
                                                            setShowPricingModal(true);
                                                        }}
                                                    >
                                                        <FiEdit />
                                                        编辑
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'api' && (
                    <div className="config-content">
                        <div className="config-header">
                            <h3>AI API配置</h3>
                        </div>

                        <div className="config-table-container">
                            <table className="config-table">
                                <thead>
                                    <tr>
                                        <th>场景</th>
                                        <th>API地址</th>
                                        <th>请求方法</th>
                                        <th>提示词路径</th>
                                        <th>图片路径</th>
                                        <th>更新时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredApiConfigs.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="empty-state">
                                                暂无配置，请添加
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredApiConfigs.map((config) => (
                                            <tr key={config.id}>
                                                <td>
                                                    {config.task_type === 'ai_draw' ? 'AI绘画' :
                                                        config.task_type === 'ai_chat' ? 'AI聊天' : config.task_type}
                                                </td>
                                                <td className="api-endpoint">{config.api_endpoint}</td>
                                                <td>{config.method}</td>
                                                <td>{config.prompt_path || '-'}</td>
                                                <td>{config.image_path || '-'}</td>
                                                <td>{config.updated_at ? new Date(config.updated_at).toLocaleString('zh-CN') : '-'}</td>
                                                <td>
                                                    <button
                                                        className="btn-action btn-edit"
                                                        onClick={() => {
                                                            setEditingAPIConfig(config);
                                                            setShowAPIModal(true);
                                                        }}
                                                    >
                                                        <FiEdit />
                                                        编辑
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 计费配置弹窗 */}
                {showPricingModal && (
                    <PricingModal
                        pricing={editingPricing}
                        onSave={handleSavePricing}
                        onClose={() => {
                            setShowPricingModal(false);
                            setEditingPricing(null);
                        }}
                        loading={loading}
                    />
                )}

                {/* API配置弹窗 */}
                {showAPIModal && (
                    <APIConfigModal
                        config={editingAPIConfig}
                        onSave={handleSaveAPIConfig}
                        onClose={() => {
                            setShowAPIModal(false);
                            setEditingAPIConfig(null);
                        }}
                        loading={loading}
                    />
                )}
            </div>
        </Layout>
    );
};

// 计费配置弹窗组件
interface PricingModalProps {
    pricing: AIPricing | null;
    onSave: (pricing: AIPricing) => void;
    onClose: () => void;
    loading: boolean;
}

const PricingModal: React.FC<PricingModalProps> = ({ pricing, onSave, onClose, loading }) => {
    const [scene, setScene] = useState(pricing?.scene || '');
    const [stones, setStones] = useState(pricing?.stones || 0);
    const [extraConfig, setExtraConfig] = useState(
        pricing?.extra_config
            ? (typeof pricing.extra_config === 'string'
                ? pricing.extra_config
                : JSON.stringify(pricing.extra_config, null, 2))
            : ''
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let parsedExtraConfig: any = null;
        if (extraConfig.trim()) {
            try {
                parsedExtraConfig = JSON.parse(extraConfig);
            } catch {
                alert('额外配置必须是有效的JSON格式');
                return;
            }
        }
        onSave({
            scene,
            stones,
            extra_config: parsedExtraConfig,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{pricing ? '编辑计费配置' : '添加计费配置'}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <FiX />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>场景 *</label>
                            <input
                                type="text"
                                value={scene}
                                onChange={(e) => setScene(e.target.value)}
                                placeholder="如: ai_draw_single"
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>灵石数量 *</label>
                            <input
                                type="number"
                                value={stones}
                                onChange={(e) => setStones(parseInt(e.target.value) || 0)}
                                min="0"
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>额外配置 (JSON格式，可选)</label>
                            <textarea
                                value={extraConfig}
                                onChange={(e) => setExtraConfig(e.target.value)}
                                placeholder='{"max_resolution": "1024x1024"}'
                                rows={6}
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            取消
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            <FiSave />
                            保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// API配置弹窗组件
interface APIConfigModalProps {
    config: AIAPIConfig | null;
    onSave: (config: AIAPIConfig) => void;
    onClose: () => void;
    loading: boolean;
}

const APIConfigModal: React.FC<APIConfigModalProps> = ({ config, onSave, onClose, loading }) => {
    const [taskType, setTaskType] = useState<'ai_draw' | 'ai_chat' | ''>(config?.task_type as any || '');
    const [apiEndpoint, setApiEndpoint] = useState(config?.api_endpoint || '');
    const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>(config?.method as any || 'POST');
    const [promptPath, setPromptPath] = useState(config?.prompt_path || '');
    const [imagePath, setImagePath] = useState(config?.image_path || '');

    // API Key 配置
    const [apiKey, setApiKey] = useState(config?.api_key || '');
    const [apiKeyLocation, setApiKeyLocation] = useState<'header_bearer' | 'header_custom' | 'query' | 'body' | 'none'>(
        config?.api_key_location as any || 'header_bearer'
    );
    const [apiKeyName, setApiKeyName] = useState(config?.api_key_name || 'Authorization');

    const [headers, setHeaders] = useState(
        config?.headers
            ? (typeof config.headers === 'string'
                ? config.headers
                : JSON.stringify(config.headers, null, 2))
            : ''
    );
    const [bodyTemplate, setBodyTemplate] = useState<any>(
        config?.body_template
            ? (typeof config.body_template === 'string'
                ? JSON.parse(config.body_template)
                : config.body_template)
            : null
    );
    const [bodyTemplateText, setBodyTemplateText] = useState('');
    const [useTreeEditor, setUseTreeEditor] = useState(true);
    const [enablePromptOptimization, setEnablePromptOptimization] = useState(config?.enable_prompt_optimization || false);
    const normalizedEndpoint = apiEndpoint.trim().toLowerCase();
    const isInvalidAiDrawEndpoint = taskType === 'ai_draw' && normalizedEndpoint.includes('/v1/chat/completions');

    // 处理JSON树形编辑器变化
    const handleBodyTemplateChange = (value: any) => {
        setBodyTemplate(value);
    };

    // 粘贴JSON
    const handlePasteJSON = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text);
            setBodyTemplate(parsed);
            setUseTreeEditor(true);
        } catch (error) {
            alert('粘贴的内容不是有效的JSON格式');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let parsedHeaders: any = null;
        let parsedBodyTemplate: any = null;

        if (headers.trim()) {
            try {
                parsedHeaders = JSON.parse(headers);
            } catch {
                alert('请求头必须是有效的JSON格式');
                return;
            }
        }

        if (useTreeEditor) {
            parsedBodyTemplate = bodyTemplate;
        } else {
            if (bodyTemplateText.trim()) {
                try {
                    parsedBodyTemplate = JSON.parse(bodyTemplateText);
                } catch {
                    alert('请求体模板必须是有效的JSON格式');
                    return;
                }
            }
        }

        if (!parsedBodyTemplate) {
            alert('请求体模板不能为空');
            return;
        }

        const bodyTemplateString = JSON.stringify(parsedBodyTemplate).toLowerCase();
        if (taskType === 'ai_draw' && normalizedEndpoint.includes('/v1/chat/completions')) {
            alert('AI绘画主配置不能使用 chat/completions，请改成 generateContent 生图接口');
            return;
        }
        if (taskType === 'ai_draw' && bodyTemplateString.includes('"messages"')) {
            alert('AI绘画主配置不能保存为聊天 messages 模板，请改成生图请求体模板');
            return;
        }

        onSave({
            task_type: taskType,
            api_endpoint: apiEndpoint,
            method: method,
            prompt_path: promptPath.trim() || undefined,
            image_path: imagePath.trim() || undefined,
            api_key: apiKey || undefined,
            api_key_location: apiKeyLocation,
            api_key_name: apiKeyName,
            headers: parsedHeaders,
            body_template: parsedBodyTemplate,
            enable_prompt_optimization: enablePromptOptimization,
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content large-modal">
                <div className="modal-header">
                    <h3>{config ? '编辑API配置' : '添加API配置'}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <FiX />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>场景 *</label>
                            <select
                                value={taskType}
                                onChange={(e) => setTaskType(e.target.value as any)}
                                required
                                disabled={loading}
                            >
                                <option value="">请选择</option>
                                <option value="ai_draw">AI绘画</option>
                                <option value="ai_chat">AI聊天</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>接口地址 *</label>
                            <input
                                type="text"
                                value={apiEndpoint}
                                onChange={(e) => setApiEndpoint(e.target.value)}
                                placeholder="https://api.example.com/ai/draw"
                                required
                                disabled={loading}
                            />
                            {isInvalidAiDrawEndpoint && (
                                <span className="form-hint" style={{ color: '#d14343' }}>
                                    AI绘画主配置不能填写 chat/completions，这会把生图主链路误切成聊天接口。
                                </span>
                            )}
                        </div>

                        <div className="form-group">
                            <label>请求方式 *</label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value as any)}
                                required
                                disabled={loading}
                            >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="PATCH">PATCH</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>

                        {/* API Key 配置区域 */}
                        <div className="form-section">
                            <div className="form-section-title">API Key 配置</div>
                            <div className="form-group">
                                <label>API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="输入 API Key（可选）"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>API Key 发送位置</label>
                                    <select
                                        value={apiKeyLocation}
                                        onChange={(e) => {
                                            const loc = e.target.value as any;
                                            setApiKeyLocation(loc);
                                            // 设置默认的 key name
                                            if (loc === 'header_bearer') {
                                                setApiKeyName('Authorization');
                                            } else if (loc === 'header_custom') {
                                                setApiKeyName('X-API-Key');
                                            } else if (loc === 'query') {
                                                setApiKeyName('api_key');
                                            } else if (loc === 'body') {
                                                setApiKeyName('api_key');
                                            }
                                        }}
                                        disabled={loading}
                                    >
                                        <option value="none">不发送 API Key</option>
                                        <option value="header_bearer">Header - Bearer Token</option>
                                        <option value="header_custom">Header - 自定义名称</option>
                                        <option value="query">Query 参数</option>
                                        <option value="body">Body 参数</option>
                                    </select>
                                    <span className="form-hint">
                                        {apiKeyLocation === 'header_bearer' && '将以 "Authorization: Bearer {API_KEY}" 格式发送'}
                                        {apiKeyLocation === 'header_custom' && '将以自定义 Header 名称发送'}
                                        {apiKeyLocation === 'query' && '将作为 URL 查询参数发送'}
                                        {apiKeyLocation === 'body' && '将添加到请求体 JSON 中'}
                                        {apiKeyLocation === 'none' && '不自动发送 API Key，可在请求头中手动配置'}
                                    </span>
                                </div>

                                {apiKeyLocation !== 'none' && apiKeyLocation !== 'header_bearer' && (
                                    <div className="form-group">
                                        <label>
                                            {apiKeyLocation === 'header_custom' && 'Header 名称'}
                                            {apiKeyLocation === 'query' && '参数名称'}
                                            {apiKeyLocation === 'body' && '字段名称'}
                                        </label>
                                        <input
                                            type="text"
                                            value={apiKeyName}
                                            onChange={(e) => setApiKeyName(e.target.value)}
                                            placeholder={
                                                apiKeyLocation === 'header_custom' ? 'X-API-Key' :
                                                    apiKeyLocation === 'query' ? 'api_key' :
                                                        'api_key'
                                            }
                                            disabled={loading}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>额外请求头 (JSON格式，可选)</label>
                            <textarea
                                value={headers}
                                onChange={(e) => setHeaders(e.target.value)}
                                placeholder='{"Content-Type": "application/json", "X-Custom-Header": "value"}'
                                rows={4}
                                disabled={loading}
                            />
                            <span className="form-hint">
                                配置额外的请求头，API Key 会自动添加到请求头中（根据上面的配置）
                            </span>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>提示词路径</label>
                                <input
                                    type="text"
                                    value={promptPath}
                                    onChange={(e) => setPromptPath(e.target.value)}
                                    placeholder="如: prompt 或 data.prompt"
                                    disabled={loading}
                                />
                            </div>
                            <div className="form-group">
                                <label>图片路径</label>
                                <input
                                    type="text"
                                    value={imagePath}
                                    onChange={(e) => setImagePath(e.target.value)}
                                    placeholder="如: image 或 data.images[0]"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="form-group-header">
                                <label>请求体模板 (JSON格式) *</label>
                                <div className="form-group-actions">
                                    <button
                                        type="button"
                                        className="btn-icon"
                                        onClick={handlePasteJSON}
                                        disabled={loading}
                                        title="从剪贴板粘贴JSON"
                                    >
                                        <FiClipboard />
                                        粘贴JSON
                                    </button>
                                    <label className="toggle-label">
                                        <input
                                            type="checkbox"
                                            checked={useTreeEditor}
                                            onChange={(e) => setUseTreeEditor(e.target.checked)}
                                            disabled={loading}
                                        />
                                        <span>树形编辑</span>
                                    </label>
                                </div>
                            </div>
                            {useTreeEditor ? (
                                <div className="json-editor-wrapper">
                                    <JSONTreeEditor
                                        value={bodyTemplate}
                                        onChange={handleBodyTemplateChange}
                                        disabled={loading}
                                    />
                                </div>
                            ) : (
                                <textarea
                                    value={bodyTemplateText || JSON.stringify(bodyTemplate, null, 2)}
                                    onChange={(e) => setBodyTemplateText(e.target.value)}
                                    placeholder='{"prompt": "{{prompt}}", "width": 1024, "height": 1024}'
                                    rows={8}
                                    required
                                    disabled={loading}
                                />
                            )}
                            <span className="form-hint">
                                在JSON中使用占位符：<code>{'{{prompt}}'}</code> 表示提示词位置，<code>{'{{image}}'}</code> 表示图片位置。
                                系统会自动查找并替换这些占位符，无需手动指定路径。
                            </span>
                            {taskType === 'ai_draw' && (
                                <span className="form-hint" style={{ color: '#d14343' }}>
                                    AI绘画主配置应使用 generateContent 生图模板，不要保存带 <code>messages</code> 的聊天请求体。
                                </span>
                            )}
                        </div>

                        <div className="form-group">
                            <label>是否开启提示词优化</label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={enablePromptOptimization}
                                    onChange={(e) => setEnablePromptOptimization(e.target.checked)}
                                    disabled={loading}
                                />
                                <span>开启提示词优化（使用AI优化用户输入的提示词）</span>
                            </label>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            取消
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            <FiSave />
                            保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AIConfig;
